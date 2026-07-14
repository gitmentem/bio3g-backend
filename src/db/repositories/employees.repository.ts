import type { RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { query } from '../pool.js';

export interface IEmployeeRecord {
  employeeId: string;
  employeePin: string;
  employeeName: string;
  siteId: string;
  isAdmin: boolean;
}

interface IEmployeeRow extends RowDataPacket {
  employee_id: number;
  pin: string;
  name: string;
  site_id: number;
  priv: number | null;
}

function toEmployeeRecord(row: IEmployeeRow): IEmployeeRecord {
  return {
    employeeId: String(row.employee_id),
    employeePin: String(row.pin),
    employeeName: String(row.name),
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
      SELECT e.employee_id, e.pin, e.name, e.site_id, e.priv
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
