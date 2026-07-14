import type { FastifyInstance } from 'fastify';
import { faceTemplatesCount, listEmployees, listFaceTemplates } from './sync.controller.js';
import { faceTemplatesQuerySchema } from './sync.schemas.js';

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.get('/employees', { preHandler: app.authenticateUser }, listEmployees);

  app.get('/face-templates/count', { preHandler: app.authenticateUser }, faceTemplatesCount);

  app.get(
    '/face-templates',
    {
      preHandler: app.authenticateUser,
      schema: { querystring: faceTemplatesQuerySchema },
    },
    listFaceTemplates,
  );
}
