import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  refreshSessionTokens,
  registerDeviceSession,
  validateSiteCredentials,
} from './auth.service.js';
import type {
  TRefreshBody,
  TRegisterDeviceBody,
  TValidateServerAddressBody,
  TVerifySiteBody,
} from './auth.schemas.js';

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
