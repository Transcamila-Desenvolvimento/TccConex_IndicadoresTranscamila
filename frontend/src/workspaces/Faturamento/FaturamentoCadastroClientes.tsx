import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getFaturamentoErrorMessage,
  useConsultarCnpj,
  useCreateFilial,
  useCreateProtocoloCliente,
  useDeleteFilial,
  useDeleteProtocoloCliente,
  useProtocoloClientes,
  useUpdateProtocoloCliente,
} from '../../hooks/useFaturamentoProtocolos';
import type { ClienteProtocolo } from '../../types/domain';

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const formatNomeCadastro = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR'))
    .join(' ');

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

type ClienteForm = {
  razaoSocial: string;
  nomeFantasia: string;
  nomeInterno: string;
  nomeInternoTouched: boolean;
  cnpj: string;
  emitirProtocoloCanhotos: boolean;
  considerarPesquisaSatisfacao: boolean;
  requerExpedicao: boolean;
  exigeFilial: boolean;
};

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const emptyForm: ClienteForm = {
  razaoSocial: '',
  nomeFantasia: '',
  nomeInterno: '',
  nomeInternoTouched: false,
  cnpj: '',
  emitirProtocoloCanhotos: false,
  considerarPesquisaSatisfacao: false,
  requerExpedicao: false,
  exigeFilial: false,
};

const FaturamentoCadastroClientes: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Faturamento', 'gerenciar-clientes');
  const clientesQuery = useProtocoloClientes();
  const { canShowEmpty } = useAsyncQueryState(clientesQuery);
  const createCliente = useCreateProtocoloCliente();
  const updateCliente = useUpdateProtocoloCliente();
  const deleteCliente = useDeleteProtocoloCliente();
  const createFilial = useCreateFilial();
  const deleteFilial = useDeleteFilial();
  const consultarCnpj = useConsultarCnpj();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClienteForm>(emptyForm);
  const [novaFilial, setNovaFilial] = useState('');
  const [novasFiliais, setNovasFiliais] = useState<string[]>([]);

  const clientes = clientesQuery.data ?? [];
  const filteredClientes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter((cliente) => {
      const haystack = [
        cliente.codigo,
        cliente.nomeInterno,
        cliente.nome,
        cliente.razaoSocial,
        cliente.nomeFantasia,
        cliente.cnpj ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [clientes, search]);

  const totalPages = Math.max(1, Math.ceil(filteredClientes.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pagedClientes = filteredClientes.slice(
    (clampedPage - 1) * pageSize,
    clampedPage * pageSize,
  );

  const editingCliente = useMemo(
    () => clientes.find((c) => c.id === editingId) ?? null,
    [clientes, editingId],
  );

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setNovasFiliais([]);
    setNovaFilial('');
    setIsModalOpen(true);
  };

  const startEdit = (cliente: ClienteProtocolo) => {
    setEditingId(cliente.id);
    setForm({
      razaoSocial: formatNomeCadastro(cliente.razaoSocial || cliente.nome),
      nomeFantasia: formatNomeCadastro(cliente.nomeFantasia || ''),
      nomeInterno: formatNomeCadastro(cliente.nomeInterno || cliente.nome),
      nomeInternoTouched: Boolean(cliente.nomeInterno && cliente.nomeInterno !== cliente.razaoSocial),
      cnpj: cliente.cnpj ?? '',
      emitirProtocoloCanhotos: cliente.emitirProtocoloCanhotos,
      considerarPesquisaSatisfacao: cliente.considerarPesquisaSatisfacao,
      requerExpedicao: cliente.requerExpedicao,
      exigeFilial: cliente.exigeFilial,
    });
    setNovasFiliais([]);
    setNovaFilial('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setNovaFilial('');
    setNovasFiliais([]);
  };

  const handleConsultarCnpj = () => {
    const digits = form.cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      alert('Informe um CNPJ com 14 dígitos para consultar.');
      return;
    }
    consultarCnpj.mutate(digits, {
      onSuccess: (data) => {
        setForm((prev) => {
          const razaoSocial = formatNomeCadastro(data.razaoSocial);
          const nomeFantasia = formatNomeCadastro(data.nomeFantasia || prev.nomeFantasia);
          return {
            ...prev,
            cnpj: data.cnpj || prev.cnpj,
            razaoSocial,
            nomeFantasia,
            nomeInterno: prev.nomeInternoTouched ? prev.nomeInterno : razaoSocial,
          };
        });
      },
      onError: (err) => alert(getFaturamentoErrorMessage(err)),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razaoSocial.trim() && !form.nomeInterno.trim()) {
      alert('Informe a razão social ou o nome interno.');
      return;
    }
    const payload = {
      razaoSocial: formatNomeCadastro(form.razaoSocial),
      nomeFantasia: formatNomeCadastro(form.nomeFantasia),
      nomeInterno: formatNomeCadastro(form.nomeInterno.trim() || form.razaoSocial),
      cnpj: form.cnpj.trim() || null,
      emitirProtocoloCanhotos: form.emitirProtocoloCanhotos,
      considerarPesquisaSatisfacao: form.considerarPesquisaSatisfacao,
      requerExpedicao: form.emitirProtocoloCanhotos ? form.requerExpedicao : false,
      exigeFilial: form.emitirProtocoloCanhotos ? form.exigeFilial : false,
      ...(!editingId && form.emitirProtocoloCanhotos && form.exigeFilial && novasFiliais.length > 0
        ? { filiaisIniciais: novasFiliais }
        : {}),
    };
    const callbacks = {
      onSuccess: () => closeModal(),
      onError: (err: unknown) => alert(getFaturamentoErrorMessage(err)),
    };
    editingId
      ? updateCliente.mutate({ id: editingId, payload }, callbacks)
      : createCliente.mutate(payload, callbacks);
  };

  const handleDelete = (cliente: ClienteProtocolo) => {
    if (!window.confirm(`Excluir "${cliente.nomeInterno || cliente.nome}"? Protocolos e pesquisas já lançados não são apagados ao desligar as chaves — a exclusão só é possível se não houver vínculos.`)) {
      return;
    }
    deleteCliente.mutate(cliente.id, {
      onSuccess: () => { if (editingId === cliente.id) closeModal(); },
      onError: (err) => alert(getFaturamentoErrorMessage(err)),
    });
  };

  const handleAddFilial = () => {
    const nome = novaFilial.trim();
    if (!nome) return;
    if (!editingId) {
      if (novasFiliais.some((f) => f.toLowerCase() === nome.toLowerCase())) {
        alert('Esta filial já foi adicionada.');
        return;
      }
      setNovasFiliais((prev) => [...prev, nome]);
      setNovaFilial('');
      return;
    }
    createFilial.mutate({ clienteId: editingId, nome }, {
      onSuccess: () => setNovaFilial(''),
      onError: (err) => alert(getFaturamentoErrorMessage(err)),
    });
  };

  const handleDeleteFilial = (filialId: string, filialNome: string) => {
    if (!editingId || !window.confirm(`Excluir a filial "${filialNome}"?`)) return;
    deleteFilial.mutate({ clienteId: editingId, filialId }, {
      onError: (err) => alert(getFaturamentoErrorMessage(err)),
    });
  };

  const isPending = createCliente.isPending || updateCliente.isPending;
  const filiaisExibidas = editingId
    ? (editingCliente?.filiais ?? []).map((f) => ({ id: f.id, nome: f.nome, pendente: false }))
    : novasFiliais.map((nome) => ({ id: nome, nome, pendente: true }));
  const mostrarConfigProtocolo = form.emitirProtocoloCanhotos;
  const mostrarSecaoFiliais = mostrarConfigProtocolo && (form.exigeFilial || filiaisExibidas.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Cadastro cliente</h1>
        </div>
        {canManage && (
          <button
            type="button"
            className="reports-action-btn primary"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
            onClick={openNew}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Novo cliente</span>
          </button>
        )}
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Código, nome ou CNPJ..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{filteredClientes.length}</strong> Clientes</span>
        </div>
      </div>

      <QueryDataPanel
        query={clientesQuery}
        loadingMessage="Carregando clientes..."
        refreshingMessage="Atualizando clientes..."
        errorMessage="Não foi possível carregar os clientes. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome interno</th>
                  <th>Nome fantasia</th>
                  <th>Razão social</th>
                  <th>CNPJ</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && filteredClientes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum cliente cadastrado.
                    </td>
                  </tr>
                ) : (
                  pagedClientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td><strong>{cliente.codigo || '—'}</strong></td>
                      <td>{cliente.nomeInterno || cliente.nome || '—'}</td>
                      <td>{cliente.nomeFantasia || '—'}</td>
                      <td>{cliente.razaoSocial || '—'}</td>
                      <td>{cliente.cnpj || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="button" className="btn-icon" title="Editar cliente" onClick={() => startEdit(cliente)}>
                            <i className="bi bi-pencil" />
                          </button>
                          {canManage && (
                            <button type="button" className="btn-icon" title="Excluir cliente" onClick={() => handleDelete(cliente)}>
                              <i className="bi bi-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="clientes-page-size">Itens por página</label>
            <select
              id="clientes-page-size"
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
            <span className="erp-pagination-meta">({filteredClientes.length} registros)</span>
          </span>

          <button
            type="button"
            className="reports-action-btn secondary"
            title="Primeira página"
            aria-label="Primeira página"
            disabled={clampedPage <= 1}
            onClick={() => setPage(1)}
            style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage <= 1 ? 0.5 : 1, cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 4.5l-7.5 7.5 7.5 7.5M11.25 4.5l-7.5 7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={clampedPage <= 1}
            onClick={() => setPage(clampedPage - 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage <= 1 ? 0.5 : 1, cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Anterior
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={clampedPage >= totalPages}
            onClick={() => setPage(clampedPage + 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Próximo
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            title="Última página"
            aria-label="Última página"
            disabled={clampedPage >= totalPages}
            onClick={() => setPage(totalPages)}
            style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>

      {isModalOpen && (
        <div
          className="search-backdrop"
          style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="modal-card" style={{ width: 'min(820px, 100%)' }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>{editingId ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button type="button" className="btn-icon" onClick={closeModal} aria-label="Fechar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-grid two-cols">
                <label>
                  Código
                  <input type="text" className="form-input" value={editingCliente?.codigo || 'Automático'} disabled />
                </label>
                <label>
                  CNPJ
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="00.000.000/0000-00"
                      value={form.cnpj}
                      onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConsultarCnpj(); } }}
                      disabled={!canManage}
                      style={{ paddingRight: '38px' }}
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      title={consultarCnpj.isPending ? 'Consultando CNPJ...' : 'Consultar CNPJ'}
                      aria-label="Consultar CNPJ"
                      onClick={handleConsultarCnpj}
                      disabled={!canManage || consultarCnpj.isPending}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '28px',
                        height: '28px',
                      }}
                    >
                      {consultarCnpj.isPending ? (
                        <span className="async-query-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" />
                      ) : (
                        <i className="bi bi-search" />
                      )}
                    </button>
                  </div>
                </label>
              </div>

              <div className="form-grid three-cols" style={{ marginTop: '14px' }}>
                <label>
                  Razão social
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={form.razaoSocial}
                    onChange={(e) => {
                      const razaoSocial = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        razaoSocial,
                        nomeInterno: prev.nomeInternoTouched ? prev.nomeInterno : razaoSocial,
                      }));
                    }}
                    onBlur={() => {
                      setForm((prev) => {
                        const razaoSocial = formatNomeCadastro(prev.razaoSocial);
                        return {
                          ...prev,
                          razaoSocial,
                          nomeInterno: prev.nomeInternoTouched
                            ? formatNomeCadastro(prev.nomeInterno)
                            : razaoSocial,
                        };
                      });
                    }}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  Nome fantasia
                  <input
                    type="text"
                    className="form-input"
                    value={form.nomeFantasia}
                    onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                    onBlur={() => setForm((prev) => ({ ...prev, nomeFantasia: formatNomeCadastro(prev.nomeFantasia) }))}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  Nome interno
                  <input
                    type="text"
                    className="form-input"
                    value={form.nomeInterno}
                    onChange={(e) => setForm({ ...form, nomeInterno: e.target.value, nomeInternoTouched: true })}
                    onBlur={() => setForm((prev) => ({ ...prev, nomeInterno: formatNomeCadastro(prev.nomeInterno) }))}
                    disabled={!canManage}
                  />
                </label>
              </div>

              {editingId && (
                <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                  <label>
                    Data de cadastro
                    <input type="text" className="form-input" value={formatDateTime(editingCliente?.dataCriacao)} disabled />
                  </label>
                  <label>
                    Data de atualização
                    <input type="text" className="form-input" value={formatDateTime(editingCliente?.dataAtualizacao)} disabled />
                  </label>
                </div>
              )}

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginTop: '16px',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.emitirProtocoloCanhotos}
                  disabled={!canManage}
                  onChange={(e) => setForm({ ...form, emitirProtocoloCanhotos: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  <strong>Emitir protocolo de canhotos?</strong>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Se desligada, o cliente some da emissão sem apagar protocolos já feitos.
                  </div>
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginTop: '10px',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.considerarPesquisaSatisfacao}
                  disabled={!canManage}
                  onChange={(e) => setForm({ ...form, considerarPesquisaSatisfacao: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  <strong>Considerar pesquisa de satisfação?</strong>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Se desligada, o cliente some do lançamento no SGQ sem apagar pesquisas já feitas.
                  </div>
                </span>
              </label>

              {mostrarConfigProtocolo && (
                <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.requerExpedicao}
                      disabled={!canManage}
                      onChange={(e) => setForm({ ...form, requerExpedicao: e.target.checked })}
                    />
                    Requer expedição
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.exigeFilial}
                      disabled={!canManage}
                      onChange={(e) => setForm({ ...form, exigeFilial: e.target.checked })}
                    />
                    Exigir filial do cliente
                  </label>
                </div>
              )}

              {mostrarSecaoFiliais && (
                <div style={{ marginTop: '16px' }}>
                  <label>Filiais cadastradas</label>
                  {filiaisExibidas.length === 0 ? (
                    <p className="text-muted" style={{ fontStyle: 'italic', margin: '8px 0 10px' }}>Nenhuma filial cadastrada ainda.</p>
                  ) : (
                    <div className="tag-list" style={{ marginTop: '8px', marginBottom: '10px' }}>
                      {filiaisExibidas.map((filial) => (
                        <span key={filial.id} className="tag-chip">
                          <span>{filial.nome}</span>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => (filial.pendente
                                ? setNovasFiliais((prev) => prev.filter((f) => f !== filial.nome))
                                : handleDeleteFilial(filial.id, filial.nome))}
                              aria-label={`Remover ${filial.nome}`}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {canManage && (
                    <div className="protocolo-nf-row">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nome da nova filial..."
                        value={novaFilial}
                        onChange={(e) => setNovaFilial(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFilial(); } }}
                      />
                      <button
                        type="button"
                        className="reports-action-btn secondary"
                        style={{ height: '38px', flexShrink: 0 }}
                        onClick={handleAddFilial}
                        disabled={createFilial.isPending || !novaFilial.trim()}
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="reports-action-btn secondary" onClick={closeModal}>Cancelar</button>
                {canManage && (
                  <button type="submit" className="reports-action-btn primary" disabled={isPending}>
                    {isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar cliente'}
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

export default FaturamentoCadastroClientes;
