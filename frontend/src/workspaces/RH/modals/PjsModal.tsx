import React, { useState } from 'react';
import { usePjsRH, useCreatePjRH, useUpdatePjRH, useDeletePjRH } from '../../../hooks/useRH';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import QueryDataPanel from '../../../components/QueryDataPanel';

const EMPTY_FORM = {
  nome: '',
  cpf: '',
  salario: '',
  filial: '',
  cargo: '',
  dataAdmissao: '',
  dataNascimento: '',
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface PjsModalProps {
  onClose: () => void;
}

const PjsModal: React.FC<PjsModalProps> = ({ onClose }) => {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const pjsQuery = usePjsRH({ search: search.trim() || undefined });
  const { canShowEmpty } = useAsyncQueryState(pjsQuery);
  const createPj = useCreatePjRH();
  const updatePj = useUpdatePjRH();
  const deletePj = useDeletePjRH();

  const pjs = pjsQuery.data ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPj.mutate(
      {
        nome: form.nome,
        cpf: form.cpf,
        salario: Number(form.salario || 0),
        filial: form.filial,
        cargo: form.cargo,
        dataAdmissao: form.dataAdmissao || undefined,
        dataNascimento: form.dataNascimento || undefined,
        ativo: true,
      },
      { onSuccess: () => { setForm(EMPTY_FORM); setShowForm(false); } },
    );
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '680px', maxWidth: '92vw', maxHeight: '84vh', display: 'flex', flexDirection: 'column' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Cadastro de PJs</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <div style={{ padding: '16px 24px 0 24px', display: 'flex', gap: '10px' }}>
          <div className="reports-search-wrapper" style={{ flex: 1 }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input type="text" placeholder="Buscar por nome, CPF ou cargo..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" className="reports-action-btn primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : '+ Novo PJ'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ padding: '16px 24px 0 24px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div className="login-group" style={{ flex: 2, marginBottom: 0 }}>
                <label>Nome</label>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>CPF</label>
                <input required value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Cargo</label>
                <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Filial</label>
                <input value={form.filial} onChange={(e) => setForm({ ...form, filial: e.target.value })} />
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Salário (R$)</label>
                <input type="number" step="0.01" min="0" required value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Data Admissão</label>
                <input type="date" value={form.dataAdmissao} onChange={(e) => setForm({ ...form, dataAdmissao: e.target.value })} />
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Data Nascimento</label>
                <input type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button type="submit" className="reports-action-btn primary" disabled={createPj.isPending}>
                {createPj.isPending ? 'Salvando...' : 'Salvar PJ'}
              </button>
            </div>
          </form>
        )}

        <div style={{ padding: '16px 24px 24px 24px', overflowY: 'auto', flex: 1 }}>
        <QueryDataPanel
          query={pjsQuery}
          variant="compact"
          className="table-container"
          loadingMessage="Carregando PJs..."
          refreshingMessage="Atualizando PJs..."
          errorMessage="Não foi possível carregar os PJs. Tente novamente."
        >
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Cargo</th>
                  <th>Filial</th>
                  <th className="num">Salário</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && pjs.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontStyle: 'italic' }}>Nenhum PJ cadastrado.</td></tr>
                ) : (
                  pjs.map((pj) => (
                    <tr key={pj.id}>
                      <td><strong>{pj.nome}</strong></td>
                      <td>{pj.cpf}</td>
                      <td>{pj.cargo || '—'}</td>
                      <td>{pj.filial || '—'}</td>
                      <td className="num">{formatCurrency(pj.salario)}</td>
                      <td>
                        <span className={`status-badge ${pj.ativo ? 'success' : 'inativo'}`}>{pj.ativo ? 'Ativo' : 'Inativo'}</span>
                      </td>
                      <td style={{ textAlign: 'right', display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="reports-action-btn-icon"
                          title={pj.ativo ? 'Desativar' : 'Ativar'}
                          onClick={() => updatePj.mutate({ id: pj.id, pj: { ativo: !pj.ativo } })}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            {pj.ativo ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="reports-action-btn-icon"
                          title="Excluir"
                          onClick={() => { if (window.confirm(`Remover o PJ "${pj.nome}"?`)) deletePj.mutate(pj.id); }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </QueryDataPanel>
        </div>
      </div>
    </div>
  );
};

export default PjsModal;
