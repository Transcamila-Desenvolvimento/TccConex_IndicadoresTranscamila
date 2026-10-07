import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useGoogleAccount } from '../../hooks/useGoogleAccount';
import { useRHDriveBrowse, useRHDriveStatus } from '../../hooks/useRH';
import type { GoogleDriveItem } from '../../types/domain';

const HOME_ID = '__home__';

type Crumb = { id: string; name: string; driveId?: string | null };

function kindLabel(kind: GoogleDriveItem['kind']): string {
  if (kind === 'pdf') return 'PDF';
  if (kind === 'image') return 'Imagem';
  return 'Arquivo';
}

const RHDrivePicker: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (item: GoogleDriveItem) => void;
  useStatus?: typeof useRHDriveStatus;
  useBrowse?: typeof useRHDriveBrowse;
}> = ({ open, onClose, onSelect, useStatus = useRHDriveStatus, useBrowse = useRHDriveBrowse }) => {
  const { linkGoogle, isLinking } = useGoogleAccount();
  const statusQuery = useStatus(open);
  const canBrowse = Boolean(statusQuery.data && !statusQuery.data.needsGoogleLink);
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([{ id: HOME_ID, name: 'Google Drive' }]);
  const [search, setSearch] = useState('');

  const current = breadcrumbs[breadcrumbs.length - 1];
  const browseQuery = useBrowse(current?.id ?? HOME_ID, open && canBrowse, current?.driveId);

  const items = useMemo(
    () => browseQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [browseQuery.data],
  );
  const term = search.trim().toLowerCase();
  const folders = items.filter((item) => item.kind === 'folder' && (!term || item.name.toLowerCase().includes(term)));
  const files = items.filter((item) => item.kind !== 'folder' && item.attachable && (!term || item.name.toLowerCase().includes(term)));

  if (!open) return null;

  const enterFolder = (item: GoogleDriveItem) => {
    setSearch('');
    setBreadcrumbs((prev) => [
      ...prev,
      { id: item.id, name: item.name, driveId: item.driveId ?? prev[prev.length - 1]?.driveId ?? null },
    ]);
  };

  return (
    <div className="mkt-drive-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="mkt-campanha-drive-picker erp-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-drive-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mkt-drive-modal-header">
          <div>
            <h2 id="rh-drive-picker-title" className="mkt-drive-modal-title">Escolher no Google Drive</h2>
            <p className="mkt-drive-modal-hint">
              O arquivo permanece no Drive. O servidor guarda só o texto usado na consulta do agente.
            </p>
          </div>
          <button type="button" className="mkt-drive-modal-close" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <QueryDataPanel
          query={statusQuery}
          variant="compact"
          loadingMessage="Verificando Google Drive..."
          errorMessage="Não foi possível verificar o Google Drive."
        >
          {statusQuery.data?.needsGoogleLink && (
            <div className="mkt-campanha-drive-picker-empty">
              <p>Vincule sua conta Google no perfil para escolher arquivos do Drive.</p>
              <button type="button" className="reports-action-btn primary" disabled={isLinking} onClick={() => linkGoogle()}>
                {isLinking ? 'Redirecionando...' : 'Vincular conta Google'}
              </button>
            </div>
          )}

          {canBrowse && (
            <>
              <div className="mkt-drive-nav">
                <div className="mkt-drive-path-bar">
                  <i className="bi bi-folder2-open mkt-drive-path-icon" aria-hidden="true" />
                  <nav className="mkt-drive-breadcrumbs" aria-label="Pastas">
                    {breadcrumbs.map((crumb, index) => (
                      <React.Fragment key={`${crumb.id}-${index}`}>
                        {index > 0 && <span className="mkt-drive-breadcrumb-sep" aria-hidden="true">/</span>}
                        <button
                          type="button"
                          className={`mkt-drive-breadcrumb ${index === breadcrumbs.length - 1 ? 'is-current' : ''}`}
                          onClick={() => {
                            setSearch('');
                            setBreadcrumbs((prev) => prev.slice(0, index + 1));
                          }}
                          disabled={index === breadcrumbs.length - 1}
                        >
                          {crumb.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </nav>
                </div>
                <div className="mkt-drive-toolbar">
                  <label className="mkt-drive-search">
                    <i className="bi bi-search" aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Filtrar nesta pasta..."
                      aria-label="Filtrar arquivos"
                    />
                  </label>
                </div>
              </div>

              <QueryDataPanel
                query={browseQuery}
                variant="compact"
                loadingMessage="Carregando arquivos..."
                errorMessage="Não foi possível listar os arquivos do Drive."
              >
                <div className="mkt-drive-browser">
                  {folders.length === 0 && files.length === 0 && !browseQuery.isLoading && (
                    <p className="mkt-drive-browser-empty">
                      {term ? 'Nenhum resultado para este filtro.' : 'Nenhum arquivo compatível nesta pasta.'}
                    </p>
                  )}
                  {folders.length > 0 && (
                    <section className="mkt-drive-browser-section">
                      <h3 className="mkt-drive-browser-section-title">
                        {current?.id === HOME_ID ? 'Locais' : 'Pastas'}
                      </h3>
                      <ul className="mkt-drive-browser-list">
                        {folders.map((item) => (
                          <li key={item.id}>
                            <button type="button" className="mkt-drive-browser-row is-folder" onClick={() => enterFolder(item)}>
                              <i className="bi bi-folder2" aria-hidden="true" />
                              <span className="mkt-drive-browser-name">{item.name}</span>
                              <i className="bi bi-chevron-right mkt-drive-browser-chevron" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {files.length > 0 && (
                    <section className="mkt-drive-browser-section">
                      <h3 className="mkt-drive-browser-section-title">Arquivos</h3>
                      <ul className="mkt-drive-browser-list">
                        {files.map((item) => (
                          <li key={item.id}>
                            <div className="mkt-drive-browser-row is-file">
                              <i className="bi bi-file-earmark-text" aria-hidden="true" />
                              <div className="mkt-drive-browser-meta">
                                <span className="mkt-drive-browser-name">{item.name}</span>
                                <span className="mkt-drive-browser-kind">{kindLabel(item.kind)}</span>
                              </div>
                              <button type="button" className="reports-action-btn secondary" onClick={() => onSelect(item)}>
                                Usar este
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
                {browseQuery.hasNextPage && (
                  <div className="mkt-drive-browser-more">
                    <button
                      type="button"
                      className="reports-action-btn secondary"
                      disabled={browseQuery.isFetchingNextPage}
                      onClick={() => browseQuery.fetchNextPage()}
                    >
                      {browseQuery.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
                    </button>
                  </div>
                )}
              </QueryDataPanel>
            </>
          )}
        </QueryDataPanel>
      </div>
    </div>
  );
};

export default RHDrivePicker;
