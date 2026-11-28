import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const worker = await readFile(resolve(root, "src/worker.js"), "utf8");
const migration = await readFile(resolve(root, "migrations/0009_security_audit_indexes.sql"), "utf8");

function section(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, "section start must exist: " + start);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, "section end must exist: " + end);
  return source.slice(a, b);
}

// Atomic deduplication prevents one repeated security condition from causing
// unbounded audit writes inside the configured suppression window.
const auditHelper = section(worker, "async function auditOnceWithin", "function adminAuditRoute");
assert.match(auditHelper, /INSERT INTO audit_log[\s\S]*SELECT[\s\S]*WHERE NOT EXISTS/);
assert.match(auditHelper, /actor_user_id IS \?/);
assert.match(auditHelper, /created_at>\?/);

// A valid authenticated non-admin must still receive 403, with a security event.
const adminGuard = section(worker, "async function requireAdmin(", "function modelSessionCookie");
assert.match(adminGuard, /user\.role !== "admin"/);
assert.match(adminGuard, /"admin\.access\.denied"/);
assert.match(adminGuard, /status: 403/);

// Login: failed credentials and rate limiting are separately auditable.
// Only the SHA-256 email key is used as the event target; no raw email/password is logged.
const login = section(worker, 'if (path === "/api/auth/login" && method === "POST")', 'if (path === "/api/auth/logout" && method === "POST")');
assert.match(login, /"admin\.login\.rate_limited", "auth_identity", emailKey/);
assert.match(login, /"admin\.login\.failed", "auth_identity", emailKey/);
assert.match(login, /"admin\.login\.denied_role"/);
assert.match(login, /"admin\.login\.succeeded"/);
assert.doesNotMatch(login, /audit\([^\n]*password\s*[,}]/);
assert.doesNotMatch(login, /"member\.login"/);

// MFA: missing/invalid codes, replay, and successful step consumption are recorded
// without ever recording the submitted six-digit OTP.
const mfa = section(worker, "async function requireAdminMfa", "async function issueModelApiKey");
assert.match(mfa, /"admin\.totp\.invalid"/);
assert.match(mfa, /"admin\.totp\.replay_rejected"/);
assert.match(mfa, /"admin\.mfa\.accepted"/);
assert.match(mfa, /\{totp_step:step\}/);
assert.doesNotMatch(mfa, /detail[^\n]*supplied/);

// Logout: audit event and current-session deletion are submitted as one D1 batch.
// The audit payload must not include the raw session token or its hash.
const logout = section(worker, 'if (path === "/api/auth/logout" && method === "POST")', 'if (path === "/api/me" && method === "GET")');
assert.match(logout, /"admin\.logout"/);
assert.match(logout, /env\.DB\.batch\(\[/);
assert.match(logout, /auditStatement\(env, user\.id, action,[\s\S]*\{ session_revoked: true \}\)/);
assert.match(logout, /DELETE FROM sessions WHERE token_hash=\?/);
assert.match(logout, /Set-Cookie/);

assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_audit_log_security_dedupe/);
assert.match(migration, /actor_user_id, action, target_type, target_id, created_at/);

console.log("PASS: audit event deduplication is atomic and bounded");
console.log("PASS: non-admin administrator-route denial remains HTTP 403 and is auditable");
console.log("PASS: login failure, rate limit, role denial and success have distinct audit events");
console.log("PASS: TOTP invalid, replay rejection and accepted use are auditable without storing OTP codes");
console.log("PASS: admin logout audit and current-session revocation are batched; session tokens are not audited");
console.log("PASS: additive audit lookup index migration exists");
