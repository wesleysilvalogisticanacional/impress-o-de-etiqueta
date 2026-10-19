import { createFileRoute } from "@tanstack/react-router";

import {
  adminDb, aleatorio, configOidc, cookie, COOKIE_FLUXO, COOKIE_SESSAO, discovery,
  DURACAO_SESSAO_S, extrairEmail, lerCookie, origemApp, respostaNaoConfigurado, rotaCallback,
  sha256b64url, validarIdToken,
} from "@/lib/auth/oidc.server";

const limparFluxo = cookie(COOKIE_FLUXO, "", 0, "/api/public/oidc");

function redirecionar(url: string, cookies: string[] = []) {
  const h = new Headers({ Location: url, "Cache-Control": "no-store" });
  for (const c of [limparFluxo, ...cookies]) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}

export const Route = createFileRoute("/api/public/oidc/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origem = origemApp(request);
        try {
          const { issuer, clientId, clientSecret } = configOidc();
          const q = new URL(request.url).searchParams;
          const code = q.get("code");
          const state = q.get("state");
          const [stEsperado, verifier] = (lerCookie(request, COOKIE_FLUXO) || "").split(".");
          if (q.get("error") || !code || !state || !stEsperado || state !== stEsperado || !verifier) {
            return redirecionar(`${origem}/login?erro=fluxo`);
          }

          const d = await discovery(issuer);
          const tr = await fetch(d.token_endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${btoa(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`)}`,
            },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: rotaCallback(origem),
              client_id: clientId,
              code_verifier: verifier,
            }),
          });
          if (!tr.ok) {
            console.error("Troca de code falhou", tr.status, await tr.text());
            return redirecionar(`${origem}/login?erro=token`);
          }
          const tokens = (await tr.json()) as { id_token?: string; access_token?: string; refresh_token?: string };
          if (!tokens.id_token) return redirecionar(`${origem}/login?erro=token`);

          const claims = await validarIdToken(tokens.id_token, issuer, clientId, d.jwks_uri);
          let email = extrairEmail(claims);
          if (!email && d.userinfo_endpoint && tokens.access_token) {
            const ui = await fetch(d.userinfo_endpoint, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
            if (ui.ok) email = extrairEmail((await ui.json()) as Record<string, unknown>);
          }
          if (!email) {
            console.error("ID token missing email claim");
            return redirecionar(`${origem}/login?erro=email`);
          }

          const db = await adminDb();
          const { data: usuario } = await db
            .from("users")
            .select("id")
            .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
            .eq("active", true)
            .maybeSingle();
          if (!usuario) return redirecionar(`${origem}/auth/negado`);

          const sid = aleatorio(32);
          const { error } = await db.from("app_sessions").insert({
            session_id: await sha256b64url(sid),
            user_id: usuario.id,
            oidc_sub: String(claims.sub ?? ""),
            refresh_token: tokens.refresh_token ?? null,
            id_token: tokens.id_token,
            expires_at: new Date(Date.now() + DURACAO_SESSAO_S * 1000).toISOString(),
          });
          if (error) throw error;
          await db.from("users").update({ last_login: new Date().toISOString() }).eq("id", usuario.id);

          return redirecionar(`${origem}/`, [cookie(COOKIE_SESSAO, sid, DURACAO_SESSAO_S)]);
        } catch (e) {
          const r = respostaNaoConfigurado(e);
          if (r) return r;
          console.error(e);
          return redirecionar(`${origem}/login?erro=falha`);
        }
      },
    },
  },
});
