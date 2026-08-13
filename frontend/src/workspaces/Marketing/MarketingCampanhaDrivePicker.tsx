import React, { useEffect, useMemo, useState } from 'react';
import GoogleDriveThumbnail from '../../components/GoogleDriveThumbnail';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useGoogleAccount } from '../../hooks/useGoogleAccount';
import { useGoogleDriveBrowse, useGoogleDriveStatus } from '../../hooks/useGoogleDrive';
import { useAddCampanhaMidia } from '../../hooks/useMarketingCampanhas';
import type { GoogleDriveBreadcrumb, GoogleDriveDefaultFolder, GoogleDriveItem } from '../../types/domain';
import {
  breadcrumbsMatch,
  clearGoogleDriveDefaultFolder,
  getGoogleDriveDefaultFolder,
  setGoogleDriveDefaultFolder,
} from '../../utils/googleDriveDefaultFolder';

export const GOOGLE_DRIVE_HOME_ID = '__home__';

type Breadcrumb = GoogleDriveBreadcrumb;

type MarketingCampanhaDrivePickerProps = {
  campanhaId: string;
  linkedDriveFileIds: string[];
  open: boolean;
  onClose: () => void;
  onAttached?: () => void;
};

function kindLabel(kind: GoogleDriveItem['kind']): string {
  if (kind === 'video') return 'Vídeo';
  if (kind === 'pdf') return 'PDF';
  if (kind === 'image') return 'Imagem';
  return 'Arquivo';
}

const MarketingCampanhaDrivePicker: React.FC<MarketingCampanhaDrivePickerProps> = ({
  campanhaId,
  linkedDriveFileIds,
  open,
  onClose,
  onAttached,
}) => {
  const { user } = useAuth();
  const { linkGoogle, isLinking } = useGoogleAccount();
  const statusQuery = useGoogleDriveStatus(open);
  const canBrowse = Boolean(statusQuery.data && !statusQuery.data.needsGoogleLink);

  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { id: GOOGLE_DRIVE_HOME_ID, name: 'Google Drive' },
  ]);
  const [search, setSearch] = useState('');
  const [savedDefault, setSavedDefault] = useState<GoogleDriveDefaultFolder | null>(null);
  const [defaultFeedback, setDefaultFeedback] = useState<string | null>(null);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1]?.id ?? GOOGLE_DRIVE_HOME_ID;
  const currentDriveId = breadcrumbs[breadcrumbs.length - 1]?.driveId ?? null;
  const browseQuery = useGoogleDriveBrowse(currentFolder, open && canBrowse, currentDriveId);
  const linkMidia = useAddCampanhaMidia(campanhaId);

  const isDefaultFolder = Boolean(
    savedDefault && breadcrumbsMatch(breadcrumbs, savedDefault.breadcrumbs),
  );

  useEffect(() => {
    if (!open) return;

    const initial = user?.id
      ? getGoogleDriveDefaultFolder(user.id)
      : null;

    setSavedDefault(initial);
    setBreadcrumbs(initial?.breadcrumbs ?? [{ id: GOOGLE_DRIVE_HOME_ID, name: 'Google Drive' }]);
    setSearch('');
    setDefaultFeedback(null);
  }, [open, user?.id]);

  const linkedSet = useMemo(() => new Set(linkedDriveFileIds), [linkedDriveFileIds]);

  const allItems = useMemo(
    () => browseQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [browseQuery.data],
  );

  const term = search.trim().toLowerCase();

  const folders = useMemo(
    () => allItems.filter((item) => {
      if (item.kind !== 'folder') return false;
      return !term || item.name.toLowerCase().includes(term);
    }),
    [allItems, term],
  );

  const files = useMemo(
    () => allItems.filter((item) => {
      if (item.kind === 'folder' || !item.attachable) return false;
      return !term || item.name.toLowerCase().includes(term);
    }),
    [allItems, term],
  );

  if (!open) return null;

  const enterFolder = (item: GoogleDriveItem) => {
    setSearch('');
    setBreadcrumbs((prev) => [
      ...prev,
      {
        id: item.id,
        name: item.name,
        driveId: item.driveId ?? prev[prev.length - 1]?.driveId ?? null,
      },
    ]);
  };

  const goToCrumb = (index: number) => {
    setSearch('');
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setDefaultFeedback(null);
  };

  const saveAsDefault = () => {
    if (!user?.id || currentFolder === GOOGLE_DRIVE_HOME_ID) return;

    const value: GoogleDriveDefaultFolder = {
      folderId: currentFolder,
      driveId: currentDriveId,
      breadcrumbs: [...breadcrumbs],
    };

    setGoogleDriveDefaultFolder(user.id, value);
    setSavedDefault(value);
    setDefaultFeedback('Esta pasta será aberta por padrão da próxima vez.');
  };

  const removeDefault = () => {
    if (!user?.id) return;
    clearGoogleDriveDefaultFolder(user.id);
    setSavedDefault(null);
    setDefaultFeedback('Pasta padrão removida.');
  };

  const attachFile = (item: GoogleDriveItem) => {
    if (!item.attachable || linkedSet.has(item.id) || linkMidia.isPending) return;
    linkMidia.mutate(item.id, {
      onSuccess: () => {
        onAttached?.();
        onClose();
      },
    });
  };

  return (
    <div className="mkt-drive-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="mkt-campanha-drive-picker erp-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mkt-campanha-drive-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mkt-drive-modal-header">
          <div>
            <h2 id="mkt-campanha-drive-picker-title" className="mkt-drive-modal-title">
              Anexar do Google Drive
            </h2>
            <p className="mkt-drive-modal-hint">
              Navegue pelo Meu Drive, compartilhados e drives de equipe. Defina uma pasta padrão para abrir sempre nela.
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
              <p>
                Vincule sua conta Google no perfil para navegar nos seus arquivos.
                Se já vinculou antes, desvincule e vincule de novo para autorizar o Drive.
              </p>
              <button
                type="button"
                className="reports-action-btn primary"
                disabled={isLinking}
                onClick={() => linkGoogle()}
              >
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
                          onClick={() => goToCrumb(index)}
                          disabled={index === breadcrumbs.length - 1}
                        >
                          {crumb.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </nav>
                </div>

                <div className="mkt-drive-toolbar">
                  {currentFolder !== GOOGLE_DRIVE_HOME_ID && (
                    <div className="mkt-drive-toolbar-buttons">
                      {isDefaultFolder ? (
                        <button
                          type="button"
                          className="mkt-drive-default-btn is-active"
                          onClick={removeDefault}
                          title="Remover pasta padrão"
                        >
                          <i className="bi bi-star-fill" aria-hidden="true" />
                          Pasta padrão
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mkt-drive-default-btn"
                          onClick={saveAsDefault}
                          title="Sempre abrir nesta pasta"
                        >
                          <i className="bi bi-star" aria-hidden="true" />
                          Padrão
                        </button>
                      )}
                    </div>
                  )}
                  <label className="mkt-drive-search">
                    <i className="bi bi-search" aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filtrar nesta pasta..."
                      aria-label="Filtrar arquivos"
                    />
                  </label>
                </div>
              </div>

              {defaultFeedback && (
                <p className="mkt-drive-default-feedback" role="status">{defaultFeedback}</p>
              )}

              <QueryDataPanel
                query={browseQuery}
                variant="compact"
                loadingMessage="Carregando arquivos..."
                errorMessage="Não foi possível listar os arquivos do Drive."
              >
                <div className="mkt-drive-browser">
                  {folders.length === 0 && files.length === 0 && !browseQuery.isLoading && (
                    <p className="mkt-drive-browser-empty">
                      {term ? 'Nenhum resultado para este filtro.' : 'Nenhuma pasta ou arquivo compatível nesta pasta.'}
                    </p>
                  )}

                  {folders.length > 0 && (
                    <section className="mkt-drive-browser-section">
                      <h3 className="mkt-drive-browser-section-title">
                        {currentFolder === GOOGLE_DRIVE_HOME_ID ? 'Locais' : 'Pastas'}
                      </h3>
                      <ul className="mkt-drive-browser-list">
                        {folders.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              className="mkt-drive-browser-row is-folder"
                              onClick={() => enterFolder(item)}
                            >
                              <GoogleDriveThumbnail fileId={item.id} kind="folder" />
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
                        {files.map((item) => {
                          const linked = linkedSet.has(item.id);
                          const attachingId = linkMidia.isPending ? linkMidia.variables : undefined;
                          const isAttaching = attachingId === item.id;
                          const attachDisabled = linkMidia.isPending;
                          return (
                            <li key={item.id}>
                              <div className={`mkt-drive-browser-row is-file ${linked ? 'is-linked' : ''}`}>
                                <GoogleDriveThumbnail fileId={item.id} kind={item.kind} />
                                <div className="mkt-drive-browser-meta">
                                  <span className="mkt-drive-browser-name">{item.name}</span>
                                  <span className="mkt-drive-browser-kind">{kindLabel(item.kind)}</span>
                                </div>
                                {linked ? (
                                  <span className="mkt-drive-browser-badge">Anexado</span>
                                ) : (
                                  <button
                                    type="button"
                                    className={`reports-action-btn secondary mkt-drive-browser-attach ${isAttaching ? 'is-loading' : ''}`}
                                    disabled={attachDisabled}
                                    aria-busy={isAttaching}
                                    onClick={() => attachFile(item)}
                                  >
                                    {isAttaching ? (
                                      <>
                                        <span className="spinner" aria-hidden="true" />
                                        Anexando...
                                      </>
                                    ) : (
                                      'Anexar'
                                    )}
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
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

export default MarketingCampanhaDrivePicker;
