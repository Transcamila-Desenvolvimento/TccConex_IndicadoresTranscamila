import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useGoogleAccount } from '../hooks/useGoogleAccount';

const GoogleCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeGoogleLink } = useGoogleAccount();
  const [message, setMessage] = useState('Concluindo vinculação com Google...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setMessage('Vinculação cancelada ou negada pelo Google.');
      return;
    }

    if (!code || !state) {
      setMessage('Parâmetros de retorno inválidos.');
      return;
    }

    completeGoogleLink({ code, state })
      .then(() => {
        navigate('/select-environment', { replace: true, state: { view: 'perfil' } });
      })
      .catch((error: unknown) => {
        if (axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
          setMessage(error.response.data.detail);
          return;
        }
        setMessage('Falha ao vincular conta Google.');
      });
  }, [completeGoogleLink, navigate, searchParams]);

  return (
    <div className="login-container">
      <div className="login-card" style={{ width: '420px' }}>
        <div className="login-header" style={{ marginBottom: '24px' }}>
          <h2>Conta Google</h2>
          <p>{message}</p>
        </div>
        <button
          type="button"
          className="btn-login"
          onClick={() => navigate('/select-environment', { state: { view: 'perfil' } })}
        >
          <span>Voltar ao perfil</span>
        </button>
      </div>
    </div>
  );
};

export default GoogleCallbackPage;
