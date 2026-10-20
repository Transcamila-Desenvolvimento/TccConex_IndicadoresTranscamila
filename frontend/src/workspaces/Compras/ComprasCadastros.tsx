import React, { useEffect, useMemo, useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState, type QueryResultLike } from '../../hooks/useAsyncQueryState';
import {
  useUnidadesMedida,
  useCreateUnidadeMedida,
  useUpdateUnidadeMedida,
  useDeleteUnidadeMedida,
  useFornecedores,
  useCreateFornecedor,
  useUpdateFornecedor,
  useDeleteFornecedor,
  useSetoresCompras,
  useCreateSetorCompras,
  useUpdateSetorCompras,
  useDeleteSetorCompras,
  useTodosColaboradoresCompras,
  useCreateColaboradorCompras,
  useUpdateColaboradorCompras,
  useDeleteColaboradorCompras,
  useSugestoesRHConsumidor,
  getComprasErrorMessage,
} from '../../hooks/useCompras';
import type { ColaboradorCompras, SugestaoRHConsumidor } from '../../types/domain';
import SimpleListModal from './modals/SimpleListModal';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

function usePaginacao<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const paged = items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
  return { page: clampedPage, setPage, pageSize, setPageSize, totalPages, paged, total: items.length };
}

type Paginacao = ReturnType<typeof usePaginacao>;

const BarraPaginacao: React.FC<{ id: string; paginacao: Paginacao }> = ({ id, paginacao }) => {
  const { page, setPage, pageSize, setPageSize, totalPages, total } = paginacao;
  const navBtn = (disabled: boolean): React.CSSProperties => ({
    height: '32px', fontSize: '12px', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
  });
  return (
    <div className="erp-pagination-bar">
      <div className="erp-pagination-page-size">
        <label htmlFor={id}>Itens por página</label>
        <select id={id} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <span style={{ fontWeight: 500, marginRight: '4px' }}>
        Página <span className="erp-pagination-current">{page}</span> de{' '}
        <span className="erp-pagination-current">{totalPages}</span>
        <span className="erp-pagination-meta">({total} registros)</span>
      </span>
      <button type="button" className="reports-action-btn secondary" title="Primeira página" aria-label="Primeira página" disabled={page <= 1} onClick={() => setPage(1)} style={{ ...navBtn(page <= 1), width: '32px', padding: 0 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 4.5l-7.5 7.5 7.5 7.5M11.25 4.5l-7.5 7.5 7.5 7.5" /></svg>
      </button>
      <button type="button" className="reports-action-btn secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ ...navBtn(page <= 1), padding: '0 12px', gap: '6px' }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Anterior
      </button>
      <button type="button" className="reports-action-btn secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ ...navBtn(page >= totalPages), padding: '0 12px', gap: '6px' }}>
        Próximo
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
      <button type="button" className="reports-action-btn secondary" title="Última página" aria-label="Última página" disabled={page >= totalPages} onClick={() => setPage(totalPages)} style={{ ...navBtn(page >= totalPages), width: '32px', padding: 0 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
    </div>
  );
};

const Cabecalho: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
      <h1 className="view-page-title">{title}</h1>
    </div>
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>{children}</div>
  </header>
);

const BotaoNovo: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    className="reports-action-btn primary"
    style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
    onClick={onClick}
  >
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
    <span>{label}</span>
  </button>
);

const Busca: React.FC<{ value: string; placeholder: string; onChange: (value: string) => void }> = ({ value, placeholder, onChange }) => (
  <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
    <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
    </svg>
    <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const ModalCadastro: React.FC<{
  title: string;
  submitLabel: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}> = ({ title, submitLabel, isPending, onClose, onSubmit, children }) => (
  <div
    className="search-backdrop"
    style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div className="modal-card" style={{ width: 'min(520px, 100%)' }} role="dialog" aria-modal="true">
      <div className="modal-header">
        <h3>{title}</h3>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
          <i className="bi bi-x-lg" />
        </button>
      </div>
      <form className="modal-body" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        {children}
        <div className="modal-footer" style={{ marginTop: '20px' }}>
          <button type="button" className="reports-action-btn secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="reports-action-btn primary" disabled={isPending}>
            {isPending ? 'Salvando...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  </div>
);

const AcoesLinha: React.FC<{ singular: string; onEdit: () => void; onDelete: () => void }> = ({ singular, onEdit, onDelete }) => (
  <div style={{ display: 'flex', gap: '4px' }}>
    <button type="button" className="btn-icon" title={`Editar ${singular}`} onClick={onEdit}>
      <i className="bi bi-pencil" />
    </button>
    <button type="button" className="btn-icon" title={`Excluir ${singular}`} onClick={onDelete}>
      <i className="bi bi-trash" />
    </button>
  </div>
);

// ─── Cadastros só com nome (medidas e fornecedores) ─────────────────────────

interface ItemNome { id: string; nome: string }

interface CadastroNomeProps {
  title: string;
  singular: string;
  plural: string;
  novoLabel: string;
  placeholder: string;
  idPrefix: string;
  query: QueryResultLike<ItemNome[]>;
  create: UseMutationResult<unknown, unknown, string>;
  update: UseMutationResult<unknown, unknown, { id: string; nome: string }>;
  remove: UseMutationResult<unknown, unknown, string>;
}

const CadastroNome: React.FC<CadastroNomeProps> = ({
  title, singular, plural, novoLabel, placeholder, idPrefix, query, create, update, remove,
}) => {
  const { canShowEmpty } = useAsyncQueryState(query);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ id: string | null; nome: string } | null>(null);

  const items = useMemo(() => query.data ?? [], [query.data]);
  const filtrados = useMemo(() => {
    const termo = normalizar(search.trim());
    return termo ? items.filter((item) => normalizar(item.nome).includes(termo)) : items;
  }, [items, search]);
  const paginacao = usePaginacao(filtrados);

  const salvar = () => {
    if (!modal) return;
    const nome = modal.nome.trim();
    if (!nome) {
      alert(`Informe o nome d${singular.endsWith('a') ? 'a' : 'o'} ${singular}.`);
      return;
    }
    if (items.some((item) => item.id !== modal.id && item.nome.toLowerCase() === nome.toLowerCase())) {
      alert('Já existe um cadastro com este nome.');
      return;
    }
    const callbacks = {
      onSuccess: () => setModal(null),
      onError: (err: unknown) => alert(getComprasErrorMessage(err, 'Não foi possível salvar.')),
    };
    if (modal.id) update.mutate({ id: modal.id, nome }, callbacks);
    else create.mutate(nome, callbacks);
  };

  const excluir = (item: ItemNome) => {
    if (!window.confirm(`Excluir "${item.nome}"?`)) return;
    remove.mutate(item.id, {
      onError: (err) => alert(getComprasErrorMessage(err, 'Não foi possível excluir.')),
    });
  };

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <Cabecalho title={title}>
        <BotaoNovo label={novoLabel} onClick={() => setModal({ id: null, nome: '' })} />
      </Cabecalho>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Busca value={search} placeholder="Nome..." onChange={(v) => { setSearch(v); paginacao.setPage(1); }} />
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{filtrados.length}</strong> {plural}</span>
        </div>
      </div>

      <QueryDataPanel
        query={query}
        loadingMessage={`Carregando ${plural.toLowerCase()}...`}
        refreshingMessage={`Atualizando ${plural.toLowerCase()}...`}
        errorMessage={`Não foi possível carregar ${plural.toLowerCase()}. Tente novamente.`}
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum cadastro encontrado.
                    </td>
                  </tr>
                ) : (
                  paginacao.paged.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.nome}</strong></td>
                      <td>
                        <AcoesLinha
                          singular={singular}
                          onEdit={() => setModal({ id: item.id, nome: item.nome })}
                          onDelete={() => excluir(item)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <BarraPaginacao id={`${idPrefix}-page-size`} paginacao={paginacao} />
      </QueryDataPanel>

      {modal && (
        <ModalCadastro
          title={modal.id ? `Editar ${singular}` : novoLabel}
          submitLabel={modal.id ? 'Salvar alterações' : 'Cadastrar'}
          isPending={create.isPending || update.isPending}
          onClose={() => setModal(null)}
          onSubmit={salvar}
        >
          <div className="form-grid">
            <label>
              Nome
              <input
                type="text"
                className="form-input"
                required
                autoFocus
                placeholder={placeholder}
                value={modal.nome}
                onChange={(e) => setModal({ ...modal, nome: e.target.value })}
              />
            </label>
          </div>
        </ModalCadastro>
      )}
    </div>
  );
};

export const ComprasCadastroMedidas: React.FC = () => (
  <CadastroNome
    title="Cadastro de medidas"
    singular="medida"
    plural="Medidas"
    novoLabel="Nova medida"
    placeholder="Ex: Un, Resma, Caixa..."
    idPrefix="compras-medidas"
    query={useUnidadesMedida()}
    create={useCreateUnidadeMedida()}
    update={useUpdateUnidadeMedida()}
    remove={useDeleteUnidadeMedida()}
  />
);

export const ComprasCadastroFornecedores: React.FC = () => (
  <CadastroNome
    title="Cadastro fornecedores"
    singular="fornecedor"
    plural="Fornecedores"
    novoLabel="Novo fornecedor"
    placeholder="Ex: Papelaria Exclusiva..."
    idPrefix="compras-fornecedores"
    query={useFornecedores()}
    create={useCreateFornecedor()}
    update={useUpdateFornecedor()}
    remove={useDeleteFornecedor()}
  />
);

// ─── Consumidores (colaboradores por setor) ─────────────────────────────────

const CampoNomeComSugestoesRH: React.FC<{
  value: string;
  onChange: (nome: string) => void;
  onSelecionar: (sugestao: SugestaoRHConsumidor) => void;
}> = ({ value, onChange, onSelecionar }) => {
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => setTermo(value), 300);
    return () => window.clearTimeout(timer);
  }, [value]);

  const sugestoesQuery = useSugestoesRHConsumidor(termo);
  const sugestoes = aberto ? sugestoesQuery.data ?? [] : [];

  const selecionar = (sugestao: SugestaoRHConsumidor) => {
    onSelecionar(sugestao);
    setAberto(false);
    setAtivo(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((i) => (i + 1) % sugestoes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => (i <= 0 ? sugestoes.length - 1 : i - 1));
    } else if (e.key === 'Enter' && ativo >= 0) {
      e.preventDefault();
      selecionar(sugestoes[ativo]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAberto(false);
    }
  };

  return (
    <div className="compras-sugestoes-rh">
      <input
        type="text"
        className="form-input"
        required
        autoFocus
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
          setAtivo(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setAberto(false)}
      />
      {sugestoes.length > 0 && (
        <ul className="compras-sugestoes-rh-lista" role="listbox">
          <li className="compras-sugestoes-rh-titulo">Ativos no RH</li>
          {sugestoes.map((s, i) => (
            <li key={s.cpf || s.nome} role="option" aria-selected={i === ativo}>
              <button
                type="button"
                className={`compras-sugestoes-rh-item${i === ativo ? ' ativo' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(s)}
              >
                <span className="compras-sugestoes-rh-nome">{s.nome}</span>
                <span className="compras-sugestoes-rh-detalhe">
                  {[s.filial, s.cargo, s.cpf ? formatCpf(s.cpf) : ''].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const ComprasCadastroConsumidores: React.FC = () => {
  const colaboradoresQuery = useTodosColaboradoresCompras();
  const setoresQuery = useSetoresCompras();
  const { canShowEmpty } = useAsyncQueryState(colaboradoresQuery);
  const createColaborador = useCreateColaboradorCompras();
  const updateColaborador = useUpdateColaboradorCompras();
  const deleteColaborador = useDeleteColaboradorCompras();
  const createSetor = useCreateSetorCompras();
  const updateSetor = useUpdateSetorCompras();
  const deleteSetor = useDeleteSetorCompras();

  const [search, setSearch] = useState('');
  const [filterSetor, setFilterSetor] = useState('');
  const [isSetoresOpen, setIsSetoresOpen] = useState(false);
  const [modal, setModal] = useState<{
    id: string | null;
    nome: string;
    cargo: string;
    cpf: string;
    setorId: string;
  } | null>(null);

  const colaboradores = useMemo(() => colaboradoresQuery.data ?? [], [colaboradoresQuery.data]);
  const setores = useMemo(() => setoresQuery.data ?? [], [setoresQuery.data]);
  const filtrados = useMemo(() => {
    const termo = normalizar(search.trim());
    return colaboradores.filter((c) => {
      if (filterSetor && String(c.setorId) !== filterSetor) return false;
      return !termo || normalizar(`${c.nome} ${c.cargo} ${c.cpf} ${formatCpf(c.cpf)} ${c.setorNome}`).includes(termo);
    });
  }, [colaboradores, search, filterSetor]);
  const paginacao = usePaginacao(filtrados);

  const salvar = () => {
    if (!modal) return;
    const nome = modal.nome.trim();
    if (!nome) {
      alert('Informe o nome do consumidor.');
      return;
    }
    if (!modal.setorId) {
      alert('Selecione o setor.');
      return;
    }
    const cpf = modal.cpf.replace(/\D/g, '');
    if (cpf && cpf.length !== 11) {
      alert('CPF deve conter 11 dígitos.');
      return;
    }
    const payload = { nome, cargo: modal.cargo.trim(), cpf, setorId: modal.setorId };
    const duplicado = colaboradores.some(
      (c) => c.id !== modal.id && String(c.setorId) === modal.setorId && c.nome.toLowerCase() === nome.toLowerCase(),
    );
    if (duplicado) {
      alert('Já existe um consumidor com este nome neste setor.');
      return;
    }
    const callbacks = {
      onSuccess: () => setModal(null),
      onError: (err: unknown) => alert(getComprasErrorMessage(err, 'Não foi possível salvar o consumidor.')),
    };
    if (modal.id) updateColaborador.mutate({ id: modal.id, ...payload }, callbacks);
    else createColaborador.mutate(payload, callbacks);
  };

  const excluir = (colaborador: ColaboradorCompras) => {
    if (!window.confirm(`Excluir o consumidor ${colaborador.nome}?`)) return;
    deleteColaborador.mutate(colaborador.id, {
      onError: (err) => alert(getComprasErrorMessage(err, 'Não foi possível excluir o consumidor.')),
    });
  };

  const removerSetor = (id: string) => {
    const setor = setores.find((s) => s.id === id);
    if (setor && (setor.colaboradoresCount ?? 0) > 0) {
      alert(`O setor "${setor.nome}" possui ${setor.colaboradoresCount} consumidor(es). Remova ou mova os consumidores antes de excluir o setor.`);
      return;
    }
    deleteSetor.mutate(id, {
      onError: (err) => alert(getComprasErrorMessage(err, 'Não foi possível excluir o setor.')),
    });
  };

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <Cabecalho title="Cadastro consumidores">
        <button
          type="button"
          className="reports-action-btn secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
          onClick={() => setIsSetoresOpen(true)}
        >
          <i className="bi bi-diagram-3" />
          <span>Setores</span>
        </button>
        <BotaoNovo
          label="Novo consumidor"
          onClick={() => setModal({ id: null, nome: '', cargo: '', cpf: '', setorId: filterSetor })}
        />
      </Cabecalho>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Busca value={search} placeholder="Nome, cargo, CPF, setor..." onChange={(v) => { setSearch(v); paginacao.setPage(1); }} />
          <div className="reports-select-wrapper" style={{ minWidth: '180px' }}>
            <select value={filterSetor} onChange={(e) => { setFilterSetor(e.target.value); paginacao.setPage(1); }}>
              <option value="">Setor: Todos</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{filtrados.length}</strong> Consumidores</span>
        </div>
      </div>

      <QueryDataPanel
        query={colaboradoresQuery}
        loadingMessage="Carregando consumidores..."
        refreshingMessage="Atualizando consumidores..."
        errorMessage="Não foi possível carregar os consumidores. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>CPF</th>
                  <th>Setor</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum consumidor cadastrado.
                    </td>
                  </tr>
                ) : (
                  paginacao.paged.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.nome}</strong></td>
                      <td>{c.cargo || '—'}</td>
                      <td>{c.cpf ? formatCpf(c.cpf) : '—'}</td>
                      <td>{c.setorNome || '—'}</td>
                      <td>
                        <AcoesLinha
                          singular="consumidor"
                          onEdit={() => setModal({
                            id: c.id,
                            nome: c.nome,
                            cargo: c.cargo ?? '',
                            cpf: formatCpf(c.cpf ?? ''),
                            setorId: String(c.setorId),
                          })}
                          onDelete={() => excluir(c)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <BarraPaginacao id="compras-consumidores-page-size" paginacao={paginacao} />
      </QueryDataPanel>

      {modal && (
        <ModalCadastro
          title={modal.id ? 'Editar consumidor' : 'Novo consumidor'}
          submitLabel={modal.id ? 'Salvar alterações' : 'Cadastrar consumidor'}
          isPending={createColaborador.isPending || updateColaborador.isPending}
          onClose={() => setModal(null)}
          onSubmit={salvar}
        >
          <div className="form-grid two-cols">
            <label>
              Nome
              <CampoNomeComSugestoesRH
                value={modal.nome}
                onChange={(nome) => setModal({ ...modal, nome })}
                onSelecionar={(s) => setModal({ ...modal, nome: s.nome, cargo: s.cargo, cpf: formatCpf(s.cpf) })}
              />
            </label>
            <label>
              Cargo
              <input
                type="text"
                className="form-input"
                maxLength={100}
                placeholder="Opcional"
                value={modal.cargo}
                onChange={(e) => setModal({ ...modal, cargo: e.target.value })}
              />
            </label>
            <label>
              CPF
              <input
                type="text"
                className="form-input"
                inputMode="numeric"
                placeholder="Opcional"
                value={modal.cpf}
                onChange={(e) => setModal({ ...modal, cpf: formatCpf(e.target.value) })}
              />
            </label>
            <label>
              Setor
              <select
                className="form-input"
                required
                value={modal.setorId}
                onChange={(e) => setModal({ ...modal, setorId: e.target.value })}
              >
                <option value="" disabled>{setores.length === 0 ? 'Cadastre um setor primeiro' : 'Selecione'}</option>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </label>
          </div>
        </ModalCadastro>
      )}

      {isSetoresOpen && (
        <SimpleListModal
          title="Setores"
          placeholder="Ex: Logística, Frota..."
          query={setoresQuery}
          onAdd={(nome) => createSetor.mutate(nome)}
          onEdit={(id, nome) => updateSetor.mutate({ id, nome })}
          onRemove={removerSetor}
          isAdding={createSetor.isPending}
          isSaving={updateSetor.isPending}
          isRemoving={deleteSetor.isPending}
          errorMessage={createSetor.isError ? getComprasErrorMessage(createSetor.error, 'Não foi possível adicionar o setor.') : null}
          onClose={() => setIsSetoresOpen(false)}
        />
      )}
    </div>
  );
};
