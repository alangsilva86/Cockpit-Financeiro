import type { AppState, Card, InstallmentPlan, Transaction } from '../types';

const nowIso = () => new Date().toISOString();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SYNC_SCHEMA || 'public';
const SUPABASE_TABLE = process.env.SUPABASE_SYNC_TABLE || 'app_states';

const withTimeout = async <T>(promise: Promise<T>, ms = 8000): Promise<T> => {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timer!);
  return result as T;
};

const supabaseHeaders = () => {
  if (!SUPABASE_KEY) return {};
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
};

const buildSupabaseUrl = (query: string) => {
  return `${SUPABASE_URL}/rest/v1/${SUPABASE_SCHEMA}.${SUPABASE_TABLE}${query}`;
};

const getTimestamp = (value?: string) => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const mergeByUpdatedAt = <T extends { id: string; updatedAt?: string }>(base: T[], incoming: T[]) => {
  const map = new Map<string, T>();
  base.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => {
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      return;
    }
    const prevTs = getTimestamp(prev.updatedAt);
    const nextTs = getTimestamp(item.updatedAt);
    map.set(item.id, nextTs >= prevTs ? item : prev);
  });
  return Array.from(map.values());
};

const normalizeIncoming = (state: AppState): AppState => {
  return {
    ...state,
    transactions: (state.transactions || []).map((t) => ({ ...t, needsSync: false })),
    cards: state.cards || [],
    installmentPlans: state.installmentPlans || [],
  };
};

type StoredRow = {
  workspace_id: string;
  state: AppState;
  updated_at?: string;
};

const fetchStoredState = async (workspaceId: string): Promise<AppState | null> => {
  const url = buildSupabaseUrl(`?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id,state,updated_at`);
  const res = await withTimeout(fetch(url, { headers: supabaseHeaders() }));
  if (!res.ok) {
    throw new Error(`supabase fetch failed ${res.status}`);
  }
  const rows = (await res.json()) as StoredRow[];
  const row = rows?.[0];
  if (!row?.state) return null;
  const updatedAt = row.state.updatedAt || row.updated_at || nowIso();
  return normalizeIncoming({ ...row.state, updatedAt });
};

const upsertState = async (workspaceId: string, state: AppState) => {
  const payload = [
    {
      workspace_id: workspaceId,
      state,
      updated_at: state.updatedAt || nowIso(),
    },
  ];
  const url = buildSupabaseUrl(`?on_conflict=workspace_id`);
  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        ...supabaseHeaders(),
        Prefer: 'resolution=merge-duplicates, return=representation',
      },
      body: JSON.stringify(payload),
    })
  );
  if (!res.ok) {
    throw new Error(`supabase upsert failed ${res.status}`);
  }
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { workspaceId, state } = req.body || {};
  const key = (workspaceId || 'default').toString();
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const requiredKey = process.env.SYNC_SHARED_KEY;
  const providedKey = req.headers['x-sync-key'];
  if (requiredKey && providedKey !== requiredKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stored = (await kv.get(serverKey)) as AppState | null;
    const base: AppState = {
      schemaVersion: 2,
      transactions: [],
      cards: [],
      categories: [],
      monthlyIncome: 0,
      variableCap: 0,
      installmentPlans: [],
      updatedAt: nowIso(),
    };
    const incoming = normalizeIncoming({ ...base, ...(state || {}) });

    const stored = await fetchStoredState(key);
    if (!stored) {
      const initial = { ...incoming, updatedAt: nowIso() };
      await upsertState(key, initial);
      return res.status(200).json({ state: initial, serverUpdatedAt: initial.updatedAt });
    }

    const mergedTransactions = mergeByUpdatedAt<Transaction>(stored.transactions || [], incoming.transactions || []);
    const mergedCards = mergeByUpdatedAt<Card>(stored.cards || [], incoming.cards || []);
    const mergedPlans = mergeByUpdatedAt<InstallmentPlan>(stored.installmentPlans || [], incoming.installmentPlans || []);

    const mergedCategories = Array.from(new Set([...(stored.categories || []), ...(incoming.categories || [])])).sort();

    const storedUpdated = getTimestamp(stored.updatedAt);
    const incomingUpdated = getTimestamp(incoming.updatedAt);

    const merged: AppState = {
      ...stored,
      ...incoming,
      schemaVersion: Math.max(stored.schemaVersion || 1, incoming.schemaVersion || 1),
      transactions: mergedTransactions,
      cards: mergedCards,
      installmentPlans: mergedPlans,
      categories: mergedCategories,
      monthlyIncome: incomingUpdated >= storedUpdated ? incoming.monthlyIncome : stored.monthlyIncome,
      variableCap: incomingUpdated >= storedUpdated ? incoming.variableCap : stored.variableCap,
      updatedAt: nowIso(),
    };

    await upsertState(key, merged);
    return res.status(200).json({ state: merged, serverUpdatedAt: merged.updatedAt });
  } catch (error) {
    console.error('sync error', error);
    return res.status(500).json({ error: 'sync failed' });
  }
}
