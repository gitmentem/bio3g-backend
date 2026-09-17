import QRCode from 'qrcode';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IJwtUserPayload } from '../../types/auth.js';
import {
  activateDeviceSession,
  mintQrLoginToken,
  redeemQrLoginToken,
  refreshSessionTokens,
  registerDeviceSession,
  validateSiteCredentials,
} from './auth.service.js';
import type {
  TQrLoginGenerateBody,
  TQrLoginRedeemBody,
  TRefreshBody,
  TRegisterDeviceBody,
  TValidateServerAddressBody,
  TVerifySiteBody,
} from './auth.schemas.js';
import { QR_LOGIN_PAGE_HTML } from './qr-login-page.js';

export async function validateServerAddress(req: FastifyRequest, reply: FastifyReply) {
  const serverAddress = (req.body as TValidateServerAddressBody).serverAddress;
  const isValid = req.server.dbPools.isAllowedHost(serverAddress);

  if (isValid) {
    req.server.dbPools.warmup(serverAddress).catch((err: unknown) => {
      req.log.warn({ err, serverAddress }, 'Database pool warmup failed');
    });
  }

  return reply.ok({
    isValid,
  });
}

export async function verifySite(req: FastifyRequest, reply: FastifyReply) {
  const { serverAddress, siteCode, userPin } = req.body as TVerifySiteBody;
  await validateSiteCredentials(req.server, serverAddress, siteCode, userPin);

  return reply.ok({
    isValid: true,
  });
}

export async function registerDevice(req: FastifyRequest, reply: FastifyReply) {
  const { serverAddress, siteCode, userPin, serialNumber } = req.body as TRegisterDeviceBody;
  const session = await registerDeviceSession(
    req.server,
    serverAddress,
    siteCode,
    userPin,
    serialNumber,
  );

  return reply.ok({
    site: session.site,
    tokens: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    },
  });
}

export async function refreshSession(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TRefreshBody;
  const tokens = await refreshSessionTokens(req.server, body.refreshToken);
  return reply.ok({ tokens });
}

export async function activateDevice(req: FastifyRequest, reply: FastifyReply) {
  const activation = await activateDeviceSession(req.server, req.user as IJwtUserPayload);
  return reply.ok(activation);
}

export async function generateQrLogin(req: FastifyRequest, reply: FastifyReply) {
  const { serverAddress, siteCode, userPin, serialNumber, expiresInHours } =
    req.body as TQrLoginGenerateBody;
  const minted = await mintQrLoginToken(
    req.server,
    serverAddress,
    siteCode,
    userPin,
    serialNumber,
    expiresInHours,
  );
  const qrImage = await QRCode.toDataURL(minted.qrToken, { width: 480, margin: 2 });

  return reply.ok({
    site: minted.site,
    qrImage,
    qrToken: minted.qrToken,
    expiresIn: minted.expiresIn,
    serialNumber: minted.serialNumber,
  });
}

export async function redeemQrLogin(req: FastifyRequest, reply: FastifyReply) {
  const { qrToken } = req.body as TQrLoginRedeemBody;
  const session = await redeemQrLoginToken(req.server, qrToken);

  return reply.ok({
    site: session.site,
    tokens: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    },
    serialNumber: session.serialNumber,
    serverAddress: session.serverAddress,
  });
}

export async function qrLoginPage(_req: FastifyRequest, reply: FastifyReply) {
  return reply.type('text/html').send(QR_LOGIN_PAGE_HTML);
}
