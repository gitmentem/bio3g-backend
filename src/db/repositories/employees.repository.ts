import type { RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { execute, query } from '../pool.js';

export interface IEmployeeRecord {
  employeeId: string;
  employeePin: string;
  employeeName: string;
  employeePassword: string;
  siteId: string;
  isAdmin: boolean;
}

interface IEmployeeRow extends RowDataPacket {
  employee_id: number;
  pin: string;
  name: string;
  password: string | null;
  site_id: number;
  priv: number | null;
}

function toEmployeeRecord(row: IEmployeeRow): IEmployeeRecord {
  return {
    employeeId: String(row.employee_id),
    employeePin: String(row.pin),
    employeeName: String(row.name),
    employeePassword: row.password === null ? '' : String(row.password),
    siteId: String(row.site_id),
    isAdmin: Number(row.priv ?? 0) === 14,
  };
}

export async function listEmployees(
  db: Db,
  options: { siteId: number; readerId: number | undefined },
): Promise<IEmployeeRecord[]> {
  const readerFilter = options.readerId
    ? `AND EXISTS (
        SELECT 1
        FROM employee_reader_trans ert
        WHERE ert.employee_id = e.employee_id
          AND ert.reader_id = ?
      )`
    : '';
  const params = options.readerId ? [options.siteId, options.readerId] : [options.siteId];

  const rows = await query<IEmployeeRow[]>(
    db,
    `
      SELECT e.employee_id, e.pin, e.name, e.password, e.site_id, e.priv
      FROM employee e
      WHERE e.site_id = ?
        AND e.status = 'Active'
        AND e.mobile = 'Yes'
        ${readerFilter}
      ORDER BY e.name ASC, e.employee_id ASC
    `,
    params,
  );

  return rows.map(toEmployeeRecord);
}

export async function findEmployeeByPin(
  db: Db,
  options: { siteId: number; pin: string },
): Promise<IEmployeeRecord | null> {
  const rows = await query<IEmployeeRow[]>(
    db,
    `
      SELECT e.employee_id, e.pin, e.name, e.password, e.site_id, e.priv
      FROM employee e
      WHERE e.site_id = ?
        AND e.pin = ?
        AND e.status = 'Active'
        AND e.mobile = 'Yes'
      LIMIT 1
    `,
    [options.siteId, options.pin],
  );

  const row = rows[0];
  return row ? toEmployeeRecord(row) : null;
}

export async function employeeExistsForSite(
  db: Db,
  options: { siteId: number; employeeId: number },
): Promise<boolean> {
  const rows = await query<Array<RowDataPacket & { found: number }>>(
    db,
    `
      SELECT 1 AS found
      FROM employee
      WHERE employee_id = ?
        AND site_id = ?
      LIMIT 1
    `,
    [options.employeeId, options.siteId],
  );

  return rows.length > 0;
}

export async function setEmployeeAdminStatus(
  db: Db,
  options: { siteId: number; employeeId: number; isAdmin: boolean },
): Promise<void> {
  await execute(
    db,
    `
      UPDATE employee
      SET priv = ?
      WHERE employee_id = ?
        AND site_id = ?
    `,
    [options.isAdmin ? 14 : 0, options.employeeId, options.siteId],
  );
}
