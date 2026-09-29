import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { environmentRequiresFilial } from '../constants/environments';
import QueryDataPanel from './QueryDataPanel';
import {
  useAtivarPushNotificacoes,
  useDesativarPushNotificacoes,
  useMarcarNotificacaoLida,
  useMarcarTodasNotificacoesLidas,
  useNotificacoes,
  useNotificacoesNaoLidas,
  usePushNavegador,
  usePushNotificacoesConfig,
  useSincronizarPushNotificacoes,
} from '../hooks/useNotificacoes';
import { atualizarServiceWorker } from '../services/webPush';
import type { Notificacao } from '../types/domain';

function tempoRelativo(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `há ${diffD} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

const NotificacoesBell: React.FC = () => {
  const navigate = useNavigate();
  const { selectedEnvironment, selectEnvironmentAndFilial } = useAuth();
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const naoLidasQuery = useNotificacoesNaoLidas();
  const listaQuery = useNotificacoes(aberto);
  const marcarLida = useMarcarNotificacaoLida();
  const marcarTodas = useMarcarTodasNotificacoesLidas();

  const pushConfigQuery = usePushNotificacoesConfig();
  const pushNavegadorQuery = usePushNavegador();
  const ativarPush = useAtivarPushNotificacoes();
  const desativarPush = useDesativarPushNotificacoes();
  const sincronizarPush = useSincronizarPushNotificacoes();
  const sincronizouPush = useRef(false);

  const naoLidas = naoLidasQuery.data ?? 0;
  const itens = listaQuery.data?.results ?? [];
  const pushConfig = pushConfigQuery.data;
  const pushNavegador = pushNavegadorQuery.data;
  const pushInscricao = pushNavegador?.inscricao ?? null;
  const pushOcupado = ativarPush.isPending || desativarPush.isPending;
  const pushErro = (ativarPush.error ?? desativarPush.error) as Error | null;

  useEffect(() => {
    if (sincronizouPush.current || !pushConfig?.habilitado || !pushInscricao) return;
    sincronizouPush.current = true;
    sincronizarPush.mutate(pushInscricao);
    void atualizarServiceWorker().catch(() => undefined);
  }, [pushConfig?.habilitado, pushInscricao]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aberto) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [aberto]);

  const abrirNotificacao = (item: Notificacao) => {
    if (!item.lida) marcarLida.mutate(item.id);
    setAberto(false);
    if (!item.link) return;
    if (
      item.ambiente
      && item.ambiente !== selectedEnvironment
      && !environmentRequiresFilial(item.ambiente)
    ) {
      selectEnvironmentAndFilial(item.ambiente, '');
    }
    navigate(item.link);
  };

  return (
    <div className="notif-bell" ref={containerRef}>
      <button
        type="button"
        className={`notif-bell-btn${aberto ? ' is-open' : ''}`}
        onClick={() => setAberto((v) => !v)}
        title="Notificações"
        aria-label={naoLidas ? `Notificações (${naoLidas} não lidas)` : 'Notificações'}
        aria-expanded={aberto}
      >
        <i className="bi bi-bell" aria-hidden="true" />
        {naoLidas > 0 && (
          <span className="notif-bell-count">{naoLidas > 99 ? '99+' : naoLidas}</span>
        )}
      </button>

      {aberto && (
        <div className="notif-bell-dropdown" role="dialog" aria-label="Notificações">
          <div className="notif-bell-header">
            <span className="notif-bell-title">Notificações</span>
            <button
              type="button"
              className="notif-bell-mark-all"
              onClick={() => marcarTodas.mutate()}
              disabled={naoLidas === 0 || marcarTodas.isPending}
            >
              Marcar todas como lidas
            </button>
          </div>
          <div className="notif-bell-body">
            <QueryDataPanel
              query={listaQuery}
              variant="compact"
              refreshVariant="overlay"
              loadingMessage="Carregando notificações..."
              errorMessage="Não foi possível carregar as notificações."
            >
              {itens.length === 0 ? (
                <div className="notif-bell-empty">
                  <i className="bi bi-bell-slash" aria-hidden="true" />
                  <span>Nenhuma notificação por aqui.</span>
                </div>
              ) : (
                <ul className="notif-bell-list">
                  {itens.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`notif-bell-item${item.lida ? '' : ' is-unread'}`}
                        onClick={() => abrirNotificacao(item)}
                      >
                        <span className="notif-bell-item-title">{item.titulo}</span>
                        {item.mensagem && <span className="notif-bell-item-msg">{item.mensagem}</span>}
                        <span className="notif-bell-item-meta">
                          {item.ambiente ? `${item.ambiente} · ` : ''}{tempoRelativo(item.criadaEm)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </QueryDataPanel>
          </div>
          {pushConfig?.habilitado && pushNavegador && (
            <div className="notif-bell-push">
              {!pushNavegador.suportado ? (
                <span className="notif-bell-push-info">
                  <i className="bi bi-bell-fill" aria-hidden="true" />
                  Este navegador não permite avisos do Windows (use Chrome ou Edge no endereço oficial do ERP).
                </span>
              ) : pushNavegador.permissao === 'denied' ? (
                <span className="notif-bell-push-info">
                  <i className="bi bi-exclamation-circle" aria-hidden="true" />
                  Avisos bloqueados. Clique no cadeado ao lado do endereço do site e permita “Notificações”.
                </span>
              ) : pushInscricao ? (
                <>
                  <span className="notif-bell-push-info is-on">
                    <i className="bi bi-check-circle-fill" aria-hidden="true" />
                    Avisos no Windows ativados neste navegador
                  </span>
                  <button
                    type="button"
                    className="notif-bell-push-link"
                    onClick={() => desativarPush.mutate()}
                    disabled={pushOcupado}
                  >
                    Desativar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="notif-bell-push-btn"
                  onClick={() => ativarPush.mutate(pushConfig.publicKey)}
                  disabled={pushOcupado}
                >
                  <i className="bi bi-bell-fill" aria-hidden="true" />
                  {ativarPush.isPending ? 'Ativando...' : 'Ativar avisos no Windows'}
                </button>
              )}
              {pushErro && <span className="notif-bell-push-erro">{pushErro.message}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificacoesBell;
