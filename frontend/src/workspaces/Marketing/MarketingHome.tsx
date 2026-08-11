import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const QUICK_LINKS = [
  {
    title: 'Postagens Instagram',
    description: 'Crie, programe e gerencie postagens do Instagram em um só lugar.',
    path: '/marketing/instagram-posts',
    badge: 'Redes sociais',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
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
          Este ambiente está preparado para centralizar a criação, programação e gestão de conteúdo para redes sociais.
        </p>
        <p style={{ marginTop: '8px', marginBottom: 0 }}>
          Use o menu lateral ou o card acima para acessar o gerenciamento de postagens do Instagram.
        </p>
      </div>
    </section>
  );
};

export default MarketingHome;
