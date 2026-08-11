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
} from '../../hooks/useMarketingCampanhas';
import type { CampanhaMarketing } from '../../types/domain';
import {
  CAMPANHA_CANAL_LABEL,
  CAMPANHA_STATUS_LABEL,
  normalizeCampanhaCanais,
} from '../../types/domain';

type MarketingCampanhaDetailModalProps = {
  campanhaId: string;
  onClose: () => void;
  onEdit: (campanha: CampanhaMarketing) => void;
};

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

const MarketingCampanhaDetailModal: React.FC<MarketingCampanhaDetailModalProps> = ({
  campanhaId,
  onClose,
  onEdit,
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

  const [comentario, setComentario] = useState('');
  const [mencoes, setMencoes] = useState<string[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);

  const campanha = detailQuery.data;
  const team = directoryQuery.data ?? [];

  const isMember = useMemo(
    () => (campanha?.membros ?? []).some((m) => m.user.id === user?.id),
    [campanha?.membros, user?.id],
  );
  const isResponsavel = campanha?.responsavelUser?.id === user?.id;

  const availableToAdd = useMemo(() => {
    const ids = new Set((campanha?.membros ?? []).map((m) => m.user.id));
    return team.filter((m) => !ids.has(m.id));
  }, [campanha?.membros, team]);

  const submitComment = () => {
    const texto = comentario.trim();
    if (!texto) return;
    createComentario.mutate({ texto, mencoes }, {
      onSuccess: () => { setComentario(''); setMencoes([]); },
    });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    submitComment();
  };

  if (!detailQuery.isLoading && !detailQuery.isError && !campanha) return null;

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: 'min(640px, 96vw)' }}>
        <QueryDataPanel
          query={detailQuery}
          variant="compact"
          loadingMessage="Carregando campanha..."
          errorMessage="Não foi possível carregar a campanha."
        >
          {campanha && (
            <>
              <div
                className="search-input-wrapper"
                style={{
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                    {campanha.titulo}
                  </h3>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
                    {CAMPANHA_STATUS_LABEL[campanha.status]}
                    {normalizeCampanhaCanais(campanha.canais).length > 0 && (
                      <> · {normalizeCampanhaCanais(campanha.canais).map((canal) => CAMPANHA_CANAL_LABEL[canal]).join(' · ')}</>
                    )}
                    · {formatDateBr(campanha.dataInicio)} – {formatDateBr(campanha.dataFim)}
                  </p>
                </div>
                <span
                  className="search-close-key"
                  style={{ cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
                  onClick={onClose}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onClose(); }}
                >
                  Fechar (X)
                </span>
              </div>

              <div style={{ padding: '16px 24px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserAvatar
                      name={campanha.responsavelUser?.name ?? campanha.responsavel ?? '—'}
                      photo={campanha.responsavelUser?.googlePicture}
                      size="md"
                    />
                    <div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Responsável</div>
                      <strong style={{ fontSize: '13px', color: '#334155' }}>
                        {campanha.responsavelUser?.name ?? campanha.responsavel ?? 'Não definido'}
                      </strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!isResponsavel && (
                      <button type="button" className="reports-action-btn secondary" disabled={atribuirAMim.isPending} onClick={() => atribuirAMim.mutate()}>
                        Assumir
                      </button>
                    )}
                    {!isMember && (
                      <button type="button" className="reports-action-btn secondary" disabled={participar.isPending} onClick={() => participar.mutate()}>
                        Participar
                      </button>
                    )}
                    {canEdit && (
                      <button type="button" className="reports-action-btn primary" onClick={() => onEdit(campanha)}>
                        Editar
                      </button>
                    )}
                  </div>
                </div>

                {campanha.descricao && (
                  <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                    {campanha.descricao}
                  </p>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '13px', color: '#334155' }}>Equipe</strong>
                    {canEdit && (
                      <button
                        type="button"
                        style={{ border: 'none', background: 'none', color: '#118CC4', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => setShowAddMember((v) => !v)}
                      >
                        {showAddMember ? 'Cancelar' : '+ Adicionar'}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(campanha.membros ?? []).map((m) => (
                      <span
                        key={m.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px 4px 4px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '999px',
                          fontSize: '12px',
                          color: '#475569',
                        }}
                      >
                        <UserAvatar name={m.user.name} photo={m.user.googlePicture} size="sm" />
                        {m.user.name.split(' ')[0]}
                        {canEdit && m.user.id !== user?.id && (
                          <button
                            type="button"
                            aria-label="Remover"
                            style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                            onClick={() => removeMembro.mutate(m.user.id)}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    {(campanha.membros ?? []).length === 0 && (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum membro</span>
                    )}
                  </div>
                  {showAddMember && availableToAdd.length > 0 && (
                    <div style={{ marginTop: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      {availableToAdd.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            border: 'none',
                            background: '#fff',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            textAlign: 'left',
                          }}
                          onClick={() => addMembro.mutate(member.id, { onSuccess: () => setShowAddMember(false) })}
                        >
                          <UserAvatar name={member.name} photo={member.googlePicture} size="sm" />
                          {member.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#334155', marginBottom: '8px' }}>
                    Comentários
                  </strong>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    marginBottom: '12px',
                    padding: '12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                  >
                    {(campanha.comentarios ?? []).length === 0 && (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum comentário. Use @ para mencionar.</span>
                    )}
                    {(campanha.comentarios ?? []).map((item) => (
                      <div key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <UserAvatar name={item.autor?.name ?? item.autorNome} photo={item.autor?.googlePicture} size="sm" />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '12px' }}>{item.autor?.name ?? item.autorNome}</strong>
                            <time style={{ fontSize: '10px', color: '#94a3b8' }}>{formatDateTimeBr(item.dataCriacao)}</time>
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.45 }}>
                            {renderCommentText(item.texto, item.mencoes ?? [])}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onSubmit={handleComment}>
                    <div style={{ flex: 1 }}>
                      <MentionCommentInput
                        team={team}
                        value={comentario}
                        onChange={setComentario}
                        mencoes={mencoes}
                        onMencoesChange={setMencoes}
                        onSubmit={submitComment}
                        disabled={createComentario.isPending}
                      />
                    </div>
                    <button type="submit" className="reports-action-btn primary" disabled={!comentario.trim() || createComentario.isPending}>
                      Enviar
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </QueryDataPanel>
      </div>
    </div>
  );
};

export default MarketingCampanhaDetailModal;
