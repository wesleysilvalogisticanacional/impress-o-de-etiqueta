// Cliente da tela de acessos: só fala com /api/public/admin/usuarios (o servidor confere se é admin).
import type { Papel, UsuarioCadastro } from "./usuarios";

const URL = "/api/public/admin/usuarios";

async function pedir<T>(metodo: string, corpo?: unknown): Promise<T> {
  const init: RequestInit = { method: metodo, credentials: "include", cache: "no-store" };
  if (corpo !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(corpo);
  }
  const r = await fetch(URL, init);
  const json = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(json.error || "Não foi possível concluir. Tente de novo.");
  return json as T;
}

export const listarUsuarios = () => pedir<UsuarioCadastro[]>("GET");

export const liberarUsuario = (email: string, name: string, role: Papel) =>
  pedir<UsuarioCadastro>("POST", { email, name, role });

export const liberarVarios = (emails: string, role: Papel) =>
  pedir<{ criados: number; existentes: string[]; invalidos: string[] }>("POST", { emails, role });

export const alterarUsuario = (
  id: string,
  mudancas: { name?: string; role?: Papel; active?: boolean },
) => pedir<UsuarioCadastro>("PATCH", { id, ...mudancas });
