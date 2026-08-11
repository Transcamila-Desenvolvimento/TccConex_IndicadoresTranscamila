import React, { useState } from 'react';
import axios from 'axios';
import {
  useExportSgqPesquisaImportTemplate,
  useImportSgqPesquisasSpreadsheet,
  usePreviewSgqPesquisasSpreadsheet,
} from '../../hooks/useSgqPesquisas';
import type {
  SgqPesquisaImportPreview,
  SgqPesquisaImportPreviewStats,
  SgqPesquisaImportResult,
} from '../../types/domain';

type SGQPesquisaImportModalProps = {
  onClose: () => void;
};

type Step = 'upload' | 'preview' | 'done';

const PREVIEW_COLUMNS: { key: keyof SgqPesquisaImportPreview['rows'][number]; label: string }[] = [
  { key: 'row', label: 'Linha' },
  { key: 'dataEnvio', label: 'Envio' },
  { key: 'motorista', label: 'Motorista' },
  { key: 'cte', label: 'CHTO' },
  { key: 'dataEntrega', label: 'Entrega' },
  { key: 'notaFiscal', label: 'NF' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'prazoEntrega', label: 'Prazo' },
  { key: 'condicoesMercadoria', label: 'Merc.' },
  { key: 'condicoesVeiculo', label: 'Veíc.' },
  { key: 'apresentacaoMotorista', label: 'Apres.' },
  { key: 'atendimentoDispensado', label: 'Atend.' },
];

function formatDateRange(range: { min: string; max: string }): string {
  if (!range.min && !range.max) return '—';
  if (range.min === range.max) return range.min;
  return `${range.min} a ${range.max}`;
}

const ImportPreviewStatsPanel: React.FC<{ stats: SgqPesquisaImportPreviewStats }> = ({ stats }) => (
  <div className="sgq-import-stats-panel">
    <div className={`sgq-import-status-banner ${stats.readyToImport ? 'is-ready' : 'is-blocked'}`}>
      <i className={`bi ${stats.readyToImport ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
      {stats.readyToImport
        ? `Planilha validada — ${stats.validRate}% das linhas prontas para importação.`
        : 'Corrija os erros abaixo antes de importar.'}
    </div>

    <div className="sgq-import-stats-grid">
      <div className={`sgq-import-stat-card ${stats.validRate === 100 ? 'is-valid' : stats.invalidRows > 0 ? 'is-warn' : ''}`}>
        <span className="sgq-import-stat-label">Taxa de validação</span>
        <span className="sgq-import-stat-value">{stats.validRate}%</span>
        <span className="sgq-import-stat-hint">{stats.processedRows} linha(s) lidas</span>
      </div>
      <div className="sgq-import-stat-card is-valid">
        <span className="sgq-import-stat-label">Linhas válidas</span>
        <span className="sgq-import-stat-value">{stats.validRows}</span>
      </div>
      <div className={`sgq-import-stat-card ${stats.invalidRows > 0 ? 'is-error' : ''}`}>
        <span className="sgq-import-stat-label">Com erro</span>
        <span className="sgq-import-stat-value">{stats.invalidRows}</span>
      </div>
      <div className="sgq-import-stat-card">
        <span className="sgq-import-stat-label">Vazias ignoradas</span>
        <span className="sgq-import-stat-value">{stats.skippedEmptyRows}</span>
      </div>
      <div className="sgq-import-stat-card">
        <span className="sgq-import-stat-label">Motoristas distintos</span>
        <span className="sgq-import-stat-value">{stats.uniqueMotoristas}</span>
      </div>
      <div className="sgq-import-stat-card">
        <span className="sgq-import-stat-label">Com análise</span>
        <span className="sgq-import-stat-value">{stats.rowsWithAnalise}</span>
      </div>
      <div className={`sgq-import-stat-card ${stats.duplicateRowCount > 0 ? 'is-warn' : ''}`}>
        <span className="sgq-import-stat-label">Duplicatas na planilha</span>
        <span className="sgq-import-stat-value">{stats.duplicateRowCount}</span>
        {stats.duplicateGroupCount > 0 && (
          <span className="sgq-import-stat-hint">{stats.duplicateGroupCount} grupo(s)</span>
        )}
      </div>
      <div className="sgq-import-stat-card">
        <span className="sgq-import-stat-label">Período de entrega</span>
        <span className="sgq-import-stat-value" style={{ fontSize: '13px' }}>
          {formatDateRange(stats.deliveryDateRange)}
        </span>
      </div>
    </div>

    {stats.byCliente.length > 0 && (
      <div className="sgq-import-stats-section">
        <h4>Por cliente</h4>
        <div className="sgq-import-chip-row">
          {stats.byCliente.map((item) => (
            <span key={item.cliente} className="sgq-import-chip">
              {item.cliente} <strong>{item.count}</strong>
            </span>
          ))}
        </div>
      </div>
    )}

    {(stats.inclusionDateRange.min || stats.inclusionDateRange.max) && (
      <div className="sgq-import-stats-section">
        <h4>Período de envio</h4>
        <span className="sgq-import-chip">{formatDateRange(stats.inclusionDateRange)}</span>
      </div>
    )}

    {stats.avaliacaoCounts.length > 0 && (
      <div className="sgq-import-stats-section">
        <h4>Distribuição de avaliações (critérios válidos)</h4>
        <div className="sgq-import-chip-row">
          {stats.avaliacaoCounts.map((item) => (
            <span key={item.label} className="sgq-import-chip">
              {item.label} <strong>{item.count}</strong>
            </span>
          ))}
        </div>
      </div>
    )}

    {stats.errorSummary.length > 0 && (
      <div className="sgq-import-stats-section">
        <h4>Erros por tipo</h4>
        <ul className="sgq-import-mini-list">
          {stats.errorSummary.map((item) => (
            <li key={item.message}>
              {item.message} <strong>({item.count}x)</strong>
            </li>
          ))}
        </ul>
      </div>
    )}

    {stats.duplicateGroups.length > 0 && (
      <div className="sgq-import-stats-section">
        <h4>Registros repetidos (CHTO + NF + data entrega)</h4>
        <ul className="sgq-import-mini-list">
          {stats.duplicateGroups.map((group) => (
            <li key={`${group.cte}-${group.notaFiscal}-${group.dataEntrega}`}>
              CHTO {group.cte}, NF {group.notaFiscal}, entrega {group.dataEntrega} — linhas{' '}
              {group.rows.join(', ')}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const SGQPesquisaImportModal: React.FC<SGQPesquisaImportModalProps> = ({ onClose }) => {
  const exportModelo = useExportSgqPesquisaImportTemplate();
  const previewMutation = usePreviewSgqPesquisasSpreadsheet();
  const importMutation = useImportSgqPesquisasSpreadsheet();

  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SgqPesquisaImportPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<SgqPesquisaImportResult | null>(null);

  const resetFileState = () => {
    setPreview(null);
    setResult(null);
    setErrorMsg(null);
    setStep('upload');
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      resetFileState();
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      resetFileState();
    }
  };

  const handleDownloadModelo = async () => {
    try {
      setErrorMsg(null);
      const blob = await exportModelo.mutateAsync();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modelo_importacao_pesquisas_sgq.xlsx';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setErrorMsg('Não foi possível baixar a planilha modelo.');
    }
  };

  const handlePreview = () => {
    if (!selectedFile) return;
    setErrorMsg(null);
    previewMutation.mutate(selectedFile, {
      onSuccess: (data) => {
        setPreview(data);
        setStep('preview');
        if (!data.success) {
          setErrorMsg(data.detail || 'Existem linhas com erro na planilha.');
        }
      },
      onError: (err: unknown) => {
        if (axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string') {
          setErrorMsg(err.response.data.detail);
          return;
        }
        setErrorMsg('Não foi possível ler a planilha. Verifique o formato (.xlsx).');
      },
    });
  };

  const handleImport = () => {
    if (!selectedFile || !preview?.success) return;
    setErrorMsg(null);
    importMutation.mutate(selectedFile, {
      onSuccess: (res) => {
        setResult(res);
        if (res.success) {
          setStep('done');
        } else {
          setErrorMsg(res.detail || 'A importação não foi concluída.');
        }
      },
      onError: (err: unknown) => {
        if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
          const data = err.response.data as Record<string, unknown>;
          if (typeof data.detail === 'string') {
            setErrorMsg(data.detail);
            return;
          }
        }
        setErrorMsg('Não foi possível importar a planilha.');
      },
    });
  };

  const busy = previewMutation.isPending || importMutation.isPending;
  const canCloseBackdrop = !busy;
  const isWide = step === 'preview';

  return (
    <div
      className="search-backdrop sgq-import-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && canCloseBackdrop) onClose();
      }}
    >
      <div
        className={`search-modal-card sgq-import-modal-card${isWide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sgq-import-modal-title"
      >
        <div className="sgq-import-modal-header">
          <h3 id="sgq-import-modal-title">Importar pesquisas</h3>
          <button type="button" className="search-modal-close" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="sgq-import-modal-body">
          {step === 'upload' && (
            <>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                Use a planilha no formato oficial: DATA DE ENVIO, MOTORISTA, CHTO, DATA ENTREGA,
                Nºs NOTAS FISCAL, critérios (BOM/OTIMO/REGULAR/RUIM), CLIENTE e ANÁLISE.
              </p>

              <button
                type="button"
                className="reports-action-btn secondary"
                style={{ marginBottom: '16px', width: '100%' }}
                onClick={handleDownloadModelo}
                disabled={exportModelo.isPending}
              >
                {exportModelo.isPending ? 'Gerando modelo...' : 'Baixar planilha modelo'}
              </button>

              <div
                className="marketing-ig-dropzone"
                style={{ minHeight: '120px', marginBottom: '12px' }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('sgq-import-file')?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') document.getElementById('sgq-import-file')?.click();
                }}
              >
                <input
                  id="sgq-import-file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                {selectedFile ? (
                  <div style={{ textAlign: 'center' }}>
                    <i className="bi bi-file-earmark-spreadsheet" style={{ fontSize: '28px', color: '#118CC4' }} />
                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#334155' }}>{selectedFile.name}</p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    <i className="bi bi-cloud-arrow-up" style={{ fontSize: '28px' }} />
                    <p style={{ margin: '8px 0 0' }}>Clique ou arraste o arquivo .xlsx</p>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 'preview' && preview && (
            <>
              {preview.stats && <ImportPreviewStatsPanel stats={preview.stats} />}

              <div className="sgq-import-preview-table-wrap">
                <table className="reports-table">
                  <thead>
                    <tr>
                      {PREVIEW_COLUMNS.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.row} style={row.valid ? undefined : { background: '#fef2f2' }}>
                        {PREVIEW_COLUMNS.map((col) => (
                          <td key={col.key} title={String(row[col.key] ?? '')}>
                            {col.key === 'motorista'
                              ? (row.motorista.length > 22 ? `${row.motorista.slice(0, 22)}…` : row.motorista)
                              : String(row[col.key] ?? '')}
                          </td>
                        ))}
                        <td style={{ color: row.valid ? '#15803d' : '#b91c1c', whiteSpace: 'nowrap' }}>
                          {row.valid ? 'OK' : 'Erro'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.errors.length > 0 && (
                <div className="sgq-import-error-box">
                  {preview.errors.map((issue) => (
                    <div key={`${issue.row}-${issue.message}`}>Linha {issue.row}: {issue.message}</div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'done' && result?.success && (
            <p style={{ color: '#15803d', fontSize: '14px', margin: 0 }}>
              {result.created} pesquisa(s) importada(s) com sucesso. Lançamento: <strong>Importação</strong>.
            </p>
          )}

          {errorMsg && (
            <p style={{ color: '#b91c1c', fontSize: '13px', margin: step === 'done' ? '12px 0 0' : '12px 0 0' }}>
              {errorMsg}
            </p>
          )}
        </div>

        <div className="sgq-import-modal-footer">
          {step === 'done' ? (
            <button type="button" className="reports-action-btn primary" onClick={onClose}>
              Fechar
            </button>
          ) : (
            <>
              <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              {step === 'upload' && (
                <button
                  type="button"
                  className="reports-action-btn primary"
                  disabled={!selectedFile || busy}
                  onClick={handlePreview}
                >
                  {previewMutation.isPending ? 'Lendo planilha...' : 'Pré-visualizar'}
                </button>
              )}
              {step === 'preview' && (
                <>
                  <button
                    type="button"
                    className="reports-action-btn secondary"
                    disabled={busy}
                    onClick={() => {
                      setStep('upload');
                      setPreview(null);
                      setErrorMsg(null);
                    }}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    className="reports-action-btn primary"
                    disabled={!preview?.success || busy}
                    onClick={handleImport}
                  >
                    {importMutation.isPending
                      ? 'Importando...'
                      : `Importar ${preview?.validRows ?? 0} pesquisa(s)`}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SGQPesquisaImportModal;
