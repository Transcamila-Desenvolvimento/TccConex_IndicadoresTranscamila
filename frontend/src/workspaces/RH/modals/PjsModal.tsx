import React, { useState } from 'react';
import {
  usePjsRH,
  useCreatePjRH,
  useUpdatePjRH,
  useDeletePjRH,
  usePjHistoricoRH,
  useCreatePjHistoricoRH,
  useUpdatePjHistoricoRH,
  useDeletePjHistoricoRH,
  getRHErrorMessage,
} from '../../../hooks/useRH';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import QueryDataPanel from '../../../components/QueryDataPanel';
import type { ColaboradorPJ, ColaboradorPJHistorico } from '../../../types/domain';

type View = 'lista' | 'form' | 'historico';

const EMPTY_FORM = {
  nome: '',
  cpf: '',
  salario: '',
  filial: '',
  cargo: '',
  dataAdmissao: '',
  dataDemissao: '',
  dataNascimento: '',
  ativo: true,
};

const EMPTY_HIST = {
  mes: String(new Date().getMonth() + 1),
  ano: String(new Date().getFullYear()),
  salario: '',
};

const MESES = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateBr = (value?: string) => {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
};

function formFromPj(pj: ColaboradorPJ) {
  return {
    nome: pj.nome,
    cpf: pj.cpf,
    salario: String(pj.salario ?? ''),
    filial: pj.filial || '',
    cargo: pj.cargo || '',
    dataAdmissao: pj.dataAdmissao || '',
    dataDemissao: pj.dataDemissao || '',
    dataNascimento: pj.dataNascimento || '',
    ativo: pj.ativo,
  };
}

interface PjsModalProps {
  onClose: () => void;
}

const PjsModal: React.FC<PjsModalProps> = ({ onClose }) => {
  const [view, setView] = useState<View>('lista');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedPjId, setSelectedPjId] = useState<string | null>(null);
  const [histForm, setHistForm] = useState(EMPTY_HIST);
  const [editingHistId, setEditingHistId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [histError, setHistError] = useState<string | null>(null);

  const pjsQuery = usePjsRH({ search: search.trim() || undefined });
  const { canShowEmpty } = useAsyncQueryState(pjsQuery);
  const createPj = useCreatePjRH();
  const updatePj = useUpdatePjRH();
  const deletePj = useDeletePjRH();

  const historicoQuery = usePjHistoricoRH(view === 'historico' ? selectedPjId : null);
  const createHist = useCreatePjHistoricoRH();
  const updateHist = useUpdatePjHistoricoRH();
  const deleteHist = useDeletePjHistoricoRH();

  const pjs = pjsQuery.data ?? [];
  const historico = historicoQuery.data ?? [];
  const selectedPj = pjs.find((p) => p.id === selectedPjId) ?? null;
  const savingPj = createPj.isPending || updatePj.isPending;
  const savingHist = createHist.isPending || updateHist.isPending;

  const goLista = () => {
    setView('lista');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setHistForm(EMPTY_HIST);
    setEditingHistId(null);
    setHistError(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setView('form');
  };

  const openEdit = (pj: ColaboradorPJ) => {
    setEditingId(pj.id);
    setSelectedPjId(pj.id);
    setForm(formFromPj(pj));
    setFormError(null);
    setView('form');
  };

  const openHistorico = (pj: ColaboradorPJ) => {
    setSelectedPjId(pj.id);
    setHistForm(EMPTY_HIST);
    setEditingHistId(null);
    setHistError(null);
    setView('historico');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (form.dataAdmissao && form.dataDemissao && form.dataDemissao < form.dataAdmissao) {
      setFormError('A data de demissão não pode ser anterior à admissão.');
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim(),
      salario: Number(form.salario || 0),
      filial: form.filial.trim(),
      cargo: form.cargo.trim(),
      dataAdmissao: form.dataAdmissao || undefined,
      dataDemissao: form.dataDemissao || undefined,
      dataNascimento: form.dataNascimento || undefined,
      ativo: form.ativo,
    };

    if (editingId) {
      updatePj.mutate(
        { id: editingId, pj: payload },
        {
          onSuccess: () => goLista(),
          onError: (err) => setFormError(getRHErrorMessage(err, 'Não foi possível salvar o PJ.')),
        },
      );
      return;
    }

    createPj.mutate(payload, {
      onSuccess: (created) => {
        setSelectedPjId(created.id);
        goLista();
      },
      onError: (err) => setFormError(getRHErrorMessage(err, 'Não foi possível cadastrar o PJ.')),
    });
  };

  const resetHistForm = () => {
    setHistForm(EMPTY_HIST);
    setEditingHistId(null);
    setHistError(null);
  };

  const openEditHist = (entry: ColaboradorPJHistorico) => {
    setEditingHistId(entry.id);
    setHistForm({
      mes: String(entry.mes),
      ano: String(entry.ano),
      salario: String(entry.salario ?? ''),
    });
    setHistError(null);
  };

  const handleHistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPjId) return;
    setHistError(null);

    const payload = {
      ano: Number(histForm.ano),
      mes: Number(histForm.mes),
      salario: Number(histForm.salario || 0),
    };

    if (editingHistId) {
      updateHist.mutate(
        { pjId: selectedPjId, historicoId: editingHistId, payload },
        {
          onSuccess: () => resetHistForm(),
          onError: (err) => setHistError(getRHErrorMessage(err, 'Não foi possível atualizar o histórico.')),
        },
      );
      return;
    }

    createHist.mutate(
      { pjId: selectedPjId, payload },
      {
        onSuccess: () => resetHistForm(),
        onError: (err) => setHistError(getRHErrorMessage(err, 'Não foi possível adicionar o histórico.')),
      },
    );
  };

  const title =
    view === 'form'
      ? (editingId ? 'Editar PJ' : 'Novo PJ')
      : view === 'historico'
        ? `Histórico — ${selectedPj?.nome ?? 'PJ'}`
        : 'Cadastro de PJs';

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card rh-pj-modal">
        <div className="rh-pj-modal__header">
          <div className="rh-pj-modal__title-row">
            {view !== 'lista' && (
              <button type="button" className="rh-pj-modal__back" onClick={goLista} title="Voltar" aria-label="Voltar">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}
            <h3>{title}</h3>
          </div>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>
            Fechar (X)
          </span>
        </div>

        {view === 'lista' && (
          <>
            <p className="rh-pj-modal__hint">
              PJs entram nos meses importados entre admissão e demissão. Use o histórico para mudanças de salário.
            </p>

            <div className="rh-pj-modal__toolbar">
              <div className="reports-search-wrapper" style={{ flex: 1 }}>
                <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF ou cargo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button type="button" className="reports-action-btn primary" onClick={openCreate}>
                + Novo PJ
              </button>
            </div>

            <div className="rh-pj-modal__body">
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
                      <th>Filial</th>
                      <th className="num">Salário</th>
                      <th>Vínculo</th>
                      <th>Status</th>
                      <th style={{ width: 120 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {canShowEmpty && pjs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="rh-pj-modal__empty">Nenhum PJ cadastrado.</td>
                      </tr>
                    ) : (
                      pjs.map((pj) => (
                        <tr key={pj.id}>
                          <td>
                            <strong>{pj.nome}</strong>
                            {pj.cargo ? <div className="rh-pj-modal__sub">{pj.cargo}</div> : null}
                          </td>
                          <td>{pj.cpf}</td>
                          <td>{pj.filial || '—'}</td>
                          <td className="num">{formatCurrency(pj.salario)}</td>
                          <td className="rh-pj-modal__vinculo">
                            {formatDateBr(pj.dataAdmissao)}
                            {' → '}
                            {pj.dataDemissao ? formatDateBr(pj.dataDemissao) : 'atual'}
                          </td>
                          <td>
                            <span className={`status-badge ${pj.ativo ? 'success' : 'inativo'}`}>
                              {pj.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td>
                            <div className="rh-pj-modal__actions">
                              <button type="button" className="reports-action-btn-icon" title="Editar" onClick={() => openEdit(pj)}>
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                              </button>
                              <button type="button" className="reports-action-btn-icon" title="Histórico salarial" onClick={() => openHistorico(pj)}>
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
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
                                onClick={() => {
                                  if (window.confirm(`Remover o PJ "${pj.nome}"?`)) deletePj.mutate(pj.id);
                                }}
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </QueryDataPanel>
            </div>
          </>
        )}

        {view === 'form' && (
          <form className="rh-pj-modal__body rh-pj-modal__form" onSubmit={handleSubmit}>
            <div className="rh-pj-form-grid">
              <div className="login-group rh-pj-span-2">
                <label>Nome</label>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="login-group">
                <label>CPF</label>
                <input required value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div className="login-group">
                <label>Salário base (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.salario}
                  onChange={(e) => setForm({ ...form, salario: e.target.value })}
                />
              </div>
              <div className="login-group">
                <label>Cargo</label>
                <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </div>
              <div className="login-group">
                <label>Filial</label>
                <input value={form.filial} onChange={(e) => setForm({ ...form, filial: e.target.value })} />
              </div>
              <div className="login-group">
                <label>Admissão</label>
                <input type="date" value={form.dataAdmissao} onChange={(e) => setForm({ ...form, dataAdmissao: e.target.value })} />
              </div>
              <div className="login-group">
                <label>Demissão</label>
                <input type="date" value={form.dataDemissao} onChange={(e) => setForm({ ...form, dataDemissao: e.target.value })} />
              </div>
              <div className="login-group">
                <label>Nascimento</label>
                <input type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
              </div>
              <div className="login-group">
                <label>Status</label>
                <select value={form.ativo ? 'ativo' : 'inativo'} onChange={(e) => setForm({ ...form, ativo: e.target.value === 'ativo' })}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            {formError && <p className="rh-pj-modal__error">{formError}</p>}

            <div className="rh-pj-modal__footer">
              <button type="button" className="reports-action-btn secondary" onClick={goLista}>
                Cancelar
              </button>
              <button type="submit" className="reports-action-btn primary" disabled={savingPj}>
                {savingPj ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar PJ'}
              </button>
            </div>
          </form>
        )}

        {view === 'historico' && selectedPj && (
          <div className="rh-pj-modal__body">
            <div className="rh-pj-modal__hist-summary">
              <div>
                <span className="rh-pj-modal__sub">Salário base</span>
                <strong>{formatCurrency(selectedPj.salario)}</strong>
              </div>
              <div>
                <span className="rh-pj-modal__sub">Vínculo</span>
                <strong>
                  {formatDateBr(selectedPj.dataAdmissao)} → {selectedPj.dataDemissao ? formatDateBr(selectedPj.dataDemissao) : 'atual'}
                </strong>
              </div>
              <button type="button" className="reports-action-btn secondary" onClick={() => openEdit(selectedPj)}>
                Editar cadastro
              </button>
            </div>

            <form className="rh-pj-hist-form" onSubmit={handleHistSubmit}>
              <div className="login-group">
                <label>Mês</label>
                <select value={histForm.mes} onChange={(e) => setHistForm({ ...histForm, mes: e.target.value })}>
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="login-group">
                <label>Ano</label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  required
                  value={histForm.ano}
                  onChange={(e) => setHistForm({ ...histForm, ano: e.target.value })}
                />
              </div>
              <div className="login-group">
                <label>Salário (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={histForm.salario}
                  onChange={(e) => setHistForm({ ...histForm, salario: e.target.value })}
                />
              </div>
              <div className="rh-pj-hist-form__actions">
                <button type="submit" className="reports-action-btn primary" disabled={savingHist}>
                  {savingHist ? 'Salvando...' : editingHistId ? 'Atualizar' : 'Adicionar'}
                </button>
                {editingHistId && (
                  <button type="button" className="reports-action-btn secondary" onClick={resetHistForm}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            {histError && <p className="rh-pj-modal__error">{histError}</p>}

            <QueryDataPanel
              query={historicoQuery}
              variant="compact"
              className="table-container"
              loadingMessage="Carregando histórico..."
              refreshingMessage="Atualizando histórico..."
              errorMessage="Não foi possível carregar o histórico."
            >
              <table className="erp-table reports-table">
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th className="num">Salário</th>
                    <th style={{ width: 90 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {historico.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="rh-pj-modal__empty">
                        Sem alterações — vale o salário base em todos os meses do vínculo.
                      </td>
                    </tr>
                  ) : (
                    historico.map((entry) => (
                      <tr key={entry.id}>
                        <td>{String(entry.mes).padStart(2, '0')}/{entry.ano}</td>
                        <td className="num">{formatCurrency(entry.salario)}</td>
                        <td>
                          <div className="rh-pj-modal__actions">
                            <button type="button" className="reports-action-btn-icon" title="Editar" onClick={() => openEditHist(entry)}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="reports-action-btn-icon"
                              title="Excluir"
                              onClick={() => {
                                if (window.confirm(`Remover histórico ${String(entry.mes).padStart(2, '0')}/${entry.ano}?`)) {
                                  deleteHist.mutate({ pjId: selectedPjId!, historicoId: entry.id });
                                }
                              }}
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </QueryDataPanel>
          </div>
        )}
      </div>
    </div>
  );
};

export default PjsModal;
