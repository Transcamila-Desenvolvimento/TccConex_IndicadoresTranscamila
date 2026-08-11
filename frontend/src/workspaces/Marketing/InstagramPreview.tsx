import React, { useCallback, useEffect, useState } from 'react';
import type { InstagramFeedAspect, InstagramPostFormat } from '../../types/domain';
import {
  frameAspectLabel,
  frameAspectRatio,
  resolveMediaFit,
  useMediaDimensions,
  type MediaDimensions,
} from './useMediaDimensions';

type PreviewMediaProps = {
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'none';
  format: InstagramPostFormat;
  feedAspect: InstagramFeedAspect;
  emptyLabel: string;
};

export const PreviewMedia: React.FC<PreviewMediaProps> = ({
  mediaUrl,
  mediaType,
  format,
  feedAspect,
  emptyLabel,
}) => {
  const hookDims = useMediaDimensions(mediaUrl, mediaType);
  const [elementDims, setElementDims] = useState<MediaDimensions | null>(null);

  useEffect(() => {
    setElementDims(null);
  }, [mediaUrl, mediaType]);

  const dims = hookDims ?? elementDims;

  const targetRatio = frameAspectRatio(format, feedAspect);
  const fit = resolveMediaFit(dims, targetRatio, mediaType);
  const isFeedVideo = format === 'feed' && mediaType === 'video';

  const syncDims = useCallback((width: number, height: number) => {
    if (width > 0 && height > 0) {
      setElementDims({ width, height });
    }
  }, []);

  const frameClass = [
    'marketing-ig-preview-frame',
    (format === 'feed' || format === 'carousel') && feedAspect === 'portrait' ? 'is-feed-portrait' : '',
    (format === 'feed' || format === 'carousel') && feedAspect === 'square' ? 'is-feed-square' : '',
    format === 'reels' ? 'is-reels' : '',
    format === 'story' ? 'is-story' : '',
    mediaType === 'video' ? 'is-video' : '',
    isFeedVideo ? 'is-feed-video' : '',
  ].filter(Boolean).join(' ');

  const mediaClass = [
    'marketing-ig-preview-asset',
    fit === 'contain' ? 'is-contain' : 'is-cover',
  ].join(' ');

  return (
    <div className={frameClass}>
      {mediaUrl ? (
        <>
          {mediaType === 'video' ? (
            <video
              className={mediaClass}
              src={mediaUrl}
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                syncDims(video.videoWidth, video.videoHeight);
              }}
            />
          ) : (
            <img
              className={mediaClass}
              src={mediaUrl}
              alt=""
              onLoad={(event) => {
                const img = event.currentTarget;
                syncDims(img.naturalWidth, img.naturalHeight);
              }}
            />
          )}
          {isFeedVideo && (
            <div className="marketing-ig-preview-video-chrome" aria-hidden="true">
              <span className="marketing-ig-preview-video-play">
                <i className="bi bi-play-fill" />
              </span>
              <span className="marketing-ig-preview-video-muted">
                <i className="bi bi-volume-mute-fill" />
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="marketing-ig-preview-empty">
          <i className={`bi ${mediaType === 'video' ? 'bi-camera-reels' : 'bi-image'}`} aria-hidden="true" />
          <span>{emptyLabel}</span>
          <small>{frameAspectLabel(format, feedAspect)}</small>
        </div>
      )}
    </div>
  );
};

type InstagramPreviewProps = {
  format: InstagramPostFormat;
  feedAspect: InstagramFeedAspect;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'none';
  slideUrls?: string[];
  slideIndex?: number;
  onSlideIndexChange?: (index: number) => void;
  caption: string;
  hashtags: string;
  username?: string;
};

const buildPreviewCaption = (caption: string, hashtags: string) => {
  const c = caption.trim();
  const h = hashtags.trim();
  if (c && h) return `${c}\n\n${h}`;
  return c || h || '';
};

const InstagramPreview: React.FC<InstagramPreviewProps> = ({
  format,
  feedAspect,
  mediaUrl,
  mediaType,
  slideUrls = [],
  slideIndex = 0,
  onSlideIndexChange,
  caption,
  hashtags,
  username,
}) => {
  const text = buildPreviewCaption(caption, hashtags);
  const account = username || 'sua_conta';
  const carouselUrls = slideUrls.length > 0 ? slideUrls : (mediaUrl ? [mediaUrl] : []);
  const activeCarouselUrl = carouselUrls[slideIndex] ?? '';

  if (format === 'carousel') {
    return (
      <div className="marketing-ig-phone is-feed">
        <div className="marketing-ig-preview is-feed is-carousel">
          <div className="marketing-ig-preview-header">
            <div className="marketing-ig-preview-avatar" />
            <span>{account}</span>
          </div>
          <PreviewMedia
            mediaUrl={activeCarouselUrl}
            mediaType="image"
            format="carousel"
            feedAspect={feedAspect}
            emptyLabel="Carrossel"
          />
          {carouselUrls.length > 1 && (
            <div className="marketing-ig-carousel-dots">
              {carouselUrls.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`marketing-ig-carousel-dot${idx === slideIndex ? ' is-active' : ''}`}
                  aria-label={`Slide ${idx + 1}`}
                  onClick={() => onSlideIndexChange?.(idx)}
                />
              ))}
            </div>
          )}
          <p className="marketing-ig-preview-caption">
            {text || 'Sua legenda aparecerá aqui...'}
            {carouselUrls.length > 0 && (
              <span className="marketing-ig-carousel-count"> · {carouselUrls.length} fotos</span>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (format === 'story') {
    return (
      <div className="marketing-ig-phone is-vertical">
        <div className="marketing-ig-preview is-story">
          <div className="marketing-ig-preview-story-bar"><span /></div>
          <PreviewMedia
            mediaUrl={mediaUrl}
            mediaType={mediaType}
            format="story"
            feedAspect={feedAspect}
            emptyLabel="Story"
          />
          {text && <p className="marketing-ig-preview-story-text">{text}</p>}
          <span className="marketing-ig-preview-story-user">@{account}</span>
        </div>
      </div>
    );
  }

  if (format === 'reels') {
    return (
      <div className="marketing-ig-phone is-vertical">
        <div className="marketing-ig-preview is-reels">
          <PreviewMedia
            mediaUrl={mediaUrl}
            mediaType={mediaType}
            format="reels"
            feedAspect={feedAspect}
            emptyLabel="Reels"
          />
          <div className="marketing-ig-preview-reels-meta">
            <strong>@{account}</strong>
            {text && <p>{text}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-ig-phone is-feed">
      <div className="marketing-ig-preview is-feed">
        <div className="marketing-ig-preview-header">
          <div className="marketing-ig-preview-avatar" />
          <span>{account}</span>
        </div>
        <PreviewMedia
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          format="feed"
          feedAspect={feedAspect}
          emptyLabel="Feed"
        />
        <p className="marketing-ig-preview-caption">
          {text || 'Sua legenda aparecerá aqui...'}
        </p>
      </div>
    </div>
  );
};

export default InstagramPreview;
