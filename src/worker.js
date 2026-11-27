const SESSION_COOKIE = "__Host-ms_session";
const MODEL_SESSION_COOKIE = "__Host-ms_model_session";
const PBKDF2_ITERATIONS = 600000;
const SESSION_DAYS = 1;
const MODEL_SESSION_HOURS = 12;
const MAX_MODEL_API_BODY = 65536;
const MAX_MODEL_ARTIFACT_BYTES = 25 * 1024 * 1024;
const enc = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
  });
}
function fail(status, error) { return json({ error }, status); }
function hex(bytes) { return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join(""); }
function unhex(value) { return new Uint8Array((value.match(/.{2}/g) || []).map(x => parseInt(x, 16))); }
function randomHex(size = 32) { const b = new Uint8Array(size); crypto.getRandomValues(b); return hex(b); }
function randomToken(size = 32) { return randomHex(size); }
function b64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function digest(value) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)))); }
async function digestBytes(value) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", value))); }
async function passwordHash(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unhex(salt), iterations, hash: "SHA-256" }, key, 256);
  return hex(new Uint8Array(bits));
}
function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function cookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const p = part.trim(); const n = p.indexOf("=");
    if (n > 0 && p.slice(0, n) === name) return decodeURIComponent(p.slice(n + 1));
  }
  return null;
}
function sessionCookie(value, maxAge) {
  return SESSION_COOKIE + "=" + (value || "") + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAge;
}
function originValid(request) {
  const origin = request.headers.get("Origin");
  return !!origin && origin === new URL(request.url).origin;
}
async function bodyJson(request, max = 30000) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > max) throw new Error("Request body too large");
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.toLowerCase().includes("application/json")) throw new Error("Content-Type must be application/json");
  const text = await request.text();
  if (text.length > max) throw new Error("Request body too large");
  try { return JSON.parse(text || "{}"); } catch (_) { throw Object.assign(new Error("Invalid JSON body"), { status: 400 }); }
}
function cleanEmail(value) { return String(value || "").trim().toLowerCase(); }
function validEmail(value) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function validPassword(value) { return typeof value === "string" && value.length >= 14 && value.length <= 160; }
function nowIso() { return new Date().toISOString(); }
function addDays(days) { return new Date(Date.now() + days * 86400000).toISOString(); }
function rows(result) { return result && Array.isArray(result.results) ? result.results : []; }
async function audit(env, actor, action, targetType, targetId, detail) {
  await env.DB.prepare("INSERT INTO audit_log (id,actor_user_id,action,target_type,target_id,detail_json,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), actor || null, action, targetType || null, targetId || null, detail ? JSON.stringify(detail) : null, nowIso()).run();
}
async function createSession(env, userId) {
  const token = randomToken(32), tokenHash = await digest(token), expiry = addDays(SESSION_DAYS), now = nowIso();
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)")
    .bind(tokenHash, userId, expiry, now, now).run();
  return { token, expiry };
}
async function getUser(request, env) {
  const token = cookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await digest(token);
  return await env.DB.prepare("SELECT u.id,u.email,u.display_name,u.role,u.email_verified,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'")
    .bind(tokenHash, nowIso()).first();
}
async function requireUser(request, env) {
  const user = await getUser(request, env);
  if (!user) throw Object.assign(new Error("請先登入 / Sign in required"), { status: 401 });
  return user;
}
async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (user.role !== "admin") throw Object.assign(new Error("管理員權限不足 / Administrator access required"), { status: 403 });
  return user;
}

function modelSessionCookie(value,maxAge){return MODEL_SESSION_COOKIE+"="+(value||"")+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+maxAge;}
async function createModelSession(env,id){const token=randomToken(32),hash=await digest(token),expiry=new Date(Date.now()+MODEL_SESSION_HOURS*3600000).toISOString(),now=nowIso();await env.DB.prepare("INSERT INTO model_sessions (token_hash,model_member_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)").bind(hash,id,expiry,now,now).run();return{token,expiry};}
async function getModelMember(request,env){const token=cookie(request,MODEL_SESSION_COOKIE);if(!token)return null;return await env.DB.prepare("SELECT m.id,m.email,m.display_name,m.status,m.email_verified,m.privacy_notice_version FROM model_sessions s JOIN model_members m ON m.id=s.model_member_id WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'").bind(await digest(token),nowIso()).first();}
async function requireModelMember(request,env){const m=await getModelMember(request,env);if(!m)throw Object.assign(new Error("Model Series sign-in required"),{status:401});return m;}
function modelMemberSafe(m){return{id:m.id,email:m.email,display_name:m.display_name,status:m.status,email_verified:!!m.email_verified,privacy_notice_version:m.privacy_notice_version};}
function base32Bytes(value){const a="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",v=String(value||"").toUpperCase().replace(/=+$/,"").replace(/\s/g,"");let bits=0,acc=0,out=[];for(const c of v){const n=a.indexOf(c);if(n<0)throw new Error("ADMIN_TOTP_SECRET must be Base32");acc=(acc<<5)|n;bits+=5;if(bits>=8){bits-=8;out.push((acc>>bits)&255);}}return new Uint8Array(out);}
async function totpAt(secret,ts){const key=await crypto.subtle.importKey("raw",base32Bytes(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]),counter=BigInt(Math.floor(ts/30000)),msg=new Uint8Array(8);for(let i=7;i>=0;i--)msg[i]=Number((counter>>BigInt((7-i)*8))&255n);const mac=new Uint8Array(await crypto.subtle.sign("HMAC",key,msg)),o=mac[mac.length-1]&15,n=((mac[o]&127)<<24)|((mac[o+1]&255)<<16)|((mac[o+2]&255)<<8)|(mac[o+3]&255);return String(n%1000000).padStart(6,"0");}
async function matchingAdminTotpStep(secret,supplied){
  if(!/^\d{6}$/.test(String(supplied||"")))return null;
  const now=Date.now();
  for(const drift of [-30000,0,30000]){
    const step=Math.floor((now+drift)/30000);
    if(same(await totpAt(secret,step*30000),supplied))return step;
  }
  return null;
}
async function requireAdminMfa(request,env){
  const admin=await requireAdmin(request,env);
  if(!env.ADMIN_TOTP_SECRET)throw Object.assign(new Error("Admin MFA is not configured; privileged writes are disabled"),{status:503});
  const step=await matchingAdminTotpStep(env.ADMIN_TOTP_SECRET,request.headers.get("X-Admin-TOTP")||"");
  if(step===null)throw Object.assign(new Error("Valid administrator TOTP required"),{status:401});
  const used=await env.DB.prepare("INSERT INTO admin_mfa_state (admin_user_id,last_step,updated_at) VALUES (?,?,?) ON CONFLICT(admin_user_id) DO UPDATE SET last_step=excluded.last_step,updated_at=excluded.updated_at WHERE admin_mfa_state.last_step < excluded.last_step RETURNING admin_user_id")
    .bind(admin.id,step,nowIso()).first();
  if(!used)throw Object.assign(new Error("Administrator TOTP code was already used; wait for the next code"),{status:409});
  return admin;
}
async function issueModelApiKey(env,memberId,licenseId,scopes,expiresAt){const raw="MSM_"+randomToken(32),id=crypto.randomUUID(),now=nowIso();await env.DB.prepare("INSERT INTO model_api_keys (id,model_member_id,model_license_id,key_prefix,key_hash,scopes_json,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,memberId,licenseId,raw.slice(0,12),await digest(raw),JSON.stringify(scopes),now,expiresAt||null).run();return{id,api_key:raw,key_prefix:raw.slice(0,12),scopes,created_at:now,expires_at:expiresAt||null};}
async function authenticateModelApiKey(request,env,scope){const m=(request.headers.get("Authorization")||"").match(/^Bearer\s+(MSM_[A-Za-z0-9_-]{40,100})$/);if(!m)throw Object.assign(new Error("Model API key required"),{status:401});const now=nowIso(),row=await env.DB.prepare("SELECT k.id,k.model_member_id,k.model_license_id,k.scopes_json,k.expires_at,k.revoked_at,l.status AS license_status,l.expires_at AS license_expires_at,m.status AS member_status FROM model_api_keys k JOIN model_licenses l ON l.id=k.model_license_id JOIN model_members m ON m.id=k.model_member_id WHERE k.key_hash=?").bind(await digest(m[1])).first();if(!row||row.revoked_at||row.license_status!=="active"||row.member_status!=="active"||(row.expires_at&&row.expires_at<=now)||(row.license_expires_at&&row.license_expires_at<=now))throw Object.assign(new Error("Model API key is invalid or inactive"),{status:401});let scopes=[];try{scopes=JSON.parse(row.scopes_json||"[]");}catch(_){}if(!Array.isArray(scopes)||!scopes.includes(scope))throw Object.assign(new Error("API key scope does not allow this operation"),{status:403});await env.DB.prepare("UPDATE model_api_keys SET last_used_at=? WHERE id=?").bind(now,row.id).run();return row;}
function secureResponse(response){const h=new Headers(response.headers);h.set("X-Content-Type-Options","nosniff");h.set("X-Frame-Options","DENY");h.set("Referrer-Policy","strict-origin-when-cross-origin");h.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");h.set("Cross-Origin-Resource-Policy","same-origin");h.set("Cross-Origin-Opener-Policy","same-origin");h.set("Strict-Transport-Security","max-age=31536000; includeSubDomains");h.set("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});}
async function privacySubject(request,env){const m=await getModelMember(request,env);if(m)return{type:"model_member",id:m.id,email:m.email};const u=await getUser(request,env);if(u)return{type:"member",id:u.id,email:u.email};return null;}

async function createUser(env, email, displayName, password, role = "member", verified = 0) {
  const id = crypto.randomUUID(), salt = randomHex(16);
  const pwh = await passwordHash(password, salt);
  await env.DB.prepare("INSERT INTO users (id,email,display_name,password_salt,password_hash,password_iterations,role,email_verified,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, email, displayName, salt, pwh, PBKDF2_ITERATIONS, role, verified, "active", nowIso()).run();
  return id;
}
function auditSafeUser(user) {
  return { id: user.id, email: user.email, display_name: user.display_name, role: user.role, email_verified: !!user.email_verified, status: user.status };
}
async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname, method = request.method.toUpperCase();
  if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (method === "POST" && !originValid(request)) return fail(403, "Origin check failed");
  if (!env.DB) return fail(503, "會員資料庫尚未綁定 / D1 database binding missing");

  if (path === "/api/health" && method === "GET") {
    return json({ ok: true, service: "MorningStar membership", database: "connected", version: "0.1.0" });
  }
  if (path === "/api/setup-status" && method === "GET") {
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").first();
    return json({ needs_admin: Number(row.count) === 0, bootstrap_configured: !!env.ADMIN_BOOTSTRAP_TOKEN });
  }

  if (path === "/api/auth/register" && method === "POST") {
    const b = await bodyJson(request);
    const email = cleanEmail(b.email), name = String(b.display_name || "").trim(), password = b.password;
    if (!validEmail(email)) return fail(400, "請輸入有效電子郵件 / Enter a valid email");
    if (!name || name.length > 80) return fail(400, "顯示名稱需為 1–80 字元 / Display name must be 1–80 characters");
    if (!validPassword(password)) return fail(400, "密碼至少 14 個字元 / Password must be at least 14 characters");
    try {
      const id = await createUser(env, email, name, password);
      const s = await createSession(env, id);
      await audit(env, id, "member.register", "user", id);
      return json({ user: { id, email, display_name: name, role: "member", email_verified: false } }, 201, { "Set-Cookie": sessionCookie(s.token, SESSION_DAYS * 86400) });
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) return fail(409, "此電子郵件已註冊 / Email already registered");
      throw e;
    }
  }

  if (path === "/api/auth/login" && method === "POST") {
    const b = await bodyJson(request), email = cleanEmail(b.email), password = String(b.password || "");
    if (!validEmail(email) || !password) return fail(400, "電子郵件或密碼格式錯誤 / Invalid email or password");
    const emailKey = await digest(email), since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const attempts = await env.DB.prepare("SELECT COUNT(*) AS count FROM auth_attempts WHERE email_key=? AND attempted_at>?").bind(emailKey, since).first();
    if (Number(attempts.count) >= 8) return fail(429, "登入嘗試過多，請 15 分鐘後再試 / Too many attempts; retry in 15 minutes");
    await env.DB.prepare("INSERT INTO auth_attempts (email_key,attempted_at) VALUES (?,?)").bind(emailKey, nowIso()).run();
    const u = await env.DB.prepare("SELECT id,email,display_name,password_salt,password_hash,password_iterations,role,email_verified,status FROM users WHERE email=?").bind(email).first();
    const calculated = u ? await passwordHash(password, u.password_salt, u.password_iterations) : await passwordHash(password, "00000000000000000000000000000000");
    if (!u || !same(calculated, u.password_hash) || u.status !== "active") return fail(401, "電子郵件或密碼不正確 / Incorrect email or password");
    if (Number(u.password_iterations) < PBKDF2_ITERATIONS) {
      const salt = randomHex(16), hash = await passwordHash(password,salt,PBKDF2_ITERATIONS);
      await env.DB.prepare("UPDATE users SET password_salt=?,password_hash=?,password_iterations=? WHERE id=?").bind(salt,hash,PBKDF2_ITERATIONS,u.id).run();
    }
    await env.DB.prepare("DELETE FROM auth_attempts WHERE email_key=?").bind(emailKey).run();
    const s = await createSession(env, u.id);
    await audit(env, u.id, "member.login", "user", u.id);
    return json({ user: auditSafeUser(u) }, 200, { "Set-Cookie": sessionCookie(s.token, SESSION_DAYS * 86400) });
  }

  if (path === "/api/auth/logout" && method === "POST") {
    const token = cookie(request, SESSION_COOKIE);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  if (path === "/api/me" && method === "GET") {
    const user = await requireUser(request, env);
    const licenses = rows(await env.DB.prepare("SELECT l.id,l.license_type,l.license_key_prefix,l.status,l.issued_at,l.expires_at,p.version AS product_version FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.user_id=? ORDER BY l.issued_at DESC").bind(user.id).all());
    const orders = rows(await env.DB.prepare("SELECT id,product_id,requested_license_type,status,created_at,updated_at,admin_note FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 30").bind(user.id).all());
    const p = await env.DB.prepare("SELECT p.id,p.title,p.version,p.description,p.file_name,p.file_size,p.status,p.commercial_enabled,CASE WHEN a.product_id IS NULL THEN 0 ELSE 1 END AS file_ready FROM products p LEFT JOIN product_artifacts a ON a.product_id=p.id WHERE p.id='morningstar-skill-v3'").first();
    return json({ user: auditSafeUser(user), licenses, orders, product: p || null });
  }

  if (path === "/api/products" && method === "GET") {
    const products = rows(await env.DB.prepare("SELECT p.id,p.title,p.version,p.description,p.file_name,p.file_size,p.status,p.commercial_enabled,CASE WHEN a.product_id IS NULL THEN 0 ELSE 1 END AS file_ready FROM products p LEFT JOIN product_artifacts a ON a.product_id=p.id WHERE p.status='available'").all());
    return json({ products });
  }

  if (path === "/api/orders" && method === "POST") return fail(410,"MorningStar Skill is a public non-commercial release. Commercial licensing belongs to the separate Model Series.");
  if (path.startsWith("/api/download/") && method === "GET") return fail(410,"Legacy Skill member downloads are retired. Use the public Skill download endpoint or Model Series private downloads.");

  if (path === "/api/licenses/validate" && method === "POST") {
    const b = await bodyJson(request), key = String(b.license_key || "").trim();
    if (key.length < 20 || key.length > 120) return json({ valid: false });
    const keyHash = await digest(key);
    const l = await env.DB.prepare("SELECT l.id,l.status,l.license_type,l.issued_at,l.expires_at,p.id AS product_id,p.version FROM licenses l JOIN products p ON p.id=l.product_id WHERE l.license_key_hash=?").bind(keyHash).first();
    const valid = !!l && l.status === "active" && (!l.expires_at || l.expires_at > nowIso());
    return json({ valid, ...(valid ? { license: { id: l.id, type: l.license_type, product_id: l.product_id, version: l.version, issued_at: l.issued_at, expires_at: l.expires_at } } : {}) });
  }

  if (path === "/api/admin/bootstrap" && method === "POST") {
    if (!env.ADMIN_BOOTSTRAP_TOKEN) return fail(503, "請先在 Worker Secrets 設定 ADMIN_BOOTSTRAP_TOKEN / Set the bootstrap secret first");
    const supplied = request.headers.get("X-Admin-Bootstrap") || "";
    if (!same(supplied, env.ADMIN_BOOTSTRAP_TOKEN)) return fail(403, "Bootstrap token invalid");
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").first();
    if (Number(count.count) > 0) return fail(409, "管理員已初始化，此操作只能使用一次 / Administrator already initialized");
    const b = await bodyJson(request), email = cleanEmail(b.email), name = String(b.display_name || "").trim(), password = b.password;
    if (!validEmail(email) || !name || name.length > 80 || !validPassword(password)) return fail(400, "管理員資料格式錯誤 / Invalid administrator profile");
    const exists = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if (exists) return fail(409, "此電子郵件已存在會員帳戶；請先用新電子郵件註冊或移除重複帳戶 / Email already exists; use a new address");
    const id = await createUser(env, email, name, password, "admin", 1);
    const s = await createSession(env, id);
    await audit(env, id, "admin.bootstrap", "user", id);
    return json({ user: { id, email, display_name: name, role: "admin", email_verified: true } }, 201, { "Set-Cookie": sessionCookie(s.token, SESSION_DAYS * 86400) });
  }

  if (path === "/api/admin/overview" && method === "GET") {
    const admin = await requireAdmin(request, env);
    const orders = rows(await env.DB.prepare("SELECT o.id,o.requested_license_type,o.status,o.payment_reference,o.created_at,u.email,u.display_name,u.email_verified,p.title,p.version FROM orders o JOIN users u ON u.id=o.user_id JOIN products p ON p.id=o.product_id ORDER BY o.created_at DESC LIMIT 100").all());
    const users = rows(await env.DB.prepare("SELECT id,email,display_name,role,email_verified,status,created_at FROM users ORDER BY created_at DESC LIMIT 100").all());
    const auditRows = rows(await env.DB.prepare("SELECT action,target_type,target_id,created_at FROM audit_log ORDER BY created_at DESC LIMIT 30").all());
    return json({ orders, users, audit: auditRows, administrator: admin.email });
  }

  const verifyMatch = path.match(/^\/api\/admin\/users\/([0-9a-f-]+)\/verify-email$/);
  if (verifyMatch && method === "POST") {
    const admin = await requireAdminMfa(request, env), id = verifyMatch[1];
    await env.DB.prepare("UPDATE users SET email_verified=1 WHERE id=?").bind(id).run();
    await audit(env, admin.id, "admin.user.verify_email", "user", id);
    return json({ ok: true });
  }

  const approveMatch = path.match(/^\/api\/admin\/orders\/([0-9a-f-]+)\/approve$/);
  if (approveMatch && method === "POST") {
    const admin = await requireAdminMfa(request, env), id = approveMatch[1];
    const order = await env.DB.prepare("SELECT o.*,u.email_verified,p.commercial_enabled,p.id AS product_id FROM orders o JOIN users u ON u.id=o.user_id JOIN products p ON p.id=o.product_id WHERE o.id=?").bind(id).first();
    if (!order) return fail(404, "Order not found");
    if (order.status !== "pending_review") return fail(409, "Order is not pending review");
    if (!order.email_verified) return fail(409, "會員電子郵件尚未核驗 / Member email not verified");
    if (order.requested_license_type === "commercial") {
      if (!order.commercial_enabled) return fail(403, "Commercial licensing is disabled");
      const doc = await env.DB.prepare("SELECT id FROM legal_documents WHERE id=? AND status='published'").bind(order.terms_version).first();
      if (!doc) return fail(409, "Commercial license terms are not published");
    }
    const artifact = await env.DB.prepare("SELECT product_id FROM product_artifacts WHERE product_id=?").bind(order.product_id).first();
    if (!artifact) return fail(409, "Package must be uploaded before approval");
    const key = "MSK3-" + randomToken(24).toUpperCase();
    const licenseId = crypto.randomUUID(), keyHash = await digest(key), now = nowIso();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO licenses (id,user_id,order_id,product_id,license_type,license_key_hash,license_key_prefix,status,seats,issued_at,created_at) VALUES (?,?,?,?,?,?,?,'active',1,?,?)")
        .bind(licenseId, order.user_id, order.id, order.product_id, order.requested_license_type, keyHash, key.slice(0, 9), now, now),
      env.DB.prepare("UPDATE orders SET status='approved',updated_at=? WHERE id=?").bind(now, id),
      env.DB.prepare("INSERT INTO audit_log (id,actor_user_id,action,target_type,target_id,detail_json,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), admin.id, "admin.order.approve", "order", id, JSON.stringify({ license_id: licenseId, license_type: order.requested_license_type }), now)
    ]);
    return json({ ok: true, license_id: licenseId, license_key: key, notice: "This key is shown once. Store it securely and provide it to the licensee." });
  }

  const rejectMatch = path.match(/^\/api\/admin\/orders\/([0-9a-f-]+)\/reject$/);
  if (rejectMatch && method === "POST") {
    const admin = await requireAdminMfa(request, env), b = await bodyJson(request), id = rejectMatch[1];
    await env.DB.prepare("UPDATE orders SET status='rejected',admin_note=?,updated_at=? WHERE id=? AND status='pending_review'")
      .bind(String(b.note || "").slice(0, 500), nowIso(), id).run();
    await audit(env, admin.id, "admin.order.reject", "order", id);
    return json({ ok: true });
  }

  if (path === "/api/admin/artifacts/upload" && method === "POST") {
    const admin = await requireAdminMfa(request, env), b = await bodyJson(request, 1500000);
    const productId = String(b.product_id || ""), fileName = String(b.file_name || "");
    const content = String(b.content_base64 || ""), sha = String(b.sha256 || "").toLowerCase();
    if (productId !== "morningstar-skill-v3" || fileName !== "MorningStar-Skill-v3.0.0-Commercial.zip") return fail(400, "Unexpected product or package file name");
    if (!content || content.length > 1300000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) return fail(413, "Invalid or oversized base64 package");
    const bytes = Uint8Array.from(atob(content), c => c.charCodeAt(0));
    if (bytes.length > 1024 * 1024) return fail(413, "Package exceeds 1 MiB D1 storage threshold");
    const actual = await digestBytes(bytes);
    if (!same(actual, sha)) return fail(400, "SHA-256 verification failed");
    await env.DB.prepare("INSERT INTO product_artifacts (product_id,content_base64,sha256,updated_at) VALUES (?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET content_base64=excluded.content_base64,sha256=excluded.sha256,updated_at=excluded.updated_at")
      .bind(productId, content, actual, nowIso()).run();
    await audit(env, admin.id, "admin.artifact.upload", "product", productId, { sha256: actual, bytes: bytes.length });
    return json({ ok: true, sha256: actual, bytes: bytes.length });
  }

  if (path === "/api/admin/commercial/publish" && method === "POST") {
    const admin = await requireAdmin(request, env), b = await bodyJson(request, 12000);
    const rights = String(b.rights_scope || "").trim(), body = String(b.terms_body || "").trim();
    if (b.confirmation !== true) return fail(400, "Rights confirmation is required");
    if (rights.length < 100 || body.length < 500 || body.length > 10000) return fail(400, "Rights scope must be 100+ characters and final terms 500–10000 characters");
    if (!/CC BY-NC-ND/i.test(body) || !/(exclude|excluded|不包含|排除)/i.test(body)) return fail(400, "Terms must explicitly preserve and exclude the original CC BY-NC-ND layer");
    const docId = "ms-commercial-terms-" + String(b.terms_version || "commercial-1.0").replace(/[^A-Za-z0-9._-]/g, "");
    const now = nowIso();
    await env.DB.batch([
      env.DB.prepare("UPDATE legal_documents SET status='retired' WHERE license_scope='commercial_additions' AND status='published'"),
      env.DB.prepare("INSERT INTO legal_documents (id,title,version,license_scope,status,body,created_at,published_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status='published',body=excluded.body,published_at=excluded.published_at")
        .bind(docId, "MorningStar commercial additions license", String(b.terms_version || "commercial-1.0"), "commercial_additions", "published", "RIGHTS SCOPE:\n" + rights + "\n\nTERMS:\n" + body, now, now),
      env.DB.prepare("UPDATE products SET commercial_enabled=1 WHERE id='morningstar-skill-v3'"),
      env.DB.prepare("INSERT INTO audit_log (id,actor_user_id,action,target_type,target_id,detail_json,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), admin.id, "admin.commercial_terms.publish", "legal_document", docId, JSON.stringify({ rights_scope: rights }), now)
    ]);
    return json({ ok: true, terms_id: docId, warning: "Terms published by administrator assertion. Independent legal review is still recommended." });
  }

  return fail(404, "API route not found");
}

export default {
  async fetch(request, env) {
    try {
      return secureResponse(await handle(request, env));
    } catch (error) {
      const status = Number(error && error.status) || 500;
      if (status >= 500) console.error(JSON.stringify({event:"morningstar_api_error",status,name:error && error.name ? error.name : "Error"}));
      return secureResponse(json({ error: status >= 500 ? "服務暫時發生錯誤，請稍後再試 / Internal service error" : error.message }, status));
    }
  }
};