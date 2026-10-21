import React, { useEffect, useRef, useState } from 'react';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface RHMesesPickerProps {
  /** Meses selecionados (1-12). Vazio = ano inteiro. */
  value: number[];
  onChange: (meses: number[]) => void;
  /** Meses (1-12) que têm lote importado no ano escolhido. */
  disponiveis?: number[];
}

export function rotuloMeses(meses: number[]): string {
  if (meses.length === 0 || meses.length === 12) return 'Ano inteiro';
  if (meses.length <= 3) return meses.map((mes) => MESES[mes - 1]).join(', ');
  return `${meses.length} meses`;
}

const RHMesesPicker: React.FC<RHMesesPickerProps> = ({ value, onChange, disponiveis }) => {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<number[]>(value);
  const ref = useRef<HTMLDivElement>(null);

  const aplicar = (meses: number[]) => {
    setAberto(false);
    const normalizado = meses.length === 12 ? [] : meses;
    if (normalizado.join(',') !== value.join(',')) onChange(normalizado);
  };

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) aplicar(rascunho);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  });

  const abrir = () => {
    if (aberto) {
      aplicar(rascunho);
      return;
    }
    setRascunho(value);
    setAberto(true);
  };

  const alternar = (mes: number) => {
    setRascunho((atual) => (
      atual.includes(mes) ? atual.filter((m) => m !== mes) : [...atual, mes].sort((a, b) => a - b)
    ));
  };

  return (
    <div className="rh-meses-picker" ref={ref}>
      <button
        type="button"
        className="rh-period-select rh-meses-picker-trigger"
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={abrir}
        title="Selecionar meses"
      >
        <span>{rotuloMeses(value)}</span>
        <i className="bi bi-chevron-down" aria-hidden="true" />
      </button>

      {aberto && (
        <div className="rh-meses-picker-panel" role="dialog" aria-label="Selecionar meses">
          <div className="rh-meses-picker-grid">
            {MESES.map((rotulo, indice) => {
              const mes = indice + 1;
              const selecionado = rascunho.includes(mes);
              const semLote = disponiveis !== undefined && !disponiveis.includes(mes);
              return (
                <button
                  key={rotulo}
                  type="button"
                  aria-pressed={selecionado}
                  className={`rh-meses-picker-mes${selecionado ? ' is-selected' : ''}${semLote ? ' is-vazio' : ''}`}
                  onClick={() => alternar(mes)}
                  title={semLote ? 'Sem lote importado neste mês' : undefined}
                >
                  {rotulo}
                </button>
              );
            })}
          </div>
          <div className="rh-meses-picker-footer">
            <button type="button" className="rh-meses-picker-link" onClick={() => setRascunho([])} disabled={rascunho.length === 0}>
              Limpar (ano inteiro)
            </button>
            <button type="button" className="reports-action-btn primary rh-meses-picker-ok" onClick={() => aplicar(rascunho)}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RHMesesPicker;
