import { chave, type Produto } from "./codigos";

/** Base de produtos em memória: busca por CNA e por EAN. */
export type Base = {
  byCna: Map<string, Produto>;
  byEan: Map<string, Produto>;
  /** O mesmo código alternativo pode existir em marcas diferentes. */
  byAlt: Map<string, Produto[]>;
  total: number;
  comEan: number;
  comAlt: number;
  comDesc: number;
  cientifica: number;
  /** EANs descartados por não poderem virar código de barras (texto com acento, frase…). */
  invalidos: number;
};

export type Mapa = { cna: number; ean: number; alt: number; desc: number; marca: number };

const semAcento = (s: string) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
export const normCab = (s: string) =>
  semAcento(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Texto da célula sem estragar códigos numéricos (7891234567895, 100245.0 → 100245). */
export function cel(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : String(v);
  }
  let s = String(v).trim();
  if (/^\d+\.0+$/.test(s)) s = s.split(".")[0] ?? s;
  return s;
}

/** CSV com ; , TAB ou | (detecta pela primeira linha), aspas opcionais. */
export function parseCSV(text: string): string[][] {
  const nl = text.indexOf("\n");
  const primeira = nl >= 0 ? text.slice(0, nl) : text;
  let sep = ";";
  let melhor = -1;
  for (const c of [";", "\t", ",", "|"]) {
    const n = primeira.split(c).length - 1;
    if (n > melhor) {
      melhor = n;
      sep = c;
    }
  }
  // Caminho rápido: sem aspas (como o base_produtos.csv publicado), basta dividir.
  if (!text.includes('"')) {
    const out: string[][] = [];
    for (const l of text.split("\n")) {
      const r = l.replace(/\r$/, "").split(sep).map(cel);
      if (r.some((x) => x !== "")) out.push(r);
    }
    return out;
  }
  const linhas: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += ch;
    } else if (ch === '"' && f === "") q = true;
    else if (ch === sep) {
      row.push(f);
      f = "";
    } else if (ch === "\n") {
      row.push(f);
      linhas.push(row);
      row = [];
      f = "";
    } else if (ch !== "\r") f += ch;
  }
  if (f !== "" || row.length) {
    row.push(f);
    linhas.push(row);
  }
  return linhas.map((r) => r.map(cel)).filter((r) => r.some((x) => x !== ""));
}

/** UTF-8 primeiro; se não for, Windows-1252 (o Excel salva CSV assim no Windows). */
export function decodificar(buf: ArrayBuffer): string {
  let t: string;
  try {
    t = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    t = new TextDecoder("windows-1252").decode(buf);
  }
  return t.replace(/^\uFEFF/, "");
}

type SheetJS = {
  read: (
    d: ArrayBuffer,
    o: { type: "array" },
  ) => { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json: (ws: unknown, o: { header: 1; raw: true; defval: "" }) => unknown[][] };
};

let xlsxP: Promise<SheetJS> | null = null;
/** O leitor de Excel só é baixado quando alguém abre um .xlsx. */
function carregarXLSX(): Promise<SheetJS> {
  const w = window as unknown as { XLSX?: SheetJS };
  if (w.XLSX) return Promise.resolve(w.XLSX);
  if (!xlsxP) {
    xlsxP = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => (w.XLSX ? ok(w.XLSX) : falha(new Error("Leitor de Excel indisponível.")));
      s.onerror = () => {
        xlsxP = null;
        falha(
          new Error(
            "Não foi possível abrir o leitor de Excel. Salve a planilha como CSV e tente de novo.",
          ),
        );
      };
      document.head.appendChild(s);
    });
  }
  return xlsxP;
}

export async function lerPlanilha(file: File): Promise<string[][]> {
  if (/\.xls[xm]$/i.test(file.name)) {
    const XLSX = await carregarXLSX();
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0] ?? ""];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    return rows.map((r) => r.map(cel)).filter((r) => r.some((x) => x !== ""));
  }
  return parseCSV(decodificar(await file.arrayBuffer()));
}

/** Adivinha as colunas pelo cabeçalho (acentos e maiúsculas não importam). */
export function adivinhar(cab: string[]): Mapa {
  const n = cab.map(normCab);
  const achar = (testes: ((h: string) => boolean)[], evitar: number[] = []) => {
    for (const t of testes) {
      const i = n.findIndex((h, k) => !evitar.includes(k) && t(h));
      if (i >= 0) return i;
    }
    return -1;
  };
  const cna = achar([(h) => h === "cna", (h) => h.includes("cna")]);
  const alt = achar(
    [
      (h) => h.includes("alternativ"),
      (h) => h === "alt",
      (h) => h.includes("codalt"),
      (h) => h.includes("referencia"),
      (h) => h === "ref",
    ],
    [cna],
  );
  const ean = achar(
    [
      (h) => h === "ean",
      (h) => h.includes("ean"),
      (h) => h.includes("gtin"),
      (h) => h.includes("barra"),
    ],
    [cna, alt],
  );
  const desc = achar(
    [(h) => h.startsWith("descri"), (h) => h.includes("descri"), (h) => h === "nome"],
    [cna, alt, ean],
  );
  const marca = achar(
    [(h) => h === "marca", (h) => h.includes("marca"), (h) => h.includes("fabricante")],
    [cna, alt, ean, desc],
  );
  return { cna, ean, alt, desc, marca };
}

/** Tira espaços, tabulações e caracteres invisíveis que vêm colados de outros sistemas. */
export const limparCodigo = (s: string) => s.replace(/[\s\u00ad\u200b-\u200f\u2060\ufeff]/g, "");
/** Descrição em uma linha: sem caracteres de controle, espaço especial vira espaço comum. */
export const limparTexto = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex -- remover caracteres de controle é o objetivo
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2060\ufeff]/g, " ")
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
/** Só ASCII visível e até 48 caracteres vira código de barras; o resto é descartado. */
const CODIGO_IMPRIMIVEL = /^[\x21-\x7e]{1,48}$/;

export function montarBase(linhas: string[][], m: Mapa, comCab = true): Base {
  const byCna = new Map<string, Produto>();
  const byEan = new Map<string, Produto>();
  let cientifica = 0;
  let invalidos = 0;
  for (let i = comCab ? 1 : 0; i < linhas.length; i++) {
    const r = linhas[i] ?? [];
    const cna = (r[m.cna] || "").trim();
    if (!cna) continue;
    let ean = m.ean >= 0 ? limparCodigo(r[m.ean] || "") : "";
    const alt = m.alt >= 0 ? limparTexto(r[m.alt] || "") : "";
    const desc = m.desc >= 0 ? limparTexto(r[m.desc] || "") : "";
    const marca = m.marca >= 0 ? limparTexto(r[m.marca] || "") : "";
    if (/\d[.,]\d+e\+?\d+/i.test(ean)) {
      cientifica++;
      ean = "";
    } else if (ean && !CODIGO_IMPRIMIVEL.test(ean)) {
      invalidos++;
      ean = "";
    }
    const k = chave(cna);
    const ex = byCna.get(k);
    if (!ex) {
      const p = { cna, ean, alt, desc, marca };
      byCna.set(k, p);
      if (ean) byEan.set(chave(ean), p);
    } else if (!ex.ean && ean) {
      ex.ean = ean;
      byEan.set(chave(ean), ex);
      if (!ex.alt) ex.alt = alt;
      if (!ex.desc) ex.desc = desc;
      if (!ex.marca) ex.marca = marca;
    }
  }
  let comEan = 0;
  let comAlt = 0;
  let comDesc = 0;
  const byAlt = new Map<string, Produto[]>();
  for (const p of byCna.values()) {
    if (p.alt) {
      const k = chave(p.alt);
      const lista = byAlt.get(k);
      if (lista) lista.push(p);
      else byAlt.set(k, [p]);
    }
    if (p.ean) comEan++;
    if (p.alt) comAlt++;
    if (p.desc) comDesc++;
  }
  return {
    byCna,
    byEan,
    byAlt,
    total: byCna.size,
    comEan,
    comAlt,
    comDesc,
    cientifica,
    invalidos,
  };
}

/** Formato do arquivo publicado em public/base_produtos.csv.gz (CSV compactado). */
export function baseParaCSV(b: Base): string {
  const limpa = (s: string) =>
    String(s)
      .replace(/[;\r\n"]/g, " ")
      .trim();
  const out = ["cna;ean;alternativo;descricao;marca"];
  for (const p of b.byCna.values())
    out.push([p.cna, p.ean, p.alt, p.desc, p.marca].map(limpa).join(";"));
  return out.join("\n") + "\n";
}

export type ModoBusca = "cna" | "alt";

/** Códigos digitados ou bipados juntos: separados por ";" ou por linha. */
export const separarCodigos = (texto: string) =>
  texto
    .split(/[;\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export type Resolucao = {
  achados: { cna: string; qtd: number }[];
  faltam: string[];
  /** Código alternativo que existe em mais de um produto: a pessoa escolhe qual. */
  escolher: { codigo: string; qtd: number; opcoes: Produto[] }[];
};

/** Procura cada código no modo escolhido: CNA/EAN, ou código alternativo. */
export function resolverCodigos(
  b: Base,
  modo: ModoBusca,
  entradas: { codigo: string; qtd: number }[],
): Resolucao {
  const r: Resolucao = { achados: [], faltam: [], escolher: [] };
  for (const { codigo, qtd } of entradas) {
    if (modo === "cna") {
      const p = buscar(b, codigo);
      if (p) r.achados.push({ cna: p.cna, qtd });
      else r.faltam.push(codigo);
      continue;
    }
    const opcoes = b.byAlt.get(chave(codigo)) ?? [];
    const unico = opcoes[0];
    if (opcoes.length === 1 && unico) r.achados.push({ cna: unico.cna, qtd });
    else if (opcoes.length > 1) r.escolher.push({ codigo, qtd, opcoes });
    else {
      // Leitor de código de barras no modo alternativo: aceita o EAN também.
      const porEan = b.byEan.get(chave(codigo));
      if (porEan) r.achados.push({ cna: porEan.cna, qtd });
      else r.faltam.push(codigo);
    }
  }
  return r;
}

export function buscar(b: Base | null, txt: string): Produto | null {
  if (!b) return null;
  const k = chave(txt);
  return b.byCna.get(k) || b.byEan.get(k) || null;
}

/** Linhas coladas do Excel: CNA e quantidade (TAB, ; , ou espaço). */
export function lerColagem(texto: string): { cna: string; qtd: number }[] {
  const out: { cna: string; qtd: number }[] = [];
  texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l, n) => {
      const partes = l
        .split(/[\t;,]+|\s{2,}|\s+(?=\d+$)/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!partes.length) return;
      const cna = partes[0] ?? "";
      if (n === 0 && ["cna", "codigo", "produto"].includes(normCab(cna))) return;
      const qtd = Math.max(1, Math.min(999, parseInt(partes[1] ?? "", 10) || 1));
      out.push({ cna, qtd });
    });
  return out;
}

export const EXEMPLO: string[][] = [
  ["cna", "ean", "alternativo", "descricao", "marca"],
  ["100245", "7891234567895", "ABC-4521", "FILTRO OLEO MOTOR", "MARCA A"],
  [
    "100246",
    "7896543210982",
    "PF2210",
    "PASTILHA FREIO DIANTEIRA CERAMICA C/ SENSOR DE DESGASTE",
    "MARCA B",
  ],
  ["200771", "", "KT90210X", "KIT CORREIA DENTADA C/ TENSOR", "MARCA C"],
  ["200772", "7891000100103", "PF2210", "PASTILHA FREIO TRASEIRA", "MARCA D"],
];

/** Abre o arquivo publicado: aceita CSV compactado (gzip) ou CSV puro. */
export async function abrirArquivoBase(buf: ArrayBuffer): Promise<string> {
  const b = new Uint8Array(buf);
  if (b[0] === 0x1f && b[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined")
      throw new Error("Este navegador não abre a base compactada. Atualize o Chrome ou o Edge.");
    const fluxo = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
    return decodificar(await new Response(fluxo).arrayBuffer());
  }
  return decodificar(buf);
}

/** Gera o arquivo para publicar: compactado quando o navegador permite (fica ~4× menor). */
export async function arquivoParaPublicar(b: Base): Promise<{ nome: string; blob: Blob }> {
  const csv = new Blob([baseParaCSV(b)], { type: "text/csv;charset=utf-8" });
  if (typeof CompressionStream === "undefined") return { nome: "base_produtos.csv", blob: csv };
  const fluxo = csv.stream().pipeThrough(new CompressionStream("gzip"));
  return { nome: "base_produtos.csv.gz", blob: await new Response(fluxo).blob() };
}
