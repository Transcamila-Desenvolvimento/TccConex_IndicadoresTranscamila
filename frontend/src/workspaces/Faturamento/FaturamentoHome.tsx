import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { userCanSeeAba } from '../../constants/abas';

const QUICK_LINKS = [
  {
    title: 'Envio NF Cliente',
    description: 'Registre e imprima protocolos de envio de notas fiscais para clientes.',
    path: '/faturamento/protocolos',
    aba: 'envio-nf-cliente',
    badge: 'Envio de documentos',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Cadastro cliente',
    description: 'Cadastre clientes, consulte o CNPJ e defina se entram em protocolo de canhotos e na pesquisa de satisfação.',
    path: '/faturamento/cadastros/clientes',
    aba: 'cadastro-clientes',
    badge: 'Cadastros',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Controle de NDs',
    description: 'Acompanhe as notas de débito do faturamento.',
    path: '/faturamento/controle-nds',
    aba: 'controle-nds',
    badge: 'Notas de débito',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
      </svg>
    ),
  },
] as const;

const FaturamentoHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  return (
    <section id="faturamento-home-view" className="view active" style={{ display: 'block' }}>
      <div className="welcome-banner">
        <h2>Olá, {firstName}!</h2>
        <p>Bem-vindo ao ambiente de Faturamento.</p>
      </div>

      <div className="quick-access-bar">
        <h3 className="quick-access-title">Acesso rápido</h3>
      </div>

      <div className="quick-access-grid">
        {QUICK_LINKS.filter((link) => userCanSeeAba(user, 'Faturamento', link.aba)).map((link) => (
          <button
            key={link.path}
            type="button"
            className="quick-access-card"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => navigate(link.path)}
          >
            <div className="card-header-row">
              <div className="card-icon-wrapper">
                {link.icon}
              </div>
              <span className="card-badge">
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

export default FaturamentoHome;
