import React, { useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  useOcorrenciasMeta,
  useOpsRecebidas,
  useCreateOpsRecebida,
  useUpdateOpsRecebida,
  useDeleteOpsRecebida,
  useGnreIcms,
  useCreateGnreIcms,
  useUpdateGnreIcms,
  useDeleteGnreIcms,
} from '../../hooks/useFinanceiroOcorrencias';
import type {
  OpsRecebidaOcorrencia,
  GnreIcmsOcorrencia,
} from '../../types/domain';

const PAGE_SIZE = 10;

const filterInputStyle: React.CSSProperties = {
  height: '36px',
  padding: '0 12px',
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 0,
  fontSize: '13px',
  color: '#334155',
  outline: 'none',
  boxSizing: 'border-box',
};

function formatDateBr(isoDate: string): string {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function SimNaoBadge({ value, alertWhenFalse = false }: { value: boolean; alertWhenFalse?: boolean }) {
  const isAlert = alertWhenFalse && !value;
  const ok = value;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        color: isAlert ? '#dc2626' : ok ? '#16a34a' : '#64748b',
        border: `1.5px solid ${isAlert ? '#dc2626' : ok ? '#16a34a' : '#94a3b8'}`,
        backgroundColor: '#ffffff',
      }}
    >
      {ok ? 'SIM' : 'NÃO'}
    </span>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      <button
        type="button"
        onClick={onEdit}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'transparent',
          color: '#64748b',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Editar
      </button>
      <button
        type="button"
        onClick={onDelete}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'transparent',
          color: '#64748b',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Excluir
      </button>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="erp-pagination-bar">
      <span style={{ fontWeight: 500, marginRight: '4px' }}>
        Página <span className="erp-pagination-current">{page}</span> de{' '}
        <span className="erp-pagination-current">{totalPages}</span>
      </span>
      <button
        type="button"
        className="reports-action-btn secondary"
        disabled={page <= 1}
        onClick={onPrev}
        style={{
          height: '28px',
          padding: '0 10px',
          fontSize: '11px',
          opacity: page <= 1 ? 0.5 : 1,
          cursor: page <= 1 ? 'not-allowed' : 'pointer',
        }}
      >
        Anterior
      </button>
      <button
        type="button"
        className="reports-action-btn secondary"
        disabled={page >= totalPages}
        onClick={onNext}
        style={{
          height: '28px',
          padding: '0 10px',
          fontSize: '11px',
          opacity: page >= totalPages ? 0.5 : 1,
          cursor: page >= totalPages ? 'not-allowed' : 'pointer',
        }}
      >
        Próximo
      </button>
    </div>
  );
}

function OpsRecebidasPanel() {
  const metaQuery = useOcorrenciasMeta();
  const filiais = metaQuery.data?.filiais ?? [];

  const [search, setSearch] = useState('');
  const [filial, setFilial] = useState('');
  const [date, setDate] = useState('');
  const [mdfeEncerrado, setMdfeEncerrado] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<OpsRecebidaOcorrencia | null>(null);
  const [formFilial, setFormFilial] = useState('');
  const [formContrato, setFormContrato] = useState('');
  const [formData, setFormData] = useState('');
  const [formMdfe, setFormMdfe] = useState(false);

  const params = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, search, filial, date, mdfeEncerrado }),
    [page, search, filial, date, mdfeEncerrado],
  );
  const listQuery = useOpsRecebidas(params);
  const listState = useAsyncQueryState(listQuery);
  const createMut = useCreateOpsRecebida();
  const updateMut = useUpdateOpsRecebida();
  const deleteMut = useDeleteOpsRecebida();

  const rows = listQuery.data?.results ?? [];
  const totalPages = Math.max(1, Math.ceil((listQuery.data?.count ?? 0) / PAGE_SIZE));

  const openCreate = () => {
    setEditing(null);
    setFormFilial(filiais[0] ?? '');
    setFormContrato('');
    setFormData(new Date().toISOString().slice(0, 10));
    setFormMdfe(false);
    setIsModalOpen(true);
  };

  const openEdit = (row: OpsRecebidaOcorrencia) => {
    setEditing(row);
    setFormFilial(row.filial);
    setFormContrato(row.contrato);
    setFormData(row.dataPagamento);
    setFormMdfe(row.mdfeEncerrado);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      filial: formFilial,
      contrato: formContrato.trim(),
      dataPagamento: formData,
      mdfeEncerrado: formMdfe,
    };
    if (editing) {
      updateMut.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            alert('Ocorrência atualizada!');
          },
          onError: () => alert('Erro ao atualizar ocorrência.'),
        },
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          setIsModalOpen(false);
          alert('Ocorrência registrada!');
        },
        onError: () => alert('Erro ao registrar ocorrência.'),
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">OPS Recebidas</h1>
        </div>
        <button
          type="button"
          className="reports-action-btn primary"
          style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
          onClick={openCreate}
        >
          Novo registro
        </button>
      </header>

      <div className="reports-filters-bar" style={{ marginBottom: '16px' }}>
        <div className="reports-filter-left">
          <div className="reports-search-wrapper">
            <input
              type="text"
              placeholder="Buscar filial ou contrato..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="reports-select-wrapper">
            <select
              value={filial}
              onChange={(e) => {
                setFilial(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Filial: Todas</option>
              {filiais.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
            style={{ ...filterInputStyle, width: '145px' }}
          />
          <div className="reports-select-wrapper">
            <select
              value={mdfeEncerrado}
              onChange={(e) => {
                setMdfeEncerrado(e.target.value as '' | 'true' | 'false');
                setPage(1);
              }}
            >
              <option value="">MDF-e: Todos</option>
              <option value="false">MDF-e não encerrada</option>
              <option value="true">MDF-e encerrada</option>
            </select>
          </div>
          <button
            type="button"
            className="reports-action-btn secondary"
            onClick={() => {
              setSearch('');
              setFilial('');
              setDate('');
              setMdfeEncerrado('');
              setPage(1);
            }}
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      <QueryDataPanel
        query={listQuery}
        loadingMessage="Carregando OPs recebidas..."
        refreshingMessage="Atualizando OPs..."
        errorMessage="Não foi possível carregar as OPs. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ padding: '8px', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th>FILIAL RECEBIDA</th>
                  <th>CONTRATO</th>
                  <th>DATA DE PAGAMENTO</th>
                  <th>MDF-E ENCERRADO</th>
                  <th style={{ textAlign: 'center' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {listState.canShowEmpty && rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px' }}>
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 500 }}>{row.filial}</td>
                      <td>{row.contrato}</td>
                      <td>{formatDateBr(row.dataPagamento)}</td>
                      <td><SimNaoBadge value={row.mdfeEncerrado} alertWhenFalse /></td>
                      <td style={{ textAlign: 'center' }}>
                        <RowActions
                          onEdit={() => openEdit(row)}
                          onDelete={() => {
                            if (window.confirm('Excluir este registro?')) {
                              deleteMut.mutate(row.id, {
                                onSuccess: () => alert('Registro excluído!'),
                                onError: () => alert('Erro ao excluir.'),
                              });
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <PaginationBar
          page={Math.min(page, totalPages)}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </QueryDataPanel>

      {isModalOpen && (
        <div className="search-backdrop" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="search-modal-card" style={{ width: '500px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{editing ? 'Editar OP recebida' : 'Nova OP recebida'}</h3>
              <span className="search-close-key" style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)}>Fechar (X)</span>
            </div>
            <form style={{ padding: '20px 24px 24px' }} onSubmit={handleSubmit}>
              <div className="login-group" style={{ marginBottom: '14px' }}>
                <label>Filial recebida</label>
                <select required value={formFilial} onChange={(e) => setFormFilial(e.target.value)}>
                  {filiais.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="login-group" style={{ marginBottom: '14px' }}>
                <label>Contrato</label>
                <input required value={formContrato} onChange={(e) => setFormContrato(e.target.value)} placeholder="Nº do contrato" />
              </div>
              <div className="login-group" style={{ marginBottom: '14px' }}>
                <label>Data de pagamento</label>
                <input type="date" required value={formData} onChange={(e) => setFormData(e.target.value)} />
              </div>
              <div className="login-group" style={{ marginBottom: 0 }}>
                <label>MDF-e encerrado</label>
                <select value={formMdfe ? 'true' : 'false'} onChange={(e) => setFormMdfe(e.target.value === 'true')}>
                  <option value="false">NÃO — MDF-e não encerrada</option>
                  <option value="true">SIM — MDF-e encerrada</option>
                </select>
              </div>
              <button type="submit" className="btn-login" style={{ marginTop: '20px', backgroundColor: '#118CC4' }}>
                Salvar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GnreIcmsPanel() {
  const metaQuery = useOcorrenciasMeta();
  const filiais = metaQuery.data?.filiais ?? [];

  const [search, setSearch] = useState('');
  const [filial, setFilial] = useState('');
  const [date, setDate] = useState('');
  const [validada, setValidada] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<GnreIcmsOcorrencia | null>(null);
  const [formFilial, setFormFilial] = useState('');
  const [formCte, setFormCte] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formPeriodo, setFormPeriodo] = useState('');
  const [formData, setFormData] = useState('');
  const [formValidada, setFormValidada] = useState(false);

  const params = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, search, filial, date, validada }),
    [page, search, filial, date, validada],
  );
  const listQuery = useGnreIcms(params);
  const listState = useAsyncQueryState(listQuery);
  const createMut = useCreateGnreIcms();
  const updateMut = useUpdateGnreIcms();
  const deleteMut = useDeleteGnreIcms();

  const rows = listQuery.data?.results ?? [];
  const totalPages = Math.max(1, Math.ceil((listQuery.data?.count ?? 0) / PAGE_SIZE));

  const openCreate = () => {
    setEditing(null);
    setFormFilial(filiais[0] ?? '');
    setFormCte('');
    setFormValor('');
    setFormPeriodo(new Date().toISOString().slice(0, 7));
    setFormData(new Date().toISOString().slice(0, 10));
    setFormValidada(false);
    setIsModalOpen(true);
  };

  const openEdit = (row: GnreIcmsOcorrencia) => {
    setEditing(row);
    setFormFilial(row.filial);
    setFormCte(row.cte);
    setFormValor(String(row.valorGuia));
    setFormPeriodo(row.periodoReferencia);
    setFormData(row.dataPagamento);
    setFormValidada(row.validada);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      filial: formFilial,
      cte: formCte.trim(),
      valorGuia: Number(formValor),
      periodoReferencia: formPeriodo.trim(),
      dataPagamento: formData,
      validada: formValidada,
    };
    if (editing) {
      updateMut.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            alert('GNRE atualizada!');
          },
          onError: () => alert('Erro ao atualizar GNRE.'),
        },
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          setIsModalOpen(false);
          alert('GNRE registrada!');
        },
        onError: () => alert('Erro ao registrar GNRE.'),
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">GNRE-ICMS</h1>
        </div>
        <button
          type="button"
          className="reports-action-btn primary"
          style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
          onClick={openCreate}
        >
          Novo registro
        </button>
      </header>

      <div className="reports-filters-bar" style={{ marginBottom: '16px' }}>
        <div className="reports-filter-left">
          <div className="reports-search-wrapper">
            <input
              type="text"
              placeholder="Buscar filial, CT-e ou período..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="reports-select-wrapper">
            <select value={filial} onChange={(e) => { setFilial(e.target.value); setPage(1); }}>
              <option value="">Filial: Todas</option>
              {filiais.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} style={{ ...filterInputStyle, width: '145px' }} />
          <div className="reports-select-wrapper">
            <select value={validada} onChange={(e) => { setValidada(e.target.value as '' | 'true' | 'false'); setPage(1); }}>
              <option value="">Validada: Todas</option>
              <option value="false">GNRE não validada</option>
              <option value="true">Validada</option>
            </select>
          </div>
          <button
            type="button"
            className="reports-action-btn secondary"
            onClick={() => {
              setSearch('');
              setFilial('');
              setDate('');
              setValidada('');
              setPage(1);
            }}
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      <QueryDataPanel
        query={listQuery}
        loadingMessage="Carregando GNRE-ICMS..."
        refreshingMessage="Atualizando GNRE..."
        errorMessage="Não foi possível carregar as guias GNRE. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ padding: '8px', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th>FILIAL DE ORIGEM</th>
                  <th>CT-E</th>
                  <th>VALOR DA GUIA</th>
                  <th>PERÍODO</th>
                  <th>DATA PAGAMENTO</th>
                  <th>VALIDADA</th>
                  <th style={{ textAlign: 'center' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {listState.canShowEmpty && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px' }}>
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 500 }}>{row.filial}</td>
                      <td>{row.cte}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(row.valorGuia)}</td>
                      <td>{row.periodoReferencia}</td>
                      <td>{formatDateBr(row.dataPagamento)}</td>
                      <td><SimNaoBadge value={row.validada} alertWhenFalse /></td>
                      <td style={{ textAlign: 'center' }}>
                        <RowActions
                          onEdit={() => openEdit(row)}
                          onDelete={() => {
                            if (window.confirm('Excluir esta GNRE?')) {
                              deleteMut.mutate(row.id, {
                                onSuccess: () => alert('Registro excluído!'),
                                onError: () => alert('Erro ao excluir.'),
                              });
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <PaginationBar
          page={Math.min(page, totalPages)}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </QueryDataPanel>

      {isModalOpen && (
        <div className="search-backdrop" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="search-modal-card" style={{ width: '520px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{editing ? 'Editar GNRE-ICMS' : 'Nova GNRE-ICMS'}</h3>
              <span className="search-close-key" style={{ cursor: 'pointer' }} onClick={() => setIsModalOpen(false)}>Fechar (X)</span>
            </div>
            <form style={{ padding: '20px 24px 24px' }} onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Filial de origem</label>
                  <select required value={formFilial} onChange={(e) => setFormFilial(e.target.value)}>
                    {filiais.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>CT-e</label>
                  <input required value={formCte} onChange={(e) => setFormCte(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Valor da guia (R$)</label>
                  <input type="number" step="0.01" required value={formValor} onChange={(e) => setFormValor(e.target.value)} />
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Período de referência</label>
                  <input type="month" required value={formPeriodo} onChange={(e) => setFormPeriodo(e.target.value)} />
                </div>
              </div>
              <div className="login-group" style={{ marginBottom: '14px' }}>
                <label>Data de pagamento</label>
                <input type="date" required value={formData} onChange={(e) => setFormData(e.target.value)} />
              </div>
              <div className="login-group" style={{ marginBottom: 0 }}>
                <label>Validada</label>
                <select value={formValidada ? 'true' : 'false'} onChange={(e) => setFormValidada(e.target.value === 'true')}>
                  <option value="false">NÃO — GNRE não validada / emitida errada</option>
                  <option value="true">SIM — Validada</option>
                </select>
              </div>
              <button type="submit" className="btn-login" style={{ marginTop: '20px', backgroundColor: '#118CC4' }}>
                Salvar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const FinanceiroOcorrencias: React.FC = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="ops-recebidas" replace />} />
      <Route path="ops-recebidas" element={<OpsRecebidasPanel />} />
      <Route path="gnre-icms" element={<GnreIcmsPanel />} />
      <Route path="*" element={<Navigate to="ops-recebidas" replace />} />
    </Routes>
  );
};

export default FinanceiroOcorrencias;
