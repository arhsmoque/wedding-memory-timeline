export interface Env {
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT_NUMBER: string;
  FIREBASE_APP_ID_ALLOWLIST: string;
  APPCHECK_ENFORCEMENT: string;
  APPCHECK_JWKS_URL: string;
  MAX_UPLOAD_BYTES: string;
  ALLOWED_MEDIA_TYPES: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  RATE_LIMIT_MAX: string;
  RATE_LIMIT_REQUIRED: string;
  RATE_LIMIT_KV?: KVNamespace;
}

function cors(request: Request, env: Env): Record<string, string> {
  const base: Record<string, string> = {
    "access-control-allow-methods": "POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, x-firebase-appcheck"
  };
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!allowed.length) return { ...base, "access-control-allow-origin": "*" };
  const origin = request.headers.get("origin") ?? "";
  if (allowed.includes(origin)) return { ...base, "access-control-allow-origin": origin };
  return base;
}

async function sha1(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cloudinaryParams(params: Record<string, string | number>) {
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

async function signCloudinary(params: Record<string, string | number>, secret: string) {
  return sha1(`${cloudinaryParams(params)}${secret}`);
}

type AppCheckHeader = { alg?: string; kid?: string; typ?: string };
type AppCheckPayload = { aud?: string | string[]; exp?: number; iss?: string; sub?: string };
type AppCheckJwks = { keys?: Array<JsonWebKey & { kid?: string }> };
type GuardResult = { ok: true; appId?: string } | { ok: false; status: number; message: string };

let jwksCache: { expiresAt: number; keys: Array<JsonWebKey & { kid?: string }> } | null = null;

function base64UrlToBytes(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJwtPart<T>(input: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(input))) as T;
}

async function appCheckKeys(env: Env) {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys;
  const response = await fetch(env.APPCHECK_JWKS_URL || "https://firebaseappcheck.googleapis.com/v1/jwks");
  if (!response.ok) throw new Error("Unable to fetch App Check public keys");
  const jwks = (await response.json()) as AppCheckJwks;
  const maxAge = response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1];
  const ttlMs = Math.min(Number(maxAge || 21600), 21600) * 1000;
  jwksCache = { keys: jwks.keys || [], expiresAt: now + ttlMs };
  return jwksCache.keys;
}

async function verifyAppCheck(request: Request, env: Env): Promise<GuardResult> {
  if ((env.APPCHECK_ENFORCEMENT || "true").toLowerCase() === "false") return { ok: true };
  const token = request.headers.get("x-firebase-appcheck");
  if (!token) return { ok: false, status: 401, message: "Missing App Check token" };
  if (!env.FIREBASE_PROJECT_NUMBER) return { ok: false, status: 500, message: "Worker App Check is not configured" };

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, status: 401, message: "Invalid App Check token" };

    const header = decodeJwtPart<AppCheckHeader>(parts[0]);
    const payload = decodeJwtPart<AppCheckPayload>(parts[1]);
    if (header.alg !== "RS256" || header.typ !== "JWT" || !header.kid) {
      return { ok: false, status: 401, message: "Invalid App Check token header" };
    }
    if (payload.iss !== `https://firebaseappcheck.googleapis.com/${env.FIREBASE_PROJECT_NUMBER}`) {
      return { ok: false, status: 401, message: "Invalid App Check token issuer" };
    }
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud || ""];
    if (!audiences.includes(`projects/${env.FIREBASE_PROJECT_NUMBER}`)) {
      return { ok: false, status: 401, message: "Invalid App Check token audience" };
    }
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
      return { ok: false, status: 401, message: "Expired App Check token" };
    }
    const allowList = (env.FIREBASE_APP_ID_ALLOWLIST || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (allowList.length && (!payload.sub || !allowList.includes(payload.sub))) {
      return { ok: false, status: 401, message: "App Check app is not allow-listed" };
    }

    const jwk = (await appCheckKeys(env)).find((key) => key.kid === header.kid);
    if (!jwk) return { ok: false, status: 401, message: "Unknown App Check key" };
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    return verified ? { ok: true, appId: payload.sub } : { ok: false, status: 401, message: "Invalid App Check signature" };
  } catch {
    return { ok: false, status: 401, message: "Invalid App Check token" };
  }
}

async function rateLimit(request: Request, env: Env): Promise<GuardResult> {
  const max = Number(env.RATE_LIMIT_MAX || 20);
  const windowSeconds = Number(env.RATE_LIMIT_WINDOW_SECONDS || 60);
  if (!max || !windowSeconds) return { ok: true };
  if (!env.RATE_LIMIT_KV) {
    if ((env.RATE_LIMIT_REQUIRED || "false").toLowerCase() === "true") {
      return { ok: false, status: 500, message: "Rate limit KV is not configured" };
    }
    return { ok: true };
  }

  const ip = request.headers.get("cf-connecting-ip") || "local";
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `guestbook:${ip}:${bucket}`;
  const current = Number((await env.RATE_LIMIT_KV.get(key)) || "0");
  if (current >= max) return { ok: false, status: 429, message: "Too many upload requests" };
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return { ok: true };
}

function jsonError(corsHeaders: Record<string, string>, result: GuardResult) {
  return Response.json(
    { error: result.ok ? "Unexpected error" : result.message },
    { status: result.ok ? 500 : result.status, headers: corsHeaders }
  );
}

async function signedUpload(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const body = (await request.json()) as { fileName?: string; contentType?: string; size?: number };
  const maxBytes = Number(env.MAX_UPLOAD_BYTES || 104857600);
  const allowed = (env.ALLOWED_MEDIA_TYPES || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!body.contentType || !allowed.includes(body.contentType) || !body.size || body.size > maxBytes) {
    return Response.json({ error: "Rejected media" }, { status: 400, headers: corsHeaders });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `guestbook/${crypto.randomUUID()}`;
  const fields = { public_id: publicId, timestamp };
  const signature = await signCloudinary(fields, env.CLOUDINARY_API_SECRET);

  return Response.json({
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    publicId,
    fields: { api_key: env.CLOUDINARY_API_KEY, ...fields, signature }
  }, { headers: corsHeaders });
}

async function destroyUpload(request: Request, env: Env, corsHeaders: Record<string, string>) {
  const body = (await request.json()) as { publicId?: string; mediaType?: string };
  if (!body.publicId || !body.publicId.startsWith("guestbook/")) {
    return Response.json({ error: "Rejected publicId" }, { status: 400, headers: corsHeaders });
  }
  const resourceType = body.mediaType === "video" ? "video" : "image";
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { invalidate: "true", public_id: body.publicId, timestamp };
  const signature = await signCloudinary(signed, env.CLOUDINARY_API_SECRET);
  const form = new URLSearchParams({
    api_key: env.CLOUDINARY_API_KEY,
    invalidate: "true",
    public_id: body.publicId,
    timestamp: String(timestamp),
    signature
  });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form
  });
  if (!response.ok) return Response.json({ error: "Cloudinary destroy failed" }, { status: 502, headers: corsHeaders });
  return Response.json({ ok: true }, { headers: corsHeaders });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST" && request.method !== "DELETE") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const appCheck = await verifyAppCheck(request, env);
    if (!appCheck.ok) return jsonError(corsHeaders, appCheck);

    const limited = await rateLimit(request, env);
    if (!limited.ok) return jsonError(corsHeaders, limited);

    return request.method === "POST" ? signedUpload(request, env, corsHeaders) : destroyUpload(request, env, corsHeaders);
  }
};
