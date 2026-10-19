import { describe, expect, it } from "vitest";

import { ehPapel, nomeDoEmail, normalizarEmail, separarEmails } from "@/lib/auth/usuarios";

describe("regras do painel de acesso", () => {
  it("só aceita e-mail @redeancora.com.br, em minúsculas", () => {
    expect(normalizarEmail("  Felipe.Vieira@RedeAncora.com.br ")).toBe(
      "felipe.vieira@redeancora.com.br",
    );
    expect(normalizarEmail("alguem@gmail.com")).toBeNull();
    expect(normalizarEmail("x@redeancora.com.br.fake.com")).toBeNull();
    expect(normalizarEmail(42)).toBeNull();
  });

  it("separa e-mails colados, sem repetir, e aponta os inválidos", () => {
    expect(
      separarEmails(
        "joao.silva@redeancora.com.br; maria@redeancora.com.br\nJOAO.SILVA@redeancora.com.br, x@y.com",
      ),
    ).toEqual({
      validos: ["joao.silva@redeancora.com.br", "maria@redeancora.com.br"],
      invalidos: ["x@y.com"],
    });
  });

  it("sugere o nome a partir do e-mail e valida o papel", () => {
    expect(nomeDoEmail("joao.silva@redeancora.com.br")).toBe("Joao Silva");
    expect(ehPapel("admin")).toBe(true);
    expect(ehPapel("root")).toBe(false);
  });
});
