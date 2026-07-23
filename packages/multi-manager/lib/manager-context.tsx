'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import {
  api,
  clearStoredToken,
  getStoredToken,
  nowLabel,
  setStoredToken,
  type ApiError,
  type AuthStatus,
  type LogEntry,
  type ManagerState
} from '@/lib/api';

type AuthState = {
  checking: boolean;
  configured: boolean;
  verified: boolean;
};

type ActionOptions = Omit<RequestInit, 'body'> & { body?: unknown };

type ManagerContextValue = {
  auth: AuthState;
  state: ManagerState | null;
  logs: LogEntry[];
  loading: boolean;
  busy: string;
  refresh: (opts?: { silent?: boolean }) => Promise<ManagerState | null>;
  runAction: <T = unknown>(name: string, path: string, options?: ActionOptions) => Promise<T>;
  setupToken: (token: string) => Promise<void>;
  verifyToken: (token: string) => Promise<void>;
  logout: () => void;
  addLog: (message: string, data?: unknown) => void;
  clearLogs: () => void;
};
const ManagerContext = createContext<ManagerContextValue | null>(null);

function isUnauthorized(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const status = 'status' in err ? err.status : undefined;
  if (status === 401) return true;
  const data = 'data' in err ? err.data : undefined;
  return Boolean(data && typeof data === 'object' && 'error' in data && data.error === 'unauthorized');
}

export function ManagerProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ checking: true, configured: false, verified: false });
  const [state, setState] = useState<ManagerState | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const mounted = useRef(true);

  const addLog = useCallback((message: string, data?: unknown) => {
    setLogs((items) => [{ time: nowLabel(), message, data }, ...items].slice(0, 120));
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await api<ManagerState>('/api/state');
      if (!mounted.current) return null;
      setState(data);
      setAuth((current) => ({
        ...current,
        configured: Boolean(data.auth?.configured),
        verified: true,
        checking: false
      }));
      return data;
    } finally {
      if (!silent && mounted.current) setLoading(false);
    }
  }, []);

  const runAction = useCallback(
    async <T,>(name: string, path: string, options: ActionOptions = {}) => {
      setBusy(name);
      addLog(`${name}...`);
      try {
        const result = await api<T>(path, options);
        addLog(`${name} 完成`, result);
        await refresh({ silent: true });
        return result;
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        addLog(`${name} 失败`, apiErr.data || apiErr.message);
        throw err;
      } finally {
        setBusy('');
      }
    },
    [addLog, refresh]
  );

  const setupToken = useCallback(
    async (token: string) => {
      await api('/api/auth/setup', { method: 'POST', body: { token }, token: '' });
      setStoredToken(token);
      setAuth({ checking: false, configured: true, verified: true });
      addLog('已设置访问 token');
      await refresh();
    },
    [addLog, refresh]
  );

  const verifyToken = useCallback(
    async (token: string) => {
      await api('/api/auth/verify', { method: 'POST', body: { token }, token: '' });
      setStoredToken(token);
      setAuth({ checking: false, configured: true, verified: true });
      addLog('Token 验证成功');
      await refresh();
    },
    [addLog, refresh]
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setAuth({ checking: false, configured: true, verified: false });
    setState(null);
    addLog('已退出本地会话');
  }, [addLog]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    async function boot() {
      try {
        const status = await api<{ auth: AuthStatus }>('/api/auth/status', { token: '' });
        if (cancelled) return;
        const configured = Boolean(status.auth?.configured);
        if (!configured) {
          setAuth({ checking: false, configured: false, verified: false });
          setLoading(false);
          return;
        }
        if (!getStoredToken()) {
          setAuth({ checking: false, configured: true, verified: false });
          setLoading(false);
          return;
        }
        setAuth({ checking: false, configured: true, verified: true });
        await refresh();
        addLog('已连接本地管理器');
      } catch (err: unknown) {
        if (cancelled) return;
        setAuth((current) => ({ ...current, checking: false, verified: false }));
        setLoading(false);
        addLog('初始化失败', err instanceof Error ? err.message : String(err));
      }
    }

    boot();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [addLog, refresh]);

  useEffect(() => {
    if (!auth.verified) return undefined;
    const timer = window.setInterval(() => {
      refresh({ silent: true }).catch((err: unknown) => {
        if (isUnauthorized(err)) {
          clearStoredToken();
          setAuth((current) => ({ ...current, verified: false }));
        }
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [auth.verified, refresh]);

  const value = useMemo(
    () => ({
      auth,
      state,
      logs,
      loading,
      busy,
      refresh,
      runAction,
      setupToken,
      verifyToken,
      logout,
      addLog,
      clearLogs
    }),
    [auth, state, logs, loading, busy, refresh, runAction, setupToken, verifyToken, logout, addLog, clearLogs]
  );

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}

export function useManager() {
  const ctx = useContext(ManagerContext);
  if (!ctx) throw new Error('useManager must be used within ManagerProvider');
  return ctx;
}
