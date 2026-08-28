import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getFaturamentoErrorMessage,
  useConsultarCnpj,
  useCreateProtocoloCliente,
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

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

const formatDocumento = (value: string, tipo: 'F' | 'J') =>
  tipo === 'F' ? formatCPF(value) : formatCNPJ(value);

const lojaControlaFlags = (loja: string) => {
  const texto = loja.trim();
  if (/^\d+$/.test(texto)) return Number(texto) === 1;
  return texto === '01';
};

type ClienteForm = {
  codigo: string;
  loja: string;
  tipoPessoa: 'F' | 'J';
  razaoSocial: string;
  nomeFantasia: string;
  nomeInterno: string;
  nomeInternoTouched: boolean;
  municipio: string;
  cnpj: string;
  emitirProtocoloCanhotos: boolean;
  considerarPesquisaSatisfacao: boolean;
  requerExpedicao: boolean;
  exigeFilial: boolean;
};

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const emptyForm: ClienteForm = {
  codigo: '',
  loja: '01',
  tipoPessoa: 'J',
  razaoSocial: '',
  nomeFantasia: '',
  nomeInterno: '',
  nomeInternoTouched: false,
  municipio: '',
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
  const consultarCnpj = useConsultarCnpj();

  const [search, setSearch] = useState('');
  const [filterCodigo, setFilterCodigo] = useState('');
  const [filterLoja, setFilterLoja] = useState('');
  const [filterMunicipio, setFilterMunicipio] = useState('');
  const [filterPadrao, setFilterPadrao] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClienteForm>(emptyForm);

  const clientes = clientesQuery.data ?? [];
  const opcoesCodigo = useMemo(
    () => [...new Set(clientes.map((c) => c.codigo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [clientes],
  );
  const opcoesLoja = useMemo(
    () => [...new Set(clientes.map((c) => c.loja).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [clientes],
  );
  const opcoesMunicipio = useMemo(
    () => [...new Set(clientes.map((c) => c.municipio).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [clientes],
  );
  const filteredClientes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clientes.filter((cliente) => {
      if (filterCodigo && cliente.codigo !== filterCodigo) return false;
      if (filterLoja && cliente.loja !== filterLoja) return false;
      if (filterMunicipio && cliente.municipio !== filterMunicipio) return false;
      if (filterPadrao === 'sim' && !cliente.padraoProtocolo) return false;
      if (filterPadrao === 'nao' && cliente.padraoProtocolo) return false;
      if (!term) return true;
      const haystack = [
        cliente.codigo,
        cliente.loja,
        cliente.nomeInterno,
        cliente.nome,
        cliente.razaoSocial,
        cliente.nomeFantasia,
        cliente.municipio,
        cliente.cnpj ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [clientes, search, filterCodigo, filterLoja, filterMunicipio, filterPadrao]);

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
  const podeEditarFlags = lojaControlaFlags(form.loja);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const startEdit = (cliente: ClienteProtocolo) => {
    setEditingId(cliente.id);
    setForm({
      codigo: cliente.codigo || '',
      loja: cliente.loja || '01',
      tipoPessoa: cliente.tipoPessoa === 'F' ? 'F' : 'J',
      razaoSocial: formatNomeCadastro(cliente.razaoSocial || cliente.nome),
      nomeFantasia: formatNomeCadastro(cliente.nomeFantasia || ''),
      nomeInterno: formatNomeCadastro(cliente.nomeInterno || cliente.nome),
      nomeInternoTouched: Boolean(cliente.nomeInterno && cliente.nomeInterno !== cliente.razaoSocial),
      municipio: formatMunicipioCadastro(cliente.municipio || ''),
      cnpj: cliente.cnpj ?? '',
      emitirProtocoloCanhotos: cliente.emitirProtocoloCanhotos,
      considerarPesquisaSatisfacao: cliente.considerarPesquisaSatisfacao,
      requerExpedicao: cliente.requerExpedicao,
      exigeFilial: cliente.exigeFilial,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleConsultarCnpj = () => {
    const digits = form.cnpj.replace(/\D/g, '');
    if (form.tipoPessoa !== 'J' || digits.length !== 14) {
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
            municipio: data.municipio ? formatMunicipioCadastro(data.municipio) : prev.municipio,
            nomeInterno: prev.nomeInternoTouched ? prev.nomeInterno : razaoSocial,
          };
        });
      },
      onError: (err) => alert(getFaturamentoErrorMessage(err)),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigo.trim()) {
      alert('Informe o código do cliente.');
      return;
    }
    if (!form.loja.trim()) {
      alert('Informe a loja.');
      return;
    }
    if (!form.razaoSocial.trim() && !form.nomeInterno.trim()) {
      alert('Informe a razão social ou o nome interno.');
      return;
    }
    const payload = {
      codigo: form.codigo.trim(),
      loja: form.loja.trim(),
      tipoPessoa: form.tipoPessoa,
      razaoSocial: formatNomeCadastro(form.razaoSocial),
      nomeFantasia: formatNomeCadastro(form.nomeFantasia),
      nomeInterno: formatNomeCadastro(form.nomeInterno.trim() || form.razaoSocial),
      municipio: formatMunicipioCadastro(form.municipio),
      cnpj: form.cnpj.trim() || null,
      emitirProtocoloCanhotos: Boolean(podeEditarFlags && form.emitirProtocoloCanhotos),
      considerarPesquisaSatisfacao: Boolean(podeEditarFlags && form.considerarPesquisaSatisfacao),
      requerExpedicao: podeEditarFlags && form.emitirProtocoloCanhotos ? form.requerExpedicao : false,
      exigeFilial: podeEditarFlags && form.emitirProtocoloCanhotos ? form.exigeFilial : false,
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

  const isPending = createCliente.isPending || updateCliente.isPending;
  const mostrarConfigProtocolo = form.emitirProtocoloCanhotos;

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
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

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Nome ou CNPJ/CPF..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '140px' }}>
            <select value={filterCodigo} onChange={(e) => { setFilterCodigo(e.target.value); setPage(1); }}>
              <option value="">Código: Todos</option>
              {opcoesCodigo.map((codigo) => (
                <option key={codigo} value={codigo}>{codigo}</option>
              ))}
            </select>
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '120px' }}>
            <select value={filterLoja} onChange={(e) => { setFilterLoja(e.target.value); setPage(1); }}>
              <option value="">Loja: Todas</option>
              {opcoesLoja.map((loja) => (
                <option key={loja} value={loja}>{loja}</option>
              ))}
            </select>
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '160px' }}>
            <select value={filterMunicipio} onChange={(e) => { setFilterMunicipio(e.target.value); setPage(1); }}>
              <option value="">Município: Todos</option>
              {opcoesMunicipio.map((municipio) => (
                <option key={municipio} value={municipio}>{municipio}</option>
              ))}
            </select>
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '140px' }}>
            <select value={filterPadrao} onChange={(e) => { setFilterPadrao(e.target.value); setPage(1); }}>
              <option value="">Padrão: Todos</option>
              <option value="sim">Padrão: Sim</option>
              <option value="nao">Padrão: Não</option>
            </select>
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
                  <th>Loja</th>
                  <th>Nome interno</th>
                  <th>Município</th>
                  <th>CNPJ/CPF</th>
                  <th>Padrão</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && filteredClientes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum cliente cadastrado.
                    </td>
                  </tr>
                ) : (
                  pagedClientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td><strong>{cliente.codigo || '—'}</strong></td>
                      <td>{cliente.loja || '—'}</td>
                      <td>{cliente.nomeInterno || cliente.nome || '—'}</td>
                      <td>{cliente.municipio || '—'}</td>
                      <td>{cliente.cnpj || '—'}</td>
                      <td>{cliente.padraoProtocolo ? 'Sim' : '—'}</td>
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
                  Código do cliente
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    disabled={!canManage}
                    placeholder="Informe o código"
                  />
                </label>
                <label>
                  Loja
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={form.loja}
                    onChange={(e) => {
                      const loja = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        loja,
                        ...(lojaControlaFlags(loja)
                          ? {}
                          : {
                              emitirProtocoloCanhotos: false,
                              considerarPesquisaSatisfacao: false,
                              requerExpedicao: false,
                              exigeFilial: false,
                            }),
                      }));
                    }}
                    disabled={!canManage}
                    placeholder="01"
                  />
                </label>
              </div>

              <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                <label>
                  Pessoa
                  <select
                    className="form-input"
                    value={form.tipoPessoa}
                    disabled={!canManage}
                    onChange={(e) => {
                      const tipoPessoa = e.target.value === 'F' ? 'F' : 'J';
                      setForm((prev) => ({
                        ...prev,
                        tipoPessoa,
                        cnpj: formatDocumento(prev.cnpj, tipoPessoa),
                      }));
                    }}
                  >
                    <option value="J">Pessoa jurídica</option>
                    <option value="F">Pessoa física</option>
                  </select>
                </label>
                <label>
                  {form.tipoPessoa === 'F' ? 'CPF' : 'CNPJ'}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={form.tipoPessoa === 'F' ? '000.000.000-00' : '00.000.000/0000-00'}
                      value={form.cnpj}
                      onChange={(e) => setForm({ ...form, cnpj: formatDocumento(e.target.value, form.tipoPessoa) })}
                      onKeyDown={(e) => { if (e.key === 'Enter' && form.tipoPessoa === 'J') { e.preventDefault(); handleConsultarCnpj(); } }}
                      disabled={!canManage}
                      style={{ paddingRight: form.tipoPessoa === 'J' ? '38px' : undefined }}
                    />
                    {form.tipoPessoa === 'J' && (
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
                    )}
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
                    placeholder="Município deste cadastro"
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

              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              >
                {podeEditarFlags ? (
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
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
                        Só a loja 01 libera a emissão para este código. Se desligada, o cliente some da emissão sem apagar protocolos já feitos.
                        Ligada, o CNPJ/CPF desta loja 01 é o que aparece no PDF.
                      </div>
                    </span>
                  </label>
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Protocolo e pesquisa de satisfação só podem ser ligados na loja 01 deste código.
                  </p>
                )}

                {mostrarConfigProtocolo && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '16px 24px',
                      marginTop: '10px',
                      marginLeft: '24px',
                      paddingTop: '10px',
                      borderTop: '1px solid #e2e8f0',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={form.requerExpedicao}
                        disabled={!canManage}
                        onChange={(e) => setForm({ ...form, requerExpedicao: e.target.checked })}
                      />
                      Requer expedição
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={form.exigeFilial}
                        disabled={!canManage}
                        onChange={(e) => setForm({ ...form, exigeFilial: e.target.checked })}
                      />
                      Exigir filial do cliente no protocolo
                    </label>
                    {form.exigeFilial && (
                      <p style={{ flexBasis: '100%', fontSize: '12px', color: '#64748b', margin: 0 }}>
                        No protocolo, as filiais vêm dos municípios cadastrados nas lojas deste código.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {podeEditarFlags ? (
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
                      Só a loja 01 libera o cliente no lançamento do SGQ. Se desligada, ele some sem apagar pesquisas já feitas.
                    </div>
                  </span>
                </label>
              ) : null}

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
