import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { guardar, ler } from "@/lib/etiquetas/armazenamento";
import { chave, desenhar, type Forma, type Produto } from "@/lib/etiquetas/codigos";
import { medirTexto } from "@/lib/etiquetas/medir";
import {
  abrirArquivoBase,
  adivinhar,
  arquivoParaPublicar,
  buscar,
  EXEMPLO,
  lerColagem,
  lerPlanilha,
  montarBase,
  parseCSV,
  type Base,
  type Mapa,
} from "@/lib/etiquetas/planilha";
import { larguraPagina, mmTxt, normRolo, ROLO_PADRAO, type Rolo } from "@/lib/etiquetas/rolo";

import { Cabecalho } from "./Cabecalho";
import { EtiquetaSvg } from "./EtiquetaSvg";

/**
 * Base publicada para todas as filiais, na pasta public do repositório.
 * Primeiro o arquivo compactado; o CSV puro fica como reserva.
 */
const ARQUIVOS_BASE = ["/base_produtos.csv.gz", "/base_produtos.csv"];
const MAPA_PADRAO: Mapa = { cna: 0, ean: 1, alt: 2, desc: 3 };

type Origem = "publicada" | "local" | "exemplo";
type BaseCarregada = Base & {
  origem: Origem;
  nome?: string | undefined;
  quando?: string | null | undefined;
};
type Item = { cna: string; qtd: number };
type Msg = { tipo: "ok" | "erro"; texto: string } | null;
type Importacao = { nome: string; linhas: string[][]; mapa: Mapa };

const fmtN = (n: number) => n.toLocaleString("pt-BR");
const limitarQtd = (v: unknown) => Math.max(1, Math.min(999, parseInt(String(v), 10) || 1));
const AMOSTRA: Produto = {
  cna: "921173",
  ean: "7898590390969",
  alt: "106002",
  desc: "TAMPA PROTECAO CORREIA EXTERNA",
};

function Mensagem({ msg }: { msg: Msg }) {
  return (
    <div className="etq-msg" role="status" aria-live="polite">
      {msg && (msg.tipo === "erro" ? <span className="etq-erro-txt">{msg.texto}</span> : msg.texto)}
    </div>
  );
}

/** Campo numérico que só aplica o valor ao sair do campo ou apertar Enter. */
function CampoNumero(props: {
  id: string;
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo?: number;
  desativado?: boolean;
  aoMudar: (v: string) => void;
}) {
  const [txt, setTxt] = useState(String(props.valor));
  useEffect(() => setTxt(String(props.valor)), [props.valor]);
  return (
    <div className="etq-campo">
      <label htmlFor={props.id}>{props.rotulo}</label>
      <input
        id={props.id}
        type="number"
        className="num"
        min={props.min}
        max={props.max}
        step={props.passo ?? 0.5}
        value={txt}
        disabled={props.desativado}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => props.aoMudar(txt)}
        onKeyDown={(e) => e.key === "Enter" && props.aoMudar(txt)}
      />
    </div>
  );
}

export function EtiquetasApp() {
  const [base, setBase] = useState<BaseCarregada | null>(null);
  const [estadoBase, setEstadoBase] = useState<"carregando" | "vazia" | "erro" | "pronta">(
    "carregando",
  );
  const [itens, setItens] = useState<Item[]>([]);
  const [sel, setSel] = useState(-1);
  const [rolo, setRolo] = useState<Rolo>(ROLO_PADRAO);
  const [pronto, setPronto] = useState(false);
  const [busca, setBusca] = useState("");
  const [qtd, setQtd] = useState("1");
  const [msgBusca, setMsgBusca] = useState<Msg>(null);
  const [colar, setColar] = useState("");
  const [imp, setImp] = useState<Importacao | null>(null);
  const [msgBase, setMsgBase] = useState<Msg>(null);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);
  const [paginas, setPaginas] = useState<Forma[][][] | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const arqRef = useRef<HTMLInputElement>(null);

  /* Lista e medidas do rolo ficam guardadas neste computador. */
  useEffect(() => {
    const salvos = ler<Item[]>("etq.lista", []);
    const lista = Array.isArray(salvos)
      ? salvos
          .filter((x) => x && x.cna)
          .map((x) => ({ cna: String(x.cna), qtd: limitarQtd(x.qtd) }))
      : [];
    setItens(lista);
    setSel(lista.length ? 0 : -1);
    setRolo(normRolo(ler("etq.rolo", ROLO_PADRAO)));
    setPronto(true);
  }, []);
  useEffect(() => {
    if (pronto) guardar("etq.lista", itens);
  }, [itens, pronto]);
  useEffect(() => {
    if (pronto) guardar("etq.rolo", rolo);
  }, [rolo, pronto]);

  /* Base publicada. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        let achou: { r: Response; txt: string; nome: string } | null = null;
        for (const arq of ARQUIVOS_BASE) {
          const r = await fetch(arq, { cache: "no-cache" });
          if (!r.ok) continue;
          const txt = await abrirArquivoBase(await r.arrayBuffer());
          // Endereço inexistente pode devolver a própria página (HTML): pula para o próximo.
          if (txt.trimStart().startsWith("<")) continue;
          achou = { r, txt, nome: arq.slice(1) };
          break;
        }
        if (!achou) {
          if (vivo) setEstadoBase("vazia");
          return;
        }
        const { r, txt, nome } = achou;
        const linhas = parseCSV(txt);
        const m = linhas[0] ? adivinhar(linhas[0]) : MAPA_PADRAO;
        const b = montarBase(linhas, m.cna < 0 ? MAPA_PADRAO : m, m.cna >= 0);
        if (!vivo) return;
        if (!b.total) {
          setEstadoBase("vazia");
          return;
        }
        setBase((atual) =>
          atual && atual.origem !== "publicada"
            ? atual
            : {
                ...b,
                origem: "publicada",
                nome,
                quando: r.headers.get("last-modified"),
              },
        );
        setEstadoBase("pronta");
      } catch {
        if (vivo) setEstadoBase("erro");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const produto = (cna: string) => base?.byCna.get(chave(cna)) ?? null;

  function adicionar(novos: Item[]) {
    const lista = [...itens];
    let ultimo = sel;
    for (const { cna, qtd: q } of novos) {
      const k = chave(cna);
      const i = lista.findIndex((it) => chave(it.cna) === k);
      if (i >= 0) {
        const atual = lista[i] as Item;
        lista[i] = { ...atual, qtd: Math.min(999, atual.qtd + q) };
        ultimo = i;
      } else {
        lista.push({ cna, qtd: q });
        ultimo = lista.length - 1;
      }
    }
    setItens(lista);
    setSel(ultimo);
  }

  function aoAdicionar(e: FormEvent) {
    e.preventDefault();
    const txt = busca.trim();
    if (!txt) return;
    const q = limitarQtd(qtd);
    if (!base) {
      setMsgBusca({ tipo: "erro", texto: "Carregue a base de produtos antes de adicionar." });
      return;
    }
    const p = buscar(base, txt);
    if (!p) {
      setMsgBusca({ tipo: "erro", texto: `"${txt}" não está na base de produtos.` });
      buscaRef.current?.select();
      return;
    }
    adicionar([{ cna: p.cna, qtd: q }]);
    setMsgBusca({
      tipo: "ok",
      texto: `CNA ${p.cna} adicionado (${q} ${q > 1 ? "etiquetas" : "etiqueta"}).`,
    });
    setBusca("");
    setQtd("1");
    buscaRef.current?.focus();
  }

  function aoColar() {
    const linhas = lerColagem(colar);
    const ok: Item[] = [];
    const faltam: string[] = [];
    for (const l of linhas) {
      const p = base ? buscar(base, l.cna) : null;
      if (base && !p) faltam.push(l.cna);
      else ok.push({ cna: p ? p.cna : l.cna, qtd: l.qtd });
    }
    if (ok.length) adicionar(ok);
    if (faltam.length) {
      const resto = faltam.length > 8 ? ` e mais ${faltam.length - 8}` : "";
      setMsgBusca({
        tipo: "erro",
        texto: `${ok.length} adicionados. Não estão na base: ${faltam.slice(0, 8).join(", ")}${resto}.`,
      });
    } else
      setMsgBusca({
        tipo: "ok",
        texto: `${ok.length} ${ok.length === 1 ? "produto adicionado" : "produtos adicionados"}.`,
      });
    if (ok.length) setColar("");
  }

  function limpar() {
    if (!confirmarLimpar) {
      setConfirmarLimpar(true);
      setTimeout(() => setConfirmarLimpar(false), 3000);
      return;
    }
    setConfirmarLimpar(false);
    setItens([]);
    setSel(-1);
  }

  /* Importar um arquivo de base (para usar nesta tela ou preparar a publicação). */
  async function abrirArquivo(file: File) {
    setMsgBase(null);
    try {
      const linhas = await lerPlanilha(file);
      if (linhas.length < 2)
        throw new Error(
          "O arquivo não tem linhas de produtos. A primeira linha deve ser o cabeçalho.",
        );
      setImp({ nome: file.name, linhas, mapa: adivinhar(linhas[0] ?? []) });
    } catch (e) {
      setMsgBase({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Não foi possível ler o arquivo.",
      });
    }
  }
  const baseImp = useMemo(() => (imp ? montarBase(imp.linhas, imp.mapa) : null), [imp]);
  const impBloqueado =
    !imp || !baseImp || (imp.mapa.ean < 0 && imp.mapa.alt < 0) || baseImp.total === 0;

  function fecharImportacao() {
    setImp(null);
    if (arqRef.current) arqRef.current.value = "";
  }
  function usarImportada() {
    if (!imp || !baseImp) return;
    setBase({ ...baseImp, origem: "local", nome: imp.nome, quando: null });
    setMsgBase({
      tipo: "ok",
      texto: "Base carregada nesta tela. Ela não é enviada para as outras filiais.",
    });
    fecharImportacao();
  }
  async function baixarParaPublicar() {
    if (!baseImp) return;
    const { nome, blob } = await arquivoParaPublicar(baseImp);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsgBase({
      tipo: "ok",
      texto: `Arquivo ${nome} baixado com ${fmtN(baseImp.total)} produtos. Envie para a pasta public do GitHub para publicar.`,
    });
  }
  function usarExemplo() {
    setBase({
      ...montarBase(EXEMPLO, MAPA_PADRAO),
      origem: "exemplo",
      nome: undefined,
      quando: null,
    });
    if (!itens.length) {
      setItens([
        { cna: "100245", qtd: 2 },
        { cna: "100246", qtd: 1 },
        { cna: "200771", qtd: 1 },
      ]);
      setSel(0);
    }
  }

  /* Impressão direta: cada página é uma linha do rolo. */
  const imprimiveis = itens
    .map((it) => ({ p: produto(it.cna), qtd: it.qtd }))
    .filter((x): x is { p: Produto; qtd: number } => !!x.p && !!(x.p.ean || x.p.alt));
  const totalEtiquetas = imprimiveis.reduce((s, x) => s + x.qtd, 0);

  function imprimir() {
    const fila: Forma[][] = [];
    for (const { p, qtd: q } of imprimiveis) {
      const { formas } = desenhar(p, rolo, medirTexto);
      for (let k = 0; k < q; k++) fila.push(formas);
    }
    const pags: Forma[][][] = [];
    for (let i = 0; i < fila.length; i += rolo.cols) pags.push(fila.slice(i, i + rolo.cols));
    setPaginas(pags);
  }
  useEffect(() => {
    if (!paginas) return;
    const fim = () => setPaginas(null);
    window.addEventListener("afterprint", fim, { once: true });
    let id2 = 0;
    const id = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(id2);
      window.removeEventListener("afterprint", fim);
    };
  }, [paginas]);

  function mudarRolo(campo: keyof Rolo, v: string) {
    setRolo((r) => normRolo({ ...r, [campo]: v }));
  }

  /* Textos derivados. */
  const W = larguraPagina(rolo);
  const itemSel = itens[sel];
  const pSel = itemSel ? produto(itemSel.cna) : null;
  const previa = desenhar(pSel ?? AMOSTRA, rolo, medirTexto);
  const linhas = Math.ceil(totalEtiquetas / rolo.cols);
  let totalLista = 0;
  let prodLista = 0;
  let fora = 0;
  for (const it of itens) {
    if (produto(it.cna)) {
      totalLista += it.qtd;
      prodLista++;
    } else fora++;
  }

  const situacao = (() => {
    if (base) {
      const origem = {
        publicada: "Base publicada",
        local: "Base do computador (só nesta tela)",
        exemplo: "Base de exemplo",
      }[base.origem];
      const partes: string[] = [];
      if (base.quando) {
        const d = new Date(base.quando);
        if (!Number.isNaN(d.getTime()))
          partes.push(
            "atualizada em " +
              d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
          );
      }
      if (base.nome && base.origem === "local") partes.push(base.nome);
      partes.push(
        `${fmtN(base.comEan)} com EAN · ${fmtN(base.comAlt)} com código alternativo · ${fmtN(base.comDesc)} com descrição`,
      );
      return {
        ponto: "ok",
        titulo: origem,
        total: base.total,
        exemplo: base.origem === "exemplo",
        detalhe: partes.join(" · "),
      };
    }
    if (estadoBase === "carregando")
      return {
        ponto: "esperando",
        titulo: "Carregando a base de produtos…",
        detalhe: "Isso leva alguns segundos na primeira vez.",
      };
    if (estadoBase === "erro")
      return {
        ponto: "erro",
        titulo: "Base indisponível",
        detalhe:
          "Não foi possível baixar a base publicada. Recarregue a página; se continuar, use um arquivo do computador.",
      };
    return {
      ponto: "",
      titulo: "Nenhuma base publicada ainda",
      detalhe:
        "Use um arquivo do computador ou publique a base para todas as filiais (veja abaixo como).",
    };
  })();

  return (
    <>
      <div className="etq-app">
        <Cabecalho />
        <main className="etq-main">
          <div className="etq-col">
            {/* Base de produtos */}
            <section className="etq-cartao" aria-label="Base de produtos">
              <div className="etq-base">
                <div className="etq-base-info">
                  <span className={`etq-ponto ${situacao.ponto}`} aria-hidden="true" />
                  <div className="etq-base-txt">
                    <strong>
                      {situacao.titulo}
                      {"total" in situacao && situacao.total !== undefined && (
                        <>
                          {" · "}
                          <span className="num">{fmtN(situacao.total)}</span> produtos
                        </>
                      )}
                      {"exemplo" in situacao && situacao.exemplo && (
                        <span className="etq-tag">exemplo</span>
                      )}
                    </strong>
                    <span className="etq-sec">{situacao.detalhe}</span>
                  </div>
                </div>
                <div className="etq-base-acoes">
                  <button
                    type="button"
                    className="etq-btn sec2"
                    onClick={() => arqRef.current?.click()}
                  >
                    Abrir arquivo da base
                  </button>
                  {base?.origem !== "publicada" && (
                    <button type="button" className="etq-link" onClick={usarExemplo}>
                      Testar com exemplo
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={arqRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xlsm"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void abrirArquivo(f);
                }}
              />

              {imp && baseImp && (
                <div className="etq-cartao" style={{ padding: 14 }}>
                  <header>
                    <h3 style={{ fontSize: 16 }}>Conferir colunas de {imp.nome}</h3>
                    <span className="etq-sec num">{fmtN(imp.linhas.length - 1)} linhas</span>
                  </header>
                  <div className="etq-mapa">
                    {(
                      [
                        ["cna", "Coluna do CNA", false],
                        ["ean", "Coluna do EAN", true],
                        ["alt", "Coluna do código alternativo", true],
                        ["desc", "Coluna da descrição", true],
                      ] as const
                    ).map(([campo, rotulo, opcional]) => (
                      <div className="etq-campo" key={campo}>
                        <label htmlFor={`map-${campo}`}>{rotulo}</label>
                        <select
                          id={`map-${campo}`}
                          value={String(imp.mapa[campo] >= 0 ? imp.mapa[campo] : opcional ? -1 : 0)}
                          onChange={(e) =>
                            setImp({
                              ...imp,
                              mapa: { ...imp.mapa, [campo]: Number(e.target.value) },
                            })
                          }
                        >
                          {opcional && <option value="-1">— nenhuma —</option>}
                          {(imp.linhas[0] ?? []).map((c, i) => (
                            <option key={i} value={String(i)}>
                              {c || `Coluna ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="etq-tabela-wrap">
                    <table className="etq-amostra">
                      <thead>
                        <tr>
                          <th>CNA</th>
                          <th>Cód. alternativo</th>
                          <th>Descrição</th>
                          <th>EAN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...baseImp.byCna.values()].slice(0, 3).map((p) => (
                          <tr key={p.cna}>
                            <td>{p.cna}</td>
                            <td>{p.alt || "—"}</td>
                            <td className="desc" title={p.desc}>
                              {p.desc || "—"}
                            </td>
                            <td>{p.ean || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(baseImp.cientifica > 0 ||
                    baseImp.invalidos > 0 ||
                    (imp.mapa.ean < 0 && imp.mapa.alt < 0)) && (
                    <div className="etq-aviso">
                      {imp.mapa.ean < 0 && imp.mapa.alt < 0 && (
                        <div>Escolha pelo menos uma coluna de código: EAN ou alternativo.</div>
                      )}
                      {baseImp.cientifica > 0 && (
                        <div>
                          {fmtN(baseImp.cientifica)} EAN(s) estão no formato 7,89E+12 e foram
                          perdidos. No Excel, formate a coluna EAN como Texto antes de salvar, ou
                          abra o arquivo .xlsx.
                        </div>
                      )}
                      {baseImp.invalidos > 0 && (
                        <div>
                          {fmtN(baseImp.invalidos)} EAN(s) têm texto em vez de código (ex.: frase ou
                          palavra com acento) e esses produtos ficaram sem código de barras. Corrija
                          na planilha se precisar imprimir.
                        </div>
                      )}
                    </div>
                  )}
                  <div className="etq-acoes">
                    <button
                      type="button"
                      className="etq-btn sec2"
                      disabled={impBloqueado}
                      onClick={usarImportada}
                    >
                      Usar nesta tela
                    </button>
                    <button
                      type="button"
                      className="etq-btn"
                      disabled={impBloqueado}
                      onClick={baixarParaPublicar}
                    >
                      Baixar arquivo para publicar
                    </button>
                    <button type="button" className="etq-link" onClick={fecharImportacao}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              {msgBase && (
                <div className={msgBase.tipo === "erro" ? "etq-aviso" : "etq-ok"}>
                  {msgBase.texto}
                </div>
              )}

              <details className="etq-detalhes">
                <summary>Como publicar a base para todas as filiais</summary>
                <ol className="etq-passos">
                  <li>
                    Clique em <b>Abrir arquivo da base</b> e escolha a exportação do sistema (CSV ou
                    Excel) com CNA, EAN, código alternativo e descrição.
                  </li>
                  <li>
                    Confira as colunas e clique em <b>Baixar arquivo para publicar</b>. Sai um
                    arquivo <b>base_produtos.csv.gz</b> (a base compactada).
                  </li>
                  <li>
                    No GitHub, abra a pasta <b>public</b> do repositório, clique em{" "}
                    <b>Add file › Upload files</b>, envie o <b>base_produtos.csv.gz</b> (ele
                    substitui o anterior) e confirme em <b>Commit changes</b>.
                  </li>
                  <li>
                    No Lovable, clique em <b>Publish › Update</b> para o site publicado passar a
                    usar a base nova.
                  </li>
                </ol>
              </details>
            </section>

            {/* Adicionar produtos */}
            <section className="etq-cartao" aria-labelledby="t-add">
              <header>
                <h2 id="t-add">Adicionar produtos</h2>
                <span className="etq-sec">Digite ou bipe o código e aperte Enter</span>
              </header>
              <form className="etq-linha-add" onSubmit={aoAdicionar} noValidate>
                <div className="etq-campo">
                  <label htmlFor="busca">CNA ou código de barras</label>
                  <input
                    ref={buscaRef}
                    id="busca"
                    type="text"
                    autoComplete="off"
                    autoFocus
                    placeholder="Ex.: 100245"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
                <div className="etq-campo">
                  <label htmlFor="qtd">Etiquetas</label>
                  <input
                    id="qtd"
                    type="number"
                    min={1}
                    max={999}
                    className="num"
                    value={qtd}
                    onChange={(e) => setQtd(e.target.value)}
                  />
                </div>
                <button type="submit" className="etq-btn">
                  Adicionar
                </button>
              </form>
              <Mensagem msg={msgBusca} />
              <details className="etq-detalhes">
                <summary>Colar uma lista do Excel</summary>
                <div className="etq-detalhes-in">
                  <span className="etq-sec">
                    Copie duas colunas do Excel, CNA e quantidade, e cole aqui. Uma linha por
                    produto.
                  </span>
                  <textarea
                    id="colar"
                    value={colar}
                    onChange={(e) => setColar(e.target.value)}
                    placeholder={"100245\t3\n100246\t1\n200771\t10"}
                  />
                  <div className="etq-acoes">
                    <button
                      type="button"
                      className="etq-btn sec2"
                      onClick={aoColar}
                      disabled={!colar.trim()}
                    >
                      Adicionar à lista
                    </button>
                  </div>
                </div>
              </details>
            </section>

            {/* Lista */}
            <section className="etq-cartao" aria-labelledby="t-lista">
              <header>
                <h2 id="t-lista">Lista para imprimir</h2>
                {itens.length > 0 && (
                  <button type="button" className="etq-link" onClick={limpar}>
                    {confirmarLimpar ? "Clique de novo para limpar" : "Limpar lista"}
                  </button>
                )}
              </header>
              {!itens.length ? (
                <div className="etq-vazio">
                  <strong>A lista está vazia</strong>
                  <span>
                    Digite ou bipe um CNA acima. Cada produto vira uma etiqueta com o CNA, a
                    referência e o código de barras do EAN.
                  </span>
                </div>
              ) : (
                <>
                  <div className="etq-tabela-wrap">
                    <table className="etq-lista">
                      <thead>
                        <tr>
                          <th>Cód. alternativo</th>
                          <th>CNA</th>
                          <th>Descrição</th>
                          <th>EAN</th>
                          <th>Etiquetas</th>
                          <th>
                            <span className="sr-only">Tirar</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((it, i) => {
                          const p = produto(it.cna);
                          return (
                            <tr
                              key={it.cna}
                              className={i === sel ? "sel" : ""}
                              onClick={(e) =>
                                !(e.target as HTMLElement).closest("input,button") && setSel(i)
                              }
                            >
                              {p ? (
                                <>
                                  <td className="cna">{p.alt || "—"}</td>
                                  <td>{it.cna}</td>
                                  <td className="desc" title={p.desc}>
                                    {p.desc || "—"}
                                  </td>
                                  <td>{p.ean || <span className="etq-chip">sem EAN</span>}</td>
                                </>
                              ) : (
                                <td colSpan={4}>
                                  <b>{it.cna}</b>{" "}
                                  <span className="etq-chip">
                                    {base ? "Não está na base" : "Aguardando a base"}
                                  </span>
                                </td>
                              )}
                              <td>
                                <input
                                  type="number"
                                  min={1}
                                  max={999}
                                  id={`q-${i}`}
                                  aria-label={`Etiquetas do CNA ${it.cna}`}
                                  value={it.qtd}
                                  onChange={(e) => {
                                    const lista = [...itens];
                                    lista[i] = { ...it, qtd: limitarQtd(e.target.value) };
                                    setItens(lista);
                                  }}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="etq-tirar"
                                  aria-label={`Tirar CNA ${it.cna} da lista`}
                                  title="Tirar da lista"
                                  onClick={() => {
                                    setItens(itens.filter((_, k) => k !== i));
                                    if (sel >= i) setSel(Math.max(-1, sel - 1));
                                  }}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <span className="etq-totais num">
                    <b>{fmtN(totalLista)}</b> {totalLista === 1 ? "etiqueta" : "etiquetas"} ·{" "}
                    {prodLista} {prodLista === 1 ? "produto" : "produtos"}
                    {fora > 0 && (
                      <>
                        {" · "}
                        <span className="etq-erro-txt">{fora} fora da base</span>
                      </>
                    )}
                  </span>
                </>
              )}
            </section>
          </div>

          <aside className="etq-col etq-lateral">
            <section className="etq-cartao" aria-labelledby="t-etq">
              <header>
                <h2 id="t-etq">Etiqueta</h2>
                <span className="etq-rotulo num">
                  {mmTxt(rolo.larg)} × {mmTxt(rolo.alt)} mm
                </span>
              </header>
              <div className="etq-palco">
                <div
                  className="etq-folha"
                  role="img"
                  aria-label="Prévia da etiqueta"
                  style={{ aspectRatio: `${rolo.larg} / ${rolo.alt}` }}
                >
                  {/* Só depois de abrir no navegador: a quebra de linha usa a fonte real. */}
                  {pronto && <EtiquetaSvg formas={previa.formas} rolo={rolo} />}
                </div>
              </div>
              <p className="etq-legenda">
                {!pSel ? (
                  itens.length ? (
                    "Clique num produto da lista para ver a etiqueta dele."
                  ) : (
                    "Modelo da etiqueta com códigos de exemplo."
                  )
                ) : previa.avisos.length ? (
                  <span className="etq-erro-txt">{previa.avisos.join(". ")}.</span>
                ) : (
                  `CNA ${pSel.cna} · ${itemSel?.qtd ?? 0} ${itemSel?.qtd === 1 ? "etiqueta" : "etiquetas"}`
                )}
              </p>
              <button
                type="button"
                className="etq-btn grande"
                disabled={!totalEtiquetas}
                onClick={imprimir}
              >
                {totalEtiquetas ? `Imprimir (${fmtN(totalEtiquetas)})` : "Imprimir"}
              </button>
              {totalEtiquetas > 0 && (
                <span className="etq-sec" style={{ textAlign: "center" }}>
                  {linhas} {linhas === 1 ? "linha" : "linhas"} do rolo · papel {mmTxt(W)} ×{" "}
                  {mmTxt(rolo.alt)} mm
                </span>
              )}
            </section>

            <section className="etq-cartao" aria-labelledby="t-imp">
              <header>
                <h2 id="t-imp">Como imprimir</h2>
              </header>
              <ol className="etq-passos">
                <li>
                  Clique em <b>Imprimir</b> e escolha a <b>Argox</b>.
                </li>
                <li>
                  Em <b>Tamanho do papel</b>, escolha o papel de etiqueta criado no driver (ex.:{" "}
                  <b>
                    Etiqueta {mmTxt(W)}x{mmTxt(rolo.alt)}
                  </b>
                  ) e deixe a escala em <b>100%</b>. Não use "Ajustar à página" e desmarque
                  cabeçalhos e rodapés.
                </li>
              </ol>
              <p className="etq-sec">
                Sobrou etiqueta em branco entre uma linha e outra? A impressão usou outro papel, em
                geral o padrão de 4 × 6 polegadas. Escolha o papel de etiqueta e imprima de novo.
              </p>
              <details className="etq-detalhes">
                <summary>Primeira vez neste computador</summary>
                <ol className="etq-passos">
                  <li>Instale o driver da Argox para Windows (OS-2140 ou OS-214plus).</li>
                  <li>
                    Em <b>Configurações › Impressoras e scanners</b>, abra a Argox, vá em{" "}
                    <b>Preferências de impressão</b> e crie um papel novo de{" "}
                    <b className="num">
                      {mmTxt(W)} mm de largura × {mmTxt(rolo.alt)} mm de altura
                    </b>
                    , tipo <b>Etiquetas cortadas com molde</b>. Deixe esse papel como padrão.
                  </li>
                  <li>
                    Calibre a impressora para ela achar o início de cada etiqueta (em geral, segurar
                    o botão FEED até ela puxar algumas etiquetas e parar).
                  </li>
                  <li>
                    Imprima uma linha e teste o código com o leitor. Se sair clara, aumente a
                    escuridão nas preferências.
                  </li>
                </ol>
              </details>
              <details className="etq-detalhes">
                <summary>Medidas do rolo</summary>
                <div className="etq-papel">
                  {rolo.cols} {rolo.cols === 1 ? "etiqueta" : "etiquetas"} de {mmTxt(rolo.larg)} ×{" "}
                  {mmTxt(rolo.alt)} mm por linha. Papel no driver da Argox:{" "}
                  <b className="num">
                    {mmTxt(W)} × {mmTxt(rolo.alt)} mm
                  </b>
                  , vão de {mmTxt(rolo.gap)} mm.
                </div>
                <div className="etq-rolo">
                  <CampoNumero
                    id="rolo-larg"
                    rotulo="Largura da etiqueta (mm)"
                    valor={rolo.larg}
                    min={20}
                    max={120}
                    aoMudar={(v) => mudarRolo("larg", v)}
                  />
                  <CampoNumero
                    id="rolo-alt"
                    rotulo="Altura da etiqueta (mm)"
                    valor={rolo.alt}
                    min={15}
                    max={100}
                    aoMudar={(v) => mudarRolo("alt", v)}
                  />
                  <div className="etq-campo">
                    <label htmlFor="rolo-cols">Etiquetas por linha</label>
                    <select
                      id="rolo-cols"
                      value={String(rolo.cols)}
                      onChange={(e) => mudarRolo("cols", e.target.value)}
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </div>
                  <CampoNumero
                    id="rolo-vao"
                    rotulo="Vão entre colunas (mm)"
                    valor={rolo.vao}
                    min={0}
                    max={20}
                    desativado={rolo.cols === 1}
                    aoMudar={(v) => mudarRolo("vao", v)}
                  />
                  <CampoNumero
                    id="rolo-gap"
                    rotulo="Vão entre linhas (mm)"
                    valor={rolo.gap}
                    min={0}
                    max={10}
                    aoMudar={(v) => mudarRolo("gap", v)}
                  />
                  <CampoNumero
                    id="rolo-margem"
                    rotulo="Margem esquerda (mm)"
                    valor={rolo.margem}
                    min={0}
                    max={20}
                    aoMudar={(v) => mudarRolo("margem", v)}
                  />
                </div>
                <div className="etq-acoes" style={{ marginTop: 10 }}>
                  <button type="button" className="etq-link" onClick={() => setRolo(ROLO_PADRAO)}>
                    Voltar ao padrão (2 × 50 × 30 mm)
                  </button>
                </div>
              </details>
            </section>
          </aside>
        </main>
      </div>

      {paginas && (
        <div className="etq-impressao" aria-hidden="true">
          <style>{`@page { size: ${W}mm ${rolo.alt}mm; margin: 0; }`}</style>
          {paginas.map((pg, i) => (
            <div
              className="etq-pagina"
              key={i}
              style={{ width: `${W}mm`, height: `${rolo.alt}mm` }}
            >
              {pg.map((formas, j) => (
                <EtiquetaSvg
                  key={j}
                  formas={formas}
                  rolo={rolo}
                  impressao
                  style={{ left: `${rolo.margem + j * (rolo.larg + rolo.vao)}mm` }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
