import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const QUICK_LINKS = [
  {
    title: 'Controle papelaria',
    description: 'Saldos de produtos e movimentações de entrada e saída de materiais.',
    path: '/suprimentos/controle-estoque',
    badge: 'Estoques',
  },
  {
    title: 'Controle Uniformes',
    description: 'Estoque, entregas e devoluções de uniformes.',
    path: '/suprimentos/controle-uniformes',
    badge: 'Estoques',
  },
  {
    title: 'Cadastros',
    description: 'Consumidores, medidas e fornecedores usados nos estoques.',
    path: '/suprimentos/cadastros/consumidores',
    badge: 'Cadastros',
  },
] as const;

const SuprimentosHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  return (
    <section id="suprimentos-home-view" className="view active" style={{ display: 'block', padding: '4px' }}>
      <div className="welcome-banner">
        <h2>Olá, {firstName}!</h2>
        <p>Bem-vindo ao ambiente de Suprimentos da Transcamila.</p>
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
    </section>
  );
};

export default SuprimentosHome;
