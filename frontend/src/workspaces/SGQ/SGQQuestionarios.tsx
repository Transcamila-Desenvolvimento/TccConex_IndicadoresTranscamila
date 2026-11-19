import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { getSgqAuditoriaErrorMessage, useReabrirQuestionarioSgqAuditoria, useSgqAuditorias, useSgqAuditoriasSugestoes } from '../../hooks/useSgqAuditorias';
import type { SgqAuditoria, SgqAuditoriaQueryParams } from '../../types/domain';
import { SGQ_QUESTIONARIO_STATUS_LABEL } from '../../types/domain';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function mesmoNome(a: string, b: string) {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

function percentual(auditoria: SgqAuditoria) {
  if (!auditoria.totalPerguntas) return 0;
  return Math.round((auditoria.perguntasRespondidas / auditoria.totalPerguntas) * 100);
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const AvatarEquipe: React.FC<{ nome: string; foto?: string; voce?: boolean }> = ({ nome, foto, voce }) => {
  const [falhou, setFalhou] = useState(false);
  const url = foto?.trim();
  useEffect(() => setFalhou(false), [url]);
  const classe = `sgq-pessoa-avatar${voce ? ' is-voce' : ''}`;
  if (url && !falhou) {
    return (
      <span className={classe} aria-hidden="true">
        <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFalhou(true)} />
      </span>
    );
  }
  return <span className={classe} aria-hidden="true">{iniciais(nome)}</span>;
};

const EquipeAuditoria: React.FC<{
  lider: string;
  auditores: string[];
  fotos: Map<string, string>;
  usuario: string;
}> = ({ lider, auditores, fotos, usuario }) => {
  const pessoas = [
    ...(lider ? [{ nome: lider, lider: true }] : []),
    ...auditores
      .filter((nome) => nome.trim() && !mesmoNome(nome, lider))
      .map((nome) => ({ nome, lider: false })),
  ];
  const fotosRef = useRef<HTMLDivElement>(null);
  const [dica, setDica] = useState<{ top: number; left: number } | null>(null);
  const naEquipe = pessoas.some((pessoa) => mesmoNome(pessoa.nome, usuario));
  const aviso = naEquipe ? 'Você faz parte desta equipe' : 'Você não faz parte desta equipe';
  const visiveis = pessoas.slice(0, 3);
  const resto = pessoas.length - visiveis.length;
  const fotoDe = (nome: string) => fotos.get(nome.trim().toLocaleLowerCase('pt-BR'));
  const mostrar = () => {
    const rect = fotosRef.current?.getBoundingClientRect();
    if (!rect) return;
    const altura = 52 + pessoas.length * 32;
    const abaixo = rect.bottom + 8;
    const top = abaixo + altura < window.innerHeight - 8 ? abaixo : Math.max(8, rect.top - altura - 8);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - 252);
    setDica({ top, left });
  };
  useEffect(() => {
    if (!dica) return;
    const fechar = () => setDica(null);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [dica]);
  if (!pessoas.length) return <span className="sgq-aud-muted">—</span>;
  return (
    <div
      className={`sgq-quest-equipe${naEquipe ? ' is-dentro' : ' is-fora'}`}
      tabIndex={0}
      onMouseEnter={mostrar}
      onMouseLeave={() => setDica(null)}
      onFocus={mostrar}
      onBlur={() => setDica(null)}
    >
      <div className="sgq-quest-equipe-fotos" ref={fotosRef} aria-label={aviso}>
        {visiveis.map((pessoa) => (
          <AvatarEquipe key={pessoa.nome} nome={pessoa.nome} foto={fotoDe(pessoa.nome)} voce={mesmoNome(pessoa.nome, usuario)} />
        ))}
        {resto > 0 && <span className="sgq-quest-equipe-mais">+{resto}</span>}
      </div>
      {dica && (
        <div className="sgq-quest-equipe-dica" role="tooltip" style={{ top: dica.top, left: dica.left }}>
          <strong>{aviso}</strong>
          <ul>
            {pessoas.map((pessoa) => {
              const etiquetas = [
                pessoa.lider ? 'Líder' : '',
                mesmoNome(pessoa.nome, usuario) ? 'Você' : '',
              ].filter(Boolean);
              return (
                <li key={pessoa.nome}>
                  <AvatarEquipe nome={pessoa.nome} foto={fotoDe(pessoa.nome)} voce={mesmoNome(pessoa.nome, usuario)} />
                  <span>{pessoa.nome}</span>
                  {etiquetas.length > 0 && <small>{etiquetas.join(' · ')}</small>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

const SGQQuestionarios: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const navigate = useNavigate();
  const canAnswer = userHasFuncao(user, 'SGQ', 'executar-auditorias');
  const podeReabrirQuestionario = userHasFuncao(user, 'SGQ', 'reabrir-questionario');
  const reabrirQuestionario = useReabrirQuestionarioSgqAuditoria(selectedFilial);
  const sugestoesQuery = useSgqAuditoriasSugestoes(selectedFilial, Boolean(selectedFilial));
  const fotosPorNome = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const pessoa of sugestoesQuery.data?.auditores ?? []) {
      if (pessoa.foto?.trim()) mapa.set(pessoa.nome.trim().toLocaleLowerCase('pt-BR'), pessoa.foto);
    }
    return mapa;
  }, [sugestoesQuery.data]);

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const params: SgqAuditoriaQueryParams = {
    page,
    pageSize,
    search: buscaAplicada,
    ordering: '-data_inicio',
    minhaEquipe: true,
  };
  const listaQuery = useSgqAuditorias(selectedFilial, params);
  const { canShowEmpty } = useAsyncQueryState(listaQuery);
  const reabrir = (auditoria: SgqAuditoria) => {
    const aviso = auditoria.status === 'concluida'
      ? `Reabrir o questionário de ${auditoria.codigo}? As respostas voltam a poder ser alteradas e a auditoria volta para em execução.`
      : `Reabrir o questionário de ${auditoria.codigo}? As respostas voltam a poder ser alteradas.`;
    if (!window.confirm(aviso)) return;
    reabrirQuestionario.mutate(auditoria.id, {
      onError: (err) => alert(getSgqAuditoriaErrorMessage(err, 'Não foi possível reabrir o questionário.')),
    });
  };

  const linhas = listaQuery.data?.results ?? [];
  const total = listaQuery.data?.count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const paginaAtual = Math.min(page, totalPaginas);

  const abrir = (auditoria: SgqAuditoria) => {
    navigate(`/sgq/auditorias/minhas-acoes/${auditoria.id}`);
  };

  return (
    <div className="fat-list-compact sgq-lista">
      <header className="view-header sgq-lista-header">
        <div className="sgq-lista-titulo">
          <span className="sgq-lista-marcador" aria-hidden="true" />
          <h1 className="view-page-title">Questionário</h1>
        </div>
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
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
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{total}</strong> {total === 1 ? 'Auditoria' : 'Auditorias'}</span>
        </div>
      </div>

      <QueryDataPanel
        query={listaQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando questionários..."
        refreshingMessage="Atualizando questionários..."
        errorMessage="Não foi possível carregar os questionários. Tente novamente."
      >
        <div className="erp-card reports-table-card sgq-lista-card">
          <div className="table-container sgq-lista-scroll">
            <table className="erp-table reports-table sgq-lista-tabela sgq-quest-tabela">
              <colgroup>
                <col className="sgq-quest-col-codigo" />
                <col className="sgq-quest-col-titulo" />
                <col className="sgq-quest-col-norma" />
                <col className="sgq-quest-col-equipe" />
                <col className="sgq-quest-col-status" />
                <col className="sgq-quest-col-progresso" />
                <col className="sgq-quest-col-acao" />
              </colgroup>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Auditoria</th>
                  <th>Norma</th>
                  <th>Equipe</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="comercial-browse-empty">
                      {buscaAplicada ? 'Nenhuma auditoria encontrada para a busca.' : 'Não há auditorias registradas.'}
                    </td>
                  </tr>
                ) : (
                  linhas.map((auditoria) => {
                    const normas = auditoria.normas.map((norma) => norma.nome);
                    const pct = percentual(auditoria);
                    const naEquipe = mesmoNome(user?.name ?? '', auditoria.auditorLider)
                      || auditoria.auditores.some((nome) => mesmoNome(user?.name ?? '', nome));
                    const questionarioFechado = auditoria.status === 'concluida' || auditoria.questionarioConcluido;
                    const somenteLeitura = questionarioFechado || !canAnswer || !naEquipe;
                    return (
                      <tr key={auditoria.id} className="sgq-quest-linha">
                        <td><span className="sgq-aud-codigo">{auditoria.codigo}</span></td>
                        <td>
                          <button type="button" className="sgq-quest-titulo" onClick={() => abrir(auditoria)} title={auditoria.titulo}>
                            {auditoria.titulo}
                          </button>
                        </td>
                        <td>
                          {normas.length ? (
                            <div className="sgq-aud-normas">
                              {normas.slice(0, 2).map((norma) => <span key={norma} className="sgq-aud-chip" title={norma}>{norma}</span>)}
                              {normas.length > 2 && (
                                <span className="sgq-aud-chip is-more" title={normas.slice(2).join(', ')}>+{normas.length - 2}</span>
                              )}
                            </div>
                          ) : <span className="sgq-aud-muted">—</span>}
                        </td>
                        <td>
                          <EquipeAuditoria
                            lider={auditoria.auditorLider}
                            auditores={auditoria.auditores}
                            fotos={fotosPorNome}
                            usuario={user?.name ?? ''}
                          />
                        </td>
                        <td>
                          <span className={`sgq-aud-status is-${auditoria.statusQuestionario}`}>
                            {SGQ_QUESTIONARIO_STATUS_LABEL[auditoria.statusQuestionario]}
                          </span>
                        </td>
                        <td>
                          {auditoria.totalPerguntas > 0 ? (
                            <div className="sgq-quest-progresso" title={`${auditoria.perguntasRespondidas} de ${auditoria.totalPerguntas} perguntas respondidas`}>
                              <div className="sgq-quest-progresso-topo">
                                <span>{auditoria.perguntasRespondidas} de {auditoria.totalPerguntas}</span>
                                <strong>{pct}%</strong>
                              </div>
                              <div className={`sgq-quest-barra${pct >= 100 ? ' is-completa' : ''}`} aria-hidden="true">
                                <span style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="sgq-aud-muted">Sem perguntas</span>
                          )}
                        </td>
                        <td className="sgq-quest-acao">
                          <div className="sgq-quest-acoes">
                            {questionarioFechado && podeReabrirQuestionario && (
                              <button
                                type="button"
                                className="reports-action-btn secondary sgq-quest-abrir"
                                onClick={() => reabrir(auditoria)}
                                disabled={reabrirQuestionario.isPending}
                              >
                                {reabrirQuestionario.isPending ? 'Reabrindo...' : 'Reabrir'}
                              </button>
                            )}
                            <button
                              type="button"
                              className={`reports-action-btn ${somenteLeitura ? 'secondary' : 'primary'} sgq-quest-abrir`}
                              onClick={() => abrir(auditoria)}
                            >
                              {somenteLeitura ? 'Ver respostas' : 'Responder'}
                            </button>
                          </div>
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
            <label htmlFor="sgq-questionarios-page-size">Itens por página</label>
            <select
              id="sgq-questionarios-page-size"
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
    </div>
  );
};

export default SGQQuestionarios;
