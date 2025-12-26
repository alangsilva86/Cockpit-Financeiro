const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SYNC_SCHEMA || 'public';

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

export const buildSupabaseUrl = (resource: string, query = '') => {
  const normalizedQuery = query ? (query.startsWith('?') ? query : `?${query}`) : '';
  return `${SUPABASE_URL}/rest/v1/${resource}${normalizedQuery}`;
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
  const url = buildSupabaseUrl(resource, options.query || '');
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
    const text = await res.text();
    throw new Error(`supabase ${res.status}: ${text || 'request failed'}`);
  }
  return res;
};
