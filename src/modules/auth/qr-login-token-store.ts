// Tracks single-use QR-login token IDs (`jti`) for the lifetime of this process.
// A QR code is inherently more exposed than a typed password (it's shown on a
// screen), so once its `jti` is reserved it can never be redeemed again. This is
// in-memory, per-process state — acceptable because this backend runs as a
// single instance today (no clustering); if it's ever scaled horizontally
// without sticky sessions, swap this for a shared store (e.g. Redis).

const CLEANUP_INTERVAL_MS = 60_000;

export class QrLoginTokenStore {
  private readonly reserved = new Map<string, number>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.pruneExpired(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  /** Atomically checks-and-reserves `jti`. Returns false if it was already reserved. */
  tryReserve(jti: string, expiresAtMs: number): boolean {
    this.pruneExpired();

    if (this.reserved.has(jti)) {
      return false;
    }

    this.reserved.set(jti, expiresAtMs);
    return true;
  }

  /** Un-reserves `jti` so the same still-valid QR code can be retried. */
  release(jti: string): void {
    this.reserved.delete(jti);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [jti, expiresAtMs] of this.reserved) {
      if (expiresAtMs <= now) {
        this.reserved.delete(jti);
      }
    }
  }

  stop(): void {
    clearInterval(this.cleanupTimer);
  }
}
