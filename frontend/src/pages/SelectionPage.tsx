import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleAccount } from '../hooks/useGoogleAccount';
import { AUTH_PROFILE_QUERY_KEY } from '../hooks/useAuthProfile';
import {
  filterActiveEnvironments,
  ADMIN_ENVIRONMENT,
  ENVIRONMENT_CODES,
  type ActiveEnvironment,
} from '../constants/environments';
import logoImg from '../assets/Logo_TccConex.png';

const GLOBAL_ENVIRONMENTS = [ADMIN_ENVIRONMENT, 'Financeiro', 'Compras'];

const NOTION_PROJECT_URL =
  'https://transcamila-miguel.notion.site/ebd//37322feb02fe8012ba34da103c4ef203';

type SelectionView = 'ambiente' | 'perfil';

const ENV_BADGE_COLOR = '#0f85c1';

const ENV_META: Record<string, { code: string; color: string; text: string }> = {
  [ADMIN_ENVIRONMENT]: { code: ENVIRONMENT_CODES[ADMIN_ENVIRONMENT], color: ENV_BADGE_COLOR, text: 'Administração / Manutenção' },
  Indicadores: { code: ENVIRONMENT_CODES.Indicadores, color: ENV_BADGE_COLOR, text: 'Módulo de Indicadores' },
  Financeiro: { code: ENVIRONMENT_CODES.Financeiro, color: ENV_BADGE_COLOR, text: 'Módulo Financeiro' },
  Compras: { code: ENVIRONMENT_CODES.Compras, color: ENV_BADGE_COLOR, text: 'Módulo de Compras' },
  RH: { code: ENVIRONMENT_CODES.RH, color: ENV_BADGE_COLOR, text: 'Recursos Humanos' },
};

const formatLastLogin = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || 'US';
};

const GoogleIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.991 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.991 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.065 0-9.431-3.092-11.303-7.496l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

const SelectionPage: React.FC = () => {
  const { user, selectEnvironmentAndFilial, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { linkGoogle, unlinkGoogle, isLinking, isUnlinking, linkError, unlinkError } = useGoogleAccount();

  const [view, setView] = useState<SelectionView>('ambiente');
  const [ambiente, setAmbiente] = useState('');
  const [filial, setFilial] = useState('');
  const [allowedFiliais, setAllowedFiliais] = useState<string[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [googleCallbackError, setGoogleCallbackError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('google_linked') === '1') {
      setView('perfil');
      setGoogleCallbackError(null);
      void queryClient.invalidateQueries({ queryKey: AUTH_PROFILE_QUERY_KEY });
      navigate('/select-environment', { replace: true, state: { view: 'perfil' } });
    }
    const googleError = params.get('google_error');
    if (googleError) {
      setView('perfil');
      setGoogleCallbackError(decodeURIComponent(googleError));
      navigate('/select-environment', { replace: true, state: { view: 'perfil' } });
    }
    if (location.state && typeof location.state === 'object' && 'view' in location.state) {
      const nextView = (location.state as { view?: SelectionView }).view;
      if (nextView === 'perfil') setView('perfil');
    }
  }, [location.search, location.state, navigate, queryClient]);

  const userEnvironments = filterActiveEnvironments(user?.environments);

  useEffect(() => {
    if (!ambiente || GLOBAL_ENVIRONMENTS.includes(ambiente)) {
      setAllowedFiliais([]);
      setFilial('');
      return;
    }

    let branches: string[] = [];
    if (user?.roleId === '1') {
      branches = ['Ibiporã (Matriz)', 'Rondonópolis', 'Paranaguá'];
    } else if (user?.filiais) {
      branches = user.filiais[ambiente] || [];
    }

    setAllowedFiliais(branches);
    setFilial(branches[0] || '');
  }, [ambiente, user]);

  useEffect(() => {
    if (!isAboutOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAboutOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAboutOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ambiente) return;

    const finalFilial = GLOBAL_ENVIRONMENTS.includes(ambiente) ? '' : filial;
    selectEnvironmentAndFilial(ambiente, finalFilial);
    navigate('/');
  };

  const roleName = user?.roleId === '1' ? 'Administrador' : 'Operador';
  const isActive = (user?.status ?? '').toLowerCase() === 'ativo';

  const profileEnvironments = useMemo(
    () => userEnvironments.map((env) => ({
      name: env,
      ...(ENV_META[env] ?? { code: 'ERP', color: '#64748b', text: env }),
      filiais: GLOBAL_ENVIRONMENTS.includes(env) ? [] : (user?.filiais?.[env] ?? []),
    })),
    [user, userEnvironments],
  );

  const getEnvCode = (env: string) => ENV_META[env]?.code ?? 'ERP';

  const envData: { name: ActiveEnvironment; code: string; color: string; text: string }[] = [
    { name: ADMIN_ENVIRONMENT, code: ENVIRONMENT_CODES[ADMIN_ENVIRONMENT], color: ENV_BADGE_COLOR, text: `Administração / Manutenção (${ENVIRONMENT_CODES[ADMIN_ENVIRONMENT]})` },
    { name: 'Indicadores', code: ENVIRONMENT_CODES.Indicadores, color: ENV_BADGE_COLOR, text: `Módulo de Indicadores (${ENVIRONMENT_CODES.Indicadores})` },
    { name: 'Financeiro', code: ENVIRONMENT_CODES.Financeiro, color: ENV_BADGE_COLOR, text: `Módulo Financeiro (${ENVIRONMENT_CODES.Financeiro})` },
    { name: 'Compras', code: ENVIRONMENT_CODES.Compras, color: ENV_BADGE_COLOR, text: `Módulo de Compras (${ENVIRONMENT_CODES.Compras})` },
    { name: 'RH', code: ENVIRONMENT_CODES.RH, color: ENV_BADGE_COLOR, text: `Recursos Humanos (${ENVIRONMENT_CODES.RH})` },
  ];

  const filteredEnvs = envData.filter(env =>
    userEnvironments.includes(env.name) &&
    (env.name.toLowerCase().includes(searchQuery.toLowerCase()) || env.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div
      className={`login-container${view === 'perfil' ? ' selection-container--profile' : ' selection-container--ambiente'}`}
      id="selection-container"
    >
      {view === 'perfil' ? (
        <div className="selection-profile-shell">
          <header className="selection-profile-header">
            <nav className="selection-breadcrumb" aria-label="Navegação">
              <img src={logoImg} alt="TccConex" className="selection-breadcrumb-logo" />
              <span className="selection-breadcrumb-sep">/</span>
              <button type="button" className="selection-breadcrumb-link" onClick={() => setView('ambiente')}>
                Painel
              </button>
              <span className="selection-breadcrumb-sep">/</span>
              <span className="selection-breadcrumb-current">Perfil</span>
            </nav>
            <button type="button" className="selection-profile-back" onClick={() => setView('ambiente')}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>
          </header>

          <div className="selection-profile-card">
            <div className="selection-profile-card-head">
              <div className="selection-profile-avatar">{getInitials(user?.name ?? user?.username ?? 'US')}</div>
              <div>
                <h2 className="selection-profile-card-title">Meu Perfil</h2>
                <p className="selection-profile-card-subtitle">Dados da conta e integrações</p>
              </div>
            </div>

            <div className="selection-profile-fields">
              <div className="login-group">
                <label>Nome completo</label>
                <div className="selection-input-wrapper">
                  <input type="text" className="selection-input-value" value={user?.name || '—'} readOnly />
                </div>
              </div>
              <div className="login-group">
                <label>Usuário</label>
                <div className="selection-input-wrapper">
                  <input type="text" className="selection-input-value" value={user?.username || '—'} readOnly />
                </div>
              </div>
              <div className="login-group">
                <label>Função</label>
                <div className="selection-input-wrapper">
                  <input type="text" className="selection-input-value" value={roleName} readOnly />
                </div>
              </div>
              <div className="login-group">
                <label>Status</label>
                <div className="selection-input-wrapper">
                  <input type="text" className="selection-input-value" value={isActive ? 'Ativo' : 'Inativo'} readOnly />
                </div>
              </div>
              <div className="login-group">
                <label>Último acesso</label>
                <div className="selection-input-wrapper">
                  <input type="text" className="selection-input-value" value={formatLastLogin(user?.lastLogin ?? null)} readOnly />
                </div>
              </div>
            </div>

            <div className="selection-profile-block selection-profile-block--google">
              <div className="selection-profile-google-row">
                <div className="selection-profile-google-copy">
                  <h3>Conta Google Corporativa</h3>
                  <p>Use seu e-mail @transcamila.com.br para integrações e acesso unificado.</p>
                </div>

                <div className="selection-profile-google-action">
                  {user?.googleEmail ? (
                    <div className="selection-google-linked">
                      <div className="selection-google-linked-info">
                        <GoogleIcon />
                        <div>
                          <strong>{user.googleEmail}</strong>
                          <span>Vinculada{user.googleLinkedAt ? ` em ${formatLastLogin(user.googleLinkedAt)}` : ''}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="selection-google-unlink"
                        onClick={() => unlinkGoogle()}
                        disabled={isUnlinking}
                      >
                        {isUnlinking ? 'Desvinculando...' : 'Desvincular'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="selection-google-link-btn"
                      onClick={() => linkGoogle()}
                      disabled={isLinking}
                    >
                      <GoogleIcon />
                      <span>{isLinking ? 'Redirecionando...' : 'Vincular conta Google Corporativa'}</span>
                    </button>
                  )}
                </div>
              </div>

              {(linkError || unlinkError || googleCallbackError) && (
                <p className="selection-profile-alert" role="alert">
                  {linkError || unlinkError || googleCallbackError}
                </p>
              )}
            </div>

            <div className="selection-profile-block selection-profile-block--envs">
              <div className="selection-profile-block-head">
                <h3>Ambientes autorizados</h3>
              </div>
              {profileEnvironments.length === 0 ? (
                <p className="selection-profile-empty">Nenhum ambiente vinculado à conta.</p>
              ) : (
                <ul className="selection-profile-env-items">
                  {profileEnvironments.map((env) => (
                    <li key={env.name} className="selection-profile-env-item">
                      <span
                        className="selection-profile-env-badge"
                        style={{ color: env.color, background: `${env.color}14` }}
                      >
                        {env.code}
                      </span>
                      <div className="selection-profile-env-copy">
                        <strong>{env.name === 'RH' ? 'Recursos Humanos (RH)' : env.text}</strong>
                        <span>
                          {env.filiais.length > 0
                            ? env.filiais.join(' · ')
                            : 'Visão global'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="login-footer">
              &copy; 2026 TccConex ERP - Transcamila Cargas e Armazéns Gerais Ltda
            </div>
          </div>
        </div>
      ) : (
      <>
      <div className="login-card">
        <div className="login-header" style={{ marginBottom: '20px' }}>
          <img src={logoImg} alt="TccConex Logo" className="login-logo" />
          <h2>Parâmetros Iniciais</h2>
          <p>Configure os parâmetros para continuar</p>
        </div>

        <form id="selection-form" onSubmit={handleSubmit}>
          <div className="login-group">
            <label>Nome de Usuário</label>
            <div className="selection-input-wrapper">
              <div className="selection-input-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
              <input type="text" className="selection-input-value" value={user?.name || ''} readOnly />
            </div>
          </div>

          <div className="login-group">
            <label htmlFor="select-ambiente">Ambiente ERP</label>
            <div className="ambiente-row">
              <div className="selection-select-wrapper ambiente-select-col">
                <div className="selection-input-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4"></path>
                  </svg>
                </div>
                <select
                  id="select-ambiente"
                  className="selection-select"
                  required
                  value={ambiente}
                  onChange={(e) => setAmbiente(e.target.value)}
                >
                  <option value="" disabled>Selecione o ERP</option>
                  {userEnvironments.map((env) => (
                    <option key={env} value={env}>{env === 'RH' ? 'Recursos Humanos (RH)' : env}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="ambiente-code-btn"
                id="btn-search-ambiente"
                title="Pesquisar ERP"
                onClick={() => setIsSearchOpen(true)}
              >
                <span>{getEnvCode(ambiente)}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px', color: '#64748b' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </div>
          </div>

          {ambiente && !GLOBAL_ENVIRONMENTS.includes(ambiente) && (
            <div className="login-group" id="selection-filial-group">
              <label htmlFor="select-filial">Filial</label>
              <div className="selection-select-wrapper">
                <div className="selection-input-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                </div>
                <select
                  id="select-filial"
                  className="selection-select"
                  required
                  value={filial}
                  onChange={(e) => setFilial(e.target.value)}
                >
                  <option value="" disabled>Selecione a filial</option>
                  {allowedFiliais.map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button type="submit" className="btn-login" id="btn-confirm-selection" style={{ marginTop: '8px' }}>
            <span>Acessar Ambiente</span>
          </button>
        </form>

        <div className="selection-footer-links">
          <button
            type="button"
            className="footer-link-btn"
            id="btn-selection-profile"
            onClick={() => setView('perfil')}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            <span>Meu Perfil</span>
          </button>
          <span className="footer-link-divider">|</span>
          <button type="button" className="footer-link-btn" id="btn-back-to-login-selection" onClick={logout}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            <span>Encerrar sessão</span>
          </button>
        </div>
      </div>

      <div className="selection-page-footer">
        <button
          type="button"
          className="selection-about-btn"
          id="btn-about-project"
          onClick={() => setIsAboutOpen(true)}
        >
          <span>Conhecer mais sobre o projeto</span>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
        <div className="login-footer">
          &copy; 2026 TccConex ERP - Transcamila Cargas e Armazéns Gerais Ltda
        </div>
      </div>
      </>
      )}

      {isAboutOpen && (
        <div
          className="about-project-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Conhecer mais sobre o projeto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAboutOpen(false);
          }}
        >
          <div className="about-project-modal-panel">
            <div className="about-project-modal-toolbar">
              <span className="about-project-modal-title">Sobre o projeto</span>
              <button
                type="button"
                className="about-project-modal-close"
                onClick={() => setIsAboutOpen(false)}
                aria-label="Fechar"
              >
                <span>ESC</span>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="about-project-modal-embed">
              <iframe
                src={NOTION_PROJECT_URL}
                title="Conhecer mais sobre o projeto"
                frameBorder={0}
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {isSearchOpen && (
        <div className="search-backdrop" id="env-search-modal" style={{ display: 'flex' }} onClick={(e) => {
          if (e.target === e.currentTarget) setIsSearchOpen(false);
        }}>
          <div className="search-modal-card">
            <div className="search-input-wrapper">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                id="env-search-input"
                placeholder="Pesquisar módulo ERP autorizado..."
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <span className="search-close-key" onClick={() => setIsSearchOpen(false)}>ESC</span>
            </div>
            <div className="search-results" id="env-search-results">
              {filteredEnvs.length === 0 ? (
                <div className="search-no-results">Nenhum ambiente disponível ou autorizado para "{searchQuery}"</div>
              ) : (
                filteredEnvs.map(env => (
                  <div
                    key={env.name}
                    className="search-item"
                    onClick={() => {
                      setAmbiente(env.name);
                      setIsSearchOpen(false);
                    }}
                  >
                    <div className="search-item-left">
                      <svg className="search-item-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4"></path>
                      </svg>
                      <div>
                        <div className="search-item-title">{env.name === 'RH' ? 'Recursos Humanos (RH)' : env.name}</div>
                        <div className="search-item-path">{env.text}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: env.color, background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: '4px' }}>{env.code}</span>
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

export default SelectionPage;
