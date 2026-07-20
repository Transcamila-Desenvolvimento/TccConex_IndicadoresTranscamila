import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAllowedIndicadores } from '../../constants/indicadores';

const QUICK_LINKS = [
  {
    title: 'Fluxo de Caixa',
    description: 'Projeção diária, visão gerencial e análise consolidada por posição.',
    path: '/indicadores/fluxo-de-caixa',
    badge: 'Financeiro',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
      </svg>
    ),
  },
  {
    title: 'Meta de Faturamento',
    description: 'Acompanhe metas, realizado e desempenho por filial na logística.',
    path: '/indicadores/logistica/meta-faturamento',
    badge: 'Logística',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
] as const;

const IndicadoresHome: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectedFilial } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  const allowed = getAllowedIndicadores(user);
  const visibleLinks = QUICK_LINKS.filter((link) =>
    link.path === '/indicadores/fluxo-de-caixa'
      ? allowed.has('fluxo-caixa')
      : allowed.has('meta-faturamento'),
  );

  return (
    <section id="indicadores-home-view" className="view active" style={{ display: 'block' }}>
      <div className="welcome-banner">
        <h2>Olá, {firstName}!</h2>
        <p>
          Bem-vindo ao ambiente Indicadores
          {selectedFilial ? ` · ${selectedFilial}` : ''}.
        </p>
      </div>

      <div className="quick-access-bar">
        <h3 className="quick-access-title">Acesso rápido</h3>
      </div>

      <div className="quick-access-grid">
        {visibleLinks.map((link) => (
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
    </section>
  );
};

export default IndicadoresHome;
