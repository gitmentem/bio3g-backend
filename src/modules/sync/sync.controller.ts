import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IJwtUserPayload } from '../../types/auth.js';
import type {
  TAttendanceHistoryQuery,
  TDeleteFaceTemplateBody,
  TFaceTemplatesQuery,
  TSaveFaceTemplateBody,
  TSaveTemplateExpiryBody,
  TSetEmployeeAdminBody,
  TUploadAttendanceBody,
} from './sync.schemas.js';
import {
  deleteEmployeeFaceTemplate,
  getAttendanceHistory,
  getEmployees,
  getFaceTemplateCount,
  getFaceTemplates,
  getJobSiteCodes,
  getSyncStatus,
  getTemplateExpiry,
  getWorkSiteActivityCodes,
  saveEmployeeFaceTemplate,
  saveTemplateExpiry,
  setEmployeeAdmin,
  uploadAttendance,
} from './sync.service.js';

export async function status(_req: FastifyRequest, reply: FastifyReply) {
  return reply.ok(getSyncStatus());
}

export async function listEmployees(req: FastifyRequest, reply: FastifyReply) {
  const employees = await getEmployees(req.server, req.user as IJwtUserPayload);
  return reply.ok({ employees });
}

export async function listAttendance(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as TAttendanceHistoryQuery;
  const result = await getAttendanceHistory(req.server, req.user as IJwtUserPayload, query);
  return reply.ok(result);
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

export async function templateExpiry(req: FastifyRequest, reply: FastifyReply) {
  const result = await getTemplateExpiry(req.server, req.user as IJwtUserPayload);
  return reply.ok(result);
}

export async function saveTemplateExpiryDuration(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TSaveTemplateExpiryBody;
  const result = await saveTemplateExpiry(req.server, req.user as IJwtUserPayload, body);
  return reply.ok({
    ...result,
    message: 'Template expiry duration saved',
  });
}

export async function listJobSiteCodes(req: FastifyRequest, reply: FastifyReply) {
  const jobSiteCodes = await getJobSiteCodes(req.server, req.user as IJwtUserPayload);
  return reply.ok({ jobSiteCodes });
}

export async function listWorkSiteActivityCodes(req: FastifyRequest, reply: FastifyReply) {
  const workSiteActivityCodes = await getWorkSiteActivityCodes(
    req.server,
    req.user as IJwtUserPayload,
  );
  return reply.ok({ workSiteActivityCodes });
}

export async function saveFaceTemplate(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TSaveFaceTemplateBody;
  await saveEmployeeFaceTemplate(req.server, req.user as IJwtUserPayload, body);
  return reply.ok({ message: 'Face template saved' });
}

export async function deleteFaceTemplate(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TDeleteFaceTemplateBody;
  await deleteEmployeeFaceTemplate(req.server, req.user as IJwtUserPayload, body);
  return reply.ok({ message: 'Face template deleted' });
}

export async function updateEmployeeAdmin(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TSetEmployeeAdminBody;
  const result = await setEmployeeAdmin(req.server, req.user as IJwtUserPayload, body);
  return reply.ok({
    ...result,
    message: result.isAdmin ? 'Employee promoted to admin' : 'Employee removed as admin',
  });
}

export async function uploadAttendanceClock(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TUploadAttendanceBody;
  const result = await uploadAttendance(req.server, req.user as IJwtUserPayload, body);
  return reply.ok(result);
}
