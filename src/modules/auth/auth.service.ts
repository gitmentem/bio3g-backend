import type { FastifyInstance } from 'fastify';
import { findSerialNumber } from '../../db/repositories/serial-numbers.repository.js';
import {
  findSiteByCodeAndPassword,
  type ISiteLoginRecord,
} from '../../db/repositories/sites.repository.js';
import { AppError } from '../../plugins/response.js';
import type { IJwtUserPayload } from '../../types/auth.js';

export interface IAuthSession {
  site: ISiteLoginRecord;
  accessToken: string;
  refreshToken: string;
}

export interface ISiteVerification {
  site: ISiteLoginRecord;
}

export async function validateSiteCredentials(
  app: FastifyInstance,
  serverAddress: string,
  siteCode: string,
  userPin: string,
): Promise<{ serverAddress: string; site: ISiteLoginRecord }> {
  if (!app.dbPools.isAllowedHost(serverAddress)) {
    throw new AppError('Invalid server address', 400, 'INVALID_SERVER');
  }

  const db = await app.dbPools.getPool(serverAddress);
  const site = await findSiteByCodeAndPassword(db, siteCode, userPin);
  if (!site) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  return { serverAddress, site };
}

function buildPayload(
  site: ISiteLoginRecord,
  serverAddress: string,
  tokenUse: 'access' | 'refresh',
  serialNumber?: string,
  readerId?: number | null,
): IJwtUserPayload {
  const payload: IJwtUserPayload = {
    sub: `site:${site.siteId}`,
    kind: 'site',
    serverAddress,
    siteId: site.siteId,
    siteCode: site.siteCode,
    siteName: site.siteName,
    tokenUse,
  };
  if (serialNumber) {
    payload.serialNumber = serialNumber;
  }
  if (readerId) {
    payload.readerId = readerId;
  }
  return payload;
}

export async function registerDeviceSession(
  app: FastifyInstance,
  serverAddress: string,
  siteCode: string,
  password: string,
  serialNumber: string,
): Promise<IAuthSession> {
  const verified = await validateSiteCredentials(app, serverAddress, siteCode, password);

  const db = await app.dbPools.getPool(verified.serverAddress);
  const serial = await findSerialNumber(db, serialNumber);
  if (!serial) {
    throw new AppError('Invalid serial number', 404, 'SERIAL_NOT_FOUND');
  }

  if (serial.siteId !== null && serial.siteId !== verified.site.siteId) {
    throw new AppError('Serial number does not belong to this site', 403, 'SERIAL_SITE_MISMATCH');
  }

  if (serial.occupied === 'Yes') {
    throw new AppError('Serial number is already in use', 409, 'SERIAL_OCCUPIED');
  }

  return {
    site: verified.site,
    accessToken: app.jwt.sign(
      buildPayload(verified.site, verified.serverAddress, 'access', serialNumber, serial.readerId),
    ),
    refreshToken: app.jwt.sign(
      buildPayload(verified.site, verified.serverAddress, 'refresh', serialNumber, serial.readerId),
      {
        expiresIn: app.config.JWT_REFRESH_EXPIRES_IN,
      },
    ),
  };
}

export async function refreshSessionTokens(
  app: FastifyInstance,
  refreshToken: string,
): Promise<Omit<IAuthSession, 'site'>> {
  let payload: IJwtUserPayload;
  try {
    payload = app.jwt.verify<IJwtUserPayload>(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'UNAUTHORIZED');
  }

  if (payload.tokenUse !== 'refresh') {
    throw new AppError('Invalid refresh token', 401, 'UNAUTHORIZED');
  }

  const basePayload = {
    ...payload,
    exp: undefined,
    iat: undefined,
  };

  return {
    accessToken: app.jwt.sign({
      ...basePayload,
      tokenUse: 'access',
    }),
    refreshToken: app.jwt.sign(
      {
        ...basePayload,
        tokenUse: 'refresh',
      },
      {
        expiresIn: app.config.JWT_REFRESH_EXPIRES_IN,
      },
    ),
  };
}
