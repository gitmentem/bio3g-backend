export interface IJwtUserPayload {
  sub: string;
  kind: 'site';
  serverAddress: string;
  siteId: number;
  siteCode: string;
  siteName: string;
  serialNumber?: string;
  readerId?: number;
  tokenUse?: 'access' | 'refresh' | 'qr-login';
  jti?: string;
  exp?: number | undefined;
  iat?: number | undefined;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: IJwtUserPayload;
    user: IJwtUserPayload;
  }
}
