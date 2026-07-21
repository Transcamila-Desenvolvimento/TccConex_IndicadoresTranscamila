import React, { useMemo, useState } from 'react';
import type { CalendarPersonalEvent, CalendarSystemEvent } from '../../types/domain';
import {
  useCalendarSystemEvents,
  useCalendarPersonalEvents,
  useCreateCalendarPersonalEvent,
  useUpdateCalendarPersonalEvent,
  useDeleteCalendarPersonalEvent,
} from '../../hooks/useFinanceiroCalendar';
import QueryDataPanel from '../../components/QueryDataPanel';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CORES_EVENTO: { key: string; label: string; hex: string }[] = [
  { key: 'azul', label: 'Azul', hex: '#118CC4' },
  { key: 'verde', label: 'Verde', hex: '#16a34a' },
  { key: 'amarelo', label: 'Amarelo', hex: '#d97706' },
  { key: 'vermelho', label: 'Vermelho', hex: '#dc2626' },
  { key: 'roxo', label: 'Roxo', hex: '#7c3aed' },
  { key: 'cinza', label: 'Cinza', hex: '#64748b' },
];

const corHex = (key: string) => CORES_EVENTO.find((c) => c.key === key)?.hex ?? CORES_EVENTO[0].hex;

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const FinanceiroCalendar: React.FC = () => {
  const hoje = new Date();
  const [viewYear, setViewYear] = useState(hoje.getFullYear());
  const [viewMonth, setViewMonth] = useState(hoje.getMonth());

  // Filtros de exibição
  const [showPagar, setShowPagar] = useState(true);
  const [showReceber, setShowReceber] = useState(true);
  const [showPessoal, setShowPessoal] = useState(true);

  // Intervalo do mês visível
  const { startIso, endIso } = useMemo(() => {
    const start = new Date(viewYear, viewMonth, 1);
    const end = new Date(viewYear, viewMonth + 1, 0);
    return { startIso: toIso(start), endIso: toIso(end) };
  }, [viewYear, viewMonth]);

  const systemQuery = useCalendarSystemEvents(startIso, endIso);
  const personalQuery = useCalendarPersonalEvents(startIso, endIso);
  const createEvent = useCreateCalendarPersonalEvent();
  const updateEvent = useUpdateCalendarPersonalEvent();
  const deleteEvent = useDeleteCalendarPersonalEvent();

  const systemEvents = systemQuery.data?.events ?? {};
  const batchLabel = systemQuery.data?.batchLabel;

  const personalByDate = useMemo(() => {
    const map: Record<string, CalendarPersonalEvent[]> = {};
    (personalQuery.data ?? []).forEach((ev) => {
      (map[ev.date] ??= []).push(ev);
    });
    return map;
  }, [personalQuery.data]);

  // Modal de evento pessoal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarPersonalEvent | null>(null);
  const [eventDate, setEventDate] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventColor, setEventColor] = useState('azul');

  // Modal de detalhamento de evento do sistema
  const [systemDetail, setSystemDetail] = useState<CalendarSystemEvent | null>(null);

  const openNewEventModal = (dateIso: string) => {
    setEditingEvent(null);
    setEventDate(dateIso);
    setEventTitle('');
    setEventDesc('');
    setEventColor('azul');
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (ev: CalendarPersonalEvent) => {
    setEditingEvent(ev);
    setEventDate(ev.date);
    setEventTitle(ev.title);
    setEventDesc(ev.description);
    setEventColor(ev.color);
    setIsEventModalOpen(true);
  };

  const handleSubmitEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      date: eventDate,
      title: eventTitle.trim(),
      description: eventDesc.trim(),
      color: eventColor,
    };
    if (!payload.title) return;

    if (editingEvent) {
      updateEvent.mutate(
        { id: editingEvent.id, payload },
        {
          onSuccess: () => setIsEventModalOpen(false),
          onError: () => alert('Erro ao atualizar o evento.'),
        },
      );
    } else {
      createEvent.mutate(payload, {
        onSuccess: () => setIsEventModalOpen(false),
        onError: () => alert('Erro ao criar o evento.'),
      });
    }
  };

  const handleDeleteEvent = () => {
    if (!editingEvent) return;
    if (!window.confirm('Excluir este evento?')) return;
    deleteEvent.mutate(editingEvent.id, {
      onSuccess: () => setIsEventModalOpen(false),
      onError: () => alert('Erro ao excluir o evento.'),
    });
  };

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1);
  };
  const goToday = () => { setViewYear(hoje.getFullYear()); setViewMonth(hoje.getMonth()); };

  // Monta as semanas do mês visível
  const weeks = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(toIso(new Date(viewYear, viewMonth, day)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const result: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [viewYear, viewMonth]);

  const todayIso = toIso(hoje);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '4px' }}>
      {/* Header */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }}></div>
          <h1 className="view-page-title">Calendário Financeiro</h1>
          {batchLabel && (
            <span style={{ fontSize: '12px', color: '#64748b' }}>Lote {batchLabel}</span>
          )}
        </div>
        <div className="fin-calendar-filters">
          <button
            type="button"
            className={`fin-calendar-pill pagar ${showPagar ? 'is-on' : ''}`}
            onClick={() => setShowPagar(!showPagar)}
          >
            &darr; A Pagar
          </button>
          <button
            type="button"
            className={`fin-calendar-pill receber ${showReceber ? 'is-on' : ''}`}
            onClick={() => setShowReceber(!showReceber)}
          >
            &uarr; A Receber
          </button>
          <button
            type="button"
            className={`fin-calendar-pill pessoal ${showPessoal ? 'is-on' : ''}`}
            onClick={() => setShowPessoal(!showPessoal)}
          >
            Pessoal
          </button>
        </div>
      </header>

      <QueryDataPanel
        query={systemQuery}
        loadingMessage="Carregando calendário financeiro..."
        refreshingMessage="Atualizando calendário..."
        errorMessage="Não foi possível carregar o calendário. Tente novamente."
      >
      <div className="erp-card" style={{ padding: '16px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Navegação do mês */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', marginBottom: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#334155' }}>
            {MESES[viewMonth]} {viewYear}
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="reports-action-btn secondary" onClick={goPrev}>&lsaquo; Anterior</button>
            <button
              type="button"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
              onClick={goToday}
            >
              Hoje
            </button>
            <button type="button" className="reports-action-btn secondary" onClick={goNext}>Próximo &rsaquo;</button>
          </div>
        </div>

        {/* Grade */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <table className="fin-calendar-table">
            <thead>
              <tr>
                {DIAS_SEMANA.map((dia, idx) => (
                  <th key={dia} className={idx === 0 || idx === 6 ? 'is-weekend-head' : ''}>{dia}</th>
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
                    const sysDay = (systemEvents[dateIso] ?? []).filter((ev) =>
                      (ev.type === 'pagar' && showPagar) || (ev.type === 'receber' && showReceber),
                    );
                    const persDay = showPessoal ? (personalByDate[dateIso] ?? []) : [];

                    return (
                      <td
                        key={di}
                        className={`fin-calendar-cell ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''}`}
                        onClick={() => openNewEventModal(dateIso)}
                        title="Clique para adicionar um evento"
                      >
                        <div className="fin-calendar-day-number">{dayNumber}</div>
                        <div className="fin-calendar-events">
                          {sysDay.map((ev, i) => (
                            <div
                              key={`s-${i}`}
                              className={`fin-calendar-event is-${ev.type}`}
                              title={`${ev.fullTitle}\n${ev.count} título(s) — ${moeda.format(ev.amount)}\n(Clique para detalhar)`}
                              onClick={(e) => { e.stopPropagation(); setSystemDetail(ev); }}
                            >
                              <span className="fin-calendar-event-arrow">{ev.type === 'pagar' ? '↓' : '↑'}</span>
                              {ev.title}
                            </div>
                          ))}
                          {persDay.map((ev) => (
                            <div
                              key={`p-${ev.id}`}
                              className="fin-calendar-event is-pessoal"
                              style={{ backgroundColor: corHex(ev.color) }}
                              title={ev.description || ev.title}
                              onClick={(e) => { e.stopPropagation(); openEditEventModal(ev); }}
                            >
                              {ev.title}
                            </div>
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
      </div>
      </QueryDataPanel>

      {/* MODAL: evento pessoal */}
      {isEventModalOpen && (
        <div className="search-backdrop" style={{ display: 'flex' }} onClick={(e) => {
          if (e.target === e.currentTarget) setIsEventModalOpen(false);
        }}>
          <div className="search-modal-card" style={{ width: '480px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                {editingEvent ? 'Editar Evento' : 'Novo Evento'}
              </h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={() => setIsEventModalOpen(false)}>Fechar (X)</span>
            </div>

            <form style={{ padding: '20px 24px 24px 24px' }} onSubmit={handleSubmitEvent}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '14px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="cal-event-date">Data</label>
                  <input
                    type="date"
                    id="cal-event-date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    style={{ background: '#f8fafc' }}
                  />
                </div>
              </div>

              <div className="login-group" style={{ marginBottom: '14px' }}>
                <label htmlFor="cal-event-title">Título do Compromisso</label>
                <input
                  type="text"
                  id="cal-event-title"
                  placeholder="O que você precisa fazer?"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="login-group" style={{ marginBottom: '14px' }}>
                <label>Cor</label>
                <div className="fin-calendar-color-picker">
                  {CORES_EVENTO.map((cor) => (
                    <button
                      key={cor.key}
                      type="button"
                      className={`fin-calendar-color-option ${eventColor === cor.key ? 'is-active' : ''}`}
                      style={{ backgroundColor: cor.hex }}
                      title={cor.label}
                      onClick={() => setEventColor(cor.key)}
                    />
                  ))}
                </div>
              </div>

              <div className="login-group" style={{ marginBottom: 0 }}>
                <label htmlFor="cal-event-desc">Observações</label>
                <textarea
                  id="cal-event-desc"
                  placeholder="Detalhes adicionais... (opcional)"
                  rows={3}
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                {editingEvent ? (
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  >
                    Excluir evento
                  </button>
                ) : <span />}
                <button type="submit" className="btn-login" style={{ width: 'auto', padding: '10px 28px', marginTop: 0, backgroundColor: '#118CC4' }}>
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: detalhamento de evento do sistema */}
      {systemDetail && (
        <div className="search-backdrop" style={{ display: 'flex' }} onClick={(e) => {
          if (e.target === e.currentTarget) setSystemDetail(null);
        }}>
          <div className="search-modal-card" style={{ width: '640px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                {systemDetail.type === 'pagar' ? 'A Pagar' : 'A Receber'} — {systemDetail.fullTitle}
              </h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={() => setSystemDetail(null)}>Fechar (X)</span>
            </div>
            <div style={{ padding: '16px 24px 24px 24px', maxHeight: '55vh', overflowY: 'auto' }}>
              <table className="erp-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Documento</th>
                    <th style={{ textAlign: 'left' }}>Filial</th>
                    <th style={{ textAlign: 'left' }}>Vencimento</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {systemDetail.titulos.map((t, i) => (
                    <tr key={i}>
                      <td>{t.doc}</td>
                      <td>{t.filial}</td>
                      <td>{t.vencimento}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{moeda.format(t.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 700 }}>TOTAL</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#118CC4' }}>
                      {moeda.format(systemDetail.amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceiroCalendar;
