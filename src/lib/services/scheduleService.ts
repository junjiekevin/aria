// src/lib/services/scheduleService.ts
// Business logic for schedule lifecycle management.
// All validation, status transitions, and orchestration live here.
// Never imports from other services. Only imports from api/* and errors.ts.

import {
    getSchedule as apiGetSchedule,
    getSchedules as apiGetSchedules,
    getAllSchedules as apiGetAllSchedules,
    getTrashedSchedules as apiGetTrashedSchedules,
    createSchedule as apiCreateSchedule,
    updateSchedule as apiUpdateSchedule,
    deleteSchedule as apiDeleteSchedule,
    permanentDeleteSchedule as apiPermanentDeleteSchedule,
    permanentDeleteAllTrashed as apiPermanentDeleteAllTrashed,
    updateFormConfig as apiUpdateFormConfig,
    checkScheduleOverlaps as apiCheckScheduleOverlaps,
    type Schedule,
    type CreateScheduleInput,
    type UpdateScheduleInput,
    type FormConfigInput,
} from '../api/schedules';
import { ValidationError, NotFoundError, ConflictError } from '../errors';
import { withRetry } from '../retry';

// ============================================
// Validation
// ============================================

function validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime())) throw new ValidationError(`Invalid start date: ${startDate}`);
    if (isNaN(end.getTime())) throw new ValidationError(`Invalid end date: ${endDate}`);
    if (start >= end) throw new ValidationError('End date must be after start date');
}

function validateStatusTransition(current: string, next: string): void {
    const valid: Record<string, string[]> = {
        draft: ['collecting', 'trashed'],
        collecting: ['archived', 'published', 'trashed'],
        published: ['archived', 'trashed'],
        archived: ['collecting', 'trashed'],
        trashed: ['draft', 'collecting', 'archived'],
    };
    if (current === next) return;
    if (!valid[current]?.includes(next)) {
        throw new ValidationError(
            `Invalid status transition: ${current} → ${next}`
        );
    }
}

function validateFormConfig(config: FormConfigInput): void {
    if (
        config.max_choices !== undefined &&
        (config.max_choices < 1 || config.max_choices > 3)
    ) {
        throw new ValidationError('max_choices must be between 1 and 3');
    }
    if (
        config.working_hours_start !== undefined &&
        config.working_hours_end !== undefined &&
        config.working_hours_start >= config.working_hours_end
    ) {
        throw new ValidationError('working_hours_end must be after working_hours_start');
    }
    if (
        config.cancellation_policy_hours !== undefined &&
        config.cancellation_policy_hours < 0
    ) {
        throw new ValidationError('cancellation_policy_hours must be non-negative');
    }
}

// ============================================
// Schedule Service
// ============================================

export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
    validateDateRange(input.start_date, input.end_date);
    return withRetry(() => apiCreateSchedule(input));
}

export async function getSchedule(scheduleId: string): Promise<Schedule> {
    return withRetry(() => apiGetSchedule(scheduleId));
}

export async function getSchedules(): Promise<Schedule[]> {
    return withRetry(() => apiGetSchedules());
}

export async function getAllSchedules(): Promise<Schedule[]> {
    return withRetry(() => apiGetAllSchedules());
}

export async function getTrashedSchedules(): Promise<Schedule[]> {
    return withRetry(() => apiGetTrashedSchedules());
}

export async function updateSchedule(
    scheduleId: string,
    updates: UpdateScheduleInput
): Promise<Schedule> {
    // Validate status transition if status is being changed
    if (updates.status) {
        const current = await withRetry(() => apiGetSchedule(scheduleId));
        validateStatusTransition(current.status, updates.status!);
    }

    // Validate date range if dates are being changed
    if (updates.start_date || updates.end_date) {
        const current = await withRetry(() => apiGetSchedule(scheduleId));
        const startDate = updates.start_date ?? current.start_date;
        const endDate = updates.end_date ?? current.end_date;
        validateDateRange(startDate, endDate);
    }

    return withRetry(() => apiUpdateSchedule(scheduleId, updates));
}

export async function archiveSchedule(scheduleId: string): Promise<Schedule> {
    return updateSchedule(scheduleId, { status: 'archived' });
}

export async function trashSchedule(scheduleId: string): Promise<{ success: boolean }> {
    return withRetry(() => apiDeleteSchedule(scheduleId));
}

export async function restoreSchedule(scheduleId: string): Promise<Schedule> {
    const current = await withRetry(() => apiGetSchedule(scheduleId));

    if (current.status !== 'trashed') {
        throw new ValidationError('Schedule is not in trash');
    }

    // Check limit before restoring
    const active = await withRetry(() => apiGetSchedules());
    if (active.length >= 3) {
        throw new ConflictError(
            'Maximum of 3 schedules allowed. Archive or delete an existing schedule before restoring.'
        );
    }

    const restoreStatus = current.previous_status ?? 'collecting';
    return withRetry(() =>
        apiUpdateSchedule(scheduleId, {
            status: restoreStatus as UpdateScheduleInput['status'],
        })
    );
}

export async function permanentDeleteSchedule(
    scheduleId: string
): Promise<{ success: boolean }> {
    return withRetry(() => apiPermanentDeleteSchedule(scheduleId));
}

export async function permanentDeleteAllTrashed(): Promise<{
    success: boolean;
    count: number;
}> {
    return withRetry(() => apiPermanentDeleteAllTrashed());
}

export async function updateFormConfig(
    scheduleId: string,
    config: FormConfigInput
): Promise<Schedule> {
    validateFormConfig(config);
    return withRetry(() => apiUpdateFormConfig(scheduleId, config));
}

export async function checkScheduleOverlaps(
    startDate: string,
    endDate: string,
    excludeScheduleId?: string
): Promise<Schedule[]> {
    return withRetry(() =>
        apiCheckScheduleOverlaps(startDate, endDate, excludeScheduleId)
    );
}

// Resolves a schedule UUID from either a UUID or a label string.
// Throws if not found or ambiguous.
export async function resolveScheduleId(scheduleIdOrLabel: string): Promise<string> {
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(scheduleIdOrLabel)) return scheduleIdOrLabel;

    const all = await withRetry(() => apiGetSchedules());
    const matches = all.filter(
        s => s.label.toLowerCase() === scheduleIdOrLabel.toLowerCase()
    );

    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) {
        throw new ConflictError(
            `Multiple schedules match "${scheduleIdOrLabel}". Available: ${all.map(s => s.label).join(', ')}`
        );
    }

    throw new NotFoundError(`Schedule "${scheduleIdOrLabel}"`);
}

// Re-export types needed by callers
export type { Schedule, CreateScheduleInput, UpdateScheduleInput, FormConfigInput };
