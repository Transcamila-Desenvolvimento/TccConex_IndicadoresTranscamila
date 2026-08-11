import React, { useEffect, useState } from 'react';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { useMarketingDirectory } from '../../hooks/useMarketingCampanhas';
import type { CampanhaCanal, CampanhaMarketing, CampanhaPayload, CampanhaStatus } from '../../types/domain';
import {
  CAMPANHA_CANAL_OPTIONS,
  CAMPANHA_COR_OPTIONS,
  CAMPANHA_KANBAN_COLUMNS,
  normalizeCampanhaCanais,
} from '../../types/domain';

type MarketingCampanhaModalProps = {
  open: boolean;
  campanha: CampanhaMarketing | null;
  defaultDate?: string;
  onClose: () => void;
  onSave: (payload: CampanhaPayload) => void;
  onDelete?: () => void;
  busy?: boolean;
  canDelete?: boolean;
};

const MarketingCampanhaModal: React.FC<MarketingCampanhaModalProps> = ({
  open,
  campanha,
  defaultDate,
  onClose,
  onSave,
  onDelete,
  busy,
  canDelete,
}) => {
  const { user } = useAuth();
  const directoryQuery = useMarketingDirectory();
  const team = directoryQuery.data ?? [];

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [status, setStatus] = useState<CampanhaStatus>('planejamento');
  const [canais, setCanais] = useState<CampanhaCanal[]>(['evento']);
  const [responsavelUserId, setResponsavelUserId] = useState<string | null>(null);
  const [cor, setCor] = useState('azul');
  const [canaisError, setCanaisError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (campanha) {
      setTitulo(campanha.titulo);
      setDescricao(campanha.descricao);
      setDataInicio(campanha.dataInicio);
      setDataFim(campanha.dataFim);
      setStatus(campanha.status);
      setCanais(normalizeCampanhaCanais(campanha.canais));
      setResponsavelUserId(campanha.responsavelUser?.id ?? campanha.responsavelUserId ?? null);
      setCor(campanha.cor || 'azul');
    } else {
      const d = defaultDate || new Date().toISOString().slice(0, 10);
      setTitulo('');
      setDescricao('');
      setDataInicio(d);
      setDataFim(d);
      setStatus('planejamento');
      setCanais(['evento']);
      setResponsavelUserId(user?.id ?? null);
      setCor('azul');
    }
    setCanaisError('');
  }, [open, campanha, defaultDate, user?.id]);

  if (!open) return null;

  const toggleCanal = (canal: CampanhaCanal) => {
    setCanaisError('');
    setCanais((current) => (
      current.includes(canal)
        ? current.filter((item) => item !== canal)
        : [...current, canal]
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canais.length === 0) {
      setCanaisError('Selecione ao menos um canal de comunicação.');
      return;
    }
    onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      dataInicio,
      dataFim,
      status,
      canais,
      responsavelUserId,
      cor,
    });
  };

  return (
    <div
      className="search-backdrop sgq-import-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="search-modal-card sgq-import-modal-card" style={{ width: 'min(560px, 96vw)' }}>
        <div className="sgq-import-modal-header">
          <h3>{campanha ? 'Editar conteúdo' : 'Novo conteúdo'}</h3>
          <button type="button" className="search-modal-close" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="sgq-import-modal-body">
            <label className="login-group" style={{ display: 'block', marginBottom: '12px' }}>
              Título do post
              <input className="form-input" required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Bastidores do terminal" />
            </label>
            <label className="login-group" style={{ display: 'block', marginBottom: '12px' }}>
              Briefing
              <textarea
                className="form-input"
                rows={3}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Roteiro, copy, referências visuais..."
                style={{ resize: 'vertical' }}
              />
            </label>
            <div className="form-grid two-cols" style={{ marginBottom: '12px' }}>
              <label className="login-group">
                Publicar a partir de
                <input type="date" className="form-input" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </label>
              <label className="login-group">
                Publicar até
                <input type="date" className="form-input" required value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </label>
            </div>
            <label className="login-group" style={{ display: 'block', marginBottom: '12px' }}>
              Etapa de produção
              <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value as CampanhaStatus)}>
                {CAMPANHA_KANBAN_COLUMNS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <div style={{ marginBottom: '12px' }}>
              <span className="login-group" style={{ display: 'block', marginBottom: '8px', fontSize: '11px', color: '#64748b' }}>
                Canais de comunicação
              </span>
              <div className="mkt-canal-picker" role="group" aria-label="Canais de comunicação">
                {CAMPANHA_CANAL_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`mkt-canal-option ${canais.includes(value) ? 'is-active' : ''}`}
                    aria-pressed={canais.includes(value)}
                    onClick={() => toggleCanal(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {canaisError && (
                <p className="mkt-canal-picker-error" role="alert">{canaisError}</p>
              )}
            </div>
            <div style={{ marginBottom: '12px' }}>
              <span className="login-group" style={{ display: 'block', marginBottom: '8px', fontSize: '11px', color: '#64748b' }}>
                Responsável
              </span>
              <div className="mkt-assignee-picker">
                {team.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`mkt-assignee-option ${responsavelUserId === member.id ? 'is-active' : ''}`}
                    onClick={() => setResponsavelUserId(member.id)}
                  >
                    <UserAvatar name={member.name} photo={member.googlePicture} size="sm" />
                    <span>{member.name}</span>
                  </button>
                ))}
                {team.length === 0 && (
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Carregando equipe...</p>
                )}
              </div>
            </div>
            <div>
              <span className="login-group" style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: '#64748b' }}>
                Cor no calendário
              </span>
              <div className="fin-calendar-color-picker">
                {CAMPANHA_COR_OPTIONS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`fin-calendar-color-option ${cor === item.key ? 'is-active' : ''}`}
                    style={{ backgroundColor: item.hex }}
                    title={item.label}
                    onClick={() => setCor(item.key)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="sgq-import-modal-footer" style={{ justifyContent: 'space-between' }}>
            <div>
              {canDelete && campanha && onDelete && (
                <button type="button" className="reports-action-btn secondary" style={{ color: '#b91c1c' }} onClick={onDelete} disabled={busy}>
                  Excluir
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={busy}>Cancelar</button>
              <button type="submit" className="reports-action-btn primary" disabled={busy || !titulo.trim()}>
                {busy ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MarketingCampanhaModal;
