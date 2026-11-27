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
async function authenticateModelApiKey(request,env,scope){
  const match=(request.headers.get("Authorization")||"").match(/^Bearer\\s+(MSM_[A-Za-z0-9_-]{40,100})$/);
  if(!match)throw Object.assign(new Error("Model API key required"),{status:401});
  const now=nowIso(),row=await env.DB.prepare("SELECT k.id,k.model_member_id,k.model_license_id,k.scopes_json,k.expires_at,k.revoked_at,l.model_product_id,l.scopes_json AS license_scopes,l.status AS license_status,l.expires_at AS license_expires_at,m.status AS member_status,m.email_verified,p.status AS product_status,p.commercial_enabled FROM model_api_keys k JOIN model_licenses l ON l.id=k.model_license_id JOIN model_members m ON m.id=k.model_member_id JOIN model_products p ON p.id=l.model_product_id WHERE k.key_hash=?").bind(await digest(match[1])).first();
  if(!row||row.revoked_at||row.license_status!=="active"||row.member_status!=="active"||!row.email_verified||(row.expires_at&&row.expires_at<=now)||(row.license_expires_at&&row.license_expires_at<=now))throw Object.assign(new Error("Model API key is invalid or inactive"),{status:401});
  if(row.product_status!=="available"||Number(row.commercial_enabled)!==1)throw Object.assign(new Error("Model product is not commercially enabled"),{status:403});
  let scopes=[];try{scopes=JSON.parse(row.scopes_json||"[]");}catch(_){}
  if(!Array.isArray(scopes)||!scopes.includes(scope))throw Object.assign(new Error("API key scope does not allow this operation"),{status:403});
  await env.DB.prepare("UPDATE model_api_keys SET last_used_at=? WHERE id=?").bind(now,row.id).run();
  return row;
}
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

  if (path === "/api/auth/register" && method === "POST") return fail(410,"Public MorningStar Skill does not require an account. Model Series registration uses its separate identity service.");

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
    if (u.role !== "admin") return fail(403, "This login is reserved for site administrators. Model Series uses a separate account system.");
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

  if (path === "/api/me" && method === "GET") return fail(410,"Legacy Skill member accounts are retired. Public Skill access requires no login; Model Series uses separate accounts.");

  if (path === "/api/products" && method === "GET") return fail(410,"Use /api/public/skill/releases for public Skill releases.");


  // Anonymous public Skill catalog and release download. Only published stable versions can be fetched.
  if (path === "/api/public/skill/releases" && method === "GET") {
    const stable = rows(await env.DB.prepare("SELECT version,sha256,license_scope,release_notes,published_at FROM skill_releases WHERE status='published' ORDER BY published_at DESC").all());
    const candidates = rows(await env.DB.prepare("SELECT version,license_scope,release_notes,created_at FROM skill_releases WHERE status='candidate' ORDER BY created_at DESC").all());
    return json({
      product:"MorningStar Skill",
      access:"public",
      authentication_required:false,
      stable_releases:stable.map(x=>({version:x.version,sha256:x.sha256,license_scope:x.license_scope,release_notes:x.release_notes,published_at:x.published_at,download_url:"/api/public/skill/download/"+encodeURIComponent(x.version)})),
      candidates:candidates.map(x=>({version:x.version,status:"candidate",license_scope:x.license_scope,release_notes:x.release_notes,created_at:x.created_at,downloadable:false}))
    });
  }
  const publicDownloadPrefix="/api/public/skill/download/";
  if(path.startsWith(publicDownloadPrefix)&&method==="GET"){
    const version=path.slice(publicDownloadPrefix.length);
    if(!/^[A-Za-z0-9._-]{1,40}$/.test(version))return fail(400,"Invalid Skill release version");
    const release=await env.DB.prepare("SELECT version,file_path,sha256,status FROM skill_releases WHERE version=?").bind(version).first();
    if(!release||release.status!=="published"||!release.file_path)return fail(404,"No published stable Skill release exists for this version");
    const pieces=release.file_path.split("/");
    if(pieces.length!==4||pieces[0]!==""||pieces[1]!=="releases"||pieces[2]!=="skill"||!/^[A-Za-z0-9._-]+\.zip$/.test(pieces[3]))return fail(409,"Release path is outside the public Skill asset directory");
    const asset=await env.ASSETS.fetch(new Request(new URL(release.file_path,url.origin).toString(),{method:"GET"}));
    if(!asset.ok)return fail(503,"Published Skill archive is not available");
    const bytes=await asset.arrayBuffer();
    if(bytes.byteLength>50*1024*1024)return fail(413,"Published Skill archive exceeds the delivery limit");
    if(await digestBytes(bytes)!==release.sha256)return fail(503,"Published Skill archive SHA-256 mismatch");
    return new Response(bytes,{status:200,headers:{
      "Content-Type":"application/zip",
      "Content-Disposition":"attachment; filename=MorningStar-Skill-"+release.version+".zip",
      "Content-Length":String(bytes.byteLength),
      "Cache-Control":"public, max-age=3600",
      "X-MorningStar-SHA256":release.sha256,
      "X-Content-Type-Options":"nosniff"
    }});
  }

  if (path === "/api/orders" && method === "POST") return fail(410,"MorningStar Skill is a public non-commercial release. Commercial licensing belongs to the separate Model Series.");
  if (path.startsWith("/api/download/") && method === "GET") return fail(410,"Legacy Skill member downloads are retired. Use the public Skill download endpoint or Model Series private downloads.");

  if (path === "/api/licenses/validate" && method === "POST") return fail(410,"Legacy Skill license validation is retired; Model Series uses separate scoped API credentials.");

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
    const admin = await requireAdminMfa(request, env);
    const releases = rows(await env.DB.prepare("SELECT version,status,sha256,license_scope,release_notes,created_at,published_at FROM skill_releases ORDER BY created_at DESC").all());
    const rights = rows(await env.DB.prepare("SELECT product_version,status,included_in_package,COUNT(*) AS count FROM commercial_rights_assets GROUP BY product_version,status,included_in_package ORDER BY product_version,status").all());
    const modelProducts = rows(await env.DB.prepare("SELECT id,title,version,status,commercial_enabled FROM model_products ORDER BY created_at DESC").all());
    const modelCounts = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM model_members) AS members,(SELECT COUNT(*) FROM model_orders) AS orders,(SELECT COUNT(*) FROM model_licenses) AS licenses,(SELECT COUNT(*) FROM model_artifacts) AS artifacts").first();
    const auditRows = rows(await env.DB.prepare("SELECT action,target_type,target_id,created_at FROM audit_log ORDER BY created_at DESC LIMIT 30").all());
    return json({ administrator:admin.email, releases, rights, model_products:modelProducts, model_counts:modelCounts, audit:auditRows });
  }



  const rightsAssetsMatch = path.match(/^\/api\/admin\/skill\/releases\/([A-Za-z0-9._-]{1,40})\/rights-assets$/);
  if (rightsAssetsMatch && method === "GET") {
    await requireAdminMfa(request,env);
    const version = rightsAssetsMatch[1];
    const assets = rows(await env.DB.prepare("SELECT id,asset_path,asset_sha256,creator,rights_basis,third_party,third_party_license,commercial_use_allowed,redistribution_allowed,evidence_reference,included_in_package,status,review_note FROM commercial_rights_assets WHERE product_version=? ORDER BY asset_path").bind(version).all());
    return json({version,assets});
  }

  const rightsAssetReviewMatch = path.match(/^\/api\/admin\/skill\/rights-assets\/([A-Za-z0-9._-]{1,120})\/review$/);
  if (rightsAssetReviewMatch && method === "POST") {
    const admin = await requireAdminMfa(request,env), b = await bodyJson(request,12000), id = rightsAssetReviewMatch[1];
    const status = String(b.status || ""), basis = String(b.rights_basis || ""), evidence = String(b.evidence_reference || "").trim(), note = String(b.review_note || "").trim();
    const asset = await env.DB.prepare("SELECT * FROM commercial_rights_assets WHERE id=?").bind(id).first();
    if (!asset) return fail(404,"Rights asset record not found");
    if (status === "approved") {
      if (!["original_author","assignment","separate_license","public_domain","open_source"].includes(basis)) return fail(400,"A resolved rights basis is required");
      if (evidence.length < 8 || note.length < 20 || b.redistribution_allowed !== true) return fail(400,"Approval requires provenance evidence, a review note and redistribution permission");
      if (Number(b.third_party) === 1 && !String(b.third_party_license || "").trim()) return fail(400,"Third-party assets require an exact license reference");
      await env.DB.prepare("UPDATE commercial_rights_assets SET rights_basis=?,third_party=?,third_party_license=?,commercial_use_allowed=?,redistribution_allowed=1,status='approved',review_note=?,reviewed_by=?,reviewed_at=? WHERE id=?")
        .bind(basis, b.third_party === true ? 1 : 0, String(b.third_party_license || "").trim() || null, b.commercial_use_allowed === true ? 1 : 0, note + "\nEvidence: " + evidence, admin.id, nowIso(), id).run();
    } else if (status === "excluded") {
      if (note.length < 20 || evidence.length < 8) return fail(400,"Exclusion requires a reason and evidence reference");
      await env.DB.prepare("UPDATE commercial_rights_assets SET included_in_package=0,status='excluded',review_note=?,reviewed_by=?,reviewed_at=? WHERE id=?")
        .bind(note + "\nEvidence: " + evidence,admin.id,nowIso(),id).run();
    } else if (status === "rejected") {
      if (note.length < 20 || evidence.length < 8) return fail(400,"Rejection requires a reason and evidence reference");
      await env.DB.prepare("UPDATE commercial_rights_assets SET status='rejected',review_note=?,reviewed_by=?,reviewed_at=? WHERE id=?")
        .bind(note + "\nEvidence: " + evidence,admin.id,nowIso(),id).run();
    } else return fail(400,"Status must be approved, excluded or rejected");
    await audit(env,admin.id,"skill.rights_asset.reviewed","rights_asset",id,{status,rights_basis:basis,evidence_reference:evidence});
    return json({ok:true,id,status});
  }

  if (path === "/api/admin/skill/rights-review" && method === "POST") {
    const admin = await requireAdminMfa(request,env), b = await bodyJson(request,12000);
    const version = String(b.version || ""), sha = String(b.package_sha256 || "").toLowerCase(), note = String(b.review_note || "").trim(), evidence = String(b.external_review_reference || "").trim();
    const release = await env.DB.prepare("SELECT sha256,status FROM skill_releases WHERE version=?").bind(version).first();
    if (!release || release.status !== "candidate" || release.sha256 !== sha) return fail(409,"Rights review must target the exact candidate package SHA-256");
    if (note.length < 40 || evidence.length < 8) return fail(400,"Record the review basis and a durable external review evidence reference");
    const summary = await env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN included_in_package=1 THEN 1 ELSE 0 END) AS included,SUM(CASE WHEN included_in_package=1 AND status='approved' AND redistribution_allowed=1 THEN 1 ELSE 0 END) AS approved FROM commercial_rights_assets WHERE product_version=?").bind(version).first();
    const included = Number(summary.included || 0), approved = Number(summary.approved || 0), manifestCount = Number(b.manifest_file_count);
    if (!included || included !== approved || manifestCount !== included) return fail(409,"Every included package file must have approved redistribution rights; manifest count must match");
    await env.DB.prepare("INSERT INTO commercial_rights_reviews (id,product_id,product_version,package_sha256,manifest_file_count,approved_asset_count,status,reviewer_user_id,review_note,created_at) VALUES (?,?,?,?,?,?,'approved',?,?,?)")
      .bind(crypto.randomUUID(),"morningstar-skill-public-rc7",version,sha,manifestCount,approved,admin.id,note + "\nExternal evidence: " + evidence,nowIso()).run();
    await audit(env,admin.id,"skill.rights_review.approved","skill_release",version,{sha256:sha,manifest_file_count:manifestCount,evidence_reference:evidence});
    return json({ok:true,version,package_sha256:sha,manifest_file_count:manifestCount,approved_asset_count:approved});
  }

  // Release metadata is public; publishing requires exact-package evidence and MFA.
  const skillAssetMatch = path.match(/^\/api\/admin\/skill\/releases\/([A-Za-z0-9._-]{1,40})\/asset$/);
  if (skillAssetMatch && method === "POST") {
    const admin = await requireAdminMfa(request,env), b = await bodyJson(request,12000);
    const version = skillAssetMatch[1], filePath = String(b.file_path || "");
    if (!/^\/releases\/skill\/[A-Za-z0-9._-]+\\.zip$/.test(filePath)) return fail(400,"Asset path must be under /releases/skill/ and end in .zip");
    const release = await env.DB.prepare("SELECT version,sha256,status FROM skill_releases WHERE version=?").bind(version).first();
    if (!release || release.status !== "candidate") return fail(404,"Candidate Skill release not found");
    const asset = await env.ASSETS.fetch(new Request(new URL(filePath,url.origin).toString()));
    if (!asset.ok) return fail(404,"Release asset is not present in the deployed static assets");
    const bytes = await asset.arrayBuffer();
    if (await digestBytes(bytes) !== release.sha256) return fail(409,"Release asset SHA-256 does not match the candidate manifest");
    await env.DB.prepare("UPDATE skill_releases SET file_path=? WHERE version=? AND status='candidate'").bind(filePath,version).run();
    await audit(env,admin.id,"skill.release.asset_attached","skill_release",version,{file_path:filePath,sha256:release.sha256});
    return json({ok:true,version,file_path:filePath,sha256:release.sha256});
  }

  const skillGateMatch = path.match(/^\/api\/admin\/skill\/releases\/([A-Za-z0-9._-]{1,40})\/gates$/);
  if (skillGateMatch && method === "POST") {
    const admin = await requireAdminMfa(request,env), b = await bodyJson(request,12000), version = skillGateMatch[1];
    const gateType = String(b.gate_type || ""), evidence = String(b.evidence_reference || "").trim(), note = String(b.review_note || "").trim();
    if (!["rights","security","installation"].includes(gateType)) return fail(400,"Invalid release gate type");
    if (b.status !== "passed" || evidence.length < 8 || note.length < 20) return fail(400,"A passed gate requires a durable evidence reference and review note");
    const release = await env.DB.prepare("SELECT sha256,status FROM skill_releases WHERE version=?").bind(version).first();
    if (!release || release.status !== "candidate") return fail(404,"Candidate Skill release not found");
    if (gateType === "rights") {
      const review = await env.DB.prepare("SELECT manifest_file_count,approved_asset_count FROM commercial_rights_reviews WHERE product_version=? AND package_sha256=? AND status='approved' ORDER BY created_at DESC LIMIT 1").bind(version,release.sha256).first();
      const pending = await env.DB.prepare("SELECT COUNT(*) AS count FROM commercial_rights_assets WHERE product_version=? AND included_in_package=1 AND status!='approved'").bind(version).first();
      if (!review || Number(review.manifest_file_count)!==Number(review.approved_asset_count) || Number(pending.count)!==0) return fail(409,"Rights gate requires a matching approved package review and every included file approved");
    }
    await env.DB.prepare("INSERT INTO release_gate_records (id,skill_release_version,gate_type,status,evidence_reference,reviewer_user_id,review_note,created_at) VALUES (?,?,?,'passed',?,?,?,?)")
      .bind(crypto.randomUUID(),version,gateType,evidence,admin.id,note,nowIso()).run();
    await audit(env,admin.id,"skill.release.gate_passed","skill_release",version,{gate_type:gateType,evidence_reference:evidence});
    return json({ok:true,version,gate_type:gateType});
  }

  const skillPublishMatch = path.match(/^\/api\/admin\/skill\/releases\/([A-Za-z0-9._-]{1,40})\/publish$/);
  if (skillPublishMatch && method === "POST") {
    const admin = await requireAdminMfa(request,env), version = skillPublishMatch[1];
    const release = await env.DB.prepare("SELECT version,file_path,sha256,status FROM skill_releases WHERE version=?").bind(version).first();
    if (!release || release.status !== "candidate" || !release.file_path) return fail(409,"Candidate release and verified asset path are required");
    const gateRows = rows(await env.DB.prepare("SELECT gate_type,COUNT(*) AS count FROM release_gate_records WHERE skill_release_version=? AND status='passed' GROUP BY gate_type").bind(version).all());
    const passed = new Set(gateRows.map(x=>x.gate_type));
    if (!["rights","security","installation"].every(x=>passed.has(x))) return fail(409,"Rights, security and installation gates must all pass for this exact version");
    const review = await env.DB.prepare("SELECT manifest_file_count,approved_asset_count FROM commercial_rights_reviews WHERE product_version=? AND package_sha256=? AND status='approved' ORDER BY created_at DESC LIMIT 1").bind(version,release.sha256).first();
    const pending = await env.DB.prepare("SELECT COUNT(*) AS count FROM commercial_rights_assets WHERE product_version=? AND included_in_package=1 AND status!='approved'").bind(version).first();
    if (!review || Number(review.manifest_file_count)!==Number(review.approved_asset_count) || Number(pending.count)!==0) return fail(409,"The exact package does not have complete file-level rights clearance");
    const asset = await env.ASSETS.fetch(new Request(new URL(release.file_path,url.origin).toString()));
    if (!asset.ok) return fail(404,"Release archive is missing from static assets");
    const bytes = await asset.arrayBuffer();
    if (await digestBytes(bytes)!==release.sha256) return fail(409,"Release archive checksum mismatch");
    await env.DB.prepare("UPDATE skill_releases SET status='published',published_at=? WHERE version=? AND status='candidate'").bind(nowIso(),version).run();
    await audit(env,admin.id,"skill.release.published","skill_release",version,{sha256:release.sha256,file_path:release.file_path});
    return json({ok:true,version,status:"published",sha256:release.sha256});
  }

  if (path.startsWith("/api/model/")) return fail(503,"MorningStar AI Model Series is not enabled. Its separate identity, reviewed legal documents, private R2 storage, inference runtime and security tests must be completed first.");
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