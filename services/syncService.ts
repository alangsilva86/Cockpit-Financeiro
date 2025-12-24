import { Transaction } from '../types';

const SYNC_URL = import.meta.env.VITE_SYNC_ENDPOINT || 'https://httpbin.org/post';

export interface SyncResult {
  syncedIds: string[];
}

export const syncTransactionsQueue = async (transactions: Transaction[]): Promise<SyncResult> => {
  const queue = transactions.filter((t) => t.needsSync);
  if (!queue.length) return { syncedIds: [] };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('offline');
  }

  const response = await fetch(SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: queue }),
  });

  if (!response.ok) {
    throw new Error(`sync failed with status ${response.status}`);
  }

  return { syncedIds: queue.map((t) => t.id) };
};
