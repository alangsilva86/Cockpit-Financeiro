import { isUuid } from './ids.js';

export const getActorFromRequest = (req: any) => {
  const userHeader =
    req?.headers?.['x-actor-user-id'] ||
    req?.headers?.['x-user-id'] ||
    req?.body?.userId;
  const deviceHeader = req?.headers?.['x-device-id'] || req?.body?.deviceId;
  const actorUserId = typeof userHeader === 'string' && isUuid(userHeader) ? userHeader : null;
  const actorDeviceId =
    typeof deviceHeader === 'string' && deviceHeader.trim().length > 0 ? deviceHeader.trim() : null;
  return { actorUserId, actorDeviceId };
};
