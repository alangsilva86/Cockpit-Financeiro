import type { AppState, Card, InstallmentPlan, Transaction } from '../types';
import { getActorFromRequest } from '../lib/actors';
import { insertAuditEvent } from '../lib/audit';
import { authorizeSync } from '../lib/auth';
import { isUuid } from '../lib/ids';
import { mapStateToRows } from '../lib/sync/transform';
import { isSupabaseConfigured, requestSupabase } from '../lib/supabase';

const nowIso = () => new Date().toISOString();
const SUPABASE_TABLE = process.env.SUPABASE_SYNC_TABLE || 'app_states';
const BATCH_SIZE = Number(process.env.SYNC_BATCH_SIZE || 250);

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
    categories: state.categories || [],
  };
};

type StoredRow = {
  workspace_id: string;
  state: AppState;
  updated_at?: string;
  schema_version?: number;
  revision?: number;
};

const fetchStoredState = async (workspaceId: string) => {
  const query = `workspace_id=eq.${encodeURIComponent(
    workspaceId
  )}&select=workspace_id,state,updated_at,schema_version,revision`;
  const rows = (await requestSupabase(SUPABASE_TABLE, { query })) as StoredRow[] | null;
  const row = rows?.[0];
  if (!row?.state) return null;
  const updatedAt = row.state.updatedAt || row.updated_at || nowIso();
  return {
    state: normalizeIncoming({ ...row.state, updatedAt }),
    schemaVersion: Number(row.schema_version ?? row.state.schemaVersion ?? 1),
    revision: Number(row.revision ?? 0),
  };
};

const upsertState = async (workspaceId: string, state: AppState, schemaVersion: number, revision: number) => {
  const payload = [
    {
      workspace_id: workspaceId,
      state,
      updated_at: state.updatedAt || nowIso(),
      schema_version: schemaVersion,
      revision,
    },
  ];
  await requestSupabase(SUPABASE_TABLE, {
    method: 'POST',
    query: 'on_conflict=workspace_id',
    headers: {
      Prefer: 'resolution=merge-duplicates, return=minimal',
    },
    body: payload,
  });
};

const ensureWorkspace = async (workspaceUuid: string, externalKey: string, ownerUserId?: string | null) => {
  const row: Record<string, unknown> = {
    id: workspaceUuid,
    name: externalKey || 'default',
    external_key: externalKey || 'default',
  };
  if (ownerUserId && isUuid(ownerUserId)) {
    row.owner_user_id = ownerUserId;
  }
  const payload = [row];
  await requestSupabase('workspaces', {
    method: 'POST',
    query: 'on_conflict=id',
    headers: {
      Prefer: 'resolution=merge-duplicates, return=minimal',
    },
    body: payload,
  });
};

const chunk = <T>(items: T[], size: number) => {
  if (size <= 0) return [items];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const upsertBatches = async (table: string, rows: Record<string, unknown>[], onConflict = 'id') => {
  if (!rows.length) return;
  const batches = chunk(rows, BATCH_SIZE);
  for (const batch of batches) {
    await requestSupabase(table, {
      method: 'POST',
      query: `on_conflict=${onConflict}`,
      headers: {
        Prefer: 'resolution=merge-duplicates, return=minimal',
      },
      body: batch,
    });
  }
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { workspaceId, state, schemaVersion, revision } = req.body || {};
  const key = (workspaceId || 'default').toString();
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const authResult = authorizeSync(req, key);
  if (!authResult.ok) {
    const status = authResult.reason.toLowerCase().includes('not configured') ? 503 : 401;
    return res.status(status).json({ error: authResult.reason });
  }

  try {
    const { actorUserId, actorDeviceId } = getActorFromRequest(req);
    if (!actorDeviceId) {
      return res.status(400).json({ error: 'actor_device_id is required' });
    }
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

    if (stored && revision !== undefined && revision !== null) {
      const requestedRevision = Number(revision);
      if (!Number.isNaN(requestedRevision) && requestedRevision !== stored.revision) {
        return res.status(409).json({
          error: 'Revision mismatch',
          currentRevision: stored.revision,
          serverUpdatedAt: stored.state.updatedAt,
        });
      }
    }

    const mergedState = (() => {
      if (!stored) {
        return { ...incoming, updatedAt: nowIso() };
      }

      const mergedTransactions = mergeByUpdatedAt<Transaction>(
        stored.state.transactions || [],
        incoming.transactions || []
      );
      const mergedCards = mergeByUpdatedAt<Card>(stored.state.cards || [], incoming.cards || []);
      const mergedPlans = mergeByUpdatedAt<InstallmentPlan>(
        stored.state.installmentPlans || [],
        incoming.installmentPlans || []
      );

      const mergedCategories = Array.from(
        new Set([...(stored.state.categories || []), ...(incoming.categories || [])])
      ).sort();

      const storedUpdated = getTimestamp(stored.state.updatedAt);
      const incomingUpdated = getTimestamp(incoming.updatedAt);
      const mergedSchema = Math.max(
        stored.schemaVersion || 1,
        incoming.schemaVersion || 1,
        Number(schemaVersion || 0)
      );

      return {
        ...stored.state,
        ...incoming,
        schemaVersion: mergedSchema,
        transactions: mergedTransactions,
        cards: mergedCards,
        installmentPlans: mergedPlans,
        categories: mergedCategories,
        monthlyIncome: incomingUpdated >= storedUpdated ? incoming.monthlyIncome : stored.state.monthlyIncome,
        variableCap: incomingUpdated >= storedUpdated ? incoming.variableCap : stored.state.variableCap,
        updatedAt: nowIso(),
      };
    })();

    const nextRevision = (stored?.revision ?? 0) + 1;
    const resolvedSchemaVersion = Math.max(
      mergedState.schemaVersion || 1,
      Number(schemaVersion || 0),
      stored?.schemaVersion || 1
    );
    mergedState.schemaVersion = resolvedSchemaVersion;

    await upsertState(key, mergedState, resolvedSchemaVersion, nextRevision);
    const mapped = mapStateToRows(mergedState, key);
    await ensureWorkspace(mapped.workspaceUuid, key, actorUserId);

    await upsertBatches('cards', mapped.cards);
    await upsertBatches('categories', mapped.categories);
    await upsertBatches('installment_plans', mapped.installmentPlans);
    await upsertBatches('transactions', mapped.transactions);

    await insertAuditEvent({
      workspace_id: mapped.workspaceUuid,
      entity_type: 'app_state',
      entity_id: null,
      action: 'sync',
      after: {
        revision: nextRevision,
        schemaVersion: resolvedSchemaVersion,
        counts: {
          cards: mapped.cards.length,
          categories: mapped.categories.length,
          installmentPlans: mapped.installmentPlans.length,
          transactions: mapped.transactions.length,
        },
      },
      actor_user_id: actorUserId,
      actor_device_id: actorDeviceId,
    });

    return res.status(200).json({
      state: mergedState,
      serverUpdatedAt: mergedState.updatedAt,
      revision: nextRevision,
    });
  } catch (error) {
    console.error('sync error', error);
    const message = error instanceof Error ? error.message : 'sync failed';
    return res.status(500).json({ error: message });
  }
}
