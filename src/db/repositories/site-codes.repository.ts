import type { RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { query } from '../pool.js';

export interface IJobSiteCodeRecord {
  jobSiteCodeId: string;
  displayName: string;
  description: string;
  siteId: string;
}

export interface IWorkSiteActivityCodeRecord {
  workSiteActivityCodeId: string;
  displayName: string;
  description: string;
  siteId: string;
}

interface ISiteCodeRow extends RowDataPacket {
  id: number | string;
  name: string | null;
  desc: string | null;
  site_id: number | string;
}

function toJobSiteCodeRecord(row: ISiteCodeRow): IJobSiteCodeRecord {
  const name = row.name === null ? '' : String(row.name);
  const description = row.desc === null ? '' : String(row.desc);
  return {
    jobSiteCodeId: String(row.id),
    displayName: name,
    description,
    siteId: String(row.site_id),
  };
}

function toWorkSiteActivityCodeRecord(row: ISiteCodeRow): IWorkSiteActivityCodeRecord {
  const name = row.name === null ? '' : String(row.name);
  const description = row.desc === null ? '' : String(row.desc);
  return {
    workSiteActivityCodeId: String(row.id),
    displayName: name,
    description,
    siteId: String(row.site_id),
  };
}

export async function listJobSiteCodes(db: Db, siteId: number): Promise<IJobSiteCodeRecord[]> {
  const rows = await query<ISiteCodeRow[]>(
    db,
    `
      SELECT id, name, \`desc\`, site_id
      FROM mobile_site_code
      WHERE site_id = ?
      ORDER BY name ASC
    `,
    [siteId],
  );

  return rows.map(toJobSiteCodeRecord);
}

export async function listWorkSiteActivityCodes(
  db: Db,
  siteId: number,
): Promise<IWorkSiteActivityCodeRecord[]> {
  const rows = await query<ISiteCodeRow[]>(
    db,
    `
      SELECT id, name, \`desc\`, site_id
      FROM mobile_site_activity_code
      WHERE site_id = ?
      ORDER BY name ASC
    `,
    [siteId],
  );

  return rows.map(toWorkSiteActivityCodeRecord);
}
