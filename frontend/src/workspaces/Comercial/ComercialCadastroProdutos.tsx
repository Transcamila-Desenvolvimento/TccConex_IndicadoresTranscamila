import React, { useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getComercialErrorMessage,
  useClienteProdutosSugestoesComercial,
  useClientesComercial,
  useCreateProdutoComercial,
  useDeleteProdutoComercial,
  useProdutosComercial,
  useUpdateProdutoComercial,
} from '../../hooks/useComercialClientes';
import type { ClienteComercialClasseRisco, ClienteComercialGrupoEmbalagem, ProdutoComercial } from '../../types/domain';
import {
  CLIENTE_COMERCIAL_CLASSE_RISCO_OPTIONS,
  CLIENTE_COMERCIAL_GRUPO_EMBALAGEM_OPTIONS,
  parseClienteComercialClasseRisco,
  parseClienteComercialGrupoEmbalagem,
} from '../../types/domain';
import ComercialHomologacaoBadge from './ComercialHomologacaoBadge';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const emptyForm = (): {
  nome: string;
  classeRisco: ClienteComercialClasseRisco;
  numeroOnu: string;
  grupoEmbalagem: ClienteComercialGrupoEmbalagem;
  fispq: string;
  clienteId: string;
} => ({
  nome: '',
  classeRisco: 'nao_classificado',
  numeroOnu: '',
  grupoEmbalagem: 'nao_aplicavel',
  fispq: '',
  clienteId: '',
});

const ComercialCadastroProdutos: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Comercial', 'gerenciar-produtos');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterClienteId, setFilterClienteId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const produtosQuery = useProdutosComercial({
    page,
    pageSize,
    search: search.trim() || undefined,
    clienteId: filterClienteId || undefined,
  });
  const clientesQuery = useClientesComercial({ page: 1, pageSize: 100 });
  const sugestoesQuery = useClienteProdutosSugestoesComercial(isModalOpen);
  const createProduto = useCreateProdutoComercial();
  const updateProduto = useUpdateProdutoComercial();
  const deleteProduto = useDeleteProdutoComercial();
  const { canShowEmpty } = useAsyncQueryState(produtosQuery);

  const produtos = produtosQuery.data?.results ?? [];
  const totalCount = produtosQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const clientes = clientesQuery.data?.results ?? [];
  const sugestoes = sugestoesQuery.data;
  const isPending = createProduto.isPending || updateProduto.isPending;

  const classeOptions = sugestoes?.classesRisco?.length ? sugestoes.classesRisco : CLIENTE_COMERCIAL_CLASSE_RISCO_OPTIONS;
  const grupoOptions = sugestoes?.gruposEmbalagem?.length ? sugestoes.gruposEmbalagem : CLIENTE_COMERCIAL_GRUPO_EMBALAGEM_OPTIONS;

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const startEdit = (produto: ProdutoComercial) => {
    setEditingId(produto.id);
    setForm({
      nome: produto.nome,
      classeRisco: produto.classeRisco,
      numeroOnu: produto.numeroOnu,
      grupoEmbalagem: produto.grupoEmbalagem,
      fispq: produto.fispq,
      clienteId: produto.clientes[0]?.id || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      alert('Informe o nome do produto.');
      return;
    }
    if (!form.clienteId) {
      alert('Selecione o cliente do produto.');
      return;
    }
    const payload = {
      nome: form.nome.trim(),
      classeRisco: form.classeRisco,
      numeroOnu: form.numeroOnu,
      grupoEmbalagem: form.grupoEmbalagem,
      fispq: form.fispq,
      clienteIds: form.clienteId ? [form.clienteId] : [],
    };
    const callbacks = {
      onSuccess: () => closeModal(),
      onError: (err: unknown) => alert(getComercialErrorMessage(err)),
    };
    editingId
      ? updateProduto.mutate({ id: editingId, payload }, callbacks)
      : createProduto.mutate(payload, callbacks);
  };

  const handleDelete = (produto: ProdutoComercial) => {
    if (!window.confirm(`Excluir o produto "${produto.nome}"? O cliente vinculado volta para validação.`)) return;
    deleteProduto.mutate(produto.id, {
      onError: (err: unknown) => alert(getComercialErrorMessage(err)),
    });
  };

  const clienteSelecionado = clientes.find((item) => item.id === form.clienteId);
  const clienteDoProduto = (produto: ProdutoComercial) =>
    produto.clientes[0]?.nomeFantasia || produto.clientes[0]?.razaoSocial || '—';

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Produtos</h1>
        </div>
        {canManage && (
          <button type="button" className="reports-action-btn primary" onClick={startCreate}>
            Novo produto
          </button>
        )}
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '240px', flex: 1 }}>
            <input
              type="text"
              placeholder="Nome, ONU ou classe..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '220px' }}>
            <select
              value={filterClienteId}
              onChange={(e) => { setFilterClienteId(e.target.value); setPage(1); }}
              aria-label="Filtrar por cliente"
            >
              <option value="">Cliente: Todos</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nomeFantasia || cliente.razaoSocial}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalCount}</strong> Produto{totalCount === 1 ? '' : 's'}</span>
        </div>
      </div>

      <QueryDataPanel
        query={produtosQuery}
        loadingMessage="Carregando produtos..."
        refreshingMessage="Atualizando produtos..."
        errorMessage="Não foi possível carregar os produtos. Tente novamente."
      >
        <div className="erp-card reports-table-card comercial-browse-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table comercial-browse-table comercial-produtos-table">
              <colgroup>
                <col className="col-nome" />
                <col className="col-classe" />
                <col className="col-onu" />
                <col className="col-grupo" />
                <col className="col-fispq" />
                <col className="col-clientes" />
                <col className="col-acoes" />
              </colgroup>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Classe</th>
                  <th>ONU</th>
                  <th>Grupo</th>
                  <th>FISPQ</th>
                  <th>Cliente</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && produtos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="comercial-browse-empty">
                      Não há registros a serem exibidos.
                    </td>
                  </tr>
                ) : produtos.map((produto) => (
                  <tr key={produto.id}>
                    <td className="col-nome"><strong>{produto.nome}</strong></td>
                    <td>{classeOptions.find((item) => item.value === produto.classeRisco)?.label || produto.classeRisco}</td>
                    <td>{produto.numeroOnu || '—'}</td>
                    <td>{grupoOptions.find((item) => item.value === produto.grupoEmbalagem)?.label || produto.grupoEmbalagem}</td>
                    <td>
                      {produto.fispq ? (
                        <a
                          href={/^https?:\/\//i.test(produto.fispq) ? produto.fispq : `https://${produto.fispq}`}
                          target="_blank"
                          rel="noreferrer"
                          className="comercial-fispq-link"
                          title="Abrir FISPQ/FDS"
                          aria-label="Abrir FISPQ/FDS"
                        >
                          <i className="bi bi-link-45deg" aria-hidden="true" />
                        </a>
                      ) : '—'}
                    </td>
                    <td>{clienteDoProduto(produto)}</td>
                    <td className="col-acoes">
                      <div className="comercial-produtos-acoes">
                        <button type="button" className="btn-icon" title="Editar produto" onClick={() => startEdit(produto)}>
                          <i className="bi bi-pencil" />
                        </button>
                        {canManage && (
                          <button type="button" className="btn-icon" title="Excluir produto" onClick={() => handleDelete(produto)}>
                            <i className="bi bi-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="erp-pagination-bar">
            <div className="erp-pagination-page-size">
              <label htmlFor="comercial-produtos-page-size">Itens por página</label>
              <select
                id="comercial-produtos-page-size"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
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
        </div>
      </QueryDataPanel>

      {isModalOpen && (
        <div className="search-backdrop" style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-card cliente-cadastro-modal" style={{ width: 'min(720px, 96vw)', maxHeight: '90vh' }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>{editingId ? 'Editar produto' : 'Novo produto'}</h2>
              <button type="button" className="btn-icon" onClick={closeModal} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
            </div>
            <form className="modal-body" onSubmit={handleSubmit}>
              <label>
                Produto
                <input className="form-input" value={form.nome} disabled={!canManage} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </label>
              <div className="form-grid two-cols" style={{ marginTop: '12px' }}>
                <label>
                  Classe de risco
                  <select
                    className="form-input"
                    value={form.classeRisco}
                    disabled={!canManage}
                    onChange={(e) => {
                      const classeRisco = parseClienteComercialClasseRisco(e.target.value);
                      setForm({
                        ...form,
                        classeRisco,
                        grupoEmbalagem: classeRisco === 'nao_classificado' ? 'nao_aplicavel' : form.grupoEmbalagem,
                      });
                    }}
                  >
                    {classeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  Nº ONU
                  <input
                    className="form-input"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    value={form.numeroOnu}
                    disabled={!canManage}
                    onChange={(e) => {
                      const numeroOnu = e.target.value.replace(/\D/g, '').slice(0, 4);
                      const onuPadrao = sugestoes?.onuComuns.find((item) => item.numeroOnu === numeroOnu);
                      setForm({
                        ...form,
                        numeroOnu,
                        ...(onuPadrao && (form.classeRisco === 'nao_classificado' || form.classeRisco === onuPadrao.classeRisco)
                          ? { classeRisco: parseClienteComercialClasseRisco(onuPadrao.classeRisco) }
                          : {}),
                      });
                    }}
                  />
                </label>
                <label>
                  Grupo de embalagem
                  <select
                    className="form-input"
                    value={form.grupoEmbalagem}
                    disabled={!canManage || form.classeRisco === 'nao_classificado'}
                    onChange={(e) => setForm({ ...form, grupoEmbalagem: parseClienteComercialGrupoEmbalagem(e.target.value) })}
                  >
                    {grupoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  Link da FISPQ/FDS
                  <input
                    className="form-input"
                    type="text"
                    placeholder="https:// (opcional)"
                    value={form.fispq}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, fispq: e.target.value })}
                  />
                </label>
              </div>

              <div className="admin-form-section" style={{ marginTop: '18px' }}>
                <h5 className="admin-form-section-title">Cliente</h5>
                <p className="muted" style={{ margin: '0 0 10px', fontSize: '13px' }}>
                  Cada produto pertence a um cliente. Ao vincular, a homologação fica pendente de validação.
                </p>
                <label>
                  Cliente
                  <select
                    className="form-input"
                    value={form.clienteId}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, clienteId: e.target.value })}
                  >
                    <option value="">Selecione o cliente</option>
                    {form.clienteId && !clientes.some((item) => item.id === form.clienteId) ? (
                      <option value={form.clienteId}>
                        {produtos.find((item) => item.id === editingId)?.clientes[0]?.razaoSocial || 'Cliente atual'}
                      </option>
                    ) : null}
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nomeFantasia || cliente.razaoSocial}
                        {cliente.cnpj ? ` · ${cliente.cnpj}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {clienteSelecionado ? (
                  <div style={{ marginTop: '10px' }}>
                    <ComercialHomologacaoBadge status={clienteSelecionado.compatibilidade} />
                  </div>
                ) : null}
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="reports-action-btn secondary" onClick={closeModal}>Cancelar</button>
                {canManage && (
                  <button type="submit" className="reports-action-btn primary" disabled={isPending}>
                    {isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar produto'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComercialCadastroProdutos;
