// BFF OIDC do ANCORA ID. Roda só no servidor: client_secret e tokens nunca vão ao navegador.
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export const COOKIE_SESSAO = "etq_sessao";
export const COOKIE_FLUXO = "etq_oidc";
export const DURACAO_SESSAO_S = 60 * 60 * 8; // 8 h

export class OidcNaoConfigurado extends Error {}

export function configOidc() {
  const issuer = (process.env["OIDC_ISSUER_URL"] || "https://id.redeancora.com.br").replace(/\/$/, "");
  const clientId = process.env["OIDC_CLIENT_ID"];
  const clientSecret = process.env["OIDC_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new OidcNaoConfigurado("Login OIDC não configurado — aguardando credenciais da TI");
  }
  return { issuer, clientId, clientSecret };
}

export function respostaNaoConfigurado(e: unknown): Response | null {
  if (e instanceof OidcNaoConfigurado) {
    return Response.json({ error: e.message }, { status: 503 });
  }
  return null;
}

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
  jwks_uri: string;
};

let cacheDiscovery: { issuer: string; doc: Discovery; ate: number } | null = null;
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function discovery(issuer: string): Promise<Discovery> {
  if (cacheDiscovery && cacheDiscovery.issuer === issuer && cacheDiscovery.ate > Date.now()) {
    return cacheDiscovery.doc;
  }
  const r = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!r.ok) throw new Error(`Falha no discovery OIDC (${r.status})`);
  const doc = (await r.json()) as Discovery;
  cacheDiscovery = { issuer, doc, ate: Date.now() + 10 * 60 * 1000 };
  return doc;
}

export async function validarIdToken(idToken: string, issuer: string, clientId: string, jwksUri: string) {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  const { payload } = await jwtVerify(idToken, jwks, { issuer, audience: clientId });
  return payload;
}

const ORDEM_EMAIL = ["email", "mail", "upn", "preferred_username"] as const;

/** Ordem fixa: email, mail, upn, preferred_username, sub (só se tiver "@"). */
export function extrairEmail(claims: Record<string, unknown> | JWTPayload | null | undefined): string | null {
  if (!claims) return null;
  for (const k of ORDEM_EMAIL) {
    const v = (claims as Record<string, unknown>)[k];
    if (typeof v === "string" && v.includes("@")) return v.trim();
  }
  const sub = (claims as Record<string, unknown>)["sub"];
  if (typeof sub === "string" && sub.includes("@")) return sub.trim();
  return null;
}

export function base64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function aleatorio(n = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(n)));
}

export async function sha256b64url(v: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return base64url(new Uint8Array(h));
}

export function lerCookie(req: Request, nome: string): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const parte of raw.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nome) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function cookie(nome: string, valor: string, maxAge: number, path = "/") {
  return `${nome}=${encodeURIComponent(valor)}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function origemApp(req: Request) {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || u.host;
  return `${proto}://${host}`;
}

export const rotaCallback = (origem: string) => `${origem}/api/public/oidc/callback`;

export async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Sessão guardada com hash do identificador: o cookie sozinho não aparece no banco. */
export async function sessaoAtual(req: Request) {
  const id = lerCookie(req, COOKIE_SESSAO);
  if (!id) return null;
  const db = await adminDb();
  const { data } = await db
    .from("app_sessions")
    .select("session_id, expires_at, id_token, users(id, email, name, role, active)")
    .eq("session_id", await sha256b64url(id))
    .maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  const u = data.users as unknown as { id: string; email: string; name: string | null; role: string; active: boolean } | null;
  if (!u || !u.active) return null;
  return { sessionId: data.session_id, idToken: data.id_token, usuario: { id: u.id, email: u.email, name: u.name, role: u.role } };
}
