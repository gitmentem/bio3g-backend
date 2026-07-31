import { z } from 'zod';

export const faceTemplatesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type TFaceTemplatesQuery = z.infer<typeof faceTemplatesQuerySchema>;

export const saveFaceTemplateSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  faceData: z.string().min(1),
  template: z.string().min(1),
});

export type TSaveFaceTemplateBody = z.infer<typeof saveFaceTemplateSchema>;

export const deleteFaceTemplateSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
});

export type TDeleteFaceTemplateBody = z.infer<typeof deleteFaceTemplateSchema>;

export const setEmployeeAdminSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  isAdmin: z.boolean(),
  sitePin: z.string().min(1),
});

export type TSetEmployeeAdminBody = z.infer<typeof setEmployeeAdminSchema>;

export const uploadAttendanceSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  employeePin: z.string().min(1),
  clockTime: z.string().min(1),
  status: z.coerce.number().int().min(0).max(1),
  jobSiteCode: z.string().optional().default(''),
  workSiteActivityCode: z.string().optional().default(''),
  clockGps: z.string().optional().default(''),
  clockPhoto: z.string().optional().default(''),
});

export type TUploadAttendanceBody = z.infer<typeof uploadAttendanceSchema>;

export const attendanceHistoryQuerySchema = z
  .object({
    date: z.string().min(1).optional(),
  })
  .default({});

export type TAttendanceHistoryQuery = z.infer<typeof attendanceHistoryQuerySchema>;

export const saveTemplateExpirySchema = z.object({
  expirySeconds: z.coerce.number().int().positive(),
});

export type TSaveTemplateExpiryBody = z.infer<typeof saveTemplateExpirySchema>;

export const ackReaderCommandsSchema = z
  .array(
    z.object({
      commandId: z.coerce.number().int().positive(),
      success: z.boolean(),
    }),
  )
  .min(1);

export type TAckReaderCommandsBody = z.infer<typeof ackReaderCommandsSchema>;

export const employeeLookupParamsSchema = z.object({
  pin: z.string().min(1),
});

export type TEmployeeLookupParams = z.infer<typeof employeeLookupParamsSchema>;

export const verifySitePasswordSchema = z.object({
  sitePassword: z.string().min(1),
});

export type TVerifySitePasswordBody = z.infer<typeof verifySitePasswordSchema>;
