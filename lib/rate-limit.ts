type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

const buckets = new Map<string, Bucket>();

export function checkRateLimit(sessionId: string): {
    ok: boolean;
    retryAfterSec?: number;
} {
    const now = Date.now();
    const b = buckets.get(sessionId);

    if (!b || b.resetAt <= now) {
        buckets.set(sessionId, { count: 1, resetAt: now + WINDOW_MS });
        return { ok: true };
    }

    if (b.count >= MAX_PER_WINDOW) {
        return {
            ok: false,
            retryAfterSec: Math.ceil((b.resetAt - now) / 1000),
        };
    }

    b.count += 1;
    return { ok: true };
}

/** Test helper — wipes all buckets so tests start clean. */
export function resetRateLimit(): void {
    buckets.clear();
}