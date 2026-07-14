import type { FastifyInstance } from 'fastify';
import { listEmployees } from '../../db/repositories/employees.repository.js';
import {
  countFaceTemplates,
  listFaceTemplates,
} from '../../db/repositories/face-templates.repository.js';
import type { IJwtUserPayload } from '../../types/auth.js';

async function getUserDb(app: FastifyInstance, user: IJwtUserPayload) {
  return app.dbPools.getPool(user.serverAddress);
}

export async function getEmployees(app: FastifyInstance, user: IJwtUserPayload) {
  const db = await getUserDb(app, user);
  return listEmployees(db, {
    siteId: user.siteId,
    readerId: user.readerId,
  });
}

export async function getFaceTemplateCount(app: FastifyInstance, user: IJwtUserPayload) {
  const db = await getUserDb(app, user);
  return countFaceTemplates(db, {
    siteId: user.siteId,
    readerId: user.readerId,
  });
}

export async function getFaceTemplates(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: { limit: number; offset: number },
) {
  const db = await getUserDb(app, user);
  return listFaceTemplates(db, {
    siteId: user.siteId,
    readerId: user.readerId,
    limit: options.limit,
    offset: options.offset,
  });
}
