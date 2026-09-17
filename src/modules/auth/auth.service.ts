import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { withPoolLease, type Db } from '../../db/pool.js';
import {
  findSerialNumber,
  markSerialNumberOccupied,
  releaseSerialNumber,
  type ISerialNumberRecord,
} from '../../db/repositories/serial-numbers.repository.js';
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

export interface IQrLoginSession extends IAuthSession {
  serialNumber: string;
  serverAddress: string;
}

export interface ISiteVerification {
  site: ISiteLoginRecord;
}

export interface IDeviceActivation {
  activated: boolean;
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
  tokenUse: 'access' | 'refresh' | 'qr-login',
  serialNumber?: string,
  readerId?: number | null,
  jti?: string,
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
  if (jti) {
    payload.jti = jti;
  }
  return payload;
}

async function findSerialForSiteOrThrow(
  db: Db,
  site: ISiteLoginRecord,
  serialNumber: string,
): Promise<ISerialNumberRecord> {
  const serial = await findSerialNumber(db, serialNumber);
  if (!serial) {
    throw new AppError('Invalid serial number', 404, 'SERIAL_NOT_FOUND');
  }

  if (serial.siteId !== null && serial.siteId !== site.siteId) {
    throw new AppError('Serial number does not belong to this site', 403, 'SERIAL_SITE_MISMATCH');
  }

  return serial;
}

async function validateSerialForSite(
  db: Db,
  site: ISiteLoginRecord,
  serialNumber: string,
): Promise<ISerialNumberRecord> {
  const serial = await findSerialForSiteOrThrow(db, site, serialNumber);

  if (serial.occupied === 'Yes') {
    throw new AppError('Serial number is already in use', 409, 'SERIAL_OCCUPIED');
  }

  return serial;
}

async function issueDeviceSession(
  app: FastifyInstance,
  serverAddress: string,
  site: ISiteLoginRecord,
  serialNumber: string,
): Promise<IAuthSession> {
  const db = await app.dbPools.getPool(serverAddress);
  const serial = await validateSerialForSite(db, site, serialNumber);

  return {
    site,
    accessToken: app.jwt.sign(buildPayload(site, serverAddress, 'access', serialNumber, serial.readerId)),
    refreshToken: app.jwt.sign(
      buildPayload(site, serverAddress, 'refresh', serialNumber, serial.readerId),
      {
        expiresIn: app.config.JWT_REFRESH_EXPIRES_IN,
      },
    ),
  };
}

export async function registerDeviceSession(
  app: FastifyInstance,
  serverAddress: string,
  siteCode: string,
  password: string,
  serialNumber: string,
): Promise<IAuthSession> {
  const verified = await validateSiteCredentials(app, serverAddress, siteCode, password);
  return issueDeviceSession(app, verified.serverAddress, verified.site, serialNumber);
}

export interface IQrLoginToken {
  site: ISiteLoginRecord;
  qrToken: string;
  expiresIn: string;
  serialNumber: string;
}

export async function mintQrLoginToken(
  app: FastifyInstance,
  serverAddress: string,
  siteCode: string,
  userPin: string,
  serialNumber: string,
  expiresInHours?: number,
): Promise<IQrLoginToken> {
  const verified = await validateSiteCredentials(app, serverAddress, siteCode, userPin);

  const db = await app.dbPools.getPool(verified.serverAddress);
  const serial = await findSerialForSiteOrThrow(db, verified.site, serialNumber);
  if (serial.occupied === 'Yes') {
    await releaseSerialNumber(db, serialNumber);
  }

  const expiresIn = expiresInHours ? `${expiresInHours}h` : app.config.QR_LOGIN_TOKEN_EXPIRES_IN;

  const qrToken = app.jwt.sign(
    buildPayload(
      verified.site,
      verified.serverAddress,
      'qr-login',
      serialNumber,
      undefined,
      randomUUID(),
    ),
    { expiresIn },
  );

  return { site: verified.site, qrToken, expiresIn, serialNumber };
}

const RETRYABLE_SERIAL_ERROR_CODES = new Set([
  'SERIAL_NOT_FOUND',
  'SERIAL_SITE_MISMATCH',
  'SERIAL_OCCUPIED',
]);

export async function redeemQrLoginToken(
  app: FastifyInstance,
  qrToken: string,
): Promise<IQrLoginSession> {
  let payload: IJwtUserPayload;
  try {
    payload = app.jwt.verify<IJwtUserPayload>(qrToken);
  } catch {
    throw new AppError('Invalid or expired QR code', 401, 'QR_TOKEN_INVALID');
  }

  if (
    payload.tokenUse !== 'qr-login' ||
    !payload.jti ||
    !payload.exp ||
    !payload.serialNumber
  ) {
    throw new AppError('Invalid or expired QR code', 401, 'QR_TOKEN_INVALID');
  }

  if (!app.qrLoginTokens.tryReserve(payload.jti, payload.exp * 1000)) {
    throw new AppError('QR code has already been used', 401, 'QR_TOKEN_CONSUMED');
  }

  const site: ISiteLoginRecord = {
    siteId: payload.siteId,
    siteCode: payload.siteCode,
    siteName: payload.siteName,
  };

  const serialNumber = payload.serialNumber;
  const serverAddress = payload.serverAddress;

  try {
    const session = await issueDeviceSession(app, serverAddress, site, serialNumber);
    return { ...session, serialNumber, serverAddress };
  } catch (err) {
    if (err instanceof AppError && RETRYABLE_SERIAL_ERROR_CODES.has(err.code)) {
      app.qrLoginTokens.release(payload.jti);
    }
    throw err;
  }
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

export async function activateDeviceSession(
  app: FastifyInstance,
  user: IJwtUserPayload,
): Promise<IDeviceActivation> {
  if (!user.serialNumber) {
    throw new AppError('Serial number is required', 400, 'SERIAL_REQUIRED');
  }
  const serialNumber = user.serialNumber;

  const db = await app.dbPools.getPool(user.serverAddress);
  return withPoolLease(db, async () => {
    const serial = await findSerialNumber(db, serialNumber);
    if (!serial) {
      throw new AppError('Invalid serial number', 404, 'SERIAL_NOT_FOUND');
    }

    if (serial.siteId !== null && serial.siteId !== user.siteId) {
      throw new AppError(
        'Serial number does not belong to this site',
        403,
        'SERIAL_SITE_MISMATCH',
      );
    }

    if (
      serial.occupied === 'Yes' &&
      serial.readerId !== null &&
      user.readerId !== undefined &&
      serial.readerId !== user.readerId
    ) {
      throw new AppError('Serial number is already in use', 409, 'SERIAL_OCCUPIED');
    }

    if (serial.occupied === 'No') {
      await markSerialNumberOccupied(db, {
        serialNumber,
        siteId: user.siteId,
        readerId: user.readerId,
      });
    }

    return { activated: true };
  });
}
