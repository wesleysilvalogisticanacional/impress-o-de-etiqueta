import { createFileRoute } from "@tanstack/react-router";

import { EtiquetasApp } from "@/components/etiquetas/EtiquetasApp";

// Sem head() aqui: título e descrição vêm de __root.tsx.
export const Route = createFileRoute("/")({
  component: EtiquetasApp,
});
