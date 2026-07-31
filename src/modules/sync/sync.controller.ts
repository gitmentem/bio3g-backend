import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IJwtUserPayload } from '../../types/auth.js';
import type {
  TAckReaderCommandsBody,
  TAttendanceHistoryQuery,
  TDeleteFaceTemplateBody,
  TEmployeeLookupParams,
  TFaceTemplatesQuery,
  TSaveFaceTemplateBody,
  TSaveTemplateExpiryBody,
  TSetEmployeeAdminBody,
  TUploadAttendanceBody,
  TVerifySitePasswordBody,
} from './sync.schemas.js';
import {
  acknowledgeReaderCommands,
  deleteEmployeeFaceTemplate,
  getAttendanceHistory,
  getEmployeeByPin,
  getEmployees,
  getFaceTemplateCount,
  getFaceTemplates,
  getJobSiteCodes,
  getReaderCommands,
  getSyncStatus,
  getTemplateExpiry,
  getWorkSiteActivityCodes,
  saveEmployeeFaceTemplate,
  saveTemplateExpiry,
  setEmployeeAdmin,
  uploadAttendance,
  verifySitePassword,
} from './sync.service.js';

export async function status(_req: FastifyRequest, reply: FastifyReply) {
  return reply.ok(getSyncStatus());
}

export async function listEmployees(req: FastifyRequest, reply: FastifyReply) {
  const employees = await getEmployees(req.server, req.user as IJwtUserPayload);
  return reply.ok({ employees });
}

export async function lookupEmployeeByPin(req: FastifyRequest, reply: FastifyReply) {
  const params = req.params as TEmployeeLookupParams;
  const result = await getEmployeeByPin(req.server, req.user as IJwtUserPayload, params);
  return reply.ok(result);
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

export async function listReaderCommands(req: FastifyRequest, reply: FastifyReply) {
  const result = await getReaderCommands(req.server, req.user as IJwtUserPayload);
  return reply.ok(result);
}

export async function ackReaderCommands(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TAckReaderCommandsBody;
  await acknowledgeReaderCommands(req.server, req.user as IJwtUserPayload, body);
  return reply.ok({});
}

export async function verifyPassword(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as TVerifySitePasswordBody;
  const result = await verifySitePassword(req.server, req.user as IJwtUserPayload, body);
  return reply.ok(result);
}
