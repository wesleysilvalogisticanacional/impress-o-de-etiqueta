import { PT_MM, type Forma } from "@/lib/etiquetas/codigos";
import type { Rolo } from "@/lib/etiquetas/rolo";

type Props = {
  formas: Forma[];
  rolo: Rolo;
  /** Na impressão o SVG tem o tamanho físico em mm e cores puras; na tela ocupa a largura da prévia. */
  impressao?: boolean;
  style?: React.CSSProperties;
};

export function EtiquetaSvg({ formas, rolo, impressao, style }: Props) {
  const tinta = impressao ? "#000000" : "var(--tinta)";
  const papel = impressao ? "#ffffff" : "var(--papel)";
  return (
    <svg
      viewBox={`0 0 ${rolo.larg} ${rolo.alt}`}
      width={impressao ? `${rolo.larg}mm` : "100%"}
      height={impressao ? `${rolo.alt}mm` : "100%"}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      style={style}
      aria-hidden={impressao ? true : undefined}
    >
      <rect width={rolo.larg} height={rolo.alt} fill={papel} />
      {formas.map((o, i) =>
        o.t === "bar" ? (
          <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} fill={tinta} />
        ) : (
          <text
            key={i}
            x={o.x}
            y={o.y}
            fontSize={o.pt * PT_MM}
            fontWeight={o.b ? 700 : 400}
            textAnchor={o.a}
            fill={tinta}
            fontFamily="Helvetica, Arial, sans-serif"
          >
            {o.s}
          </text>
        ),
      )}
    </svg>
  );
}
