import React, { useState } from 'react';
import type { LoteMovimentacaoRH } from '../../../types/domain';
import { useExportarRelatorioMovimentacoesRH, getRHErrorMessage } from '../../../hooks/useRH';

interface ExportarRelatorioModalProps {
  lotes: LoteMovimentacaoRH[];
  defaultLoteId?: string;
  onClose: () => void;
}

const ExportarRelatorioModal: React.FC<ExportarRelatorioModalProps> = ({ lotes, defaultLoteId, onClose }) => {
  const [loteId, setLoteId] = useState(defaultLoteId ?? lotes[0]?.id ?? '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const exportarRelatorio = useExportarRelatorioMovimentacoesRH();
  const isExporting = exportarRelatorio.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!loteId) {
      setErrorMsg('Selecione um período de referência.');
      return;
    }

    const lote = lotes.find((l) => l.id === loteId);
    try {
      const blob = await exportarRelatorio.mutateAsync(loteId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const mes = lote ? String(lote.mes).padStart(2, '0') : '00';
      const ano = lote ? lote.ano : '0000';
      link.download = `Relatorio_Movimentacoes_${mes}_${ano}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      setErrorMsg(getRHErrorMessage(error, 'Não foi possível exportar o relatório de movimentações.'));
    }
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget && !isExporting) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '460px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Exportar Relatório de Movimentações</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <form style={{ padding: '20px 24px 24px 24px' }} onSubmit={handleSubmit}>
          <p style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.6, marginTop: 0 }}>
            Selecione o período desejado. O relatório em Excel trará filial, tipo de ocorrência (contratação,
            demissão, alteração de cargo/salário), cargo e demais detalhes de cada colaborador.
          </p>

          <div className="login-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="rh-export-lote">Período de referência</label>
            <select id="rh-export-lote" required value={loteId} onChange={(e) => setLoteId(e.target.value)} disabled={isExporting}>
              <option value="" disabled>Selecione um período...</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>{String(lote.mes).padStart(2, '0')}/{lote.ano}</option>
              ))}
            </select>
          </div>

          {errorMsg && (
            <div style={{ marginBottom: '14px', marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={isExporting} style={{ fontSize: '12.5px', height: '36px', borderColor: '#cbd5e1' }}>
              Cancelar
            </button>
            <button
              type="submit"
              className="reports-action-btn primary"
              disabled={isExporting || lotes.length === 0}
              style={{ fontSize: '12.5px', height: '36px' }}
            >
              {isExporting ? 'Exportando...' : 'Exportar Relatório'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExportarRelatorioModal;
