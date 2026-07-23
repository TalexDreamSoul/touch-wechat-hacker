export type AuthStatus = {
  configured: boolean;
};

export type HealthCheck = {
  ok: boolean;
  path?: string;
  error?: string;
};

export type PatchConfigOption = {
  name: string;
  path: string;
  recommended?: boolean;
};

export type MigrationNote = {
  field: string;
  from: string | null;
  to: string;
  reason: string;
};

export type ManagerConfig = {
  wechatApp: string;
  instanceRoot: string;
  launcherRoot: string;
  tmpRoot: string;
  antirecallTool: string;
  antirecallConfig: string;
  tweakTool: string;
  defaultTweakDylib: string;
  defaultExtraEnv: string;
  instances?: Instance[];
};

export type RuntimeMeta = {
  repoRoot: string;
  antirecallPackage: string;
  configPath: string;
  legacyConfigPath: string;
  defaults: Partial<ManagerConfig>;
  patchConfigs: PatchConfigOption[];
  migrations: MigrationNote[];
  migratedFromLegacy: boolean;
};

export type Instance = {
  id: string;
  name: string;
  homeDir?: string;
  tmpDir?: string;
  notes?: string;
  icon?: string;
  iconPreset?: string;
  enableTweak?: boolean;
  tweakDylib?: string;
  extraEnv?: string;
  createdAt?: string;
  running?: boolean;
  pid?: number | null;
  launcherPath?: string;
};

export type ManagerState = {
  config: ManagerConfig;
  configPath: string;
  meta: RuntimeMeta;
  iconPresets: Record<string, { name: string; color: string }>;
  health: { configPath: string; checks: Record<string, HealthCheck> };
  instances: Instance[];
  auth: AuthStatus;
};

export type LogEntry = {
  time: string;
  message: string;
  data?: unknown;
};

export type ApiError = Error & {
  status?: number;
  data?: unknown;
};

const TOKEN_KEY = 'touch-wechat-hacker-token';

export function getStoredToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_KEY) || '';
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

function parseJsonBody(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function errorMessageFromBody(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = data.error;
    if (typeof error === 'string' && error.length > 0) return error;
  }
  return fallback;
}

export async function api<T = unknown>(
  path: string,
  options: Omit<RequestInit, 'body'> & { token?: string; body?: unknown } = {}
): Promise<T> {
  const token = options.token !== undefined ? options.token : getStoredToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, {
    ...options,
    headers,
    body:
      options.body !== undefined && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : (options.body as BodyInit | null | undefined)
  });

  const text = await res.text();
  const data = parseJsonBody(text);

  if (!res.ok) {
    const err: ApiError = new Error(errorMessageFromBody(data, res.statusText || 'request failed'));
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export function nowLabel() {
  return new Date().toLocaleTimeString();
}

export function formatJson(data: unknown) {
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
}

export function stripEmptyStrings<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== '')) as Partial<T>;
}
