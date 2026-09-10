import { useEffect, useId, useMemo, useRef, useState } from 'react';

import type { ClienteComercial } from '../../types/domain';

type Props = {
  clientes: ClienteComercial[];
  selectedIds: string[];
  disabled?: boolean;
  variant?: 'dropdown' | 'inline';
  onChange: (ids: string[]) => void;
};

const buildSummary = (clientes: ClienteComercial[], selectedIds: string[]) => {
  if (selectedIds.length === 0) return 'Sem vínculo';
  const nomes = selectedIds
    .map((id) => clientes.find((cliente) => cliente.id === id))
    .filter(Boolean)
    .map((cliente) => cliente!.nomeFantasia || cliente!.razaoSocial);
  if (nomes.length === 0) return `${selectedIds.length} selecionado${selectedIds.length === 1 ? '' : 's'}`;
  if (nomes.length <= 2) return nomes.join(', ');
  return `${nomes.slice(0, 2).join(', ')} +${nomes.length - 2}`;
};

export default function ComercialTabelaFreteClientesPicker({
  clientes,
  selectedIds,
  disabled = false,
  variant = 'dropdown',
  onChange,
}: Props) {
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inline = variant === 'inline';

  const summary = useMemo(() => buildSummary(clientes, selectedIds), [clientes, selectedIds]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clientes;
    return clientes.filter((cliente) => {
      const nome = (cliente.nomeFantasia || cliente.razaoSocial || '').toLowerCase();
      const cnpj = (cliente.cnpj || '').toLowerCase();
      return nome.includes(query) || cnpj.includes(query);
    });
  }, [clientes, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const toggle = (id: string) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const showFilter = clientes.length > 6;
  const list = (
    <>
      {showFilter || selectedIds.length > 0 ? (
        <div className="tabela-frete-clientes-panel-head">
          {showFilter ? (
            <input
              type="search"
              className="tabela-frete-clientes-panel-search"
              placeholder="Filtrar clientes..."
              value={search}
              autoFocus={!inline}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filtrar clientes"
            />
          ) : null}
          <button
            type="button"
            className="tabela-frete-clientes-panel-clear"
            disabled={disabled || selectedIds.length === 0}
            onClick={clearAll}
          >
            Limpar
          </button>
        </div>
      ) : null}
      <div className="tabela-frete-clientes-checklist">
        {filtered.length === 0 ? (
          <p className="tabela-frete-clientes-empty">Nenhum cliente encontrado.</p>
        ) : (
          filtered.map((cliente) => {
            const label = cliente.nomeFantasia || cliente.razaoSocial;
            const checked = selectedIds.includes(cliente.id);
            return (
              <label
                key={cliente.id}
                className={`tabela-frete-cliente-check${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(cliente.id)}
                />
                <span>{label}</span>
              </label>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div
      ref={wrapperRef}
      className={`tabela-frete-clientes-field${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${inline ? ' is-inline' : ''}`}
    >
      {inline ? (
        <div id={panelId} className="tabela-frete-clientes-panel is-inline" role="group" aria-label="Clientes vinculados">
          {list}
        </div>
      ) : (
        <>
          <button
            type="button"
            className="tabela-frete-clientes-trigger"
            disabled={disabled}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className={`tabela-frete-clientes-trigger-text${selectedIds.length === 0 ? ' is-placeholder' : ''}`}>
              {summary}
            </span>
            <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden />
          </button>
          {open ? (
            <div id={panelId} className="tabela-frete-clientes-panel" role="group" aria-label="Clientes vinculados">
              {list}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
