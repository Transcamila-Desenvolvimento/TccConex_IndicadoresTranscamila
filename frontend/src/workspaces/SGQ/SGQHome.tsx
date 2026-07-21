import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const QUICK_LINKS = [
  {
    title: 'Pesquisa de Satisfação',
    description: 'Registre e acompanhe as avaliações de entregas por cliente: prazo, mercadoria, veículo, motorista e atendimento.',
    path: '/sgq/pesquisa-satisfacao',
    badge: 'Qualidade',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
      </svg>
    ),
  },
] as const;

const SGQHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  return (
    <section id="sgq-home-view" className="view active" style={{ display: 'block', padding: '4px' }}>
      <div className="welcome-banner">
        <h2>Olá, {firstName}!</h2>
        <p>
          Bem-vindo ao ambiente de Gestão da Qualidade (SGQ).
        </p>
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
                style={{ background: 'rgba(0, 118, 206, 0.08)', color: 'var(--primary-color)' }}
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
        lineHeight: '1.6'
      }}>
        <p style={{ margin: 0 }}>Este é o painel principal do ambiente de Gestão da Qualidade (SGQ) da Transcamila.</p>
        <p style={{ marginTop: '8px', marginBottom: 0 }}>Use o menu lateral ou o card acima para acessar a Pesquisa de Satisfação.</p>
      </div>
    </section>
  );
};

export default SGQHome;
