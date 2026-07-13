import React, { useState } from 'react';
import QueryDataPanel from '../../../components/QueryDataPanel';
import {
  getFaturamentoErrorMessage,
  useCreateFilial,
  useCreateProtocoloCliente,
  useDeleteFilial,
  useDeleteProtocoloCliente,
  useProtocoloClientes,
  useUpdateProtocoloCliente,
} from '../../../hooks/useFaturamentoProtocolos';
import type { ClienteProtocolo } from '../../../types/domain';

interface Props { onClose: () => void; }

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const emptyForm = { nome: '', cnpj: '', requerExpedicao: false, exigeFilial: false };

const GerenciarClientesProtocoloModal: React.FC<Props> = ({ onClose }) => {
  const clientesQuery  = useProtocoloClientes();
  const createCliente  = useCreateProtocoloCliente();
  const updateCliente  = useUpdateProtocoloCliente();
  const deleteCliente  = useDeleteProtocoloCliente();
  const createFilial   = useCreateFilial();
  const deleteFilial   = useDeleteFilial();

  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState(emptyForm);
  const [novaFilial, setNovaFilial]   = useState('');
  // Filiais informadas ao criar um cliente novo (ainda sem id): só existem no
  // banco após o cliente ser salvo, então ficam pendentes aqui até o submit.
  const [novasFiliais, setNovasFiliais] = useState<string[]>([]);

  const editingCliente = (clientesQuery.data ?? []).find((c) => c.id === editingId) ?? null;

  const openNew = () => { setEditingId(null); setForm(emptyForm); setNovasFiliais([]); setNovaFilial(''); setShowForm(true); };

  const startEdit = (cliente: ClienteProtocolo) => {
    setEditingId(cliente.id);
    setForm({ nome: cliente.nome, cnpj: cliente.cnpj ?? '', requerExpedicao: cliente.requerExpedicao, exigeFilial: cliente.exigeFilial });
    setNovasFiliais([]);
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); setNovaFilial(''); setNovasFiliais([]); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) { alert('Informe o nome do cliente.'); return; }
    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj.trim() || null,
      requerExpedicao: form.requerExpedicao,
      exigeFilial: form.exigeFilial,
      ...(!editingId && form.exigeFilial && novasFiliais.length > 0 ? { filiaisIniciais: novasFiliais } : {}),
    };
    const callbacks = {
      onSuccess: () => { if (!editingId) cancelForm(); },
      onError: (err: unknown) => alert(getFaturamentoErrorMessage(err)),
    };
    editingId ? updateCliente.mutate({ id: editingId, payload }, callbacks) : createCliente.mutate(payload, callbacks);
  };

  const handleDelete = (cliente: ClienteProtocolo) => {
    if (!window.confirm(`Excluir "${cliente.nome}"?`)) return;
    deleteCliente.mutate(cliente.id, {
      onSuccess: () => { if (editingId === cliente.id) cancelForm(); },
      onError: (err) => alert(getFaturamentoErrorMessage(err)),
    });
  };

  const handleAddFilial = () => {
    const nome = novaFilial.trim();
    if (!nome) return;

    // Cliente ainda não existe: guarda a filial localmente até o submit.
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

  const handleRemoveNovaFilial = (nome: string) => {
    setNovasFiliais((prev) => prev.filter((f) => f !== nome));
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
  const mostrarSecaoFiliais = form.exigeFilial || filiaisExibidas.length > 0;

  return (
    <div
      className="search-backdrop admin-user-modal-backdrop"
      style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card admin-user-modal-card" style={{ width: 'min(820px, 95vw)' }}>

        {/* ── Header ── */}
        <div className="search-input-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
            Gerenciar clientes de protocolo
          </h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {!showForm && (
              <button
                type="button"
                className="reports-action-btn primary"
                style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', height: '34px', fontSize: '13px' }}
                onClick={openNew}
              >
                <i className="bi bi-plus-lg" style={{ marginRight: '6px' }} />
                Novo cliente
              </button>
            )}
            <span className="search-close-key" style={{ cursor: 'pointer' }} onClick={onClose}>Fechar (X)</span>
          </div>
        </div>

        {/* ── Painel de formulário ── */}
        {showForm && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {editingId ? `Editando: ${editingCliente?.nome ?? ''}` : 'Novo cliente'}
              </span>
              <button type="button" onClick={cancelForm} style={{ background: 'none', border: 'none', fontSize: '12px', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline' }}>
                Fechar painel
              </button>
            </div>

            <form onSubmit={handleSubmit} id="cliente-protocolo-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="login-group" style={{ marginBottom: 0 }}>
                  <label>Nome *</label>
                  <input type="text" placeholder="Nome do cliente" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="login-group" style={{ marginBottom: 0 }}>
                  <label>CNPJ</label>
                  <input type="text" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <CheckOption label="Requer expedição" checked={form.requerExpedicao} onChange={(v) => setForm({ ...form, requerExpedicao: v })} />
                <CheckOption label="Exigir filial do cliente" sublabel="Vincula cada NF a uma filial no protocolo" checked={form.exigeFilial} onChange={(v) => setForm({ ...form, exigeFilial: v })} />
              </div>

              {/* ── Filiais: em edição usa a API; em criação fica pendente até o submit ── */}
              {mostrarSecaoFiliais && (
                <div style={{ marginBottom: '14px', paddingTop: '14px', borderTop: '1px dashed #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                    Filiais cadastradas
                  </div>

                  {!editingId && (
                    <p className="text-muted" style={{ margin: '0 0 10px' }}>
                      <i className="bi bi-info-circle" style={{ marginRight: '4px' }} />
                      As filiais adicionadas aqui serão cadastradas junto com o cliente.
                    </p>
                  )}

                  {filiaisExibidas.length === 0 ? (
                    <p className="text-muted" style={{ fontStyle: 'italic', margin: '0 0 10px' }}>Nenhuma filial cadastrada ainda.</p>
                  ) : (
                    <div className="tag-list" style={{ marginTop: 0, marginBottom: '10px' }}>
                      {filiaisExibidas.map((filial) => (
                        <span key={filial.id} className="tag-chip">
                          <span>{filial.nome}</span>
                          <button
                            type="button"
                            onClick={() => (filial.pendente ? handleRemoveNovaFilial(filial.nome) : handleDeleteFilial(filial.id, filial.nome))}
                            aria-label={`Remover ${filial.nome}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nome da nova filial..."
                      value={novaFilial}
                      onChange={(e) => setNovaFilial(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFilial(); } }}
                      style={{ flex: 1, margin: 0 }}
                    />
                    <button
                      type="button"
                      className="reports-action-btn secondary"
                      style={{ height: '38px', padding: '0 16px', fontSize: '12px', flexShrink: 0 }}
                      onClick={handleAddFilial}
                      disabled={createFilial.isPending || !novaFilial.trim()}
                    >
                      + Adicionar filial
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="reports-action-btn primary" style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }} disabled={isPending}>
                  {isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar cliente'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tabela de clientes ── */}
        <QueryDataPanel query={clientesQuery} loadingMessage="Carregando clientes..." variant="compact">
          <table className="data-table" style={{ fontSize: '13px' }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th style={{ width: 100 }}>Expedição</th>
                <th style={{ width: 130 }}>Filial</th>
                <th style={{ width: 80, textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(clientesQuery.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '32px' }}>Nenhum cliente cadastrado.</td>
                </tr>
              ) : (
                (clientesQuery.data ?? []).map((cliente) => (
                  <tr key={cliente.id} style={{ background: editingId === cliente.id ? 'rgba(17,140,196,0.04)' : undefined }}>
                    <td>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{cliente.nome}</span>
                      {cliente.cnpj && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{cliente.cnpj}</div>}
                    </td>
                    <td>
                      <span className={`status-badge ${cliente.requerExpedicao ? 'success' : 'inativo'}`}>
                        {cliente.requerExpedicao ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td>
                      {cliente.exigeFilial ? (
                        <button
                          type="button"
                          onClick={() => startEdit(cliente)}
                          className="status-badge"
                          style={{ border: 'none', cursor: 'pointer', gap: '5px', textTransform: 'none', background: 'rgba(17,140,196,0.12)', color: '#118CC4' }}
                          title="Clique para gerenciar filiais"
                        >
                          <i className="bi bi-diagram-3" style={{ fontSize: '11px' }} />
                          {cliente.filiais.length} filial(is)
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button type="button" className="btn-icon" onClick={() => startEdit(cliente)} title="Editar"><i className="bi bi-pencil" /></button>
                        <button type="button" className="btn-icon btn-icon-danger" onClick={() => handleDelete(cliente)} title="Excluir"><i className="bi bi-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </QueryDataPanel>
      </div>
    </div>
  );
};

const CheckOption: React.FC<{ label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, sublabel, checked, onChange }) => (
  <label style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 14px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: '15px', height: '15px', accentColor: '#118CC4', marginTop: sublabel ? '2px' : '0' }} />
    <div>
      <div style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>{label}</div>
      {sublabel && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{sublabel}</div>}
    </div>
  </label>
);

export default GerenciarClientesProtocoloModal;
