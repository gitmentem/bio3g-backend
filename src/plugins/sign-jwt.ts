import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '../config/env.js';
import { AppError } from './response.js';
import '../types/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticateUser: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function signJwtPlugin(app: FastifyInstance, env: Env): Promise<void> {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  });

  app.decorate('authenticateUser', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }
  });
}
