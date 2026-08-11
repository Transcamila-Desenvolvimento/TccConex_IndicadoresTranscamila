import { useEffect, useRef, useState } from 'react';

import { apiService } from '../services/apiService';
import type { UserDirectoryEntry } from '../types/domain';

export type MarketingPresenceStatus = 'connecting' | 'connected' | 'disconnected';

function presenceWsUrl(token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/marketing/presence/?token=${encodeURIComponent(token)}`;
}

export function useMarketingPresence(enabled = true) {
  const [online, setOnline] = useState<UserDirectoryEntry[]>([]);
  const [status, setStatus] = useState<MarketingPresenceStatus>('connecting');

  const attemptRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);

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
          const data = JSON.parse(event.data) as { type?: string; online?: UserDirectoryEntry[] };
          if (data.type === 'presence' && Array.isArray(data.online)) {
            setOnline(data.online);
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
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled]);

  return { online, status };
}
