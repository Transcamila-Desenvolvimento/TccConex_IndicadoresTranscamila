import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useCompleteInstagramConnection } from '../../hooks/useMarketingInstagramPosts';

const InstagramCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const completeConnection = useCompleteInstagramConnection();
  const [message, setMessage] = useState('Concluindo vinculação com Instagram...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setMessage('Vinculação cancelada ou negada pela Meta.');
      return;
    }

    if (!code || !state) {
      setMessage('Parâmetros de retorno inválidos.');
      return;
    }

    completeConnection.mutate(
      { code, state },
      {
        onSuccess: () => {
          navigate('/marketing/instagram-posts', { replace: true });
        },
        onError: (error: unknown) => {
          if (axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
            setMessage(error.response.data.detail);
            return;
          }
          setMessage('Falha ao vincular conta Instagram.');
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- executar uma vez com params OAuth
  }, [searchParams]);

  return (
    <div className="login-container">
      <div className="login-card" style={{ width: '420px' }}>
        <div className="login-header" style={{ marginBottom: '24px' }}>
          <h2>Instagram</h2>
          <p>{message}</p>
        </div>
        <button
          type="button"
          className="btn-login"
          onClick={() => navigate('/marketing/instagram-posts')}
        >
          <span>Voltar às postagens</span>
        </button>
      </div>
    </div>
  );
};

export default InstagramCallbackPage;
