import type { RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { execute, query } from '../pool.js';

export interface IAttendanceUploadInput {
  employeeId: number;
  employeePin: string;
  readerId: number;
  clockTime: string;
  status: number;
  workCode: string;
  jobCode: string;
  clockGps: string;
  clockPhoto: string;
}

export interface IAttendanceRecord {
  attendanceId: number;
  employeeId: number;
  employeePin: string;
  employeeName: string;
  employeeStatus: string;
  readerId: number;
  clockTime: string;
  status: number;
}

interface IAttendanceRow extends RowDataPacket {
  attendance_id: number;
  employee_id: number;
  employee_pin: string | null;
  employee_name: string | null;
  employee_status: string | null;
  reader_id: number;
  clock: string;
  status: number;
}

function toAttendanceRecord(row: IAttendanceRow): IAttendanceRecord {
  return {
    attendanceId: Number(row.attendance_id),
    employeeId: Number(row.employee_id),
    employeePin: row.employee_pin === null ? '' : String(row.employee_pin),
    employeeName: row.employee_name === null ? '' : String(row.employee_name),
    employeeStatus: row.employee_status === null ? '' : String(row.employee_status),
    readerId: Number(row.reader_id),
    clockTime: String(row.clock),
    status: Number(row.status),
  };
}

export async function attendanceExists(
  db: Db,
  options: { employeeId: number; readerId: number; clockTime: string },
): Promise<boolean> {
  const rows = await query<Array<RowDataPacket & { attendance_id: number }>>(
    db,
    `
      SELECT attendance_id
      FROM attendance
      WHERE employee_id = ?
        AND reader_id = ?
        AND clock = ?
      LIMIT 1
    `,
    [options.employeeId, options.readerId, options.clockTime],
  );

  return rows.length > 0;
}

export async function insertAttendance(db: Db, input: IAttendanceUploadInput): Promise<void> {
  await execute(
    db,
    `
      INSERT INTO attendance (
        employee_pin,
        employee_id,
        reader_id,
        clock,
        mode,
        status,
        work,
        job,
        downloaded,
        mask,
        temperature,
        clock_gps,
        clock_photo,
        site_activity_code
      )
      VALUES (?, ?, ?, ?, 15, ?, ?, ?, 'No', 0, 0.0, ?, ?, NULL)
    `,
    [
      input.employeePin,
      input.employeeId,
      input.readerId,
      input.clockTime,
      input.status,
      input.workCode,
      input.jobCode,
      input.clockGps,
      input.clockPhoto,
    ],
  );
}

export async function listAttendanceByDate(
  db: Db,
  options: { siteId: number; date: string },
): Promise<IAttendanceRecord[]> {
  const rows = await query<IAttendanceRow[]>(
    db,
    `
      SELECT
        att.attendance_id,
        att.employee_id,
        emp.pin AS employee_pin,
        emp.name AS employee_name,
        emp.status AS employee_status,
        att.reader_id,
        att.clock,
        att.status
      FROM attendance AS att
      JOIN employee AS emp
        ON att.employee_id = emp.employee_id
      WHERE emp.site_id = ?
        AND DATE(att.clock) = ?
      ORDER BY emp.name ASC, att.employee_id ASC, att.clock ASC, att.attendance_id ASC
    `,
    [options.siteId, options.date],
  );

  return rows.map(toAttendanceRecord);
}
