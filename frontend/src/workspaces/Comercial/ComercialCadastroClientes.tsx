import React, { useEffect, useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { EmailSuggestInput } from '../../components/EmailTagsInput';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { useGoogleContacts } from '../../hooks/useGoogleContacts';
import {
  getComercialErrorMessage,
  useClientesComercial,
  useConsultarCnpjComercial,
  useCreateClienteComercial,
  useDeleteClienteComercial,
  useUpdateClienteComercial,
} from '../../hooks/useComercialClientes';
import type {
  ClienteComercial,
  ClienteComercialCompatibilidade,
  ClienteComercialPayload,
  ClienteComercialSituacao,
} from '../../types/domain';
import { CLIENTE_COMERCIAL_COMPATIBILIDADE_LABEL, parseClienteComercialCompatibilidade } from '../../types/domain';
import ComercialClienteHistoricoModal from './ComercialClienteHistoricoModal';
import ComercialClienteSituacaoBadge from './ComercialClienteSituacaoBadge';
import ComercialHomologacaoBadge from './ComercialHomologacaoBadge';

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatNomeCadastro = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .toLocaleUpperCase('pt-BR');

const formatMunicipioCadastro = (value: string) =>
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
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  municipio: string;
  uf: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  telefone: string;
  email: string;
  inscricaoEstadual: string;
  observacoes: string;
  situacao: ClienteComercialSituacao;
  compatibilidade: ClienteComercialCompatibilidade;
  previsaoVolumes: string;
  tiposEmbalagens: string;
  quantidadeVolumes: string;
  posicoesPallets: string;
  responsavel: string;
};

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const emptyForm: ClienteForm = {
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  municipio: '',
  uf: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cep: '',
  telefone: '',
  email: '',
  inscricaoEstadual: '',
  observacoes: '',
  situacao: 'potencial',
  compatibilidade: 'nao_analisado',
  previsaoVolumes: '',
  tiposEmbalagens: '',
  quantidadeVolumes: '',
  posicoesPallets: '',
  responsavel: '',
};

const ComercialCadastroClientes: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Comercial', 'gerenciar-clientes');
  const googleEmail = (user?.googleEmail || '').trim();
  const { data: contactsData } = useGoogleContacts(Boolean(googleEmail));
  const contacts = contactsData?.contacts ?? [];
  const [search, setSearch] = useState('');
  const [filterSituacao, setFilterSituacao] = useState<'todos' | ClienteComercialSituacao>('todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historicoCliente, setHistoricoCliente] = useState<ClienteComercial | null>(null);
  const [form, setForm] = useState<ClienteForm>(emptyForm);
  const [enderecoOpen, setEnderecoOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

  const clientesQuery = useClientesComercial({
    page,
    pageSize,
    search: search.trim() || undefined,
    situacao: filterSituacao === 'todos' ? undefined : filterSituacao,
  });
  const { canShowEmpty } = useAsyncQueryState(clientesQuery);
  const createCliente = useCreateClienteComercial();
  const updateCliente = useUpdateClienteComercial();
  const deleteCliente = useDeleteClienteComercial();
  const consultarCnpj = useConsultarCnpjComercial();

  const clientes = clientesQuery.data?.results ?? [];
  const totalCount = clientesQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const editingCliente = useMemo(
    () => clientes.find((c) => c.id === editingId) ?? null,
    [clientes, editingId],
  );
  const selectedClientes = useMemo(
    () => clientes.filter((item) => selectedIds.includes(item.id)),
    [clientes, selectedIds],
  );
  const isAllSelected = clientes.length > 0 && clientes.every((item) => selectedIds.includes(item.id));

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.reports-dropdown-wrapper')) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEnderecoOpen(false);
    setIsModalOpen(true);
  };

  const startEdit = (cliente: ClienteComercial) => {
    setEditingId(cliente.id);
    setForm({
      cnpj: cliente.cnpj ?? '',
      razaoSocial: formatNomeCadastro(cliente.razaoSocial),
      nomeFantasia: formatNomeCadastro(cliente.nomeFantasia),
      municipio: formatMunicipioCadastro(cliente.municipio),
      uf: (cliente.uf || '').toUpperCase(),
      logradouro: cliente.logradouro || '',
      numero: cliente.numero || '',
      complemento: cliente.complemento || '',
      bairro: cliente.bairro || '',
      cep: formatCep(cliente.cep || ''),
      telefone: cliente.telefone || '',
      email: cliente.email || '',
      inscricaoEstadual: cliente.inscricaoEstadual || '',
      observacoes: cliente.observacoes || '',
      situacao: cliente.situacao === 'cliente' ? 'cliente' : 'potencial',
      compatibilidade: parseClienteComercialCompatibilidade(cliente.compatibilidade),
      previsaoVolumes: cliente.previsaoVolumes || '',
      tiposEmbalagens: cliente.tiposEmbalagens || '',
      quantidadeVolumes: cliente.quantidadeVolumes || '',
      posicoesPallets: cliente.posicoesPallets || '',
      responsavel: cliente.responsavel || '',
    });
    setEnderecoOpen(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setEnderecoOpen(false);
  };

  const handleConsultarCnpj = () => {
    const digits = form.cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      alert('Informe um CNPJ com 14 dígitos para consultar.');
      return;
    }
    consultarCnpj.mutate(digits, {
      onSuccess: (data) => {
        setForm((prev) => ({
          ...prev,
          cnpj: data.cnpj || prev.cnpj,
          razaoSocial: formatNomeCadastro(data.razaoSocial || prev.razaoSocial),
          nomeFantasia: formatNomeCadastro(data.nomeFantasia || prev.nomeFantasia),
          municipio: data.municipio ? formatMunicipioCadastro(data.municipio) : prev.municipio,
          uf: data.uf ? data.uf.toUpperCase() : prev.uf,
          logradouro: data.logradouro || prev.logradouro,
          numero: data.numero || prev.numero,
          complemento: data.complemento || prev.complemento,
          bairro: data.bairro || prev.bairro,
          cep: data.cep ? formatCep(data.cep) : prev.cep,
          telefone: data.telefone || prev.telefone,
          email: data.email || prev.email,
        }));
      },
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjDigits = form.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14 || !form.razaoSocial.trim()) {
      if (cnpjDigits.length !== 14) {
        alert('Informe um CNPJ com 14 dígitos.');
        return;
      }
      alert('Informe a razão social.');
      return;
    }
    const payload: ClienteComercialPayload = {
      tipoPessoa: 'J',
      cnpj: form.cnpj.trim(),
      razaoSocial: formatNomeCadastro(form.razaoSocial),
      nomeFantasia: formatNomeCadastro(form.nomeFantasia),
      municipio: formatMunicipioCadastro(form.municipio),
      uf: form.uf.trim().toUpperCase(),
      logradouro: form.logradouro.trim(),
      numero: form.numero.trim(),
      complemento: form.complemento.trim(),
      bairro: form.bairro.trim(),
      cep: formatCep(form.cep),
      telefone: form.telefone.trim(),
      email: form.email.trim(),
      inscricaoEstadual: form.inscricaoEstadual.trim().toUpperCase(),
      observacoes: form.observacoes.trim(),
      situacao: form.situacao,
      compatibilidade: editingId ? form.compatibilidade : 'nao_analisado',
      previsaoVolumes: form.previsaoVolumes.trim(),
      tiposEmbalagens: form.tiposEmbalagens.trim(),
      quantidadeVolumes: form.quantidadeVolumes.trim(),
      posicoesPallets: form.posicoesPallets.trim(),
      responsavel: form.responsavel.trim(),
    };
    const callbacks = {
      onSuccess: () => closeModal(),
      onError: (err: unknown) => alert(getComercialErrorMessage(err)),
    };
    editingId
      ? updateCliente.mutate({ id: editingId, payload }, callbacks)
      : createCliente.mutate(payload, callbacks);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? clientes.map((item) => item.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
  };

  const handleHistoricoSelected = () => {
    const cliente = selectedClientes[0];
    if (!cliente) return;
    setIsActionsMenuOpen(false);
    setHistoricoCliente(cliente);
  };

  const handleEditSelected = () => {
    const cliente = selectedClientes[0];
    if (!cliente) return;
    setIsActionsMenuOpen(false);
    startEdit(cliente);
  };

  const handleDeleteSelected = async () => {
    if (!canManage || selectedClientes.length === 0) return;
    setIsActionsMenuOpen(false);
    const label = selectedClientes.length === 1
      ? `Excluir "${selectedClientes[0].razaoSocial}"?`
      : `Excluir ${selectedClientes.length} clientes?`;
    if (!window.confirm(label)) return;
    try {
      await Promise.all(selectedClientes.map((item) => deleteCliente.mutateAsync(item.id)));
      if (editingId && selectedIds.includes(editingId)) closeModal();
      setSelectedIds([]);
    } catch (err) {
      alert(getComercialErrorMessage(err));
    }
  };

  const isPending = createCliente.isPending || updateCliente.isPending;

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Cadastro de cliente</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="reports-dropdown-wrapper">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={selectedIds.length === 0}
              onClick={() => setIsActionsMenuOpen((open) => !open)}
            >
              <span>Ações{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu ${isActionsMenuOpen ? 'show' : ''}`}>
              {selectedClientes.length === 1 && (
                <>
                  <span className="reports-dropdown-item" onClick={handleHistoricoSelected}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-clock-history" />
                      Histórico
                    </span>
                  </span>
                  <span className="reports-dropdown-item" onClick={handleEditSelected}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-pencil" />
                      Editar
                    </span>
                  </span>
                </>
              )}
              {canManage && selectedClientes.length > 0 && (
                <span className="reports-dropdown-item is-danger" onClick={() => { void handleDeleteSelected(); }}>
                  <span className="reports-dropdown-item-left">
                    <i className="bi bi-trash" />
                    Excluir
                  </span>
                </span>
              )}
            </div>
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
        </div>
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              id="comercial-clientes-busca"
              name="comercial-clientes-busca"
              type="search"
              placeholder="Nome, CNPJ ou município..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '140px' }}>
            <select
              id="comercial-clientes-situacao"
              name="comercial-clientes-situacao"
              value={filterSituacao}
              onChange={(e) => {
                setFilterSituacao(e.target.value as 'todos' | ClienteComercialSituacao);
                setPage(1);
              }}
            >
              <option value="todos">Situação: Todas</option>
              <option value="potencial">Potencial cliente</option>
              <option value="cliente">Cliente</option>
            </select>
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalCount}</strong> Clientes</span>
        </div>
      </div>

      <QueryDataPanel
        query={clientesQuery}
        loadingMessage="Carregando clientes..."
        refreshingMessage="Atualizando clientes..."
        errorMessage="Não foi possível carregar os clientes. Tente novamente."
      >
        <div className="erp-card reports-table-card comercial-browse-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table comercial-browse-table comercial-clientes-table">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      style={{ borderRadius: '4px' }}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="col-nome">Nome</th>
                  <th>CNPJ</th>
                  <th>Responsável cliente</th>
                  <th>Telefone</th>
                  <th>Situação</th>
                  <th>Homologação</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && clientes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="comercial-browse-empty">
                      Não há registros a serem exibidos.
                    </td>
                  </tr>
                ) : (
                  clientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(cliente.id)}
                          onChange={(e) => handleSelectRow(cliente.id, e.target.checked)}
                          style={{ borderRadius: '4px' }}
                          aria-label={`Selecionar ${cliente.razaoSocial}`}
                        />
                      </td>
                      <td className="col-nome">
                        <strong>{cliente.razaoSocial || '—'}</strong>
                      </td>
                      <td>{cliente.cnpj || '—'}</td>
                      <td>{cliente.responsavel || '—'}</td>
                      <td>{cliente.telefone || '—'}</td>
                      <td>
                        <ComercialClienteSituacaoBadge situacao={cliente.situacao} />
                      </td>
                      <td>
                        <ComercialHomologacaoBadge status={cliente.compatibilidade} />
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
            <label htmlFor="comercial-clientes-page-size">Itens por página</label>
            <select
              id="comercial-clientes-page-size"
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
      </QueryDataPanel>

      {isModalOpen && (
        <div
          className="search-backdrop"
          style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="modal-card cliente-cadastro-modal" style={{ width: 'min(1040px, 96vw)', maxHeight: '90vh' }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>{editingId ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button type="button" className="btn-icon" onClick={closeModal} aria-label="Fechar">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-grid two-cols">
                <label>
                  CNPJ
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      required
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
                      style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '28px', height: '28px' }}
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

              <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                <label>
                  Razão social
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={form.razaoSocial}
                    onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                    onBlur={() => setForm((prev) => ({ ...prev, razaoSocial: formatNomeCadastro(prev.razaoSocial) }))}
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
              </div>

              <div className={`cliente-cadastro-fold${enderecoOpen ? ' is-open' : ''}`} style={{ marginTop: '14px' }}>
                <button
                  type="button"
                  className="cliente-cadastro-fold-trigger"
                  aria-expanded={enderecoOpen}
                  onClick={() => setEnderecoOpen((open) => !open)}
                >
                  <i className={`bi ${enderecoOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden />
                  <span className="cliente-cadastro-fold-title">Endereço</span>
                </button>
                {enderecoOpen ? (
                  <div className="cliente-cadastro-fold-body">
                    <div className="form-grid three-cols">
                      <label style={{ gridColumn: 'span 2' }}>
                        Logradouro
                        <input type="text" className="form-input" value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} disabled={!canManage} />
                      </label>
                      <label>
                        Número
                        <input type="text" className="form-input" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} disabled={!canManage} />
                      </label>
                    </div>

                    <div className="form-grid three-cols" style={{ marginTop: '14px' }}>
                      <label>
                        Complemento
                        <input type="text" className="form-input" value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} disabled={!canManage} />
                      </label>
                      <label>
                        Bairro
                        <input type="text" className="form-input" value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} disabled={!canManage} />
                      </label>
                      <label>
                        CEP
                        <input type="text" className="form-input" placeholder="00000-000" value={form.cep} onChange={(e) => setForm({ ...form, cep: formatCep(e.target.value) })} disabled={!canManage} />
                      </label>
                    </div>

                    <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                      <label>
                        Município
                        <input
                          type="text"
                          className="form-input"
                          value={form.municipio}
                          onChange={(e) => setForm({ ...form, municipio: e.target.value })}
                          onBlur={() => setForm((prev) => ({ ...prev, municipio: formatMunicipioCadastro(prev.municipio) }))}
                          disabled={!canManage}
                        />
                      </label>
                      <label>
                        UF
                        <input
                          type="text"
                          className="form-input"
                          maxLength={2}
                          value={form.uf}
                          onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })}
                          disabled={!canManage}
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="admin-form-section" style={{ marginTop: '18px' }}>
                <h4 className="admin-form-section-title">Contatos</h4>
                <div className="form-grid three-cols">
                  <label>
                    Responsável
                    <input
                      type="text"
                      className="form-input"
                      maxLength={150}
                      value={form.responsavel}
                      onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                      disabled={!canManage}
                      placeholder="Nome de quem atende no cliente"
                    />
                  </label>
                  <label>
                    Telefone
                    <input type="text" className="form-input" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} disabled={!canManage} />
                  </label>
                  <div>
                    <label htmlFor="cliente-comercial-email">E-mail</label>
                    <EmailSuggestInput
                      id="cliente-comercial-email"
                      value={form.email}
                      contacts={contacts}
                      disabled={!canManage}
                      onChange={(email, contact) => {
                        setForm((prev) => ({
                          ...prev,
                          email,
                          ...(contact?.name ? { responsavel: contact.name } : {}),
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-grid three-cols" style={{ marginTop: '14px' }}>
                <label>
                  Observações
                  <input type="text" className="form-input" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} disabled={!canManage} />
                </label>
                <label>
                  Situação
                  <select
                    className="form-input"
                    value={form.situacao}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, situacao: e.target.value === 'cliente' ? 'cliente' : 'potencial' })}
                  >
                    <option value="potencial">Potencial cliente</option>
                    <option value="cliente">Cliente</option>
                  </select>
                </label>
                <label>
                  Homologação de produtos
                  <select
                    className="form-input"
                    value={
                      form.compatibilidade === 'homologado' || form.compatibilidade === 'reprovado'
                        ? form.compatibilidade
                        : 'pendente_validacao'
                    }
                    disabled
                  >
                    <option value="pendente_validacao">{CLIENTE_COMERCIAL_COMPATIBILIDADE_LABEL.pendente_validacao}</option>
                    <option value="homologado">{CLIENTE_COMERCIAL_COMPATIBILIDADE_LABEL.homologado}</option>
                    <option value="reprovado">{CLIENTE_COMERCIAL_COMPATIBILIDADE_LABEL.reprovado}</option>
                  </select>
                </label>
              </div>

              {editingId && (
                <div className="form-grid two-cols" style={{ marginTop: '18px' }}>
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
      {historicoCliente ? (
        <ComercialClienteHistoricoModal
          cliente={historicoCliente}
          onClose={() => setHistoricoCliente(null)}
        />
      ) : null}
    </div>
  );
};

export default ComercialCadastroClientes;
