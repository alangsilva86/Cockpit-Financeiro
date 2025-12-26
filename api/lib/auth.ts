import crypto from 'crypto';

type AuthResult = { ok: true } | { ok: false; reason: string };

const readHeader = (req: any, key: string) => {
  if (!req?.headers) return undefined;
  const direct = req.headers[key];
  if (direct) return Array.isArray(direct) ? direct[0] : direct;
  const lowerKey = key.toLowerCase();
  const match = Object.entries(req.headers).find(([header]) => header.toLowerCase() === lowerKey);
  if (!match) return undefined;
  const value = match[1];
  return Array.isArray(value) ? value[0] : value;
};

const safeEqual = (left: string, right: string) => {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
};

export type AuthResult = { ok: true } | { ok: false; reason: string };

export const computeHmac = (secret: string, message: string) =>
  crypto.createHmac('sha256', secret).update(message).digest('hex');

export const authorizeSync = (req: any, workspaceId: string): AuthResult => {
  const syncSecret = process.env.SYNC_SECRET;
  const sharedKey = process.env.SYNC_SHARED_KEY;
  if (!syncSecret && !sharedKey) {
    return { ok: false, reason: 'Sync auth not configured' };
  }

  if (syncSecret) {
    const providedToken = readHeader(req, 'x-sync-token');
    if (providedToken) {
      const expected = computeHmac(syncSecret, workspaceId);
      if (safeEqual(expected, providedToken)) return { ok: true };
    }
  }

  if (sharedKey) {
    const providedKey = readHeader(req, 'x-sync-key');
    if (providedKey && safeEqual(sharedKey, providedKey)) return { ok: true };
  }

  return { ok: false, reason: 'Unauthorized' };
};

export const authorizeAdmin = (req: any): AuthResult => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return { ok: false, reason: 'Admin auth not configured' };
  }
  const providedHeader = readHeader(req, 'x-admin-token');
  const providedAuth = readHeader(req, 'authorization');
  const bearer =
    typeof providedAuth === 'string' && providedAuth.toLowerCase().startsWith('bearer ')
      ? providedAuth.slice(7).trim()
      : undefined;
  const provided = providedHeader || bearer;
  if (!provided) {
    return { ok: false, reason: 'Unauthorized' };
  }
  return safeEqual(adminSecret, provided) ? { ok: true } : { ok: false, reason: 'Unauthorized' };
};
