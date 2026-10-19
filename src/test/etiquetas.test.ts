import { describe, expect, it } from "vitest";

import {
  chave,
  codificar,
  desenhar,
  eanOk,
  PT_MM,
  quebrar,
  type Forma,
  type Medidor,
} from "@/lib/etiquetas/codigos";
import {
  adivinhar,
  baseParaCSV,
  buscar,
  lerColagem,
  montarBase,
  parseCSV,
  resolverCodigos,
  separarCodigos,
} from "@/lib/etiquetas/planilha";
import { larguraPagina, normRolo, ROLO_PADRAO } from "@/lib/etiquetas/rolo";

describe("códigos de barras", () => {
  it("confere o dígito verificador do EAN", () => {
    expect(eanOk("7891234567895")).toBe(true);
    expect(eanOk("4006381333931")).toBe(true);
    expect(eanOk("96385074")).toBe(true);
    expect(eanOk("7891234567890")).toBe(false);
  });

  it("escolhe EAN-13, EAN-8 ou Code 128", () => {
    expect(codificar("7891234567895")).toMatchObject({ formato: "EAN13" });
    expect(codificar("7891234567895")?.bits).toHaveLength(95);
    expect(codificar("96385074")).toMatchObject({ formato: "EAN8" });
    expect(codificar("7891234567890")?.formato).toBe("CODE128");
    expect(codificar("Ç@é")).toBeNull();
  });

  it("normaliza CNA e EAN sem zeros à esquerda", () => {
    expect(chave(" 00100245 ")).toBe("100245");
    expect(chave("abc")).toBe("ABC");
  });
});

describe("desenho da etiqueta 50 × 30 mm", () => {
  const rolo = ROLO_PADRAO;
  // Medida fixa e previsível para o teste (no navegador a medida vem da fonte real).
  const medir: Medidor = (t, pt, b) => t.length * pt * PT_MM * (b ? 0.62 : 0.55);
  const larguraTexto = (50 - 2 * 2.5) * 0.97;
  const textos = (f: Forma[]) => f.filter((x) => x.t === "txt").map((x) => x.s);

  it("código alternativo em destaque, CNA - descrição abaixo e EAN grande", () => {
    const { formas, avisos } = desenhar(
      {
        cna: "921173",
        ean: "7898590390969",
        alt: "106002",
        desc: "TAMPA PROTECAO CORREIA EXTERNA",
        marca: "",
      },
      rolo,
      medir,
    );
    expect(avisos).toEqual([]);
    const t = textos(formas);
    expect(t[0]).toBe("106002");
    expect(t.slice(1, -1).join(" ")).toBe("CNA 921173 - TAMPA PROTECAO CORREIA EXTERNA");
    expect(t.at(-1)).toBe("7898590390969");
    const destaque = formas[0];
    expect(destaque).toMatchObject({ t: "txt", b: true, pt: 11 });

    const barras = formas.filter((f) => f.t === "bar");
    const x0 = Math.min(...barras.map((b) => b.x));
    const x1 = Math.max(...barras.map((b) => b.x + b.w));
    expect(x1 - x0).toBeCloseTo(95 * 0.375, 5);
    expect((x0 + x1) / 2).toBeCloseTo(25, 5);
    for (const b of barras) {
      expect(b.y).toBeCloseTo(12.6, 5);
      expect(b.y + b.h).toBeCloseTo(25, 5);
      expect((b.w / 0.375) % 1).toBeCloseTo(0, 5);
    }
  });

  it("fornecedor ao lado do código alternativo, sem sair da etiqueta", () => {
    const { formas } = desenhar(
      { cna: "921173", ean: "7898590390969", alt: "106002", desc: "TAMPA", marca: "2M PLASTIC" },
      rolo,
      medir,
    );
    const [cod, forn] = formas;
    expect(cod).toMatchObject({ t: "txt", s: "106002", b: true, pt: 11 });
    expect(forn).toMatchObject({ t: "txt", s: "2M PLASTIC", y: cod?.t === "txt" ? cod.y : -1 });
    if (cod?.t === "txt" && forn?.t === "txt") {
      expect(forn.x).toBeGreaterThan(cod.x + medir(cod.s, cod.pt, true));
      expect(forn.x - 2.5 + medir(forn.s, forn.pt, false)).toBeLessThanOrEqual(larguraTexto);
    }
    // Fornecedor longo encolhe e, se preciso, termina com …
    const longo = desenhar(
      {
        cna: "1",
        ean: "",
        alt: "HC000399499",
        desc: "",
        marca: "FORNECEDOR COM NOME MUITO GRANDE LTDA",
      },
      rolo,
      medir,
    ).formas;
    const f2 = longo[1];
    expect(f2?.t === "txt" && f2.s.endsWith("…")).toBe(true);
    if (longo[0]?.t === "txt" && f2?.t === "txt")
      expect(f2.x - 2.5 + medir(f2.s, f2.pt, false)).toBeLessThanOrEqual(larguraTexto + 1e-9);
  });

  it("descrição longa fica em 2 linhas, cabe na etiqueta e termina com …", () => {
    const desc =
      "CHAVE ACIONADORA SETA C/ LAMPEJO FAROL C/ BUZINA C/ LIMPADOR C/ LAVADOR C/ ESGUICHO C/ TEMPOR. C/ COMP. BORDO C/ RETORNO AUT.";
    const { formas } = desenhar(
      { cna: "123456", ean: "7891234567895", alt: "AB-1", desc, marca: "" },
      rolo,
      medir,
    );
    const linhas = formas.filter((f) => f.t === "txt").slice(1, -1);
    expect(linhas).toHaveLength(2);
    for (const l of linhas)
      if (l.t === "txt") expect(medir(l.s, l.pt, false)).toBeLessThanOrEqual(larguraTexto);
    expect(linhas[1]?.t === "txt" && linhas[1].s.endsWith("…")).toBe(true);
    expect(linhas[0]?.t === "txt" && linhas[0].s.startsWith("CNA 123456 - CHAVE")).toBe(true);
  });

  it("descrição curta usa 1 linha e o código de barras sobe", () => {
    const { formas } = desenhar(
      { cna: "1", ean: "7896543210982", alt: "X9", desc: "FILTRO", marca: "" },
      rolo,
      medir,
    );
    expect(textos(formas)).toEqual(["X9", "CNA 1 - FILTRO", "7896543210982"]);
    expect(formas.find((f) => f.t === "bar")).toMatchObject({ y: 10 });
  });

  it("sem código alternativo o destaque é o CNA; sem EAN sai sem barras e avisa", () => {
    expect(
      textos(
        desenhar({ cna: "7", ean: "", alt: "", desc: "JUNTA", marca: "" }, rolo, medir).formas,
      ),
    ).toEqual(["CNA 7", "JUNTA"]);
    const semEan = desenhar({ cna: "2", ean: "", alt: "KT1", desc: "", marca: "" }, rolo, medir);
    expect(semEan.formas.some((f) => f.t === "bar")).toBe(false);
    expect(semEan.avisos).toHaveLength(1);
  });

  it("quebra de linha respeita o limite de linhas", () => {
    const q = quebrar("UM DOIS TRES QUATRO CINCO SEIS", 10, 7, medir, 2);
    expect(q.linhas).toHaveLength(2);
    expect(q.cortou).toBe(true);
  });
});

describe("rolo", () => {
  it("linha padrão do rolo tem 105 mm", () => {
    expect(larguraPagina(ROLO_PADRAO)).toBe(105);
  });
  it("corrige valores fora do limite", () => {
    expect(normRolo({ cols: 9, larg: "abc", alt: 5 })).toMatchObject({
      cols: 3,
      larg: 50,
      alt: 15,
    });
  });
});

describe("base de produtos", () => {
  it("lê CSV do Excel, ignora EAN em notação científica e acha por CNA ou EAN", () => {
    const linhas = parseCSV(
      "Código CNA;Cód. Alternativo;EAN\n00100245;ABC-4521;7891234567895\n100246;;7,89654E+12\n",
    );
    const m = adivinhar(linhas[0] ?? []);
    expect(m).toEqual({ cna: 0, alt: 1, ean: 2, desc: -1, marca: -1 });
    const b = montarBase(linhas, m);
    expect(b.total).toBe(2);
    expect(b.cientifica).toBe(1);
    expect(buscar(b, "100245")?.alt).toBe("ABC-4521");
    expect(buscar(b, "7891234567895")?.cna).toBe("00100245");
    expect(baseParaCSV(b)).toBe(
      "cna;ean;alternativo;descricao;marca\n00100245;7891234567895;ABC-4521;;\n100246;;;;\n",
    );
  });

  it("limpa caracteres invisíveis e descarta texto no lugar do EAN", () => {
    const b = montarBase(
      [
        ["cna", "ean", "alternativo"],
        ["1", "\u00a07899849808785", "A"],
        ["2", "\u00ad4041248904091", "B"],
        ["3", "8033573102941\t", "C"],
        ["4", "ESTAMOS AGUARDANDO INFORMAÇÃO MATRIZ", "D"],
        ["5", "AS640397001501", "E"],
      ],
      { cna: 0, ean: 1, alt: 2, desc: -1, marca: -1 },
    );
    expect(buscar(b, "1")?.ean).toBe("7899849808785");
    expect(buscar(b, "2")?.ean).toBe("4041248904091");
    expect(buscar(b, "3")?.ean).toBe("8033573102941");
    expect(buscar(b, "4")?.ean).toBe("");
    expect(buscar(b, "5")?.ean).toBe("AS640397001501");
    expect(b.invalidos).toBe(1);
  });

  it("lê a planilha da Rede ANCORA com descrição e limpa caracteres estranhos", () => {
    const linhas = [
      ["MARCA", "COD_ALTERNATIVO", "CNA", "COD_BARRAS", "DESCRICAO_PRODUTO"],
      ["2M PLASTIC", "106002", "921173", "7898590390969", "TAMPA\u00a0PROTECAO  CORREIA\u009d"],
    ];
    const m = adivinhar(linhas[0] ?? []);
    expect(m).toEqual({ cna: 2, alt: 1, ean: 3, desc: 4, marca: 0 });
    const b = montarBase(linhas, m);
    expect(buscar(b, "921173")).toEqual({
      cna: "921173",
      ean: "7898590390969",
      alt: "106002",
      desc: "TAMPA PROTECAO CORREIA",
      marca: "2M PLASTIC",
    });
    expect(b.comDesc).toBe(1);
    expect(baseParaCSV(b)).toBe(
      "cna;ean;alternativo;descricao;marca\n921173;7898590390969;106002;TAMPA PROTECAO CORREIA;2M PLASTIC\n",
    );
  });

  it("busca por CNA/EAN ou por código alternativo, com vários códigos separados por ;", () => {
    const b = montarBase(
      [
        ["MARCA", "COD_ALTERNATIVO", "CNA", "COD_BARRAS", "DESCRICAO_PRODUTO"],
        ["2M PLASTIC", "106002", "921173", "7898590390969", "TAMPA PROTECAO CORREIA EXTERNA"],
        ["INDISA", "106002", "146790", "7899999999994", "REPARO BOMBA AGUA KIT"],
        ["2M PLASTIC", "106003", "921174", "7898590391003", "TAMPA INFERIOR"],
      ],
      adivinhar(["MARCA", "COD_ALTERNATIVO", "CNA", "COD_BARRAS", "DESCRICAO_PRODUTO"]),
    );
    expect(separarCodigos(" 921173; 921174 ;;\n106003 ")).toEqual(["921173", "921174", "106003"]);

    const porCna = resolverCodigos(b, "cna", [
      { codigo: "921173", qtd: 2 },
      { codigo: "7898590391003", qtd: 1 },
      { codigo: "106002", qtd: 1 },
    ]);
    expect(porCna.achados).toEqual([
      { cna: "921173", qtd: 2 },
      { cna: "921174", qtd: 1 },
    ]);
    expect(porCna.faltam).toEqual(["106002"]);

    const porAlt = resolverCodigos(b, "alt", [
      { codigo: "106003", qtd: 3 },
      { codigo: "106002", qtd: 1 },
      { codigo: "7898590390969", qtd: 1 },
      { codigo: "999", qtd: 1 },
    ]);
    expect(porAlt.achados).toEqual([
      { cna: "921174", qtd: 3 },
      { cna: "921173", qtd: 1 },
    ]);
    expect(porAlt.escolher).toHaveLength(1);
    expect(porAlt.escolher[0]?.opcoes.map((p) => p.marca)).toEqual(["2M PLASTIC", "INDISA"]);
    expect(porAlt.faltam).toEqual(["999"]);
  });

  it("lê a lista colada do Excel", () => {
    expect(lerColagem("CNA\tQtd\n100245\t3\n100246 2\n200771")).toEqual([
      { cna: "100245", qtd: 3 },
      { cna: "100246", qtd: 2 },
      { cna: "200771", qtd: 1 },
    ]);
  });
});
