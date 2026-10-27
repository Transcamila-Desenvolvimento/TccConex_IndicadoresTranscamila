import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getSgqAuditoriaErrorMessage,
  useAnexarSgqAuditoria,
  useExcluirSgqAuditoriaAnexo,
  useResponderSgqAuditoria,
  useSgqAuditoriaExecucao,
} from '../../hooks/useSgqAuditorias';
import { apiService } from '../../services/apiService';
import type {
  SgqAuditoriaExecucao,
  SgqAuditoriaResposta,
  SgqNormaItem,
  SgqRespostaDestaque,
  SgqTipoRespostaOpcao,
} from '../../types/domain';
import { SGQ_AUDITORIA_STATUS_LABEL } from '../../types/domain';

type Norma = SgqAuditoriaExecucao['normas'][number];
type Pergunta = { item: SgqNormaItem; caminho: SgqNormaItem[]; norma: Norma; posicao: number };
type Filtro = 'todas' | 'pendentes' | 'respondidas' | 'forte' | 'fraco';

const FILTROS: Array<{ value: Filtro; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendentes', label: 'Sem resposta' },
  { value: 'respondidas', label: 'Respondidas' },
  { value: 'forte', label: 'Pontos fortes' },
  { value: 'fraco', label: 'Pontos fracos' },
];

const ARQUIVOS_ACEITOS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.csv';

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function montarPerguntas(dados: SgqAuditoriaExecucao): Pergunta[] {
  const porPai = new Map<string, SgqNormaItem[]>();
  dados.itens.forEach((item) => {
    const chave = item.parentId ?? `norma:${item.normaId}`;
    porPai.set(chave, [...(porPai.get(chave) ?? []), item]);
  });
  const perguntas: Pergunta[] = [];
  const visitar = (chave: string, caminho: SgqNormaItem[], norma: Norma) => {
    (porPai.get(chave) ?? []).forEach((item) => {
      if (item.tipo === 'pergunta') perguntas.push({ item, caminho, norma, posicao: perguntas.length });
      visitar(item.id, [...caminho, item], norma);
    });
  };
  dados.normas.forEach((norma) => visitar(`norma:${norma.id}`, [], norma));
  return perguntas;
}

function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function classeResposta(resposta: SgqAuditoriaResposta | undefined) {
  if (!resposta?.opcaoCodigo) return 'is-pendente';
  if (resposta.valor === null) return 'is-na';
  if (resposta.valor >= 100) return 'is-conforme';
  return resposta.valor > 0 ? 'is-parcial' : 'is-nao-conforme';
}

const SGQAuditoriaExecucao: React.FC = () => {
  const { auditoriaId = '' } = useParams();
  const { user, selectedFilial } = useAuth();
  const execucaoQuery = useSgqAuditoriaExecucao(selectedFilial, auditoriaId);
  const { canShowEmpty } = useAsyncQueryState(execucaoQuery);
  const dados = execucaoQuery.data;

  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [filtroClasse, setFiltroClasse] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [busca, setBusca] = useState('');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const ativoRef = useRef<HTMLButtonElement | null>(null);

  const perguntas = useMemo(() => (dados ? montarPerguntas(dados) : []), [dados]);
  // Siglas das normas da auditoria, sem repetir quando mais de uma norma usa a mesma.
  const classificacoes = useMemo(
    () => [...new Map((dados?.normas ?? []).flatMap((n) => n.classificacoes).map((c) => [c.sigla, c])).values()],
    [dados],
  );
  const areas = useMemo(
    () => [...new Map((dados?.normas ?? []).flatMap((n) => n.areas).map((a) => [a.sigla, a])).values()],
    [dados],
  );
  const respostas = useMemo(
    () => new Map((dados?.respostas ?? []).map((resposta) => [resposta.itemId, resposta])),
    [dados],
  );
  const opcoesPorTipo = useMemo(
    () => new Map((dados?.tiposResposta ?? []).map((tipo) => [tipo.id, tipo.opcoes])),
    [dados],
  );

  const termo = normalizar(busca.trim());
  const lista = perguntas.filter(({ item }) => {
    const resposta = respostas.get(item.id);
    if (filtro === 'pendentes' && resposta?.opcaoCodigo) return false;
    if (filtro === 'respondidas' && !resposta?.opcaoCodigo) return false;
    if ((filtro === 'forte' || filtro === 'fraco') && resposta?.destaque !== filtro) return false;
    if (filtroClasse && item.classificacao !== filtroClasse) return false;
    if (filtroArea && !item.areas.includes(filtroArea)) return false;
    return !termo || normalizar(`${item.codigo} ${item.titulo}`).includes(termo);
  });

  const atual = perguntas.find((p) => p.item.id === selecionadoId) ?? lista[0] ?? perguntas[0];
  const anterior = atual ? [...lista].reverse().find((p) => p.posicao < atual.posicao) : undefined;
  const proxima = atual ? lista.find((p) => p.posicao > atual.posicao) : undefined;
  const proximaPendente = atual
    ? perguntas.find((p) => p.posicao > atual.posicao && !respostas.get(p.item.id)?.opcaoCodigo)
    : undefined;

  const respondidas = perguntas.filter((p) => respostas.get(p.item.id)?.opcaoCodigo).length;
  const fortes = dados?.respostas.filter((r) => r.destaque === 'forte').length ?? 0;
  const fracos = dados?.respostas.filter((r) => r.destaque === 'fraco').length ?? 0;
  const percentual = perguntas.length ? Math.round((respondidas / perguntas.length) * 100) : 0;

  const concluida = dados?.auditoria.status === 'concluida';
  const podeResponder = userHasFuncao(user, 'SGQ', 'executar-auditorias') && !concluida;

  useEffect(() => {
    ativoRef.current?.scrollIntoView({ block: 'nearest' });
  }, [atual?.item.id]);

  return (
    <div className="sgq-aud-page sgq-exec-page">
      <header className="sgq-aud-header sgq-exec-header">
        <div className="sgq-exec-ident">
          <Link to="/sgq/auditorias/minhas-acoes" className="sgq-exec-voltar" aria-label="Voltar ao questionário">
            <i className="bi bi-arrow-left" aria-hidden="true" />
          </Link>
          <div className="sgq-exec-ident-texto">
            <h1 className="view-page-title" title={dados?.auditoria.titulo}>
              {dados ? `${dados.auditoria.codigo} · ${dados.auditoria.titulo}` : 'Auditoria'}
            </h1>
            {dados && (
              <p className="sgq-aud-subtitle">
                <span>{dados.normas.map((norma) => norma.nome).join(', ') || 'Sem normas vinculadas'}</span>
                <span className={`sgq-aud-status is-${dados.auditoria.status}`}>
                  {SGQ_AUDITORIA_STATUS_LABEL[dados.auditoria.status]}
                </span>
              </p>
            )}
          </div>
        </div>
        {perguntas.length > 0 && (
          <div className="sgq-exec-progresso" title={`${respondidas} de ${perguntas.length} perguntas respondidas`}>
            <div className="sgq-exec-progresso-numeros">
              <strong>{respondidas}/{perguntas.length}</strong>
              <span>respondidas ({percentual}%)</span>
              <span className="sgq-exec-progresso-destaques">
                <span className="sgq-exec-destaque-count is-forte" title="Pontos fortes">
                  <i className="bi bi-hand-thumbs-up-fill" aria-hidden="true" /> {fortes}
                </span>
                <span className="sgq-exec-destaque-count is-fraco" title="Pontos fracos">
                  <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> {fracos}
                </span>
              </span>
            </div>
            <div className="sgq-exec-progresso-barra"><span style={{ width: `${percentual}%` }} /></div>
          </div>
        )}
      </header>

      <QueryDataPanel
        query={execucaoQuery}
        loadingMessage="Carregando perguntas da auditoria..."
        refreshingMessage="Atualizando auditoria..."
        errorMessage="Não foi possível carregar a auditoria. Tente novamente."
      >
        {canShowEmpty && perguntas.length === 0 ? (
          <div className="sgq-aud-table-card">
            <div className="sgq-aud-empty">
              <i className="bi bi-clipboard-x" aria-hidden="true" />
              <strong>Nenhuma pergunta para responder</strong>
              <span>As normas desta auditoria ainda não têm perguntas cadastradas.</span>
            </div>
          </div>
        ) : dados && atual ? (
          <div className="sgq-req-layout">
            <aside className="sgq-req-nav" aria-label="Perguntas da auditoria">
              <div className="sgq-req-nav-header">
                <label className="sgq-req-busca">
                  <i className="bi bi-search" aria-hidden="true" />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar código ou texto..."
                    aria-label="Buscar perguntas"
                  />
                </label>
                <select
                  className="form-input sgq-exec-filtro"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value as Filtro)}
                  aria-label="Filtrar perguntas"
                >
                  {FILTROS.map((opcao) => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                </select>
                {(classificacoes.length > 0 || areas.length > 0) && (
                  <div className="sgq-exec-filtros-linha">
                    {classificacoes.length > 0 && (
                      <FiltroLista
                        rotulo="Filtrar por classificação"
                        placeholder="Classificação"
                        valor={filtroClasse}
                        onChange={setFiltroClasse}
                        opcoes={classificacoes.map((c) => ({ valor: c.sigla, texto: `${c.sigla} - ${c.nome}` }))}
                      />
                    )}
                    {areas.length > 0 && (
                      <FiltroLista
                        rotulo="Filtrar por área"
                        placeholder="Área"
                        valor={filtroArea}
                        onChange={setFiltroArea}
                        opcoes={areas.map((a) => ({ valor: a.sigla, texto: `${a.sigla} - ${a.nome}` }))}
                      />
                    )}
                  </div>
                )}
              </div>
              <ul className="sgq-req-nav-lista">
                {lista.length === 0 && <li className="sgq-exec-lista-vazia">Nenhuma pergunta neste filtro.</li>}
                {lista.map(({ item }) => {
                  const resposta = respostas.get(item.id);
                  const ativo = item.id === atual.item.id;
                  return (
                    <li key={item.id}>
                      <div className={`sgq-req-nav-item${ativo ? ' is-active' : ''}`}>
                        <button
                          type="button"
                          ref={ativo ? ativoRef : undefined}
                          className="sgq-req-nav-label"
                          onClick={() => setSelecionadoId(item.id)}
                          title={item.titulo}
                        >
                          <span className={`sgq-exec-marca ${classeResposta(resposta)}`} title={resposta?.opcaoTexto || 'Sem resposta'}>
                            {resposta?.opcaoCodigo || ''}
                          </span>
                          <span className="sgq-req-nav-titulo">{item.codigo} {item.titulo}</span>
                          {resposta?.anexos.length ? <i className="bi bi-paperclip sgq-exec-icone" aria-label="Com anexos" /> : null}
                          {resposta?.destaque === 'forte' && <i className="bi bi-hand-thumbs-up-fill sgq-exec-icone is-forte" aria-label="Ponto forte" />}
                          {resposta?.destaque === 'fraco' && <i className="bi bi-exclamation-triangle-fill sgq-exec-icone is-fraco" aria-label="Ponto fraco" />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <PerguntaPainel
              key={atual.item.id}
              auditoriaId={auditoriaId}
              filial={selectedFilial}
              pergunta={atual}
              opcoes={(atual.item.tipoRespostaId && opcoesPorTipo.get(atual.item.tipoRespostaId)) || []}
              resposta={respostas.get(atual.item.id)}
              podeResponder={podeResponder}
              concluida={concluida}
              onAnterior={anterior ? () => setSelecionadoId(anterior.item.id) : undefined}
              onProxima={proxima ? () => setSelecionadoId(proxima.item.id) : undefined}
              onProximaPendente={proximaPendente ? () => setSelecionadoId(proximaPendente.item.id) : undefined}
            />
          </div>
        ) : null}
      </QueryDataPanel>
    </div>
  );
};

interface FiltroListaProps {
  rotulo: string;
  placeholder: string;
  valor: string;
  opcoes: Array<{ valor: string; texto: string }>;
  onChange: (valor: string) => void;
}

/** Lista suspensa da largura do campo (o select nativo abre na largura da maior opção). */
const FiltroLista: React.FC<FiltroListaProps> = ({ rotulo, placeholder, valor, opcoes, onChange }) => {
  const [aberta, setAberta] = useState(false);
  const raizRef = useRef<HTMLDivElement | null>(null);
  const todas = [{ valor: '', texto: 'Todas' }, ...opcoes];
  const atual = todas.find((o) => o.valor === valor) ?? todas[0];

  useEffect(() => {
    if (!aberta) return;
    const fechar = (e: MouseEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) setAberta(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberta(false); };
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberta]);

  return (
    <div className="sgq-exec-lista-suspensa" ref={raizRef}>
      <button
        type="button"
        className={`sgq-exec-lista-campo${aberta ? ' is-aberta' : ''}${valor ? '' : ' is-vazia'}`}
        onClick={() => setAberta((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={aberta}
        aria-label={rotulo}
        title={valor ? atual.texto : rotulo}
      >
        <span>{valor ? atual.texto : placeholder}</span>
        <i className="bi bi-chevron-down" aria-hidden="true" />
      </button>
      {aberta && (
        <ul className="sgq-exec-lista-menu" role="listbox" aria-label={rotulo}>
          {todas.map((opcao) => (
            <li
              key={opcao.valor || 'todas'}
              role="option"
              aria-selected={opcao.valor === valor}
              className={opcao.valor === valor ? 'is-selecionada' : undefined}
              title={opcao.texto}
              onClick={() => { onChange(opcao.valor); setAberta(false); }}
            >
              {opcao.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface PerguntaPainelProps {
  auditoriaId: string;
  filial: string | null;
  pergunta: Pergunta;
  opcoes: SgqTipoRespostaOpcao[];
  resposta: SgqAuditoriaResposta | undefined;
  podeResponder: boolean;
  concluida: boolean;
  onAnterior?: () => void;
  onProxima?: () => void;
  onProximaPendente?: () => void;
}

type Rascunho = { opcaoCodigo: string; observacoes: string; destaque: SgqRespostaDestaque };

const PerguntaPainel: React.FC<PerguntaPainelProps> = ({
  auditoriaId, filial, pergunta, opcoes, resposta, podeResponder, concluida, onAnterior, onProxima, onProximaPendente,
}) => {
  const { item, caminho, norma } = pergunta;
  const responder = useResponderSgqAuditoria(filial, auditoriaId);
  const anexar = useAnexarSgqAuditoria(filial, auditoriaId);
  const excluirAnexo = useExcluirSgqAuditoriaAnexo(filial, auditoriaId);
  const [rascunho, setRascunho] = useState<Rascunho>({
    opcaoCodigo: resposta?.opcaoCodigo ?? '',
    observacoes: resposta?.observacoes ?? '',
    destaque: resposta?.destaque ?? '',
  });
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro' | 'aviso'; texto: string } | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement | null>(null);

  const opcaoEscolhida = opcoes.find((o) => o.codigo === rascunho.opcaoCodigo);
  const exigeJustificativa = Boolean(opcaoEscolhida?.exigeJustificativa);
  const classificacao = norma.classificacoes.find((c) => c.sigla === item.classificacao);
  const nomeArea = (sigla: string) => norma.areas.find((a) => a.sigla === sigla)?.nome ?? sigla;
  const anexos = resposta?.anexos ?? [];
  const ocupado = responder.isPending || anexar.isPending || excluirAnexo.isPending;

  const salvar = (alteracao: Partial<Rascunho>) => {
    const proximo = { ...rascunho, ...alteracao };
    setRascunho(proximo);
    const opcao = opcoes.find((o) => o.codigo === proximo.opcaoCodigo);
    if (opcao?.exigeJustificativa && !proximo.observacoes.trim()) {
      setMensagem({ tipo: 'aviso', texto: `Justifique a resposta "${opcao.texto}" nas observações para salvar.` });
      return;
    }
    const salvo = {
      opcaoCodigo: resposta?.opcaoCodigo ?? '',
      observacoes: resposta?.observacoes ?? '',
      destaque: resposta?.destaque ?? '',
    };
    if (proximo.opcaoCodigo === salvo.opcaoCodigo && proximo.observacoes.trim() === salvo.observacoes.trim()
      && proximo.destaque === salvo.destaque) return;
    setMensagem(null);
    responder.mutate(
      { itemId: item.id, ...proximo },
      {
        onSuccess: () => setMensagem({ tipo: 'ok', texto: 'Alterações salvas!' }),
        onError: (err) => setMensagem({ tipo: 'erro', texto: getSgqAuditoriaErrorMessage(err, 'Não foi possível salvar a resposta.') }),
      },
    );
  };

  const enviarArquivos = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setMensagem(null);
    try {
      for (const arquivo of Array.from(arquivos)) {
        await anexar.mutateAsync({ itemId: item.id, arquivo });
      }
      setMensagem({ tipo: 'ok', texto: arquivos.length > 1 ? 'Anexos incluídos!' : 'Anexo incluído!' });
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: getSgqAuditoriaErrorMessage(err, 'Não foi possível anexar o arquivo.') });
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  const removerAnexo = (anexoId: string, nome: string) => {
    if (!window.confirm(`Excluir o anexo "${nome}"?`)) return;
    excluirAnexo.mutate(anexoId, {
      onError: (err) => setMensagem({ tipo: 'erro', texto: getSgqAuditoriaErrorMessage(err, 'Não foi possível excluir o anexo.') }),
    });
  };

  const baixar = async (anexoId: string, nome: string) => {
    setBaixando(anexoId);
    try {
      const blob = await apiService.downloadSgqAuditoriaAnexo(auditoriaId, anexoId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nome;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não foi possível baixar o anexo.' });
    } finally {
      setBaixando(null);
    }
  };

  return (
    <section className="sgq-req-conteudo sgq-exec-painel" aria-label="Resolução da pergunta">
      <div className="sgq-exec-topo">
        <button type="button" className="sgq-exec-nav-btn" onClick={onAnterior} disabled={!onAnterior} aria-label="Pergunta anterior" title="Pergunta anterior">
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <div className="sgq-exec-titulo">
          {caminho.length > 0 && (
            <span className="sgq-exec-caminho" title={caminho.map((c) => `${c.codigo} ${c.titulo}`).join(' › ')}>
              {norma.nome} › {caminho.map((c) => c.codigo || c.titulo).join(' › ')}
            </span>
          )}
          <h2>
            {item.codigo && <span className="sgq-exec-codigo">{item.codigo}</span>} {item.titulo}
          </h2>
          <div className="sgq-exec-meta">
            {item.obrigatorio && (
              <span className="sgq-aud-status is-obrigatorio">Obrigatório</span>
            )}
            {classificacao && (
              <span className="sgq-aud-status is-execucao" title={classificacao.critica ? `${classificacao.nome} (crítica)` : classificacao.nome}>
                {classificacao.sigla} - {classificacao.nome}
              </span>
            )}
            {item.areas.map((sigla) => <span key={sigla} className="sgq-aud-chip" title={nomeArea(sigla)}>{sigla}</span>)}
            <span>Peso: {item.peso}</span>
          </div>
        </div>
        <button type="button" className="sgq-exec-nav-btn" onClick={onProxima} disabled={!onProxima} aria-label="Próxima pergunta" title="Próxima pergunta">
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>

      <div className="sgq-exec-corpo">
        {concluida && (
          <p className="sgq-norma-aviso">
            <i className="bi bi-lock" aria-hidden="true" /> Auditoria concluída: as respostas estão somente para consulta.
          </p>
        )}

        {item.descricao && (
          <details className="sgq-exec-guia">
            <summary>Guia de orientação</summary>
            <p>{item.descricao}</p>
          </details>
        )}

        <div className="sgq-exec-linha">
          <fieldset className="sgq-exec-bloco" disabled={!podeResponder || responder.isPending}>
            <legend>Resposta</legend>
            {opcoes.length === 0 ? (
              <p className="sgq-aud-muted">Pergunta sem tipo de resposta cadastrado na norma.</p>
            ) : (
              <div className="sgq-exec-opcoes" role="radiogroup" aria-label="Resposta">
                {opcoes.map((opcao) => {
                  const marcada = rascunho.opcaoCodigo === opcao.codigo;
                  const tom = opcao.valor === null ? 'is-na' : opcao.valor >= 100 ? 'is-conforme' : opcao.valor > 0 ? 'is-parcial' : 'is-nao-conforme';
                  return (
                    <button
                      key={opcao.codigo}
                      type="button"
                      role="radio"
                      aria-checked={marcada}
                      className={`sgq-exec-opcao ${tom}${marcada ? ' is-picked' : ''}`}
                      onClick={() => salvar({ opcaoCodigo: marcada ? '' : opcao.codigo })}
                      title={opcao.valor === null ? 'Fora do cálculo de aderência' : `${opcao.valor}% de conformidade`}
                    >
                      {opcao.codigo !== opcao.texto && <span className="sgq-exec-opcao-codigo">{opcao.codigo}</span>}
                      {opcao.texto}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          <fieldset className="sgq-exec-bloco" disabled={!podeResponder || responder.isPending}>
            <legend>Destaque</legend>
            <div className="sgq-exec-destaques">
              <button
                type="button"
                className={`sgq-exec-destaque is-forte${rascunho.destaque === 'forte' ? ' is-picked' : ''}`}
                aria-pressed={rascunho.destaque === 'forte'}
                onClick={() => salvar({ destaque: rascunho.destaque === 'forte' ? '' : 'forte' })}
              >
                <i className="bi bi-hand-thumbs-up" aria-hidden="true" /> Ponto forte
              </button>
              <button
                type="button"
                className={`sgq-exec-destaque is-fraco${rascunho.destaque === 'fraco' ? ' is-picked' : ''}`}
                aria-pressed={rascunho.destaque === 'fraco'}
                onClick={() => salvar({ destaque: rascunho.destaque === 'fraco' ? '' : 'fraco' })}
              >
                <i className="bi bi-exclamation-triangle" aria-hidden="true" /> Ponto fraco
              </button>
            </div>
          </fieldset>
        </div>

        <label className="sgq-exec-bloco">
          <span className="sgq-exec-legenda">
            {exigeJustificativa ? <>Justificativa <em>*</em></> : 'Observações'}
          </span>
          <textarea
            className="form-input"
            rows={4}
            maxLength={4000}
            value={rascunho.observacoes}
            disabled={!podeResponder}
            onChange={(e) => setRascunho({ ...rascunho, observacoes: e.target.value })}
            onBlur={() => salvar({})}
            placeholder={exigeJustificativa ? 'Explique por que a pergunta não se aplica.' : 'Evidências observadas, entrevistados, documentos verificados...'}
          />
        </label>

        <div className="sgq-exec-bloco">
          <span className="sgq-exec-legenda">Anexos ({anexos.length})</span>
          {podeResponder && (
            <>
              <input
                ref={arquivoRef}
                type="file"
                multiple
                hidden
                accept={ARQUIVOS_ACEITOS}
                onChange={(e) => enviarArquivos(e.target.files)}
              />
              <button
                type="button"
                className={`sgq-exec-anexos-vazio is-clicavel${arrastando ? ' is-arrastando' : ''}`}
                onClick={() => arquivoRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastando(false); if (!ocupado) enviarArquivos(e.dataTransfer.files); }}
                disabled={ocupado}
              >
                <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
                {anexar.isPending
                  ? 'Enviando...'
                  : 'Clique ou arraste arquivos aqui para anexar. Fotos, PDFs e planilhas de até 15 MB.'}
              </button>
            </>
          )}
          {anexos.length === 0 && !podeResponder ? (
            <p className="sgq-aud-muted">Nenhum anexo.</p>
          ) : anexos.length > 0 && (
            <ul className="sgq-exec-anexos">
              {anexos.map((anexo) => (
                <li key={anexo.id}>
                  <i className="bi bi-file-earmark" aria-hidden="true" />
                  <button
                    type="button"
                    className="sgq-exec-anexo-nome"
                    onClick={() => baixar(anexo.id, anexo.nome)}
                    disabled={baixando === anexo.id}
                    title="Baixar"
                  >
                    {anexo.nome}
                  </button>
                  <span className="sgq-aud-muted">
                    {formatarTamanho(anexo.tamanho)} · {anexo.incluidoPor || '—'} · {new Date(anexo.criadoEm).toLocaleDateString('pt-BR')}
                  </span>
                  {podeResponder && (
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => removerAnexo(anexo.id, anexo.nome)}
                      disabled={ocupado}
                      aria-label={`Excluir ${anexo.nome}`}
                      title="Excluir anexo"
                    >
                      <i className="bi bi-trash3" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="sgq-exec-rodape">
        <span className={`sgq-exec-status${mensagem ? ` is-${mensagem.tipo}` : ''}`} role="status">
          {responder.isPending
            ? 'Salvando...'
            : mensagem?.texto ?? (resposta?.respondidoPor
              ? `Atualizado por ${resposta.respondidoPor} em ${new Date(resposta.atualizadoEm).toLocaleString('pt-BR')}`
              : '')}
        </span>
        {onProximaPendente && (
          <button type="button" className="reports-action-btn secondary" onClick={onProximaPendente}>
            Próxima sem resposta <i className="bi bi-skip-forward" aria-hidden="true" />
          </button>
        )}
        <button type="button" className="reports-action-btn primary" onClick={onProxima} disabled={!onProxima}>
          Próxima <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

export default SGQAuditoriaExecucao;
