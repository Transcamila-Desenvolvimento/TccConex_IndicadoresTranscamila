import React, { useEffect, useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useGoogleAccount } from '../../hooks/useGoogleAccount';
import {
  useMarketingDriveBank,
  useMarketingDriveBankConfig,
  useMarketingDriveBankThumbnail,
} from '../../hooks/useMarketingDriveBank';
import type { DriveBankFile, DriveBankFilterKind } from '../../types/domain';

function formatBytes(size: number | null): string {
  if (!size) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModified(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const DriveBankMediaCard: React.FC<{ file: DriveBankFile }> = ({ file }) => {
  const thumbQuery = useMarketingDriveBankThumbnail(
    file.hasThumbnail ? file.id : null,
    file.hasThumbnail,
  );

  useEffect(() => {
    const url = thumbQuery.data;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [thumbQuery.data]);

  const openFile = () => {
    if (file.webViewLink) window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
  };

  const copyLink = async () => {
    if (!file.webViewLink) return;
    try {
      await navigator.clipboard.writeText(file.webViewLink);
    } catch {
      window.prompt('Copie o link:', file.webViewLink);
    }
  };

  return (
    <article className="mkt-drive-card">
      <button type="button" className="mkt-drive-card-preview" onClick={openFile} title={file.name}>
        {thumbQuery.data ? (
          <img src={thumbQuery.data} alt="" loading="lazy" className="mkt-drive-card-img" />
        ) : (
          <div className="mkt-drive-card-placeholder">
            <i className={`bi ${file.kind === 'video' ? 'bi-play-circle' : 'bi-image'}`} aria-hidden="true" />
          </div>
        )}
        {file.kind === 'video' && (
          <span className="mkt-drive-card-badge">
            <i className="bi bi-camera-video" aria-hidden="true" /> Vídeo
          </span>
        )}
      </button>
      <div className="mkt-drive-card-body">
        <p className="mkt-drive-card-name" title={file.name}>{file.name}</p>
        <p className="mkt-drive-card-meta">{formatModified(file.modifiedTime)} · {formatBytes(file.size)}</p>
        <div className="mkt-drive-card-actions">
          <button type="button" className="reports-action-btn secondary" onClick={openFile}>Abrir</button>
          <button type="button" className="reports-action-btn secondary" onClick={copyLink}>Copiar link</button>
        </div>
      </div>
    </article>
  );
};

const MarketingDriveBank: React.FC = () => {
  const [kind, setKind] = useState<DriveBankFilterKind>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const configQuery = useMarketingDriveBankConfig();
  const { linkGoogle, isLinking } = useGoogleAccount();

  const canList = Boolean(
    configQuery.data?.configured && !configQuery.data?.needsGoogleLink,
  );

  const filesQuery = useMarketingDriveBank({ kind, search, enabled: canList });
  const files = useMemo(
    () => filesQuery.data?.pages.flatMap((page) => page.files) ?? [],
    [filesQuery.data],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const panelQuery = {
    isLoading: filesQuery.isLoading,
    isFetching: filesQuery.isFetching,
    isError: filesQuery.isError,
    data: files,
  };

  return (
    <section className="mkt-drive-bank-page">
      <header className="mkt-page-header">
        <div>
          <h1 className="view-page-title" style={{ marginBottom: '4px' }}>Banco de Mídias</h1>
          <p className="mkt-hub-subtitle">
            Fotos e vídeos da pasta compartilhada no Google Drive — leve, sem armazenar arquivos no ERP.
          </p>
        </div>
      </header>

      <QueryDataPanel
        query={configQuery}
        loadingMessage="Verificando banco de mídias..."
        errorMessage="Não foi possível verificar a configuração do Drive."
      >
        {!configQuery.data?.configured && (
          <div className="mkt-drive-empty erp-card">
            <p>O banco de mídias ainda não foi configurado no servidor.</p>
            <p className="mkt-drive-empty-hint">Solicite ao administrador a variável <code>MARKETING_DRIVE_FOLDER_ID</code> com o ID da pasta do Drive.</p>
          </div>
        )}

        {configQuery.data?.needsGoogleLink && (
          <div className="mkt-drive-empty erp-card">
            <p>Vincule sua conta Google corporativa para acessar a pasta de mídias.</p>
            <p className="mkt-drive-empty-hint">É necessário autorizar leitura do Google Drive (somente visualização).</p>
            <button type="button" className="reports-action-btn primary" onClick={() => linkGoogle()} disabled={isLinking}>
              {isLinking ? 'Redirecionando...' : 'Vincular conta Google'}
            </button>
          </div>
        )}

        {canList && (
          <>
            <div className="erp-card mkt-drive-toolbar">
              <form onSubmit={handleSearch} className="mkt-drive-search">
                <input
                  type="search"
                  placeholder="Buscar por nome do arquivo..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button type="submit" className="reports-action-btn secondary">Buscar</button>
              </form>
              <div className="fin-calendar-filter-bar" role="group" aria-label="Tipo de mídia">
                {(['all', 'image', 'video'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`fin-calendar-filter-btn ${kind === key ? 'is-active' : ''}`}
                    onClick={() => setKind(key)}
                  >
                    {key === 'all' ? 'Todos' : key === 'image' ? 'Fotos' : 'Vídeos'}
                  </button>
                ))}
              </div>
            </div>

            <QueryDataPanel
              query={panelQuery}
              loadingMessage="Carregando mídias..."
              refreshingMessage="Atualizando..."
              refreshVariant="overlay"
              errorMessage="Não foi possível carregar os arquivos do Drive."
            >
              {files.length === 0 && !filesQuery.isLoading ? (
                <div className="mkt-drive-empty erp-card">
                  <p>Nenhuma foto ou vídeo encontrado nesta pasta.</p>
                </div>
              ) : (
                <div className="mkt-drive-grid">
                  {files.map((file) => (
                    <DriveBankMediaCard key={file.id} file={file} />
                  ))}
                </div>
              )}

              {filesQuery.hasNextPage && (
                <div className="mkt-drive-load-more">
                  <button
                    type="button"
                    className="reports-action-btn secondary"
                    onClick={() => filesQuery.fetchNextPage()}
                    disabled={filesQuery.isFetchingNextPage}
                  >
                    {filesQuery.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
                  </button>
                </div>
              )}
            </QueryDataPanel>
          </>
        )}
      </QueryDataPanel>
    </section>
  );
};

export default MarketingDriveBank;
