import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useCampanhas } from '../../hooks/useMarketingCampanhas';
import type { CampanhaMarketing } from '../../types/domain';
import {
  campanhaAtivaNoDia,
  indexCampanhasPorDia,
  toIso,
} from './marketingCalendarUtils';

/** Seg, Qua, Sex — só 3 rótulos laterais */
const WEEKDAY_LABELS: { row: number; label: string }[] = [
  { row: 1, label: 'Seg' },
  { row: 3, label: 'Qua' },
  { row: 5, label: 'Sex' },
];

const YEAR_SPAN = 5;

function buildYearGrid(year: number) {
  const yearStartIso = `${year}-01-01`;
  const yearEndIso = `${year}-12-31`;

  const firstWeekStart = startOfWeekSunday(new Date(year, 0, 1, 12, 0, 0));
  const lastWeekStart = startOfWeekSunday(new Date(year, 11, 31, 12, 0, 0));

  const weekStarts: Date[] = [];
  for (let d = new Date(firstWeekStart); d <= lastWeekStart; d = addDays(d, 7)) {
    weekStarts.push(new Date(d));
  }

  return { yearStartIso, yearEndIso, weekStarts };
}

function monthMarkersForYear(
  year: number,
  weekStarts: Date[],
): { label: string; weekIndex: number }[] {
  const markers: { label: string; weekIndex: number }[] = [];

  for (let month = 0; month < 12; month += 1) {
    const firstOfMonthIso = toIso(new Date(year, month, 1, 12, 0, 0));
    const weekIndex = weekStarts.findIndex((weekStart) => {
      const weekStartIso = toIso(weekStart);
      const weekEndIso = toIso(addDays(weekStart, 6));
      return firstOfMonthIso >= weekStartIso && firstOfMonthIso <= weekEndIso;
    });

    if (weekIndex >= 0) {
      markers.push({
        label: new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        weekIndex,
      });
    }
  }

  return markers;
}

type DayCell = {
  iso: string;
  inYear: boolean;
  isFuture: boolean;
  count: number;
  items: CampanhaMarketing[];
};

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function levelForCount(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

function formatTooltipDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function contributionLabel(count: number, dateLabel: string, isFuture: boolean): string {
  if (isFuture) return `Sem publicações — ${dateLabel}`;
  if (count <= 0) return `Nenhuma publicação em ${dateLabel}`;
  if (count === 1) return `1 publicação em ${dateLabel}`;
  return `${count} publicações em ${dateLabel}`;
}

const MarketingHomeWeekCalendar: React.FC = () => {
  const navigate = useNavigate();
  const hoje = useMemo(() => new Date(), []);
  const todayIso = toIso(hoje);
  const currentYear = hoje.getFullYear();
  const minYear = currentYear - (YEAR_SPAN - 1);

  const [viewYear, setViewYear] = useState(currentYear);

  const { yearStartIso, yearEndIso, weekStarts } = useMemo(
    () => buildYearGrid(viewYear),
    [viewYear],
  );

  const campanhasQuery = useCampanhas({ start: yearStartIso, end: yearEndIso });

  const { cells, months, weekCount } = useMemo(() => {
    const publicadas = (campanhasQuery.data ?? []).filter((c) => c.status === 'concluida');
    const porDia = indexCampanhasPorDia(publicadas, yearStartIso, yearEndIso);

    const gridCells: DayCell[] = [];
    weekStarts.forEach((weekStart) => {
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const day = addDays(weekStart, weekday);
        const iso = toIso(day);
        const inYear = iso >= yearStartIso && iso <= yearEndIso;
        const isFuture = inYear && iso > todayIso;
        const items = inYear && !isFuture
          ? (porDia[iso] ?? []).filter((c) => campanhaAtivaNoDia(c, iso))
          : [];
        gridCells.push({ iso, inYear, isFuture, count: items.length, items });
      }
    });

    return {
      cells: gridCells,
      months: monthMarkersForYear(viewYear, weekStarts),
      weekCount: weekStarts.length,
    };
  }, [campanhasQuery.data, yearStartIso, yearEndIso, weekStarts, viewYear, todayIso]);

  const [tooltip, setTooltip] = useState<{
    text: string;
    titles: string[];
    top: number;
    left: number;
  } | null>(null);

  const showTooltip = (cell: DayCell, el: HTMLElement) => {
    if (!cell.inYear) return;
    const rect = el.getBoundingClientRect();
    const dateLabel = formatTooltipDate(cell.iso);
    setTooltip({
      text: contributionLabel(cell.count, dateLabel, cell.isFuture),
      titles: cell.items.map((i) => i.titulo),
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  };

  return (
    <section className="mkt-home-calendar erp-card" aria-label="Mapa de publicações">
      <header className="mkt-home-calendar-header">
        <div>
          <h3 className="quick-access-title">Publicações no calendário</h3>
          <p className="mkt-home-calendar-subtitle">
            Mapa anual de conteúdos <strong>Publicados</strong>.
          </p>
        </div>
        <div className="gh-contrib-year-nav" aria-label="Selecionar ano">
          <button
            type="button"
            className="gh-contrib-year-btn"
            aria-label="Ano anterior"
            disabled={viewYear <= minYear}
            onClick={() => setViewYear((y) => y - 1)}
          >
            ‹
          </button>
          <span className="gh-contrib-year-value">{viewYear}</span>
          <button
            type="button"
            className="gh-contrib-year-btn"
            aria-label="Próximo ano"
            disabled={viewYear >= currentYear}
            onClick={() => setViewYear((y) => y + 1)}
          >
            ›
          </button>
        </div>
      </header>

      <QueryDataPanel
        query={campanhasQuery}
        variant="compact"
        refreshVariant="overlay"
        loadingMessage="Carregando publicações..."
        refreshingMessage="Atualizando..."
        errorMessage="Não foi possível carregar as publicações."
      >
        <div className="gh-contrib">
          <div className="gh-contrib-scroll">
            <div
              className="gh-contrib-panel"
              style={{ '--gh-weeks': weekCount } as React.CSSProperties}
            >
              <div className="gh-contrib-months-row" aria-hidden="true">
                <div className="gh-contrib-weekdays-spacer" />
                <div
                  className="gh-contrib-months"
                  style={
                    {
                      '--gh-weeks': weekCount,
                      gridTemplateColumns: `repeat(${weekCount}, var(--gh-cell))`,
                    } as React.CSSProperties
                  }
                >
                  {months.map((m) => (
                    <span
                      key={`${viewYear}-${m.label}-${m.weekIndex}`}
                      className="gh-contrib-month"
                      style={{ gridColumnStart: m.weekIndex + 1 } as React.CSSProperties}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="gh-contrib-body">
                <div className="gh-contrib-weekdays" aria-hidden="true">
                  {WEEKDAY_LABELS.map(({ row, label }) => (
                    <span
                      key={label}
                      className="gh-contrib-weekday"
                      style={{ gridRow: row + 1 }}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <div
                  className="gh-contrib-grid"
                  role="grid"
                  aria-label={`Publicações por dia em ${viewYear}`}
                  style={{ gridTemplateColumns: `repeat(${weekCount}, var(--gh-cell))` }}
                >
                  {cells.map((cell, index) => {
                    const level = cell.inYear ? levelForCount(cell.count) : -1;
                    const isToday = cell.iso === todayIso;
                    const ariaLabel = cell.inYear
                      ? contributionLabel(cell.count, formatTooltipDate(cell.iso), cell.isFuture)
                      : undefined;

                    if (!cell.inYear) {
                      return (
                        <span
                          key={`pad-${index}`}
                          className="gh-contrib-cell is-outside"
                          aria-hidden="true"
                        />
                      );
                    }

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        role="gridcell"
                        className={[
                          'gh-contrib-cell',
                          `is-level-${level}`,
                          isToday ? 'is-today' : '',
                          cell.isFuture ? 'is-future' : '',
                        ].filter(Boolean).join(' ')}
                        aria-label={ariaLabel}
                        onMouseEnter={(e) => showTooltip(cell, e.currentTarget)}
                        onMouseLeave={() => setTooltip(null)}
                        onFocus={(e) => showTooltip(cell, e.currentTarget)}
                        onBlur={() => setTooltip(null)}
                        onClick={() => cell.count > 0 && navigate('/marketing/campanhas')}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="gh-contrib-footer">
            <a
              href="/marketing/campanhas"
              className="gh-contrib-link"
              onClick={(e) => {
                e.preventDefault();
                navigate('/marketing/campanhas');
              }}
            >
              Ver calendário editorial
            </a>
            <div className="gh-contrib-legend" aria-hidden="true">
              <span>Menos</span>
              <span className="gh-contrib-cell is-level-0" />
              <span className="gh-contrib-cell is-level-1" />
              <span className="gh-contrib-cell is-level-2" />
              <span className="gh-contrib-cell is-level-3" />
              <span className="gh-contrib-cell is-level-4" />
              <span>Mais</span>
            </div>
          </div>
        </div>

        {tooltip && (
          <div
            className="gh-contrib-tooltip"
            style={{ top: tooltip.top, left: tooltip.left }}
            role="tooltip"
          >
            <span>{tooltip.text}</span>
            {tooltip.titles.length > 0 && (
              <ul>
                {tooltip.titles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </QueryDataPanel>
    </section>
  );
};

export default MarketingHomeWeekCalendar;
