import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

interface NormaOpcao {
  id: string;
  nome: string;
  descricao?: string;
  ativa?: boolean;
  compartilhada?: boolean;
}

interface SGQNormasPickerProps {
  /** Normas ativas da filial que podem ser vinculadas. */
  opcoes: NormaOpcao[];
  /** Normas já vinculadas à auditoria (podem estar inativas). */
  vinculadas?: NormaOpcao[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  carregando?: boolean;
  podeCadastrar?: boolean;
}

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const SGQNormasPicker: React.FC<SGQNormasPickerProps> = ({
  opcoes, vinculadas = [], value, onChange, disabled, carregando, podeCadastrar,
}) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [aberto]);

  const todas = useMemo(() => {
    const mapa = new Map<string, NormaOpcao>();
    vinculadas.forEach((norma) => mapa.set(norma.id, norma));
    opcoes.forEach((norma) => mapa.set(norma.id, { ...mapa.get(norma.id), ...norma, ativa: true }));
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [opcoes, vinculadas]);

  const porId = useMemo(() => new Map(todas.map((norma) => [norma.id, norma])), [todas]);
  const selecionadas = value.map((id) => porId.get(id)).filter((norma): norma is NormaOpcao => Boolean(norma));
  const termo = normalizar(busca.trim());
  const filtradas = todas.filter((norma) => (
    (norma.ativa !== false || value.includes(norma.id))
    && (!termo || normalizar(`${norma.nome} ${norma.descricao ?? ''}`).includes(termo))
  ));

  const alternar = (id: string) => {
    onChange(value.includes(id) ? value.filter((atual) => atual !== id) : [...value, id]);
  };

  return (
    <div className={`sgq-normas-picker${aberto ? ' is-open' : ''}`} ref={raizRef}>
      <div
        className={`form-input sgq-normas-picker-trigger${disabled ? ' is-disabled' : ''}`}
        role="combobox"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) setAberto((atual) => !atual); }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); }
          if (e.key === 'Escape') setAberto(false);
        }}
      >
        {selecionadas.length === 0 ? (
          <span className="sgq-normas-picker-placeholder">Selecione as normas</span>
        ) : selecionadas.map((norma) => (
          <span key={norma.id} className={`sgq-normas-picker-chip${norma.ativa === false ? ' is-inativa' : ''}`} title={norma.nome}>
            <span>{norma.nome}</span>
            {!disabled && (
              <button
                type="button"
                aria-label={`Remover ${norma.nome}`}
                onClick={(e) => { e.stopPropagation(); alternar(norma.id); }}
              >
                <i className="bi bi-x" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        <i className={`bi ${aberto ? 'bi-chevron-up' : 'bi-chevron-down'} sgq-normas-picker-caret`} aria-hidden="true" />
      </div>

      {aberto && (
        <div className="sgq-normas-picker-panel">
          <div className="sgq-normas-picker-busca">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setAberto(false); }}
              placeholder="Buscar norma..."
              aria-label="Buscar norma"
            />
          </div>
          <ul className="sgq-normas-picker-lista" role="listbox" aria-multiselectable="true">
            {carregando ? (
              <li className="sgq-normas-picker-vazio">Carregando normas...</li>
            ) : filtradas.length === 0 ? (
              <li className="sgq-normas-picker-vazio">
                {todas.length === 0 ? 'Nenhuma norma ativa cadastrada.' : 'Nenhuma norma encontrada.'}
              </li>
            ) : filtradas.map((norma) => {
              const marcada = value.includes(norma.id);
              return (
                <li key={norma.id}>
                  <label className={`sgq-normas-picker-opcao${marcada ? ' is-selected' : ''}`} role="option" aria-selected={marcada}>
                    <input type="checkbox" checked={marcada} onChange={() => alternar(norma.id)} />
                    <span className="sgq-normas-picker-texto">
                      <strong>
                        {norma.nome}
                        {norma.ativa === false && <em> · inativa</em>}
                        {norma.compartilhada && <em> · compartilhada</em>}
                      </strong>
                      {norma.descricao && <small>{norma.descricao}</small>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="sgq-normas-picker-rodape">
            <span>{value.length} selecionada(s)</span>
            {podeCadastrar && (
              <Link to="/sgq/auditorias/normas" target="_blank" rel="noreferrer">
                <i className="bi bi-box-arrow-up-right" aria-hidden="true" /> Gerenciar normas
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SGQNormasPicker;
