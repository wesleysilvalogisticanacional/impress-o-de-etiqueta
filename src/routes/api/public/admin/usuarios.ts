import { createFileRoute } from "@tanstack/react-router";

import { adminDb, sessaoAtual } from "@/lib/auth/oidc.server";
import { ehPapel, nomeDoEmail, normalizarEmail, separarEmails } from "@/lib/auth/usuarios";

const SEM_CACHE = { "Cache-Control": "no-store" };
const erro = (status: number, mensagem: string) =>
  Response.json({ error: mensagem }, { status, headers: SEM_CACHE });

/** Só administradores ativos, com sessão válida, usam estas rotas. */
async function exigirAdmin(request: Request) {
  const s = await sessaoAtual(request);
  if (!s) return { resposta: erro(401, "Sessão expirada. Entre de novo.") };
  if (s.usuario.role !== "admin")
    return { resposta: erro(403, "Só administradores podem gerenciar os acessos.") };
  return { sessao: s };
}

const CAMPOS = "id, email, name, role, active, created_at, last_login";

export const Route = createFileRoute("/api/public/admin/usuarios")({
  server: {
    handlers: {
      /** Lista todos os acessos cadastrados. */
      GET: async ({ request }) => {
        const { resposta } = await exigirAdmin(request);
        if (resposta) return resposta;
        const db = await adminDb();
        const { data, error } = await db.from("users").select(CAMPOS).order("email");
        if (error) {
          console.error(error);
          return erro(500, "Não foi possível carregar os usuários.");
        }
        return Response.json(data, { headers: SEM_CACHE });
      },

      /** Libera um ou vários e-mails. Corpo: { email, name?, role? } ou { emails: "texto colado", role? }. */
      POST: async ({ request }) => {
        const { resposta } = await exigirAdmin(request);
        if (resposta) return resposta;
        const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!corpo) return erro(400, "Pedido inválido.");
        const role = ehPapel(corpo["role"]) ? corpo["role"] : "user";
        const db = await adminDb();

        if (typeof corpo["emails"] === "string") {
          const { validos, invalidos } = separarEmails(corpo["emails"]);
          if (!validos.length) return erro(400, "Nenhum e-mail @redeancora.com.br encontrado.");
          const { data: existentes } = await db.from("users").select("email").in("email", validos);
          const ja = new Set((existentes ?? []).map((u) => u.email.toLowerCase()));
          const novos = validos.filter((e) => !ja.has(e));
          if (novos.length) {
            const { error } = await db
              .from("users")
              .insert(novos.map((email) => ({ email, name: nomeDoEmail(email), role })));
            if (error) {
              console.error(error);
              return erro(500, "Não foi possível liberar os acessos.");
            }
          }
          return Response.json(
            { criados: novos.length, existentes: [...ja], invalidos },
            { headers: SEM_CACHE },
          );
        }

        const email = normalizarEmail(corpo["email"]);
        if (!email) return erro(400, "Use um e-mail @redeancora.com.br.");
        const nome = typeof corpo["name"] === "string" ? corpo["name"].trim().slice(0, 120) : "";
        const { data, error } = await db
          .from("users")
          .insert({ email, name: nome || nomeDoEmail(email), role })
          .select(CAMPOS)
          .single();
        if (error) {
          if (error.code === "23505") return erro(409, `${email} já tem acesso cadastrado.`);
          console.error(error);
          return erro(500, "Não foi possível liberar o acesso.");
        }
        return Response.json(data, { status: 201, headers: SEM_CACHE });
      },

      /** Altera nome, papel ou situação. Corpo: { id, name?, role?, active? }. */
      PATCH: async ({ request }) => {
        const { sessao, resposta } = await exigirAdmin(request);
        if (resposta) return resposta;
        const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const id = typeof corpo?.["id"] === "string" ? corpo["id"] : null;
        if (!corpo || !id) return erro(400, "Pedido inválido.");

        const mudancas: { name?: string; role?: string; active?: boolean } = {};
        if (typeof corpo["name"] === "string") mudancas.name = corpo["name"].trim().slice(0, 120);
        if (corpo["role"] !== undefined) {
          if (!ehPapel(corpo["role"])) return erro(400, "Papel inválido.");
          mudancas.role = corpo["role"];
        }
        if (typeof corpo["active"] === "boolean") mudancas.active = corpo["active"];
        if (!Object.keys(mudancas).length) return erro(400, "Nada para alterar.");

        // Ninguém tira o próprio acesso de administrador (evita ficar sem nenhum admin).
        if (id === sessao.usuario.id && (mudancas.active === false || mudancas.role === "user"))
          return erro(
            400,
            "Você não pode bloquear nem tirar o seu próprio acesso de administrador.",
          );

        const db = await adminDb();
        const { data, error } = await db
          .from("users")
          .update(mudancas)
          .eq("id", id)
          .select(CAMPOS)
          .maybeSingle();
        if (error) {
          console.error(error);
          return erro(500, "Não foi possível salvar a alteração.");
        }
        if (!data) return erro(404, "Usuário não encontrado.");
        // Bloqueado sai na hora: encerra as sessões abertas dele.
        if (mudancas.active === false) await db.from("app_sessions").delete().eq("user_id", id);
        return Response.json(data, { headers: SEM_CACHE });
      },
    },
  },
});
