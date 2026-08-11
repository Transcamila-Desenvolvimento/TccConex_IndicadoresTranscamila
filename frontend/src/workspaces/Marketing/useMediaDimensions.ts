import { useEffect, useState } from 'react';

export type MediaDimensions = { width: number; height: number };

export function useMediaDimensions(
  url: string,
  mediaType: 'image' | 'video' | 'none',
): MediaDimensions | null {
  const [dims, setDims] = useState<MediaDimensions | null>(null);

  useEffect(() => {
    if (!url || mediaType === 'none') {
      setDims(null);
      return undefined;
    }

    if (mediaType === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      const onMeta = () => {
        if (video.videoWidth && video.videoHeight) {
          setDims({ width: video.videoWidth, height: video.videoHeight });
        }
      };
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('error', () => setDims(null));
      video.src = url;
      return () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.src = '';
      };
    }

    const img = new Image();
    const onLoad = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setDims({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.addEventListener('load', onLoad);
    img.addEventListener('error', () => setDims(null));
    img.src = url;
    return () => {
      img.removeEventListener('load', onLoad);
      img.src = '';
    };
  }, [url, mediaType]);

  return dims;
}

/** Largura ÷ altura do frame alvo (ex.: 1 = quadrado, 0.8 = 4:5, 0.5625 = 9:16). */
export function frameAspectRatio(
  format: 'feed' | 'carousel' | 'reels' | 'story',
  feedAspect: 'square' | 'portrait',
): number {
  if (format === 'reels' || format === 'story') return 9 / 16;
  return feedAspect === 'portrait' ? 4 / 5 : 1;
}

/** Contain quando a mídia é mais larga que o frame; cover quando mais alta (crop nas bordas). */
export function resolveMediaFit(
  dims: MediaDimensions | null,
  targetRatio: number,
  mediaType: 'image' | 'video' | 'none' = 'image',
): 'contain' | 'cover' {
  if (!dims?.width || !dims?.height) {
    return mediaType === 'video' ? 'contain' : 'cover';
  }
  const mediaRatio = dims.width / dims.height;
  return mediaRatio > targetRatio * 1.02 ? 'contain' : 'cover';
}

/** @deprecated use resolveMediaFit */
export function shouldLetterbox(
  dims: MediaDimensions | null,
  targetRatio: number,
): boolean {
  return resolveMediaFit(dims, targetRatio, 'video') === 'contain';
}

export function inferPreviewMediaType(
  mediaUrl: string,
  mediaFile: File | null | undefined,
  storedType: 'image' | 'video' | 'none' | undefined,
): 'image' | 'video' | 'none' {
  if (mediaFile) {
    const name = mediaFile.name.toLowerCase();
    if (mediaFile.type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.webm')) {
      return 'video';
    }
    return 'image';
  }
  if (storedType && storedType !== 'none') return storedType;
  if (!mediaUrl) return 'none';
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaUrl)) return 'video';
  return 'image';
}

export function frameAspectLabel(
  format: 'feed' | 'carousel' | 'reels' | 'story',
  feedAspect: 'square' | 'portrait',
): string {
  if (format === 'reels') return '9:16';
  if (format === 'story') return '9:16';
  return feedAspect === 'portrait' ? '4:5' : '1:1';
}
