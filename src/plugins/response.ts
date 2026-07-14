import type { FastifyError, FastifyInstance, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodIssue } from 'zod';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

declare module 'fastify' {
  interface FastifyReply {
    ok<T>(data: T, statusCode?: number): FastifyReply;
  }
}

interface ValidationErrorItem {
  params?: {
    issue?: ZodIssue;
  };
  instancePath?: string;
  message?: string;
}

interface DatabaseError {
  code?: string;
  errno?: number;
}

interface StatusCodeError {
  statusCode?: number;
  code?: string;
  message?: string;
}

const databaseErrorCodes = new Set([
  'ER_ACCESS_DENIED_ERROR',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST',
]);

function isDatabaseConnectionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as DatabaseError).code;
  return typeof code === 'string' && databaseErrorCodes.has(code);
}

function getFieldName(issue: ZodIssue | undefined, fallbackPath: string | undefined): string {
  const path = issue?.path.length ? issue.path.join('.') : fallbackPath?.replace(/^\//, '');
  return path || 'field';
}

function formatValidationMessage(err: FastifyError): string {
  const validation = err.validation as ValidationErrorItem[] | undefined;
  const firstError = validation?.[0];
  const issue = firstError?.params?.issue;

  if (
    err.validationContext === 'body' &&
    issue?.code === 'invalid_type' &&
    issue.path.length === 0
  ) {
    return 'Request body is required';
  }

  if (issue?.code === 'invalid_type' && issue.received === 'undefined') {
    return `${getFieldName(issue, firstError?.instancePath)} is required`;
  }

  if (issue?.code === 'too_small') {
    return `${getFieldName(issue, firstError?.instancePath)} cannot be empty`;
  }

  return firstError?.message || 'Invalid request';
}

export const responsePlugin = fp(async function responsePlugin(
  app: FastifyInstance,
): Promise<void> {
  app.decorateReply('ok', function (this: FastifyReply, data: unknown, statusCode = 200) {
    return this.status(statusCode).send({ success: true, data });
  });

  app.setErrorHandler<FastifyError | AppError>((err, _req, reply) => {
    if (err instanceof AppError) {
      reply.status(err.statusCode).send({
        success: false,
        data: { message: err.message, code: err.code },
      });
      return;
    }

    if (err.validation) {
      reply.status(400).send({
        success: false,
        data: { message: formatValidationMessage(err), code: 'VALIDATION_ERROR' },
      });
      return;
    }

    if (isDatabaseConnectionError(err)) {
      app.log.error(err);
      reply.status(503).send({
        success: false,
        data: {
          message: 'Database connection failed for the selected server',
          code: 'DATABASE_CONNECTION_ERROR',
        },
      });
      return;
    }

    const statusError = err as StatusCodeError;
    const statusCode = statusError.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(err);
    }
    reply.status(statusCode).send({
      success: false,
      data: {
        message:
          statusCode >= 500 && !statusError.code
            ? 'Internal server error'
            : statusError.message || 'Request failed',
        code: statusError.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
      },
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({
      success: false,
      data: { message: 'Request not found', code: 'NOT_FOUND' },
    });
  });
});
