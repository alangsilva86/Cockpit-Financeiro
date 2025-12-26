import { getActorFromRequest } from '../../../server/actors';
import { insertAuditEvent } from '../../../server/audit';
import { authorizeAdmin } from '../../../server/auth';
import { toDateOnly, toMonthStart } from '../../../server/dates';
import { entityToUuid, isUuid, workspaceToUuid } from '../../../server/ids';
import { isSupabaseConfigured, requestSupabase } from '../../../server/supabase';

const resolveTransactionId = (workspaceUuid: string, id: string) =>
  isUuid(id) ? id : entityToUuid(workspaceUuid, 'transaction', id);

const resolveCardId = (workspaceUuid: string, id: string) =>
  isUuid(id) ? id : entityToUuid(workspaceUuid, 'card', id);

const resolveCategoryId = (workspaceUuid: string, id: string) =>
  isUuid(id) ? id : entityToUuid(workspaceUuid, 'category', id);

const fetchTransaction = async (workspaceUuid: string, transactionId: string) => {
  const query = `id=eq.${transactionId}&workspace_id=eq.${workspaceUuid}&select=*`;
  const rows = (await requestSupabase('transactions', { query })) as Array<Record<string, any>> | null;
  return rows?.[0] || null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const authResult = authorizeAdmin(req);
  if (!authResult.ok) {
    const status = authResult.reason.toLowerCase().includes('not configured') ? 503 : 401;
    return res.status(status).json({ error: authResult.reason });
  }

  const idParam = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  const workspaceId = req.query?.workspaceId || req.body?.workspaceId;
  if (!idParam || !workspaceId) {
    return res.status(400).json({ error: 'workspaceId and id are required' });
  }

  const workspaceUuid = workspaceToUuid(String(workspaceId));
  const transactionId = resolveTransactionId(workspaceUuid, String(idParam));

  try {
    const before = await fetchTransaction(workspaceUuid, transactionId);
    if (!before) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const now = new Date().toISOString();
    const { actorUserId, actorDeviceId } = getActorFromRequest(req);
    if (!actorDeviceId) {
      return res.status(400).json({ error: 'actor_device_id is required' });
    }

    if (req.method === 'DELETE') {
      const rows = (await requestSupabase('transactions', {
        method: 'PATCH',
        query: `id=eq.${transactionId}&workspace_id=eq.${workspaceUuid}`,
        headers: { Prefer: 'return=representation' },
        body: {
          deleted_at: now,
          updated_at: now,
        },
      });
      const after = rows?.[0] || null;
      await insertAuditEvent({
        workspace_id: workspaceUuid,
        entity_type: 'transaction',
        entity_id: transactionId,
        action: 'delete',
        before,
        after,
        actor_user_id: actorUserId,
        actor_device_id: actorDeviceId,
      });
      return res.status(200).json({ transaction: after });
    }

    const body = req.body || {};
    const updates: Record<string, any> = {};
    if ('amount' in body) updates.amount = body.amount;
    if ('occurred_at' in body || 'occurredAt' in body) {
      const raw = body.occurred_at ?? body.occurredAt;
      const normalized = toDateOnly(String(raw));
      if (!normalized) {
        return res.status(400).json({ error: 'Invalid occurred_at' });
      }
      updates.occurred_at = normalized;
    }
    if ('competence_month' in body || 'competenceMonth' in body) {
      const raw = body.competence_month ?? body.competenceMonth;
      const normalized = toMonthStart(String(raw));
      if (!normalized) {
        return res.status(400).json({ error: 'Invalid competence_month' });
      }
      updates.competence_month = normalized;
    }
    if ('status' in body) updates.status = body.status;
    if ('description' in body) updates.description = body.description ?? null;
    if ('person' in body || 'personId' in body) {
      updates.person = body.person ?? body.personId ?? null;
    }
    if ('category_id' in body || 'categoryId' in body) {
      const raw = body.category_id ?? body.categoryId;
      if (raw) {
        updates.category_id = resolveCategoryId(workspaceUuid, String(raw));
      } else {
        updates.category_id = null;
      }
    }
    if ('card_id' in body || 'cardId' in body) {
      const raw = body.card_id ?? body.cardId;
      if (raw) {
        updates.card_id = resolveCardId(workspaceUuid, String(raw));
      } else {
        updates.card_id = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    updates.updated_at = now;

    const rows = (await requestSupabase('transactions', {
      method: 'PATCH',
      query: `id=eq.${transactionId}&workspace_id=eq.${workspaceUuid}`,
      headers: { Prefer: 'return=representation' },
      body: updates,
    });
    const after = rows?.[0] || null;

    await insertAuditEvent({
      workspace_id: workspaceUuid,
      entity_type: 'transaction',
      entity_id: transactionId,
      action: 'update',
      before,
      after,
      actor_user_id: actorUserId,
      actor_device_id: actorDeviceId,
    });

    return res.status(200).json({ transaction: after });
  } catch (error) {
    console.error('admin transaction update error', error);
    const message = error instanceof Error ? error.message : 'request failed';
    return res.status(500).json({ error: message });
  }
}
