import type { FastifyInstance } from 'fastify';
import type { TAckReaderCommandsBody } from './sync.schemas.js';
import {
  attendanceExists,
  insertAttendance,
  listAttendanceByDate,
} from '../../db/repositories/attendance.repository.js';
import {
  employeeExistsForSite,
  findEmployeeByPin,
  listEmployees,
  setEmployeeAdminStatus,
} from '../../db/repositories/employees.repository.js';
import {
  countFaceTemplates,
  deleteFaceTemplate,
  findFaceTemplateByEmployeeId,
  listFaceTemplates,
  saveFaceTemplate,
} from '../../db/repositories/face-templates.repository.js';
import {
  createAppReader,
  findReaderById,
  findReaderBySerialNumber,
  updateReaderSeen,
  type IReaderRecord,
} from '../../db/repositories/readers.repository.js';
import {
  findReaderCommandById,
  listActiveReaderCommandRows,
  recordReaderCommandOutcome,
} from '../../db/repositories/reader-commands.repository.js';
import { parseReaderCommand } from './reader-command-types.js';
import { getDbNow, withPoolLease } from '../../db/pool.js';
import { setSerialNumberReader } from '../../db/repositories/serial-numbers.repository.js';
import {
  listJobSiteCodes,
  listWorkSiteActivityCodes,
} from '../../db/repositories/site-codes.repository.js';
import {
  getTemplateExpirySeconds,
  saveTemplateExpirySeconds,
} from '../../db/repositories/template-expiry.repository.js';
import { findSiteByCodeAndPassword } from '../../db/repositories/sites.repository.js';
import { AppError } from '../../plugins/response.js';
import type { IJwtUserPayload } from '../../types/auth.js';

async function getUserDb(app: FastifyInstance, user: IJwtUserPayload) {
  return app.dbPools.getPool(user.serverAddress);
}

export async function resolveReader(
  db: Awaited<ReturnType<typeof getUserDb>>,
  user: IJwtUserPayload,
): Promise<IReaderRecord> {
  if (user.readerId) {
    const reader = await findReaderById(db, user.readerId);
    if (reader) {
      return reader;
    }
  }

  if (!user.serialNumber) {
    throw new AppError('Reader serial number is required', 400, 'READER_SERIAL_REQUIRED');
  }

  const existingReader = await findReaderBySerialNumber(db, user.serialNumber);
  if (existingReader) {
    await setSerialNumberReader(db, {
      serialNumber: user.serialNumber,
      readerId: existingReader.readerId,
    });
    return existingReader;
  }

  const readerId = await createAppReader(db, {
    serialNumber: user.serialNumber,
    siteId: user.siteId,
  });
  await setSerialNumberReader(db, {
    serialNumber: user.serialNumber,
    readerId,
  });

  const createdReader = await findReaderById(db, readerId);
  if (!createdReader) {
    throw new AppError('Reader could not be created', 500, 'READER_CREATE_FAILED');
  }

  return createdReader;
}

export async function getEmployees(app: FastifyInstance, user: IJwtUserPayload) {
  const db = await getUserDb(app, user);
  return listEmployees(db, {
    siteId: user.siteId,
    readerId: user.readerId,
  });
}

export async function getEmployeeByPin(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: { pin: string },
) {
  const db = await getUserDb(app, user);
  return withPoolLease(db, async () => {
    const employee = await findEmployeeByPin(db, { siteId: user.siteId, pin: options.pin });

    if (!employee) {
      return { employee: null, faceTemplate: null };
    }

    const faceTemplate = await findFaceTemplateByEmployeeId(db, {
      siteId: user.siteId,
      employeeId: Number(employee.employeeId),
    });

    return { employee, faceTemplate };
  });
}

export async function getFaceTemplateCount(app: FastifyInstance, user: IJwtUserPayload) {
  const db = await getUserDb(app, user);
  return countFaceTemplates(db, {
    siteId: user.siteId,
    readerId: user.readerId,
  });
}

export async function getFaceTemplates(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: { limit: number; offset: number },
) {
  const db = await getUserDb(app, user);
  return listFaceTemplates(db, {
    siteId: user.siteId,
    readerId: user.readerId,
    limit: options.limit,
    offset: options.offset,
  });
}

export async function getJobSiteCodes(app: FastifyInstance, user: IJwtUserPayload) {
  const db = await getUserDb(app, user);
  return listJobSiteCodes(db, user.siteId);
}

export async function getWorkSiteActivityCodes(app: FastifyInstance, user: IJwtUserPayload) {
  const db = await getUserDb(app, user);
  return listWorkSiteActivityCodes(db, user.siteId);
}

export async function saveEmployeeFaceTemplate(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: { employeeId: number; faceData: string; template: string },
) {
  const db = await getUserDb(app, user);
  await withPoolLease(db, async () => {
    const employeeExists = await employeeExistsForSite(db, {
      siteId: user.siteId,
      employeeId: options.employeeId,
    });

    if (!employeeExists) {
      throw new AppError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
    }

    await saveFaceTemplate(db, {
      siteId: user.siteId,
      employeeId: options.employeeId,
      faceData: options.faceData,
      template: options.template,
    });
  });
}

export async function deleteEmployeeFaceTemplate(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: { employeeId: number },
) {
  const db = await getUserDb(app, user);
  await deleteFaceTemplate(db, {
    siteId: user.siteId,
    employeeId: options.employeeId,
  });
}

export async function setEmployeeAdmin(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: { employeeId: number; isAdmin: boolean; sitePin: string },
) {
  const db = await getUserDb(app, user);
  return withPoolLease(db, async () => {
    const site = await findSiteByCodeAndPassword(db, user.siteCode, options.sitePin);
    if (!site || site.siteId !== user.siteId) {
      throw new AppError('Invalid site PIN', 401, 'INVALID_SITE_PIN');
    }

    const employeeExists = await employeeExistsForSite(db, {
      siteId: user.siteId,
      employeeId: options.employeeId,
    });
    if (!employeeExists) {
      throw new AppError('Employee not found', 404, 'EMPLOYEE_NOT_FOUND');
    }

    await setEmployeeAdminStatus(db, {
      siteId: user.siteId,
      employeeId: options.employeeId,
      isAdmin: options.isAdmin,
    });

    return {
      employeeId: options.employeeId,
      isAdmin: options.isAdmin,
    };
  });
}

export async function verifySitePassword(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: { sitePassword: string },
) {
  const db = await getUserDb(app, user);
  const site = await findSiteByCodeAndPassword(db, user.siteCode, options.sitePassword);

  return { isValid: site?.siteId === user.siteId };
}

export async function uploadAttendance(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: {
    employeeId: number;
    employeePin: string;
    clockTime: string;
    status: number;
    jobSiteCode: string;
    workSiteActivityCode: string;
    clockGps: string;
    clockPhoto: string;
  },
) {
  const db = await getUserDb(app, user);
  return withPoolLease(db, async () => {
    const reader = await resolveReader(db, user);

    const duplicate = await attendanceExists(db, {
      employeeId: options.employeeId,
      readerId: reader.readerId,
      clockTime: options.clockTime,
    });

    if (duplicate) {
      return {
        uploaded: false,
        duplicate: true,
      };
    }

    await insertAttendance(db, {
      employeeId: options.employeeId,
      employeePin: options.employeePin,
      readerId: reader.readerId,
      clockTime: options.clockTime,
      status: options.status,
      workCode: reader.overrideWorkCode || options.workSiteActivityCode,
      jobCode: options.jobSiteCode,
      clockGps: options.clockGps,
      clockPhoto: options.clockPhoto,
    });

    return {
      uploaded: true,
      duplicate: false,
    };
  });
}

export async function getAttendanceHistory(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: { date?: string | undefined },
) {
  const db = await getUserDb(app, user);
  const today = (await getDbNow(db)).slice(0, 10);
  const date = options.date ?? today;
  const attendance = await listAttendanceByDate(db, {
    siteId: user.siteId,
    date,
  });

  return {
    attendance,
    date,
  };
}

export async function getSyncStatus(app: FastifyInstance, user: IJwtUserPayload) {
  const db = await getUserDb(app, user);
  return withPoolLease(db, async () => {
    const reader = await resolveReader(db, user);

    await updateReaderSeen(db, {
      readerId: reader.readerId,
    });

    return {
      online: true,
      serverTime: await getDbNow(db),
    };
  });
}

export async function getTemplateExpiry(app: FastifyInstance, user: IJwtUserPayload) {
  const db = await getUserDb(app, user);
  const expirySeconds = await getTemplateExpirySeconds(db, user.siteId);

  return {
    expirySeconds: expirySeconds ?? 2,
  };
}

export async function saveTemplateExpiry(
  app: FastifyInstance,
  user: IJwtUserPayload,
  options: { expirySeconds: number },
) {
  const db = await getUserDb(app, user);
  await saveTemplateExpirySeconds(db, {
    siteId: user.siteId,
    expirySeconds: options.expirySeconds,
  });

  return {
    expirySeconds: options.expirySeconds,
  };
}

export async function getReaderCommands(app: FastifyInstance, user: IJwtUserPayload) {
  const db = await getUserDb(app, user);
  return withPoolLease(db, async () => {
    const reader = await resolveReader(db, user);

    const rows = await listActiveReaderCommandRows(db, { readerId: reader.readerId });

    const commands = [];
    for (const row of rows) {
      const parsed = parseReaderCommand(row.command);
      if (parsed.length === 0) {
        await recordReaderCommandOutcome(db, { command: row, success: false });
        continue;
      }

      for (const item of parsed) {
        commands.push({
          commandId: row.command_id,
          type: item.type,
          data: item.data,
        });
      }
    }

    return { commands };
  });
}

export async function acknowledgeReaderCommands(
  app: FastifyInstance,
  user: IJwtUserPayload,
  results: TAckReaderCommandsBody,
) {
  const db = await getUserDb(app, user);
  await withPoolLease(db, async () => {
    const reader = await resolveReader(db, user);

    for (const result of results) {
      const command = await findReaderCommandById(db, {
        readerId: reader.readerId,
        commandId: result.commandId,
      });

      if (!command) {
        continue;
      }

      await recordReaderCommandOutcome(db, { command, success: result.success });
    }
  });
}
