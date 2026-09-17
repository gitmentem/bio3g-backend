import type { RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { execute, query } from '../pool.js';

export interface ISerialNumberRecord {
  siteId: number | null;
  readerId: number | null;
  serialNumber: string;
  occupied: 'Yes' | 'No';
}

interface ISerialNumberRow extends RowDataPacket {
  site_id: number | null;
  reader_id: number | null;
  serial_number: string;
  occupied: 'Yes' | 'No';
}

function toSerialNumberRecord(row: ISerialNumberRow): ISerialNumberRecord {
  return {
    siteId: row.site_id === null ? null : Number(row.site_id),
    readerId: row.reader_id === null ? null : Number(row.reader_id),
    serialNumber: String(row.serial_number),
    occupied: row.occupied,
  };
}

export async function findSerialNumber(
  db: Db,
  serialNumber: string,
): Promise<ISerialNumberRecord | null> {
  const rows = await query<ISerialNumberRow[]>(
    db,
    `
      SELECT site_id, reader_id, serial_number, occupied
      FROM serial_number
      WHERE serial_number = ?
      LIMIT 1
    `,
    [serialNumber],
  );

  const row = rows[0];
  return row ? toSerialNumberRecord(row) : null;
}

export async function markSerialNumberOccupied(
  db: Db,
  options: { serialNumber: string; siteId: number; readerId: number | undefined },
): Promise<void> {
  await execute(
    db,
    `
      UPDATE serial_number
      SET occupied = 'Yes',
          site_id = ?,
          reader_id = COALESCE(?, reader_id)
      WHERE serial_number = ?
    `,
    [options.siteId, options.readerId ?? null, options.serialNumber],
  );
}

export async function releaseSerialNumber(db: Db, serialNumber: string): Promise<void> {
  await execute(
    db,
    `
      UPDATE serial_number
      SET occupied = 'No'
      WHERE serial_number = ?
    `,
    [serialNumber],
  );
}

export async function setSerialNumberReader(
  db: Db,
  options: { serialNumber: string; readerId: number },
): Promise<void> {
  await execute(
    db,
    `
      UPDATE serial_number
      SET reader_id = ?
      WHERE serial_number = ?
        AND (reader_id IS NULL OR reader_id = ?)
    `,
    [options.readerId, options.serialNumber, options.readerId],
  );
}
