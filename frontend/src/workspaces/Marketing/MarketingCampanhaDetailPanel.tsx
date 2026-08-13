import React, { useMemo, useState } from 'react';
import MentionCommentInput, { renderCommentText } from '../../components/MentionCommentInput';
import QueryDataPanel from '../../components/QueryDataPanel';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import {
  useAddCampanhaMembro,
  useAtribuirCampanhaAMim,
  useCampanha,
  useCreateCampanhaComentario,
  useMarketingDirectory,
  useParticiparCampanha,
  useRemoveCampanhaMembro,
  useRemoveCampanhaMidia,
} from '../../hooks/useMarketingCampanhas';
import type { CampanhaMarketing, CampanhaMidia, UserDirectoryEntry } from '../../types/domain';
import {
  CAMPANHA_CANAL_LABEL,
  CAMPANHA_STATUS_LABEL,
  campanhaCorHex,
  normalizeCampanhaCanais,
} from '../../types/domain';
import MarketingCampanhaDrivePicker from './MarketingCampanhaDrivePicker';
import GoogleDriveThumbnail from '../../components/GoogleDriveThumbnail';
import GoogleDrivePreviewModal from '../../components/GoogleDrivePreviewModal';

type MarketingCampanhaDetailPanelProps = {
  campanhaId: string;
  onEdit: (campanha: CampanhaMarketing) => void;
  onClose: () => void;
};

type DetailTab = 'conversa' | 'equipe' | 'arquivos';

const formatDateBr = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const formatDateTimeBr = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

const MarketingCampanhaDetailPanel: React.FC<MarketingCampanhaDetailPanelProps> = ({
  campanhaId,
  onEdit,
  onClose,
}) => {
  const { user } = useAuth();
  const canEdit = userHasFuncao(user, 'Marketing', 'editar-campanhas');
  const detailQuery = useCampanha(campanhaId);
  const directoryQuery = useMarketingDirectory();
  const createComentario = useCreateCampanhaComentario(campanhaId);
  const atribuirAMim = useAtribuirCampanhaAMim(campanhaId);
  const participar = useParticiparCampanha(campanhaId);
  const addMembro = useAddCampanhaMembro(campanhaId);
  const removeMembro = useRemoveCampanhaMembro(campanhaId);
  const removeMidia = useRemoveCampanhaMidia(campanhaId);

  const [tab, setTab] = useState<DetailTab>('equipe');
  const [comentario, setComentario] = useState('');
  const [mencoes, setMencoes] = useState<string[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [previewMidia, setPreviewMidia] = useState<CampanhaMidia | null>(null);

  const campanha = detailQuery.data;
  const team = directoryQuery.data ?? [];

  const isMember = useMemo(
    () => (campanha?.membros ?? []).some((m) => m.user.id === user?.id),
    [campanha?.membros, user?.id],
  );
  const isResponsavel = campanha?.responsavelUser?.id === user?.id;

  const availableToAdd = useMemo(() => {
    const memberIds = new Set((campanha?.membros ?? []).map((m) => m.user.id));
    return team.filter((m) => !memberIds.has(m.id));
  }, [campanha?.membros, team]);

  const linkedDriveFileIds = useMemo(
    () => (campanha?.midias ?? []).map((item) => item.driveFileId),
    [campanha?.midias],
  );

  const handleComment = () => {
    const texto = comentario.trim();
    if (!texto) return;
    createComentario.mutate({ texto, mencoes }, {
      onSuccess: () => { setComentario(''); setMencoes([]); },
    });
  };

  const handleAddMember = (member: UserDirectoryEntry) => {
    addMembro.mutate(member.id, { onSuccess: () => setShowAddMember(false) });
  };

  return (
    <aside className="mkt-side-panel erp-card">
      <QueryDataPanel
        query={detailQuery}
        variant="compact"
        fullPageLoader
        refreshVariant="overlay"
        className="mkt-side-panel-query"
        loadingMessage="Carregando conteúdo..."
        errorMessage="Não foi possível carregar os detalhes."
      >
        {campanha && (
          <>
            <header className="mkt-side-panel-header">
              <div className="mkt-side-panel-title">
                <span
                  className="mkt-detail-color-dot"
                  style={{ background: campanhaCorHex(campanha.cor) }}
                  aria-hidden="true"
                />
                <div>
                  <h3>{campanha.titulo}</h3>
                  <div className="mkt-side-badges">
                    <span className="mkt-side-badge">{CAMPANHA_STATUS_LABEL[campanha.status]}</span>
                    {normalizeCampanhaCanais(campanha.canais).map((canal) => (
                      <span key={canal} className="mkt-side-badge is-muted">{CAMPANHA_CANAL_LABEL[canal]}</span>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" className="search-modal-close" onClick={onClose} aria-label="Fechar">
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="mkt-side-panel-body">
              <p className="mkt-side-dates">
                <i className="bi bi-calendar3" aria-hidden="true" />
                {formatDateBr(campanha.dataInicio)} – {formatDateBr(campanha.dataFim)}
              </p>

              <div className="mkt-detail-quick-actions">
                {!isResponsavel && (
                  <button
                    type="button"
                    className="reports-action-btn secondary"
                    disabled={atribuirAMim.isPending}
                    onClick={() => atribuirAMim.mutate()}
                  >
                    <i className="bi bi-person-check" aria-hidden="true" />
                    Atribuir a mim
                  </button>
                )}
                {!isMember && (
                  <button
                    type="button"
                    className="reports-action-btn secondary"
                    disabled={participar.isPending}
                    onClick={() => participar.mutate()}
                  >
                    <i className="bi bi-person-plus" aria-hidden="true" />
                    Participar
                  </button>
                )}
                {canEdit && (
                  <button type="button" className="reports-action-btn secondary" onClick={() => onEdit(campanha)}>
                    <i className="bi bi-pencil" aria-hidden="true" />
                    Editar
                  </button>
                )}
              </div>

              <div className="mkt-detail-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'equipe'}
                  className={`mkt-detail-tab ${tab === 'equipe' ? 'is-active' : ''}`}
                  onClick={() => setTab('equipe')}
                >
                  Equipe
                  {(campanha.membrosCount ?? 0) > 0 && (
                    <span className="mkt-comments-count">{campanha.membrosCount}</span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'arquivos'}
                  className={`mkt-detail-tab ${tab === 'arquivos' ? 'is-active' : ''}`}
                  onClick={() => setTab('arquivos')}
                >
                  Arquivos
                  {(campanha.midiasCount ?? 0) > 0 && (
                    <span className="mkt-comments-count">{campanha.midiasCount}</span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'conversa'}
                  className={`mkt-detail-tab ${tab === 'conversa' ? 'is-active' : ''}`}
                  onClick={() => setTab('conversa')}
                >
                  Conversa
                  {campanha.comentariosCount > 0 && (
                    <span className="mkt-comments-count">{campanha.comentariosCount}</span>
                  )}
                </button>
              </div>

              {tab === 'equipe' && (
                <div className="mkt-team-panel">
                  <ul className="mkt-team-member-list">
                    {(campanha.membros ?? []).length === 0 && (
                      <li className="mkt-activity-empty">Nenhum participante ainda. Use Participar ou adicione alguém.</li>
                    )}
                    {(campanha.membros ?? []).map((membro) => (
                      <li key={membro.id} className="mkt-team-member-row">
                        <UserAvatar name={membro.user.name} photo={membro.user.googlePicture} size="sm" />
                        <div className="mkt-team-member-info">
                          <strong>{membro.user.name}</strong>
                          {campanha.responsavelUser?.id === membro.user.id && (
                            <span className="mkt-team-member-badge">Responsável</span>
                          )}
                        </div>
                        {canEdit && membro.user.id !== user?.id && (
                          <button
                            type="button"
                            className="mkt-team-member-remove"
                            aria-label={`Remover ${membro.user.name}`}
                            disabled={removeMembro.isPending}
                            onClick={() => removeMembro.mutate(membro.user.id)}
                          >
                            <i className="bi bi-x" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canEdit && (
                    <div className="mkt-team-add">
                      <button
                        type="button"
                        className="reports-action-btn secondary"
                        onClick={() => setShowAddMember((v) => !v)}
                      >
                        <i className="bi bi-person-plus" aria-hidden="true" />
                        Adicionar colaborador
                      </button>
                      {showAddMember && (
                        <ul className="mkt-team-add-list">
                          {availableToAdd.map((member) => (
                            <li key={member.id}>
                              <button type="button" onClick={() => handleAddMember(member)}>
                                <UserAvatar name={member.name} photo={member.googlePicture} size="sm" />
                                <span>{member.name}</span>
                              </button>
                            </li>
                          ))}
                          {availableToAdd.length === 0 && (
                            <li className="mkt-activity-empty">Todos da equipe já participam.</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'arquivos' && (
                <div className="mkt-campanha-arquivos-panel">
                  <div className="mkt-campanha-arquivos-toolbar">
                    <button
                      type="button"
                      className="reports-action-btn secondary"
                      onClick={() => setShowDrivePicker(true)}
                    >
                      <i className="bi bi-google" aria-hidden="true" />
                      Anexar do Drive
                    </button>
                  </div>
                  <ul className="mkt-campanha-arquivo-list">
                    {(campanha.midias ?? []).length === 0 && (
                      <li className="mkt-activity-empty">
                        Nenhum arquivo anexado. Navegue no seu Google Drive para vincular fotos, vídeos ou PDFs.
                      </li>
                    )}
                    {(campanha.midias ?? []).map((midia: CampanhaMidia) => (
                      <li key={midia.id} className="mkt-campanha-arquivo-row">
                        <button
                          type="button"
                          className="mkt-campanha-arquivo-open"
                          onClick={() => setPreviewMidia(midia)}
                        >
                          <span className="mkt-campanha-arquivo-thumb" aria-hidden="true">
                            <GoogleDriveThumbnail fileId={midia.driveFileId} kind={midia.kind} />
                          </span>
                          <div className="mkt-campanha-arquivo-info">
                            <strong>{midia.name}</strong>
                            <span className="mkt-campanha-arquivo-kind">
                              {midia.kind === 'video' ? 'Vídeo' : midia.kind === 'pdf' ? 'PDF' : 'Imagem'}
                            </span>
                          </div>
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="mkt-campanha-arquivo-action"
                            aria-label={`Remover ${midia.name}`}
                            disabled={removeMidia.isPending}
                            onClick={() => removeMidia.mutate(midia.driveFileId)}
                          >
                            <i className="bi bi-x-lg" aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === 'conversa' && (
                <div className="mkt-comments-section">
                  <div className="mkt-comments-list">
                    {(campanha.comentarios ?? []).length === 0 && (
                      <p className="mkt-comments-empty">Nenhum comentário ainda. Use @ para mencionar alguém.</p>
                    )}
                    {(campanha.comentarios ?? []).map((item) => (
                      <article key={item.id} className="mkt-comment">
                        <UserAvatar
                          name={item.autor?.name ?? item.autorNome}
                          photo={item.autor?.googlePicture}
                          size="sm"
                        />
                        <div className="mkt-comment-body">
                          <div className="mkt-comment-head">
                            <strong>{item.autor?.name ?? item.autorNome}</strong>
                            <time>{formatDateTimeBr(item.dataCriacao)}</time>
                          </div>
                          <p>{renderCommentText(item.texto, item.mencoes ?? [])}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                  <form
                    className="mkt-comment-form"
                    onSubmit={(e) => { e.preventDefault(); handleComment(); }}
                  >
                    <UserAvatar
                      name={user?.name ?? user?.username ?? 'Você'}
                      photo={user?.googlePicture}
                      size="sm"
                    />
                    <MentionCommentInput
                      team={team}
                      value={comentario}
                      onChange={setComentario}
                      mencoes={mencoes}
                      onMencoesChange={setMencoes}
                      onSubmit={handleComment}
                      disabled={createComentario.isPending}
                    />
                    <button
                      type="submit"
                      className="reports-action-btn primary"
                      disabled={!comentario.trim() || createComentario.isPending}
                      aria-label="Enviar comentário"
                    >
                      <i className="bi bi-send-fill" />
                    </button>
                  </form>
                </div>
              )}
            </div>

            <MarketingCampanhaDrivePicker
              campanhaId={campanhaId}
              linkedDriveFileIds={linkedDriveFileIds}
              open={showDrivePicker}
              onClose={() => setShowDrivePicker(false)}
              onAttached={() => setTab('arquivos')}
            />

            <GoogleDrivePreviewModal
              midia={previewMidia}
              open={Boolean(previewMidia)}
              onClose={() => setPreviewMidia(null)}
            />
          </>
        )}
      </QueryDataPanel>
    </aside>
  );
};

export default MarketingCampanhaDetailPanel;
