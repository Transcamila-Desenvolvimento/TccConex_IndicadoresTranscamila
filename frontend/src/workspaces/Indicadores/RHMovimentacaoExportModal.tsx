import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useExportarIndicadorRHMovimentacao } from '../../hooks/useIndicadores';
import type { RHIndicadorLoteOption } from '../../types/domain';

interface RHMovimentacaoExportModalProps {
  lotes: RHIndicadorLoteOption[];
  defaultReferencia?: string;
  onClose: () => void;
}

function loteReferencia(lote: RHIndicadorLoteOption): string {
  return `${lote.ano}-${String(lote.mes).padStart(2, '0')}`;
}

function loteLabel(lote: RHIndicadorLoteOption): string {
  return `${String(lote.mes).padStart(2, '0')}/${lote.ano}`;
}

async function getExportErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const parsed = JSON.parse(text) as { detail?: string };
        if (typeof parsed.detail === 'string') return parsed.detail;
      } catch {
        /* mantém fallback */
      }
    } else if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
    }
  }
  return fallback;
}

async function assertExcelBlob(blob: Blob): Promise<Blob> {
  if (blob.size < 4) {
    throw new Error('O servidor retornou um arquivo vazio.');
  }
  const header = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (header[0] === 0x50 && header[1] === 0x4B) {
    return blob;
  }
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { detail?: string };
    if (typeof parsed.detail === 'string') {
      throw new Error(parsed.detail);
    }
  } catch (error) {
    if (error instanceof Error && error.message !== 'Unexpected token') {
      throw error;
    }
  }
  throw new Error('Resposta inválida ao gerar a planilha.');
}

const RHMovimentacaoExportModal: React.FC<RHMovimentacaoExportModalProps> = ({
  lotes,
  defaultReferencia,
  onClose,
}) => {
  const lotesOrdenados = useMemo(
    () => [...lotes].sort((a, b) => (a.ano !== b.ano ? b.ano - a.ano : b.mes - a.mes)),
    [lotes],
  );

  const referenciasValidas = useMemo(
    () => new Set(lotesOrdenados.map(loteReferencia)),
    [lotesOrdenados],
  );

  const referenciaInicial = useMemo(() => {
    if (defaultReferencia && referenciasValidas.has(defaultReferencia)) {
      return defaultReferencia;
    }
    return lotesOrdenados[0] ? loteReferencia(lotesOrdenados[0]) : '';
  }, [defaultReferencia, referenciasValidas, lotesOrdenados]);

  const [referencia, setReferencia] = useState(referenciaInicial);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const exportar = useExportarIndicadorRHMovimentacao();
  const isExporting = exportar.isPending;

  useEffect(() => {
    setReferencia((atual) => (
      atual && referenciasValidas.has(atual) ? atual : referenciaInicial
    ));
  }, [referenciaInicial, referenciasValidas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!referencia) {
      setErrorMsg('Selecione o mês de referência.');
      return;
    }

    const [anoStr, mesStr] = referencia.split('-');
    const mes = mesStr ?? '00';
    const ano = anoStr ?? '0000';

    try {
      const blob = await exportar.mutateAsync(referencia);
      const arquivo = await assertExcelBlob(blob);
      const url = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Indicador_RH_Movimentacao_${mes}_${ano}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      if (error instanceof Error && !axios.isAxiosError(error)) {
        setErrorMsg(error.message);
        return;
      }
      setErrorMsg(await getExportErrorMessage(error, 'Não foi possível exportar os dados brutos do indicador.'));
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
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Baixar dados brutos</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <form style={{ padding: '20px 24px 24px 24px' }} onSubmit={handleSubmit}>
          <p style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.6, marginTop: 0 }}>
            Selecione o mês desejado. A planilha em Excel trará todos os colaboradores do lote
            (filial, categoria, situação, salário, função e demais campos), excluindo os marcados
            como desconsiderados.
          </p>

          <div className="login-group" style={{ marginBottom: '14px' }}>
            <label htmlFor="rh-ind-export-mes">Mês de referência</label>
            <select
              id="rh-ind-export-mes"
              required
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              disabled={isExporting}
            >
              <option value="" disabled>Selecione um mês...</option>
              {lotesOrdenados.map((lote) => (
                <option key={loteReferencia(lote)} value={loteReferencia(lote)}>
                  {lote.label || loteLabel(lote)}
                </option>
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
              disabled={isExporting || lotesOrdenados.length === 0}
              style={{ fontSize: '12.5px', height: '36px' }}
            >
              {isExporting ? 'Exportando...' : 'Baixar planilha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RHMovimentacaoExportModal;
