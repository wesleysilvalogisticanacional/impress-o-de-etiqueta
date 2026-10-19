import { createFileRoute } from "@tanstack/react-router";

import {
  aleatorio, configOidc, cookie, COOKIE_FLUXO, discovery, origemApp, respostaNaoConfigurado,
  rotaCallback, sha256b64url,
} from "@/lib/auth/oidc.server";

export const Route = createFileRoute("/api/public/oidc/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { issuer, clientId } = configOidc();
          const d = await discovery(issuer);
          const state = aleatorio(24);
          const verifier = aleatorio(48);
          const url = new URL(d.authorization_endpoint);
          url.searchParams.set("client_id", clientId);
          url.searchParams.set("redirect_uri", rotaCallback(origemApp(request)));
          url.searchParams.set("response_type", "code");
          url.searchParams.set("scope", "openid");
          url.searchParams.set("state", state);
          url.searchParams.set("code_challenge", await sha256b64url(verifier));
          url.searchParams.set("code_challenge_method", "S256");
          return new Response(null, {
            status: 302,
            headers: {
              Location: url.toString(),
              "Set-Cookie": cookie(COOKIE_FLUXO, `${state}.${verifier}`, 600, "/api/public/oidc"),
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          const r = respostaNaoConfigurado(e);
          if (r) return r;
          console.error(e);
          return Response.json({ error: "Falha ao iniciar login" }, { status: 500 });
        }
      },
    },
  },
});
