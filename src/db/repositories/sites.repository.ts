import type { RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { query } from '../pool.js';

export interface ISiteLoginRecord {
  siteId: number;
  siteCode: string;
  siteName: string;
}

interface ISiteLoginRow extends RowDataPacket {
  site_id: number;
  site_code: string;
  name: string;
}

export async function findSiteByCodeAndPassword(
  db: Db,
  siteCode: string,
  password: string,
): Promise<ISiteLoginRecord | null> {
  const rows = await query<ISiteLoginRow[]>(
    db,
    `
      SELECT site_id, site_code, name
      FROM site
      WHERE site_code = ? AND site_password = ?
      ORDER BY site_id ASC
      LIMIT 1
    `,
    [siteCode, password],
  );

  const site = rows[0];
  if (!site) return null;

  return {
    siteId: Number(site.site_id),
    siteCode: String(site.site_code),
    siteName: String(site.name),
  };
}
