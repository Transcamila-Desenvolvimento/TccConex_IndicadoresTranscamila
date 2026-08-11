import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const QUICK_LINKS = [
  {
    title: 'Calendario Transcamila',
    description: 'Calendário editorial e fluxo de produção de conteúdo para Instagram, Transcamila News e demais canais.',
    path: '/marketing/campanhas',
    badge: 'Conteúdo',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
] as const;

const MarketingHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  return (
    <section id="marketing-home-view" className="view active" style={{ display: 'block', padding: '4px' }}>
      <div className="welcome-banner">
        <h2>Olá, {firstName}!</h2>
        <p>Bem-vindo ao ambiente de Marketing da Transcamila.</p>
      </div>

      <div className="quick-access-bar" style={{ marginTop: '24px' }}>
        <h3 className="quick-access-title">Acesso rápido</h3>
      </div>

      <div className="quick-access-grid">
        {QUICK_LINKS.map((link) => (
          <button
            key={link.path}
            type="button"
            className="quick-access-card"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => navigate(link.path)}
          >
            <div className="card-header-row">
              <div className="card-icon-wrapper">{link.icon}</div>
              <span
                className="card-badge"
                style={{ background: 'rgba(17, 140, 196, 0.08)', color: '#118CC4' }}
              >
                {link.badge}
              </span>
            </div>
            <h4>{link.title}</h4>
            <p>{link.description}</p>
          </button>
        ))}
      </div>

      <div style={{
        marginTop: '20px',
        padding: '20px 24px',
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '1.6',
      }}>
        <p style={{ margin: 0 }}>
          Calendário editorial e fluxo Planejamento → Produção → Aguardando → Publicado, com equipe e conversa por conteúdo.
        </p>
      </div>
    </section>
  );
};

export default MarketingHome;
