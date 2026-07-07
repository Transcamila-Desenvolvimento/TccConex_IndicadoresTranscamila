import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AdminUsersPanel from './AdminUsersPanel';
import AdminAuditLogsPanel from './AdminAuditLogsPanel';

type AdminTab = 'usuarios' | 'logs';

const AdminWorkspace: React.FC = () => {
  const location = useLocation();
  // Permite chegar direto na aba "Logs de Auditoria" a partir do link de acesso
  // rápido da Home (ver AdminHome.tsx), sem precisar de uma rota própria.
  const initialTab = (location.state as { tab?: AdminTab } | null)?.tab === 'logs' ? 'logs' : 'usuarios';
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  // Trava o scroll do container principal para o padrão de páginas com paginação fixa
  useEffect(() => {
    const contentEl = document.querySelector('.content') as HTMLElement | null;
    if (!contentEl) return;
    const prev = contentEl.style.overflowY;
    contentEl.style.overflowY = 'hidden';
    return () => { contentEl.style.overflowY = prev; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>

      {/* Header */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Administração</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="reports-tabs-bar" style={{ flexShrink: 0 }}>
        <button
          type="button"
          className={`reports-tab-btn${activeTab === 'usuarios' ? ' active' : ''}`}
          onClick={() => setActiveTab('usuarios')}
        >
          Usuários
        </button>
        <button
          type="button"
          className={`reports-tab-btn${activeTab === 'logs' ? ' active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Logs de Auditoria
        </button>
      </div>

      {activeTab === 'usuarios' ? <AdminUsersPanel /> : <AdminAuditLogsPanel />}
    </div>
  );
};

export default AdminWorkspace;
