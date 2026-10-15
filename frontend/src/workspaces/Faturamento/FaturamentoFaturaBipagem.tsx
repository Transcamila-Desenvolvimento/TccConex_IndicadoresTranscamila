import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import etlServerIcon from '../../assets/ETL-Server.svg';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useBaseBipagem, useBuscarDocumentoBipagem, useImportarBaseBipagem } from '../../hooks/useFaturaBipagem';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import type { DocumentoBipagem } from '../../types/domain';
import { imprimirRelacaoBipagem } from './printRelacaoBipagem';
import { agruparRelacaoBipagem, formatarTotalBipagem, somarTotaisBipagem } from './relacaoBipagem';

type AvisoBipagem = { tipo: 'ok' | 'aviso' | 'erro'; texto: string };

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
/** Leitor USB digita bem mais rápido que uma pessoa; acima disso é digitação manual (vai pelo Enter). */
const INTERVALO_LEITOR_MS = 50;
const FIM_LEITURA_MS = 120;
const MIN_CARACTERES_LEITOR = 3;

const CORES_AVISO: Record<AvisoBipagem['tipo'], string> = {
  ok: '#15803d',
  aviso: '#b45309',
  erro: '#b91c1c',
};

const thStyle: React.CSSProperties = { borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 };
const tdStyle: React.CSSProperties = { borderBottom: '1px solid #f1f5f9', borderRight: 'none' };

function formatarAtualizacao(valor?: string | null): string {
  if (!valor) return 'Sem atualização';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Sem atualização';
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function mensagemErro(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  return 'Não foi possível consultar o relatório. Tente bipar de novo.';
}

function incluirNaRelacao(atual: DocumentoBipagem[], novos: DocumentoBipagem[]): DocumentoBipagem[] {
  const ids = new Set(atual.map((item) => item.id));
  const acrescentar = novos.filter((item) => item.id && !ids.has(item.id));
  return acrescentar.length === 0 ? atual : [...atual, ...acrescentar];
}

const FaturamentoFaturaBipagem: React.FC = () => {
  const tituloFormulario = useId();
  const campoCodigo = useRef<HTMLInputElement>(null);
  const buscaTimer = useRef<number | null>(null);
  const buscar = useBuscarDocumentoBipagem();
  const importar = useImportarBaseBipagem();
  const arquivoInput = useRef<HTMLInputElement>(null);
  const [avisoImportacao, setAvisoImportacao] = useState<AvisoBipagem | null>(null);
  const [relacao, setRelacao] = useState<DocumentoBipagem[]>([]);
  const relacaoRef = useRef<DocumentoBipagem[]>([]);
  const filaBipagem = useRef<string[]>([]);
  const processandoFila = useRef(false);
  const leituraTimer = useRef<number | null>(null);
  const ritmoLeitura = useRef({ inicio: 0, ultimo: 0, teclas: 0 });
  const [formAberto, setFormAberto] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState<AvisoBipagem | null>(null);
  const [pagina, setPagina] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [vencimentoAberto, setVencimentoAberto] = useState(false);
  const [vencimentoFatura, setVencimentoFatura] = useState('');
  const tituloVencimento = useId();

  const clienteTravado = relacao[0] ?? null;
  const codClienteTravado = clienteTravado?.codCliente ?? '';
  const baseQuery = useBaseBipagem({ page: pagina, pageSize, search: buscaAplicada, codCliente: codClienteTravado });
  const baseState = useAsyncQueryState(baseQuery);
  const base = baseQuery.data?.results ?? [];
  const totalBase = baseQuery.data?.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(totalBase / pageSize));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const idsSelecionados = useMemo(() => new Set(relacao.map((item) => item.id)), [relacao]);
  const baseVisivel = base.filter((item) => !idsSelecionados.has(item.id));
  const grupos = useMemo(() => agruparRelacaoBipagem(relacao), [relacao]);
  const totalRelacao = useMemo(() => somarTotaisBipagem(grupos.map((grupo) => grupo.total)), [grupos]);
  const textoAtualizacao = baseQuery.data?.lote?.updatedAt
    ? `Última atualização ${formatarAtualizacao(baseQuery.data.lote.updatedAt)}`
    : baseState.showInitialLoader
      ? 'Carregando atualização...'
      : 'Sem atualização';

  useEffect(() => {
    if (!formAberto) return;
    campoCodigo.current?.focus();
    const fechar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFormAberto(false);
    };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [formAberto]);

  useEffect(() => () => {
    if (buscaTimer.current) window.clearTimeout(buscaTimer.current);
    if (leituraTimer.current) window.clearTimeout(leituraTimer.current);
  }, []);

  const abrirSelecao = () => {
    setAviso(null);
    setCodigo('');
    setFormAberto(true);
  };

  const selecionar = (documentos: DocumentoBipagem[]) => {
    const travado = relacaoRef.current[0]?.codCliente ?? '';
    if (travado !== '' && documentos.some((item) => item.codCliente !== travado)) return;
    if (travado === '') setPagina(1);
    relacaoRef.current = incluirNaRelacao(relacaoRef.current, documentos);
    setRelacao((atual) => incluirNaRelacao(atual, documentos));
  };

  const incluirCodigo = (bruto: string) => {
    if (leituraTimer.current) window.clearTimeout(leituraTimer.current);
    const lido = bruto.trim();
    if (!lido) return;
    setCodigo('');
    filaBipagem.current.push(lido);
    void processarFila();
  };

  const processarFila = async () => {
    if (processandoFila.current) return;
    processandoFila.current = true;
    try {
      while (filaBipagem.current.length > 0) {
        await consultarCodigo(filaBipagem.current.shift() as string);
      }
    } finally {
      processandoFila.current = false;
      campoCodigo.current?.focus();
    }
  };

  const aoDigitarCodigo = (valor: string) => {
    setCodigo(valor);
    const agora = performance.now();
    const leitura = ritmoLeitura.current;
    if (valor.length <= 1 || agora - leitura.ultimo > INTERVALO_LEITOR_MS) {
      leitura.inicio = agora;
      leitura.teclas = 1;
    } else {
      leitura.teclas += 1;
    }
    leitura.ultimo = agora;
    if (leituraTimer.current) window.clearTimeout(leituraTimer.current);
    leituraTimer.current = window.setTimeout(() => {
      const media = leitura.teclas > 1 ? (leitura.ultimo - leitura.inicio) / (leitura.teclas - 1) : Infinity;
      if (leitura.teclas >= MIN_CARACTERES_LEITOR && media <= INTERVALO_LEITOR_MS) incluirCodigo(valor);
    }, FIM_LEITURA_MS);
  };

  const consultarCodigo = async (lido: string) => {
    setAviso(null);
    const clienteTravado = relacaoRef.current[0] ?? null;
    try {
      const resultado = await buscar.mutateAsync({ codigo: lido, codCliente: clienteTravado?.codCliente ?? '' });
      if (!resultado.lote) {
        setAviso({ tipo: 'erro', texto: 'Importe o relatório antes de bipar os documentos.' });
        return;
      }
      if (resultado.encontrados.length === 0 && resultado.outroCliente.length > 0 && clienteTravado) {
        const outro = resultado.outroCliente[0];
        setAviso({
          tipo: 'erro',
          texto: `Documento ${outro.docto} é do cliente ${outro.codCliente} – ${outro.cliente}. A seleção aceita só ${clienteTravado.codCliente} – ${clienteTravado.cliente}.`,
        });
        return;
      }
      if (resultado.encontrados.length === 0) {
        setAviso({
          tipo: 'erro',
          texto: `Documento ${lido} não está no relatório ${resultado.lote.label}.`,
        });
        return;
      }
      const idsAtuais = new Set(relacaoRef.current.map((item) => item.id));
      const novos = resultado.encontrados.filter((item) => item.id && !idsAtuais.has(item.id));
      if (novos.length === 0) {
        setAviso({ tipo: 'aviso', texto: `O documento ${resultado.encontrados[0].docto} já está na seleção.` });
        return;
      }
      selecionar(novos);
      const repetidos = resultado.encontrados.length - novos.length;
      const textoNovos = novos.length === 1
        ? `Documento ${novos[0].docto} foi para a seleção.`
        : `${novos.length} documentos foram para a seleção.`;
      const ignorados = resultado.outroCliente.length > 0
        ? ` ${resultado.outroCliente.length} documento(s) com o mesmo número de outro cliente ficaram de fora.`
        : '';
      setAviso({
        tipo: ignorados ? 'aviso' : 'ok',
        texto: `${repetidos > 0 ? `${textoNovos} ${repetidos} já estava selecionado.` : textoNovos}${ignorados}`,
      });
    } catch (error) {
      setAviso({ tipo: 'erro', texto: mensagemErro(error) });
    }
  };

  const aoBuscar = (valor: string) => {
    setBusca(valor);
    if (buscaTimer.current) window.clearTimeout(buscaTimer.current);
    buscaTimer.current = window.setTimeout(() => {
      setBuscaAplicada(valor.trim());
      setPagina(1);
    }, 300);
  };

  const retirar = (id: string) => {
    if (relacao.length === 1) setPagina(1);
    relacaoRef.current = relacaoRef.current.filter((item) => item.id !== id);
    setRelacao((atual) => atual.filter((item) => item.id !== id));
  };

  const confirmarImpressao = () => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(vencimentoFatura);
    if (!match || relacao.length === 0) return;
    imprimirRelacaoBipagem(relacao, `${match[3]}/${match[2]}/${match[1]}`);
    setVencimentoAberto(false);
  };

  const limparSelecao = () => {
    setPagina(1);
    relacaoRef.current = [];
    setRelacao([]);
  };

  const importarArquivo = async (arquivo: File | undefined) => {
    if (!arquivo || importar.isPending) return;
    setAvisoImportacao(null);
    try {
      const resultado = await importar.mutateAsync(arquivo);
      limparSelecao();
      setAviso(null);
      setAvisoImportacao({
        tipo: 'ok',
        texto: `${resultado.linhas} documento(s) importado(s)${resultado.ignoradas > 0 ? `, ${resultado.ignoradas} linha(s) ignorada(s)` : ''}.`,
      });
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setAvisoImportacao({
        tipo: 'erro',
        texto: typeof detail === 'string' && detail.trim() ? detail : 'Não foi possível importar o relatório.',
      });
    } finally {
      if (arquivoInput.current) arquivoInput.current.value = '';
    }
  };

  const mensagemBase = !baseQuery.data?.lote && baseState.canShowEmpty
    ? 'Importe o relatório para montar a base.'
    : buscaAplicada
      ? 'Nenhum documento encontrado na base.'
      : clienteTravado
        ? `Não há mais documentos do cliente ${clienteTravado.codCliente} na base.`
        : 'Nenhum documento na base.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4', flexShrink: 0 }} />
          <div>
            <h1 className="view-page-title" style={{ margin: 0 }}>Fatura por bipagem</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="reports-action-btn primary" onClick={abrirSelecao}>
            Iniciar seleção
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={relacao.length === 0}
            onClick={() => setVencimentoAberto(true)}
          >
            Imprimir relação
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={relacao.length === 0}
            onClick={limparSelecao}
          >
            Limpar seleção
          </button>
        </div>
      </header>

      {formAberto && (
        <form
          className="erp-card"
          role="dialog"
          aria-modal="false"
          aria-labelledby={tituloFormulario}
          onSubmit={(event) => {
            event.preventDefault();
            incluirCodigo(codigo);
          }}
          style={{ marginBottom: '12px', padding: '16px 20px', flexShrink: 0 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h2 id={tituloFormulario} style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>Iniciar seleção</h2>
            <button type="button" className="reports-action-btn secondary" style={{ height: '32px' }} onClick={() => setFormAberto(false)}>
              Fechar
            </button>
          </div>
          <p style={{ margin: '0 0 12px', color: '#475569', fontSize: '13px', lineHeight: 1.45 }}>
            Aponte o leitor USB para o CTE ou documento: ao bipar, ele entra direto na seleção à direita. Se digitar o número, use Enter ou Incluir.
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, fontSize: '13px', color: '#334155', fontWeight: 600 }}>
              CTE / Documento
              <input
                ref={campoCodigo}
                className="form-input"
                value={codigo}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
                placeholder="Bipe ou digite o código"
                onChange={(event) => aoDigitarCodigo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Tab') return;
                  event.preventDefault();
                  incluirCodigo(codigo);
                }}
              />
            </label>
            <button type="submit" className="reports-action-btn primary" disabled={!codigo.trim()}>
              Incluir
            </button>
          </div>
          <div aria-live="polite" style={{ minHeight: '22px', marginTop: '10px', fontSize: '13px', fontWeight: 600, color: aviso ? CORES_AVISO[aviso.tipo] : '#64748b' }}>
            {buscar.isPending ? 'Consultando o relatório...' : aviso?.texto}
          </div>
        </form>
      )}

      <div className="bipagem-split">
        <section className="erp-card reports-table-card bipagem-pane" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="billing-etl-bar" title="Relatório importado pelo ETL Server">
            <img src={etlServerIcon} alt="" className="billing-etl-bar__icon" aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <h2 className="billing-etl-bar__label">ETL Server</h2>
              <p className="bipagem-pane__meta">{textoAtualizacao}</p>
              {avisoImportacao && (
                <p className="bipagem-pane__meta" role="status" style={{ color: CORES_AVISO[avisoImportacao.tipo], fontWeight: 600 }}>
                  {avisoImportacao.texto}
                </p>
              )}
            </div>
            <input
              className="form-input"
              value={busca}
              placeholder="Buscar na base"
              aria-label="Buscar na base"
              onChange={(event) => aoBuscar(event.target.value)}
              style={{ width: '180px', marginTop: 0, marginLeft: 'auto' }}
            />
            <input
              ref={arquivoInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => void importarArquivo(event.target.files?.[0])}
            />
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={importar.isPending}
              title="Importa o relatório Aging (CSV) como base provisória"
              onClick={() => arquivoInput.current?.click()}
              style={{ height: '36px', flexShrink: 0 }}
            >
              {importar.isPending ? 'Importando...' : 'Importar relação'}
            </button>
          </div>
          <QueryDataPanel
            query={baseQuery}
            variant="compact"
            loadingMessage="Carregando a base..."
            refreshingMessage="Atualizando a base..."
            errorMessage="Não foi possível carregar a base do relatório."
            className="table-container"
          >
            <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
              <table className="erp-table reports-table">
                <thead>
                  <tr>
                    <th style={thStyle}>Cod.Clien</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Loja</th>
                    <th style={thStyle}>Cliente</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Origem</th>
                    <th style={thStyle}>Docto</th>
                    <th style={thStyle}>Emissão</th>
                    <th className="num" style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                    <th style={thStyle}>Notas</th>
                    <th style={thStyle}>Fatura</th>
                  </tr>
                </thead>
                <tbody>
                  {baseState.canShowEmpty && baseVisivel.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: '#64748b', padding: '28px 12px' }}>
                        {base.length > 0 ? 'Os documentos desta página já estão na seleção.' : mensagemBase}
                      </td>
                    </tr>
                  ) : baseVisivel.map((linha, idx) => (
                    <tr key={linha.id} className={idx % 2 === 1 ? 'zebra-row' : ''}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#1e293b' }}>{linha.codCliente}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{linha.loja}</td>
                      <td style={tdStyle}>{linha.cliente}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{linha.origem}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#1e293b' }}>{linha.docto}</td>
                      <td style={tdStyle}>{linha.emissao}</td>
                      <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                        {formatarTotalBipagem(linha.total)}
                      </td>
                      <td style={tdStyle}>{linha.notas}</td>
                      <td style={tdStyle}>{linha.fatura}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryDataPanel>
          <div className="erp-pagination-bar" style={{ flexShrink: 0 }}>
            <div className="erp-pagination-page-size">
              <label htmlFor="bipagem-page-size">Itens por página</label>
              <select
                id="bipagem-page-size"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPagina(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <span style={{ fontWeight: 500, marginRight: '4px' }}>
              Página <span className="erp-pagination-current">{paginaAtual}</span> de <span className="erp-pagination-current">{totalPaginas}</span>
            </span>
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina(paginaAtual - 1)}
              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
            >
              Anterior
            </button>
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPagina(paginaAtual + 1)}
              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
            >
              Próximo
            </button>
          </div>
        </section>

        <section className="erp-card reports-table-card bipagem-pane" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="billing-etl-bar">
            <div>
              <h2 className="bipagem-pane__titulo">Selecionados</h2>
              <p className="bipagem-pane__meta">
                {clienteTravado
                  ? `Cliente ${clienteTravado.codCliente} – ${clienteTravado.cliente} · ${relacao.length} documento(s)`
                  : 'Nenhum documento na relação. O primeiro documento bipado define o cliente.'}
              </p>
            </div>
          </div>
          <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th style={thStyle}>Cod.Clien</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Loja</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Origem</th>
                  <th style={thStyle}>Docto</th>
                  <th style={thStyle}>Emissão</th>
                  <th className="num" style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={thStyle}>Notas</th>
                  <th style={thStyle}>Fatura</th>
                  <th style={{ ...thStyle, width: '76px' }} />
                </tr>
              </thead>
              <tbody>
                {relacao.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ ...tdStyle, textAlign: 'center', color: '#64748b', padding: '28px 12px' }}>
                      Inicie a seleção e bipe o CTE ou o documento.
                    </td>
                  </tr>
                ) : grupos.map((grupo) => (
                  <React.Fragment key={`origem-${grupo.origem}`}>
                    <tr>
                      <td colSpan={10} style={{ ...tdStyle, background: '#e2e8f0', fontWeight: 700, color: '#0f172a' }}>
                        Origem {grupo.origem}
                      </td>
                    </tr>
                    {grupo.lojas.map((loja) => (
                      <React.Fragment key={`origem-${grupo.origem}-loja-${loja.loja}`}>
                        <tr>
                          <td colSpan={10} style={{ ...tdStyle, background: '#f8fafc', fontWeight: 600, color: '#334155' }}>
                            Loja {loja.loja}
                          </td>
                        </tr>
                        {loja.documentos.map((linha, idx) => (
                          <tr key={linha.id} className={idx % 2 === 1 ? 'zebra-row' : ''}>
                            <td style={{ ...tdStyle, fontWeight: 600, color: '#1e293b' }}>{linha.codCliente}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{linha.loja}</td>
                            <td style={tdStyle}>{linha.cliente}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{linha.origem}</td>
                            <td style={{ ...tdStyle, fontWeight: 600, color: '#1e293b' }}>{linha.docto}</td>
                            <td style={tdStyle}>{linha.emissao}</td>
                            <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                              {formatarTotalBipagem(linha.total)}
                            </td>
                            <td style={tdStyle}>{linha.notas}</td>
                            <td style={tdStyle}>{linha.fatura}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <button
                                type="button"
                                className="reports-action-btn secondary"
                                style={{ height: '28px', padding: '0 8px', fontSize: '12px' }}
                                onClick={() => retirar(linha.id)}
                              >
                                Retirar
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, textAlign: 'right' }}>
                            Total da loja {loja.loja}
                          </td>
                          <td className="num" style={{ ...tdStyle, fontWeight: 700, textAlign: 'right' }}>
                            {formatarTotalBipagem(loja.total)}
                          </td>
                          <td colSpan={3} style={tdStyle} />
                        </tr>
                      </React.Fragment>
                    ))}
                    {grupo.lojas.length > 1 && (
                      <tr>
                        <td colSpan={6} style={{ ...tdStyle, fontWeight: 700, textAlign: 'right', background: '#f8fafc' }}>
                          Total da origem {grupo.origem}
                        </td>
                        <td className="num" style={{ ...tdStyle, fontWeight: 700, textAlign: 'right', background: '#f8fafc' }}>
                          {formatarTotalBipagem(grupo.total)}
                        </td>
                        <td colSpan={3} style={{ ...tdStyle, background: '#f8fafc' }} />
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {relacao.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', padding: '12px 16px', borderTop: '1px solid #e2e8f0', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
              <span>Total da relação {formatarTotalBipagem(totalRelacao)}</span>
            </div>
          )}
        </section>
      </div>

      {vencimentoAberto && (
        <div className="search-backdrop" role="presentation" onClick={() => setVencimentoAberto(false)}>
          <form
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloVencimento}
            style={{ width: '420px', maxWidth: '92%' }}
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              confirmarImpressao();
            }}
          >
            <div className="modal-header">
              <h3 id={tituloVencimento}>Vencimento das faturas</h3>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 14px', color: '#475569', fontSize: '13px', lineHeight: 1.45 }}>
                Esta data vai no vencimento de todos os documentos da relação impressa.
              </p>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#334155', fontWeight: 600 }}>
                Vencimento
                <input
                  type="date"
                  className="form-input"
                  value={vencimentoFatura}
                  required
                  autoFocus
                  onChange={(event) => setVencimentoFatura(event.target.value)}
                />
              </label>
              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="reports-action-btn secondary" onClick={() => setVencimentoAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="reports-action-btn primary" disabled={!vencimentoFatura}>
                  Imprimir
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default FaturamentoFaturaBipagem;
