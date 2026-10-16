import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { guardar, ler } from "@/lib/etiquetas/armazenamento";

// Logo oficial da Rede ANCORA, sempre pela URL fixa da CDN do manual da marca.
const LOGO =
  "https://cdn.redeancora.com.br/Manual_da_Marca/Logotipo_Oficial/Logotipo_Oficial_Rede_ANCORA.png";

type Tema = "system" | "light" | "dark";
const OPCOES: { valor: Tema; nome: string; Icone: typeof Monitor }[] = [
  { valor: "system", nome: "Seguir o sistema", Icone: Monitor },
  { valor: "light", nome: "Claro", Icone: Sun },
  { valor: "dark", nome: "Escuro", Icone: Moon },
];

function aplicarTema(t: Tema) {
  const r = document.documentElement;
  if (t === "light" || t === "dark") r.setAttribute("data-theme", t);
  else r.removeAttribute("data-theme");
}

export function Cabecalho() {
  const [tema, setTema] = useState<Tema>("system");

  useEffect(() => {
    const t = ler<Tema>("etq.tema", "system");
    setTema(t);
    aplicarTema(t);
  }, []);

  const escolher = (t: Tema) => {
    setTema(t);
    aplicarTema(t);
    guardar("etq.tema", t);
  };

  return (
    <header className="etq-topo">
      <div className="etq-topo-in">
        <div className="etq-marca">
          <img src={LOGO} alt="Rede ANCORA" width={100} height={83} />
          <span className="etq-marca-sep" aria-hidden="true" />
          <div className="etq-marca-txt">
            <span className="etq-marca-nome">Rede ANCORA</span>
            <h1>Etiquetas de código de barras</h1>
          </div>
        </div>
        <div className="etq-tema" role="group" aria-label="Tema">
          {OPCOES.map(({ valor, nome, Icone }) => (
            <button
              key={valor}
              type="button"
              aria-label={nome}
              title={nome}
              aria-pressed={tema === valor}
              onClick={() => escolher(valor)}
            >
              <Icone strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
