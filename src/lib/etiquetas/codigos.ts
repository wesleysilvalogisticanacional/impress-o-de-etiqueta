import JsBarcode from "jsbarcode";

import { mmTxt, type Rolo } from "./rolo";

export type Produto = { cna: string; ean: string; alt: string };

export type Forma =
  | { t: "bar"; x: number; y: number; w: number; h: number }
  | { t: "txt"; x: number; y: number; pt: number; b?: boolean; a: "start" | "middle"; s: string };

/** CNA e EAN são comparados em maiúsculas e sem zeros à esquerda. */
export const chave = (s: string) => {
  const t = String(s).trim().toUpperCase();
  return t.replace(/^0+/, "") || "0";
};

/** Dígito verificador GTIN (EAN-8 / EAN-13). */
export function eanOk(d: string): boolean {
  const corpo = d.slice(0, -1).split("").reverse();
  let s = 0;
  corpo.forEach((c, i) => {
    s += Number(c) * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (s % 10)) % 10 === Number(d.slice(-1));
}

export type Codificado = { formato: "EAN13" | "EAN8" | "CODE128"; bits: string; texto: string };

/** EAN-13 ou EAN-8 quando o código é um GTIN válido; senão Code 128. */
export function codificar(codigo: string): Codificado | null {
  const cod = String(codigo).trim();
  if (!cod) return null;
  let formato: Codificado["formato"] = "CODE128";
  if (/^\d{13}$/.test(cod) && eanOk(cod)) formato = "EAN13";
  else if (/^\d{8}$/.test(cod) && eanOk(cod)) formato = "EAN8";
  const alvo: { encodings?: { data: string }[] } = {};
  let valido = true;
  try {
    // Renderizar num objeto devolve só os módulos (1 = barra), sem desenhar nada.
    JsBarcode(alvo as unknown as SVGElement, cod, {
      format: formato,
      flat: true,
      valid: (v: boolean) => {
        valido = v;
      },
    });
  } catch {
    return null;
  }
  if (!valido || !alvo.encodings?.length) return null;
  return { formato, bits: alvo.encodings.map((e) => e.data).join(""), texto: cod };
}

/**
 * Desenho de UMA etiqueta em mm — a mesma lista de formas vai para a prévia e para a impressão.
 * Layout aprovado em 50 × 30 mm: CNA em negrito, "Ref.: …" abaixo e o EAN grande.
 * Outras medidas escalam posições e letras; as barras mantêm larguras múltiplas
 * do ponto da impressora (0,125 mm a 203 dpi).
 */
export function desenhar(p: Produto, rolo: Rolo): { formas: Forma[]; avisos: string[] } {
  const W = rolo.larg;
  const H = rolo.alt;
  const sx = W / 50;
  const sy = H / 30;
  const sf = Math.max(0.6, Math.min(sx, sy, 1.6));
  const mx = Math.max(1.5, 2.5 * sx);
  const util = W - 2 * Math.max(2, 2 * sx);
  const f: Forma[] = [];
  const avisos: string[] = [];

  f.push({ t: "txt", x: mx, y: 5.6 * sy, pt: 11 * sf, b: true, a: "start", s: "CNA " + p.cna });
  if (p.alt)
    f.push({ t: "txt", x: mx, y: 9.8 * sy, pt: 8.5 * sf, a: "start", s: "Ref.: " + p.alt });

  if (!p.ean) {
    avisos.push("Este produto não tem EAN na base; a etiqueta sai sem código de barras");
    return { formas: f, avisos };
  }
  const v = p.alt
    ? { y: 11.6 * sy, h: 13 * sy, ty: 28.3 * sy }
    : { y: 8.2 * sy, h: 16.4 * sy, ty: 28.3 * sy };
  const e = codificar(p.ean);
  if (!e) {
    avisos.push("O EAN " + p.ean + " tem caracteres que o código de barras não aceita");
    return { formas: f, avisos };
  }
  const n = e.bits.length;
  const mod = [0.375, 0.25, 0.125].find((m) => n * m <= util) ?? 0.125;
  if (n * mod > util) avisos.push("O EAN " + p.ean + " é longo demais para " + mmTxt(W) + " mm");
  const x0 = (W - n * mod) / 2;
  let i0 = -1;
  for (let k = 0; k <= n; k++) {
    const um = e.bits[k] === "1";
    if (um && i0 < 0) i0 = k;
    if (!um && i0 >= 0) {
      f.push({ t: "bar", x: x0 + i0 * mod, y: v.y, w: (k - i0) * mod, h: v.h });
      i0 = -1;
    }
  }
  f.push({ t: "txt", x: W / 2, y: v.ty, pt: 9.5 * sf, a: "middle", s: e.texto });
  return { formas: f, avisos };
}

export const PT_MM = 0.3528;
