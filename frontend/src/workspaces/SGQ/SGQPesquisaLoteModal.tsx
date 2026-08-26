import React, { useEffect, useRef, useState } from 'react';
import type {
  SgqAvaliacao,
  SgqClienteOption,
  SgqEscopoAnaliseMap,
  SgqLoteDraftRow,
  SgqPesquisaBulkErrors,
  SgqPesquisaPayload,
} from '../../types/domain';
import { SGQ_AVALIACAO_OPTIONS, SGQ_CRITERIOS } from '../../types/domain';
import {
  useBulkCreateSgqPesquisas,
  useDeleteSgqLoteDraft,
  useSaveSgqLoteDraft,
  useSgqLoteDraft,
  getSgqBulkErrors,
} from '../../hooks/useSgqPesquisas';
import { useAuth } from '../../contexts/AuthContext';
import SGQEscopoAnalisePicker from './SGQEscopoAnalisePicker';

type LoteRow = SgqLoteDraftRow;

function emptyRow(overrides: Partial<LoteRow> = {}): LoteRow {
  return {
    dataEntrega: '',
    cliente: '',
    motorista: '',
    cte: '',
    notaFiscal: '',
    clienteRecusouAssinar: false,
    prazoEntrega: '',
    condicoesMercadoria: '',
    condicoesVeiculo: '',
    apresentacaoMotorista: '',
    atendimentoDispensado: '',
    analise: '',
    escopoAnalise: {},
    ...overrides,
  };
}

const INITIAL_ROW_COUNT = 5;

function makeInitialRows(): LoteRow[] {
  return Array.from({ length: INITIAL_ROW_COUNT }, () => emptyRow());
}

function isRowEmpty(row: LoteRow): boolean {
  return !row.motorista.trim() && !row.cte.trim() && !row.notaFiscal.trim();
}

function formatDraftTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

type SGQPesquisaLoteModalProps = {
  onClose: () => void;
  clienteOptions: SgqClienteOption[];
};

const SGQPesquisaLoteModal: React.FC<SGQPesquisaLoteModalProps> = ({ onClose, clienteOptions }) => {
  const { selectedFilial } = useAuth();
  const filial = selectedFilial ?? null;
  const draftQuery = useSgqLoteDraft(filial);
  const saveDraft = useSaveSgqLoteDraft(filial);
  const deleteDraft = useDeleteSgqLoteDraft(filial);
  const bulkCreate = useBulkCreateSgqPesquisas();

  const [rows, setRows] = useState<LoteRow[]>(makeInitialRows);
  const [hydrated, setHydrated] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<SgqPesquisaBulkErrors>({});
  const [formError, setFormError] = useState('');
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (hydrated || draftQuery.isLoading || draftQuery.isFetching) return;
    const draft = draftQuery.data;
    if (draft?.hasDraft && draft.rows.length > 0) {
      setRows(draft.rows);
      setDraftUpdatedAt(draft.updatedAt);
      setRestoredDraft(true);
    } else {
      setRows(makeInitialRows());
      setDraftUpdatedAt(null);
      setRestoredDraft(false);
    }
    setHydrated(true);
    skipNextSave.current = true;
  }, [draftQuery.data, draftQuery.isLoading, draftQuery.isFetching, hydrated]);

  useEffect(() => {
    if (!hydrated || !filial) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      saveDraft.mutate(rows, {
        onSuccess: (data) => {
          setDraftUpdatedAt(data.hasDraft ? data.updatedAt : null);
          if (!data.hasDraft) setRestoredDraft(false);
        },
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [rows, hydrated, filial]); // eslint-disable-line react-hooks/exhaustive-deps -- debounce saveDraft

  const updateRow = <K extends keyof LoteRow>(idx: number, field: K, value: LoteRow[K]) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== idx) return row;
      const next = { ...row, [field]: value };
      if (field === 'clienteRecusouAssinar' && value === true) {
        SGQ_CRITERIOS.forEach((c) => { next[c.key] = ''; });
      }
      if (field === 'analise' && !String(value).trim()) {
        next.escopoAnalise = {};
      }
      return next;
    }));
    setRowErrors((prev) => {
      if (!prev[idx] || !(field in prev[idx])) return prev;
      const { [field]: _removed, ...restFields } = prev[idx];
      return { ...prev, [idx]: restFields };
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        emptyRow({
          dataEntrega: last?.dataEntrega || '',
          cliente: last?.cliente || '',
        }),
      ];
    });
  };

  const removeRow = (idx: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
    setRowErrors((prev) => {
      const next: SgqPesquisaBulkErrors = {};
      Object.entries(prev).forEach(([key, value]) => {
        const i = Number(key);
        if (i < idx) next[i] = value;
        else if (i > idx) next[i - 1] = value;
      });
      return next;
    });
  };

  const discardDraft = () => {
    deleteDraft.mutate(undefined, {
      onSuccess: onClose,
      onError: () => setFormError('Não foi possível descartar o rascunho. Tente novamente.'),
    });
  };

  const fieldError = (idx: number, field: keyof SgqPesquisaPayload) => rowErrors[idx]?.[field]?.[0];
  const cellClass = (idx: number, field: keyof SgqPesquisaPayload) =>
    `sgq-lote-input${fieldError(idx, field) ? ' is-invalid' : ''}`;

  const handleSubmit = () => {
    const mapping: number[] = [];
    const payloads: SgqPesquisaPayload[] = [];

    rows.forEach((row, idx) => {
      if (isRowEmpty(row)) return;
      mapping.push(idx);
      payloads.push({
        dataEntrega: row.dataEntrega,
        cliente: row.cliente,
        motorista: row.motorista.trim(),
        cte: row.cte.trim(),
        notaFiscal: row.notaFiscal.trim(),
        clienteRecusouAssinar: row.clienteRecusouAssinar,
        prazoEntrega: row.clienteRecusouAssinar ? '' : (row.prazoEntrega as SgqAvaliacao),
        condicoesMercadoria: row.clienteRecusouAssinar ? '' : (row.condicoesMercadoria as SgqAvaliacao),
        condicoesVeiculo: row.clienteRecusouAssinar ? '' : (row.condicoesVeiculo as SgqAvaliacao),
        apresentacaoMotorista: row.clienteRecusouAssinar ? '' : (row.apresentacaoMotorista as SgqAvaliacao),
        atendimentoDispensado: row.clienteRecusouAssinar ? '' : (row.atendimentoDispensado as SgqAvaliacao),
        analise: row.analise.trim(),
        escopoAnalise: row.analise.trim() ? row.escopoAnalise : {},
      });
    });

    if (payloads.length === 0) {
      setFormError('Preencha pelo menos uma linha (motorista, CT-e ou NF) antes de salvar.');
      return;
    }

    setFormError('');
    setRowErrors({});

    bulkCreate.mutate(payloads, {
      onSuccess: () => {
        deleteDraft.mutate(undefined, {
          onSettled: onClose,
        });
      },
      onError: (error) => {
        const backendErrors = getSgqBulkErrors(error);
        if (backendErrors) {
          const mapped: SgqPesquisaBulkErrors = {};
          Object.entries(backendErrors).forEach(([sentIdxStr, fieldErrors]) => {
            const rowIdx = mapping[Number(sentIdxStr)];
            if (rowIdx !== undefined) mapped[rowIdx] = fieldErrors;
          });
          setRowErrors(mapped);
          setFormError('Existem erros no preenchimento. Corrija os campos destacados e tente novamente.');
        } else {
          setFormError('Erro ao salvar as pesquisas. Tente novamente.');
        }
      },
    });
  };

  const busy = bulkCreate.isPending || deleteDraft.isPending;
  const draftHint = draftUpdatedAt
    ? `Rascunho na sua conta · ${formatDraftTime(draftUpdatedAt)}`
    : 'Rascunho salvo na sua conta (por filial)';

  if (!hydrated) {
    return (
      <div className="search-backdrop sgq-lote-backdrop">
        <div className="modal-card sgq-lote-modal-card">
          <div className="modal-header">
            <h3>Inclusão em Tabela — Pesquisa de Satisfação</h3>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
              <i className="bi bi-x-lg" />
            </button>
          </div>
          <div className="modal-body sgq-lote-modal-body">
            <p className="sgq-lote-draft-hint">Carregando rascunho...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="search-backdrop sgq-lote-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="modal-card sgq-lote-modal-card">
        <div className="modal-header">
          <div>
            <h3>Inclusão em Tabela — Pesquisa de Satisfação</h3>
            <p className="sgq-lote-draft-hint">
              {restoredDraft && draftUpdatedAt ? 'Rascunho restaurado · ' : ''}
              {draftHint}
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar" disabled={busy}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="modal-body sgq-lote-modal-body">
          <div className="sgq-lote-table-wrapper">
            <table className="sgq-lote-table">
              <colgroup>
                <col className="sgq-lote-col-index" />
                <col className="sgq-lote-col-data" />
                <col className="sgq-lote-col-cliente" />
                <col className="sgq-lote-col-motorista" />
                <col className="sgq-lote-col-doc" />
                <col className="sgq-lote-col-doc" />
                <col className="sgq-lote-col-recusou" />
                {SGQ_CRITERIOS.map((criterio) => (
                  <col key={criterio.key} className="sgq-lote-col-avaliacao" />
                ))}
                <col className="sgq-lote-col-escopo" />
                <col className="sgq-lote-col-analise" />
                <col className="sgq-lote-col-remove" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th title="Data de entrega">Data entrega</th>
                  <th>Cliente</th>
                  <th>Motorista</th>
                  <th>CT-e</th>
                  <th title="Nota Fiscal">Nota Fiscal</th>
                  <th title="Cliente se recusou a avaliar" className="sgq-lote-th-center">Recusou?</th>
                  {SGQ_CRITERIOS.map((criterio) => (
                    <th key={criterio.key} title={criterio.label} className="sgq-lote-th-center">
                      {criterio.shortLabel}
                    </th>
                  ))}
                  <th title="Obrigatório quando houver análise">Escopo</th>
                  <th title="Análise, tratativa e justificativa">Análise</th>
                  <th aria-label="Remover" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className={rowErrors[idx] && Object.keys(rowErrors[idx]).length ? 'has-errors' : undefined}>
                    <td className="sgq-lote-index">{idx + 1}</td>
                    <td>
                      <input
                        type="date"
                        className={cellClass(idx, 'dataEntrega')}
                        value={row.dataEntrega}
                        title={fieldError(idx, 'dataEntrega')}
                        onChange={(e) => updateRow(idx, 'dataEntrega', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className={cellClass(idx, 'cliente')}
                        value={row.cliente}
                        title={fieldError(idx, 'cliente')}
                        onChange={(e) => updateRow(idx, 'cliente', e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {clienteOptions.map((clienteOpt) => (
                          <option key={clienteOpt.value} value={clienteOpt.value}>{clienteOpt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className={cellClass(idx, 'motorista')}
                        placeholder="Nome do motorista"
                        value={row.motorista}
                        title={fieldError(idx, 'motorista')}
                        onChange={(e) => updateRow(idx, 'motorista', e.target.value)}
                        autoComplete="off"
                        list="sgq-motoristas-sugestoes"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className={cellClass(idx, 'cte')}
                        placeholder="CT-e"
                        value={row.cte}
                        title={fieldError(idx, 'cte')}
                        onChange={(e) => updateRow(idx, 'cte', e.target.value)}
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className={cellClass(idx, 'notaFiscal')}
                        placeholder="N.F."
                        value={row.notaFiscal}
                        title={fieldError(idx, 'notaFiscal')}
                        onChange={(e) => updateRow(idx, 'notaFiscal', e.target.value)}
                        autoComplete="off"
                      />
                    </td>
                    <td className="sgq-lote-cell-center">
                      <input
                        type="checkbox"
                        className="sgq-lote-checkbox"
                        checked={row.clienteRecusouAssinar}
                        title="Cliente se recusou a avaliar — dispensa a avaliação dos critérios"
                        onChange={(e) => updateRow(idx, 'clienteRecusouAssinar', e.target.checked)}
                      />
                    </td>
                    {SGQ_CRITERIOS.map((criterio) => (
                      <td key={criterio.key}>
                        <select
                          className={cellClass(idx, criterio.key)}
                          value={row[criterio.key]}
                          title={fieldError(idx, criterio.key) || criterio.label}
                          disabled={row.clienteRecusouAssinar}
                          onChange={(e) => updateRow(idx, criterio.key, e.target.value as SgqAvaliacao)}
                        >
                          <option value="">Selecione</option>
                          {SGQ_AVALIACAO_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td>
                      <SGQEscopoAnalisePicker
                        compact
                        disabled={!row.analise.trim()}
                        invalid={Boolean(fieldError(idx, 'escopoAnalise'))}
                        value={row.escopoAnalise}
                        onChange={(next: SgqEscopoAnaliseMap) => updateRow(idx, 'escopoAnalise', next)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className={cellClass(idx, 'analise')}
                        placeholder="Opcional"
                        value={row.analise}
                        title={fieldError(idx, 'analise') || 'Análise, tratativa e justificativa'}
                        onChange={(e) => updateRow(idx, 'analise', e.target.value)}
                        autoComplete="off"
                      />
                    </td>
                    <td className="sgq-lote-remove">
                      <button
                        type="button"
                        className="btn-icon btn-icon-danger"
                        title="Remover linha"
                        onClick={() => removeRow(idx)}
                        disabled={rows.length === 1}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="reports-action-btn secondary sgq-lote-add-row" onClick={addRow}>
            <i className="bi bi-plus-lg" />
            <span>Adicionar Linha</span>
          </button>

          {formError && (
            <div className="sgq-lote-error">{formError}</div>
          )}
        </div>

        <div className="modal-footer">
          {(draftUpdatedAt || restoredDraft) && (
            <button
              type="button"
              className="reports-action-btn secondary"
              onClick={discardDraft}
              disabled={busy}
              title="Apaga o rascunho da sua conta nesta filial"
            >
              Descartar rascunho
            </button>
          )}
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={busy}>
            Fechar
          </button>
          <button type="button" className="reports-action-btn primary" onClick={handleSubmit} disabled={busy}>
            {bulkCreate.isPending ? 'Salvando...' : 'Salvar Tudo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SGQPesquisaLoteModal;
