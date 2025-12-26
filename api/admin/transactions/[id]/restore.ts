import { getActorFromRequest } from '../../../../server/actors';
import { insertAuditEvent } from '../../../../server/audit';
import { authorizeAdmin } from '../../../../server/auth';
import { entityToUuid, isUuid, workspaceToUuid } from '../../../../server/ids';
import { isSupabaseConfigured, requestSupabase } from '../../../../server/supabase';

const resolveTransactionId = (workspaceUuid: string, id: string) =>
  isUuid(id) ? id : entityToUuid(workspaceUuid, 'transaction', id);

const fetchTransaction = async (workspaceUuid: string, transactionId: string) => {
  const query = `id=eq.${transactionId}&workspace_id=eq.${workspaceUuid}&select=*`;
  const response = await requestSupabase('transactions', { query });
  const rows = (await response.json()) as Array<Record<string, any>>;
  return rows[0] || null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
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

    const response = await requestSupabase('transactions', {
      method: 'PATCH',
      query: `id=eq.${transactionId}&workspace_id=eq.${workspaceUuid}`,
      headers: { Prefer: 'return=representation' },
      body: {
        deleted_at: null,
        updated_at: now,
      },
    });
    const rows = (await response.json()) as Array<Record<string, any>>;
    const after = rows[0] || null;

    await insertAuditEvent({
      workspace_id: workspaceUuid,
      entity_type: 'transaction',
      entity_id: transactionId,
      action: 'restore',
      before,
      after,
      actor_user_id: actorUserId,
      actor_device_id: actorDeviceId,
    });

    return res.status(200).json({ transaction: after });
  } catch (error) {
    console.error('admin transaction restore error', error);
    const message = error instanceof Error ? error.message : 'request failed';
    return res.status(500).json({ error: message });
  }
}
