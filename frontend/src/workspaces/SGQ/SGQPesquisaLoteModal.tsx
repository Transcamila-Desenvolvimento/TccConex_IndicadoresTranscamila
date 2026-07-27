import React, { useState } from 'react';
import type { SgqAvaliacao, SgqCliente, SgqPesquisaBulkErrors, SgqPesquisaPayload } from '../../types/domain';
import { SGQ_AVALIACAO_OPTIONS, SGQ_CLIENTE_OPTIONS, SGQ_CRITERIOS } from '../../types/domain';
import { useBulkCreateSgqPesquisas, getSgqBulkErrors } from '../../hooks/useSgqPesquisas';

type LoteRow = {
  data: string;
  cliente: SgqCliente;
  motorista: string;
  cte: string;
  notaFiscal: string;
  prazoEntrega: SgqAvaliacao | '';
  condicoesMercadoria: SgqAvaliacao | '';
  condicoesVeiculo: SgqAvaliacao | '';
  apresentacaoMotorista: SgqAvaliacao | '';
  atendimentoDispensado: SgqAvaliacao | '';
};

const EMPTY_ROW: LoteRow = {
  data: '',
  cliente: 'OUTROS',
  motorista: '',
  cte: '',
  notaFiscal: '',
  prazoEntrega: '',
  condicoesMercadoria: '',
  condicoesVeiculo: '',
  apresentacaoMotorista: '',
  atendimentoDispensado: '',
};

const INITIAL_ROW_COUNT = 5;

function makeInitialRows(): LoteRow[] {
  return Array.from({ length: INITIAL_ROW_COUNT }, () => ({ ...EMPTY_ROW }));
}

function isRowEmpty(row: LoteRow): boolean {
  return !row.motorista.trim() && !row.data;
}

type SGQPesquisaLoteModalProps = {
  onClose: () => void;
};

const SGQPesquisaLoteModal: React.FC<SGQPesquisaLoteModalProps> = ({ onClose }) => {
  const [rows, setRows] = useState<LoteRow[]>(makeInitialRows);
  const [rowErrors, setRowErrors] = useState<SgqPesquisaBulkErrors>({});
  const [formError, setFormError] = useState('');
  const bulkCreate = useBulkCreateSgqPesquisas();

  const updateRow = <K extends keyof LoteRow>(idx: number, field: K, value: LoteRow[K]) => {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
    setRowErrors((prev) => {
      if (!prev[idx] || !(field in prev[idx])) return prev;
      const { [field]: _removed, ...restFields } = prev[idx];
      return { ...prev, [idx]: restFields };
    });
  };

  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
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
        data: row.data,
        cliente: row.cliente,
        motorista: row.motorista.trim(),
        cte: row.cte.trim(),
        notaFiscal: row.notaFiscal.trim(),
        prazoEntrega: row.prazoEntrega as SgqAvaliacao,
        condicoesMercadoria: row.condicoesMercadoria as SgqAvaliacao,
        condicoesVeiculo: row.condicoesVeiculo as SgqAvaliacao,
        apresentacaoMotorista: row.apresentacaoMotorista as SgqAvaliacao,
        atendimentoDispensado: row.atendimentoDispensado as SgqAvaliacao,
        analise: '',
        tratativaJustificativa: '',
      });
    });

    if (payloads.length === 0) {
      setFormError('Preencha pelo menos uma linha antes de salvar.');
      return;
    }

    setFormError('');
    setRowErrors({});

    bulkCreate.mutate(payloads, {
      onSuccess: onClose,
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

  return (
    <div
      className="search-backdrop sgq-lote-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !bulkCreate.isPending) onClose(); }}
    >
      <div className="modal-card sgq-lote-modal-card">
        <div className="modal-header">
          <h3>Inclusão em Tabela — Pesquisa de Satisfação</h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar" disabled={bulkCreate.isPending}>
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
                {SGQ_CRITERIOS.map((criterio) => (
                  <col key={criterio.key} className="sgq-lote-col-avaliacao" />
                ))}
                <col className="sgq-lote-col-remove" />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Motorista</th>
                  <th>CT-e</th>
                  <th>Nota Fiscal</th>
                  {SGQ_CRITERIOS.map((criterio) => (
                    <th key={criterio.key} title={criterio.label} className="sgq-lote-th-center">
                      {criterio.shortLabel}
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="sgq-lote-index">{idx + 1}</td>
                    <td>
                      <input
                        type="date"
                        className={cellClass(idx, 'data')}
                        value={row.data}
                        title={fieldError(idx, 'data')}
                        onChange={(e) => updateRow(idx, 'data', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className={cellClass(idx, 'cliente')}
                        value={row.cliente}
                        title={fieldError(idx, 'cliente')}
                        onChange={(e) => updateRow(idx, 'cliente', e.target.value as SgqCliente)}
                      >
                        {SGQ_CLIENTE_OPTIONS.map((cliente) => (
                          <option key={cliente} value={cliente}>{cliente}</option>
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
                    {SGQ_CRITERIOS.map((criterio) => (
                      <td key={criterio.key}>
                        <select
                          className={cellClass(idx, criterio.key)}
                          value={row[criterio.key]}
                          title={fieldError(idx, criterio.key)}
                          onChange={(e) => updateRow(idx, criterio.key, e.target.value as SgqAvaliacao)}
                        >
                          <option value="">Selecione</option>
                          {SGQ_AVALIACAO_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    ))}
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

          <button type="button" className="reports-action-btn secondary" style={{ marginTop: '12px' }} onClick={addRow}>
            <i className="bi bi-plus-lg" />
            <span>Adicionar Linha</span>
          </button>

          {formError && (
            <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '13px' }}>
              {formError}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={bulkCreate.isPending}>
            Cancelar
          </button>
          <button type="button" className="reports-action-btn primary" onClick={handleSubmit} disabled={bulkCreate.isPending}>
            {bulkCreate.isPending ? 'Salvando...' : 'Salvar Tudo'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SGQPesquisaLoteModal;
