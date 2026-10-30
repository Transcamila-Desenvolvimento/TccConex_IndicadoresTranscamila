import React, { useEffect, useMemo, useRef, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import EditorTexto, { normalizarTextoFormatado, TextoFormatado, textoVisivel } from './SGQEditorTexto';
import SGQAuditoriaCronogramaEmailModal from './SGQAuditoriaCronogramaEmailModal';
import SGQAuditoriaResultados from './SGQAuditoriaResultados';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getSgqAuditoriaErrorMessage,
  useBaixarRelatorioSgqAuditoria,
  useDeleteSgqAuditoriaFormDraft,
  useDeleteSgqAuditorias,
  useSaveSgqAuditoria,
  useSaveSgqAuditoriaFormDraft,
  useSgqAuditoriaFormDraft,
  useSgqAuditorias,
  useSgqAuditoriasResumo,
  useSgqAuditoriasSugestoes,
} from '../../hooks/useSgqAuditorias';
import type {
  SgqAuditoria,
  SgqAuditoriaOrdering,
  SgqAuditoriaPayload,
  SgqAuditoriaPlanejamento,
  SgqAuditoriaQueryParams,
  SgqAuditoriaStatus,
  SgqPessoa,
} from '../../types/domain';
import { SGQ_AUDITORIA_STATUS_LABEL, SGQ_AUDITORIA_STATUS_OPTIONS } from '../../types/domain';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
type FiltroStatus = NonNullable<SgqAuditoriaQueryParams['status']>;

const FILTROS: Array<{ value: FiltroStatus; label: string; resumo: 'total' | SgqAuditoriaStatus | 'atrasada' }> = [
  { value: '', label: 'Status: Todos', resumo: 'total' },
  { value: 'planejamento', label: 'Em planejamento', resumo: 'planejamento' },
  { value: 'execucao', label: 'Em execução', resumo: 'execucao' },
  { value: 'concluida', label: 'Concluídas', resumo: 'concluida' },
  { value: 'atrasada', label: 'Atrasadas', resumo: 'atrasada' },
];

const STATUS_ICON: Record<SgqAuditoriaStatus, string> = {
  planejamento: 'hourglass-split',
  execucao: 'play-circle',
  concluida: 'check-circle-fill',
};

type AbaModal = 'visao' | 'dados' | 'planejamento';

const ABAS_MODAL: Array<{ value: AbaModal; label: string }> = [
  { value: 'visao', label: 'Visão geral' },
  { value: 'dados', label: 'Geral' },
  { value: 'planejamento', label: 'Itens do Planejamento' },
];

function formatarDataHora(iso: string) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function partesNome(nome: string) {
  return nome.trim().split(/\s+/).filter(Boolean);
}

function iniciais(nome: string) {
  const partes = partesNome(nome);
  if (!partes.length) return '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}

function nomeAbreviado(nome: string) {
  const partes = partesNome(nome);
  if (partes.length <= 2) return partes.join(' ');
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

const AvatarPessoa: React.FC<{ nome: string; foto?: string }> = ({ nome, foto }) => {
  const [falhou, setFalhou] = useState(false);
  const url = foto?.trim();
  useEffect(() => setFalhou(false), [url]);
  if (url && !falhou) {
    return (
      <span className="sgq-pessoa-avatar" aria-hidden="true">
        <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFalhou(true)} />
      </span>
    );
  }
  return <span className="sgq-pessoa-avatar" aria-hidden="true">{iniciais(nome)}</span>;
};

const PessoaResumo: React.FC<{ nome: string; foto?: string }> = ({ nome, foto }) => {
  const curto = nomeAbreviado(nome);
  return (
    <span className="sgq-pessoa-resumo" title={nome}>
      <AvatarPessoa nome={nome} foto={foto} />
      <span className="sgq-pessoa-nome">{curto}</span>
    </span>
  );
};

interface SeletorPessoaProps {
  valor: string;
  opcoes: SgqPessoa[];
  carregando: boolean;
  placeholder: string;
  vazio: string;
  obrigatorio?: boolean;
  disabled?: boolean;
  onChange: (valor: string) => void;
}

const SeletorPessoa: React.FC<SeletorPessoaProps> = ({ valor, opcoes, carregando, placeholder, vazio, obrigatorio = true, disabled = false, onChange }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const selecionada = opcoes.find((pessoa) => pessoa.nome === valor);

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const fecharEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharEsc);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharEsc);
    };
  }, [aberto]);

  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const filtradas = termo
    ? opcoes.filter((pessoa) => `${pessoa.nome} ${pessoa.cargo}`.toLocaleLowerCase('pt-BR').includes(termo))
    : opcoes;

  const escolher = (nome: string) => {
    onChange(nome);
    setAberto(false);
  };

  const navegar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      setDestaque((atual) => Math.min(Math.max(atual + passo, 0), Math.max(filtradas.length - 1, 0)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtradas[destaque]) escolher(filtradas[destaque].nome);
    }
  };

  return (
    <div className="sgq-pessoa" ref={raiz}>
      <button
        type="button"
        className={`sgq-pessoa-campo${aberto ? ' is-aberto' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setBusca('');
          setDestaque(Math.max(opcoes.findIndex((pessoa) => pessoa.nome === valor), 0));
          setAberto((atual) => !atual);
        }}
      >
        {valor ? (
          <>
            <AvatarPessoa nome={valor} foto={selecionada?.foto} />
            <span className="sgq-pessoa-texto">
              <span className="sgq-pessoa-nome">{valor}</span>
              {selecionada?.cargo && <small>{selecionada.cargo}</small>}
            </span>
          </>
        ) : (
          <span className="sgq-pessoa-placeholder">{carregando ? 'Carregando...' : placeholder}</span>
        )}
        <i className={`bi bi-chevron-${aberto ? 'up' : 'down'}`} aria-hidden="true" />
      </button>
      {obrigatorio && (
        <input className="sgq-pessoa-validacao" required value={valor} onChange={() => undefined} tabIndex={-1} aria-hidden="true" />
      )}
      {aberto && !disabled && (
        <div className="sgq-pessoa-menu">
          <div className="sgq-pessoa-busca">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setDestaque(0); }}
              onKeyDown={navegar}
              placeholder="Buscar por nome ou cargo..."
              aria-label="Buscar pessoa"
              autoFocus
            />
          </div>
          <ul role="listbox">
            {filtradas.map((pessoa, indice) => {
              const marcada = pessoa.nome === valor;
              return (
                <li key={pessoa.nome}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={marcada}
                    className={`sgq-pessoa-opcao${marcada ? ' is-selecionada' : ''}${indice === destaque ? ' is-destaque' : ''}`}
                    onMouseEnter={() => setDestaque(indice)}
                    onClick={() => escolher(pessoa.nome)}
                  >
                    <AvatarPessoa nome={pessoa.nome} foto={pessoa.foto} />
                    <span className="sgq-pessoa-texto">
                      <span className="sgq-pessoa-nome">{pessoa.nome}</span>
                      {pessoa.cargo && <small>{pessoa.cargo}</small>}
                    </span>
                    {marcada && <i className="bi bi-check2" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
            {!filtradas.length && (
              <li className="sgq-pessoa-vazio">
                <i className="bi bi-person-x" aria-hidden="true" />
                {carregando ? 'Carregando...' : opcoes.length ? 'Nenhuma pessoa encontrada.' : vazio}
              </li>
            )}
          </ul>
          {opcoes.length > 0 && (
            <div className="sgq-pessoa-rodape">
              <i className="bi bi-people" aria-hidden="true" />
              {opcoes.length} {opcoes.length === 1 ? 'pessoa' : 'pessoas'} com o SGQ liberado
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CAMPOS_PLANO_OPCIONAIS = [
  ['criterios', 'Critérios', 'Normas, políticas e requisitos usados como referência.'],
  ['processosAreas', 'Processos e áreas a serem auditados', 'Processos e áreas incluídos na auditoria.'],
  ['responsaveisProcessos', 'Responsáveis pelo processo', 'Quem responde pelos processos auditados.'],
  ['metodologia', 'Metodologia', 'Como a auditoria será conduzida.'],
] as const;

const emptyForm: SgqAuditoriaPayload = {
  titulo: '',
  categoria: '',
  dataInicio: '',
  dataTermino: '',
  auditorLider: '',
  auditores: [],
  status: 'planejamento',
  escopo: '',
  criterios: '',
  processosAreas: '',
  responsaveisProcessos: '',
  metodologia: '',
  planejamento: [],
};

function formatarData(iso: string) {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function horaAgenda(valor: string) {
  return valor.slice(0, 5).replace(':', 'h');
}

function mesmoNome(a: string, b: string) {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

function formatarHoraRascunho(iso: string | null): string {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formDoRascunho(origem: Partial<SgqAuditoriaPayload> | undefined): SgqAuditoriaPayload {
  const base = origem ?? {};
  const status = base.status === 'execucao' || base.status === 'concluida' ? base.status : 'planejamento';
  return {
    ...emptyForm,
    ...base,
    status,
    auditores: Array.isArray(base.auditores) ? base.auditores.filter((nome) => typeof nome === 'string') : [],
    planejamento: Array.isArray(base.planejamento)
      ? base.planejamento.map((item) => ({
        data: item?.data ?? '',
        horaInicio: item?.horaInicio ?? '',
        horaFim: item?.horaFim ?? '',
        atividade: item?.atividade ?? '',
      }))
      : [],
  };
}

function rotuloPlanejamento(item: SgqAuditoriaPlanejamento) {
  if (!item.data || !item.horaInicio || !item.horaFim || !item.atividade.trim()) return '';
  const [ano, mes, dia] = item.data.split('-');
  return `${dia}/${mes}/${ano} - ${horaAgenda(item.horaInicio)} às ${horaAgenda(item.horaFim)} - ${item.atividade.trim()}`;
}

const SGQAuditorias: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const canManage = userHasFuncao(user, 'SGQ', 'gerenciar-auditorias');

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('');
  const [ordering, setOrdering] = useState<SgqAuditoriaOrdering>('-data_inicio');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<SgqAuditoria | null>(null);
  const podeAlterarEquipe = !editando || mesmoNome(user?.name ?? '', editando.auditorLider);
  const [form, setForm] = useState<SgqAuditoriaPayload>(emptyForm);
  const [abaModal, setAbaModal] = useState<AbaModal>('dados');
  const [relatorioDe, setRelatorioDe] = useState<SgqAuditoria | null>(null);
  const [cronogramaDe, setCronogramaDe] = useState<SgqAuditoria | null>(null);
  const [tipoRelatorio, setTipoRelatorio] = useState<'detalhado' | 'analitico'>('detalhado');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    if (!acoesAbertas) return;
    const fechar = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.reports-dropdown-wrapper')) setAcoesAbertas(false);
    };
    document.addEventListener('click', fechar);
    return () => document.removeEventListener('click', fechar);
  }, [acoesAbertas]);

  const params: SgqAuditoriaQueryParams = { page, pageSize, search: buscaAplicada, status: filtroStatus, ordering };
  const listaQuery = useSgqAuditorias(selectedFilial, params);
  const { canShowEmpty } = useAsyncQueryState(listaQuery);
  const resumoQuery = useSgqAuditoriasResumo(selectedFilial);
  const sugestoesQuery = useSgqAuditoriasSugestoes(selectedFilial, true);
  const salvar = useSaveSgqAuditoria();
  const formDraftQuery = useSgqAuditoriaFormDraft(canManage ? selectedFilial : null);
  const saveFormDraft = useSaveSgqAuditoriaFormDraft(selectedFilial);
  const deleteFormDraft = useDeleteSgqAuditoriaFormDraft(selectedFilial);
  const skipNextFormDraftSave = useRef(true);
  const registroConcluido = useRef(false);
  const filialDoRascunho = useRef(selectedFilial);
  const [hydratedFormDraft, setHydratedFormDraft] = useState(false);
  const [restoredFormDraft, setRestoredFormDraft] = useState(false);
  const [formDraftUpdatedAt, setFormDraftUpdatedAt] = useState<string | null>(null);
  const [formDraftUnavailable, setFormDraftUnavailable] = useState(false);
  const formBusy = salvar.isPending || deleteFormDraft.isPending;
  const hasFormDraft = Boolean(formDraftQuery.data?.hasDraft);
  const excluir = useDeleteSgqAuditorias();
  const baixarRelatorio = useBaixarRelatorioSgqAuditoria(selectedFilial);

  const linhas = listaQuery.data?.results ?? [];
  const total = listaQuery.data?.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const resumo = resumoQuery.data;
  const sugestoes = sugestoesQuery.data;
  // A categoria atual de uma auditoria em edição continua selecionável mesmo se tiver sido inativada.
  const categoriasAtivas = (sugestoes?.categorias ?? []).map((categoria) => categoria.nome);
  const categoriasOpcoes = editando?.categoria && !categoriasAtivas.includes(editando.categoria)
    ? [editando.categoria, ...categoriasAtivas]
    : categoriasAtivas;
  const auditoresSgq = sugestoes?.auditores ?? [];
  const auditoresOpcoes = editando?.auditorLider && !auditoresSgq.some((pessoa) => pessoa.nome === editando.auditorLider)
    ? [{ nome: editando.auditorLider, cargo: '', foto: '' }, ...auditoresSgq]
    : auditoresSgq;
  const fotosPorNome = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const pessoa of auditoresSgq) {
      if (pessoa.foto?.trim()) mapa.set(pessoa.nome, pessoa.foto);
    }
    return mapa;
  }, [auditoresSgq]);
  // Mantida a categoria, a auditoria em edição conserva as normas já vinculadas; trocada, recebe as da nova categoria.
  const normasDoForm = editando && form.categoria === editando.categoria
    ? editando.normas
    : sugestoes?.categorias.find((opcao) => opcao.nome === form.categoria)?.normas ?? [];

  const todasDaPaginaMarcadas = linhas.length > 0 && linhas.every((linha) => selecionadas.has(linha.id));
  const algumaDaPaginaMarcada = linhas.some((linha) => selecionadas.has(linha.id));
  const filtrando = Boolean(buscaAplicada || filtroStatus);
  const paginaAtual = Math.min(page, totalPaginas);
  const auditoriaSelecionada = selecionadas.size === 1 ? linhas.find((linha) => selecionadas.has(linha.id)) : undefined;

  const mudarFiltro = (valor: FiltroStatus) => {
    setFiltroStatus(valor);
    setPage(1);
    setSelecionadas(new Set());
  };

  const limparFiltros = () => {
    setBusca('');
    setBuscaAplicada('');
    mudarFiltro('');
  };

  const alternarOrdenacao = (campo: 'data_inicio' | 'data_termino' | 'codigo' | 'titulo') => {
    setOrdering((atual) => (atual === `-${campo}` ? campo : `-${campo}`) as SgqAuditoriaOrdering);
    setPage(1);
  };

  const iconeOrdenacao = (campo: string) => {
    if (ordering === campo) return 'bi-arrow-up';
    if (ordering === `-${campo}`) return 'bi-arrow-down';
    return 'bi-arrow-down-up is-idle';
  };

  const alternarSelecao = (id: string) => {
    setSelecionadas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(id)) proxima.delete(id);
      else proxima.add(id);
      return proxima;
    });
  };

  const alternarPagina = () => {
    setSelecionadas((atual) => {
      const proxima = new Set(atual);
      linhas.forEach((linha) => (todasDaPaginaMarcadas ? proxima.delete(linha.id) : proxima.add(linha.id)));
      return proxima;
    });
  };

  const abrirNova = () => {
    setEditando(null);
    setAbaModal('dados');
    setRestoredFormDraft(false);
    setFormDraftUpdatedAt(null);
    setFormDraftUnavailable(false);
    setHydratedFormDraft(false);
    registroConcluido.current = false;
    setModalAberto(true);
  };

  const abrirEdicao = (auditoria: SgqAuditoria) => {
    setAcoesAbertas(false);
    setEditando(auditoria);
    setForm({
      titulo: auditoria.titulo,
      categoria: auditoria.categoria,
      dataInicio: auditoria.dataInicio,
      dataTermino: auditoria.dataTermino,
      auditorLider: auditoria.auditorLider,
      auditores: auditoria.auditores ?? [],
      status: auditoria.status,
      escopo: auditoria.escopo,
      criterios: auditoria.criterios ?? '',
      processosAreas: auditoria.processosAreas ?? '',
      responsaveisProcessos: auditoria.responsaveisProcessos ?? '',
      metodologia: auditoria.metodologia ?? '',
      planejamento: auditoria.planejamento ?? [],
    });
    setAbaModal('visao');
    setModalAberto(true);
  };

  const periodoValido = Boolean(form.dataInicio && form.dataTermino && form.dataTermino >= form.dataInicio);

  const alterarPlanejamento = (indice: number, parcial: Partial<SgqAuditoriaPlanejamento>) => {
    setForm((atual) => ({
      ...atual,
      planejamento: atual.planejamento.map((item, i) => (i === indice ? { ...item, ...parcial } : item)),
    }));
  };

  const adicionarPlanejamento = () => {
    if (!periodoValido) return;
    setForm((atual) => ({
      ...atual,
      planejamento: [
        ...atual.planejamento,
        { data: atual.dataInicio, horaInicio: '08:00', horaFim: '08:30', atividade: '' },
      ],
    }));
  };

  const fecharModal = () => {
    if (formBusy) return;
    if (!editando && hydratedFormDraft && !formDraftUnavailable && selectedFilial && canManage && !registroConcluido.current) {
      skipNextFormDraftSave.current = true;
      saveFormDraft.mutate(form);
    }
    setModalAberto(false);
    setEditando(null);
  };

  useEffect(() => {
    if (filialDoRascunho.current === selectedFilial) return;
    filialDoRascunho.current = selectedFilial;
    setHydratedFormDraft(false);
  }, [selectedFilial]);

  useEffect(() => {
    if (!modalAberto || editando) return;
    if (hydratedFormDraft) return;
    if (formDraftQuery.isLoading && !formDraftQuery.data) return;

    if (formDraftQuery.isError) {
      setForm(emptyForm);
      setFormDraftUnavailable(true);
      setHydratedFormDraft(true);
      skipNextFormDraftSave.current = true;
      return;
    }

    const draft = formDraftQuery.data;
    if (draft?.hasDraft && draft.form) {
      setForm(formDoRascunho(draft.form));
      setFormDraftUpdatedAt(draft.updatedAt);
      setRestoredFormDraft(true);
      setFormDraftUnavailable(false);
    } else {
      setForm(emptyForm);
      setFormDraftUpdatedAt(null);
      setRestoredFormDraft(false);
    }
    setHydratedFormDraft(true);
    skipNextFormDraftSave.current = true;
  }, [modalAberto, editando, hydratedFormDraft, formDraftQuery.data, formDraftQuery.isError, formDraftQuery.isLoading]);

  useEffect(() => {
    if (!modalAberto || editando || !hydratedFormDraft || formDraftUnavailable || !selectedFilial || !canManage) return;
    if (registroConcluido.current) return;
    if (skipNextFormDraftSave.current) {
      skipNextFormDraftSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      saveFormDraft.mutate(form, {
        onSuccess: (result) => {
          if (registroConcluido.current) return;
          setFormDraftUpdatedAt(result.hasDraft ? result.updatedAt : null);
          if (!result.hasDraft) setRestoredFormDraft(false);
          setFormDraftUnavailable(false);
        },
        onError: () => setFormDraftUnavailable(true),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [modalAberto, editando, hydratedFormDraft, formDraftUnavailable, selectedFilial, canManage, form]); // eslint-disable-line react-hooks/exhaustive-deps -- debounce do rascunho

  const descartarRascunho = () => {
    if (!window.confirm('Descartar o rascunho desta auditoria? Os dados salvos na sua conta serão apagados.')) return;
    skipNextFormDraftSave.current = true;
    deleteFormDraft.mutate(undefined, {
      onSuccess: () => {
        setRestoredFormDraft(false);
        setFormDraftUpdatedAt(null);
        setForm(emptyForm);
        setModalAberto(false);
        setEditando(null);
      },
      onError: () => alert('Não foi possível descartar o rascunho. Tente novamente.'),
    });
  };

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const invalido = formEl.querySelector<HTMLElement>('input:invalid, select:invalid, textarea:invalid');
    if (invalido) {
      const aba = invalido.closest<HTMLElement>('[data-aba]')?.dataset.aba as AbaModal | undefined;
      if (aba) setAbaModal(aba);
      window.setTimeout(() => formEl.reportValidity());
      return;
    }
    if (form.planejamento.some((item) => item.horaInicio && item.horaFim && item.horaFim <= item.horaInicio)) {
      setAbaModal('planejamento');
      alert('O horário de término precisa ser depois do início.');
      return;
    }
    salvar.mutate(
      {
        id: editando?.id,
        payload: {
          ...form,
          titulo: form.titulo.trim(),
          categoria: form.categoria.trim(),
          escopo: normalizarTextoFormatado(form.escopo),
          criterios: normalizarTextoFormatado(form.criterios),
          processosAreas: normalizarTextoFormatado(form.processosAreas),
          responsaveisProcessos: normalizarTextoFormatado(form.responsaveisProcessos),
          metodologia: normalizarTextoFormatado(form.metodologia),
          planejamento: form.planejamento.map((item) => ({ ...item, atividade: item.atividade.trim() })),
        },
      },
      {
        onSuccess: () => {
          if (!editando) {
            registroConcluido.current = true;
            skipNextFormDraftSave.current = true;
            deleteFormDraft.mutate(undefined, {
              onSettled: () => { setModalAberto(false); setEditando(null); },
            });
            return;
          }
          setModalAberto(false);
          setEditando(null);
        },
        onError: (err) => alert(getSgqAuditoriaErrorMessage(err)),
      },
    );
  };

  const excluirIds = (ids: string[], descricao: string) => {
    setAcoesAbertas(false);
    if (!window.confirm(`Excluir ${descricao}? Essa ação não pode ser desfeita.`)) return;
    excluir.mutate(ids, {
      onSuccess: () => setSelecionadas((atual) => {
        const proxima = new Set(atual);
        ids.forEach((id) => proxima.delete(id));
        return proxima;
      }),
      onError: (err) => alert(getSgqAuditoriaErrorMessage(err)),
    });
  };

  return (
    <div className="fat-list-compact sgq-lista">
      <header className="view-header sgq-lista-header">
        <div className="sgq-lista-titulo">
          <span className="sgq-lista-marcador" aria-hidden="true" />
          <h1 className="view-page-title">Auditorias</h1>
        </div>
        <div className="sgq-lista-acoes">
          <div className="reports-dropdown-wrapper">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={selecionadas.size === 0}
              onClick={() => setAcoesAbertas((aberto) => !aberto)}
            >
              <span>Ações{selecionadas.size > 0 ? ` (${selecionadas.size})` : ''}</span>
              <i className="bi bi-chevron-down" aria-hidden="true" />
            </button>
            <div className={`reports-dropdown-menu ${acoesAbertas ? 'show' : ''}`}>
              {auditoriaSelecionada && (
                <span className="reports-dropdown-item" onClick={() => abrirEdicao(auditoriaSelecionada)}>
                  <span className="reports-dropdown-item-left">
                    <i className={`bi ${canManage ? 'bi-pencil' : 'bi-eye'}`} aria-hidden="true" />
                    {canManage ? 'Editar' : 'Visualizar'}
                  </span>
                </span>
              )}
              {auditoriaSelecionada && (
                <span
                  className="reports-dropdown-item"
                  onClick={() => {
                    setRelatorioDe(auditoriaSelecionada);
                    setTipoRelatorio('detalhado');
                    setAcoesAbertas(false);
                  }}
                >
                  <span className="reports-dropdown-item-left">
                    <i className="bi bi-file-earmark-bar-graph" aria-hidden="true" />
                    Relatórios
                  </span>
                </span>
              )}
              {auditoriaSelecionada && (
                <span
                  className="reports-dropdown-item"
                  onClick={() => {
                    setCronogramaDe(auditoriaSelecionada);
                    setAcoesAbertas(false);
                  }}
                >
                  <span className="reports-dropdown-item-left">
                    <i className="bi bi-envelope" aria-hidden="true" />
                    Enviar cronograma
                  </span>
                </span>
              )}
              {canManage && (
                <span
                  className={`reports-dropdown-item is-danger${excluir.isPending ? ' is-disabled' : ''}`}
                  onClick={() => excluirIds(
                    [...selecionadas],
                    auditoriaSelecionada ? `a auditoria ${auditoriaSelecionada.codigo}` : `${selecionadas.size} auditorias`,
                  )}
                >
                  <span className="reports-dropdown-item-left">
                    <i className="bi bi-trash3" aria-hidden="true" />
                    {excluir.isPending ? 'Excluindo...' : 'Excluir'}
                  </span>
                </span>
              )}
            </div>
          </div>
          {canManage && (
            hasFormDraft ? (
              <button
                type="button"
                className="reports-action-btn primary"
                style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
                onClick={abrirNova}
                title="Continuar rascunho da auditoria"
              >
                <i className="bi bi-journal-text" aria-hidden="true" />
                <span>Rascunho</span>
              </button>
            ) : (
              <button type="button" className="reports-action-btn primary" onClick={abrirNova}>
                <i className="bi bi-plus-lg" aria-hidden="true" />
                <span>Nova auditoria</span>
              </button>
            )
          )}
        </div>
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-filter-icon-label">
            <i className="bi bi-funnel" aria-hidden="true" />
            <span>Filtrar</span>
          </div>
          <div className="reports-search-wrapper">
            <i className="bi bi-search search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar auditoria..."
              title="Busca por código, título, norma ou auditor"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar auditorias"
            />
          </div>
          <div className="reports-select-wrapper">
            <select
              value={filtroStatus}
              onChange={(e) => mudarFiltro(e.target.value as FiltroStatus)}
              aria-label="Filtrar por status"
            >
              {FILTROS.map((filtro) => (
                <option key={filtro.value || 'todas'} value={filtro.value}>
                  {filtro.label}{resumo ? ` (${resumo[filtro.resumo]})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="reports-action-btn secondary" onClick={limparFiltros} disabled={!filtrando && !busca}>
            Limpar Filtros
          </button>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{total}</strong> {total === 1 ? 'Auditoria' : 'Auditorias'}</span>
        </div>
      </div>

      <QueryDataPanel
        query={listaQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando auditorias..."
        refreshingMessage="Atualizando auditorias..."
        errorMessage="Não foi possível carregar as auditorias. Tente novamente."
      >
        <div className="erp-card reports-table-card sgq-lista-card">
          <div className="table-container sgq-lista-scroll">
            <table className="erp-table reports-table sgq-lista-tabela">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas da página"
                      checked={todasDaPaginaMarcadas}
                      ref={(el) => { if (el) el.indeterminate = algumaDaPaginaMarcada && !todasDaPaginaMarcadas; }}
                      onChange={alternarPagina}
                    />
                  </th>
                  <th>Categoria</th>
                  <th>
                    <button type="button" className="sgq-aud-sort" onClick={() => alternarOrdenacao('codigo')}>
                      Código <i className={`bi ${iconeOrdenacao('codigo')}`} aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sgq-aud-sort" onClick={() => alternarOrdenacao('titulo')}>
                      Título <i className={`bi ${iconeOrdenacao('titulo')}`} aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sgq-aud-sort" onClick={() => alternarOrdenacao('data_inicio')}>
                      Início <i className={`bi ${iconeOrdenacao('data_inicio')}`} aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sgq-aud-sort" onClick={() => alternarOrdenacao('data_termino')}>
                      Término <i className={`bi ${iconeOrdenacao('data_termino')}`} aria-hidden="true" />
                    </button>
                  </th>
                  <th>Normas</th>
                  <th>Auditor líder</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="comercial-browse-empty">
                      {filtrando ? 'Nenhuma auditoria encontrada para os filtros aplicados.' : 'Não há registros a serem exibidos.'}
                    </td>
                  </tr>
                ) : (
                  linhas.map((auditoria) => {
                    const normas = auditoria.normas.map((norma) => norma.nome);
                    const marcada = selecionadas.has(auditoria.id);
                    return (
                      <tr key={auditoria.id} className={marcada ? 'row-selected' : undefined}>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar auditoria ${auditoria.codigo}`}
                            checked={marcada}
                            onChange={() => alternarSelecao(auditoria.id)}
                          />
                        </td>
                        <td><span className="sgq-lista-categoria">{auditoria.categoria}</span></td>
                        <td><span className="sgq-aud-codigo">{auditoria.codigo}</span></td>
                        <td className="sgq-lista-texto-longo" title={auditoria.titulo}>
                          <button type="button" className="sgq-lista-nome" onClick={() => abrirEdicao(auditoria)}>
                            {auditoria.titulo}
                          </button>
                        </td>
                        <td>{formatarData(auditoria.dataInicio)}</td>
                        <td>
                          <span className={auditoria.atrasada ? 'sgq-aud-atrasada' : undefined}>
                            {auditoria.atrasada && <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />}
                            {formatarData(auditoria.dataTermino)}
                          </span>
                        </td>
                        <td>
                          {normas.length ? (
                            <div className="sgq-aud-normas">
                              {normas.slice(0, 2).map((norma) => <span key={norma} className="sgq-aud-chip">{norma}</span>)}
                              {normas.length > 2 && (
                                <span className="sgq-aud-chip is-more" title={normas.slice(2).join(', ')}>+{normas.length - 2}</span>
                              )}
                            </div>
                          ) : <span className="sgq-aud-muted">—</span>}
                        </td>
                        <td>{auditoria.auditorLider ? <PessoaResumo nome={auditoria.auditorLider} foto={fotosPorNome.get(auditoria.auditorLider)} /> : '—'}</td>
                        <td>
                          <span className={`sgq-aud-status is-${auditoria.status}`}>
                            <i className={`bi bi-${STATUS_ICON[auditoria.status]}`} aria-hidden="true" />
                            {SGQ_AUDITORIA_STATUS_LABEL[auditoria.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="sgq-auditorias-page-size">Itens por página</label>
            <select
              id="sgq-auditorias-page-size"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
            </select>
          </div>
          <span className="sgq-lista-pagina">
            Página <span className="erp-pagination-current">{paginaAtual}</span> de{' '}
            <span className="erp-pagination-current">{totalPaginas}</span>
            <span className="erp-pagination-meta">({total} registros)</span>
          </span>
          <button type="button" className="reports-action-btn secondary sgq-lista-pag-btn" disabled={paginaAtual <= 1} onClick={() => setPage(paginaAtual - 1)}>
            <i className="bi bi-chevron-left" aria-hidden="true" />
            Anterior
          </button>
          <button type="button" className="reports-action-btn secondary sgq-lista-pag-btn" disabled={paginaAtual >= totalPaginas} onClick={() => setPage(paginaAtual + 1)}>
            Próximo
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </QueryDataPanel>

      {relatorioDe && (
        <div
          className="search-backdrop sgq-aud-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget && !baixarRelatorio.isPending) setRelatorioDe(null); }}
        >
          <div className="modal-card sgq-aud-relatorio" role="dialog" aria-modal="true" aria-labelledby="sgq-aud-relatorio-title">
            <div className="modal-header">
              <div>
                <h3 id="sgq-aud-relatorio-title">Relatórios</h3>
                <p className="sgq-aud-modal-sub">{relatorioDe.codigo} · {relatorioDe.titulo}</p>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setRelatorioDe(null)}
                disabled={baixarRelatorio.isPending}
                aria-label="Fechar"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <form
              className="modal-body sgq-aud-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (baixarRelatorio.isPending) return;
                baixarRelatorio.mutate(
                  { id: relatorioDe.id, tipo: tipoRelatorio },
                  {
                    onSuccess: () => setRelatorioDe(null),
                    onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível gerar o relatório.')),
                  },
                );
              }}
            >
              <fieldset className="sgq-aud-relatorio-opcoes">
                <legend className="sgq-sr-only">Tipo de relatório</legend>
                <label className={`sgq-aud-relatorio-opcao${tipoRelatorio === 'detalhado' ? ' is-picked' : ''}`}>
                  <input
                    type="radio"
                    name="tipo-relatorio"
                    value="detalhado"
                    checked={tipoRelatorio === 'detalhado'}
                    onChange={() => setTipoRelatorio('detalhado')}
                  />
                  <strong>Relatório detalhado</strong>
                  <span>Registro completo das perguntas, respostas e observações.</span>
                </label>
                <label className={`sgq-aud-relatorio-opcao${tipoRelatorio === 'analitico' ? ' is-picked' : ''}`}>
                  <input
                    type="radio"
                    name="tipo-relatorio"
                    value="analitico"
                    checked={tipoRelatorio === 'analitico'}
                    onChange={() => setTipoRelatorio('analitico')}
                  />
                  <strong>Relatório analítico</strong>
                  <span>Gráficos e o resumo da auditoria, por classificação, área e resposta.</span>
                </label>
              </fieldset>
              <div className="modal-footer">
                <button
                  type="button"
                  className="reports-action-btn secondary"
                  onClick={() => setRelatorioDe(null)}
                  disabled={baixarRelatorio.isPending}
                >
                  Cancelar
                </button>
                <button type="submit" className="reports-action-btn primary" disabled={baixarRelatorio.isPending}>
                  {baixarRelatorio.isPending ? 'Gerando...' : 'Extrair'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cronogramaDe && (
        <SGQAuditoriaCronogramaEmailModal auditoria={cronogramaDe} onClose={() => setCronogramaDe(null)} />
      )}

      {modalAberto && !editando && !hydratedFormDraft && (
        <div className="search-backdrop sgq-aud-modal-backdrop">
          <div className="modal-card sgq-aud-modal" role="dialog" aria-modal="true" aria-busy="true">
            <div className="modal-header">
              <div>
                <h3>Nova Auditoria</h3>
                <p className="sgq-aud-modal-sub">Carregando rascunho...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalAberto && (editando || hydratedFormDraft) && (
        <div className="search-backdrop sgq-aud-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) fecharModal(); }}>
          <div className="modal-card sgq-aud-modal is-fixo" role="dialog" aria-modal="true" aria-labelledby="sgq-aud-modal-title">
            <div className="modal-header">
              <div>
                <h3 id="sgq-aud-modal-title">
                  {editando ? (canManage ? 'Editar Auditoria' : 'Auditoria') : 'Nova Auditoria'}
                </h3>
                <p className="sgq-aud-modal-sub" style={!editando && formDraftUnavailable ? { color: '#b45309' } : undefined}>
                  {editando
                    ? `${editando.codigo} · criada por ${editando.criadoPor || '—'}`
                    : formDraftUnavailable
                      ? 'Rascunho indisponível no servidor — você pode preencher normalmente, mas nada será salvo automaticamente.'
                      : (restoredFormDraft || formDraftUpdatedAt)
                        ? `Rascunho na sua conta${formDraftUpdatedAt ? ` · ${formatarHoraRascunho(formDraftUpdatedAt)}` : ''}${saveFormDraft.isPending ? ' · salvando…' : ''}`
                        : 'O código é gerado automaticamente ao salvar.'}
                </p>
              </div>
              <button type="button" className="btn-icon" onClick={fecharModal} aria-label="Fechar">
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <div className="sgq-aud-abas" role="tablist">
              {ABAS_MODAL.filter((aba) => editando || aba.value !== 'visao').map((aba) => (
                <button
                  key={aba.value}
                  type="button"
                  role="tab"
                  aria-selected={abaModal === aba.value}
                  className={`sgq-aud-aba${abaModal === aba.value ? ' is-active' : ''}`}
                  onClick={() => setAbaModal(aba.value)}
                >
                  {aba.label}
                </button>
              ))}
            </div>

            <form className="modal-body sgq-aud-form" onSubmit={enviar} noValidate>
              <div className="sgq-aud-form-corpo">
              {editando && (
                <section className="sgq-aud-ficha" hidden={abaModal !== 'visao'} aria-label="Resumo da auditoria">
                  <header className="sgq-aud-ficha-topo">
                    <div className="sgq-aud-ficha-id">
                      <span className="sgq-aud-codigo">{editando.codigo}</span>
                      <h4>{editando.titulo}</h4>
                    </div>
                    <span className={`sgq-aud-status is-${editando.status}`}>
                      <i className={`bi bi-${STATUS_ICON[editando.status]}`} aria-hidden="true" />
                      {SGQ_AUDITORIA_STATUS_LABEL[editando.status]}
                    </span>
                  </header>
                  <dl className="sgq-aud-ficha-grade">
                    <div>
                      <dt>Categoria</dt>
                      <dd>{editando.categoria || '—'}</dd>
                    </div>
                    <div>
                      <dt>Período</dt>
                      <dd>
                        <span className={editando.atrasada ? 'sgq-aud-atrasada' : undefined}>
                          {editando.atrasada && <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />}
                          {formatarData(editando.dataInicio)} a {formatarData(editando.dataTermino)}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Auditor líder</dt>
                      <dd>{editando.auditorLider ? <PessoaResumo nome={editando.auditorLider} foto={fotosPorNome.get(editando.auditorLider)} /> : '—'}</dd>
                    </div>
                    <div>
                      <dt>Auditores</dt>
                      <dd>
                        {editando.auditores?.length ? (
                          <div className="sgq-aud-auditores">
                            {editando.auditores.map((nome) => <PessoaResumo key={nome} nome={nome} foto={fotosPorNome.get(nome)} />)}
                          </div>
                        ) : '—'}
                      </dd>
                    </div>
                    <div className="sgq-aud-ficha-largo">
                      <dt>Normas</dt>
                      <dd>
                        {editando.normas.length ? (
                          <div className="sgq-aud-normas">
                            {editando.normas.map((norma) => <span key={norma.id} className="sgq-aud-chip">{norma.nome}</span>)}
                          </div>
                        ) : '—'}
                      </dd>
                    </div>
                    {textoVisivel(editando.escopo) && (
                      <div className="sgq-aud-ficha-largo">
                        <dt>Escopo / objetivo</dt>
                        <dd className="sgq-aud-visao-texto"><TextoFormatado valor={editando.escopo} /></dd>
                      </div>
                    )}
                    {CAMPOS_PLANO_OPCIONAIS.map(([campo, rotulo]) => {
                      const texto = editando[campo] ?? '';
                      if (!textoVisivel(texto)) return null;
                      return (
                        <div key={campo} className="sgq-aud-ficha-largo">
                          <dt>{rotulo}</dt>
                          <dd className="sgq-aud-visao-texto"><TextoFormatado valor={texto} /></dd>
                        </div>
                      );
                    })}
                    {(editando.planejamento?.length ?? 0) > 0 && (
                      <div className="sgq-aud-ficha-largo">
                        <details className="sgq-aud-plano-expansivel">
                          <summary>
                            <span>Planejamento</span>
                            <span className="sgq-aud-plano-expansivel-meta">
                              {editando.planejamento.length}
                              <i className="bi bi-chevron-down" aria-hidden="true" />
                            </span>
                          </summary>
                          <ul className="sgq-aud-plano-lista">
                            {editando.planejamento.map((item, indice) => (
                              <li key={`${item.data}-${indice}`}>{rotuloPlanejamento(item)}</li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    )}
                  </dl>
                  <footer className="sgq-aud-ficha-rodape">
                    <span>Criada por {editando.criadoPor || '—'} · {formatarDataHora(editando.criadoEm)}</span>
                    <span>Atualizada em {formatarDataHora(editando.atualizadoEm)}</span>
                  </footer>
                </section>
              )}
              {editando && abaModal === 'visao' && (
                <SGQAuditoriaResultados auditoriaId={editando.id} />
              )}
              <fieldset data-aba="dados" hidden={abaModal !== 'dados'} disabled={!canManage || formBusy}>
                <label className="is-wide">
                  <span>Título <em>*</em></span>
                  <input
                    className="form-input"
                    required
                    maxLength={200}
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ex.: Auditoria interna - ISO 9001:2015"
                    autoFocus
                  />
                </label>
                <label>
                  <span>Categoria <em>*</em></span>
                  <select
                    className="form-input"
                    required
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  >
                    <option value="" disabled>
                      {sugestoesQuery.isLoading ? 'Carregando...' : categoriasOpcoes.length ? 'Selecione' : 'Nenhuma categoria ativa cadastrada'}
                    </option>
                    {categoriasOpcoes.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                  </select>
                </label>
                <div className="sgq-aud-campo">
                  <span>Normas</span>
                  <div
                    className="form-input sgq-aud-normas sgq-aud-normas-campo"
                    aria-disabled="true"
                    title="As normas são definidas pela categoria"
                  >
                    {normasDoForm.length
                      ? normasDoForm.map((norma) => <span key={norma.id} className="sgq-aud-chip">{norma.nome}</span>)
                      : (
                        <span className="sgq-aud-normas-placeholder">
                          {form.categoria ? 'Nenhuma norma vinculada a esta categoria' : 'Selecione a categoria'}
                        </span>
                      )}
                  </div>
                </div>
                <div className="is-wide sgq-aud-campo">
                  <span>Auditor líder <em>*</em></span>
                  <SeletorPessoa
                    valor={form.auditorLider}
                    opcoes={auditoresOpcoes}
                    carregando={sugestoesQuery.isLoading}
                    placeholder="Selecione o auditor líder"
                    vazio="Nenhum usuário com o SGQ liberado."
                    disabled={!podeAlterarEquipe}
                    onChange={(nome) => setForm({
                      ...form,
                      auditorLider: nome,
                      auditores: form.auditores.filter((auditor) => auditor !== nome),
                    })}
                  />
                </div>
                <div className="is-wide sgq-aud-campo">
                  <span>Auditores <em>*</em></span>
                  <input
                    className="sgq-pessoa-validacao"
                    required
                    value={form.auditores.join(', ')}
                    onChange={() => undefined}
                    onInvalid={(e) => e.currentTarget.setCustomValidity('Selecione ao menos um auditor.')}
                    ref={(elemento) => { elemento?.setCustomValidity(''); }}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  {form.auditores.length > 0 && (
                    <div className="sgq-aud-auditores">
                      {form.auditores.map((nome) => (
                        <span key={nome} className="sgq-aud-auditor">
                          <PessoaResumo nome={nome} foto={fotosPorNome.get(nome)} />
                          {podeAlterarEquipe && (
                            <button
                              type="button"
                              aria-label={`Remover ${nome}`}
                              onClick={() => setForm({ ...form, auditores: form.auditores.filter((auditor) => auditor !== nome) })}
                            >
                              <i className="bi bi-x" aria-hidden="true" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  <SeletorPessoa
                    valor=""
                    obrigatorio={false}
                    opcoes={auditoresOpcoes.filter((pessoa) => pessoa.nome !== form.auditorLider && !form.auditores.includes(pessoa.nome))}
                    carregando={sugestoesQuery.isLoading}
                    placeholder="Adicionar auditor"
                    vazio="Nenhum outro usuário com o SGQ liberado."
                    disabled={!podeAlterarEquipe}
                    onChange={(nome) => {
                      if (!nome || nome === form.auditorLider || form.auditores.includes(nome)) return;
                      setForm({ ...form, auditores: [...form.auditores, nome] });
                    }}
                  />
                  {editando && !podeAlterarEquipe && (
                    <small className="sgq-aud-plano-ajuda">Só o auditor líder pode alterar a equipe.</small>
                  )}
                </div>
              </fieldset>
              <fieldset data-aba="planejamento" hidden={abaModal !== 'planejamento'} disabled={!canManage || formBusy}>
                <label>
                  <span>Data de início <em>*</em></span>
                  <input
                    className="form-input"
                    type="date"
                    required
                    value={form.dataInicio}
                    onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
                  />
                </label>
                <label>
                  <span>Data de término <em>*</em></span>
                  <input
                    className="form-input"
                    type="date"
                    required
                    min={form.dataInicio || undefined}
                    value={form.dataTermino}
                    onChange={(e) => setForm({ ...form, dataTermino: e.target.value })}
                  />
                </label>
                <div className="is-wide sgq-aud-plano">
                  <span>Planejamento <em>*</em></span>
                  <input
                    className="sgq-pessoa-validacao"
                    required
                    value={form.planejamento.length ? 'ok' : ''}
                    onChange={() => undefined}
                    onInvalid={(e) => e.currentTarget.setCustomValidity('Inclua ao menos uma atividade no planejamento.')}
                    ref={(elemento) => { elemento?.setCustomValidity(''); }}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  {form.planejamento.length > 0 && (
                    <div className="sgq-aud-plano-cabecalho" aria-hidden="true">
                      <span>Data</span>
                      <span>Horário</span>
                      <span>Atividade</span>
                    </div>
                  )}
                  {form.planejamento.map((item, indice) => {
                    const foraDoPeriodo = Boolean(
                      item.data && periodoValido && (item.data < form.dataInicio || item.data > form.dataTermino),
                    );
                    const horarioInvalido = Boolean(item.horaInicio && item.horaFim && item.horaFim <= item.horaInicio);
                    return (
                      <div key={indice} className="sgq-aud-plano-item">
                        <label>
                          <span className="sgq-sr-only">Data</span>
                          <input
                            className="form-input"
                            type="date"
                            required
                            min={form.dataInicio || undefined}
                            max={form.dataTermino || undefined}
                            value={item.data}
                            aria-invalid={foraDoPeriodo || undefined}
                            onChange={(e) => alterarPlanejamento(indice, { data: e.target.value })}
                          />
                        </label>
                        <div className="sgq-aud-plano-horario">
                          <label>
                            <span className="sgq-sr-only">Horário de início</span>
                            <input
                              className="form-input"
                              type="time"
                              required
                              value={item.horaInicio}
                              aria-invalid={horarioInvalido || undefined}
                              onChange={(e) => alterarPlanejamento(indice, { horaInicio: e.target.value })}
                            />
                          </label>
                          <span>às</span>
                          <label>
                            <span className="sgq-sr-only">Horário de término</span>
                            <input
                              className="form-input"
                              type="time"
                              required
                              value={item.horaFim}
                              aria-invalid={horarioInvalido || undefined}
                              onChange={(e) => alterarPlanejamento(indice, { horaFim: e.target.value })}
                            />
                          </label>
                        </div>
                        <label>
                          <span className="sgq-sr-only">Atividade</span>
                          <input
                            className="form-input"
                            required
                            maxLength={200}
                            value={item.atividade}
                            placeholder="Reunião de Abertura"
                            onChange={(e) => alterarPlanejamento(indice, { atividade: e.target.value })}
                          />
                        </label>
                        {canManage && (
                          <button
                            type="button"
                            className="btn-icon"
                            aria-label={`Remover ${item.atividade.trim() || 'atividade'}`}
                            onClick={() => setForm({
                              ...form,
                              planejamento: form.planejamento.filter((_, i) => i !== indice),
                            })}
                          >
                            <i className="bi bi-trash3" aria-hidden="true" />
                          </button>
                        )}
                        {(foraDoPeriodo || horarioInvalido) && (
                          <p className="sgq-aud-plano-rotulo is-erro">
                            {foraDoPeriodo
                              ? 'A data precisa estar dentro do período da auditoria.'
                              : 'O horário de término precisa ser depois do início.'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {canManage && (
                    <button
                      type="button"
                      className="sgq-aud-plano-adicionar"
                      disabled={!periodoValido}
                      onClick={adicionarPlanejamento}
                    >
                      <i className="bi bi-plus-lg" aria-hidden="true" />
                      Adicionar atividade
                    </button>
                  )}
                  {!periodoValido && (
                    <small className="sgq-aud-plano-ajuda">Informe a data de início e a de término para incluir o planejamento.</small>
                  )}
                </div>
                <div className="is-wide sgq-aud-campo">
                  <span>Escopo / objetivo <em>*</em></span>
                  <input
                    className="sgq-pessoa-validacao"
                    required
                    value={textoVisivel(form.escopo)}
                    onChange={() => undefined}
                    onInvalid={(e) => e.currentTarget.setCustomValidity('Informe o escopo / objetivo.')}
                    ref={(elemento) => { elemento?.setCustomValidity(''); }}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <EditorTexto
                    valor={form.escopo}
                    rotulo="Escopo / objetivo"
                    placeholder="Processos, áreas e critérios que serão auditados."
                    onChange={(valor) => setForm({ ...form, escopo: valor })}
                  />
                </div>
                {CAMPOS_PLANO_OPCIONAIS.map(([campo, rotulo, placeholder]) => (
                  <div key={campo} className="is-wide sgq-aud-campo">
                    <span>{rotulo}</span>
                    <EditorTexto
                      valor={form[campo]}
                      rotulo={rotulo}
                      placeholder={placeholder}
                      onChange={(valor) => setForm({ ...form, [campo]: valor })}
                    />
                  </div>
                ))}
                <div className="is-wide sgq-aud-status-picker" role="radiogroup" aria-label="Status">
                  <span>Status</span>
                  <div>
                    {SGQ_AUDITORIA_STATUS_OPTIONS.map((opcao) => {
                      const bloqueiaConclusao = opcao.value === 'concluida' && !mesmoNome(user?.name ?? '', form.auditorLider);
                      return (
                      <button
                        key={opcao.value}
                        type="button"
                        role="radio"
                        aria-checked={form.status === opcao.value}
                        className={`sgq-aud-status is-${opcao.value}${form.status === opcao.value ? ' is-picked' : ''}`}
                        disabled={bloqueiaConclusao}
                        title={bloqueiaConclusao ? 'Só o auditor líder pode concluir a auditoria.' : undefined}
                        onClick={() => setForm({ ...form, status: opcao.value })}
                      >
                        <i className={`bi bi-${STATUS_ICON[opcao.value]}`} aria-hidden="true" />
                        {opcao.label}
                      </button>
                      );
                    })}
                  </div>
                </div>
              </fieldset>
              </div>

              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <div>
                  {!editando && (restoredFormDraft || formDraftUpdatedAt) && (
                    <button
                      type="button"
                      className="reports-action-btn secondary"
                      onClick={descartarRascunho}
                      disabled={formBusy}
                      title="Apaga o rascunho da sua conta nesta filial"
                    >
                      {deleteFormDraft.isPending ? 'Descartando...' : 'Descartar rascunho'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="reports-action-btn secondary" onClick={fecharModal} disabled={formBusy}>
                    {canManage ? 'Cancelar' : 'Fechar'}
                  </button>
                  {canManage && (
                    <button type="submit" className="reports-action-btn primary" disabled={formBusy}>
                      {salvar.isPending ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Registrar Auditoria'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SGQAuditorias;
