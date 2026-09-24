import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

type ListPos = { top: number; left: number; width: number };

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
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [listPos, setListPos] = useState<ListPos | null>(null);
  const { data: sugestoes = [], isFetching } = useBuscarEnderecosComercial(value, open, variant);
  const showList = open && value.trim().length >= 3;

  const updateListPos = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 260);
    const maxListHeight = 220;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const openBelow = spaceBelow >= 120;
    const top = openBelow
      ? rect.bottom + gap
      : Math.max(8, rect.top - maxListHeight - gap);
    setListPos({
      top,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
      width,
    });
  };

  useLayoutEffect(() => {
    if (!showList) {
      setListPos(null);
      return;
    }
    updateListPos();
  }, [showList, value, sugestoes.length, isFetching]);

  useEffect(() => {
    if (!showList) return undefined;
    const onReposition = () => updateListPos();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [showList]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
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
  const listNode = showList && listPos
    ? createPortal(
      <div
        ref={listRef}
        id={listId}
        className="tabela-frete-endereco-autocomplete-list is-portal"
        role="listbox"
        style={{
          top: listPos.top,
          left: listPos.left,
          width: listPos.width,
        }}
      >
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
      </div>,
      document.body,
    )
    : null;

  const field = (
    <div className={`tabela-frete-endereco-autocomplete${compact ? ' is-compact' : ''}`} ref={wrapperRef}>
      <input
        ref={inputRef}
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
      {listNode}
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
