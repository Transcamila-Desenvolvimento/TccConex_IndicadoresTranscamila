import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { UserDirectoryEntry } from '../types/domain';
import { syncMarketingQueriesSilently, type MarketingSyncHint } from './marketingSilentSync';

export type MarketingPresenceStatus = 'connecting' | 'connected' | 'disconnected';

function presenceWsUrl(token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/marketing/presence/?token=${encodeURIComponent(token)}`;
}

type WsCampanhaMessage = {
  type: 'campanha';
  event?: string;
  campanhaId?: string | null;
  actorUserId?: string | null;
};

function scheduleSilentMarketingSync(
  queryClient: ReturnType<typeof useQueryClient>,
  timerRef: { current: number | null },
  hint: MarketingSyncHint,
) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
  }
  timerRef.current = window.setTimeout(() => {
    void syncMarketingQueriesSilently(queryClient, hint);
  }, 300);
}

export function useMarketingPresence(enabled = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState<UserDirectoryEntry[]>([]);
  const [status, setStatus] = useState<MarketingPresenceStatus>('connecting');

  const attemptRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const invalidateTimerRef = useRef<number | null>(null);
  const userIdRef = useRef(user?.id);

  userIdRef.current = user?.id;

  useEffect(() => {
    if (!enabled) return undefined;

    const token = apiService.getToken();
    if (!token) {
      setStatus('disconnected');
      setOnline([]);
      return undefined;
    }

    let cancelled = false;

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(1000 * 2 ** attemptRef.current, 30_000);
      attemptRef.current += 1;
      timerRef.current = window.setTimeout(connect, delay);
    };

    const scheduleMarketingSync = (message: WsCampanhaMessage) => {
      if (message.actorUserId && userIdRef.current && message.actorUserId === userIdRef.current) {
        return;
      }
      scheduleSilentMarketingSync(queryClient, invalidateTimerRef, {
        campanhaId: message.campanhaId,
        event: message.event,
      });
    };

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');

      const ws = new WebSocket(presenceWsUrl(token));
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        attemptRef.current = 0;
        setStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as
            | { type?: string; online?: UserDirectoryEntry[] }
            | WsCampanhaMessage;

          if (data.type === 'presence' && Array.isArray(data.online)) {
            setOnline(data.online);
            return;
          }

          if (data.type === 'campanha') {
            scheduleMarketingSync(data as WsCampanhaMessage);
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus('disconnected');
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (invalidateTimerRef.current !== null) window.clearTimeout(invalidateTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, queryClient]);

  return { online, status };
}
