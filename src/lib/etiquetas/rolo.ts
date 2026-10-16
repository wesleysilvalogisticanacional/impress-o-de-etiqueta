/**
 * Medidas do rolo de etiquetas. Cada computador guarda as suas (localStorage),
 * porque cada filial pode ter um rolo diferente.
 *
 * Padrão aprovado em produção: 2 etiquetas de 50 × 30 mm por linha,
 * 5 mm de vão entre colunas e 3 mm entre linhas → papel de 105 × 30 mm no driver.
 */
export type Rolo = {
  larg: number; // largura de uma etiqueta (mm)
  alt: number; // altura de uma etiqueta (mm)
  cols: number; // etiquetas por linha
  vao: number; // vão entre colunas (mm)
  gap: number; // vão entre linhas (mm) — só informativo; o sensor da impressora acha o vão
  margem: number; // margem esquerda (mm)
};

export const ROLO_PADRAO: Rolo = { larg: 50, alt: 30, cols: 2, vao: 5, gap: 3, margem: 0 };

const LIMITES: Record<keyof Rolo, [number, number]> = {
  larg: [20, 120],
  alt: [15, 100],
  cols: [1, 3],
  vao: [0, 20],
  gap: [0, 10],
  margem: [0, 20],
};

export function normRolo(r: Partial<Record<keyof Rolo, unknown>> | null | undefined): Rolo {
  const o = { ...ROLO_PADRAO };
  for (const k of Object.keys(ROLO_PADRAO) as (keyof Rolo)[]) {
    let v = parseFloat(String(r?.[k] ?? ""));
    if (!Number.isFinite(v)) v = ROLO_PADRAO[k];
    v = Math.max(LIMITES[k][0], Math.min(LIMITES[k][1], v));
    o[k] = k === "cols" ? Math.round(v) : v;
  }
  return o;
}

/** Largura da página de impressão = uma linha inteira do rolo. */
export const larguraPagina = (r: Rolo) => r.margem + r.cols * r.larg + (r.cols - 1) * r.vao;

export const mmTxt = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");
