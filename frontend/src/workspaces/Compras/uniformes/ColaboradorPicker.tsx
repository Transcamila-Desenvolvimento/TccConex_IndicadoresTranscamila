import React, { useMemo, useState } from 'react';
import { useTodosColaboradoresCompras } from '../../../hooks/useCompras';

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const ColaboradorPicker: React.FC<{
  id: string;
  value: string;
  onChange: (colaboradorId: string) => void;
  autoFocus?: boolean;
}> = ({ id, value, onChange, autoFocus }) => {
  const query = useTodosColaboradoresCompras();
  const colaboradores = useMemo(() => query.data ?? [], [query.data]);
  const selecionado = colaboradores.find((c) => c.id === value);
  const [texto, setTexto] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(0);
  const aberto = texto !== null;

  const opcoes = useMemo(() => {
    const termo = normalizar((texto ?? '').trim());
    const filtrados = termo
      ? colaboradores.filter((c) => normalizar(`${c.nome} ${c.setorNome} ${c.cargo} ${c.cpf}`).includes(termo))
      : colaboradores;
    return filtrados.slice(0, 30);
  }, [colaboradores, texto]);

  const escolher = (colaboradorId: string) => {
    onChange(colaboradorId);
    setTexto(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!aberto || opcoes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((i) => (i + 1) % opcoes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => (i <= 0 ? opcoes.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      escolher(opcoes[Math.min(ativo, opcoes.length - 1)].id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTexto(null);
    }
  };

  return (
    <div className="compras-sugestoes-rh">
      <input
        id={id}
        className="form-input"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={query.isLoading ? 'Carregando...' : 'Digite o nome, setor ou CPF'}
        value={aberto ? texto : selecionado ? `${selecionado.nome} — ${selecionado.setorNome}` : ''}
        onFocus={() => { setTexto(''); setAtivo(0); }}
        onChange={(e) => { setTexto(e.target.value); setAtivo(0); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTexto(null)}
      />
      {aberto && (
        <ul className="compras-sugestoes-rh-lista" role="listbox">
          {opcoes.length === 0 ? (
            <li className="compras-sugestoes-rh-titulo">Nenhum consumidor encontrado</li>
          ) : (
            opcoes.map((c, i) => (
              <li key={c.id} role="option" aria-selected={c.id === value}>
                <button
                  type="button"
                  className={`compras-sugestoes-rh-item${i === ativo ? ' ativo' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(c.id)}
                >
                  <span className="compras-sugestoes-rh-nome">{c.nome}</span>
                  <span className="compras-sugestoes-rh-detalhe">
                    {[c.setorNome, c.cargo].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default ColaboradorPicker;
