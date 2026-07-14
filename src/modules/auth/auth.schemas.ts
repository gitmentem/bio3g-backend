import { z } from 'zod';

export const validateServerAddressSchema = z.object({
  serverAddress: z.string().min(1),
});

export type TValidateServerAddressBody = z.infer<typeof validateServerAddressSchema>;

export const verifySiteSchema = z.object({
  serverAddress: z.string().min(1),
  siteCode: z.string().min(1),
  userPin: z.string().min(1),
});

export type TVerifySiteBody = z.infer<typeof verifySiteSchema>;

export const registerDeviceSchema = z.object({
  serverAddress: z.string().min(1),
  siteCode: z.string().min(1),
  userPin: z.string().min(1),
  serialNumber: z.string().min(1),
});

export type TRegisterDeviceBody = z.infer<typeof registerDeviceSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type TRefreshBody = z.infer<typeof refreshSchema>;
