import type { RowDataPacket } from 'mysql2';
import type { Db } from '../pool.js';
import { execute, query } from '../pool.js';

export interface IReaderCommandRecord {
  commandId: number;
  command: string;
}

export interface IReaderCommandRow extends RowDataPacket {
  command_id: number;
  reader_id: number;
  command: string;
  sourceinfo: string | null;
}

export function toReaderCommandRecord(row: IReaderCommandRow): IReaderCommandRecord {
  return {
    commandId: Number(row.command_id),
    command: String(row.command),
  };
}

const MAX_COMMANDS_PER_FETCH = 1000;

export async function listActiveReaderCommandRows(
  db: Db,
  options: { readerId: number },
): Promise<IReaderCommandRow[]> {
  return query<IReaderCommandRow[]>(
    db,
    `
      SELECT command_id, reader_id, command, sourceinfo
      FROM reader_command
      WHERE status = 'Active' AND reader_id = ?
      ORDER BY command_id
      LIMIT ?
    `,
    [options.readerId, MAX_COMMANDS_PER_FETCH],
  );
}

export async function findReaderCommandById(
  db: Db,
  options: { readerId: number; commandId: number },
): Promise<IReaderCommandRow | null> {
  const rows = await query<IReaderCommandRow[]>(
    db,
    `
      SELECT command_id, reader_id, command, sourceinfo
      FROM reader_command
      WHERE command_id = ? AND reader_id = ?
      LIMIT 1
    `,
    [options.commandId, options.readerId],
  );

  return rows[0] ?? null;
}

export async function recordReaderCommandOutcome(
  db: Db,
  options: { command: IReaderCommandRow; success: boolean },
): Promise<void> {
  const { command, success } = options;
  const historyTable = success ? 'reader_command_history' : 'reader_command_history_unsuccessful';

  await execute(
    db,
    `
      INSERT INTO ${historyTable} (command_id, cmd_id, reader_id, command, sourceinfo)
      VALUES (?, ?, ?, ?, ?)
    `,
    [command.command_id, command.command_id, command.reader_id, command.command, command.sourceinfo],
  );

  await execute(db, `DELETE FROM reader_command WHERE command_id = ?`, [command.command_id]);
}
