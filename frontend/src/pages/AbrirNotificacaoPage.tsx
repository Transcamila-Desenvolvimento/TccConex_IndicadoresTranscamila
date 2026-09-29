import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLoader from '../components/PageLoader';
import { useAuth } from '../contexts/AuthContext';
import { environmentRequiresFilial } from '../constants/environments';
import { useMarcarNotificacaoLida } from '../hooks/useNotificacoes';

/** Destino do clique no aviso do Windows: marca como lida, ajusta o módulo da sessão e abre o link. */
const AbrirNotificacaoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedEnvironment, selectEnvironmentAndFilial } = useAuth();
  const marcarLida = useMarcarNotificacaoLida();
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    if (!id) {
      navigate('/', { replace: true });
      return;
    }
    marcarLida.mutate(id, {
      onSuccess: (item) => {
        if (item.ambiente && item.ambiente !== selectedEnvironment) {
          if (environmentRequiresFilial(item.ambiente)) {
            navigate('/select-environment', { replace: true });
            return;
          }
          selectEnvironmentAndFilial(item.ambiente, '');
        }
        navigate(item.link || '/', { replace: true });
      },
      onError: () => navigate('/', { replace: true }),
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return <PageLoader message="Abrindo notificação..." />;
};

export default AbrirNotificacaoPage;
