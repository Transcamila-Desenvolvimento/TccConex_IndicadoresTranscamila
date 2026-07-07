import React, { useState } from 'react';
import { useImportarArquivoRH, getRHErrorMessage } from '../../../hooks/useRH';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface ImportarMovimentacaoModalProps {
  defaultMes: number;
  defaultAno: number;
  onClose: () => void;
}

const ImportarMovimentacaoModal: React.FC<ImportarMovimentacaoModalProps> = ({ defaultMes, defaultAno, onClose }) => {
  const importarArquivo = useImportarArquivoRH();
  const [mes, setMes] = useState(defaultMes);
  const [ano, setAno] = useState(defaultAno);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(-1);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

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

  const handleStartImport = () => {
    if (!selectedFile) return;
    setErrorMsg(null);
    setProgress(0);
    setSuccess(false);

    const fakeInterval = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 8 : p));
    }, 120);

    importarArquivo.mutateAsync({ mes, ano, file: selectedFile })
      .then((res) => {
        clearInterval(fakeInterval);
        setProgress(100);
        setSuccess(true);
        setResultMsg(
          `${res.imported} colaborador(es) importado(s)${res.pjs_injected ? ` + ${res.pjs_injected} PJ(s) injetado(s)` : ''} a partir da aba "${res.aba}".`,
        );
      })
      .catch((err: unknown) => {
        clearInterval(fakeInterval);
        setProgress(-1);
        setErrorMsg(getRHErrorMessage(err, 'Não foi possível importar o arquivo. Verifique o formato da planilha.'));
      });
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget && progress === -1) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '480px', padding: '24px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Importar Relação de Ativos</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        {progress === -1 && (
          <>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '16px' }}>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Mês Referência</label>
                <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Ano Referência</label>
                <input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                />
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '30px 20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('rh-import-file-picker')?.click()}
            >
              <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" style={{ color: '#94a3b8', marginBottom: '12px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 500, color: '#475569' }}>
                Arraste a planilha de ativos (.xlsx) aqui
              </p>
              <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                ou clique para navegar pelos arquivos do seu computador
              </p>
              <input
                type="file"
                id="rh-import-file-picker"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {selectedFile && (
              <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#64748b' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>{selectedFile.name}</span>
                </div>
                <button type="button" onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                  Remover
                </button>
              </div>
            )}

            {errorMsg && (
              <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
                {errorMsg}
              </div>
            )}
          </>
        )}

        {progress >= 0 && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', fontWeight: 500, marginBottom: '6px' }}>
              <span>{success ? 'Processamento Concluído!' : 'Processando movimentações...'}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', backgroundColor: success ? '#10b981' : '#118CC4', borderRadius: '4px', transition: 'width 0.15s linear' }} />
            </div>

            {success && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: '#10b981', flexShrink: 0, marginTop: '1px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: '#166534' }}>Sucesso!</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#15803d' }}>{resultMsg}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button type="button" className="reports-action-btn secondary" onClick={onClose} style={{ fontSize: '12.5px', height: '36px', borderColor: '#cbd5e1' }}>
            {success ? 'Concluir' : 'Cancelar'}
          </button>
          {!success && progress === -1 && (
            <button
              type="button"
              className="reports-action-btn primary"
              disabled={!selectedFile}
              onClick={handleStartImport}
              style={{
                fontSize: '12.5px',
                height: '36px',
                opacity: selectedFile ? 1 : 0.5,
                cursor: selectedFile ? 'pointer' : 'not-allowed',
              }}
            >
              Processar Movimentações
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportarMovimentacaoModal;
