import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAdminEnvironment } from '../constants/environments';
import logoExpanded from '../assets/Logo_TccConex.png';
import logoCollapsed from '../assets/Logo_TccConex_Fechado.png';

function NavIcon({ name, sub = false }: { name: string; sub?: boolean }) {
  return (
    <i
      className={`bi bi-${name} nav-icon${sub ? ' nav-icon-sub' : ''}`}
      aria-hidden="true"
    />
  );
}

function ChevronSubmenu({ open }: { open: boolean }) {
  return (
    <i
      className="bi bi-chevron-down chevron-submenu"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}
    />
  );
}

const DashboardLayout: React.FC = () => {
  const { user, selectedEnvironment, logout, clearEnvironment } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isCashflowSubmenuOpen, setIsCashflowSubmenuOpen] = useState(false);
  const [isIndFinanceiroSubmenuOpen, setIsIndFinanceiroSubmenuOpen] = useState(false);
  const [isIndLogisticaSubmenuOpen, setIsIndLogisticaSubmenuOpen] = useState(false);
  const [, setIsAdminSubmenuOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  // Setup initials for avatar
  const [initials, setInitials] = useState('MR');
  useEffect(() => {
    if (user?.name) {
      const parts = user.name.split(' ');
      const userInitials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
      setInitials(userInitials.toUpperCase());
    }
  }, [user]);

  // Escape key global listener to close command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith('/financeiro/reports')
      || location.pathname.startsWith('/financeiro/balances')
      || location.pathname.startsWith('/financeiro/adjustments')
      || location.pathname.startsWith('/financeiro/billing')) {
      setIsCashflowSubmenuOpen(true);
    }
    if (location.pathname.startsWith('/indicadores/fluxo-de-caixa')) {
      setIsIndFinanceiroSubmenuOpen(true);
    }
    if (location.pathname.startsWith('/indicadores/logistica')) {
      setIsIndLogisticaSubmenuOpen(true);
    }
    if (location.pathname.startsWith('/admin')) {
      setIsAdminSubmenuOpen(true);
    }
  }, [location.pathname]);

  // Close user profile dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.header-user')) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Navigate back to environment selection
  const handleChangeEnv = () => {
    clearEnvironment();
    navigate('/select-environment');
  };

  const getSystemFunctions = () => {
    const list = [
      {
        title: "Painel Geral",
        path: "Principal / Home",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
        action: () => navigate('/'),
        show: selectedEnvironment !== 'Financeiro' && selectedEnvironment !== 'Indicadores' && selectedEnvironment !== 'Compras'
      },
      {
        title: "Home Admin",
        path: "Administração / Home",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        ),
        action: () => navigate('/admin'),
        show: isAdminEnvironment(selectedEnvironment)
      },
      {
        title: "Controle de Usuários",
        path: "Configuração / Segurança e Usuários",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        action: () => navigate('/admin/usuarios'),
        show: isAdminEnvironment(selectedEnvironment)
      },
      {
        title: "Home Financeiro",
        path: "Financeiro / Dashboard Geral",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        ),
        action: () => navigate('/financeiro/home'),
        show: selectedEnvironment === 'Financeiro'
      },
      {
        title: "Inclusão de Relatórios",
        path: "Financeiro / Fluxo de Caixa / Inclusão de Relatórios",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        action: () => navigate('/financeiro/reports'),
        show: selectedEnvironment === 'Financeiro'
      },
      {
        title: "Saldos Bancários",
        path: "Financeiro / Fluxo de Caixa / Saldos Bancários",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-5m0 5H8.25m3.75 0h3.75M12 16h3.75m-7.5 0H12m-3.75 0V8.25M12 16V8.25m3.75 7.75V8.25M3 8.25h18M12 3L3 8.25h18L12 3z" />
          </svg>
        ),
        action: () => navigate('/financeiro/balances'),
        show: selectedEnvironment === 'Financeiro'
      },
      {
        title: "Ajustes de Caixa",
        path: "Financeiro / Fluxo de Caixa / Ajustes de Caixa",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
        ),
        action: () => navigate('/financeiro/adjustments'),
        show: selectedEnvironment === 'Financeiro'
      },
      {
        title: "Faturamento",
        path: "Financeiro / Fluxo de Caixa / Faturamento",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        ),
        action: () => navigate('/financeiro/billing'),
        show: selectedEnvironment === 'Financeiro'
      },
      {
        title: "Home Indicadores",
        path: "Indicadores / Home",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        ),
        action: () => navigate('/indicadores'),
        show: selectedEnvironment === 'Indicadores'
      },
      {
        title: "Fluxo de Caixa",
        path: "Indicadores / Financeiro / Fluxo de Caixa",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
          </svg>
        ),
        action: () => navigate('/indicadores/fluxo-de-caixa'),
        show: selectedEnvironment === 'Indicadores'
      },
      {
        title: "Meta de faturamento",
        path: "Indicadores / Logística / Meta de faturamento",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        ),
        action: () => navigate('/indicadores/logistica/meta-faturamento'),
        show: selectedEnvironment === 'Indicadores'
      },
      {
        title: "Home Compras",
        path: "Compras / Home",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        ),
        action: () => navigate('/compras'),
        show: selectedEnvironment === 'Compras'
      },
      {
        title: "Controle de estoque",
        path: "Compras / Controle de estoque",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
        action: () => navigate('/compras/controle-estoque'),
        show: selectedEnvironment === 'Compras'
      },
      {
        title: "Home RH",
        path: "RH / Home",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        ),
        action: () => navigate('/rh'),
        show: selectedEnvironment === 'RH'
      },
      {
        title: "Movimentações",
        path: "RH / Movimentações",
        icon: (
          <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        ),
        action: () => navigate('/rh/movimentacoes'),
        show: selectedEnvironment === 'RH'
      }
    ];

    return list.filter(f => f.show);
  };

  const filteredPalette = getSystemFunctions().filter(f => 
    f.title.toLowerCase().includes(paletteQuery.toLowerCase()) ||
    f.path.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  // Determine active route highlights
  const isRouteActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const isChildRouteActive = (paths: string[]) => paths.some((path) => isRouteActive(path));

  /** Pai ativo só com sidebar recolhida; expandida destaca apenas o submenu. */
  const isParentNavActive = (childPaths: string[]) =>
    isSidebarCollapsed && isChildRouteActive(childPaths);

  const FINANCEIRO_CASHFLOW_PATHS = [
    '/financeiro/reports',
    '/financeiro/balances',
    '/financeiro/adjustments',
    '/financeiro/billing',
  ];
  const IND_FINANCEIRO_PATHS = ['/indicadores/fluxo-de-caixa'];
  const IND_LOGISTICA_PATHS = ['/indicadores/logistica/meta-faturamento'];

  // Get Breadcrumb text based on active route and environment
  const getBreadcrumbText = () => {
    let env = selectedEnvironment || 'Geral';
    if (env === 'RH') {
      env = 'Recursos Humanos (RH)';
    }
    const path = location.pathname;

    if (path === '/') return `${env} / Painel Geral`;
    if (path.startsWith('/compras/controle-estoque')) return `${env} / Controle de estoque`;
    if (path.startsWith('/compras')) return `${env} / Home Compras`;
    if (path.startsWith('/rh/movimentacoes')) return `${env} / Movimentações`;
    if (path.startsWith('/rh')) return env;
    if (path.startsWith('/admin/usuarios')) return `Administração / Controle Geral`;
    if (path.startsWith('/admin')) return `Administração / Home`;
    if (path.startsWith('/relatorios')) return `${env} / Inclusão de Relatórios`;
    if (path.startsWith('/financeiro/home')) return `${env} / Dashboard Financeiro`;

    if (path.startsWith('/financeiro/reports')) return `${env} / Fluxo de Caixa / Inclusão de Relatórios`;
    if (path.startsWith('/financeiro/balances')) return `${env} / Fluxo de Caixa / Saldos Bancários`;
    if (path.startsWith('/financeiro/adjustments')) return `${env} / Fluxo de Caixa / Ajustes de Caixa`;
    if (path.startsWith('/financeiro/billing')) return `${env} / Fluxo de Caixa / Faturamento`;
    if (path.startsWith('/indicadores/logistica/meta-faturamento')) return `${env} / Logística / Meta de faturamento`;
    if (path.startsWith('/indicadores/fluxo-de-caixa')) return `${env} / Financeiro / Fluxo de Caixa`;
    if (path.startsWith('/indicadores')) return `${env} / Home Indicadores`;
    
    return `${env} / Principal`;
  };

  return (
    <div className="app-container" id="app-container" style={{ display: 'flex' }}>
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} id="sidebar">
        <div className="sidebar-brand" onClick={handleChangeEnv} title="Alterar ERP / Sair">
          <img src={logoExpanded} alt="TccConex Logo" className="brand-logo logo-expanded" />
          <img src={logoCollapsed} alt="TccConex Logo Fechado" className="brand-logo logo-collapsed" />
        </div>
        
        <nav className="sidebar-nav">
          {/* General Home/Dashboard — oculto nos ambientes com home própria */}
          {selectedEnvironment !== 'Financeiro' && selectedEnvironment !== 'Indicadores' && selectedEnvironment !== 'Compras' && selectedEnvironment !== 'RH' && !isAdminEnvironment(selectedEnvironment) && (
            <Link 
              to="/" 
              className={`nav-btn ${isRouteActive('/') ? 'active' : ''}`} 
              data-tooltip="Painel Geral"
            >
              <div className="nav-btn-left">
                <NavIcon name="house" />
                <span className="nav-text">Painel Geral</span>
              </div>
            </Link>
          )}

          {/* Admin Workspace Group */}
          {isAdminEnvironment(selectedEnvironment) && (
            <div id="sidebar-admin-group" style={{ width: '100%' }}>
              {/* Home Admin */}
              <Link
                to="/admin"
                className={`nav-btn ${location.pathname === '/admin' || location.pathname === '/admin/' ? 'active' : ''}`}
                data-tooltip="Home Admin"
              >
                <div className="nav-btn-left">
                  <NavIcon name="house" />
                  <span className="nav-text">Home Admin</span>
                </div>
              </Link>

              {/* Gerenciar Usuários */}
              <Link
                to="/admin/usuarios"
                className={`nav-btn ${isRouteActive('/admin/usuarios') ? 'active' : ''}`}
                data-tooltip="Usuários"
              >
                <div className="nav-btn-left">
                  <NavIcon name="people" />
                  <span className="nav-text">Usuários</span>
                </div>
              </Link>
            </div>
          )}

          {/* Indicadores Workspace */}
          {selectedEnvironment === 'Indicadores' && (
            <div id="sidebar-indicadores-group" style={{ width: '100%' }}>
              <Link
                to="/indicadores"
                className={`nav-btn ${location.pathname === '/indicadores' || location.pathname === '/indicadores/' ? 'active' : ''}`}
                data-tooltip="Home Indicadores"
              >
                <div className="nav-btn-left">
                  <NavIcon name="house" />
                  <span className="nav-text">Home Indicadores</span>
                </div>
              </Link>

              <div className="nav-group-wrapper" id="btn-menu-indicadores-financeiro">
                <button
                  type="button"
                  className={`nav-btn ${isParentNavActive(IND_FINANCEIRO_PATHS) ? 'active-parent' : ''}`}
                  onClick={() => setIsIndFinanceiroSubmenuOpen(!isIndFinanceiroSubmenuOpen)}
                >
                  <div className="nav-btn-left">
                    <NavIcon name="coin" />
                    <span className="nav-text">Financeiro</span>
                  </div>
                  <ChevronSubmenu open={isIndFinanceiroSubmenuOpen} />
                </button>

                <div
                  className="submenu-container"
                  style={{
                    display: isSidebarCollapsed ? undefined : 'block',
                    maxHeight: isSidebarCollapsed ? undefined : (isIndFinanceiroSubmenuOpen ? '80px' : '0px'),
                    overflow: 'hidden',
                    transition: 'max-height 0.25s ease',
                  }}
                >
                  <Link
                    to="/indicadores/fluxo-de-caixa"
                    className={`nav-btn sub-nav-btn ${isRouteActive('/indicadores/fluxo-de-caixa') ? 'active' : ''}`}
                  >
                    <div className="nav-btn-left">
                      <NavIcon name="arrow-down-up" sub />
                      <span className="nav-text">Fluxo de caixa</span>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="nav-group-wrapper" id="btn-menu-indicadores-logistica">
                <button
                  type="button"
                  className={`nav-btn ${isParentNavActive(IND_LOGISTICA_PATHS) ? 'active-parent' : ''}`}
                  onClick={() => setIsIndLogisticaSubmenuOpen(!isIndLogisticaSubmenuOpen)}
                >
                  <div className="nav-btn-left">
                    <NavIcon name="truck" />
                    <span className="nav-text">Logística</span>
                  </div>
                  <ChevronSubmenu open={isIndLogisticaSubmenuOpen} />
                </button>

                <div
                  className="submenu-container"
                  style={{
                    display: isSidebarCollapsed ? undefined : 'block',
                    maxHeight: isSidebarCollapsed ? undefined : (isIndLogisticaSubmenuOpen ? '80px' : '0px'),
                    overflow: 'hidden',
                    transition: 'max-height 0.25s ease',
                  }}
                >
                  <Link
                    to="/indicadores/logistica/meta-faturamento"
                    className={`nav-btn sub-nav-btn ${isRouteActive('/indicadores/logistica/meta-faturamento') ? 'active' : ''}`}
                  >
                    <div className="nav-btn-left">
                      <NavIcon name="graph-up-arrow" sub />
                      <span className="nav-text">Meta de faturamento</span>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Financeiro Workspace Group */}
          {selectedEnvironment === 'Financeiro' && (
            <div id="sidebar-financeiro-group" style={{ width: '100%' }}>
              {/* Home Financeiro */}
              <Link 
                to="/financeiro/home" 
                className={`nav-btn ${isRouteActive('/financeiro/home') ? 'active' : ''}`} 
                data-tooltip="Home Financeiro"
              >
                <div className="nav-btn-left">
                  <NavIcon name="house" />
                  <span className="nav-text">Home Financeiro</span>
                </div>
              </Link>



              {/* Fluxo de Caixa Collapsible Submenu */}
              <div className="nav-group-wrapper" id="btn-menu-financeiro-cashflow">
                <button 
                  type="button" 
                  className={`nav-btn ${isParentNavActive(FINANCEIRO_CASHFLOW_PATHS) ? 'active-parent' : ''}`}
                  onClick={() => setIsCashflowSubmenuOpen(!isCashflowSubmenuOpen)}
                >
                  <div className="nav-btn-left">
                    <NavIcon name="arrow-down-up" />
                    <span className="nav-text">Fluxo de caixa</span>
                  </div>
                  <ChevronSubmenu open={isCashflowSubmenuOpen} />
                </button>
                
                <div 
                  className="submenu-container" 
                  style={{ 
                    display: isSidebarCollapsed ? undefined : 'block',
                    maxHeight: isSidebarCollapsed ? undefined : (isCashflowSubmenuOpen ? '200px' : '0px'), 
                    overflow: 'hidden', 
                    transition: 'max-height 0.25s ease' 
                  }}
                >
                  {/* Relatórios */}
                  <Link 
                    to="/financeiro/reports" 
                    className={`nav-btn sub-nav-btn ${isRouteActive('/financeiro/reports') ? 'active' : ''}`}
                  >
                    <div className="nav-btn-left">
                      <NavIcon name="file-earmark-arrow-down" sub />
                      <span className="nav-text">Inclusão de Relatórios</span>
                    </div>
                  </Link>
                  {/* Saldos Bancários */}
                  <Link 
                    to="/financeiro/balances" 
                    className={`nav-btn sub-nav-btn ${isRouteActive('/financeiro/balances') ? 'active' : ''}`}
                  >
                    <div className="nav-btn-left">
                      <NavIcon name="bank" sub />
                      <span className="nav-text">Saldos Bancários</span>
                    </div>
                  </Link>
                  {/* Ajustes de caixa */}
                  <Link 
                    to="/financeiro/adjustments" 
                    className={`nav-btn sub-nav-btn ${isRouteActive('/financeiro/adjustments') ? 'active' : ''}`}
                  >
                    <div className="nav-btn-left">
                      <NavIcon name="sliders" sub />
                      <span className="nav-text">Ajustes de caixa</span>
                    </div>
                  </Link>
                  {/* Faturamento */}
                  <Link 
                    to="/financeiro/billing" 
                    className={`nav-btn sub-nav-btn ${isRouteActive('/financeiro/billing') ? 'active' : ''}`}
                  >
                    <div className="nav-btn-left">
                      <NavIcon name="receipt" sub />
                      <span className="nav-text">Faturamento</span>
                    </div>
                  </Link>
                </div>
              </div>

              </div>
            )}

            {/* Compras Workspace Group */}
            {selectedEnvironment === 'Compras' && (
              <div id="sidebar-compras-group" style={{ width: '100%' }}>
                {/* Home Compras */}
                <Link 
                  to="/compras" 
                  className={`nav-btn ${location.pathname === '/compras' ? 'active' : ''}`} 
                  data-tooltip="Home Compras"
                >
                  <div className="nav-btn-left">
                    <NavIcon name="house" />
                    <span className="nav-text">Home Compras</span>
                  </div>
                </Link>

                {/* Controle de estoque */}
                <Link 
                  to="/compras/controle-estoque" 
                  className={`nav-btn ${isRouteActive('/compras/controle-estoque') ? 'active' : ''}`} 
                  data-tooltip="Controle de estoque"
                >
                  <div className="nav-btn-left">
                    <NavIcon name="box" />
                    <span className="nav-text">Controle de estoque</span>
                  </div>
                </Link>
              </div>
            )}

            {selectedEnvironment === 'RH' && (
              <div id="sidebar-rh-group" style={{ width: '100%' }}>
                {/* Home RH */}
                <Link 
                  to="/rh" 
                  className={`nav-btn ${location.pathname === '/rh' || location.pathname === '/rh/' ? 'active' : ''}`} 
                  data-tooltip="Home RH"
                >
                  <div className="nav-btn-left">
                    <NavIcon name="house" />
                    <span className="nav-text">Home RH</span>
                  </div>
                </Link>

                {/* Movimentações RH */}
                <Link
                  to="/rh/movimentacoes"
                  className={`nav-btn ${isRouteActive('/rh/movimentacoes') ? 'active' : ''}`}
                  data-tooltip="Movimentações"
                >
                  <div className="nav-btn-left">
                    <NavIcon name="arrow-left-right" />
                    <span className="nav-text">Movimentações</span>
                  </div>
                </Link>
              </div>
            )}
          </nav>

        {/* Sidebar Collapse Toggle */}
        <div className="sidebar-collapse-container" id="btn-collapse-sidebar" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
          <i
            className="bi bi-chevron-left chevron-collapse"
            aria-hidden="true"
            style={{
              transform: isSidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        <header className="app-header">
          <div className="header-breadcrumb" id="header-breadcrumb" style={{ cursor: 'pointer' }} onClick={() => { setPaletteQuery(''); setIsPaletteOpen(true); }}>
            <span id="breadcrumb-text">{getBreadcrumbText()}</span>
            <svg className="breadcrumb-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '2px' }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <div 
            className="header-user" 
            id="btn-header-user" 
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
          >
            <div className="user-avatar" id="user-avatar-initials">{initials}</div>
            <div className="user-info">
              <span className="user-name" id="user-display-name">{user?.name}</span>
              <span className="user-role" id="user-display-role">{user?.roleId === '1' ? 'Administrador' : 'Operador'}</span>
            </div>
            
            {/* User Dropdown Menu */}
            <div className={`user-dropdown ${isUserDropdownOpen ? 'show' : ''}`} id="user-dropdown">
              <div className="dropdown-item" id="btn-dropdown-env" onClick={handleChangeEnv}>
                <i className="bi bi-box dropdown-item-icon" aria-hidden="true" />
                <span>Alterar módulo</span>
              </div>
              <div className="dropdown-item" id="btn-dropdown-logout" onClick={logout}>
                <i className="bi bi-box-arrow-right dropdown-item-icon" aria-hidden="true" />
                <span>Logout</span>
              </div>
            </div>
          </div>
        </header>
        
        {/* Main Content Area */}
        <main className="content">
          <Outlet />
        </main>
      </div>

      {/* MODAL DE BUSCA COMANDO PALETTE (BUSCA RÁPIDA) */}
      {isPaletteOpen && (
        <div 
          className="search-backdrop" 
          id="search-modal" 
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPaletteOpen(false);
          }}
        >
          <div className="search-modal-card">
            <div className="search-input-wrapper">
              <svg className="search-modal-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                placeholder="Pesquisar funções do sistema..." 
                autoComplete="off"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                autoFocus
              />
              <span className="search-close-key" onClick={() => setIsPaletteOpen(false)}>ESC</span>
            </div>
            <div className="search-results">
              {filteredPalette.length === 0 ? (
                <div className="search-no-results">Nenhuma função encontrada para "{paletteQuery}"</div>
              ) : (
                filteredPalette.map((f, index) => (
                  <div 
                    key={index} 
                    className="search-item"
                    onClick={() => {
                      f.action();
                      setIsPaletteOpen(false);
                    }}
                  >
                    <div className="search-item-left">
                      {f.icon}
                      <div>
                        <div className="search-item-title">{f.title}</div>
                        <div className="search-item-path">{f.path}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;