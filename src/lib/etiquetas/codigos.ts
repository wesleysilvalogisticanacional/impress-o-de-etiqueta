import JsBarcode from "jsbarcode";

import { mmTxt, type Rolo } from "./rolo";

/** alt = código alternativo; desc = descrição do produto. */
export type Produto = { cna: string; ean: string; alt: string; desc: string };

export type Forma =
  | { t: "bar"; x: number; y: number; w: number; h: number }
  | {
      t: "txt";
      x: number;
      y: number;
      pt: number;
      b?: boolean;
      a: "start" | "middle";
      s: string;
      /** Largura máxima em mm: o texto é comprimido para caber, nunca passa da etiqueta. */
      comp?: number;
    };

/** Mede a largura de um texto em mm, em Helvetica/Arial no tamanho `pt`. */
export type Medidor = (texto: string, pt: number, negrito: boolean) => number;

/** Medida aproximada (Helvetica), usada fora do navegador e como reserva. */
export const medirAprox: Medidor = (texto, pt, negrito) => {
  let em = 0;
  for (const c of texto) {
    if (c === " ") em += 0.278;
    else if (/[0-9]/.test(c)) em += 0.556;
    else if (/[A-Z]/.test(c)) em += c === "M" || c === "W" ? 0.85 : c === "I" ? 0.3 : 0.68;
    else if (/[a-z]/.test(c)) em += c === "m" || c === "w" ? 0.8 : /[ijlft]/.test(c) ? 0.28 : 0.53;
    else em += 0.4;
  }
  return em * (negrito ? 1.07 : 1) * pt * PT_MM;
};

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

/** Quebra o texto em até `maxLinhas` linhas que caibam em `larg` mm; corta com "…" se sobrar. */
export function quebrar(
  texto: string,
  larg: number,
  pt: number,
  medir: Medidor,
  maxLinhas: number,
): { linhas: string[]; cortou: boolean } {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  let i = 0;
  for (; i < palavras.length; i++) {
    const w = palavras[i] as string;
    const tentativa = atual ? atual + " " + w : w;
    if (medir(tentativa, pt, false) <= larg) {
      atual = tentativa;
      continue;
    }
    if (atual) {
      linhas.push(atual);
      if (linhas.length === maxLinhas) break;
    }
    atual = w;
  }
  if (linhas.length < maxLinhas && atual) {
    linhas.push(atual);
    atual = "";
    i = palavras.length;
  }
  const cortou = i < palavras.length || linhas.some((l) => medir(l, pt, false) > larg);
  if (cortou && linhas.length) {
    let ultima = linhas[linhas.length - 1] as string;
    if (i < palavras.length) ultima = ultima + " " + palavras.slice(i).join(" ");
    while (ultima.length > 1 && medir(ultima + "…", pt, false) > larg) ultima = ultima.slice(0, -1);
    linhas[linhas.length - 1] = ultima.trimEnd() + "…";
  }
  return { linhas, cortou };
}

/**
 * Desenho de UMA etiqueta em mm — a mesma lista de formas vai para a prévia e para a impressão.
 * Layout aprovado em 50 × 30 mm:
 *   1. código alternativo em destaque (negrito);
 *   2. "CNA 921173 - DESCRIÇÃO DO PRODUTO", em até 2 linhas;
 *   3. código de barras do EAN, com os dígitos embaixo.
 * Outras medidas escalam posições e letras; as barras mantêm larguras múltiplas
 * do ponto da impressora (0,125 mm a 203 dpi).
 */
export function desenhar(
  p: Produto,
  rolo: Rolo,
  medir: Medidor = medirAprox,
): { formas: Forma[]; avisos: string[] } {
  const W = rolo.larg;
  const H = rolo.alt;
  const sx = W / 50;
  const sy = H / 30;
  const sf = Math.max(0.6, Math.min(sx, sy, 1.6));
  const mx = Math.max(1.5, 2.5 * sx);
  const larguraTexto = (W - 2 * mx) * 0.97;
  const util = W - 2 * Math.max(2, 2 * sx);
  const f: Forma[] = [];
  const avisos: string[] = [];

  // 1. Destaque: código alternativo (ou o CNA, se o produto não tiver alternativo).
  const destaque = p.alt || "CNA " + p.cna;
  let ptD = 11 * sf;
  while (ptD > 7 * sf && medir(destaque, ptD, true) > larguraTexto) ptD -= 0.5 * sf;
  const comprimeD = medir(destaque, ptD, true) > larguraTexto;
  f.push({
    t: "txt",
    x: mx,
    y: 5.4 * sy,
    pt: ptD,
    b: true,
    a: "start",
    s: destaque,
    ...(comprimeD ? { comp: larguraTexto } : {}),
  });

  // 2. "CNA 921173 - DESCRIÇÃO", em até 2 linhas (encolhe e, se ainda não couber, corta com "…").
  const linha2 = p.alt ? "CNA " + p.cna + (p.desc ? " - " + p.desc : "") : p.desc;
  let linhas: string[] = [];
  if (linha2) {
    let pt2 = 7 * sf;
    let q = quebrar(linha2, larguraTexto, pt2, medir, 2);
    if (q.cortou) {
      pt2 = 6 * sf;
      q = quebrar(linha2, larguraTexto, pt2, medir, 2);
    }
    linhas = q.linhas;
    // textLength só quando a linha passaria da largura: estica nunca, só comprime.
    linhas.forEach((s, i) =>
      f.push({
        t: "txt",
        x: mx,
        y: (8.9 + i * 2.6) * sy,
        pt: pt2,
        a: "start",
        s,
        ...(medir(s, pt2, false) > larguraTexto ? { comp: larguraTexto } : {}),
      }),
    );
  }

  if (!p.ean) {
    avisos.push("Este produto não tem EAN na base; a etiqueta sai sem código de barras");
    return { formas: f, avisos };
  }
  // 3. Código de barras: começa logo abaixo do texto e vai até 25 mm.
  const topo = (linhas.length >= 2 ? 12.6 : linhas.length === 1 ? 10.0 : 7.4) * sy;
  const v = { y: topo, h: 25.0 * sy - topo, ty: 28.4 * sy };
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
  f.push({ t: "txt", x: W / 2, y: v.ty, pt: 9 * sf, a: "middle", s: e.texto });
  return { formas: f, avisos };
}

export const PT_MM = 0.3528;
