import React, { useEffect, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getComercialErrorMessage,
  useClientesComercial,
  useCreateTabelaFrete,
  useDeleteTabelaFrete,
  useTabelasFrete,
} from '../../hooks/useComercialClientes';
import ComercialTabelaFreteEditor from './ComercialTabelaFreteEditor';
import ComercialTabelaFreteStatusBadge from './ComercialTabelaFreteStatusBadge';
import ComercialTabelaFreteClientesPicker from './ComercialTabelaFreteClientesPicker';
import { nomeBaseTabelaFrete, formatTabelaFreteClientes } from './formatTabelaFrete';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const formatDateBr = (value?: string | null) => {
  if (!value) return '—';
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const renderUsuarioBadge = (nome?: string | null) => (
  nome ? <span className="sgq-lancado-por-badge">{nome}</span> : '—'
);

const ComercialCadastroTabelaFrete: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Comercial', 'gerenciar-tabela-frete');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [clienteIds, setClienteIds] = useState<string[]>([]);

  const listQuery = useTabelasFrete({ page, pageSize, search: search.trim() || undefined, tipo: 'distribuicao' });
  const clientesQuery = useClientesComercial({ page: 1, pageSize: 200 });
  const { canShowEmpty } = useAsyncQueryState(listQuery);
  const createTabela = useCreateTabelaFrete();
  const deleteTabela = useDeleteTabelaFrete();

  const tabelas = listQuery.data?.results ?? [];
  const clientes = clientesQuery.data?.results ?? [];
  const totalCount = listQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== clampedPage) setPage(clampedPage);
  }, [clampedPage, page]);

  if (selectedId) {
    return (
      <ComercialTabelaFreteEditor
        tabelaId={selectedId}
        canManage={canManage}
        onBack={() => setSelectedId(null)}
        onOpenTabela={(id) => setSelectedId(id)}
      />
    );
  }

  const openNew = () => {
    setNome('');
    setClienteIds([]);
    setIsModalOpen(true);
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!nome.trim()) {
      alert('Informe o nome da tabela.');
      return;
    }
    createTabela.mutate(
      { nome: nome.trim(), tipo: 'distribuicao', clienteIds },
      {
        onSuccess: (tabela) => {
          setIsModalOpen(false);
          setSelectedId(tabela.id);
        },
        onError: (err) => alert(getComercialErrorMessage(err)),
      },
    );
  };

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Tabela frete</h1>
        </div>
        {canManage && (
          <button type="button" className="reports-action-btn primary" style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', height: '38px' }} onClick={openNew}>
            Nova tabela
          </button>
        )}
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input type="text" placeholder="Nome ou cliente..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalCount}</strong> Tabela{totalCount === 1 ? '' : 's'}</span>
        </div>
      </div>

      <QueryDataPanel
        query={listQuery}
        loadingMessage="Carregando tabelas de frete..."
        refreshingMessage="Atualizando tabelas de frete..."
        errorMessage="Não foi possível carregar as tabelas de frete."
      >
        <div className="erp-card reports-table-card comercial-browse-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table comercial-browse-table tabela-frete-list-table">
              <colgroup>
                <col className="tabela-frete-list-col-nome" />
                <col className="tabela-frete-list-col-cliente" />
                <col className="tabela-frete-list-col-usuario" />
                <col className="tabela-frete-list-col-usuario" />
                <col className="tabela-frete-list-col-data" />
                <col className="tabela-frete-list-col-status" />
                {canManage ? <col className="tabela-frete-list-col-actions" /> : null}
              </colgroup>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cliente</th>
                  <th>Criado por</th>
                  <th>Atualizado por</th>
                  <th>Últ. revisão</th>
                  <th>Status</th>
                  {canManage ? <th aria-label="Ações" /> : null}
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && tabelas.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 7 : 6} className="comercial-browse-empty">
                      Não há registros a serem exibidos.
                    </td>
                  </tr>
                ) : (
                  tabelas.map((tabela) => (
                    <tr key={tabela.id} className="tabela-frete-row" onClick={() => setSelectedId(tabela.id)}>
                      <td className="tabela-frete-list-nome-cell">
                        <span className="tabela-frete-list-icon" aria-hidden><i className="bi bi-table" /></span>
                        <span className="tabela-frete-list-nome-copy">
                          <strong>{nomeBaseTabelaFrete(tabela.nome) || tabela.nome}</strong>
                          {tabela.codigo ? (
                            <span className="tabela-frete-list-meta">{tabela.codigo}</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="tabela-frete-list-text-cell">{formatTabelaFreteClientes(tabela)}</td>
                      <td className="tabela-frete-list-usuario-cell" title={tabela.criadoPorNome || undefined}>{renderUsuarioBadge(tabela.criadoPorNome)}</td>
                      <td className="tabela-frete-list-usuario-cell" title={tabela.atualizadoPorNome || undefined}>{renderUsuarioBadge(tabela.atualizadoPorNome)}</td>
                      <td className="tabela-frete-list-data-cell">{formatDateBr(tabela.dataAtualizacao ?? tabela.dataCriacao)}</td>
                      <td className="tabela-frete-list-status-cell"><ComercialTabelaFreteStatusBadge status={tabela.status ?? 'publicada'} /></td>
                      {canManage ? (
                        <td className="tabela-frete-list-actions-cell" onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-icon" title="Editar" onClick={() => setSelectedId(tabela.id)}>
                              <i className="bi bi-pencil" />
                            </button>
                            <button type="button" className="btn-icon" title="Excluir definitivamente" onClick={() => {
                              const rotulo = nomeBaseTabelaFrete(tabela.nome) || tabela.nome;
                              if (!window.confirm(`Excluir definitivamente a tabela "${rotulo}" e todas as revisões? Esta ação não pode ser desfeita.`)) return;
                              deleteTabela.mutate(tabela.id, { onError: (err) => alert(getComercialErrorMessage(err)) });
                            }}>
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="comercial-tabela-frete-page-size">Itens por página</label>
            <select id="comercial-tabela-frete-page-size" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZE_OPTIONS.map((option) => (<option key={option} value={option}>{option}</option>))}
            </select>
          </div>
          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{clampedPage}</span> de{' '}
            <span className="erp-pagination-current">{totalPages}</span>
            <span className="erp-pagination-meta">({totalCount} registros)</span>
          </span>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage <= 1} onClick={() => setPage(1)} style={{ height: '32px', width: '32px', padding: 0, opacity: clampedPage <= 1 ? 0.5 : 1 }}>«</button>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage <= 1} onClick={() => setPage(clampedPage - 1)} style={{ height: '32px', padding: '0 12px', opacity: clampedPage <= 1 ? 0.5 : 1 }}>Anterior</button>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage >= totalPages} onClick={() => setPage(clampedPage + 1)} style={{ height: '32px', padding: '0 12px', opacity: clampedPage >= totalPages ? 0.5 : 1 }}>Próximo</button>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage >= totalPages} onClick={() => setPage(totalPages)} style={{ height: '32px', width: '32px', padding: 0, opacity: clampedPage >= totalPages ? 0.5 : 1 }}>»</button>
        </div>
      </QueryDataPanel>

      {isModalOpen && (
        <div className="search-backdrop" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <form className="modal-card tabela-frete-nova-modal" onSubmit={handleCreate}>
            <div className="modal-header">
              <h3>Nova tabela de frete</h3>
              <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-body">
              <label className="tabela-frete-nova-field">
                Nome
                <input className="form-input" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
              </label>
              <div className="tabela-frete-nova-field">
                <span>Clientes vinculados</span>
                <ComercialTabelaFreteClientesPicker
                  clientes={clientes}
                  selectedIds={clienteIds}
                  variant="inline"
                  onChange={setClienteIds}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="reports-action-btn secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button type="submit" className="reports-action-btn primary" disabled={createTabela.isPending}>
                {createTabela.isPending ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ComercialCadastroTabelaFrete;
