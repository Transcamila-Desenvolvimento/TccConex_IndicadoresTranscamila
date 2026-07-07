import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const QUICK_LINKS = [
  {
    title: 'Controle de estoque',
    description: 'Gerenciamento único de saldos de produtos e movimentações de entrada e saída de materiais.',
    path: '/compras/controle-estoque',
    badge: 'Estoque',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
] as const;

const ComprasHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectedFilial } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  return (
    <section id="compras-home-view" className="view active" style={{ display: 'block' }}>
      <div className="welcome-banner" style={{ background: 'linear-gradient(135deg, #0f85c1 0%, #0c6a99 100%)' }}>
        <h2>Olá, {firstName}!</h2>
        <p>
          Bem-vindo ao ambiente de Compras e Suprimentos
          {selectedFilial ? ` · ${selectedFilial}` : ''}.
        </p>
      </div>

      <div className="quick-access-bar">
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
              <div className="card-icon-wrapper" style={{ color: '#0f85c1', background: 'rgba(15, 133, 193, 0.08)' }}>
                {link.icon}
              </div>
              <span
                className="card-badge"
                style={{ background: 'rgba(15, 133, 193, 0.08)', color: '#0f85c1' }}
              >
                {link.badge}
              </span>
            </div>
            <h4>{link.title}</h4>
            <p>{link.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
};

export default ComprasHome;
