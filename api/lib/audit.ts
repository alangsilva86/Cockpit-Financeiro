import { requestSupabase } from './supabase';

export type AuditEventPayload = {
  workspace_id: string;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  before?: unknown | null;
  after?: unknown | null;
  actor_user_id?: string | null;
  actor_device_id?: string | null;
};

export const insertAuditEvent = async (payload: AuditEventPayload) => {
  await requestSupabase('audit_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: [payload],
  });
};
