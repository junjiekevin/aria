// src/lib/recurrence.ts
// Pure recurrence logic. No Supabase, no React, no side effects.
// All functions are deterministic and independently testable.
//
// RRULE spec used throughout:
//   Once:      "" (empty string)
//   Daily:     "FREQ=DAILY"
//   Weekly:    "FREQ=WEEKLY;BYDAY=MO"
//   Biweekly:  "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO"
//   Monthly:   "FREQ=MONTHLY;BYDAY=2MO"  (nth weekday of month)

export type FrequencyType = 'once' | 'daily' | 'weekly' | '2weekly' | 'monthly';

export interface ParsedRecurrenceRule {
    freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval: number;
    dayIndex: number | null;  // 0=SU 1=MO 2=TU 3=WE 4=TH 5=FR 6=SA
    nthWeek: number | null;   // For MONTHLY: which week of month (1-4)
}

const DAY_ABBREVS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// ============================================
// Parse
// ============================================

// Parses an RRULE string into a structured object.
// Returns null for empty/once rules.
export function parseRecurrenceRule(rule: string): ParsedRecurrenceRule | null {
    if (!rule || rule.trim() === '') return null;

    const parts: Record<string, string> = {};
    rule.split(';').forEach(part => {
        const [key, value] = part.split('=');
        if (key && value !== undefined) parts[key.toUpperCase()] = value.toUpperCase();
    });

    const freq = parts['FREQ'] as ParsedRecurrenceRule['freq'];
    if (!freq) return null;

    const interval = parts['INTERVAL'] ? parseInt(parts['INTERVAL'], 10) : 1;

    let dayIndex: number | null = null;
    let nthWeek: number | null = null;

    if (parts['BYDAY']) {
        const byday = parts['BYDAY'];

        if (freq === 'MONTHLY') {
            // Format: 2MO, 1TU, 3WE etc.
            const match = byday.match(/^(\d)([A-Z]{2})$/);
            if (match) {
                nthWeek = parseInt(match[1], 10);
                dayIndex = DAY_ABBREVS.indexOf(match[2]);
                if (dayIndex === -1) dayIndex = null;
            }
        } else {
            // Format: MO, TU, WE etc.
            dayIndex = DAY_ABBREVS.indexOf(byday);
            if (dayIndex === -1) dayIndex = null;
        }
    }

    return { freq, interval, dayIndex, nthWeek };
}

// ============================================
// Build
// ============================================

// Builds a canonical RRULE string from a frequency type and anchor date.
export function buildRecurrenceRule(frequency: FrequencyType, anchorDate: Date): string {
    if (frequency === 'once') return '';
    if (frequency === 'daily') return 'FREQ=DAILY';

    const dayAbbrev = DAY_ABBREVS[anchorDate.getDay()];

    if (frequency === 'weekly') {
        return `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
    }

    if (frequency === '2weekly') {
        return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayAbbrev}`;
    }

    if (frequency === 'monthly') {
        const nthWeek = getNthWeekdayOfMonth(anchorDate);
        return `FREQ=MONTHLY;BYDAY=${nthWeek}${dayAbbrev}`;
    }

    return '';
}

// Updates an existing RRULE to reflect a new anchor date.
// Preserves frequency/interval, updates BYDAY to new day.
// Used when moving or swapping events.
export function updateRecurrenceRule(existingRule: string, newAnchorDate: Date): string {
    if (!existingRule || existingRule.trim() === '') return '';

    const parsed = parseRecurrenceRule(existingRule);
    if (!parsed) return existingRule;

    const newDayAbbrev = DAY_ABBREVS[newAnchorDate.getDay()];

    if (parsed.freq === 'DAILY') return 'FREQ=DAILY';

    if (parsed.freq === 'WEEKLY') {
        const intervalPart = parsed.interval > 1 ? `;INTERVAL=${parsed.interval}` : '';
        return `FREQ=WEEKLY${intervalPart};BYDAY=${newDayAbbrev}`;
    }

    if (parsed.freq === 'MONTHLY') {
        const nthWeek = getNthWeekdayOfMonth(newAnchorDate);
        return `FREQ=MONTHLY;BYDAY=${nthWeek}${newDayAbbrev}`;
    }

    return existingRule;
}

// ============================================
// Week Calculation
// ============================================

// Returns which nth occurrence of a weekday this date is within its month.
// e.g. 2nd Tuesday → 2
export function getNthWeekdayOfMonth(date: Date): number {
    const dayOfMonth = date.getDate();
    return Math.ceil(dayOfMonth / 7);
}

// Determines whether a schedule entry falls within a given week window.
// Replaces all inline isEntryInCurrentWeek logic in SchedulePage.tsx.
export function isEntryInWeek(
    startTime: string,
    recurrenceRule: string,
    weekStart: Date,
    weekEnd: Date
): boolean {
    const entryStart = new Date(startTime);
    const parsed = parseRecurrenceRule(recurrenceRule);

    // No recurrence — one-time event, just check if it falls in the week
    if (!parsed) {
        return entryStart >= weekStart && entryStart <= weekEnd;
    }

    // Use dayIndex from BYDAY for day resolution — avoids UTC offset issues
    const entryDayIndex = parsed.dayIndex ?? entryStart.getDay();

    // Find the candidate date in the current week for this day
    const candidateDate = new Date(weekStart);
    candidateDate.setDate(weekStart.getDate() + entryDayIndex);
    candidateDate.setHours(
        entryStart.getHours(),
        entryStart.getMinutes(),
        entryStart.getSeconds(),
        0
    );

    if (parsed.freq === 'DAILY') {
        // Daily events appear every day — always in week if schedule is active
        return true;
    }

    if (parsed.freq === 'WEEKLY') {
        // Check candidate day is within the week
        if (candidateDate < weekStart || candidateDate > weekEnd) return false;

        if (parsed.interval <= 1) return true;

        // Biweekly — check parity from entry origin
        const msPerWeek = 1000 * 60 * 60 * 24 * 7;
        const weeksSinceOrigin = Math.round(
            (candidateDate.getTime() - entryStart.getTime()) / msPerWeek
        );
        return weeksSinceOrigin % parsed.interval === 0;
    }

    if (parsed.freq === 'MONTHLY') {
        if (candidateDate < weekStart || candidateDate > weekEnd) return false;

        // Verify this is the correct nth weekday of the month
        const nthInMonth = getNthWeekdayOfMonth(candidateDate);
        return nthInMonth === parsed.nthWeek;
    }

    return false;
}

// ============================================
// Frequency Derivation
// ============================================

// Derives a FrequencyType from a raw RRULE string.
// Used for display labels and form selectors.
export function getFrequencyFromRule(rule: string): FrequencyType {
    if (!rule || rule.trim() === '') return 'once';

    const parsed = parseRecurrenceRule(rule);
    if (!parsed) return 'once';

    if (parsed.freq === 'DAILY') return 'daily';

    if (parsed.freq === 'WEEKLY') {
        return parsed.interval >= 2 ? '2weekly' : 'weekly';
    }

    if (parsed.freq === 'MONTHLY') return 'monthly';

    return 'once';
}

// Human-readable label for a FrequencyType
export function formatFrequencyLabel(freq: FrequencyType): string {
    const labels: Record<FrequencyType, string> = {
        once: 'Once',
        daily: 'Daily',
        weekly: 'Weekly',
        '2weekly': 'Every 2 Weeks',
        monthly: 'Monthly',
    };
    return labels[freq] ?? freq;
}
