import { describe, expect, it } from "vitest";

import { chave, codificar, desenhar, eanOk } from "@/lib/etiquetas/codigos";
import {
  adivinhar,
  baseParaCSV,
  buscar,
  lerColagem,
  montarBase,
  parseCSV,
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

  it("EAN grande com módulo de 0,375 mm, centralizado e dentro da etiqueta", () => {
    const { formas, avisos } = desenhar(
      { cna: "100245", ean: "7891234567895", alt: "ABC-4521" },
      rolo,
    );
    expect(avisos).toEqual([]);
    const barras = formas.filter((f) => f.t === "bar");
    const x0 = Math.min(...barras.map((b) => b.x));
    const x1 = Math.max(...barras.map((b) => b.x + b.w));
    expect(x1 - x0).toBeCloseTo(95 * 0.375, 5);
    expect((x0 + x1) / 2).toBeCloseTo(25, 5);
    for (const b of barras) {
      expect(b.y).toBeCloseTo(11.6, 5);
      expect(b.h).toBeCloseTo(13, 5);
      expect((b.w / 0.375) % 1).toBeCloseTo(0, 5);
    }
    const textos = formas.filter((f) => f.t === "txt").map((f) => f.s);
    expect(textos).toEqual(["CNA 100245", "Ref.: ABC-4521", "7891234567895"]);
  });

  it("sem referência o código sobe e cresce; sem EAN sai sem barras e avisa", () => {
    const semRef = desenhar({ cna: "1", ean: "7896543210982", alt: "" }, rolo).formas.find(
      (f) => f.t === "bar",
    );
    expect(semRef).toMatchObject({ y: 8.2 });
    const semEan = desenhar({ cna: "2", ean: "", alt: "KT1" }, rolo);
    expect(semEan.formas.some((f) => f.t === "bar")).toBe(false);
    expect(semEan.avisos).toHaveLength(1);
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
    expect(m).toEqual({ cna: 0, alt: 1, ean: 2 });
    const b = montarBase(linhas, m);
    expect(b.total).toBe(2);
    expect(b.cientifica).toBe(1);
    expect(buscar(b, "100245")?.alt).toBe("ABC-4521");
    expect(buscar(b, "7891234567895")?.cna).toBe("00100245");
    expect(baseParaCSV(b)).toBe("cna;ean;alternativo\n00100245;7891234567895;ABC-4521\n100246;;\n");
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
      { cna: 0, ean: 1, alt: 2 },
    );
    expect(buscar(b, "1")?.ean).toBe("7899849808785");
    expect(buscar(b, "2")?.ean).toBe("4041248904091");
    expect(buscar(b, "3")?.ean).toBe("8033573102941");
    expect(buscar(b, "4")?.ean).toBe("");
    expect(buscar(b, "5")?.ean).toBe("AS640397001501");
    expect(b.invalidos).toBe(1);
  });

  it("lê a lista colada do Excel", () => {
    expect(lerColagem("CNA\tQtd\n100245\t3\n100246 2\n200771")).toEqual([
      { cna: "100245", qtd: 3 },
      { cna: "100246", qtd: 2 },
      { cna: "200771", qtd: 1 },
    ]);
  });
});
