import type { FastifyInstance } from 'fastify';
import {
  qrLoginGenerateSchema,
  qrLoginRedeemSchema,
  registerDeviceSchema,
  refreshSchema,
  validateServerAddressSchema,
  verifySiteSchema,
} from './auth.schemas.js';
import {
  activateDevice,
  generateQrLogin,
  redeemQrLogin,
  refreshSession,
  registerDevice,
  validateServerAddress,
  verifySite,
} from './auth.controller.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/validate-server',
    { schema: { body: validateServerAddressSchema } },
    validateServerAddress,
  );

  app.post('/verify-site', { schema: { body: verifySiteSchema } }, verifySite);

  app.post('/register-device', { schema: { body: registerDeviceSchema } }, registerDevice);

  app.post('/activate-device', { preHandler: app.authenticateUser }, activateDevice);

  app.post('/refresh-session', { schema: { body: refreshSchema } }, refreshSession);

  app.post('/qr-login/generate', { schema: { body: qrLoginGenerateSchema } }, generateQrLogin);

  app.post('/qr-login/redeem', { schema: { body: qrLoginRedeemSchema } }, redeemQrLogin);
}
