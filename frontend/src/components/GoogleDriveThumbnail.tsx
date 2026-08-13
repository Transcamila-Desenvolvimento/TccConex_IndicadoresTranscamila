import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import type { CampanhaMidiaKind } from '../types/domain';

type Props = {
  fileId: string;
  kind: CampanhaMidiaKind;
  className?: string;
};

function kindIcon(kind: CampanhaMidiaKind): string {
  if (kind === 'folder') return 'bi-folder2';
  if (kind === 'video') return 'bi-camera-video-fill';
  if (kind === 'pdf') return 'bi-file-earmark-pdf-fill';
  if (kind === 'image') return 'bi-image-fill';
  return 'bi-file-earmark-fill';
}

function kindTone(kind: CampanhaMidiaKind): string {
  if (kind === 'folder') return 'is-folder';
  if (kind === 'video') return 'is-video';
  if (kind === 'pdf') return 'is-pdf';
  if (kind === 'image') return 'is-image';
  return 'is-other';
}

const GoogleDriveThumbnail: React.FC<Props> = ({ fileId, kind, className = '' }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (kind === 'folder') return undefined;

    let cancelled = false;
    let objectUrl: string | null = null;
    setFailed(false);
    setSrc(null);

    apiService.fetchGoogleDriveThumbnail(fileId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, kind]);

  const tone = kindTone(kind);
  const icon = kindIcon(kind);

  if (kind === 'folder' || failed || !src) {
    return (
      <span className={`mkt-drive-thumb ${tone} is-fallback ${className}`.trim()} aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
    );
  }

  return (
    <span className={`mkt-drive-thumb ${tone} ${className}`.trim()}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
};

export default GoogleDriveThumbnail;
