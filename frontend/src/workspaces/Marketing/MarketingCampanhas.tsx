import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import {
  useCampanhaQuadro,
  useCampanhas,
  useCreateCampanha,
  useDeleteCampanha,
  useMoveCampanhaStatus,
  useUpdateCampanha,
} from '../../hooks/useMarketingCampanhas';
import { useMarketingPresence } from '../../hooks/useMarketingPresence';
import type { CampanhaMarketing, CampanhaPayload, CampanhaStatus } from '../../types/domain';
import {
  CAMPANHA_KANBAN_COLUMNS,
  campanhaCorHex,
} from '../../types/domain';
import MarketingCampanhaDetailPanel from './MarketingCampanhaDetailPanel';
import MarketingCampanhaModal from './MarketingCampanhaModal';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type Tab = 'calendario' | 'kanban';

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

function campanhaAtivaNoDia(c: CampanhaMarketing, iso: string): boolean {
  return dateInRange(iso, c.dataInicio, c.dataFim);
}

const formatDateBr = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const MarketingCampanhas: React.FC = () => {
  const { user } = useAuth();
  const canCreate = userHasFuncao(user, 'Marketing', 'criar-campanhas');
  const canEdit = userHasFuncao(user, 'Marketing', 'editar-campanhas');
  const canDelete = userHasFuncao(user, 'Marketing', 'excluir-campanhas');

  const [tab, setTab] = useState<Tab>('calendario');
  const hoje = new Date();
  const [viewYear, setViewYear] = useState(hoje.getFullYear());
  const [viewMonth, setViewMonth] = useState(hoje.getMonth());

  const { startIso, endIso } = useMemo(() => {
    const start = new Date(viewYear, viewMonth, 1);
    const end = new Date(viewYear, viewMonth + 1, 0);
    return { startIso: toIso(start), endIso: toIso(end) };
  }, [viewYear, viewMonth]);

  const campanhasQuery = useCampanhas({ start: startIso, end: endIso });
  const quadroQuery = useCampanhaQuadro();
  const { online: onlineTeam, status: liveStatus } = useMarketingPresence();
  const createCampanha = useCreateCampanha();
  const updateCampanha = useUpdateCampanha();
  const deleteCampanha = useDeleteCampanha();
  const moveStatus = useMoveCampanhaStatus();

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CampanhaMarketing | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [dragId, setDragId] = useState<string | null>(null);

  const campanhas = campanhasQuery.data ?? [];
  const team = useMemo(() => {
    const byId = new Map(onlineTeam.map((member) => [member.id, member]));
    if (user && !byId.has(user.id)) {
      byId.set(user.id, {
        id: user.id,
        name: user.name,
        googlePicture: user.googlePicture,
        googleEmail: user.googleEmail,
      });
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [onlineTeam, user]);

  const campanhasPorDia = useMemo(() => {
    const map: Record<string, CampanhaMarketing[]> = {};
    campanhas.forEach((c) => {
      const start = new Date(c.dataInicio + 'T12:00:00');
      const end = new Date(c.dataFim + 'T12:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = toIso(d);
        if (iso >= startIso && iso <= endIso) (map[iso] ??= []).push(c);
      }
    });
    return map;
  }, [campanhas, startIso, endIso]);

  const weeks = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(toIso(new Date(viewYear, viewMonth, day)));
    while (cells.length % 7 !== 0) cells.push(null);
    const result: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [viewYear, viewMonth]);

  const todayIso = toIso(hoje);

  const openCreate = (dateIso?: string) => {
    setEditing(null);
    setDefaultDate(dateIso);
    setFormModalOpen(true);
  };

  const openDetail = (c: CampanhaMarketing) => setSelectedId(c.id);

  const openEditModal = (c: CampanhaMarketing) => {
    setSelectedId(null);
    setEditing(c);
    setDefaultDate(undefined);
    setFormModalOpen(true);
  };

  const handleSave = (payload: CampanhaPayload) => {
    if (editing) {
      updateCampanha.mutate({ id: editing.id, payload }, { onSuccess: () => setFormModalOpen(false) });
    } else {
      createCampanha.mutate(payload, { onSuccess: () => setFormModalOpen(false) });
    }
  };

  const handleDelete = () => {
    if (!editing) return;
    deleteCampanha.mutate(editing.id, {
      onSuccess: () => {
        setFormModalOpen(false);
        if (selectedId === editing.id) setSelectedId(null);
      },
    });
  };

  const handleDrop = (status: CampanhaStatus) => {
    if (!dragId || !canEdit) return;
    moveStatus.mutate({ id: dragId, status, ordemKanban: 0 });
    setDragId(null);
  };

  const busy = createCampanha.isPending || updateCampanha.isPending || deleteCampanha.isPending;
  const activeQuery = tab === 'calendario' ? campanhasQuery : quadroQuery;

  return (
    <section className="view active" style={{ display: 'block', padding: '4px' }}>
      <header className="view-header mkt-page-header">
        <div>
          <h1 className="view-page-title" style={{ marginBottom: '4px' }}>Calendario Transcamila</h1>
          <p className="mkt-hub-subtitle">
            Organize a produção de conteúdo para redes sociais — do planejamento à publicação.
          </p>
        </div>
        <div className="mkt-page-header-actions">
          <div className="mkt-team-strip mkt-team-strip--header">
            <span className="mkt-team-strip-label">
              <i className="bi bi-people" aria-hidden="true" />
              Equipe
              <span
                className={`mkt-live-dot mkt-live-dot--${liveStatus}`}
                title={
                  liveStatus === 'connected'
                    ? 'Colaboração ao vivo ativa'
                    : liveStatus === 'connecting'
                      ? 'Conectando…'
                      : 'Reconectando colaboração ao vivo'
                }
                aria-label={
                  liveStatus === 'connected'
                    ? 'Colaboração ao vivo ativa'
                    : 'Colaboração ao vivo indisponível'
                }
              />
            </span>
            {team.length > 0 && (
              <div className="mkt-team-avatars-stack mkt-team-avatars-stack--inline">
                {team.slice(0, 5).map((member) => (
                  <span
                    key={member.id}
                    className="mkt-team-avatar-stack-item"
                    data-tooltip={member.name}
                    title={member.name}
                  >
                    <UserAvatar
                      name={member.name}
                      photo={member.googlePicture}
                      size="sm"
                      title={member.name}
                    />
                  </span>
                ))}
                {team.length > 5 && <span className="mkt-team-strip-count">+{team.length - 5}</span>}
              </div>
            )}
          </div>
          {canCreate && (
            <button type="button" className="reports-action-btn primary" onClick={() => openCreate()}>
              Novo conteúdo
            </button>
          )}
        </div>
      </header>

      <div className="mkt-hub-body">
        <div className={`mkt-hub-layout ${selectedId ? 'has-selection' : ''}`}>
          <div className="mkt-hub-main">
            <QueryDataPanel
              query={activeQuery}
              loadingMessage="Carregando conteúdos..."
              refreshingMessage="Atualizando..."
              refreshVariant="overlay"
              errorMessage="Não foi possível carregar os conteúdos."
            >
              <div className="erp-card fin-calendar-card">
                <div className="fin-calendar-toolbar">
                  {tab === 'calendario' ? (
                    <div className="fin-calendar-nav">
                      <button type="button" className="reports-action-btn secondary" onClick={() => {
                        if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
                        else setViewMonth((m) => m - 1);
                      }} aria-label="Mês anterior">&lsaquo;</button>
                      <h2 className="fin-calendar-month">{MESES[viewMonth]} {viewYear}</h2>
                      <button type="button" className="reports-action-btn secondary" onClick={() => {
                        if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
                        else setViewMonth((m) => m + 1);
                      }} aria-label="Próximo mês">&rsaquo;</button>
                      <button type="button" className="reports-action-btn primary fin-calendar-today-btn" onClick={() => { setViewYear(hoje.getFullYear()); setViewMonth(hoje.getMonth()); }}>
                        Hoje
                      </button>
                    </div>
                  ) : (
                    <h2 className="fin-calendar-month">Fluxo de produção</h2>
                  )}
                  <div className="fin-calendar-filter-bar" role="group" aria-label="Visualização">
                    <button type="button" className={`fin-calendar-filter-btn ${tab === 'calendario' ? 'is-active' : ''}`} onClick={() => setTab('calendario')}>
                      Calendário
                    </button>
                    <button type="button" className={`fin-calendar-filter-btn ${tab === 'kanban' ? 'is-active' : ''}`} onClick={() => setTab('kanban')}>
                      Produção
                    </button>
                  </div>
                </div>

                {tab === 'calendario' && (
                  <div className="fin-calendar-grid-wrap">
                      <table className="fin-calendar-table">
                        <thead>
                          <tr>
                            {DIAS_SEMANA.map((d, idx) => (
                              <th key={d} className={idx === 0 || idx === 6 ? 'is-weekend-head' : ''}>{d}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {weeks.map((week, wi) => (
                            <tr key={wi}>
                              {week.map((dateIso, di) => {
                                if (!dateIso) return <td key={di} className="fin-calendar-cell is-outside" />;
                                const dayNumber = Number(dateIso.split('-')[2]);
                                const isToday = dateIso === todayIso;
                                const isWeekend = di === 0 || di === 6;
                                const events = (campanhasPorDia[dateIso] ?? []).filter((c) => campanhaAtivaNoDia(c, dateIso));
                                return (
                                  <td
                                    key={di}
                                    className={`fin-calendar-cell ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`}
                                    onDoubleClick={() => canCreate && openCreate(dateIso)}
                                    title={canCreate ? 'Duplo clique para novo conteúdo' : undefined}
                                  >
                                    <div className="fin-calendar-day-number">{dayNumber}</div>
                                    <div className="fin-calendar-events">
                                      {events.map((ev) => (
                                        <button
                                          key={`${ev.id}-${dateIso}`}
                                          type="button"
                                          className={`mkt-calendar-chip ${selectedId === ev.id ? 'is-selected' : ''}`}
                                          style={{ '--chip-color': campanhaCorHex(ev.cor) } as React.CSSProperties}
                                          title={ev.titulo}
                                          onClick={() => openDetail(ev)}
                                        >
                                          <span className="mkt-calendar-chip-title">{ev.titulo}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                )}

                {tab === 'kanban' && (
                  <div className="mkt-kanban-board mkt-kanban-board--page">
                    {CAMPANHA_KANBAN_COLUMNS.map((col) => {
                      const items = (quadroQuery.data?.[col.key] ?? []) as CampanhaMarketing[];
                      return (
                        <div
                          key={col.key}
                          className="mkt-kanban-column"
                          onDragOver={(e) => { if (canEdit) e.preventDefault(); }}
                          onDrop={() => handleDrop(col.key)}
                        >
                          <div className="mkt-kanban-column-header">
                            <div className="mkt-kanban-column-title">
                              <span>{col.label}</span>
                              <small>{col.hint}</small>
                            </div>
                            <span className="mkt-kanban-count">{items.length}</span>
                          </div>
                          <div className="mkt-kanban-cards">
                            {items.map((c) => (
                              <article
                                key={c.id}
                                className={`mkt-kanban-card ${selectedId === c.id ? 'is-selected' : ''}`}
                                draggable={canEdit}
                                onDragStart={() => setDragId(c.id)}
                                onDragEnd={() => setDragId(null)}
                                onClick={() => openDetail(c)}
                              >
                                <div className="mkt-kanban-card-accent" style={{ background: campanhaCorHex(c.cor) }} />
                                <h4>{c.titulo}</h4>
                                <p className="mkt-kanban-card-meta">{formatDateBr(c.dataInicio)} – {formatDateBr(c.dataFim)}</p>
                          <div className="mkt-kanban-card-footer">
                            <div className="mkt-kanban-card-assignee">
                              <UserAvatar name={c.responsavelUser?.name ?? c.responsavel ?? '?'} photo={c.responsavelUser?.googlePicture} size="sm" />
                              <span>{c.responsavelUser?.name?.split(' ')[0] ?? c.responsavel ?? '—'}</span>
                            </div>
                            <div className="mkt-kanban-card-badges">
                              {(c.membrosCount ?? 0) > 0 && (
                                <span className="mkt-kanban-card-comments" title="Participantes">
                                  <i className="bi bi-people" /> {c.membrosCount}
                                </span>
                              )}
                              {(c.midiasCount ?? 0) > 0 && (
                                <span className="mkt-kanban-card-comments" title="Arquivos anexados">
                                  <i className="bi bi-paperclip" /> {c.midiasCount}
                                </span>
                              )}
                              {c.comentariosCount > 0 && (
                                <span className="mkt-kanban-card-comments">
                                  <i className="bi bi-chat-dots" /> {c.comentariosCount}
                                </span>
                              )}
                            </div>
                          </div>
                              </article>
                            ))}
                            {items.length === 0 && <p className="mkt-kanban-empty">Nenhum conteúdo</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </QueryDataPanel>
          </div>

          <div className="mkt-hub-side">
            {selectedId ? (
              <MarketingCampanhaDetailPanel
                campanhaId={selectedId}
                onClose={() => setSelectedId(null)}
                onEdit={openEditModal}
              />
            ) : (
              <aside className="mkt-side-panel mkt-side-panel--placeholder erp-card">
                <div className="mkt-side-empty-state">
                  <i className="bi bi-kanban" aria-hidden="true" />
                  <p>Selecione um conteúdo no calendário ou no fluxo de produção para ver detalhes, equipe e conversa.</p>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      <MarketingCampanhaModal
        open={formModalOpen}
        campanha={editing}
        defaultDate={defaultDate}
        onClose={() => setFormModalOpen(false)}
        onSave={handleSave}
        onDelete={canDelete ? handleDelete : undefined}
        canDelete={canDelete}
        busy={busy}
      />
    </section>
  );
};

export default MarketingCampanhas;
