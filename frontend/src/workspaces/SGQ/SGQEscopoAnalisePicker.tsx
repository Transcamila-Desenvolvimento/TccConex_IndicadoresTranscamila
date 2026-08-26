import React from 'react';
import type { SgqEscopoAnaliseGrupo, SgqEscopoAnaliseMap } from '../../types/domain';
import {
  SGQ_ESCOPO_ANALISE_CATALOG,
  toggleSgqEscopoOpcao,
} from '../../types/domain';
import { useSgqEscoposAnaliseCatalog } from '../../hooks/useSgqPesquisas';

type SGQEscopoAnalisePickerProps = {
  value: SgqEscopoAnaliseMap;
  onChange: (next: SgqEscopoAnaliseMap) => void;
  disabled?: boolean;
  compact?: boolean;
  invalid?: boolean;
};

const SGQEscopoAnalisePicker: React.FC<SGQEscopoAnalisePickerProps> = ({
  value,
  onChange,
  disabled = false,
  compact = false,
  invalid = false,
}) => {
  const catalogQuery = useSgqEscoposAnaliseCatalog();
  const catalog: SgqEscopoAnaliseGrupo[] = catalogQuery.data ?? SGQ_ESCOPO_ANALISE_CATALOG;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '8px' : '12px',
        padding: compact ? '8px' : '12px 14px',
        background: '#f8fafc',
        border: `1px solid ${invalid ? '#fecaca' : '#e2e8f0'}`,
        borderRadius: '8px',
        maxHeight: compact ? '180px' : '280px',
        overflowY: 'auto',
      }}
    >
      {catalog.map((grupo) => (
        <div key={grupo.escopo}>
          <div style={{
            fontSize: compact ? '11px' : '12px',
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            marginBottom: '6px',
          }}>
            {grupo.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {grupo.opcoes.map((opcao) => {
              const checked = (value[grupo.escopo] ?? []).includes(opcao.value);
              return (
                <label
                  key={`${grupo.escopo}:${opcao.value}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: compact ? '11.5px' : '13px',
                    color: '#334155',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    lineHeight: 1.35,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onChange(toggleSgqEscopoOpcao(value, grupo.escopo, opcao.value))}
                    style={{
                      width: '14px',
                      height: '14px',
                      marginTop: '2px',
                      flexShrink: 0,
                      accentColor: '#118CC4',
                    }}
                  />
                  {opcao.label}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SGQEscopoAnalisePicker;
