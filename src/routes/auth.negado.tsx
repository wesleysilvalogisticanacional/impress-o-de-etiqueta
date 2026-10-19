import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/negado")({
  head: () => ({
    meta: [
      { title: "Acesso negado — Etiquetas Rede ANCORA" },
      { name: "description", content: "Seu usuário não tem permissão para acessar as etiquetas." },
      { property: "og:title", content: "Acesso negado — Etiquetas Rede ANCORA" },
      { property: "og:description", content: "Usuário sem permissão de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você não tem permissão para acessar esta aplicação. Contate o administrador.
        </p>
        <Link to="/login" className="mt-6 inline-block text-sm text-primary underline">
          Voltar ao login
        </Link>
      </div>
    </div>
  ),
});
