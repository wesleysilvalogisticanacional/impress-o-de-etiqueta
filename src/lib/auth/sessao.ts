// Cliente: só fala com o BFF. Nunca lê tokens nem claims OIDC.
export type Usuario = { id: string; email: string; name: string | null; role: string };

export const URL_LOGIN = "/api/public/oidc/login";

export async function buscarUsuario(): Promise<Usuario | null> {
  const r = await fetch("/api/public/oidc/me", { credentials: "include", cache: "no-store" });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error("Falha ao validar sessão");
  return (await r.json()) as Usuario;
}

export async function sair() {
  const r = await fetch("/api/public/oidc/signout", { method: "POST", credentials: "include" });
  const { logoutUrl } = (await r.json()) as { logoutUrl: string };
  sessionStorage.setItem("oidc_logout_pending", "1");
  window.location.replace(logoutUrl);
}
