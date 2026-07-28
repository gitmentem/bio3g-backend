import type { RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { execute, query } from '../pool.js';

interface ITemplateExpiryRow extends RowDataPacket {
  expiry_time: number | string | null;
}

export async function getTemplateExpirySeconds(
  db: Db,
  siteId: number,
): Promise<number | null> {
  const rows = await query<ITemplateExpiryRow[]>(
    db,
    `
      SELECT expiry_time
      FROM time_expire
      WHERE site_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [siteId],
  );

  const expiryTime = rows[0]?.expiry_time;
  return expiryTime === null || expiryTime === undefined ? null : Number(expiryTime);
}

export async function saveTemplateExpirySeconds(
  db: Db,
  options: { siteId: number; expirySeconds: number },
): Promise<void> {
  await execute(
    db,
    `
      INSERT INTO time_expire (site_id, expiry_time)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE expiry_time = VALUES(expiry_time)
    `,
    [options.siteId, options.expirySeconds],
  );
}
