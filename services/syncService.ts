import { AppState } from '../types';

const SYNC_URL = import.meta.env.VITE_SYNC_ENDPOINT || '/api/sync';
const WORKSPACE_ID = import.meta.env.VITE_SYNC_WORKSPACE || 'default';
const SYNC_KEY = import.meta.env.VITE_SYNC_KEY;
const MIN_SYNC_INTERVAL_MS = 15000;
const BACKOFF_STEPS_MS = [5000, 15000, 60000];

let lastAttemptAt = 0;
let failureCount = 0;
let nextRetryAt = 0;
let blockedNotConfigured = false;

export interface SyncResponse {
  state: AppState;
  serverUpdatedAt: string;
}

const getBackoffDelay = (attempts: number) => {
  const index = Math.min(Math.max(attempts - 1, 0), BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[index];
};

const markFailure = (now = Date.now()) => {
  failureCount += 1;
  nextRetryAt = now + getBackoffDelay(failureCount);
};

const resetBackoff = () => {
  failureCount = 0;
  nextRetryAt = 0;
};

const shouldSkipSync = (now: number) => {
  if (blockedNotConfigured) return true;
  if (failureCount > 0) {
    return now < nextRetryAt;
  }
  return now - lastAttemptAt < MIN_SYNC_INTERVAL_MS;
};

const getErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.error === 'string') return data.error;
  } catch (_err) {
    return undefined;
  }
  return undefined;
};

export const syncAppState = async (state: AppState): Promise<SyncResponse | null> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  const now = Date.now();
  if (shouldSkipSync(now)) {
    return null;
  }

  lastAttemptAt = now;
  let recordedFailure = false;

  try {
    const response = await fetch(SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SYNC_KEY ? { 'x-sync-key': SYNC_KEY } : {}),
      },
      body: JSON.stringify({ workspaceId: WORKSPACE_ID, state }),
    });

    if (!response.ok) {
      const errorMessage = await getErrorMessage(response);
      if (response.status === 503 && errorMessage?.toLowerCase().includes('not configured')) {
        blockedNotConfigured = true;
      } else {
        markFailure();
        recordedFailure = true;
      }
      throw new Error(errorMessage ? `sync failed: ${errorMessage}` : `sync failed with status ${response.status}`);
    }

    const payload = (await response.json()) as SyncResponse;
    resetBackoff();
    return payload;
  } catch (error) {
    if (!recordedFailure && !blockedNotConfigured) {
      markFailure();
    }
    throw error;
  }
};
