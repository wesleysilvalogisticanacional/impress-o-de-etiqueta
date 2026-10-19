import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { EtiquetasApp } from "@/components/etiquetas/EtiquetasApp";
import { buscarUsuario } from "@/lib/auth/sessao";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Etiquetas Rede ANCORA" },
      { name: "description", content: "Impressão de etiquetas de código de barras das filiais da Rede ANCORA nas impressoras Argox." },
      { property: "og:title", content: "Etiquetas Rede ANCORA" },
      { property: "og:description", content: "Impressão de etiquetas de código de barras nas impressoras Argox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const navigate = useNavigate();
  const { data, isPending, isError } = useQuery({ queryKey: ["sessao"], queryFn: buscarUsuario, retry: false });

  useEffect(() => {
    if (!isPending && (data === null || isError)) navigate({ to: "/login", replace: true });
  }, [data, isPending, isError, navigate]);

  if (!data) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Validando acesso…</div>;
  }
  return <EtiquetasApp />;
}
