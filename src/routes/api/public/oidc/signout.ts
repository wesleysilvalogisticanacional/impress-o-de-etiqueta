import { createFileRoute } from "@tanstack/react-router";

import {
  adminDb, configOidc, cookie, COOKIE_SESSAO, discovery, origemApp, respostaNaoConfigurado,
  sessaoAtual,
} from "@/lib/auth/oidc.server";

export const Route = createFileRoute("/api/public/oidc/signout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origem = origemApp(request);
        const limpar = cookie(COOKIE_SESSAO, "", 0);
        const fallback = `${origem}/login?logged_out=1`;
        try {
          const s = await sessaoAtual(request);
          if (s) {
            const db = await adminDb();
            await db.from("app_sessions").delete().eq("session_id", s.sessionId);
          }
          let logoutUrl = fallback;
          try {
            const { issuer, clientId } = configOidc();
            const d = await discovery(issuer);
            if (d.end_session_endpoint) {
              const u = new URL(d.end_session_endpoint);
              u.searchParams.set("client_id", clientId);
              u.searchParams.set("post_logout_redirect_uri", fallback);
              if (s?.idToken) u.searchParams.set("id_token_hint", s.idToken);
              logoutUrl = u.toString();
            }
          } catch (e) {
            if (!respostaNaoConfigurado(e)) console.error(e);
          }
          return Response.json({ logoutUrl }, { headers: { "Set-Cookie": limpar, "Cache-Control": "no-store" } });
        } catch (e) {
          console.error(e);
          return Response.json({ logoutUrl: fallback }, { headers: { "Set-Cookie": limpar } });
        }
      },
    },
  },
});
