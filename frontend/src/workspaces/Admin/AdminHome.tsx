import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';

const QUICK_LINKS = [
  {
    title: 'Usuários',
    description: 'Cadastre, edite e gerencie os usuários e permissões de acesso ao sistema.',
    path: '/admin/usuarios',
    tab: 'usuarios' as const,
    badge: 'Segurança',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Logs de Auditoria',
    description: 'Acompanhe o histórico de ações realizadas pelos usuários em todos os ambientes.',
    path: '/admin/usuarios',
    tab: 'logs' as const,
    badge: 'Auditoria',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const AdminHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  const allUsersQuery = useUsers({ pageSize: 1 });
  const activeUsersQuery = useUsers({ pageSize: 1, status: 'ativo' });
  const allUsersState = useAsyncQueryState(allUsersQuery);
  const activeUsersState = useAsyncQueryState(activeUsersQuery);

  const totalUsers = allUsersState.showInitialLoader ? '…' : (allUsersQuery.data?.count ?? 0);
  const activeUsers = activeUsersState.showInitialLoader ? '…' : (activeUsersQuery.data?.count ?? 0);

  return (
    <section id="admin-home-view" className="view active" style={{ display: 'block' }}>
      <div className="welcome-banner">
        <h2>Olá, {firstName}!</h2>
        <p>Bem-vindo ao ambiente de Administração/Manutenção.</p>
      </div>

      <div className="dashboard-stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Quantidade de Usuários</div>
          <div className="stat-card-value">{totalUsers}</div>
          <div className="stat-card-desc">Total de usuários cadastrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Usuários Ativos</div>
          <div className="stat-card-value">{activeUsers}</div>
          <div className="stat-card-desc">Usuários com status ativo no sistema</div>
        </div>
      </div>

      <div className="quick-access-bar" style={{ marginTop: '24px' }}>
        <h3 className="quick-access-title">Acesso rápido</h3>
      </div>

      <div className="quick-access-grid">
        {QUICK_LINKS.map((link) => (
          <button
            key={link.title}
            type="button"
            className="quick-access-card"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => navigate(link.path, { state: { tab: link.tab } })}
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

export default AdminHome;
