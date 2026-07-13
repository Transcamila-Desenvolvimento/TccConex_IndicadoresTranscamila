import React, { useState } from 'react';
import {
  getFaturamentoErrorMessage,
  useExportarModeloProtocolos,
  useImportProtocolosSpreadsheet,
  useProtocoloClientes,
} from '../../../hooks/useFaturamentoProtocolos';
import type { ProtocoloImportResult } from '../../../types/domain';

interface ImportarProtocolosModalProps {
  onClose: () => void;
}

const ImportarProtocolosModal: React.FC<ImportarProtocolosModalProps> = ({ onClose }) => {
  const clientesQuery = useProtocoloClientes();
  const importMutation = useImportProtocolosSpreadsheet();
  const exportarModelo = useExportarModeloProtocolos();

  const [clienteId, setClienteId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [skipDuplicatas, setSkipDuplicatas] = useState(false);
  const [progress, setProgress] = useState(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ProtocoloImportResult | null>(null);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDownloadModelo = async () => {
    try {
      setErrorMsg(null);
      const blob = await exportarModelo.mutateAsync();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modelo_importacao_protocolos.xlsx';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      setErrorMsg(
        getFaturamentoErrorMessage(err) ||
          'Não foi possível baixar a planilha de referência.',
      );
    }
  };

  const canImport = Boolean(clienteId && selectedFile) && progress === -1;

  const handleStartImport = () => {
    if (!clienteId || !selectedFile) return;
    setErrorMsg(null);
    setResult(null);
    setProgress(0);

    const fakeInterval = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 6 : p));
    }, 150);

    importMutation
      .mutateAsync({
        file: selectedFile,
        clienteId,
        dryRun,
        skipDuplicatas,
      })
      .then((res) => {
        clearInterval(fakeInterval);
        if (typeof res?.created !== 'number') {
          setProgress(-1);
          setErrorMsg(res?.detail || 'Não foi possível importar a planilha.');
          return;
        }
        setProgress(100);
        setResult(res);
        if (!res.success && res.detail) {
          setErrorMsg(res.detail);
        }
      })
      .catch((err: unknown) => {
        clearInterval(fakeInterval);
        setProgress(-1);
        const axiosData = (err as { response?: { data?: ProtocoloImportResult & { detail?: string } } })
          ?.response?.data;
        if (axiosData && typeof axiosData === 'object' && 'created' in axiosData) {
          setProgress(100);
          setResult(axiosData);
          setErrorMsg(axiosData.detail || 'A importação não foi concluída.');
          return;
        }
        setErrorMsg(
          getFaturamentoErrorMessage(err) ||
            'Não foi possível importar a planilha. Verifique o formato (.xlsx) e as colunas.',
        );
      });
  };

  const done = result !== null;
  const success = Boolean(result?.success);

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && progress === -1) onClose();
      }}
    >
      <div className="search-modal-card" style={{ width: '520px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div
          className="search-input-wrapper"
          style={{
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            Importar protocolos (planilha)
          </h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>
            Fechar (X)
          </span>
        </div>

        {progress === -1 && (
          <>
            <p style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.6, marginTop: 0 }}>
              Importe protocolos a partir de um arquivo <strong>.xlsx</strong>. Colunas detectadas
              automaticamente: <strong>Data</strong>, <strong>Nota fiscal</strong>; opcionais:{' '}
              <strong>Expedição</strong>, <strong>Filial</strong>, e{' '}
              <strong>Ano</strong> + <strong>Número protocolo</strong> (agrupa NFs no mesmo protocolo).
              Expedição e filial não são obrigatórias na importação — se o cliente exigir e a
              coluna faltar, o sistema grava mesmo assim e gera avisos.
            </p>

            <button
              type="button"
              onClick={handleDownloadModelo}
              disabled={exportarModelo.isPending}
              style={{
                background: 'none',
                border: 'none',
                color: '#118CC4',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: exportarModelo.isPending ? 'wait' : 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '16px',
                opacity: exportarModelo.isPending ? 0.6 : 1,
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 12m0 0l4.5-4.5M12 12V3"
                />
              </svg>
              {exportarModelo.isPending
                ? 'Gerando planilha...'
                : 'Baixar planilha de referência'}
            </button>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Cliente
            </label>
            <div className="reports-select-wrapper" style={{ marginBottom: 16 }}>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                style={{ width: '100%', height: 36 }}
              >
                <option value="">Selecione o cliente...</option>
                {(clientesQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '28px 20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('protocolos-import-file-picker')?.click()}
            >
              <svg
                width="36"
                height="36"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                style={{ color: '#94a3b8', marginBottom: '12px' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                />
              </svg>
              <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 500, color: '#475569' }}>
                Arraste a planilha (.xlsx) aqui
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                ou clique para selecionar o arquivo
              </p>
              <input
                type="file"
                id="protocolos-import-file-picker"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {selectedFile && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Remover
                </button>
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                Simular importação (dry-run) — não grava no banco
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={skipDuplicatas}
                  onChange={(e) => setSkipDuplicatas(e.target.checked)}
                />
                Ignorar duplicatas (NFs ou nº de protocolo já existentes)
              </label>
            </div>

            {errorMsg && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '12.5px',
                }}
              >
                {errorMsg}
              </div>
            )}
          </>
        )}

        {progress >= 0 && (
          <div style={{ marginTop: '4px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#475569',
                fontWeight: 500,
                marginBottom: '6px',
              }}
            >
              <span>{done ? (success ? 'Importação concluída' : 'Importação com problemas') : 'Processando planilha...'}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: done ? (success ? '#10b981' : '#f59e0b') : '#118CC4',
                  borderRadius: '4px',
                  transition: 'width 0.15s linear',
                }}
              />
            </div>

            {result && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  backgroundColor: success ? '#f0fdf4' : '#fffbeb',
                  borderRadius: 6,
                  border: `1px solid ${success ? '#bbf7d0' : '#fde68a'}`,
                  fontSize: 12.5,
                  color: success ? '#166534' : '#92400e',
                }}
              >
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {result.dryRun ? 'Simulação: ' : ''}
                  {result.created} protocolo(s) {result.dryRun ? 'seriam criados' : 'criados'}
                  {result.ignored > 0 ? `, ${result.ignored} ignorado(s)` : ''}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 11.5, opacity: 0.9 }}>
                  Cliente: {result.clienteNome}
                  {result.groupingMode === 'grouped' ? ' · modo agrupado' : ' · modo linha a linha'}
                </p>

                {result.warnings.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <strong style={{ fontSize: 11.5 }}>Avisos ({result.warnings.length})</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 11.5, maxHeight: 100, overflowY: 'auto' }}>
                      {result.warnings.slice(0, 20).map((w, i) => (
                        <li key={`${w.label}-${i}`}>
                          {w.label}: {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.errors.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <strong style={{ fontSize: 11.5, color: '#b91c1c' }}>Erros ({result.errors.length})</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 11.5, color: '#b91c1c', maxHeight: 120, overflowY: 'auto' }}>
                      {result.errors.slice(0, 30).map((e, i) => (
                        <li key={`${e.label}-${i}`}>
                          {e.label}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {errorMsg && !result && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '12.5px',
                }}
              >
                {errorMsg}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '24px',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '16px',
          }}
        >
          <button
            type="button"
            className="reports-action-btn secondary"
            onClick={onClose}
            style={{ fontSize: '12.5px', height: '36px', borderColor: '#cbd5e1' }}
          >
            {done ? 'Concluir' : 'Cancelar'}
          </button>
          {!done && progress === -1 && (
            <button
              type="button"
              className="reports-action-btn primary"
              disabled={!canImport}
              onClick={handleStartImport}
              style={{
                fontSize: '12.5px',
                height: '36px',
                backgroundColor: '#118CC4',
                borderColor: '#118CC4',
                opacity: canImport ? 1 : 0.5,
                cursor: canImport ? 'pointer' : 'not-allowed',
              }}
            >
              Importar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportarProtocolosModal;
