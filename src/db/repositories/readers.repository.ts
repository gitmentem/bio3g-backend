import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { execute, query } from '../pool.js';

export interface IReaderRecord {
  readerId: number;
  serialNumber: string;
  overrideWorkCode: string;
}

interface IReaderRow extends RowDataPacket {
  reader_id: number;
  sn: string | null;
  override_work_code: string | null;
}

function toReaderRecord(row: IReaderRow): IReaderRecord {
  return {
    readerId: Number(row.reader_id),
    serialNumber: row.sn === null ? '' : String(row.sn),
    overrideWorkCode: row.override_work_code === null ? '' : String(row.override_work_code),
  };
}

export async function findReaderById(db: Db, readerId: number): Promise<IReaderRecord | null> {
  const rows = await query<IReaderRow[]>(
    db,
    `
      SELECT reader_id, sn, override_work_code
      FROM reader
      WHERE reader_id = ?
      LIMIT 1
    `,
    [readerId],
  );

  const row = rows[0];
  return row ? toReaderRecord(row) : null;
}

export async function findReaderBySerialNumber(
  db: Db,
  serialNumber: string,
): Promise<IReaderRecord | null> {
  const rows = await query<IReaderRow[]>(
    db,
    `
      SELECT reader_id, sn, override_work_code
      FROM reader
      WHERE sn = ?
      LIMIT 1
    `,
    [serialNumber],
  );

  const row = rows[0];
  return row ? toReaderRecord(row) : null;
}

export async function createAppReader(
  db: Db,
  options: { serialNumber: string; siteId: number },
): Promise<number> {
  const result = await execute(
    db,
    `
      INSERT INTO reader (
        sn,
        name,
        site_id,
        stamp,
        delay,
        ttimes,
        opstamp,
        seen,
        zone,
        password_exempted,
        transflag,
        cellphone
      )
      VALUES (?, '9999', ?, '9999', 1, '', '9999', NOW(), 2, 'Yes', '999999', '')
    `,
    [options.serialNumber, options.siteId],
  );

  return Number((result as ResultSetHeader).insertId);
}

export async function updateReaderSeen(db: Db, options: { readerId: number }): Promise<void> {
  await execute(
    db,
    `
      UPDATE reader
      SET seen = NOW()
      WHERE reader_id = ?
    `,
    [options.readerId],
  );
}
