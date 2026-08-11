import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  useCreateInstagramPost,
  useDeleteInstagramPost,
  useDisconnectInstagramConnection,
  useInstagramConnection,
  useInstagramConnectionLink,
  useInstagramPosts,
  usePublishInstagramPost,
  useUpdateInstagramPost,
  useUploadInstagramPostMedia,
  useUploadInstagramCarouselSlide,
  useDeleteInstagramCarouselSlide,
  useReorderInstagramCarouselSlides,
} from '../../hooks/useMarketingInstagramPosts';
import type {
  InstagramPost,
  InstagramPostPayload,
  InstagramPostQueryParams,
  InstagramPostStatus,
} from '../../types/domain';
import {
  INSTAGRAM_FEED_ASPECT_LABEL,
  INSTAGRAM_POST_FORMAT_LABEL,
  INSTAGRAM_POST_STATUS_LABEL,
  INSTAGRAM_POST_STATUS_OPTIONS,
} from '../../types/domain';
import MarketingInstagramPostModal, { type CarouselSubmitPayload } from './MarketingInstagramPostModal';

const DEFAULT_PAGE_SIZE = 20;

const formatDateTimeBr = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusBadgeClass = (status: InstagramPostStatus) => {
  switch (status) {
    case 'published':
      return 'marketing-post-status is-published';
    case 'scheduled':
      return 'marketing-post-status is-scheduled';
    case 'cancelled':
      return 'marketing-post-status is-cancelled';
    default:
      return 'marketing-post-status is-draft';
  }
};

const formatBadgeClass = (format: string) => {
  switch (format) {
    case 'reels':
      return 'marketing-post-format is-reels';
    case 'carousel':
      return 'marketing-post-format is-carousel';
    case 'story':
      return 'marketing-post-format is-story';
    default:
      return 'marketing-post-format is-feed';
  }
};

const MarketingInstagramPosts: React.FC = () => {
  const { user } = useAuth();
  const canCreate = userHasFuncao(user, 'Marketing', 'criar-posts');
  const canEdit = userHasFuncao(user, 'Marketing', 'editar-posts');
  const canDelete = userHasFuncao(user, 'Marketing', 'excluir-posts');
  const canPublish = userHasFuncao(user, 'Marketing', 'publicar-posts');

  const [filters, setFilters] = useState<InstagramPostQueryParams>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    ordering: '-scheduled_at',
    status: 'Todos',
  });
  const [searchInput, setSearchInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InstagramPost | null>(null);

  const connectionQuery = useInstagramConnection();
  const postsQuery = useInstagramPosts(filters);
  const { canShowEmpty } = useAsyncQueryState(postsQuery);
  const createPost = useCreateInstagramPost();
  const updatePost = useUpdateInstagramPost();
  const deletePost = useDeleteInstagramPost();
  const uploadMedia = useUploadInstagramPostMedia();
  const uploadCarouselSlide = useUploadInstagramCarouselSlide();
  const deleteCarouselSlide = useDeleteInstagramCarouselSlide();
  const reorderCarouselSlides = useReorderInstagramCarouselSlides();
  const publishPost = usePublishInstagramPost();
  const connectionLink = useInstagramConnectionLink();
  const disconnectConnection = useDisconnectInstagramConnection();

  const posts = postsQuery.data?.results ?? [];
  const total = postsQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? DEFAULT_PAGE_SIZE)));
  const connection = connectionQuery.data;
  const isSaving = createPost.isPending || updatePost.isPending || uploadMedia.isPending
    || uploadCarouselSlide.isPending || deleteCarouselSlide.isPending;

  const pageSummary = useMemo(() => {
    if (total === 0) return 'Nenhuma postagem';
    const page = filters.page ?? 1;
    const size = filters.pageSize ?? DEFAULT_PAGE_SIZE;
    const from = (page - 1) * size + 1;
    const to = Math.min(page * size, total);
    return `${from}–${to} de ${total}`;
  }, [filters.page, filters.pageSize, total]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (post: InstagramPost) => {
    setEditing(post);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
  };

  const applySearch = () => {
    setFilters((prev) => ({ ...prev, page: 1, search: searchInput.trim() || undefined }));
  };

  const saveMediaIfNeeded = async (postId: string, mediaFile: File | null) => {
    if (!mediaFile) return;
    await uploadMedia.mutateAsync({ id: postId, file: mediaFile });
  };

  const syncCarouselSlides = async (postId: string, carousel?: CarouselSubmitPayload) => {
    if (!carousel) return;

    for (const slideId of carousel.removeSlideIds) {
      await deleteCarouselSlide.mutateAsync({ postId, slideId });
    }

    const finalOrder: string[] = [];
    let latestPost: InstagramPost | undefined;

    for (const item of carousel.order) {
      if (item.kind === 'saved') {
        finalOrder.push(item.slideId);
        continue;
      }

      const knownIds = new Set(finalOrder);
      latestPost = await uploadCarouselSlide.mutateAsync({ id: postId, file: item.file });
      const newSlide = (latestPost.carouselSlides ?? []).find((slide) => !knownIds.has(slide.id));
      if (newSlide) {
        finalOrder.push(newSlide.id);
      }
    }

    if (finalOrder.length >= 2) {
      await reorderCarouselSlides.mutateAsync({ postId, slideIds: finalOrder });
    }
  };

  const handleModalSubmit = (
    payload: InstagramPostPayload,
    mediaFile: File | null,
    carousel?: CarouselSubmitPayload,
  ) => {
    if (editing) {
      updatePost.mutate(
        { id: editing.id, payload },
        {
          onSuccess: async () => {
            try {
              if (payload.postFormat === 'carousel') {
                await syncCarouselSlides(editing.id, carousel);
              } else {
                await saveMediaIfNeeded(editing.id, mediaFile);
              }
              closeModal();
            } catch {
              alert('Postagem salva, mas falha ao enviar a mídia.');
            }
          },
          onError: () => alert('Não foi possível salvar a postagem.'),
        },
      );
      return;
    }

    createPost.mutate(payload, {
      onSuccess: async (created) => {
        try {
          if (payload.postFormat === 'carousel') {
            await syncCarouselSlides(created.id, carousel);
          } else {
            await saveMediaIfNeeded(created.id, mediaFile);
          }
          closeModal();
        } catch {
          alert('Postagem criada, mas falha ao enviar a mídia.');
        }
      },
      onError: () => alert('Não foi possível criar a postagem.'),
    });
  };

  const handleDelete = (post: InstagramPost) => {
    if (!window.confirm(`Excluir a postagem "${post.title}"?`)) return;
    deletePost.mutate(post.id, {
      onError: () => alert('Não foi possível excluir a postagem.'),
    });
  };

  const handlePublish = (post: InstagramPost) => {
    if (!window.confirm(`Publicar "${post.title}" no Instagram agora?`)) return;
    publishPost.mutate(post.id, {
      onSuccess: () => {
        alert('Postagem publicada no Instagram.');
        closeModal();
      },
      onError: (err: unknown) => {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        alert(typeof detail === 'string' ? detail : 'Não foi possível publicar.');
      },
    });
  };

  const handleConnectInstagram = () => {
    connectionLink.mutate(undefined, {
      onSuccess: ({ authUrl }) => {
        window.location.href = authUrl;
      },
      onError: (err: unknown) => {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        alert(typeof detail === 'string' ? detail : 'Não foi possível iniciar a vinculação.');
      },
    });
  };

  const handleDisconnect = () => {
    if (!window.confirm('Desvincular a conta Instagram deste sistema?')) return;
    disconnectConnection.mutate(undefined, {
      onError: () => alert('Não foi possível desvincular.'),
    });
  };

  const canPublishPost = (post: InstagramPost) => {
    if (!canPublish || post.status === 'published' || post.status === 'cancelled') return false;
    if (post.postFormat === 'carousel') {
      return (post.slideCount ?? post.carouselSlides?.length ?? 0) >= 2;
    }
    return Boolean(post.mediaFileUrl || post.mediaUrl);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <div>
            <h1 className="view-page-title" style={{ marginBottom: '4px' }}>Postagens Instagram</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Feed, Reels e Stories — crie, programe e publique.</p>
          </div>
        </div>
        {canCreate && (
          <button type="button" className="reports-action-btn primary" onClick={openCreate}>
            Nova postagem
          </button>
        )}
      </header>

      {canPublish && (
        <QueryDataPanel
          query={connectionQuery}
          loadingMessage="Carregando conexão Instagram..."
          refreshingMessage="Atualizando conexão..."
          errorMessage="Não foi possível carregar o status da conta Instagram."
        >
          <div className="marketing-ig-connection-bar erp-card" style={{ marginBottom: '16px', padding: '14px 18px' }}>
            <div>
              <strong style={{ color: '#1e293b' }}>Conta Instagram</strong>
              {connection?.configured ? (
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  @{connection.instagramUsername || '—'}
                  {connection.pageName ? ` · ${connection.pageName}` : ''}
                  {connection.linkedAt ? ` · vinculada em ${formatDateTimeBr(connection.linkedAt)}` : ''}
                </p>
              ) : (
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Nenhuma conta vinculada. Conecte para publicar diretamente pelo ERP.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {connection?.configured ? (
                <button
                  type="button"
                  className="reports-action-btn secondary"
                  onClick={handleDisconnect}
                  disabled={disconnectConnection.isPending}
                >
                  Desvincular
                </button>
              ) : connection?.oauthAvailable ? (
                <button
                  type="button"
                  className="reports-action-btn primary"
                  onClick={handleConnectInstagram}
                  disabled={connectionLink.isPending}
                >
                  Vincular conta
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '280px' }}>
                  OAuth Meta não configurado no servidor. Use INSTAGRAM_ACCESS_TOKEN no .env.
                </span>
              )}
            </div>
          </div>
        </QueryDataPanel>
      )}

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-search-wrapper">
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por título, legenda ou hashtag..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
            />
          </div>
          <button type="button" className="reports-action-btn secondary" onClick={applySearch}>Buscar</button>
          <div className="reports-select-wrapper">
            <select
              value={filters.status ?? 'Todos'}
              onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, status: e.target.value }))}
            >
              {INSTAGRAM_POST_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <QueryDataPanel
        query={postsQuery}
        loadingMessage="Carregando postagens..."
        refreshingMessage="Atualizando postagens..."
        errorMessage="Não foi possível carregar as postagens. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <table className="reports-table marketing-posts-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Formato</th>
                  <th>Mídia</th>
                  <th>Programação</th>
                  <th>Status</th>
                  <th style={{ width: '180px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>
                      {post.title}
                      {post.publishError && (
                        <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 400, marginTop: '2px' }}>
                          {post.publishError}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={formatBadgeClass(post.postFormat ?? 'feed')}>
                        {post.postFormat === 'feed'
                          ? `Feed ${INSTAGRAM_FEED_ASPECT_LABEL[post.feedAspect ?? 'square']}`
                          : post.postFormat === 'carousel'
                            ? `Carrossel · ${post.slideCount || post.carouselSlides?.length || 0} fotos`
                            : INSTAGRAM_POST_FORMAT_LABEL[post.postFormat ?? 'feed']}
                      </span>
                    </td>
                    <td>
                      {post.mediaFileUrl || post.mediaUrl || (post.slideCount ?? 0) > 0 ? (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {post.postFormat === 'carousel'
                            ? `${post.slideCount || post.carouselSlides?.length || 0} imagens`
                            : post.mediaType === 'video' ? 'Vídeo' : 'Imagem'}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{formatDateTimeBr(post.scheduledAt)}</td>
                    <td>
                      <span className={statusBadgeClass(post.status)}>
                        {INSTAGRAM_POST_STATUS_LABEL[post.status]}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {canPublishPost(post) && (
                          <button
                            type="button"
                            className="reports-action-btn primary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            disabled={publishPost.isPending}
                            onClick={() => handlePublish(post)}
                          >
                            Publicar
                          </button>
                        )}
                        {canEdit && (
                          <button type="button" className="reports-action-btn secondary" onClick={() => openEdit(post)}>
                            Editar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="reports-action-btn secondary"
                            style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                            onClick={() => handleDelete(post)}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {canShowEmpty && posts.length === 0 && (
              <div className="cashflow-chart-empty" style={{ padding: '48px 16px' }}>
                Nenhuma postagem encontrada.
              </div>
            )}
          </div>

          <div className="erp-pagination-bar">
            <span>{pageSummary}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="reports-action-btn secondary"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page ?? 1) - 1) }))}
              >
                Anterior
              </button>
              <span>Página {filters.page ?? 1} de {totalPages}</span>
              <button
                type="button"
                className="reports-action-btn secondary"
                disabled={(filters.page ?? 1) >= totalPages}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </QueryDataPanel>

      <MarketingInstagramPostModal
        open={modalOpen}
        editing={editing}
        connection={connection}
        saving={isSaving}
        publishing={publishPost.isPending}
        canPublish={canPublish}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        onPublish={editing && canPublishPost(editing) ? handlePublish : undefined}
      />
    </div>
  );
};

export default MarketingInstagramPosts;
