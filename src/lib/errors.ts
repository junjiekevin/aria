// src/lib/errors.ts
// Typed error taxonomy for Aria.
// All errors extend AriaError so callers can handle them uniformly.

export type AriaErrorCode =
    | 'UNAUTHORIZED'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION'
    | 'RATE_LIMIT'
    | 'TRANSIENT'
    | 'UNKNOWN';

export class AriaError extends Error {
    readonly code: AriaErrorCode;
    readonly statusHint: number;

    constructor(message: string, code: AriaErrorCode, statusHint = 500) {
        super(message);
        this.name = 'AriaError';
        this.code = code;
        this.statusHint = statusHint;
        // Maintains proper stack trace in V8
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// 401 — user not authenticated
export class AuthError extends AriaError {
    constructor(message = 'User not authenticated') {
        super(message, 'UNAUTHORIZED', 401);
        this.name = 'AuthError';
    }
}

// 404 — resource does not exist
export class NotFoundError extends AriaError {
    constructor(resource: string) {
        super(`${resource} not found`, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}

// 409 — concurrent write conflict (optimistic lock failure)
export class ConflictError extends AriaError {
    constructor(message: string) {
        super(message, 'CONFLICT', 409);
        this.name = 'ConflictError';
    }
}

// 422 — caller passed invalid input
export class ValidationError extends AriaError {
    constructor(message: string) {
        super(message, 'VALIDATION', 422);
        this.name = 'ValidationError';
    }
}

// 429 — upstream rate limit hit
export class RateLimitError extends AriaError {
    constructor(message = 'Rate limit exceeded, please try again shortly') {
        super(message, 'RATE_LIMIT', 429);
        this.name = 'RateLimitError';
    }
}

// 503 — transient network or DB error, safe to retry
export class TransientError extends AriaError {
    constructor(message: string) {
        super(message, 'TRANSIENT', 503);
        this.name = 'TransientError';
    }
}

// Utility: wraps an unknown caught value into a typed AriaError
export function toAriaError(err: unknown): AriaError {
    if (err instanceof AriaError) return err;

    const message = err instanceof Error ? err.message : String(err);

    // Classify common Supabase/Postgres error patterns
    if (message.includes('not found') || message.includes('PGRST116')) {
        return new NotFoundError('Resource');
    }
    if (message.includes('JWT') || message.includes('auth') || message.includes('401')) {
        return new AuthError(message);
    }
    if (message.includes('duplicate') || message.includes('unique') || message.includes('23505')) {
        return new ConflictError(message);
    }
    if (message.includes('503') || message.includes('network') || message.includes('timeout')) {
        return new TransientError(message);
    }

    return new AriaError(message, 'UNKNOWN', 500);
}
