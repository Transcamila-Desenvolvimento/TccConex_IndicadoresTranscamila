import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { NOTIFICACOES_KEY } from '../hooks/useNotificacoes';

/** Recebe do service worker o clique num aviso do Windows com o ERP já aberto. */
const NotificacaoSwListener: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      const dados = event.data as { tipo?: string; destino?: string } | null;
      if (dados?.tipo !== 'abrir-notificacao' || !dados.destino?.startsWith('/')) return;
      void queryClient.invalidateQueries({ queryKey: NOTIFICACOES_KEY });
      navigate(dados.destino);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigate, queryClient]);

  return null;
};

export default NotificacaoSwListener;
