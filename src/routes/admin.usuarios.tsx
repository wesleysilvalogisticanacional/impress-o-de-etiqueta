import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { PainelAcessos } from "@/components/etiquetas/PainelAcessos";
import { buscarUsuario } from "@/lib/auth/sessao";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Painel de acesso — Etiquetas Rede ANCORA" },
      { name: "description", content: "Quem pode usar as etiquetas da Rede ANCORA." },
    ],
  }),
  component: Acessos,
});

function Acessos() {
  const navigate = useNavigate();
  const { data, isPending, isError } = useQuery({
    queryKey: ["sessao"],
    queryFn: buscarUsuario,
    retry: false,
  });

  useEffect(() => {
    if (!isPending && (data === null || isError)) navigate({ to: "/login", replace: true });
  }, [data, isPending, isError, navigate]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Validando acesso…
      </div>
    );
  }
  if (data.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">Só para administradores</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O painel de acesso é usado por quem libera e bloqueia usuários. Peça a um administrador
            se precisar de alguma mudança.
          </p>
          <Link to="/" className="mt-6 inline-block text-sm text-primary underline">
            Voltar para as etiquetas
          </Link>
        </div>
      </div>
    );
  }
  return <PainelAcessos eu={data} />;
}
