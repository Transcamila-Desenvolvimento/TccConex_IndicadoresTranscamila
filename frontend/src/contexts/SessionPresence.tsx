import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '../services/apiService';

const SessionPresenceContext = createContext<ReadonlySet<string>>(new Set());

function presenceWsUrl(token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/presence/?token=${encodeURIComponent(token)}`;
}

/** Uma conexão por aba autenticada. O servidor empurra a lista quando alguém entra ou sai. */
export const SessionPresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(() => new Set());
  const attemptRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setOnlineIds(new Set());
      return undefined;
    }

    const token = apiService.getToken();
    if (!token) {
      setOnlineIds(new Set());
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
      const ws = new WebSocket(presenceWsUrl(token));
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        attemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string; onlineIds?: string[] };
          if (data.type === 'presence' && Array.isArray(data.onlineIds)) {
            setOnlineIds(new Set(data.onlineIds));
          }
        } catch {
          /* quadro inválido */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
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
  }, [isAuthenticated]);

  return (
    <SessionPresenceContext.Provider value={onlineIds}>
      {children}
    </SessionPresenceContext.Provider>
  );
};

export function useSessionOnlineIds(): ReadonlySet<string> {
  return useContext(SessionPresenceContext);
}
