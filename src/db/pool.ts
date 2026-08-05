import mysql from 'mysql2/promise';
import type { ExecuteValues, QueryValues } from 'mysql2';
import type { Env } from '../config/env.js';

export type Db = mysql.Pool;
export type QueryParams = QueryValues[] | { [key: string]: QueryValues };
export type ExecuteParams = ExecuteValues[] | { [key: string]: ExecuteValues };

interface DbConnectionError {
  code?: string;
  fatal?: boolean;
}

export class DbPoolLimitError extends Error {
  readonly statusCode = 503;
  readonly code = 'DB_POOL_LIMIT_REACHED';

  constructor() {
    super('Server is busy, please try again');
  }
}

interface PoolState {
  manager: DbPoolManager;
  host: string;
  pool: Db;
  lastUsedAt: number;
  activeOperations: number;
  isWarming: boolean;
}

const poolStates = new WeakMap<Db, PoolState>();
const transientConnectionErrorCodes = new Set([
  'ECONNRESET',
  'PROTOCOL_CONNECTION_LOST',
  'ECONNREFUSED',
  'ETIMEDOUT',
]);

function isTransientConnectionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const dbError = err as DbConnectionError;
  return (
    (typeof dbError.code === 'string' && transientConnectionErrorCodes.has(dbError.code)) ||
    dbError.fatal === true
  );
}

export function createPool(env: Env, host: string): Db {
  return mysql.createPool({
    host,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    namedPlaceholders: true,
    dateStrings: true,
  });
}

export class DbPoolManager {
  private readonly pools = new Map<string, PoolState>();
  private readonly allowedHosts: Set<string>;
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(
    private readonly env: Env,
    allowedHosts: readonly string[],
  ) {
    this.allowedHosts = new Set(allowedHosts);
    this.cleanupTimer = setInterval(() => {
      this.closeIdlePools().catch(() => undefined);
    }, env.DB_CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  isAllowedHost(host: string): boolean {
    return this.allowedHosts.has(host);
  }

  private touch(state: PoolState): void {
    state.lastUsedAt = Date.now();
  }

  private async closePool(state: PoolState): Promise<void> {
    this.pools.delete(state.host);
    poolStates.delete(state.pool);
    await state.pool.end().catch(() => undefined);
  }

  private async evictColdestIdlePool(): Promise<boolean> {
    const idleStates = [...this.pools.values()]
      .filter((state) => state.activeOperations === 0 && !state.isWarming)
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt);

    const coldest = idleStates[0];
    if (!coldest) return false;

    await this.closePool(coldest);
    return true;
  }

  async closeIdlePools(): Promise<void> {
    const now = Date.now();
    const expiredStates = [...this.pools.values()].filter(
      (state) =>
        state.activeOperations === 0 &&
        !state.isWarming &&
        now - state.lastUsedAt >= this.env.DB_IDLE_TIMEOUT_MS,
    );

    await Promise.all(expiredStates.map((state) => this.closePool(state)));
  }

  async getPool(host: string): Promise<Db> {
    if (!this.isAllowedHost(host)) {
      throw new Error(`Database host is not allowed: ${host}`);
    }

    const existingState = this.pools.get(host);
    if (existingState) {
      this.touch(existingState);
      return existingState.pool;
    }

    if (this.pools.size >= this.env.DB_MAX_OPEN_POOLS) {
      const evicted = await this.evictColdestIdlePool();
      if (!evicted) {
        throw new DbPoolLimitError();
      }
    }

    const pool = createPool(this.env, host);
    const state: PoolState = {
      manager: this,
      host,
      pool,
      lastUsedAt: Date.now(),
      activeOperations: 0,
      isWarming: false,
    };
    this.pools.set(host, state);
    poolStates.set(pool, state);
    return pool;
  }

  async warmup(host: string): Promise<void> {
    const pool = await this.getPool(host);
    const state = poolStates.get(pool);
    if (state) {
      state.isWarming = true;
      state.activeOperations += 1;
    }
    try {
      const connection = await pool.getConnection();
      connection.release();
    } finally {
      if (state) {
        state.activeOperations -= 1;
        state.isWarming = false;
        this.touch(state);
      }
    }
  }

  async closeAll(): Promise<void> {
    clearInterval(this.cleanupTimer);
    await Promise.all([...this.pools.values()].map((state) => this.closePool(state)));
    this.pools.clear();
  }

  async invalidatePool(db: Db): Promise<void> {
    const state = poolStates.get(db);
    if (!state) return;
    await this.closePool(state);
  }

  async withRetry<T>(db: Db, operation: (pool: Db) => Promise<T>): Promise<T> {
    try {
      return await operation(db);
    } catch (err) {
      const state = poolStates.get(db);
      if (!state || !isTransientConnectionError(err)) {
        throw err;
      }

      await this.invalidatePool(db);
      const freshPool = await this.getPool(state.host);
      return operation(freshPool);
    }
  }
}

async function trackPoolOperation<T>(db: Db, operation: () => Promise<T>): Promise<T> {
  const state = poolStates.get(db);
  if (state) {
    state.activeOperations += 1;
    state.lastUsedAt = Date.now();
  }
  try {
    return await operation();
  } finally {
    if (state) {
      state.activeOperations -= 1;
      state.lastUsedAt = Date.now();
    }
  }
}

/**
 * Holds a pool "busy" for the full duration of `fn`, not just a single query/execute call.
 * Wrap any service function that makes more than one sequential `query`/`execute` call against
 * the same `db` in this — otherwise idle-cleanup or cross-host eviction can close the pool in
 * the gap between two of those calls (each individually marks itself busy only while in flight),
 * causing the next call in the same logical operation to fail with "Pool is closed."
 */
export async function withPoolLease<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  return trackPoolOperation(db, fn);
}

/** Parameterized query helper. `sql` must use `?` or named `:placeholders` — never string-concatenate values in. */
export async function query<T extends mysql.RowDataPacket[] = mysql.RowDataPacket[]>(
  db: Db,
  sql: string,
  params?: QueryParams,
): Promise<T> {
  const state = poolStates.get(db);
  const runQuery = (pool: Db) =>
    trackPoolOperation(pool, async () => {
      const [rows] = await pool.query<T>(sql, params);
      return rows;
    });

  if (!state) {
    return runQuery(db);
  }

  try {
    return await runQuery(db);
  } catch (err) {
    if (!isTransientConnectionError(err)) {
      throw err;
    }

    await state.manager.invalidatePool(db);
    const freshPool = await state.manager.getPool(state.host);
    return runQuery(freshPool);
  }
}

export async function execute(
  db: Db,
  sql: string,
  params?: ExecuteParams,
): Promise<mysql.ResultSetHeader> {
  const state = poolStates.get(db);
  const runExecute = (pool: Db) =>
    trackPoolOperation(pool, async () => {
      const [result] = await pool.execute<mysql.ResultSetHeader>(sql, params);
      return result;
    });

  if (!state) {
    return runExecute(db);
  }

  try {
    return await runExecute(db);
  } catch (err) {
    if (!isTransientConnectionError(err)) {
      throw err;
    }

    await state.manager.invalidatePool(db);
    const freshPool = await state.manager.getPool(state.host);
    return runExecute(freshPool);
  }
}

/** Returns the database server's current time (`YYYY-MM-DD HH:MM:SS`), not the app server's clock. */
export async function getDbNow(db: Db): Promise<string> {
  const rows = await query<(mysql.RowDataPacket & { now: string })[]>(db, 'SELECT NOW() AS now');
  return rows[0]!.now;
}

/** Runs `fn` inside a transaction, committing on success and rolling back on any thrown error. */
export async function withTransaction<T>(
  db: Db,
  fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  return trackPoolOperation(db, async () => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  });
}
