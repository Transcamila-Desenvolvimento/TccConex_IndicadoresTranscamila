import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminEnvironment } from '../../constants/environments';
import { useUsers } from '../../hooks/useUsers';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';

const DashboardWorkspace: React.FC = () => {
  const { user, selectedEnvironment, selectedFilial } = useAuth();
  const isAdminEnv = isAdminEnvironment(selectedEnvironment);
  const allUsersQuery = useUsers({ pageSize: 1 }, isAdminEnv);
  const activeUsersQuery = useUsers({ pageSize: 1, status: 'ativo' }, isAdminEnv);
  const allUsersState = useAsyncQueryState(allUsersQuery);
  const activeUsersState = useAsyncQueryState(activeUsersQuery);

  const totalUsers = allUsersState.showInitialLoader ? '…' : (allUsersQuery.data?.count ?? 0);
  const activeUsers = activeUsersState.showInitialLoader ? '…' : (activeUsersQuery.data?.count ?? 0);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Usuário';
  const roleName = user?.roleId === '1' ? 'Administrador' : 'Operador';

  return (
    <section id="config-view" className="view active" style={{ display: 'block' }}>
      <div className="welcome-banner">
        <h2 id="welcome-username">Olá, {firstName}!</h2>
        <p>Bem-vindo ao painel central do ERP Transcamila.</p>
      </div>

      <div className="dashboard-stats-grid">
        {isAdminEnv ? (
          <>
            <div className="stat-card">
              <div className="stat-card-label" id="dash-card-1-label">Quantidade de Usuários</div>
              <div className="stat-card-value" id="dash-current-filial">{totalUsers}</div>
              <div className="stat-card-desc" id="dash-current-ambiente">Total de usuários cadastrados</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label" id="dash-card-2-label">Usuários Ativos</div>
              <div className="stat-card-value" id="dash-current-role">{activeUsers}</div>
              <div className="stat-card-desc">Usuários com status ativo no sistema</div>
            </div>
          </>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-card-label" id="dash-card-1-label">Ambiente Atual</div>
              <div className="stat-card-value" id="dash-current-filial">{selectedFilial ?? '—'}</div>
              <div className="stat-card-desc" id="dash-current-ambiente">{selectedEnvironment === 'RH' ? 'Recursos Humanos (RH)' : selectedEnvironment === 'SGQ' ? 'Gestão da Qualidade (SGQ)' : (selectedEnvironment ?? '—')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label" id="dash-card-2-label">Perfil</div>
              <div className="stat-card-value" id="dash-current-role">{roleName}</div>
              <div className="stat-card-desc">Acesso ao módulo selecionado</div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default DashboardWorkspace;
