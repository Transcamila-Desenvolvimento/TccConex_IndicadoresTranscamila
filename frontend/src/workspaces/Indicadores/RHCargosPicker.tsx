import React, { useEffect, useMemo, useRef, useState } from 'react';

interface RHCargosPickerProps {
  /** Cargos selecionados. Vazio = todos os cargos. */
  value: string[];
  onChange: (cargos: string[]) => void;
  disponiveis: string[];
}

function rotuloCargos(cargos: string[]): string {
  if (cargos.length === 0) return 'Todos os cargos';
  if (cargos.length === 1) return cargos[0];
  return `${cargos.length} cargos`;
}

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const RHCargosPicker: React.FC<RHCargosPickerProps> = ({ value, onChange, disponiveis }) => {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<string[]>(value);
  const [busca, setBusca] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const aplicar = (cargos: string[]) => {
    setAberto(false);
    const normalizado = cargos.length === disponiveis.length ? [] : cargos;
    if ([...normalizado].sort().join('\n') !== [...value].sort().join('\n')) onChange(normalizado);
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
    setBusca('');
    setAberto(true);
  };

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    return termo ? disponiveis.filter((nome) => normalizar(nome).includes(termo)) : disponiveis;
  }, [busca, disponiveis]);

  const alternar = (nome: string) => {
    setRascunho((atual) => (atual.includes(nome) ? atual.filter((c) => c !== nome) : [...atual, nome]));
  };

  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((nome) => rascunho.includes(nome));

  const alternarVisiveis = () => {
    setRascunho((atual) => (
      todosVisiveisMarcados
        ? atual.filter((c) => !visiveis.includes(c))
        : Array.from(new Set([...atual, ...visiveis]))
    ));
  };

  return (
    <div className="rh-meses-picker" ref={ref}>
      <button
        type="button"
        className="rh-period-select rh-meses-picker-trigger rh-cargos-picker-trigger"
        aria-haspopup="true"
        aria-expanded={aberto}
        onClick={abrir}
        title={value.length ? value.join('\n') : 'Filtrar por cargo'}
      >
        <span>{rotuloCargos(value)}</span>
        <i className="bi bi-chevron-down" aria-hidden="true" />
      </button>

      {aberto && (
        <div className="rh-meses-picker-panel rh-cargos-picker-panel" role="dialog" aria-label="Selecionar cargos">
          <input
            type="text"
            className="rh-cargos-picker-busca"
            placeholder="Buscar cargo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
          />

          <label className="rh-cargos-picker-item rh-cargos-picker-todos">
            <input
              type="checkbox"
              checked={todosVisiveisMarcados}
              onChange={alternarVisiveis}
              disabled={visiveis.length === 0}
            />
            <span>{busca.trim() ? 'Selecionar resultados' : 'Selecionar todos'}</span>
          </label>

          <div className="rh-cargos-picker-lista">
            {visiveis.length === 0 ? (
              <div className="rh-cargos-picker-vazio">Nenhum cargo encontrado</div>
            ) : (
              visiveis.map((nome) => (
                <label key={nome} className="rh-cargos-picker-item" title={nome}>
                  <input type="checkbox" checked={rascunho.includes(nome)} onChange={() => alternar(nome)} />
                  <span>{nome}</span>
                </label>
              ))
            )}
          </div>

          <div className="rh-meses-picker-footer">
            <button type="button" className="rh-meses-picker-link" onClick={() => setRascunho([])} disabled={rascunho.length === 0}>
              Limpar
            </button>
            <button type="button" className="reports-action-btn primary rh-meses-picker-ok" onClick={() => aplicar(rascunho)}>
              Aplicar{rascunho.length ? ` (${rascunho.length})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RHCargosPicker;
