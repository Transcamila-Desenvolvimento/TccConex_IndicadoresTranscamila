import React, { useEffect, useRef } from 'react';
import type { OpsIndicadoresGranularity } from '../../types/domain';
import {
  ALL_MONTHS,
  MONTH_OPTIONS,
  effectiveGranularity,
  monthsLabel,
} from './ocorrenciasFilters';

export interface OcorrenciasIndicadoresFiltersProps {
  filial: string;
  onFilialChange: (value: string) => void;
  year: number | '';
  onYearChange: (value: number | '') => void;
  months: number[];
  onMonthsChange: (value: number[]) => void;
  availableYears: number[];
  filiais: string[];
  onClear: () => void;
  filialLabel?: string;
}

export interface OcorrenciasGranularityToggleProps {
  months: number[];
  granularity: OpsIndicadoresGranularity;
  onGranularityChange: (value: OpsIndicadoresGranularity) => void;
}

export const OcorrenciasGranularityToggle: React.FC<OcorrenciasGranularityToggleProps> = ({
  months,
  granularity,
  onGranularityChange,
}) => {
  const dayViewAllowed = months.length === 1;
  const effective = effectiveGranularity(months, granularity);

  return (
    <div className="segmented-tabs-container" role="group" aria-label="Granularidade do gráfico">
      <button
        type="button"
        className={`segmented-tab-btn${effective === 'month' ? ' active' : ''}`}
        onClick={() => onGranularityChange('month')}
      >
        Mês
      </button>
      <span
        title={
          dayViewAllowed
            ? 'Visão diária disponível para o mês selecionado'
            : 'Para usar a visão diária, é obrigatório selecionar exatamente um mês no filtro'
        }
        style={{ display: 'inline-flex' }}
      >
        <button
          type="button"
          className={`segmented-tab-btn${effective === 'day' ? ' active' : ''}`}
          disabled={!dayViewAllowed}
          aria-disabled={!dayViewAllowed}
          onClick={() => onGranularityChange('day')}
        >
          Dia
        </button>
      </span>
    </div>
  );
};

const OcorrenciasIndicadoresFilters: React.FC<OcorrenciasIndicadoresFiltersProps> = ({
  filial,
  onFilialChange,
  year,
  onYearChange,
  months,
  onMonthsChange,
  availableYears,
  filiais,
  onClear,
  filialLabel = 'Filial',
}) => {
  const [monthsOpen, setMonthsOpen] = React.useState(false);
  const monthsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!monthsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!monthsDropdownRef.current?.contains(event.target as Node)) {
        setMonthsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [monthsOpen]);

  return (
    <div className="reports-filters-bar" style={{ marginBottom: '16px', position: 'relative', zIndex: 5, flexShrink: 0 }}>
      <div className="reports-filter-left">
        <div className="reports-select-wrapper">
          <select
            value={filial}
            onChange={(e) => onFilialChange(e.target.value)}
            style={{ minWidth: 180 }}
            aria-label={`Filtrar por ${filialLabel.toLowerCase()}`}
          >
            <option value="">{filialLabel}: Todas</option>
            {filiais.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="reports-select-wrapper">
          <select
            value={year === '' ? '' : String(year)}
            onChange={(e) => onYearChange(e.target.value ? Number(e.target.value) : '')}
            style={{ minWidth: 130 }}
            aria-label="Filtrar por ano"
          >
            <option value="">Ano: Todos</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>Ano: {y}</option>
            ))}
          </select>
        </div>

        <div ref={monthsDropdownRef} className="reports-dropdown-wrapper cashflow-accounts-dropdown">
          <button
            type="button"
            className="reports-action-btn secondary cashflow-accounts-trigger"
            aria-expanded={monthsOpen}
            aria-haspopup="listbox"
            onClick={() => setMonthsOpen((open) => !open)}
          >
            <span>{monthsLabel(months)}</span>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            className={`reports-dropdown-menu cashflow-accounts-menu ${monthsOpen ? 'show' : ''}`}
            role="listbox"
            aria-multiselectable="true"
          >
            <div className="cashflow-accounts-menu-actions">
              <button type="button" onClick={() => onMonthsChange([...ALL_MONTHS])}>
                Marcar todos
              </button>
              <button type="button" onClick={() => onMonthsChange([])}>
                Desmarcar todos
              </button>
            </div>
            <label className="cashflow-accounts-menu-item">
              <input
                type="checkbox"
                checked={months.length === 12}
                ref={(el) => {
                  if (el) el.indeterminate = months.length > 0 && months.length < 12;
                }}
                onChange={(e) => onMonthsChange(e.target.checked ? [...ALL_MONTHS] : [])}
              />
              <span>Todos os meses</span>
            </label>
            <div className="cashflow-accounts-menu-list">
              {MONTH_OPTIONS.map((item) => (
                <label key={item.value} className="cashflow-accounts-menu-item">
                  <input
                    type="checkbox"
                    checked={months.includes(item.value)}
                    onChange={() => {
                      const next = months.includes(item.value)
                        ? months.filter((m) => m !== item.value)
                        : [...months, item.value].sort((a, b) => a - b);
                      onMonthsChange(next);
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button type="button" className="reports-action-btn secondary" onClick={onClear}>
          Limpar Filtros
        </button>
      </div>
    </div>
  );
};

export default OcorrenciasIndicadoresFilters;
