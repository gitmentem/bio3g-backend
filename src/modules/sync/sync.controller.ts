import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IJwtUserPayload } from '../../types/auth.js';
import type { TFaceTemplatesQuery } from './sync.schemas.js';
import { getEmployees, getFaceTemplateCount, getFaceTemplates } from './sync.service.js';

export async function listEmployees(req: FastifyRequest, reply: FastifyReply) {
  const employees = await getEmployees(req.server, req.user as IJwtUserPayload);
  return reply.ok({ employees });
}

export async function faceTemplatesCount(req: FastifyRequest, reply: FastifyReply) {
  const count = await getFaceTemplateCount(req.server, req.user as IJwtUserPayload);
  return reply.ok({ count });
}

export async function listFaceTemplates(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as TFaceTemplatesQuery;
  const templates = await getFaceTemplates(req.server, req.user as IJwtUserPayload, query);

  return reply.ok({
    templates,
    pagination: {
      limit: query.limit,
      offset: query.offset,
    },
  });
}
