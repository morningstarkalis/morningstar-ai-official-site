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
  let licenseScopes=[];try{licenseScopes=JSON.parse(row.license_scopes||"[]");}catch(_){}if(!Array.isArray(scopes)||!scopes.includes(scope)||!Array.isArray(licenseScopes)||!licenseScopes.includes(scope))throw Object.assign(new Error("API key or license scope does not allow this operation"),{status:403});
  await env.DB.prepare("UPDATE model_api_keys SET last_used_at=? WHERE id=?").bind(now,row.id).run();
  return row;
}

async function handleModelApi(request,env,url,path,method){
  if(path==="/api/model/legal-documents"&&method==="GET"){
    const docs=rows(await env.DB.prepare("SELECT id,title,version,scope,body,published_at FROM model_legal_documents WHERE status='published' ORDER BY published_at DESC").all());
    const latest=[];const seen=new Set();
    for(const doc of docs){if(!seen.has(doc.scope)){latest.push(doc);seen.add(doc.scope);}}
    return json({documents:latest});
  }

  if(path==="/api/model/catalog"&&method==="GET"){
    const products=rows(await env.DB.prepare("SELECT id,title,version,description FROM model_products WHERE status='available' AND commercial_enabled=1 ORDER BY created_at DESC").all());
    return json({product_line:"MorningStar AI Model Series",access:"commercial",products});
  }

  if(path==="/api/model/auth/register"&&method==="POST"){
    if(env.MODEL_SERIES_ENABLED!=="true")return fail(503,"Model Series registration is not enabled");
    const b=await bodyJson(request,12000),email=cleanEmail(b.email),name=String(b.display_name||"").trim(),password=b.password;
    if(!validEmail(email)||!name||name.length>80||!validPassword(password))return fail(400,"Valid email, display name and password (14+ characters) are required");
    const privacy=await env.DB.prepare("SELECT id,version FROM model_legal_documents WHERE scope='privacy_notice' AND status='published' ORDER BY published_at DESC LIMIT 1").first();
    const terms=await env.DB.prepare("SELECT id,version FROM model_legal_documents WHERE scope='terms_of_service' AND status='published' ORDER BY published_at DESC LIMIT 1").first();
    if(!privacy||!terms||b.privacy_notice_version!==privacy.version||b.terms_version!==terms.version||b.consent!==true)return fail(409,"Current privacy notice and terms must be accepted before registration");
    const emailKey=await digest(email),since=new Date(Date.now()-15*60*1000).toISOString();
    const attempts=await env.DB.prepare("SELECT COUNT(*) AS count FROM registration_attempts WHERE email_key=? AND attempted_at>?").bind(emailKey,since).first();
    if(Number(attempts.count)>=5)return fail(429,"Too many registration attempts; retry later");
    await env.DB.prepare("INSERT INTO registration_attempts (email_key,attempted_at) VALUES (?,?)").bind(emailKey,nowIso()).run();
    const salt=randomHex(16),hash=await passwordHash(password,salt),id=crypto.randomUUID(),now=nowIso();
    try{
      await env.DB.prepare("INSERT INTO model_members (id,email,display_name,password_salt,password_hash,password_iterations,status,email_verified,privacy_notice_version,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending_verification',0,?,?,?)")
        .bind(id,email,name,salt,hash,PBKDF2_ITERATIONS,privacy.version,now,now).run();
    }catch(e){if(String(e.message).includes("UNIQUE"))return fail(409,"Email is already registered");throw e;}
    await env.DB.batch([
      env.DB.prepare("INSERT INTO consent_receipts (id,subject_type,subject_id,document_id,document_version,purpose,accepted_at) VALUES (?,?,?,?,?,'account_registration',?)").bind(crypto.randomUUID(),"model_member",id,privacy.id,privacy.version,now),
      env.DB.prepare("INSERT INTO consent_receipts (id,subject_type,subject_id,document_id,document_version,purpose,accepted_at) VALUES (?,?,?,?,?,'terms_of_service',?)").bind(crypto.randomUUID(),"model_member",id,terms.id,terms.version,now)
    ]);
    return json({ok:true,status:"pending_verification",message:"Registration received. Account activation requires administrator verification."},202);
  }

  if(path==="/api/model/auth/login"&&method==="POST"){
    if(env.MODEL_SERIES_ENABLED!=="true")return fail(503,"Model Series sign-in is not enabled");
    const b=await bodyJson(request),email=cleanEmail(b.email),password=String(b.password||"");
    if(!validEmail(email)||!password)return fail(400,"Invalid email or password");
    const emailKey=await digest(email),since=new Date(Date.now()-15*60*1000).toISOString();
    const attempts=await env.DB.prepare("SELECT COUNT(*) AS count FROM model_auth_attempts WHERE email_key=? AND attempted_at>?").bind(emailKey,since).first();
    if(Number(attempts.count)>=8)return fail(429,"Too many login attempts; retry in 15 minutes");
    await env.DB.prepare("INSERT INTO model_auth_attempts (email_key,attempted_at) VALUES (?,?)").bind(emailKey,nowIso()).run();
    const member=await env.DB.prepare("SELECT id,email,display_name,password_salt,password_hash,password_iterations,status,email_verified FROM model_members WHERE email=?").bind(email).first();
    const calculated=member?await passwordHash(password,member.password_salt,member.password_iterations):await passwordHash(password,"00000000000000000000000000000000");
    if(!member||!same(calculated,member.password_hash)||member.status!=="active"||!member.email_verified)return fail(401,"Invalid credentials or account not verified");
    if(Number(member.password_iterations)<PBKDF2_ITERATIONS){
      const salt=randomHex(16),hash=await passwordHash(password,salt,PBKDF2_ITERATIONS);
      await env.DB.prepare("UPDATE model_members SET password_salt=?,password_hash=?,password_iterations=?,updated_at=? WHERE id=?").bind(salt,hash,PBKDF2_ITERATIONS,nowIso(),member.id).run();
    }
    await env.DB.prepare("DELETE FROM model_auth_attempts WHERE email_key=?").bind(emailKey).run();
    const session=await createModelSession(env,member.id);
    await audit(env,member.id,"model_member.login","model_member",member.id);
    return json({user:{id:member.id,email:member.email,display_name:member.display_name}},200,{"Set-Cookie":modelSessionCookie(session.token,MODEL_SESSION_HOURS*3600)});
  }

  if(path==="/api/model/auth/logout"&&method==="POST"){
    const token=cookie(request,MODEL_SESSION_COOKIE);
    if(token)await env.DB.prepare("DELETE FROM model_sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ok:true},200,{"Set-Cookie":modelSessionCookie("",0)});
  }

  if(path==="/api/model/me"&&method==="GET"){
    const member=await requireModelMember(request,env);
    const licenses=rows(await env.DB.prepare("SELECT l.id,l.license_type,l.scopes_json,l.status,l.issued_at,l.expires_at,p.title,p.version FROM model_licenses l JOIN model_products p ON p.id=l.model_product_id WHERE l.model_member_id=? ORDER BY l.issued_at DESC").bind(member.id).all());
    const keys=rows(await env.DB.prepare("SELECT id,key_prefix,scopes_json,created_at,expires_at,last_used_at,revoked_at FROM model_api_keys WHERE model_member_id=? ORDER BY created_at DESC").bind(member.id).all());
    const orders=rows(await env.DB.prepare("SELECT id,requested_license_type,terms_version,status,amount_minor,currency,created_at,updated_at FROM model_orders WHERE model_member_id=? ORDER BY created_at DESC LIMIT 30").bind(member.id).all());
    return json({user:{id:member.id,email:member.email,display_name:member.display_name},licenses,api_keys:keys,orders});
  }

  if(path==="/api/model/orders"&&method==="POST"){
    if(env.MODEL_ORDER_REQUESTS_ENABLED!=="true")return fail(503,"Commercial order requests are not enabled");
    const member=await requireModelMember(request,env),b=await bodyJson(request,12000);
    const product=await env.DB.prepare("SELECT id,status,commercial_enabled FROM model_products WHERE id=?").bind(String(b.model_product_id||"")).first();
    const terms=await env.DB.prepare("SELECT id,version FROM model_legal_documents WHERE scope='commercial_model_license' AND status='published' AND version=?").bind(String(b.terms_version||"")).first();
    if(!product||product.status!=="available"||Number(product.commercial_enabled)!==1)return fail(409,"Model product is not available for commercial orders");
    if(!terms)return fail(409,"The exact commercial model license terms must be published");
    const type=String(b.license_type||"commercial_api");
    if(!["commercial_api","commercial_deployment"].includes(type))return fail(400,"Invalid license type");
    const id=crypto.randomUUID(),now=nowIso();
    await env.DB.prepare("INSERT INTO model_orders (id,model_member_id,model_product_id,requested_license_type,terms_version,status,payment_reference,amount_minor,currency,created_at,updated_at) VALUES (?,?,?,?,?,'pending_review',NULL,NULL,'TWD',?,?)")
      .bind(id,member.id,product.id,type,terms.version,now,now).run();
    await audit(env,member.id,"model.order.requested","model_order",id,{license_type:type,terms_version:terms.version});
    return json({ok:true,order_id:id,status:"pending_review",message:"This is a commercial license request, not a completed payment or active license."},201);
  }

  if(path==="/api/model/api-keys"&&method==="POST"){
    const member=await requireModelMember(request,env),b=await bodyJson(request,12000),licenseId=String(b.license_id||"");
    const license=await env.DB.prepare("SELECT l.id,l.scopes_json,l.expires_at,l.status,p.status AS product_status,p.commercial_enabled FROM model_licenses l JOIN model_products p ON p.id=l.model_product_id WHERE l.id=? AND l.model_member_id=?").bind(licenseId,member.id).first();
    if(!license||license.status!=="active"||(license.expires_at&&license.expires_at<=nowIso())||license.product_status!=="available"||Number(license.commercial_enabled)!==1)return fail(403,"No active commercial license for this product");
    let allowed=[];try{allowed=JSON.parse(license.scopes_json||"[]");}catch(_){}
    const scopes=Array.isArray(b.scopes)?[...new Set(b.scopes.map(String))]:[];
    if(!scopes.length||scopes.some(x=>!["inference","usage","download"].includes(x)||!allowed.includes(x)))return fail(403,"Requested API scopes exceed the active license");
    const active=await env.DB.prepare("SELECT COUNT(*) AS count FROM model_api_keys WHERE model_license_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)").bind(licenseId,nowIso()).first();
    if(Number(active.count)>=5)return fail(429,"Maximum active API keys reached for this license");
    const expiresAt=b.expires_at?new Date(b.expires_at).toISOString():null;
    if(expiresAt&&new Date(expiresAt).getTime()>Date.now()+90*86400000)return fail(400,"API key expiry cannot exceed 90 days");
    const issued=await issueModelApiKey(env,member.id,licenseId,scopes,expiresAt);
    await audit(env,member.id,"model.api_key.issued","model_api_key",issued.id,{scopes,expires_at:expiresAt});
    return json({ok:true,...issued},201);
  }

  const modelKeyRevoke=path.match(/^\/api\/model\/api-keys\/([0-9a-f-]+)\/revoke$/);
  if(modelKeyRevoke&&method==="POST"){
    const member=await requireModelMember(request,env),id=modelKeyRevoke[1];
    const result=await env.DB.prepare("UPDATE model_api_keys SET revoked_at=? WHERE id=? AND model_member_id=? AND revoked_at IS NULL").bind(nowIso(),id,member.id).run();
    if(!result.meta?.changes)return fail(404,"Active API key not found");
    await audit(env,member.id,"model.api_key.revoked","model_api_key",id);
    return json({ok:true});
  }

  if(path==="/api/model/v1/infer"&&method==="POST"){
    const key=await authenticateModelApiKey(request,env,"inference");
    if(!env.MODEL_INFERENCE||!env.MODEL_INFERENCE_SECRET)return fail(503,"Model inference runtime is not configured");
    const body=await bodyJson(request,MAX_MODEL_API_BODY);
    if(body.input===undefined||body.input===null)return fail(400,"An input field is required");
    const quota=await env.DB.prepare("SELECT daily_request_limit,monthly_input_units_limit,monthly_output_units_limit FROM model_api_quotas WHERE model_license_id=?").bind(key.model_license_id).first();
    if(!quota)return fail(503,"No API quota is configured for this license");
    const daily=await env.DB.prepare("SELECT COUNT(*) AS count FROM model_api_usage u JOIN model_api_keys k ON k.id=u.model_api_key_id WHERE k.model_license_id=? AND u.usage_type='inference' AND u.created_at>=date('now')").bind(key.model_license_id).first();
    const monthly=await env.DB.prepare("SELECT COALESCE(SUM(u.input_units),0) AS input_units,COALESCE(SUM(u.output_units),0) AS output_units FROM model_api_usage u JOIN model_api_keys k ON k.id=u.model_api_key_id WHERE k.model_license_id=? AND u.usage_type='inference' AND u.created_at>=date('now','start of month')").bind(key.model_license_id).first();
    if(Number(daily.count)>=Number(quota.daily_request_limit)||Number(monthly.input_units)>=Number(quota.monthly_input_units_limit)||Number(monthly.output_units)>=Number(quota.monthly_output_units_limit))return fail(429,"API quota exceeded");
    const requestId=crypto.randomUUID();
    let upstream;
    try{
      upstream=await env.MODEL_INFERENCE.fetch(new Request("https://model-inference.internal/v1/infer",{method:"POST",headers:{"Content-Type":"application/json","X-MorningStar-Internal-Secret":env.MODEL_INFERENCE_SECRET,"X-MorningStar-Request-Id":requestId},body:JSON.stringify({model_product_id:key.model_product_id,input:body.input,parameters:body.parameters||{}})}));
    }catch(_){return fail(502,"Model inference runtime could not be reached");}
    if(!upstream.ok)return fail(502,"Model inference runtime returned an error");
    let result;try{result=await upstream.json();}catch(_){return fail(502,"Model inference runtime returned invalid JSON");}
    const inputUnits=Number.isSafeInteger(result.usage?.input_units)?result.usage.input_units:0;
    const outputUnits=Number.isSafeInteger(result.usage?.output_units)?result.usage.output_units:0;
    await env.DB.prepare("INSERT INTO model_api_usage (id,model_api_key_id,model_member_id,model_product_id,request_id,usage_type,input_units,output_units,created_at) VALUES (?,?,?,?,?,'inference',?,?,?)")
      .bind(crypto.randomUUID(),key.id,key.model_member_id,key.model_product_id,requestId,inputUnits,outputUnits,nowIso()).run();
    return json({request_id:requestId,output:result.output??result,usage:{input_units:inputUnits,output_units:outputUnits}});
  }

  if(path==="/api/model/v1/usage"&&method==="GET"){
    const key=await authenticateModelApiKey(request,env,"usage");
    const usage=rows(await env.DB.prepare("SELECT request_id,usage_type,input_units,output_units,created_at FROM model_api_usage WHERE model_api_key_id=? AND created_at>=datetime('now','-30 days') ORDER BY created_at DESC LIMIT 500").bind(key.id).all());
    return json({usage});
  }

  const artifactDownload=path.match(/^\/api\/model\/artifacts\/([0-9a-f-]+)\/download$/);
  if(artifactDownload&&method==="GET"){
    const member=await requireModelMember(request,env),id=artifactDownload[1];
    if(!env.MODEL_ARTIFACTS)return fail(503,"Private artifact storage is not configured");
    const artifact=await env.DB.prepare("SELECT a.*,p.status AS product_status,p.commercial_enabled FROM model_artifacts a JOIN model_products p ON p.id=a.model_product_id WHERE a.id=? AND a.status='available'").bind(id).first();
    if(!artifact||artifact.product_status!=="available"||Number(artifact.commercial_enabled)!==1)return fail(404,"Available private artifact not found");
    const licenses=rows(await env.DB.prepare("SELECT scopes_json FROM model_licenses WHERE model_member_id=? AND model_product_id=? AND status='active' AND (expires_at IS NULL OR expires_at>?)").bind(member.id,artifact.model_product_id,nowIso()).all());
    const allowed=licenses.some(l=>{try{return JSON.parse(l.scopes_json||"[]").includes("download");}catch(_){return false;}});
    if(!allowed)return fail(403,"An active download entitlement is required");
    const object=await env.MODEL_ARTIFACTS.get(artifact.object_key);
    if(!object)return fail(404,"Private artifact object is missing");
    const bytes=await object.arrayBuffer();
    if(await digestBytes(bytes)!==artifact.sha256)return fail(503,"Private artifact integrity check failed");
    const filename=String(artifact.file_name).replace(/[^A-Za-z0-9._-]/g,"_");
    await audit(env,member.id,"model.artifact.downloaded","model_artifact",id,{sha256:artifact.sha256});
    return new Response(bytes,{status:200,headers:{"Content-Type":"application/zip","Content-Disposition":"attachment; filename="+filename,"Content-Length":String(bytes.byteLength),"Cache-Control":"private, no-store","Pragma":"no-cache","X-Content-Type-Options":"nosniff","X-MorningStar-SHA256":artifact.sha256}});
  }

  if(path==="/api/model/artifacts"&&method==="GET"){
    const member=await requireModelMember(request,env);
    const licenses=rows(await env.DB.prepare("SELECT model_product_id,scopes_json FROM model_licenses WHERE model_member_id=? AND status='active' AND (expires_at IS NULL OR expires_at>?)").bind(member.id,nowIso()).all());
    const products=[...new Set(licenses.filter(l=>{try{return JSON.parse(l.scopes_json||"[]").includes("download");}catch(_){return false;}}).map(l=>l.model_product_id))];
    if(!products.length)return json({artifacts:[]});
    const found=[];
    for(const productId of products){
      const artifacts=rows(await env.DB.prepare("SELECT id,version,file_name,file_size,sha256,uploaded_at FROM model_artifacts WHERE model_product_id=? AND status='available' ORDER BY uploaded_at DESC").bind(productId).all());
      for(const item of artifacts)found.push({...item,download_url:"/api/model/artifacts/"+item.id+"/download"});
    }
    return json({artifacts:found});
  }

  if(path==="/api/model/privacy-requests"&&method==="POST"){
    const member=await requireModelMember(request,env),b=await bodyJson(request,12000),type=String(b.request_type||"");
    if(!["access","copy","correction","stop_processing","deletion","restriction","objection","portability"].includes(type))return fail(400,"Invalid privacy request type");
    const id=crypto.randomUUID(),now=nowIso();
    await env.DB.prepare("INSERT INTO privacy_requests (id,subject_type,subject_id,request_type,details,status,created_at,updated_at) VALUES (?,'model_member',?,?,?,'pending',?,?)").bind(id,member.id,type,String(b.details||"").slice(0,4000),now,now).run();
    await audit(env,member.id,"model.privacy_request.created","privacy_request",id,{request_type:type});
    return json({ok:true,request_id:id,status:"pending"},201);
  }

  return fail(404,"Model Series API route not found");
}

async function handleAdminModelApi(request,env,path,method){
  if(path==="/api/admin/model/overview"&&method==="GET"){
    const admin=await requireAdminMfa(request,env);
    const products=rows(await env.DB.prepare("SELECT id,title,version,status,commercial_enabled FROM model_products ORDER BY created_at DESC").all());
    const docs=rows(await env.DB.prepare("SELECT id,title,version,scope,status,review_evidence_reference,published_at FROM model_legal_documents ORDER BY created_at DESC").all());
    const counts=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM model_members) AS members,(SELECT COUNT(*) FROM model_members WHERE status='pending_verification') AS pending_members,(SELECT COUNT(*) FROM model_orders) AS orders,(SELECT COUNT(*) FROM model_orders WHERE status='pending_review') AS pending_orders,(SELECT COUNT(*) FROM model_licenses WHERE status='active') AS active_licenses,(SELECT COUNT(*) FROM model_artifacts) AS artifacts,(SELECT COUNT(*) FROM model_artifacts WHERE status='quarantined') AS quarantined_artifacts").first();
    return json({administrator:admin.email,products,legal_documents:docs,counts});
  }

  if(path==="/api/admin/model/legal-documents"&&method==="POST"){
    const admin=await requireAdminMfa(request,env),b=await bodyJson(request,50000);
    const scope=String(b.scope||""),id=String(b.id||"").replace(/[^A-Za-z0-9._-]/g,""),title=String(b.title||"").trim(),version=String(b.version||"").trim(),body=String(b.body||"").trim(),evidence=String(b.review_evidence_reference||"").trim();
    if(!["privacy_notice","terms_of_service","commercial_model_license","api_terms","dpa"].includes(scope)||!id||!title||!version||body.length<500||evidence.length<8)return fail(400,"Document scope, ID, title, version, 500+ characters of terms and external legal review evidence are required");
    const now=nowIso();
    await env.DB.prepare("INSERT INTO model_legal_documents (id,title,version,scope,status,body,created_at,published_at,review_evidence_reference,reviewed_by,reviewed_at) VALUES (?,?,?,?,'published',?,?,?,?,?,?)")
      .bind(id,title,version,scope,body,now,now,evidence,admin.id,now).run();
    await audit(env,admin.id,"model.legal_document.published","model_legal_document",id,{scope,version,review_evidence_reference:evidence});
    return json({ok:true,id,scope,version,status:"published"});
  }

  const memberVerify=path.match(/^\/api\/admin\/model\/members\/([0-9a-f-]+)\/verify$/);
  if(memberVerify&&method==="POST"){
    const admin=await requireAdminMfa(request,env),b=await bodyJson(request,12000),id=memberVerify[1],evidence=String(b.evidence_reference||"").trim(),note=String(b.review_note||"").trim();
    if(evidence.length<8||note.length<20)return fail(400,"Manual verification requires evidence reference and review note");
    const result=await env.DB.prepare("UPDATE model_members SET status='active',email_verified=1,updated_at=? WHERE id=? AND status='pending_verification'").bind(nowIso(),id).run();
    if(!result.meta?.changes)return fail(404,"Pending Model Series member not found");
    await audit(env,admin.id,"model.member.verified","model_member",id,{evidence_reference:evidence,review_note:note});
    return json({ok:true,id,status:"active"});
  }

  const productPublish=path.match(/^\/api\/admin\/model\/products\/([A-Za-z0-9._-]+)\/publish$/);
  if(productPublish&&method==="POST"){
    const admin=await requireAdminMfa(request,env),id=productPublish[1];
    if(!env.MODEL_INFERENCE||!env.MODEL_INFERENCE_SECRET||!env.MODEL_ARTIFACTS)return fail(503,"Model inference Service Binding, internal secret and private R2 bucket must all be configured");
    for(const scope of ["privacy_notice","terms_of_service","commercial_model_license","api_terms"]){
      const doc=await env.DB.prepare("SELECT id FROM model_legal_documents WHERE scope=? AND status='published' ORDER BY published_at DESC LIMIT 1").bind(scope).first();
      if(!doc)return fail(409,"Missing published legal document: "+scope);
    }
    const artifact=await env.DB.prepare("SELECT id,object_key,sha256 FROM model_artifacts WHERE model_product_id=? AND status='available' LIMIT 1").bind(id).first();
    if(!artifact)return fail(409,"At least one reviewed private model artifact must be available");
    const artifactObject=await env.MODEL_ARTIFACTS.get(artifact.object_key);
    if(!artifactObject)return fail(409,"Reviewed private model artifact is missing from R2");
    if(await digestBytes(await artifactObject.arrayBuffer())!==artifact.sha256)return fail(409,"Reviewed private model artifact SHA-256 mismatch");
    const result=await env.DB.prepare("UPDATE model_products SET status='available',commercial_enabled=1,updated_at=? WHERE id=? AND status='draft'").bind(nowIso(),id).run();
    if(!result.meta?.changes)return fail(404,"Draft Model Series product not found");
    await audit(env,admin.id,"model.product.published","model_product",id);
    return json({ok:true,id,status:"available",commercial_enabled:true});
  }

  const orderApprove=path.match(/^\/api\/admin\/model\/orders\/([0-9a-f-]+)\/approve$/);
  if(orderApprove&&method==="POST"){
    const admin=await requireAdminMfa(request,env),b=await bodyJson(request,12000),id=orderApprove[1];
    const order=await env.DB.prepare("SELECT o.*,m.status AS member_status,m.email_verified,p.status AS product_status,p.commercial_enabled FROM model_orders o JOIN model_members m ON m.id=o.model_member_id JOIN model_products p ON p.id=o.model_product_id WHERE o.id=?").bind(id).first();
    if(!order||order.status!=="pending_review")return fail(404,"Pending Model Series order not found");
    if(order.member_status!=="active"||!order.email_verified||order.product_status!=="available"||Number(order.commercial_enabled)!==1)return fail(409,"Verified member and published commercial product are required");
    const terms=await env.DB.prepare("SELECT id FROM model_legal_documents WHERE scope='commercial_model_license' AND version=? AND status='published'").bind(order.terms_version).first();
    if(!terms)return fail(409,"The order's exact commercial license terms are not published");
    const payment=String(b.payment_reference||"").trim(),contract=String(b.contract_reference||"").trim(),note=String(b.review_note||"").trim();
    if(payment.length<6||contract.length<6||note.length<20)return fail(400,"Payment/settlement reference, signed contract reference and review note are required");
    const scopes=Array.isArray(b.scopes)?[...new Set(b.scopes.map(String))]:["inference","usage"];
    if(!scopes.length||scopes.some(x=>!["inference","usage","download"].includes(x)))return fail(400,"Invalid license scopes");
    const key="MSML_"+randomToken(24),licenseId=crypto.randomUUID(),now=nowIso(),keyHash=await digest(key);
    const expiresAt=b.expires_at?new Date(b.expires_at).toISOString():null;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO model_licenses (id,model_member_id,model_order_id,model_product_id,license_type,license_key_hash,license_key_prefix,scopes_json,status,issued_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?, 'active',?,?,?)").bind(licenseId,order.model_member_id,order.id,order.model_product_id,order.requested_license_type,keyHash,key.slice(0,12),JSON.stringify(scopes),now,expiresAt,now),
      env.DB.prepare("INSERT INTO model_api_quotas (model_license_id,daily_request_limit,monthly_input_units_limit,monthly_output_units_limit,updated_at) VALUES (?,?,?,?,?)").bind(licenseId,Number(b.daily_request_limit)||100,Number(b.monthly_input_units_limit)||100000,Number(b.monthly_output_units_limit)||100000,now),
      env.DB.prepare("UPDATE model_orders SET status='approved',payment_reference=?,admin_note=?,updated_at=? WHERE id=? AND status='pending_review'").bind(payment,"Contract: "+contract+"\n"+note,now,id)
    ]);
    await audit(env,admin.id,"model.order.approved","model_order",id,{license_id:licenseId,scopes,payment_reference:payment,contract_reference:contract});
    return json({ok:true,license_id:licenseId,license_key:key,scopes,notice:"License key is shown once. Save it securely."});
  }

  const orderReject=path.match(/^\/api\/admin\/model\/orders\/([0-9a-f-]+)\/reject$/);
  if(orderReject&&method==="POST"){
    const admin=await requireAdminMfa(request,env),b=await bodyJson(request,12000),id=orderReject[1],note=String(b.note||"").trim();
    if(note.length<10)return fail(400,"A rejection reason is required");
    const result=await env.DB.prepare("UPDATE model_orders SET status='rejected',admin_note=?,updated_at=? WHERE id=? AND status='pending_review'").bind(note,nowIso(),id).run();
    if(!result.meta?.changes)return fail(404,"Pending Model Series order not found");
    await audit(env,admin.id,"model.order.rejected","model_order",id,{note});
    return json({ok:true});
  }

  if(path==="/api/admin/model/artifacts/upload"&&method==="POST"){
    const admin=await requireAdminMfa(request,env);
    if(!env.MODEL_ARTIFACTS)return fail(503,"Private R2 bucket binding is not configured");
    const form=await request.formData(),productId=String(form.get("model_product_id")||""),version=String(form.get("version")||""),file=form.get("file");
    if(!productId||!version||!file||typeof file.arrayBuffer!=="function")return fail(400,"Product, version and ZIP file are required");
    if(file.size<4||file.size>MAX_MODEL_ARTIFACT_BYTES||!String(file.name||"").toLowerCase().endsWith(".zip"))return fail(413,"ZIP file must be between 4 bytes and 25 MiB");
    const product=await env.DB.prepare("SELECT id FROM model_products WHERE id=? AND status IN ('draft','available')").bind(productId).first();
    if(!product)return fail(404,"Draft Model Series product not found");
    const bytes=await file.arrayBuffer(),magic=new Uint8Array(bytes.slice(0,4));
    if(magic[0]!==0x50||magic[1]!==0x4b)return fail(400,"Uploaded file is not a ZIP archive");
    const sha=await digestBytes(bytes),id=crypto.randomUUID(),key="quarantine/"+productId+"/"+id+".zip",now=nowIso();
    await env.MODEL_ARTIFACTS.put(key,bytes,{httpMetadata:{contentType:"application/zip"}});
    await env.DB.prepare("INSERT INTO model_artifacts (id,model_product_id,version,object_key,file_name,content_type,file_size,sha256,status,uploaded_by,uploaded_at) VALUES (?,?,?,?,?, 'application/zip',?,?,'quarantined',?,?)")
      .bind(id,productId,version,key,String(file.name).replace(/[^A-Za-z0-9._-]/g,"_"),bytes.byteLength,sha,admin.id,now).run();
    await audit(env,admin.id,"model.artifact.uploaded","model_artifact",id,{sha256:sha,bytes:bytes.byteLength});
    return json({ok:true,id,status:"quarantined",sha256:sha,bytes:bytes.byteLength});
  }

  const artifactApprove=path.match(/^\/api\/admin\/model\/artifacts\/([0-9a-f-]+)\/approve$/);
  if(artifactApprove&&method==="POST"){
    const admin=await requireAdminMfa(request,env),b=await bodyJson(request,12000),id=artifactApprove[1];
    const scan=String(b.security_scan_reference||"").trim(),rights=String(b.rights_review_reference||"").trim(),note=String(b.review_note||"").trim();
    if(scan.length<8||rights.length<8||note.length<20)return fail(400,"Independent malware scan, rights review evidence and review note are required");
    if(!env.MODEL_ARTIFACTS)return fail(503,"Private R2 bucket binding is not configured");
    const artifact=await env.DB.prepare("SELECT object_key,sha256 FROM model_artifacts WHERE id=? AND status='quarantined'").bind(id).first();
    if(!artifact)return fail(404,"Quarantined artifact not found");
    const object=await env.MODEL_ARTIFACTS.get(artifact.object_key);
    if(!object)return fail(404,"Quarantined artifact object is missing from R2");
    if(await digestBytes(await object.arrayBuffer())!==artifact.sha256)return fail(409,"Quarantined artifact SHA-256 mismatch");
    const result=await env.DB.prepare("UPDATE model_artifacts SET status='available',security_scan_reference=?,rights_review_reference=?,reviewed_by=?,reviewed_at=?,approved_at=? WHERE id=? AND status='quarantined'").bind(scan,rights,admin.id,nowIso(),nowIso(),id).run();
    if(!result.meta?.changes)return fail(404,"Quarantined artifact not found");
    await audit(env,admin.id,"model.artifact.approved","model_artifact",id,{security_scan_reference:scan,rights_review_reference:rights});
    return json({ok:true,id,status:"available"});
  }

  const licenseRevoke=path.match(/^\/api\/admin\/model\/licenses\/([0-9a-f-]+)\/revoke$/);
  if(licenseRevoke&&method==="POST"){
    const admin=await requireAdminMfa(request,env),b=await bodyJson(request,12000),id=licenseRevoke[1],note=String(b.reason||"").trim();
    if(note.length<10)return fail(400,"Revocation reason is required");
    const result=await env.DB.prepare("UPDATE model_licenses SET status='revoked',revoked_at=? WHERE id=? AND status='active'").bind(nowIso(),id).run();
    if(!result.meta?.changes)return fail(404,"Active Model Series license not found");
    await audit(env,admin.id,"model.license.revoked","model_license",id,{reason:note});
    return json({ok:true});
  }

  return fail(404,"Model Series admin route not found");
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
  const bearerApiRequest = /^Bearer\s+MSM_[A-Za-z0-9_-]{40,100}$/.test(request.headers.get("Authorization") || "");
  if (method === "POST" && !bearerApiRequest && !originValid(request)) return fail(403, "Origin check failed");
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

  if (path.startsWith("/api/admin/model/")) return await handleAdminModelApi(request,env,path,method);
  if (path.startsWith("/api/model/")) return await handleModelApi(request,env,url,path,method);
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