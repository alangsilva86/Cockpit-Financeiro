import { getActorFromRequest } from '../lib/actors';
import { authorizeAdmin } from '../lib/auth';
import { toMonthStart } from '../lib/dates';
import { entityToUuid, isUuid, workspaceToUuid } from '../lib/ids';
import { isSupabaseConfigured, requestSupabase } from '../lib/supabase';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const parseNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const authResult = authorizeAdmin(req);
  if (!authResult.ok) {
    const status = authResult.reason.toLowerCase().includes('not configured') ? 503 : 401;
    return res.status(status).json({ error: authResult.reason });
  }

  const {
    workspaceId,
    month,
    kind,
    categoryId,
    cardId,
    status,
    q,
    limit,
    cursor,
  } = req.query || {};

  if (!workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  const { actorDeviceId } = getActorFromRequest(req);
  if (!actorDeviceId) {
    return res.status(400).json({ error: 'actor_device_id is required' });
  }

  const workspaceKey = String(workspaceId);
  const workspaceUuid = workspaceToUuid(workspaceKey);

  const params = new URLSearchParams();
  params.set('workspace_id', `eq.${workspaceUuid}`);
  params.set(
    'select',
    [
      'id',
      'workspace_id',
      'kind',
      'amount',
      'occurred_at',
      'competence_month',
      'status',
      'person',
      'description',
      'category_id',
      'card_id',
      'payment_method',
      'installment_plan_id',
      'installment_index',
      'installment_count',
      'deleted_at',
      'updated_at',
    ].join(',')
  );
  params.set('order', 'occurred_at.desc,updated_at.desc');

  if (month) {
    const normalized = toMonthStart(String(month));
    if (!normalized) {
      return res.status(400).json({ error: 'Invalid month' });
    }
    params.set('competence_month', `eq.${normalized}`);
  }
  if (kind) params.set('kind', `eq.${String(kind)}`);
  if (status) params.set('status', `eq.${String(status)}`);
  if (categoryId) {
    const raw = String(categoryId);
    const resolved = isUuid(raw) ? raw : entityToUuid(workspaceUuid, 'category', raw);
    params.set('category_id', `eq.${resolved}`);
  }
  if (cardId) {
    const raw = String(cardId);
    const resolved = isUuid(raw) ? raw : entityToUuid(workspaceUuid, 'card', raw);
    params.set('card_id', `eq.${resolved}`);
  }
  if (q) {
    const query = String(q).trim();
    if (query) {
      params.set('or', `(description.ilike.*${query}*,person.ilike.*${query}*)`);
    }
  }

  const resolvedLimit = Math.min(Math.max(parseNumber(limit, DEFAULT_LIMIT), 1), MAX_LIMIT);
  const resolvedCursor = Math.max(parseNumber(cursor, 0), 0);
  params.set('limit', String(resolvedLimit));
  if (resolvedCursor) params.set('offset', String(resolvedCursor));

  try {
    const rows = (await requestSupabase('transactions', { query: params.toString() })) as
      | Array<Record<string, any>>
      | null;
    const normalizedRows = rows || [];
    const data = normalizedRows.map((row) => ({
      ...row,
      deleted: Boolean(row.deleted_at),
      installment: Boolean(row.installment_plan_id || row.installment_count),
    }));
    const nextCursor = normalizedRows.length === resolvedLimit ? resolvedCursor + resolvedLimit : null;
    return res.status(200).json({ data, nextCursor });
  } catch (error) {
    console.error('admin transactions error', error);
    const message = error instanceof Error ? error.message : 'request failed';
    return res.status(500).json({ error: message });
  }
}
