// src/lib/retry.ts
// Retry utility with exponential backoff for transient failures.
// Deduplication cache for AI function calls.

import { TransientError, RateLimitError, AriaError } from './errors';

// ============================================
// Retry
// ============================================

interface RetryOptions {
    maxAttempts?: number;   // Default 3
    baseDelayMs?: number;   // Default 300ms
    maxDelayMs?: number;    // Default 5000ms
}

// Determines if an error is safe to retry
function isRetryable(err: unknown): boolean {
    if (err instanceof TransientError) return true;
    if (err instanceof RateLimitError) return true;
    if (err instanceof AriaError) return false; // All other typed errors are not retryable

    // Untyped errors — check message for transient signals
    const message = err instanceof Error ? err.message : String(err);
    return (
        message.includes('503') ||
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('rate limit')
    );
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Wraps any async function with retry + exponential backoff.
// Only retries on transient/rate-limit errors.
// Non-retryable errors (validation, auth, not found) bubble up immediately.
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelayMs = 300,
        maxDelayMs = 5000,
    } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;

            if (!isRetryable(err) || attempt === maxAttempts) {
                throw err;
            }

            // Exponential backoff with jitter
            const exponential = baseDelayMs * Math.pow(2, attempt - 1);
            const jitter = Math.random() * baseDelayMs;
            const waitMs = Math.min(exponential + jitter, maxDelayMs);

            console.warn(
                `[Aria] Attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(waitMs)}ms:`,
                err instanceof Error ? err.message : err
            );

            await delay(waitMs);
        }
    }

    throw lastError;
}

// ============================================
// AI Function Deduplication Cache
// ============================================
// Prevents double-execution if the AI loop fires the same function
// twice within the TTL window (e.g. network hiccup causing retry).
// Uses an in-memory Map — intentionally not persisted across page loads.

const DEDUP_TTL_MS = 5000; // 5 seconds

interface DedupEntry {
    resolvedAt: number;
    result: { success: boolean; data?: unknown; error?: string };
}

const dedupCache = new Map<string, DedupEntry>();

// Generates a stable cache key from function name + args
function buildDedupKey(functionName: string, args: Record<string, unknown>): string {
    return `${functionName}::${JSON.stringify(args, Object.keys(args).sort())}`;
}

// Evicts expired entries to prevent unbounded memory growth
function evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of dedupCache.entries()) {
        if (now - entry.resolvedAt > DEDUP_TTL_MS) {
            dedupCache.delete(key);
        }
    }
}

// Wraps a function execution with deduplication.
// If the same (functionName + args) was successfully called within TTL, returns cached result.
export async function withDedup(
    functionName: string,
    args: Record<string, unknown>,
    fn: () => Promise<{ success: boolean; data?: unknown; error?: string }>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
    evictExpired();

    const key = buildDedupKey(functionName, args);
    const cached = dedupCache.get(key);

    if (cached && Date.now() - cached.resolvedAt < DEDUP_TTL_MS) {
        console.info(`[Aria] Dedup hit for ${functionName}, returning cached result`);
        return cached.result;
    }

    const result = await fn();

    // Only cache successful results — failed calls should be retried
    if (result.success) {
        dedupCache.set(key, { resolvedAt: Date.now(), result });
    }

    return result;
}
