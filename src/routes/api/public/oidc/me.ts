import { createFileRoute } from "@tanstack/react-router";

import { sessaoAtual } from "@/lib/auth/oidc.server";

export const Route = createFileRoute("/api/public/oidc/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const s = await sessaoAtual(request);
        if (!s) return Response.json({ error: "Não autenticado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
        return Response.json(s.usuario, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
