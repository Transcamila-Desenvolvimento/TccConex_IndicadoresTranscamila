import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import EditorTexto, { normalizarTextoFormatado, textoVisivel } from './SGQEditorTexto';
import SGQAuditoriaDrivePicker from './SGQAuditoriaDrivePicker';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAuditoriaPresenca, type ColegaPergunta } from '../../hooks/useAuditoriaPresenca';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getSgqAuditoriaErrorMessage,
  useAnexarSgqAuditoria,
  useAnexarSgqAuditoriaDoDrive,
  useExcluirSgqAuditoriaAnexo,
  useConcluirSgqAuditoria,
  useResponderSgqAuditoria,
  useSugerirEvidenciaSgq,
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
import { SGQ_QUESTIONARIO_STATUS_LABEL } from '../../types/domain';

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

function filtroMencao(valor: string): string | null {
  const achado = textoVisivel(valor).match(/(?:^|\s)@([\p{L}\d_-]*)$/u);
  return achado ? achado[1] : null;
}

type AcaoCamilo = 'validar' | 'escrever';

const FUNCOES_CAMILO: Array<{ acao: AcaoCamilo; titulo: string; detalhe: string; filtro: string }> = [
  {
    acao: 'validar',
    titulo: 'Validar anexos',
    detalhe: 'Confere se os anexos atendem o que a norma pede',
    filtro: 'validar anexos conformidade norma',
  },
  {
    acao: 'escrever',
    titulo: 'Escrever evidência',
    detalhe: 'Com o anexo, a pergunta e o guia de orientação',
    filtro: 'escrever evidencia anexo pergunta guia',
  },
];

function funcaoCombina(filtro: string, consulta: string) {
  const termo = normalizar(consulta);
  if (!termo) return true;
  const base = normalizar(filtro);
  return base.includes(termo) || base.split(' ').some((parte) => parte.startsWith(termo));
}

function removerMencao(html: string) {
  return html.replace(/@[\p{L}\d_-]*(?=(?:<\/[^>]+>\s*)*$)/u, '');
}

function aplicarRascunho(base: string, sugestao: string, modo: 'substituir' | 'frente') {
  const trecho = `<p>${sugestao.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`;
  const limpa = removerMencao(base).trim();
  if (modo === 'substituir' || !textoVisivel(limpa)) return trecho;
  return `${limpa}${trecho}`;
}

function mesmoNome(a: string, b: string) {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

type MotivoPendencia = 'sem-resposta' | 'sem-justificativa' | 'invalida';

type PendenciaConclusao = {
  item: SgqNormaItem;
  motivo: MotivoPendencia;
  opcoes: SgqTipoRespostaOpcao[];
  resposta: SgqAuditoriaResposta | undefined;
};

const MOTIVO_PENDENCIA: Record<MotivoPendencia, string> = {
  'sem-resposta': 'Sem resposta',
  'sem-justificativa': 'Falta evidência/justificativa',
  invalida: 'Resposta inválida',
};

function listarPendencias(dados: SgqAuditoriaExecucao): PendenciaConclusao[] {
  const respostas = new Map(dados.respostas.map((resposta) => [resposta.itemId, resposta]));
  const opcoesPorTipo = new Map(dados.tiposResposta.map((tipo) => [tipo.id, tipo.opcoes]));
  const pendencias: PendenciaConclusao[] = [];
  dados.itens.forEach((item) => {
    if (item.tipo !== 'pergunta') return;
    const resposta = respostas.get(item.id);
    const opcoes = item.tipoRespostaId ? opcoesPorTipo.get(item.tipoRespostaId) ?? [] : [];
    const codigo = resposta?.opcaoCodigo.trim() ?? '';
    if (!codigo) {
      pendencias.push({ item, motivo: 'sem-resposta', opcoes, resposta });
      return;
    }
    const opcao = opcoes.find((itemOpcao) => itemOpcao.codigo.localeCompare(codigo, 'pt-BR', { sensitivity: 'accent' }) === 0);
    if (!opcao) {
      pendencias.push({ item, motivo: 'invalida', opcoes, resposta });
      return;
    }
    if (opcao.exigeJustificativa && !textoVisivel(resposta?.observacoes ?? '')) {
      pendencias.push({ item, motivo: 'sem-justificativa', opcoes, resposta });
    }
  });
  return pendencias;
}

const LinhaPendencia: React.FC<{
  pendencia: PendenciaConclusao;
  salvando: boolean;
  onSalvar: (payload: { itemId: string; opcaoCodigo: string; observacoes: string; destaque: SgqRespostaDestaque }) => void;
  onAbrir: (itemId: string) => void;
}> = ({ pendencia, salvando, onSalvar, onAbrir }) => {
  const { item, opcoes, resposta } = pendencia;
  const [codigo, setCodigo] = useState(resposta?.opcaoCodigo ?? '');
  const [observacoes, setObservacoes] = useState(resposta?.observacoes ?? '');
  const opcao = opcoes.find((itemOpcao) => itemOpcao.codigo.localeCompare(codigo, 'pt-BR', { sensitivity: 'accent' }) === 0);
  const precisaJustificar = Boolean(opcao?.exigeJustificativa);

  const salvar = (novoCodigo: string, novaObs: string) => {
    const escolhida = opcoes.find((itemOpcao) => itemOpcao.codigo.localeCompare(novoCodigo, 'pt-BR', { sensitivity: 'accent' }) === 0);
    const evidencia = normalizarTextoFormatado(novaObs);
    if (!novoCodigo || !escolhida) return;
    onSalvar({
      itemId: item.id,
      opcaoCodigo: novoCodigo,
      observacoes: evidencia,
      destaque: resposta?.destaque ?? '',
    });
  };

  return (
    <li className="sgq-exec-pendencia">
      <div className="sgq-exec-pendencia-texto">
        <button type="button" className="sgq-exec-pendencia-abrir" onClick={() => onAbrir(item.id)}>
          {item.codigo && <span>{item.codigo}</span>}
          {item.titulo}
        </button>
        <small>{MOTIVO_PENDENCIA[pendencia.motivo]}</small>
      </div>
      <label className="sgq-exec-pendencia-resposta">
        <select
          className="form-input"
          aria-label={`Resposta de ${item.codigo || item.titulo}`}
          value={codigo}
          disabled={salvando || opcoes.length === 0}
          onChange={(e) => {
            const valor = e.target.value;
            setCodigo(valor);
            if (valor) salvar(valor, observacoes);
          }}
        >
          <option value="">Selecione</option>
          {opcoes.map((itemOpcao) => (
            <option key={itemOpcao.codigo} value={itemOpcao.codigo}>{itemOpcao.texto}</option>
          ))}
        </select>
      </label>
      {precisaJustificar && (
        <div className="sgq-exec-pendencia-justificativa">
          <span>Evidência/justificativa <em>*</em></span>
          <EditorTexto
            valor={observacoes}
            rotulo="Evidência/justificativa"
            placeholder="Descreva a evidência ou a justificativa. Use negrito e tópicos se precisar."
            disabled={salvando}
            onChange={setObservacoes}
            onBlur={(valor) => salvar(codigo, valor)}
          />
        </div>
      )}
    </li>
  );
};

const FormularioPendencias: React.FC<{
  auditoriaId: string;
  filial: string | null;
  pendencias: PendenciaConclusao[];
  semPerguntas: boolean;
  concluindo: boolean;
  onFechar: () => void;
  onAbrir: (itemId: string) => void;
  onConcluir: () => void;
}> = ({ auditoriaId, filial, pendencias, semPerguntas, concluindo, onFechar, onAbrir, onConcluir }) => {
  const responder = useResponderSgqAuditoria(filial, auditoriaId);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const termo = normalizar(busca.trim());
  const lista = pendencias.filter((pendencia) => (
    !termo || normalizar(`${pendencia.item.codigo} ${pendencia.item.titulo}`).includes(termo)
  ));

  useEffect(() => {
    const fechar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', fechar);
    return () => document.removeEventListener('keydown', fechar);
  }, [onFechar]);

  return (
    <div className="search-backdrop sgq-aud-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="modal-card sgq-aud-modal sgq-exec-pendencias" role="dialog" aria-modal="true" aria-labelledby="sgq-pendencias-titulo">
        <div className="modal-header">
          <div>
            <h3 id="sgq-pendencias-titulo">Perguntas para concluir</h3>
            <p className="sgq-aud-modal-sub">
              {semPerguntas
                ? 'Esta auditoria não tem perguntas no questionário.'
                : pendencias.length
                  ? `${pendencias.length} ${pendencias.length === 1 ? 'pendência' : 'pendências'}. Se não for responder, marque Não aplicável, conforme a norma.`
                  : 'Todas as perguntas foram respondidas.'}
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onFechar} aria-label="Fechar">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        <div className="sgq-exec-pendencias-corpo">
          {!semPerguntas && pendencias.length > 0 && (
            <label className="sgq-req-busca">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar código ou texto..."
                aria-label="Buscar pendências"
                autoFocus
              />
            </label>
          )}
          {erro && <p className="sgq-exec-pendencias-erro">{erro}</p>}
          {semPerguntas ? null : pendencias.length === 0 ? (
            <p className="sgq-exec-pendencias-ok">Pode concluir o questionário. A auditoria segue em aberto até a conclusão.</p>
          ) : (
            <ul className="sgq-exec-pendencias-lista">
              {lista.map((pendencia) => (
                <LinhaPendencia
                  key={pendencia.item.id}
                  pendencia={pendencia}
                  salvando={responder.isPending}
                  onAbrir={onAbrir}
                  onSalvar={(payload) => {
                    setErro('');
                    responder.mutate(payload, {
                      onError: (err) => setErro(getSgqAuditoriaErrorMessage(err, 'Não foi possível salvar a resposta.')),
                    });
                  }}
                />
              ))}
              {lista.length === 0 && <li className="sgq-exec-pendencias-vazia">Nenhuma pendência com esse texto.</li>}
            </ul>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="reports-action-btn secondary" onClick={onFechar}>Fechar</button>
          {!semPerguntas && pendencias.length === 0 && (
            <button type="button" className="reports-action-btn primary" onClick={onConcluir} disabled={concluindo}>
              {concluindo ? 'Concluindo...' : 'Concluir questionário'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function codigoDoTopico(codigo: string) {
  return codigo.trim().split('.')[0] ?? '';
}

function perguntaNoTopico(pergunta: Pick<Pergunta, 'item' | 'caminho'>, topico: string) {
  return [pergunta.item, ...pergunta.caminho].some((item) => {
    const codigo = item.codigo.trim();
    return codigo === topico || codigo.startsWith(`${topico}.`);
  });
}

function topicosDasPerguntas(perguntas: Pergunta[]) {
  const titulos = new Map<string, string>();
  const presentes = new Set<string>();
  for (const pergunta of perguntas) {
    for (const item of [...pergunta.caminho, pergunta.item]) {
      const codigo = item.codigo.trim();
      if (codigo && !codigo.includes('.') && !titulos.has(codigo)) titulos.set(codigo, item.titulo.trim());
      const topico = codigoDoTopico(codigo);
      if (topico) presentes.add(topico);
    }
  }
  return [...presentes]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    .map((codigo) => ({
      valor: codigo,
      texto: titulos.get(codigo) ? `${codigo} - ${titulos.get(codigo)}` : codigo,
    }));
}

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

function classeResposta(resposta: { opcaoCodigo?: string; valor?: number | null } | undefined) {
  if (!resposta?.opcaoCodigo) return 'is-pendente';
  const valor = resposta.valor;
  if (valor === null) return 'is-na';
  if (typeof valor !== 'number') return 'is-nao-conforme';
  if (valor >= 100) return 'is-conforme';
  return valor > 0 ? 'is-parcial' : 'is-nao-conforme';
}

const SGQAuditoriaExecucao: React.FC = () => {
  const { auditoriaId = '' } = useParams();
  const { user, selectedFilial } = useAuth();
  const execucaoQuery = useSgqAuditoriaExecucao(selectedFilial, auditoriaId);
  const concluir = useConcluirSgqAuditoria(selectedFilial, auditoriaId);
  const { canShowEmpty } = useAsyncQueryState(execucaoQuery);
  const dados = execucaoQuery.data;

  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [filtroClasse, setFiltroClasse] = useState('');
  const [filtroItem, setFiltroItem] = useState('');
  const [busca, setBusca] = useState('');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const ativoRef = useRef<HTMLButtonElement | null>(null);

  const perguntas = useMemo(() => (dados ? montarPerguntas(dados) : []), [dados]);
  // Siglas das normas da auditoria, sem repetir quando mais de uma norma usa a mesma.
  const classificacoes = useMemo(
    () => [...new Map((dados?.normas ?? []).flatMap((n) => n.classificacoes).map((c) => [c.sigla, c])).values()],
    [dados],
  );
  const topicos = useMemo(() => topicosDasPerguntas(perguntas), [perguntas]);
  const respostas = useMemo(
    () => new Map((dados?.respostas ?? []).map((resposta) => [resposta.itemId, resposta])),
    [dados],
  );
  const opcoesPorTipo = useMemo(
    () => new Map((dados?.tiposResposta ?? []).map((tipo) => [tipo.id, tipo.opcoes])),
    [dados],
  );

  const termo = normalizar(busca.trim());
  const lista = perguntas.filter((pergunta) => {
    const { item } = pergunta;
    const resposta = respostas.get(item.id);
    if (filtro === 'pendentes' && resposta?.opcaoCodigo) return false;
    if (filtro === 'respondidas' && !resposta?.opcaoCodigo) return false;
    if ((filtro === 'forte' || filtro === 'fraco') && resposta?.destaque !== filtro) return false;
    if (filtroClasse && item.classificacao !== filtroClasse) return false;
    if (filtroItem && !perguntaNoTopico(pergunta, filtroItem)) return false;
    return !termo || normalizar(`${item.codigo} ${item.titulo}`).includes(termo);
  });

  const atual = perguntas.find((p) => p.item.id === selecionadoId) ?? lista[0] ?? perguntas[0];
  const {
    colegasNaPergunta, colegasPorPergunta, publicarRascunho, publicarDigitando, rascunhoRemoto, rascunhoLocal,
  } = useAuditoriaPresenca(
    auditoriaId,
    atual?.item.id ?? null,
  );
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
  const questionarioConcluido = Boolean(dados?.auditoria.questionarioConcluido) || concluida;
  const ehLider = Boolean(user?.name && dados && mesmoNome(user.name, dados.auditoria.auditorLider));
  const naEquipe = ehLider || Boolean(
    user?.name && dados?.auditoria.auditores.some((nome) => mesmoNome(user.name, nome)),
  );
  const podeResponder = userHasFuncao(user, 'SGQ', 'executar-auditorias') && naEquipe && !questionarioConcluido;
  const [formPendencias, setFormPendencias] = useState(false);
  const pendencias = useMemo(() => (dados ? listarPendencias(dados) : []), [dados]);
  const semPerguntas = Boolean(dados && !dados.itens.some((item) => item.tipo === 'pergunta'));

  const concluirAuditoria = () => {
    if (!window.confirm('Concluir este questionário? As respostas ficam somente para consulta. A auditoria continua em aberto até a conclusão.')) return;
    concluir.mutate(undefined, {
      onSuccess: () => setFormPendencias(false),
      onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível concluir o questionário.')),
    });
  };

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
                <span className={`sgq-aud-status is-${dados.auditoria.statusQuestionario}`}>
                  {SGQ_QUESTIONARIO_STATUS_LABEL[dados.auditoria.statusQuestionario]}
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
        refreshingMessage="Atualizando"
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
                {(classificacoes.length > 0 || topicos.length > 0) && (
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
                    {topicos.length > 0 && (
                      <FiltroLista
                        rotulo="Filtrar por item"
                        placeholder="Item"
                        valor={filtroItem}
                        onChange={setFiltroItem}
                        opcoes={topicos}
                      />
                    )}
                  </div>
                )}
              </div>
              <ul className="sgq-req-nav-lista">
                {lista.length === 0 && <li className="sgq-exec-lista-vazia">Nenhuma pergunta neste filtro.</li>}
                {lista.map(({ item }) => {
                  const resposta = respostas.get(item.id);
                  const previa = rascunhoLocal?.itemId === item.id ? rascunhoLocal : rascunhoRemoto?.itemId === item.id ? rascunhoRemoto : null;
                  const opcaoRemota = previa
                    ? (item.tipoRespostaId ? opcoesPorTipo.get(item.tipoRespostaId) : undefined)?.find((opcao) => opcao.codigo === previa.opcaoCodigo)
                    : undefined;
                  const marca = opcaoRemota
                    ? { opcaoCodigo: opcaoRemota.codigo, opcaoTexto: opcaoRemota.texto, valor: opcaoRemota.valor }
                    : resposta;
                  const ativo = item.id === atual.item.id;
                  const colegasItem = colegasPorPergunta.get(item.id) ?? [];
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
                          <span className={`sgq-exec-marca ${classeResposta(marca)}`} title={marca?.opcaoTexto || 'Sem resposta'}>
                            {marca?.opcaoCodigo || ''}
                          </span>
                          <span className="sgq-req-nav-titulo">{item.codigo} {item.titulo}</span>
                          {colegasItem.length > 0 && (
                            <span className="sgq-exec-nav-colegas" title={colegasItem.map((c) => c.name).join(', ')}>
                              {colegasItem.slice(0, 2).map((colega) => (
                                <UserAvatar key={colega.id} name={colega.name} photo={colega.googlePicture} size="sm" title={colega.name} />
                              ))}
                            </span>
                          )}
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
              colegas={colegasNaPergunta}
              eu={user ? { name: user.name, photo: user.googlePicture } : null}
              publicarRascunho={publicarRascunho}
              publicarDigitando={publicarDigitando}
              podeResponder={podeResponder}
              concluida={questionarioConcluido}
              auditoriaConcluida={concluida}
              onAnterior={anterior ? () => setSelecionadoId(anterior.item.id) : undefined}
              onProxima={proxima ? () => setSelecionadoId(proxima.item.id) : undefined}
              onProximaPendente={proximaPendente ? () => setSelecionadoId(proximaPendente.item.id) : undefined}
              onConcluir={ehLider && !questionarioConcluido ? () => {
                if (semPerguntas || pendencias.length) {
                  setFormPendencias(true);
                  return;
                }
                concluirAuditoria();
              } : undefined}
              concluindo={concluir.isPending}
            />
          </div>
        ) : null}
      </QueryDataPanel>
      {formPendencias && (
        <FormularioPendencias
          auditoriaId={auditoriaId}
          filial={selectedFilial}
          pendencias={pendencias}
          semPerguntas={semPerguntas}
          concluindo={concluir.isPending}
          onFechar={() => setFormPendencias(false)}
          onAbrir={(itemId) => {
            setBusca('');
            setFiltro('todas');
            setFiltroClasse('');
            setFiltroItem('');
            setSelecionadoId(itemId);
            setFormPendencias(false);
          }}
          onConcluir={concluirAuditoria}
        />
      )}
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
  colegas: ColegaPergunta[];
  eu: { name: string; photo: string | null } | null;
  publicarRascunho: (itemId: string, opcaoCodigo: string, destaque?: '' | 'forte' | 'fraco') => void;
  publicarDigitando: (itemId: string | null) => void;
  podeResponder: boolean;
  concluida: boolean;
  auditoriaConcluida?: boolean;
  onAnterior?: () => void;
  onProxima?: () => void;
  onProximaPendente?: () => void;
  onConcluir?: () => void;
  concluindo?: boolean;
}

type Rascunho = { opcaoCodigo: string; observacoes: string; destaque: SgqRespostaDestaque };

const rascunhoIgual = (rascunho: Rascunho, base: SgqAuditoriaResposta | undefined) =>
  rascunho.opcaoCodigo === (base?.opcaoCodigo ?? '')
  && rascunho.observacoes === (base?.observacoes ?? '')
  && rascunho.destaque === (base?.destaque ?? '');

const PerguntaPainel: React.FC<PerguntaPainelProps> = ({
  auditoriaId, filial, pergunta, opcoes, resposta, colegas, eu, publicarRascunho, publicarDigitando,
  podeResponder, concluida, auditoriaConcluida = false,
  onAnterior, onProxima, onProximaPendente,
  onConcluir, concluindo,
}) => {
  const { item, caminho, norma } = pergunta;
  const responder = useResponderSgqAuditoria(filial, auditoriaId);
  const sugerir = useSugerirEvidenciaSgq(filial, auditoriaId);
  const anexar = useAnexarSgqAuditoria(filial, auditoriaId);
  const anexarDrive = useAnexarSgqAuditoriaDoDrive(filial, auditoriaId);
  const excluirAnexo = useExcluirSgqAuditoriaAnexo(filial, auditoriaId);
  const [rascunho, setRascunho] = useState<Rascunho>({
    opcaoCodigo: resposta?.opcaoCodigo ?? '',
    observacoes: resposta?.observacoes ?? '',
    destaque: resposta?.destaque ?? '',
  });
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro' | 'aviso'; texto: string } | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [driveAberto, setDriveAberto] = useState(false);
  const [menuAnexo, setMenuAnexo] = useState(false);
  const arquivoRef = useRef<HTMLInputElement | null>(null);
  const menuAnexoRef = useRef<HTMLDivElement | null>(null);
  const gerandoRef = useRef(false);
  const [revisaoEvidencia, setRevisaoEvidencia] = useState(0);
  const [rascunhoCamilo, setRascunhoCamilo] = useState<{ acao: AcaoCamilo; texto: string; base: string } | null>(null);
  const [escolhendoDestino, setEscolhendoDestino] = useState(false);
  const servidorRef = useRef(resposta);
  const rascunhoRef = useRef(rascunho);
  rascunhoRef.current = rascunho;

  useEffect(() => {
    const anterior = servidorRef.current;
    if (anterior === resposta) return;
    servidorRef.current = resposta;
    const atual = rascunhoRef.current;
    if (rascunhoIgual(atual, resposta)) return;
    const mexeuNaOpcao = atual.opcaoCodigo !== (anterior?.opcaoCodigo ?? '');
    const mexeuNoDestaque = atual.destaque !== (anterior?.destaque ?? '');
    const digitouObservacao = atual.observacoes !== (anterior?.observacoes ?? '');
    setRascunho({
      opcaoCodigo: mexeuNaOpcao ? atual.opcaoCodigo : (resposta?.opcaoCodigo ?? ''),
      observacoes: digitouObservacao ? atual.observacoes : (resposta?.observacoes ?? ''),
      destaque: mexeuNoDestaque ? atual.destaque : (resposta?.destaque ?? ''),
    });
    if (resposta?.respondidoPor) {
      setMensagem({
        tipo: 'aviso',
        texto: digitouObservacao
          ? 'Outra pessoa salvou esta pergunta. O que você digitou continua aqui até salvar de novo.'
          : `${resposta.respondidoPor} atualizou esta pergunta.`,
      });
    }
  }, [resposta]);

  useEffect(() => () => publicarDigitando(null), [publicarDigitando]);

  useEffect(() => {
    if (!menuAnexo) return;
    const fechar = (evento: MouseEvent) => {
      if (!menuAnexoRef.current?.contains(evento.target as Node)) setMenuAnexo(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [menuAnexo]);

  const colegaEscrevendo = colegas.find((colega) => colega.digitandoItemId === item.id);
  const opcaoEscolhida = opcoes.find((o) => o.codigo === rascunho.opcaoCodigo);
  const exigeJustificativa = Boolean(opcaoEscolhida?.exigeJustificativa);
  const classificacao = norma.classificacoes.find((c) => c.sigla === item.classificacao);
  const nomeArea = (sigla: string) => norma.areas.find((a) => a.sigla === sigla)?.nome ?? sigla;
  const anexos = resposta?.anexos ?? [];
  const ocupado = responder.isPending || anexar.isPending || anexarDrive.isPending || excluirAnexo.isPending || sugerir.isPending;
  const filtro = podeResponder && !colegaEscrevendo ? filtroMencao(rascunho.observacoes) : null;
  const funcoesCamilo = filtro === null ? [] : FUNCOES_CAMILO.filter((funcao) => funcaoCombina(funcao.filtro, filtro));

  const pedirCamilo = (acao: AcaoCamilo) => {
    if (gerandoRef.current) return;
    gerandoRef.current = true;
    setEscolhendoDestino(false);
    const base = removerMencao(rascunhoRef.current.observacoes);
    setRascunho({ ...rascunhoRef.current, observacoes: base });
    setRevisaoEvidencia((atual) => atual + 1);
    sugerir.mutate({ itemId: item.id, acao }, {
      onSuccess: ({ texto }) => setRascunhoCamilo({ acao, texto, base }),
      onError: (err) => {
        gerandoRef.current = false;
        setMensagem({ tipo: 'erro', texto: getSgqAuditoriaErrorMessage(err, 'O Camilo não conseguiu preparar o rascunho.') });
      },
    });
  };

  const aceitarRascunho = (modo: 'substituir' | 'frente') => {
    if (!rascunhoCamilo) return;
    const junto = aplicarRascunho(rascunhoCamilo.base, rascunhoCamilo.texto, modo);
    setRascunhoCamilo(null);
    setEscolhendoDestino(false);
    gerandoRef.current = false;
    setRevisaoEvidencia((atual) => atual + 1);
    salvar({ observacoes: junto });
  };

  const descartarRascunho = () => {
    setRascunhoCamilo(null);
    setEscolhendoDestino(false);
    gerandoRef.current = false;
  };

  const salvar = (alteracao: Partial<Rascunho>) => {
    const proximo = { ...rascunho, ...alteracao };
    setRascunho(proximo);
    if ('opcaoCodigo' in alteracao || 'destaque' in alteracao) {
      publicarRascunho(item.id, proximo.opcaoCodigo, proximo.destaque);
    }
    const servidor = servidorRef.current;
    const opcao = opcoes.find((o) => o.codigo === proximo.opcaoCodigo);
    const faltaEvidencia = Boolean(opcao?.exigeJustificativa && proximo.opcaoCodigo && !textoVisivel(proximo.observacoes));
    const preservarOpcao = !('opcaoCodigo' in alteracao) && proximo.opcaoCodigo === (servidor?.opcaoCodigo ?? '');
    const preservarObservacoes = !('observacoes' in alteracao) && proximo.observacoes === (servidor?.observacoes ?? '');
    const preservarDestaque = !('destaque' in alteracao) && proximo.destaque === (servidor?.destaque ?? '');
    const salvo = {
      opcaoCodigo: resposta?.opcaoCodigo ?? '',
      observacoes: resposta?.observacoes ?? '',
      destaque: resposta?.destaque ?? '',
    };
    if (proximo.opcaoCodigo === salvo.opcaoCodigo && normalizarTextoFormatado(proximo.observacoes) === normalizarTextoFormatado(salvo.observacoes)
      && proximo.destaque === salvo.destaque) return;
    setMensagem(null);
    responder.mutate(
      {
        itemId: item.id,
        ...proximo,
        preservarOpcao,
        preservarObservacoes,
        preservarDestaque,
        observacoesBase: servidor?.observacoes ?? '',
      },
      {
        onSuccess: (salva) => setMensagem(salva.conflitoObservacoes
          ? { tipo: 'aviso', texto: 'A outra pessoa salvou a evidência primeiro. O seu texto continua aqui; saia do campo de novo para substituir.' }
          : faltaEvidencia
            ? { tipo: 'aviso', texto: `Resposta "${opcao?.texto}" salva. A evidência/justificativa fica pendente e será exigida ao concluir o questionário.` }
            : { tipo: 'ok', texto: 'Alterações salvas!' }),
        onError: (err) => setMensagem({ tipo: 'erro', texto: getSgqAuditoriaErrorMessage(err, 'Não foi possível salvar a resposta.') }),
      },
    );
  };

  const enviarArquivos = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setMensagem(null);
    try {
      let aviso = '';
      for (const arquivo of Array.from(arquivos)) {
        const salva = await anexar.mutateAsync({ itemId: item.id, arquivo });
        if (salva.driveAviso) aviso = salva.driveAviso;
      }
      setMensagem(aviso
        ? { tipo: 'aviso', texto: `Anexo incluído na auditoria. ${aviso}` }
        : { tipo: 'ok', texto: arquivos.length > 1 ? 'Arquivos enviados para o Google Drive.' : 'Arquivo enviado para o Google Drive.' });
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
          <div className="sgq-exec-titulo-linha">
            <h2>
              {item.codigo && <span className="sgq-exec-codigo">{item.codigo}</span>} {item.titulo}
            </h2>
            {eu && (
              <span className="sgq-exec-colegas">
                <UserAvatar name={eu.name} photo={eu.photo} size="sm" title={eu.name} />
                {colegas.map((colega) => (
                  <UserAvatar key={colega.id} name={colega.name} photo={colega.googlePicture} size="sm" title={colega.name} />
                ))}
              </span>
            )}
          </div>
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
            <i className="bi bi-lock" aria-hidden="true" />
            {auditoriaConcluida
              ? ' Auditoria concluída: as respostas estão somente para consulta.'
              : ' Questionário concluído: as respostas estão somente para consulta. A auditoria segue em aberto até a conclusão.'}
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

        <div className="sgq-exec-bloco">
          <div className="sgq-exec-evidencia-topo">
            <span className="sgq-exec-legenda">
              Evidência/justificativa{exigeJustificativa && <> <em>*</em></>}
            </span>
            {colegaEscrevendo && (
              <span
                className="sgq-exec-digitando"
                title={`${colegaEscrevendo.name} está escrevendo a evidência desta pergunta.`}
              >
                <i className="bi bi-pencil" aria-hidden="true" />
                <UserAvatar name={colegaEscrevendo.name} photo={colegaEscrevendo.googlePicture} size="sm" />
                <span className="sgq-sr-only">{colegaEscrevendo.name} está escrevendo a evidência desta pergunta.</span>
              </span>
            )}
          </div>
          <div className={`sgq-exec-mencao${funcoesCamilo.length > 0 ? ' is-mencao' : ''}`}>
            <EditorTexto
              valor={rascunho.observacoes}
              revisao={revisaoEvidencia}
              rotulo="Evidência/justificativa"
              placeholder={exigeJustificativa
                ? 'Explique a evidência ou por que a pergunta não se aplica. Digite @ para o Camilo.'
                : 'Evidências observadas, entrevistados, documentos verificados... Digite @ para o Camilo.'}
              disabled={!podeResponder || Boolean(colegaEscrevendo) || sugerir.isPending || Boolean(rascunhoCamilo)}
              onChange={(valor) => setRascunho({ ...rascunho, observacoes: valor })}
              onFocus={() => publicarDigitando(item.id)}
              onBlur={(valor) => {
                publicarDigitando(null);
                if (gerandoRef.current) return;
                salvar({ observacoes: valor });
              }}
            />
            {funcoesCamilo.length > 0 && (
              <div className="sgq-exec-mencao-lista" role="listbox" aria-label="Sugestões do Camilo">
                {funcoesCamilo.map((funcao) => (
                  <button
                    key={funcao.acao}
                    type="button"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pedirCamilo(funcao.acao)}
                    disabled={sugerir.isPending}
                  >
                    <i className={funcao.acao === 'validar' ? 'bi bi-patch-check' : 'bi bi-stars'} aria-hidden="true" />
                    <span>
                      <strong>Camilo IA · {funcao.titulo}</strong>
                      <small>{funcao.detalhe}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {sugerir.isPending && (
              <div className="sgq-exec-pensando" role="status">
                <i className="bi bi-stars" aria-hidden="true" />
                <span>Camilo está pensando</span>
                <span className="sgq-exec-pensando-pontos" aria-hidden="true"><i /><i /><i /></span>
              </div>
            )}
            {rascunhoCamilo && !sugerir.isPending && (
              <article className="sgq-exec-rascunho">
                <header>
                  <i className="bi bi-stars" aria-hidden="true" />
                  <div>
                    <strong>Camilo IA</strong>
                    <span>{rascunhoCamilo.acao === 'validar' ? 'Validação dos anexos' : 'Evidência sugerida'}</span>
                  </div>
                </header>
                <p className="sgq-exec-rascunho-texto">{rascunhoCamilo.texto}</p>
                {escolhendoDestino ? (
                  <div className="sgq-exec-rascunho-acoes">
                    <p>Substituir o texto atual ou colocar este rascunho no fim do que já está escrito?</p>
                    <button type="button" onClick={() => aceitarRascunho('substituir')}>Substituir</button>
                    <button type="button" onClick={() => aceitarRascunho('frente')}>No fim</button>
                    <button type="button" className="is-quiet" onClick={() => setEscolhendoDestino(false)}>Voltar</button>
                  </div>
                ) : (
                  <div className="sgq-exec-rascunho-acoes">
                    <button
                      type="button"
                      onClick={() => (textoVisivel(rascunhoCamilo.base) ? setEscolhendoDestino(true) : aceitarRascunho('substituir'))}
                    >
                      Aceitar
                    </button>
                    <button type="button" className="is-quiet" onClick={descartarRascunho}>Descartar</button>
                  </div>
                )}
              </article>
            )}
          </div>
        </div>

        <div
          className={`sgq-exec-bloco${arrastando ? ' is-arrastando' : ''}`}
          onDragOver={(e) => { if (!podeResponder || ocupado) return; e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); if (podeResponder && !ocupado) enviarArquivos(e.dataTransfer.files); }}
        >
          <div className="sgq-exec-evidencia-topo">
            <span className="sgq-exec-legenda">Anexos ({anexos.length})</span>
            {podeResponder && (
              <div className="sgq-exec-anexar" ref={menuAnexoRef}>
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
                  className="sgq-exec-anexar-btn"
                  aria-expanded={menuAnexo}
                  aria-haspopup="menu"
                  disabled={ocupado}
                  onClick={() => setMenuAnexo((aberto) => !aberto)}
                >
                  <i className="bi bi-paperclip" aria-hidden="true" />
                  {anexar.isPending || anexarDrive.isPending ? 'Enviando...' : 'Anexar'}
                </button>
                {menuAnexo && (
                  <div className="sgq-exec-anexar-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setMenuAnexo(false); arquivoRef.current?.click(); }}>
                      <i className="bi bi-upload" aria-hidden="true" /> Do computador
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setMenuAnexo(false); setDriveAberto(true); }}>
                      <i className="bi bi-google" aria-hidden="true" /> Do Google Drive
                    </button>
                  </div>
                )}
                <SGQAuditoriaDrivePicker
                  open={driveAberto}
                  onClose={() => setDriveAberto(false)}
                  onSelect={(arquivo) => {
                    setDriveAberto(false);
                    anexarDrive.mutate(
                      { itemId: item.id, driveFileId: arquivo.id },
                      {
                        onSuccess: () => setMensagem({ tipo: 'ok', texto: 'Anexo do Google Drive incluído.' }),
                        onError: (err) => setMensagem({ tipo: 'erro', texto: getSgqAuditoriaErrorMessage(err, 'Não foi possível anexar o arquivo do Drive.') }),
                      },
                    );
                  }}
                />
              </div>
            )}
          </div>
          {anexos.length === 0 ? (
            <p className="sgq-aud-muted">Nenhum anexo.</p>
          ) : (
            <ul className="sgq-exec-anexos">
              {anexos.map((anexo) => (
                <li key={anexo.id}>
                  <span className="sgq-exec-anexo-icone" aria-hidden="true">
                    <i className="bi bi-file-earmark-text" />
                  </span>
                  <span className="sgq-exec-anexo-corpo">
                    <button
                      type="button"
                      className="sgq-exec-anexo-nome"
                      onClick={() => baixar(anexo.id, anexo.nome)}
                      disabled={baixando === anexo.id}
                      title="Baixar"
                    >
                      {anexo.nome}
                    </button>
                    <span className="sgq-exec-anexo-meta">
                      {formatarTamanho(anexo.tamanho)} · {anexo.incluidoPor || '—'} · {new Date(anexo.criadoEm).toLocaleDateString('pt-BR')}
                    </span>
                  </span>
                  <span className="sgq-exec-anexo-acoes">
                    {anexo.driveUrl && (
                      <a className="sgq-exec-anexo-acao" href={anexo.driveUrl} target="_blank" rel="noreferrer" title="Abrir no Google Drive">
                        <i className="bi bi-google" aria-hidden="true" />
                        <span className="sgq-sr-only">Abrir no Google Drive</span>
                      </a>
                    )}
                    {podeResponder && (
                      <button
                        type="button"
                        className="sgq-exec-anexo-acao is-perigo"
                        onClick={() => removerAnexo(anexo.id, anexo.nome)}
                        disabled={ocupado}
                        aria-label={`Excluir ${anexo.nome}`}
                        title="Excluir anexo"
                      >
                        <i className="bi bi-trash3" aria-hidden="true" />
                      </button>
                    )}
                  </span>
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
        {onConcluir && (
          <button type="button" className="reports-action-btn primary sgq-exec-concluir" onClick={onConcluir} disabled={concluindo}>
            {concluindo ? 'Concluindo...' : 'Concluir questionário'}
          </button>
        )}
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
