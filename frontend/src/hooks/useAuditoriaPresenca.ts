import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { UserDirectoryEntry } from '../types/domain';
import { SGQ_AUDITORIA_EXECUCAO_KEY } from './useSgqAuditorias';

export type AuditoriaPresencaStatus = 'connecting' | 'connected' | 'disconnected';

export type ColegaPergunta = UserDirectoryEntry & { itemId: string | null };

function presencaWsUrl(auditoriaId: string, token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/sgq/auditorias/${encodeURIComponent(auditoriaId)}/presence/?token=${encodeURIComponent(token)}`;
}

type MensagemResposta = {
  type: 'resposta';
  event?: string;
  itemId?: string | null;
  actorUserId?: string | null;
};

export type RascunhoRemoto = {
  itemId: string;
  opcaoCodigo: string;
  destaque: '' | 'forte' | 'fraco';
  actorName: string;
};

type MensagemRascunho = {
  type: 'rascunho';
  itemId?: string;
  opcaoCodigo?: string;
  destaque?: string;
  actorUserId?: string | null;
  actorName?: string;
};

function destaqueDe(valor: string | undefined): RascunhoRemoto['destaque'] {
  return valor === 'forte' || valor === 'fraco' ? valor : '';
}

export function useAuditoriaPresenca(auditoriaId: string, itemId: string | null) {
  const { user, selectedFilial } = useAuth();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState<ColegaPergunta[]>([]);
  const [status, setStatus] = useState<AuditoriaPresencaStatus>('connecting');
  const [rascunhos, setRascunhos] = useState<Map<string, RascunhoRemoto>>(() => new Map());
  const [rascunhoLocal, setRascunhoLocal] = useState<RascunhoRemoto | null>(null);

  const attemptRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const itemIdRef = useRef(itemId);
  const userIdRef = useRef(user?.id);
  itemIdRef.current = itemId;
  userIdRef.current = user?.id;

  useEffect(() => {
    if (!auditoriaId) return undefined;
    const token = apiService.getToken();
    if (!token) {
      setStatus('disconnected');
      setOnline([]);
      return undefined;
    }

    let cancelled = false;

    const enviarFoco = () => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'foco', itemId: itemIdRef.current ?? '' }));
    };

    const agendarSync = (mensagem: MensagemResposta) => {
      if (mensagem.actorUserId && userIdRef.current && mensagem.actorUserId === String(userIdRef.current)) return;
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: SGQ_AUDITORIA_EXECUCAO_KEY(selectedFilial, auditoriaId),
        });
      }, 300);
    };

    const reconectar = () => {
      if (cancelled) return;
      const espera = Math.min(1000 * 2 ** attemptRef.current, 30_000);
      attemptRef.current += 1;
      timerRef.current = window.setTimeout(conectar, espera);
    };

    const conectar = () => {
      if (cancelled) return;
      setStatus('connecting');
      const ws = new WebSocket(presencaWsUrl(auditoriaId, token));
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        attemptRef.current = 0;
        setStatus('connected');
        enviarFoco();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string; online?: ColegaPergunta[] } | MensagemResposta | MensagemRascunho;
          if (data.type === 'presence' && Array.isArray((data as { online?: ColegaPergunta[] }).online)) {
            setOnline((data as { online: ColegaPergunta[] }).online);
            return;
          }
          if (data.type === 'rascunho') {
            const remoto = data as MensagemRascunho;
            if (!remoto.itemId || !remoto.opcaoCodigo) return;
            if (remoto.actorUserId && userIdRef.current && remoto.actorUserId === String(userIdRef.current)) return;
            setRascunhos((atual) => {
              const proximo = new Map(atual);
              proximo.set(remoto.itemId as string, {
                itemId: remoto.itemId as string,
                opcaoCodigo: remoto.opcaoCodigo as string,
                destaque: destaqueDe(remoto.destaque),
                actorName: remoto.actorName || 'Outra pessoa',
              });
              return proximo;
            });
            return;
          }
          if (data.type === 'resposta') {
            const item = (data as MensagemResposta).itemId;
            if (item) {
              setRascunhos((atual) => {
                if (!atual.has(item)) return atual;
                const proximo = new Map(atual);
                proximo.delete(item);
                return proximo;
              });
              setRascunhoLocal((atual) => (atual?.itemId === item ? null : atual));
            }
            agendarSync(data);
          }
        } catch {
          /* quadro malformado */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus('disconnected');
        reconectar();
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    conectar();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [auditoriaId, queryClient, selectedFilial]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'foco', itemId: itemId ?? '' }));
  }, [itemId]);

  const meuId = user?.id != null ? String(user.id) : '';

  const colegasNaPergunta = useMemo(
    () => online.filter((pessoa) => pessoa.id !== meuId && pessoa.itemId && pessoa.itemId === itemId),
    [online, meuId, itemId],
  );

  const colegasPorPergunta = useMemo(() => {
    const mapa = new Map<string, ColegaPergunta[]>();
    online.forEach((pessoa) => {
      if (pessoa.id === meuId || !pessoa.itemId) return;
      const lista = mapa.get(pessoa.itemId) ?? [];
      lista.push(pessoa);
      mapa.set(pessoa.itemId, lista);
    });
    return mapa;
  }, [online, meuId]);

  const publicarRascunho = useCallback((perguntaId: string, opcaoCodigo: string, destaque: RascunhoRemoto['destaque'] = '') => {
    if (!opcaoCodigo) return;
    setRascunhoLocal({ itemId: perguntaId, opcaoCodigo, destaque, actorName: '' });
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'rascunho', itemId: perguntaId, opcaoCodigo, destaque }));
  }, []);

  const rascunhoRemoto = itemId ? rascunhos.get(itemId) ?? null : null;

  return { colegasNaPergunta, colegasPorPergunta, status, publicarRascunho, rascunhoRemoto, rascunhoLocal };
}
