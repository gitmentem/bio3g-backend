import type { FastifyInstance } from 'fastify';
import {
  registerDeviceSchema,
  refreshSchema,
  validateServerAddressSchema,
  verifySiteSchema,
} from './auth.schemas.js';
import {
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

  app.post('/refresh-session', { schema: { body: refreshSchema } }, refreshSession);
}
