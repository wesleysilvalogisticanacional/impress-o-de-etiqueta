import { medirAprox, PT_MM, type Medidor } from "./codigos";

/** Mesma família de fonte usada no SVG da etiqueta. */
const FAMILIA = "Helvetica, Arial, sans-serif";

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

/**
 * Mede o texto no navegador com a fonte real (canvas), para a quebra de linha da
 * descrição bater com o que sai impresso. Fora do navegador usa a medida aproximada.
 */
export const medirTexto: Medidor = (texto, pt, negrito) => {
  if (typeof document === "undefined") return medirAprox(texto, pt, negrito);
  if (ctx === undefined) {
    try {
      ctx = document.createElement("canvas").getContext("2d");
    } catch {
      ctx = null;
    }
  }
  if (!ctx) return medirAprox(texto, pt, negrito);
  const k = (negrito ? "b|" : "n|") + texto;
  let em = cache.get(k);
  if (em === undefined) {
    ctx.font = `${negrito ? "bold " : ""}100px ${FAMILIA}`;
    em = ctx.measureText(texto).width / 100;
    if (cache.size > 5000) cache.clear();
    cache.set(k, em);
  }
  return em * pt * PT_MM;
};
