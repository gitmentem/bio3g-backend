export interface IJwtUserPayload {
  sub: string;
  kind: 'site';
  serverAddress: string;
  siteId: number;
  siteCode: string;
  siteName: string;
  serialNumber?: string;
  readerId?: number;
  tokenUse?: 'access' | 'refresh';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: IJwtUserPayload;
    user: IJwtUserPayload;
  }
}
