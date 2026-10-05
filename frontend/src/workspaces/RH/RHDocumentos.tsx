import React, { useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getRHErrorMessage,
  useCreateDocumentoRH,
  useDeleteDocumentoRH,
  useDocumentosRH,
  useDownloadDocumentoRH,
  useRenomearDocumentoRH,
  useSubstituirDocumentoRH,
} from '../../hooks/useRH';
import type { DocumentoRH, GoogleDriveItem } from '../../types/domain';
import RHDrivePicker from './RHDrivePicker';

const PAGE_SIZE = 10;

function PaginationBar({ page, totalPages, totalItems, onChange }: { page: number; totalPages: number; totalItems: number; onChange: (page: number) => void }) {
  return (
    <div className="erp-pagination-bar">
      <span style={{ fontWeight: 500, marginRight: '4px' }}>
        {totalItems} registro(s) — Página <span className="erp-pagination-current">{Math.min(page, totalPages)}</span> de <span className="erp-pagination-current">{totalPages}</span>
      </span>
      <button
        type="button"
        className="reports-action-btn secondary"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px', opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
      >
        Anterior
      </button>
      <button
        type="button"
        className="reports-action-btn secondary"
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px', opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
      >
        Próximo
      </button>
    </div>
  );
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentoModal({
  modo,
  documento,
  pending,
  onClose,
  onSubmit,
}: {
  modo: 'novo' | 'substituir' | 'renomear';
  documento: DocumentoRH | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (titulo: string, driveFileId: string | null) => void;
}) {
  const [titulo, setTitulo] = useState(documento?.titulo ?? '');
  const [drive, setDrive] = useState<GoogleDriveItem | null>(null);
  const [erro, setErro] = useState('');
  const [picker, setPicker] = useState(false);
  const soTitulo = modo === 'renomear';

  const enviar = (event: React.FormEvent) => {
    event.preventDefault();
    const nome = titulo.trim();
    if (!nome || pending) return;
    if (!soTitulo && !drive) return;
    setErro('');
    onSubmit(nome, drive?.id ?? null);
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}
    >
      <form className="search-modal-card" style={{ width: '480px', padding: '24px' }} onSubmit={enviar}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            {modo === 'renomear' ? 'Renomear documento' : modo === 'substituir' ? 'Substituir arquivo' : 'Incluir documento'}
          </h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <div className="login-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="rh-doc-titulo">Título</label>
          <input
            id="rh-doc-titulo"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder="Título do documento"
          />
        </div>

        {documento && modo === 'substituir' && (
          <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#64748b' }}>
            Arquivo atual: <strong style={{ color: '#334155' }}>{documento.nomeArquivo}</strong>
          </p>
        )}

        {!soTitulo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="reports-action-btn secondary" onClick={() => setPicker(true)}>
              Google Drive
            </button>
            <span style={{ fontSize: '13px', color: drive ? '#334155' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {drive ? drive.name : 'Nenhum arquivo escolhido'}
            </span>
          </div>
        )}

        {erro && (
          <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button
            type="submit"
            className="reports-action-btn primary"
            disabled={!titulo.trim() || (!soTitulo && !drive) || pending}
          >
            {pending ? 'Salvando...' : modo === 'renomear' ? 'Renomear' : modo === 'substituir' ? 'Substituir' : 'Incluir'}
          </button>
        </div>
      </form>
      <RHDrivePicker
        open={picker}
        onClose={() => setPicker(false)}
        onSelect={(item) => {
          setDrive(item);
          setTitulo((atual) => atual.trim() ? atual : item.name.replace(/\.[^.]+$/, ''));
          setPicker(false);
        }}
      />
    </div>
  );
}

const RHDocumentos: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<
    | { modo: 'novo' }
    | { modo: 'substituir' | 'renomear'; documento: DocumentoRH }
    | null
  >(null);
  const [formError, setFormError] = useState('');

  const documentosQuery = useDocumentosRH({ page, search: search.trim() });
  const { canShowEmpty } = useAsyncQueryState(documentosQuery);
  const criar = useCreateDocumentoRH();
  const renomear = useRenomearDocumentoRH();
  const substituir = useSubstituirDocumentoRH();
  const excluir = useDeleteDocumentoRH();
  const baixar = useDownloadDocumentoRH();
  const documentos = documentosQuery.data?.results ?? [];
  const total = documentosQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const salvando = criar.isPending || renomear.isPending || substituir.isPending;

  const salvar = (titulo: string, driveFileId: string | null) => {
    setFormError('');
    const onError = (error: unknown) => setFormError(getRHErrorMessage(error, 'Não foi possível salvar o documento.'));
    if (modal?.modo === 'renomear') {
      renomear.mutate(
        { id: modal.documento.id, titulo },
        { onSuccess: () => setModal(null), onError },
      );
      return;
    }
    if (!driveFileId) return;
    if (modal?.modo === 'substituir') {
      substituir.mutate(
        { id: modal.documento.id, titulo, driveFileId },
        { onSuccess: () => setModal(null), onError },
      );
      return;
    }
    criar.mutate(
      { titulo, driveFileId },
      { onSuccess: () => { setModal(null); setPage(1); }, onError },
    );
  };

  const baixarArquivo = (id: string, nome: string) => {
    baixar.mutate(id, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nome;
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Documentos</h1>
        </div>
        <button type="button" className="reports-action-btn primary" onClick={() => { setFormError(''); setModal({ modo: 'novo' }); }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Incluir</span>
        </button>
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-search-wrapper">
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar título ou arquivo"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {formError && (
        <p style={{ margin: '0 0 10px', color: '#b91c1c', fontSize: '13px' }}>{formError}</p>
      )}

      <QueryDataPanel
        query={documentosQuery}
        loadingMessage="Carregando documentos..."
        errorMessage="Não foi possível carregar os documentos."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Arquivo</th>
                  <th>Tamanho</th>
                  <th>Incluído em</th>
                  <th>Por</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && documentos.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum documento incluído.
                    </td>
                  </tr>
                ) : documentos.map((documento) => (
                  <tr key={documento.id}>
                    <td><strong>{documento.titulo}</strong></td>
                    <td>{documento.nomeArquivo}</td>
                    <td>{formatBytes(documento.tamanho)}</td>
                    <td>{documento.criadoEm}</td>
                    <td>{documento.incluidoPor || '—'}</td>
                    <td>
                      <div className="rh-pj-modal__actions">
                        <button
                          type="button"
                          className="reports-action-btn-icon"
                          title={documento.linkExterno ? 'Abrir no Drive' : 'Baixar'}
                          onClick={() => {
                            if (documento.linkExterno) {
                              window.open(documento.linkExterno, '_blank', 'noopener');
                              return;
                            }
                            baixarArquivo(documento.id, documento.nomeArquivo);
                          }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="reports-action-btn-icon"
                          title="Renomear"
                          onClick={() => { setFormError(''); setModal({ modo: 'renomear', documento }); }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="reports-action-btn-icon"
                          title="Substituir arquivo"
                          onClick={() => { setFormError(''); setModal({ modo: 'substituir', documento }); }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="reports-action-btn-icon"
                          title="Excluir"
                          disabled={excluir.isPending}
                          onClick={() => {
                            if (window.confirm(`Excluir o documento "${documento.titulo}"?`)) {
                              excluir.mutate(documento.id);
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
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar page={page} totalPages={totalPages} totalItems={total} onChange={setPage} />
        </div>
      </QueryDataPanel>

      {modal && (
        <DocumentoModal
          modo={modal.modo === 'novo' ? 'novo' : modal.modo}
          documento={modal.modo === 'novo' ? null : modal.documento}
          pending={salvando}
          onClose={() => { if (!salvando) setModal(null); }}
          onSubmit={salvar}
        />
      )}
    </div>
  );
};

export default RHDocumentos;
