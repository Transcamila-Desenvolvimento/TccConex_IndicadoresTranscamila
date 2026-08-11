import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  InstagramConnection,
  InstagramFeedAspect,
  InstagramPost,
  InstagramPostFormat,
  InstagramPostPayload,
  InstagramPostStatus,
} from '../../types/domain';
import {
  INSTAGRAM_CAROUSEL_MAX_SLIDES,
  INSTAGRAM_CAROUSEL_MIN_SLIDES,
  INSTAGRAM_FEED_ASPECT_OPTIONS,
  INSTAGRAM_POST_FORMAT_OPTIONS,
  INSTAGRAM_POST_STATUS_OPTIONS,
} from '../../types/domain';
import type { InstagramCarouselSlide } from '../../types/domain';
import InstagramPreview from './InstagramPreview';
import { inferPreviewMediaType } from './useMediaDimensions';

const FORMAT_ICONS: Record<InstagramPostFormat, string> = {
  feed: 'bi-grid-3x3-gap',
  carousel: 'bi-images',
  reels: 'bi-camera-reels',
  story: 'bi-record-circle',
};

const toDatetimeLocal = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatConfig = (format: InstagramPostFormat) =>
  INSTAGRAM_POST_FORMAT_OPTIONS.find((o) => o.value === format) ?? INSTAGRAM_POST_FORMAT_OPTIONS[0];

const isVideoFile = (file: File) =>
  file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4');

export type CarouselOrderItem =
  | { kind: 'saved'; slideId: string }
  | { kind: 'pending'; file: File };

export type CarouselSubmitPayload = {
  order: CarouselOrderItem[];
  removeSlideIds: string[];
};

type CarouselItem =
  | { key: string; kind: 'saved'; slideId: string; previewUrl: string }
  | { key: string; kind: 'pending'; file: File; previewUrl: string };

const buildCarouselItemsFromPost = (slides: InstagramCarouselSlide[]): CarouselItem[] =>
  [...slides]
    .sort((a, b) => a.position - b.position)
    .map((slide) => ({
      key: slide.id,
      kind: 'saved' as const,
      slideId: slide.id,
      previewUrl: slide.mediaFileUrl || slide.mediaUrl || '',
    }));

export type MarketingInstagramPostModalProps = {
  open: boolean;
  editing: InstagramPost | null;
  connection?: InstagramConnection;
  saving: boolean;
  publishing: boolean;
  canPublish: boolean;
  onClose: () => void;
  onSubmit: (payload: InstagramPostPayload, mediaFile: File | null, carousel?: CarouselSubmitPayload) => void;
  onPublish?: (post: InstagramPost) => void;
};

const emptyForm = (): InstagramPostPayload => ({
  title: '',
  caption: '',
  hashtags: '',
  mediaUrl: '',
  postFormat: 'feed',
  feedAspect: 'square',
  status: 'draft',
  scheduledAt: null,
});

const MarketingInstagramPostModal: React.FC<MarketingInstagramPostModalProps> = ({
  open,
  editing,
  connection,
  saving,
  publishing,
  canPublish,
  onClose,
  onSubmit,
  onPublish,
}) => {
  const [form, setForm] = useState<InstagramPostPayload>(emptyForm());
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [removedSlideIds, setRemovedSlideIds] = useState<string[]>([]);
  const [carouselSlideIndex, setCarouselSlideIndex] = useState(0);
  const [dragCarouselIndex, setDragCarouselIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);

  const format = form.postFormat ?? 'feed';
  const config = formatConfig(format);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title,
        caption: editing.caption,
        hashtags: editing.hashtags,
        mediaUrl: editing.mediaUrl,
        postFormat: editing.postFormat ?? 'feed',
        feedAspect: editing.feedAspect ?? 'square',
        status: editing.status,
        scheduledAt: editing.scheduledAt,
      });
    } else {
      setForm(emptyForm());
    }
    setMediaFile(null);
    setCarouselItems((prev) => {
      prev.forEach((item) => {
        if (item.kind === 'pending') URL.revokeObjectURL(item.previewUrl);
      });
      return editing?.carouselSlides?.length
        ? buildCarouselItemsFromPost(editing.carouselSlides)
        : [];
    });
    setRemovedSlideIds([]);
    setCarouselSlideIndex(0);
    setDragCarouselIndex(null);
    setMediaError('');
    setShowAdvanced(false);
  }, [open, editing]);

  const totalCarouselCount = carouselItems.length;

  const carouselPreviewUrls = useMemo(
    () => carouselItems.map((item) => item.previewUrl).filter(Boolean),
    [carouselItems],
  );

  useEffect(() => {
    if (carouselSlideIndex >= carouselPreviewUrls.length) {
      setCarouselSlideIndex(Math.max(0, carouselPreviewUrls.length - 1));
    }
  }, [carouselPreviewUrls.length, carouselSlideIndex]);

  useEffect(() => {
    if (!mediaFile) {
      setLocalPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(mediaFile);
    setLocalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mediaFile]);

  const previewMediaUrl = localPreviewUrl || editing?.mediaFileUrl || form.mediaUrl || '';
  const previewMediaType = useMemo(
    () => inferPreviewMediaType(previewMediaUrl, mediaFile, editing?.mediaType),
    [previewMediaUrl, mediaFile, editing?.mediaType],
  );

  if (!open) return null;

  const selectFormat = (next: InstagramPostFormat) => {
    setForm((prev) => ({ ...prev, postFormat: next }));
    if (next === 'carousel') {
      setMediaFile(null);
    } else {
      setCarouselItems((prev) => {
        prev.forEach((item) => {
          if (item.kind === 'pending') URL.revokeObjectURL(item.previewUrl);
        });
        return [];
      });
      setRemovedSlideIds([]);
    }
    if (mediaFile) {
      const nextConfig = formatConfig(next);
      if (nextConfig.videoOnly && !isVideoFile(mediaFile)) {
        setMediaFile(null);
        setMediaError('Reels exige vídeo MP4.');
      } else {
        setMediaError('');
      }
    }
  };

  const handleCarouselFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const images = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name));
    if (!images.length) {
      setMediaError('Carrossel aceita apenas imagens JPG/PNG.');
      return;
    }
    const room = INSTAGRAM_CAROUSEL_MAX_SLIDES - totalCarouselCount;
    if (room <= 0) {
      setMediaError(`Máximo de ${INSTAGRAM_CAROUSEL_MAX_SLIDES} imagens.`);
      return;
    }
    const stamp = Date.now();
    const newItems: CarouselItem[] = images.slice(0, room).map((file, index) => ({
      key: `pending-${stamp}-${index}`,
      kind: 'pending',
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setCarouselItems((prev) => [...prev, ...newItems]);
    setMediaError('');
  };

  const removeCarouselItem = (key: string) => {
    setCarouselItems((prev) => {
      const item = prev.find((entry) => entry.key === key);
      if (!item) return prev;
      if (item.kind === 'saved') {
        setRemovedSlideIds((ids) => [...ids, item.slideId]);
      } else {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((entry) => entry.key !== key);
    });
  };

  const moveCarouselItem = (fromIndex: number, toIndex: number) => {
    setCarouselItems((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleCarouselDragStart = (index: number) => {
    setDragCarouselIndex(index);
  };

  const handleCarouselDrop = (index: number) => {
    if (dragCarouselIndex !== null && dragCarouselIndex !== index) {
      moveCarouselItem(dragCarouselIndex, index);
    }
    setDragCarouselIndex(null);
  };

  const handleFile = (file: File | null) => {
    if (!file) {
      setMediaFile(null);
      setMediaError('');
      return;
    }
    if (config.videoOnly && !isVideoFile(file)) {
      setMediaError('Este formato aceita apenas vídeo MP4.');
      return;
    }
    setMediaFile(file);
    setMediaError('');
    setForm((prev) => ({ ...prev, mediaUrl: '' }));
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (format === 'carousel' && totalCarouselCount < INSTAGRAM_CAROUSEL_MIN_SLIDES) {
      setMediaError(`Carrossel exige pelo menos ${INSTAGRAM_CAROUSEL_MIN_SLIDES} imagens.`);
      return;
    }
    const title = form.title.trim() || `Post ${config.label} — ${new Date().toLocaleDateString('pt-BR')}`;
    onSubmit(
      {
        ...form,
        title,
        caption: form.caption?.trim() ?? '',
        hashtags: form.hashtags?.trim() ?? '',
        mediaUrl: format === 'carousel' ? '' : (mediaFile ? '' : (form.mediaUrl?.trim() ?? '')),
        scheduledAt: form.status === 'scheduled' ? form.scheduledAt : null,
      },
      format === 'carousel' ? null : mediaFile,
      format === 'carousel'
        ? {
            removeSlideIds: removedSlideIds,
            order: carouselItems.map((item) =>
              item.kind === 'saved'
                ? { kind: 'saved', slideId: item.slideId }
                : { kind: 'pending', file: item.file },
            ),
          }
        : undefined,
    );
  };

  const isCarousel = format === 'carousel';
  const showFeedAspect = format === 'feed' || format === 'carousel';

  return (
    <div
      className="marketing-ig-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
      role="presentation"
    >
      <div className="marketing-ig-modal" role="dialog" aria-modal="true" aria-labelledby="marketing-ig-title">
        <header className="marketing-ig-modal-header">
          <div>
            <h3 id="marketing-ig-title">{editing ? 'Editar postagem' : 'Nova postagem'}</h3>
            <p>Formato, mídia, legenda e programação.</p>
          </div>
          <button type="button" className="marketing-ig-modal-close" onClick={onClose} disabled={saving} aria-label="Fechar">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <div className="marketing-ig-format-tabs" role="tablist" aria-label="Formato da postagem">
          {INSTAGRAM_POST_FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={format === opt.value}
              className={`marketing-ig-format-tab${format === opt.value ? ' is-active' : ''}`}
              onClick={() => selectFormat(opt.value)}
            >
              <i className={`bi ${FORMAT_ICONS[opt.value]}`} aria-hidden="true" />
              <span className="marketing-ig-format-tab-label">{opt.label}</span>
              <span className="marketing-ig-format-tab-desc">{opt.description}</span>
            </button>
          ))}
        </div>

        <form className="marketing-ig-modal-shell" onSubmit={handleSubmit}>
          <div className="marketing-ig-modal-body">
            <div className="marketing-ig-modal-main">
              <section className="marketing-ig-panel">
                <h4 className="marketing-ig-panel-title">Mídia</h4>

                {showFeedAspect && (
                  <div className="marketing-ig-feed-aspect-bar" role="group" aria-label="Proporção do feed">
                    {INSTAGRAM_FEED_ASPECT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`marketing-ig-feed-aspect-btn${(form.feedAspect ?? 'square') === opt.value ? ' is-active' : ''}`}
                        onClick={() => setForm((prev) => ({ ...prev, feedAspect: opt.value as InstagramFeedAspect }))}
                      >
                        <span className={`marketing-ig-aspect-shape is-${opt.value}`} aria-hidden="true" />
                        {opt.label} · {opt.ratio}
                      </button>
                    ))}
                  </div>
                )}

                {isCarousel ? (
                  <>
                    <input
                      ref={carouselInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="marketing-ig-file-input"
                      onChange={(e) => {
                        handleCarouselFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <div className="marketing-ig-carousel-toolbar">
                      <span>
                        {totalCarouselCount} / {INSTAGRAM_CAROUSEL_MAX_SLIDES} imagens
                        {totalCarouselCount > 1 && ' · arraste para reordenar'}
                      </span>
                      <button
                        type="button"
                        className="reports-action-btn secondary"
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                        disabled={totalCarouselCount >= INSTAGRAM_CAROUSEL_MAX_SLIDES}
                        onClick={() => carouselInputRef.current?.click()}
                      >
                        Adicionar fotos
                      </button>
                    </div>
                    <div className="marketing-ig-carousel-grid">
                      {carouselItems.map((item, idx) => (
                        <div
                          key={item.key}
                          className={`marketing-ig-carousel-thumb${item.kind === 'pending' ? ' is-new' : ''}${dragCarouselIndex === idx ? ' is-dragging' : ''}`}
                          draggable
                          onDragStart={() => handleCarouselDragStart(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleCarouselDrop(idx);
                          }}
                          onDragEnd={() => setDragCarouselIndex(null)}
                        >
                          <img src={item.previewUrl} alt="" draggable={false} />
                          <button
                            type="button"
                            className="marketing-ig-carousel-remove"
                            aria-label="Remover imagem"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCarouselItem(item.key);
                            }}
                          >
                            ×
                          </button>
                          <span className="marketing-ig-carousel-order">{idx + 1}</span>
                        </div>
                      ))}
                      {totalCarouselCount === 0 && (
                        <button
                          type="button"
                          className="marketing-ig-carousel-add-empty"
                          onClick={() => carouselInputRef.current?.click()}
                        >
                          <i className="bi bi-plus-lg" aria-hidden="true" />
                          <span>Mín. {INSTAGRAM_CAROUSEL_MIN_SLIDES} imagens</span>
                        </button>
                      )}
                    </div>
                    {mediaError && <p className="marketing-ig-field-error">{mediaError}</p>}
                  </>
                ) : (
                  <>
                <div
                  className={`marketing-ig-dropzone${mediaError ? ' has-error' : ''}${previewMediaUrl ? ' has-media' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                  role="button"
                  tabIndex={0}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={config.accept}
                    className="marketing-ig-file-input"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                  {previewMediaUrl ? (
                    <div className="marketing-ig-dropzone-preview">
                      {previewMediaType === 'video' ? (
                        <video src={previewMediaUrl} muted playsInline />
                      ) : (
                        <img src={previewMediaUrl} alt="" />
                      )}
                      <button
                        type="button"
                        className="marketing-ig-dropzone-change"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <div className="marketing-ig-dropzone-empty">
                      <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
                      <strong>{config.videoOnly ? 'Enviar vídeo MP4' : 'Enviar imagem ou vídeo'}</strong>
                      <span>Clique ou arraste o arquivo aqui</span>
                    </div>
                  )}
                </div>
                {mediaError && <p className="marketing-ig-field-error">{mediaError}</p>}

                {!mediaFile && !isCarousel && (
                  <div className="login-group" style={{ marginBottom: 0, marginTop: 12 }}>
                    <label htmlFor="ig-post-media-url">URL pública (alternativa)</label>
                    <input
                      id="ig-post-media-url"
                      type="url"
                      value={form.mediaUrl ?? ''}
                      placeholder="https://..."
                      onChange={(e) => setForm((prev) => ({ ...prev, mediaUrl: e.target.value }))}
                    />
                  </div>
                )}
                  </>
                )}
              </section>

              <section className="marketing-ig-panel">
                <h4 className="marketing-ig-panel-title">Legenda</h4>
                <div className="login-group" style={{ marginBottom: 12 }}>
                  <label htmlFor="ig-post-caption">Texto</label>
                  <textarea
                    id="ig-post-caption"
                    rows={4}
                    value={form.caption ?? ''}
                    placeholder="Escreva a legenda do post..."
                    onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
                  />
                </div>
                <div className="login-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="ig-post-hashtags">Hashtags</label>
                  <input
                    id="ig-post-hashtags"
                    type="text"
                    value={form.hashtags ?? ''}
                    placeholder="#marca #campanha"
                    onChange={(e) => setForm((prev) => ({ ...prev, hashtags: e.target.value }))}
                  />
                </div>
              </section>

              <button
                type="button"
                className="marketing-ig-advanced-toggle"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <i className={`bi bi-chevron-${showAdvanced ? 'down' : 'right'}`} aria-hidden="true" />
                Opções avançadas
              </button>
              {showAdvanced && (
                <div className="login-group" style={{ marginTop: 8, marginBottom: 0 }}>
                  <label htmlFor="ig-post-title">Título interno</label>
                  <input
                    id="ig-post-title"
                    type="text"
                    value={form.title}
                    placeholder="Opcional — controle interno"
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <aside className="marketing-ig-modal-preview-col">
              <h4 className="marketing-ig-panel-title">Pré-visualização</h4>
              <InstagramPreview
                format={format}
                feedAspect={form.feedAspect ?? 'square'}
                mediaUrl={isCarousel ? (carouselPreviewUrls[carouselSlideIndex] ?? '') : previewMediaUrl}
                mediaType={previewMediaType}
                slideUrls={isCarousel ? carouselPreviewUrls : undefined}
                slideIndex={carouselSlideIndex}
                onSlideIndexChange={setCarouselSlideIndex}
                caption={form.caption ?? ''}
                hashtags={form.hashtags ?? ''}
                username={connection?.instagramUsername}
              />
            </aside>
          </div>

          <footer className="marketing-ig-modal-footer">
            <div className="marketing-ig-footer-fields">
              <div className="login-group marketing-ig-footer-field">
                <label htmlFor="ig-post-status">Status</label>
                <select
                  id="ig-post-status"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    status: e.target.value as InstagramPostStatus,
                    scheduledAt: e.target.value === 'scheduled' ? prev.scheduledAt : null,
                  }))}
                >
                  {INSTAGRAM_POST_STATUS_OPTIONS.filter((opt) => opt.value !== 'Todos').map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="login-group marketing-ig-footer-field">
                <label htmlFor="ig-post-scheduled">Programar para</label>
                <input
                  id="ig-post-scheduled"
                  type="datetime-local"
                  disabled={form.status !== 'scheduled'}
                  value={toDatetimeLocal(form.scheduledAt)}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  }))}
                />
              </div>
            </div>
            <div className="marketing-ig-footer-actions">
              <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              {editing && canPublish && onPublish && editing.status !== 'published' && editing.status !== 'cancelled' && (
                <button
                  type="button"
                  className="reports-action-btn primary"
                  disabled={publishing || saving}
                  onClick={() => onPublish(editing)}
                >
                  Publicar agora
                </button>
              )}
              <button type="submit" className="reports-action-btn primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default MarketingInstagramPostModal;
