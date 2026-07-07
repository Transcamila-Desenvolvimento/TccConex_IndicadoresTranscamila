import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logoImg from '../assets/Logo_TccConex.png';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect to environment selection
    if (isAuthenticated) {
      navigate('/select-environment');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/select-environment');
      } else {
        setError('Credenciais inválidas ou usuário inativo.');
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'SERVER_OFFLINE') {
        setError('Servidor indisponível. Inicie o backend com start.ps1 ou runserver 8001.');
      } else {
        setError('Erro ao efetuar login. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container" id="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src={logoImg} alt="TccConex Logo" className="login-logo" />
          <h2>Bem-vindo de volta</h2>
          <p>Acesse seu ERP seguro e integrado</p>
        </div>
        <form id="login-form" onSubmit={handleSubmit}>
          <div className="login-group">
            <label htmlFor="username">Usuário</label>
            <input 
              type="text" 
              id="username" 
              placeholder="Digite seu usuário" 
              required 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" 
            />
          </div>
          <div className="login-group">
            <label htmlFor="password">Senha</label>
            <input 
              type="password" 
              id="password" 
              placeholder="Digite sua senha" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" 
            />
          </div>
          
          {error && (
            <div id="login-error" className="login-error">
              {error}
            </div>
          )}

          <button type="submit" className="btn-login" id="btn-login" disabled={isSubmitting}>
            {!isSubmitting ? (
              <span>Entrar no Sistema</span>
            ) : (
              <>
                <span>Processando...</span>
                <div className="login-spinner" id="login-spinner"></div>
              </>
            )}
          </button>
        </form>
        <div className="login-footer">
          &copy; 2026 TccConex ERP - Transcamila Cargas e Armazéns Gerais Ltda
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
