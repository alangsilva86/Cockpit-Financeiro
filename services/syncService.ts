import { AppState } from '../types';

const SYNC_URL = import.meta.env.VITE_SYNC_ENDPOINT || '/api/sync';
const WORKSPACE_ID = import.meta.env.VITE_SYNC_WORKSPACE || 'default';
const SYNC_KEY = import.meta.env.VITE_SYNC_KEY;

export interface SyncResponse {
  state: AppState;
  serverUpdatedAt: string;
}

export const syncAppState = async (state: AppState): Promise<SyncResponse> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('offline');
  }

  const response = await fetch(SYNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SYNC_KEY ? { 'x-sync-key': SYNC_KEY } : {}),
    },
    body: JSON.stringify({ workspaceId: WORKSPACE_ID, state }),
  });

  if (!response.ok) {
    throw new Error(`sync failed with status ${response.status}`);
  }

  return (await response.json()) as SyncResponse;
};
