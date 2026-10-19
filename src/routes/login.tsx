import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { URL_LOGIN } from "@/lib/auth/sessao";

const ERROS: Record<string, string> = {
  fluxo: "O login expirou ou foi interrompido. Tente de novo.",
  token: "Não foi possível concluir o login com o ANCORA ID.",
  email: "ID token missing email claim",
  falha: "Erro inesperado no login. Tente de novo.",
};

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Etiquetas Rede ANCORA" },
      { name: "description", content: "Acesso corporativo às etiquetas da Rede ANCORA com ANCORA ID." },
      { property: "og:title", content: "Entrar — Etiquetas Rede ANCORA" },
      { property: "og:description", content: "Acesso corporativo com ANCORA ID." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const [saiu, setSaiu] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("logged_out") === "1" || sessionStorage.getItem("oidc_logout_pending") === "1") {
      setSaiu(true);
      sessionStorage.removeItem("oidc_logout_pending");
    }
    const e = q.get("erro");
    if (e) setErro(ERROS[e] ?? ERROS["falha"] ?? null);
  }, []);

  const entrar = async () => {
    // Checa antes se o login está configurado, para mostrar o aviso 503 aqui.
    const r = await fetch(URL_LOGIN, { redirect: "manual" });
    if (r.status === 503) {
      setIndisponivel(((await r.json()) as { error: string }).error);
      return;
    }
    window.location.href = URL_LOGIN;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <img
          src="https://cdn.redeancora.com.br/Manual_da_Marca/Logotipo_Oficial/Logotipo_Oficial_Rede_ANCORA.png"
          alt="Rede ANCORA"
          className="mx-auto h-16 w-auto"
        />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Etiquetas de código de barras</h1>
        {saiu && <p className="mt-4 rounded-md bg-muted p-2 text-sm text-foreground">Você saiu com sucesso.</p>}
        {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}
        {indisponivel && <p className="mt-4 text-sm text-destructive">{indisponivel}</p>}
        <button
          type="button"
          onClick={entrar}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar com ANCORA ID
        </button>
      </div>
    </div>
  );
}
