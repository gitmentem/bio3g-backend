import type { RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { execute, query } from '../pool.js';

export interface IFaceTemplateRecord {
  employeeId: number;
  siteId: number;
  faceData: string;
  template: string;
}

interface IFaceTemplateRow extends RowDataPacket {
  employee_id: number;
  site_id: number;
  face_data: string;
  template: string;
}

function toFaceTemplateRecord(row: IFaceTemplateRow): IFaceTemplateRecord {
  return {
    employeeId: Number(row.employee_id),
    siteId: Number(row.site_id),
    faceData: String(row.face_data),
    template: String(row.template),
  };
}

export async function countFaceTemplates(
  db: Db,
  options: { siteId: number; readerId: number | undefined },
): Promise<number> {
  const readerFilter = options.readerId
    ? `AND EXISTS (
        SELECT 1
        FROM employee_reader_trans ert
        WHERE ert.employee_id = eft.employee_id
          AND ert.reader_id = ?
      )`
    : '';
  const params = options.readerId ? [options.siteId, options.readerId] : [options.siteId];

  const rows = await query<Array<RowDataPacket & { total: number }>>(
    db,
    `
      SELECT COUNT(*) AS total
      FROM employee_mobile_v2_face eft
      WHERE eft.site_id = ?
        AND EXISTS (
          SELECT 1
          FROM employee e
          WHERE e.employee_id = eft.employee_id
            AND e.status = 'Active'
            AND e.mobile = 'Yes'
        )
        ${readerFilter}
    `,
    params,
  );

  return Number(rows[0]?.total ?? 0);
}

export async function listFaceTemplates(
  db: Db,
  options: { siteId: number; readerId: number | undefined; limit: number; offset: number },
): Promise<IFaceTemplateRecord[]> {
  const readerFilter = options.readerId
    ? `AND EXISTS (
        SELECT 1
        FROM employee_reader_trans ert
        WHERE ert.employee_id = eft.employee_id
          AND ert.reader_id = ?
      )`
    : '';
  const params: number[] = [options.siteId];
  if (options.readerId) {
    params.push(options.readerId);
  }
  params.push(options.limit, options.offset);

  const rows = await query<IFaceTemplateRow[]>(
    db,
    `
      SELECT eft.employee_id, eft.site_id, eft.face_data, eft.template
      FROM employee_mobile_v2_face eft
      WHERE eft.site_id = ?
        AND EXISTS (
          SELECT 1
          FROM employee e
          WHERE e.employee_id = eft.employee_id
            AND e.status = 'Active'
            AND e.mobile = 'Yes'
        )
        ${readerFilter}
      ORDER BY eft.employee_id ASC
      LIMIT ? OFFSET ?
    `,
    params,
  );

  return rows.map(toFaceTemplateRecord);
}

export async function findFaceTemplateByEmployeeId(
  db: Db,
  options: { siteId: number; employeeId: number },
): Promise<IFaceTemplateRecord | null> {
  const rows = await query<IFaceTemplateRow[]>(
    db,
    `
      SELECT eft.employee_id, eft.site_id, eft.face_data, eft.template
      FROM employee_mobile_v2_face eft
      WHERE eft.site_id = ?
        AND eft.employee_id = ?
      LIMIT 1
    `,
    [options.siteId, options.employeeId],
  );

  const row = rows[0];
  return row ? toFaceTemplateRecord(row) : null;
}

export async function saveFaceTemplate(
  db: Db,
  options: { siteId: number; employeeId: number; faceData: string; template: string },
): Promise<void> {
  await execute(
    db,
    `
      INSERT INTO employee_mobile_v2_face (employee_id, site_id, face_data, template)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        face_data = VALUES(face_data),
        template = VALUES(template),
        updated_at = CURRENT_TIMESTAMP
    `,
    [options.employeeId, options.siteId, options.faceData, options.template],
  );
}

export async function deleteFaceTemplate(
  db: Db,
  options: { siteId: number; employeeId: number },
): Promise<void> {
  await execute(
    db,
    `
      DELETE FROM employee_mobile_v2_face
      WHERE employee_id = ?
        AND site_id = ?
    `,
    [options.employeeId, options.siteId],
  );
}
