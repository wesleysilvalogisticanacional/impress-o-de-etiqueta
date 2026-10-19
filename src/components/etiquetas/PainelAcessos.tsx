import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";

import { alterarUsuario, liberarUsuario, liberarVarios, listarUsuarios } from "@/lib/auth/admin";
import type { Usuario } from "@/lib/auth/sessao";
import { DOMINIO, PAPEIS, type Papel, type UsuarioCadastro } from "@/lib/auth/usuarios";

import { Cabecalho } from "./Cabecalho";

type Msg = { tipo: "ok" | "erro"; texto: string } | null;
const fmtN = (n: number) => n.toLocaleString("pt-BR");
const fmtData = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "Nunca entrou";

function Mensagem({ msg }: { msg: Msg }) {
  return (
    <div className="etq-msg" role="status" aria-live="polite">
      {msg && (msg.tipo === "erro" ? <span className="etq-erro-txt">{msg.texto}</span> : msg.texto)}
    </div>
  );
}

/** Painel de acesso: o administrador libera, bloqueia e define quem é administrador. */
export function PainelAcessos({ eu }: { eu: Usuario }) {
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ["usuarios"], queryFn: listarUsuarios, retry: false });
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<Papel>("user");
  const [emails, setEmails] = useState("");
  const [papelLote, setPapelLote] = useState<Papel>("user");
  const [filtro, setFiltro] = useState("");
  const [situacao, setSituacao] = useState<"todos" | "ativos" | "bloqueados">("todos");
  const [msg, setMsg] = useState<Msg>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const usuarios = lista.data ?? [];
  const ativos = usuarios.filter((u) => u.active).length;
  const admins = usuarios.filter((u) => u.active && u.role === "admin").length;

  const visiveis = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return usuarios.filter(
      (u) =>
        (situacao === "todos" || (situacao === "ativos" ? u.active : !u.active)) &&
        (!f || u.email.includes(f) || (u.name ?? "").toLowerCase().includes(f)),
    );
  }, [usuarios, filtro, situacao]);

  const atualizarLinha = (novo: UsuarioCadastro) =>
    qc.setQueryData<UsuarioCadastro[]>(["usuarios"], (atual) =>
      (atual ?? []).map((u) => (u.id === novo.id ? novo : u)),
    );

  async function aoLiberar(e: FormEvent) {
    e.preventDefault();
    const alvo = email.trim().toLowerCase();
    if (!alvo) return;
    if (!alvo.endsWith(DOMINIO)) {
      setMsg({ tipo: "erro", texto: `Use um e-mail ${DOMINIO}.` });
      return;
    }
    setOcupado("novo");
    try {
      const novo = await liberarUsuario(alvo, nome, papel);
      qc.setQueryData<UsuarioCadastro[]>(["usuarios"], (atual) =>
        [...(atual ?? []), novo].sort((a, b) => a.email.localeCompare(b.email)),
      );
      setMsg({ tipo: "ok", texto: `Acesso liberado para ${novo.email}.` });
      setEmail("");
      setNome("");
      setPapel("user");
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  async function aoLiberarVarios() {
    if (!emails.trim()) return;
    setOcupado("lote");
    try {
      const r = await liberarVarios(emails, papelLote);
      await qc.invalidateQueries({ queryKey: ["usuarios"] });
      const partes = [
        `${fmtN(r.criados)} ${r.criados === 1 ? "acesso liberado" : "acessos liberados"}.`,
      ];
      if (r.existentes.length) partes.push(`${r.existentes.length} já estavam cadastrados.`);
      if (r.invalidos.length)
        partes.push(
          `Ignorados por não serem ${DOMINIO}: ${r.invalidos.slice(0, 5).join(", ")}${r.invalidos.length > 5 ? "…" : ""}.`,
        );
      setMsg({ tipo: r.invalidos.length ? "erro" : "ok", texto: partes.join(" ") });
      setEmails("");
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  async function alterar(u: UsuarioCadastro, mudancas: { role?: Papel; active?: boolean }) {
    setOcupado(u.id);
    try {
      const novo = await alterarUsuario(u.id, mudancas);
      atualizarLinha(novo);
      setMsg({
        tipo: "ok",
        texto:
          mudancas.active === false
            ? `${novo.email} foi bloqueado e saiu do app.`
            : mudancas.active === true
              ? `${novo.email} pode entrar de novo.`
              : `${novo.email} agora é ${novo.role === "admin" ? "administrador" : "usuário"}.`,
      });
    } catch (err) {
      setMsg({ tipo: "erro", texto: (err as Error).message });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="etq-app">
      <Cabecalho />
      <main className="etq-main etq-main-uma">
        <div className="etq-col">
          <div className="etq-voltar">
            <Link to="/" className="etq-link">
              ← Voltar para as etiquetas
            </Link>
          </div>

          <section className="etq-cartao" aria-labelledby="t-acessos">
            <header>
              <h2 id="t-acessos">Painel de acesso</h2>
              <span className="etq-sec num">
                {fmtN(usuarios.length)} cadastrados · {fmtN(ativos)} ativos · {fmtN(admins)}{" "}
                {admins === 1 ? "administrador" : "administradores"}
              </span>
            </header>
            <p className="etq-sec">
              Quem entra com o ANCORA ID só usa o app se o e-mail estiver liberado aqui. Usuários
              imprimem etiquetas; administradores também gerenciam esta lista.
            </p>

            <form className="etq-acesso-form" onSubmit={aoLiberar} noValidate>
              <div className="etq-campo">
                <label htmlFor="novo-email">E-mail corporativo</label>
                <input
                  id="novo-email"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder={`nome.sobrenome${DOMINIO}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="etq-campo">
                <label htmlFor="novo-nome">Nome (opcional)</label>
                <input
                  id="novo-nome"
                  type="text"
                  autoComplete="off"
                  placeholder="Ex.: Filial Campinas – João"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div className="etq-campo">
                <label htmlFor="novo-papel">Papel</label>
                <select
                  id="novo-papel"
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as Papel)}
                >
                  {PAPEIS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="etq-btn" disabled={ocupado === "novo"}>
                {ocupado === "novo" ? "Liberando…" : "Liberar acesso"}
              </button>
            </form>
            <Mensagem msg={msg} />

            <details className="etq-detalhes">
              <summary>Liberar vários e-mails de uma vez</summary>
              <div className="etq-detalhes-in">
                <span className="etq-sec">
                  Cole os e-mails, um por linha ou separados por ";". Quem já estiver cadastrado é
                  ignorado.
                </span>
                <textarea
                  id="lote-emails"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder={`joao.silva${DOMINIO}\nmaria.souza${DOMINIO}`}
                />
                <div className="etq-acoes">
                  <select
                    id="lote-papel"
                    aria-label="Papel dos e-mails colados"
                    value={papelLote}
                    onChange={(e) => setPapelLote(e.target.value as Papel)}
                    style={{ width: "auto" }}
                  >
                    {PAPEIS.map((p) => (
                      <option key={p.valor} value={p.valor}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="etq-btn sec2"
                    onClick={() => void aoLiberarVarios()}
                    disabled={!emails.trim() || ocupado === "lote"}
                  >
                    {ocupado === "lote" ? "Liberando…" : "Liberar todos"}
                  </button>
                </div>
              </div>
            </details>
          </section>

          <section className="etq-cartao" aria-labelledby="t-lista-acessos">
            <header>
              <h2 id="t-lista-acessos">Quem tem acesso</h2>
              <div className="etq-modo" role="radiogroup" aria-label="Mostrar">
                {(
                  [
                    ["todos", "Todos"],
                    ["ativos", "Ativos"],
                    ["bloqueados", "Bloqueados"],
                  ] as const
                ).map(([v, n]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={situacao === v}
                    onClick={() => setSituacao(v)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </header>
            <div className="etq-campo">
              <label htmlFor="filtro-acesso">Procurar por nome ou e-mail</label>
              <input
                id="filtro-acesso"
                type="text"
                autoComplete="off"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>

            {lista.isPending ? (
              <div className="etq-vazio">
                <span>Carregando os acessos…</span>
              </div>
            ) : lista.isError ? (
              <div className="etq-aviso">{(lista.error as Error).message}</div>
            ) : !visiveis.length ? (
              <div className="etq-vazio">
                <strong>Ninguém encontrado</strong>
                <span>Libere o primeiro acesso no formulário acima.</span>
              </div>
            ) : (
              <div className="etq-tabela-wrap">
                <table className="etq-lista etq-acessos">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Papel</th>
                      <th>Situação</th>
                      <th>Último acesso</th>
                      <th>
                        <span className="sr-only">Ação</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((u) => {
                      const souEu = u.id === eu.id;
                      return (
                        <tr key={u.id} className={u.active ? "" : "bloq"}>
                          <td className="cna">
                            {u.name || "—"}
                            {souEu && <span className="etq-tag">você</span>}
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <select
                              id={`papel-${u.id}`}
                              aria-label={`Papel de ${u.email}`}
                              value={u.role}
                              disabled={souEu || ocupado === u.id}
                              onChange={(e) => void alterar(u, { role: e.target.value as Papel })}
                            >
                              {PAPEIS.map((p) => (
                                <option key={p.valor} value={p.valor}>
                                  {p.nome}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span className={`etq-situacao ${u.active ? "ativo" : "bloqueado"}`}>
                              {u.active ? "Ativo" : "Bloqueado"}
                            </span>
                          </td>
                          <td className="num">{fmtData(u.last_login)}</td>
                          <td>
                            {!souEu && (
                              <button
                                type="button"
                                className="etq-btn sec2 pequeno"
                                disabled={ocupado === u.id}
                                onClick={() => void alterar(u, { active: !u.active })}
                              >
                                {u.active ? "Bloquear" : "Reativar"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
