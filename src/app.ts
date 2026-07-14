import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { allowedDbHosts } from './config/allowed-db-hosts.js';
import type { Env } from './config/env.js';
import { DbPoolManager } from './db/pool.js';
import { responsePlugin } from './plugins/response.js';
import { corsPlugin } from './plugins/cors.js';
import { signJwtPlugin } from './plugins/sign-jwt.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { syncRoutes } from './modules/sync/sync.routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    dbPools: DbPoolManager;
  }
}

export async function buildApp(env: Env) {
  const app = Fastify({
    logger: env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('config', env);

  const dbPools = new DbPoolManager(env, allowedDbHosts);
  app.decorate('dbPools', dbPools);
  app.addHook('onClose', async () => {
    await dbPools.closeAll();
  });

  await app.register(corsPlugin);
  await app.register(responsePlugin);
  await signJwtPlugin(app, env);

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(syncRoutes, { prefix: '/api/v1/sync' });

  app.get('/', async (_req, reply) => {
    reply.ok({ message: 'Hello, World!' });
  });

  return app;
}
