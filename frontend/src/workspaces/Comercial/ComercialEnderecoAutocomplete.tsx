import React, { useEffect, useId, useRef, useState } from 'react';
import { useBuscarEnderecosComercial } from '../../hooks/useComercialClientes';
import type { EnderecoSugestao } from '../../types/domain';

export type EnderecoSelecionado = {
  label: string;
  lat?: number;
  lon?: number;
  uf?: string;
};

type Props = {
  label?: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  variant?: 'endereco' | 'cidade';
  compact?: boolean;
  inputClassName?: string;
  onChange: (value: string, coords?: { lat: number; lon: number }) => void;
};

export default function ComercialEnderecoAutocomplete({
  label,
  value,
  disabled,
  placeholder,
  variant = 'endereco',
  compact = false,
  inputClassName,
  onChange,
}: Props) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { data: sugestoes = [], isFetching } = useBuscarEnderecosComercial(value, open, variant);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: EnderecoSugestao) => {
    onChange(item.label, { lat: item.lat, lon: item.lon });
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || sugestoes.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % sugestoes.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? sugestoes.length - 1 : prev - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(sugestoes[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const emptyLabel = variant === 'cidade' ? 'Nenhuma cidade encontrada.' : 'Nenhum endereço encontrado.';
  const field = (
    <div className={`tabela-frete-endereco-autocomplete${compact ? ' is-compact' : ''}`} ref={wrapperRef}>
      <input
        type="text"
        className={inputClassName}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && value.trim().length >= 3 ? (
        <div id={listId} className="tabela-frete-endereco-autocomplete-list" role="listbox">
          {isFetching ? (
            <div className="tabela-frete-endereco-autocomplete-empty">Buscando...</div>
          ) : sugestoes.length === 0 ? (
            <div className="tabela-frete-endereco-autocomplete-empty">{emptyLabel}</div>
          ) : (
            sugestoes.map((item, index) => (
              <button
                key={`${item.label}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`tabela-frete-endereco-autocomplete-item${index === activeIndex ? ' is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(item)}
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );

  if (compact || !label) {
    return field;
  }

  return (
    <label className="tabela-frete-filter tabela-frete-filter-endereco">
      <span>{label}</span>
      {field}
    </label>
  );
}
