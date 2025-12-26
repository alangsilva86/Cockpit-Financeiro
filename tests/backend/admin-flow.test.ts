import { describe, expect, it } from 'vitest';
import type { AppState } from '../../types';
import syncHandler from '../../api/sync';
import listHandler from '../../api/admin/transactions';
import transactionHandler from '../../api/admin/transactions/[id]';
import restoreHandler from '../../api/admin/transactions/[id]/restore';
import { computeHmac } from '../../server/auth';
import { workspaceToUuid } from '../../server/ids';
import { requestSupabase } from '../../server/supabase';

const hasSupabase =
  Boolean(process.env.SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);

const runTest = hasSupabase ? it : it.skip;

const createRes = () => {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: any) => {
    res.body = payload;
    return res;
  };
  return res;
};

const runHandler = async (handler: any, req: any) => {
  const res = createRes();
  await handler(req, res);
  return res;
};

describe('admin flow (requires Supabase)', () => {
  runTest('syncs, lists, updates, deletes, and restores', async () => {
    const syncSecret = process.env.SYNC_SECRET || 'test-sync-secret';
    const adminSecret = process.env.ADMIN_SECRET || 'test-admin-secret';
    process.env.SYNC_SECRET = syncSecret;
    process.env.ADMIN_SECRET = adminSecret;

    const workspaceId = process.env.SUPABASE_TEST_WORKSPACE || `test-${Date.now().toString(36)}`;
    const workspaceUuid = workspaceToUuid(workspaceId);
    const syncToken = computeHmac(syncSecret, workspaceId);

    const state: AppState = {
      schemaVersion: 2,
      transactions: [
        {
          id: 'tx-1',
          date: '2025-02-10',
          competenceMonth: '2025-02',
          direction: 'out',
          kind: 'expense',
          amount: 120,
          description: 'Groceries',
          personId: 'alan',
          categoryId: 'Food',
          paymentMethod: 'debit',
          status: 'paid',
          updatedAt: new Date().toISOString(),
        },
      ],
      cards: [],
      categories: ['Food'],
      monthlyIncome: 0,
      variableCap: 0,
      installmentPlans: [],
      updatedAt: new Date().toISOString(),
    };

    const syncRes = await runHandler(syncHandler, {
      method: 'POST',
      headers: { 'x-sync-token': syncToken },
      body: { workspaceId, state, deviceId: 'test-device' },
    });
    expect(syncRes.statusCode).toBe(200);

    const listRes = await runHandler(listHandler, {
      method: 'GET',
      headers: { 'x-admin-token': adminSecret, 'x-device-id': 'test-device' },
      query: { workspaceId, month: '2025-02' },
    });
    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.body?.data)).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    const patchRes = await runHandler(transactionHandler, {
      method: 'PATCH',
      headers: { 'x-admin-token': adminSecret, 'x-device-id': 'test-device' },
      query: { id: 'tx-1', workspaceId },
      body: { amount: 150 },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body?.transaction?.amount).toBe(150);

    const deleteRes = await runHandler(transactionHandler, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminSecret, 'x-device-id': 'test-device' },
      query: { id: 'tx-1', workspaceId },
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body?.transaction?.deleted_at).toBeTruthy();

    const restoreRes = await runHandler(restoreHandler, {
      method: 'POST',
      headers: { 'x-admin-token': adminSecret, 'x-device-id': 'test-device' },
      query: { id: 'tx-1', workspaceId },
      body: {},
    });
    expect(restoreRes.statusCode).toBe(200);
    expect(restoreRes.body?.transaction?.deleted_at).toBeNull();

    const auditRows = (await requestSupabase('audit_events', {
      query: `workspace_id=eq.${workspaceUuid}&entity_type=eq.transaction&action=eq.update&order=created_at.desc&limit=1`,
    })) as Array<Record<string, any>> | null;
    expect((auditRows || []).length).toBeGreaterThan(0);
  });
});
