import type { FastifyInstance } from 'fastify';
import {
  deleteFaceTemplate,
  faceTemplatesCount,
  listAttendance,
  listJobSiteCodes,
  listEmployees,
  listFaceTemplates,
  listWorkSiteActivityCodes,
  saveFaceTemplate,
  saveTemplateExpiryDuration,
  status,
  templateExpiry,
  updateEmployeeAdmin,
  uploadAttendanceClock,
} from './sync.controller.js';
import {
  attendanceHistoryQuerySchema,
  deleteFaceTemplateSchema,
  faceTemplatesQuerySchema,
  saveFaceTemplateSchema,
  saveTemplateExpirySchema,
  setEmployeeAdminSchema,
  uploadAttendanceSchema,
} from './sync.schemas.js';

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  app.get('/status', { preHandler: app.authenticateUser }, status);

  app.get(
    '/attendance',
    {
      preHandler: app.authenticateUser,
      schema: { querystring: attendanceHistoryQuerySchema },
    },
    listAttendance,
  );

  app.get('/employees', { preHandler: app.authenticateUser }, listEmployees);

  app.post(
    '/employees/admin',
    {
      preHandler: app.authenticateUser,
      schema: { body: setEmployeeAdminSchema },
    },
    updateEmployeeAdmin,
  );

  app.get('/job-site-codes', { preHandler: app.authenticateUser }, listJobSiteCodes);

  app.get(
    '/work-site-activity-codes',
    { preHandler: app.authenticateUser },
    listWorkSiteActivityCodes,
  );

  app.get('/face-templates/count', { preHandler: app.authenticateUser }, faceTemplatesCount);

  app.get('/template-expiry', { preHandler: app.authenticateUser }, templateExpiry);

  app.post(
    '/template-expiry/save',
    {
      preHandler: app.authenticateUser,
      schema: { body: saveTemplateExpirySchema },
    },
    saveTemplateExpiryDuration,
  );

  app.get(
    '/face-templates',
    {
      preHandler: app.authenticateUser,
      schema: { querystring: faceTemplatesQuerySchema },
    },
    listFaceTemplates,
  );

  app.post(
    '/face-templates/save',
    {
      preHandler: app.authenticateUser,
      schema: { body: saveFaceTemplateSchema },
    },
    saveFaceTemplate,
  );

  app.post(
    '/face-templates/delete',
    {
      preHandler: app.authenticateUser,
      schema: { body: deleteFaceTemplateSchema },
    },
    deleteFaceTemplate,
  );

  app.post(
    '/attendance/upload',
    {
      preHandler: app.authenticateUser,
      schema: { body: uploadAttendanceSchema },
    },
    uploadAttendanceClock,
  );
}
