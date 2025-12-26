const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SYNC_SCHEMA || 'public';
const REST_BASE = (() => {
  if (!SUPABASE_URL) return '';
  const normalized = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
  return `${normalized}/rest/v1`;
})();

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);

export const assertSupabaseConfigured = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }
};

export const supabaseHeaders = () => {
  if (!SUPABASE_KEY) return {};
  const schemaHeaders =
    SUPABASE_SCHEMA && SUPABASE_SCHEMA !== 'public'
      ? { 'Accept-Profile': SUPABASE_SCHEMA, 'Content-Profile': SUPABASE_SCHEMA }
      : {};
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...schemaHeaders,
  };
};

export const withTimeout = async <T>(promise: Promise<T>, ms = 8000): Promise<T> => {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timer!);
  return result as T;
};

export const requestSupabase = async (
  resource: string,
  options: {
    method?: string;
    query?: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
) => {
  assertSupabaseConfigured();
  if (!REST_BASE) throw new Error('Supabase URL is missing');
  const normalizedQuery = options.query ? (options.query.startsWith('?') ? options.query : `?${options.query}`) : '';
  const path = resource.startsWith('/') ? resource : `/${resource}`;
  const url = `${REST_BASE}${path}${normalizedQuery}`;
  const res = await withTimeout(
    fetch(url, {
      method: options.method || 'GET',
      headers: {
        ...supabaseHeaders(),
        ...(options.headers || {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    options.timeoutMs ?? 8000
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `supabase ${res.status} url=${url} body=${text ? text.slice(0, 300) : 'request failed'}`
    );
  }
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};
