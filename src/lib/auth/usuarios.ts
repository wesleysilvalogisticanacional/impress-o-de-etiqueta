/** Regras do cadastro de acesso, usadas no servidor e na tela. */
export const DOMINIO = "@redeancora.com.br";

export const PAPEIS = [
  { valor: "user", nome: "Usuário" },
  { valor: "admin", nome: "Administrador" },
] as const;
export type Papel = (typeof PAPEIS)[number]["valor"];

export const ehPapel = (v: unknown): v is Papel => PAPEIS.some((p) => p.valor === v);

/** E-mail em minúsculas e sem espaços; só do domínio da Rede ANCORA. */
export function normalizarEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@redeancora\.com\.br$/.test(e)) return null;
  return e;
}

/** Vários e-mails colados: separados por linha, ";", "," ou espaço. */
export function separarEmails(texto: string): { validos: string[]; invalidos: string[] } {
  const validos: string[] = [];
  const invalidos: string[] = [];
  for (const parte of texto.split(/[\s;,]+/).filter(Boolean)) {
    const e = normalizarEmail(parte);
    if (e) {
      if (!validos.includes(e)) validos.push(e);
    } else invalidos.push(parte);
  }
  return { validos, invalidos };
}

/** Nome sugerido a partir do e-mail, para cadastro em lote: joao.silva@… vira "Joao Silva". */
export function nomeDoEmail(email: string): string {
  return (email.split("@")[0] ?? "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export type UsuarioCadastro = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  created_at: string;
  last_login: string | null;
};
