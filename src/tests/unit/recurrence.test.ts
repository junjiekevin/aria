import { describe, it, expect } from 'vitest';
import {
    parseRecurrenceRule,
    buildRecurrenceRule,
    isEntryInWeek,
    getFrequencyFromRule
} from '../../lib/recurrence';

describe('Recurrence Logic (Unit)', () => {

    describe('parseRecurrenceRule', () => {
        it('should parse weekly rules correctly', () => {
            const rule = 'FREQ=WEEKLY;BYDAY=MO';
            const parsed = parseRecurrenceRule(rule);
            expect(parsed).toEqual({
                freq: 'WEEKLY',
                interval: 1,
                dayIndex: 1,
                nthWeek: null
            });
        });

        it('should parse biweekly rules correctly', () => {
            const rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR';
            const parsed = parseRecurrenceRule(rule);
            expect(parsed?.interval).toBe(2);
            expect(parsed?.dayIndex).toBe(5);
        });

        it('should parse monthly rules correctly (2nd Tuesday)', () => {
            const rule = 'FREQ=MONTHLY;BYDAY=2TU';
            const parsed = parseRecurrenceRule(rule);
            expect(parsed?.freq).toBe('MONTHLY');
            expect(parsed?.nthWeek).toBe(2);
            expect(parsed?.dayIndex).toBe(2);
        });

        it('should return null for empty rules', () => {
            expect(parseRecurrenceRule('')).toBeNull();
        });
    });

    describe('buildRecurrenceRule', () => {
        it('should build a weekly rule from a Monday anchor', () => {
            const monday = new Date('2026-02-23T10:00:00'); // A Monday
            const rule = buildRecurrenceRule('weekly', monday);
            expect(rule).toBe('FREQ=WEEKLY;BYDAY=MO');
        });

        it('should build a monthly rule for the 4th Friday', () => {
            const friday = new Date('2026-02-27T10:00:00'); // 4th Friday of Feb 2026
            const rule = buildRecurrenceRule('monthly', friday);
            expect(rule).toBe('FREQ=MONTHLY;BYDAY=4FR');
        });
    });

    describe('isEntryInWeek', () => {
        const weekStart = new Date('2026-02-23T00:00:00'); // Monday
        const weekEnd = new Date('2026-03-01T23:59:59');   // Sunday

        it('should include a one-time event that falls in the week', () => {
            const startTime = '2026-02-24T10:00:00'; // Tuesday
            expect(isEntryInWeek(startTime, '', weekStart, weekEnd)).toBe(true);
        });

        it('should exclude a one-time event that falls outside the week', () => {
            const startTime = '2026-03-02T10:00:00'; // Following Monday
            expect(isEntryInWeek(startTime, '', weekStart, weekEnd)).toBe(false);
        });

        it('should include a weekly Monday event even if the origin was weeks ago', () => {
            const originTime = '2026-01-05T10:00:00'; // A Monday weeks ago
            const rule = 'FREQ=WEEKLY;BYDAY=MO';
            expect(isEntryInWeek(originTime, rule, weekStart, weekEnd)).toBe(true);
        });

        it('should correctly handle biweekly skip weeks', () => {
            const originTime = '2026-02-16T10:00:00'; // Monday, 1 week before weekStart
            const rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO';

            // Should be FALSE because 2026-02-23 is exactly 1 week from originTime (1 % 2 !== 0)
            expect(isEntryInWeek(originTime, rule, weekStart, weekEnd)).toBe(false);

            // Should be TRUE for the week starts at origin
            const originWeekStart = new Date('2026-02-16T00:00:00');
            const originWeekEnd = new Date('2026-02-22T23:59:59');
            expect(isEntryInWeek(originTime, rule, originWeekStart, originWeekEnd)).toBe(true);
        });
    });

    describe('getFrequencyFromRule', () => {
        it('should identify biweekly correctly', () => {
            expect(getFrequencyFromRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO')).toBe('2weekly');
        });
    });
});
