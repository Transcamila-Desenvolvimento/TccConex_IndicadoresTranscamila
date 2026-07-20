import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChangePassword } from '../hooks/useAuthProfile';
import logoImg from '../assets/Logo_TccConex.png';

const ChangePasswordPage: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const changePassword = useChangePassword();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (user && !user.mustChangePassword) {
      navigate('/select-environment', { replace: true });
    }
  }, [isAuthenticated, isLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação não coincide com a nova senha.');
      return;
    }

    try {
      await changePassword.mutateAsync({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      navigate('/select-environment', { replace: true });
    } catch (err: any) {
      const data = err?.response?.data;
      const message =
        data?.currentPassword?.[0]
        || data?.newPassword?.[0]
        || data?.confirmPassword?.[0]
        || data?.detail
        || 'Não foi possível alterar a senha. Tente novamente.';
      setError(message);
    }
  };

  if (isLoading || !user?.mustChangePassword) {
    return null;
  }

  return (
    <div className="login-container" id="change-password-container">
      <div className="login-card">
        <div className="login-header">
          <img src={logoImg} alt="TccConex Logo" className="login-logo" />
          <h2>Redefinição de senha</h2>
          <p>
            Olá, {user.name || user.username}. Por segurança, altere sua senha
            antes de continuar.
          </p>
        </div>
        <form id="change-password-form" onSubmit={handleSubmit}>
          <div className="login-group">
            <label htmlFor="current-password">Senha atual</label>
            <input
              type="password"
              id="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="login-group">
            <label htmlFor="new-password">Nova senha</label>
            <input
              type="password"
              id="new-password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="login-group">
            <label htmlFor="confirm-password">Confirmar nova senha</label>
            <input
              type="password"
              id="confirm-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div id="change-password-error" className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-login"
            id="btn-change-password"
            disabled={changePassword.isPending}
          >
            {!changePassword.isPending ? (
              <span>Salvar nova senha</span>
            ) : (
              <>
                <span>Salvando...</span>
                <div className="login-spinner" />
              </>
            )}
          </button>
        </form>
        <div className="login-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <button
            type="button"
            className="reports-action-btn secondary"
            style={{ height: 32, fontSize: 12 }}
            onClick={() => logout()}
          >
            Sair
          </button>
          <span>&copy; 2026 TccConex ERP</span>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
