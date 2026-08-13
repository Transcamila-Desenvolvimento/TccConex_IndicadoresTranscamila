import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import type { CampanhaMidia } from '../types/domain';

type Props = {
  midia: CampanhaMidia | null;
  open: boolean;
  onClose: () => void;
};

function kindLabel(kind: CampanhaMidia['kind']): string {
  if (kind === 'video') return 'Vídeo';
  if (kind === 'pdf') return 'PDF';
  if (kind === 'image') return 'Imagem';
  return 'Arquivo';
}

function usesThumbnailPlaceholder(kind: CampanhaMidia['kind']): boolean {
  return kind === 'image' || kind === 'video';
}

const GoogleDrivePreviewModal: React.FC<Props> = ({ midia, open, onClose }) => {
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !midia) {
      setFullSrc(null);
      setThumbSrc(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    const objectUrls: string[] = [];

    const trackUrl = (url: string) => {
      objectUrls.push(url);
      return url;
    };

    setError(null);
    setFullSrc(null);
    setThumbSrc(null);

    const loadPreview = async () => {
      try {
        if (usesThumbnailPlaceholder(midia.kind)) {
          void apiService.fetchGoogleDriveThumbnail(midia.driveFileId)
            .then((url) => {
              if (!cancelled) setThumbSrc(trackUrl(url));
            })
            .catch(() => undefined);
        }

        const url = await apiService.fetchGoogleDrivePreview(midia.driveFileId);
        if (!cancelled) setFullSrc(trackUrl(url));
      } catch {
        if (!cancelled) {
          setError('Não foi possível carregar a visualização deste arquivo.');
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [open, midia?.driveFileId, midia?.kind]);

  if (!open || !midia) return null;

  return (
    <div className="mkt-drive-preview-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`mkt-drive-preview-modal erp-card is-${midia.kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mkt-drive-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mkt-drive-preview-header">
          <div className="mkt-drive-preview-title-wrap">
            <span className="mkt-drive-preview-kind">{kindLabel(midia.kind)}</span>
            <h2 id="mkt-drive-preview-title" className="mkt-drive-preview-title">{midia.name}</h2>
          </div>
          <div className="mkt-drive-preview-header-actions">
            {midia.previewUrl && (
              <a
                href={midia.previewUrl}
                className="mkt-drive-preview-external"
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir no Google Drive"
              >
                <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                <span>Drive</span>
              </a>
            )}
            <button type="button" className="mkt-drive-preview-close" onClick={onClose} aria-label="Fechar">
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="mkt-drive-preview-body">
          {error && (
            <p className="mkt-drive-preview-status is-error" role="alert">{error}</p>
          )}

          {!error && (midia.kind === 'image' || midia.kind === 'video') && (
            <div className="mkt-drive-preview-stage">
              {thumbSrc && (
                <img
                  src={thumbSrc}
                  alt=""
                  aria-hidden="true"
                  className="mkt-drive-preview-placeholder"
                />
              )}

              {fullSrc && midia.kind === 'image' && (
                <img
                  src={fullSrc}
                  alt={midia.name}
                  className="mkt-drive-preview-media"
                />
              )}

              {fullSrc && midia.kind === 'video' && (
                <video
                  src={fullSrc}
                  poster={thumbSrc ?? undefined}
                  controls
                  className="mkt-drive-preview-media is-video"
                >
                  Seu navegador não suporta reprodução de vídeo.
                </video>
              )}
            </div>
          )}

          {!error && fullSrc && midia.kind === 'pdf' && (
            <iframe
              src={fullSrc}
              title={midia.name}
              className="mkt-drive-preview-pdf"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleDrivePreviewModal;
