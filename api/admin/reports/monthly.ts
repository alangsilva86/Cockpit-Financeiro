import { getActorFromRequest } from '../../../lib/actors';
import { authorizeAdmin } from '../../../lib/auth';
import { toMonthStart } from '../../../lib/dates';
import { workspaceToUuid } from '../../../lib/ids';
import { isSupabaseConfigured, requestSupabase } from '../../../lib/supabase';

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

  const { workspaceId, month } = req.query || {};
  if (!workspaceId || !month) {
    return res.status(400).json({ error: 'workspaceId and month are required' });
  }

  const { actorDeviceId } = getActorFromRequest(req);
  if (!actorDeviceId) {
    return res.status(400).json({ error: 'actor_device_id is required' });
  }

  const monthStart = toMonthStart(String(month));
  if (!monthStart) {
    return res.status(400).json({ error: 'Invalid month' });
  }

  const workspaceUuid = workspaceToUuid(String(workspaceId));

  try {
    const summaryRows = (await requestSupabase('v_monthly_summary', {
      query: `workspace_id=eq.${workspaceUuid}&competence_month=eq.${monthStart}&select=workspace_id,competence_month,income_total,spend_total,interest_total,net_total`,
    })) as Array<Record<string, any>> | null;
    const summary = summaryRows[0] || null;

    const categories = (await requestSupabase('v_category_breakdown', {
      query: `workspace_id=eq.${workspaceUuid}&competence_month=eq.${monthStart}&select=category_id,category_name,total&order=total.desc`,
    })) as Array<Record<string, any>> | null;
    const normalizedCategories = categories || [];

    return res.status(200).json({ summary, categories: normalizedCategories });
  } catch (error) {
    console.error('admin monthly report error', error);
    const message = error instanceof Error ? error.message : 'request failed';
    return res.status(500).json({ error: message });
  }
}
