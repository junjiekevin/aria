import type { FormResponse } from '../lib/api/form-responses';
import type { ScheduleEntry } from '../lib/api/schedule-entries';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface TimingSlot {
    day: string;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    frequency: string;
}

export interface ScheduledAssignment {
    student: FormResponse;
    timing: TimingSlot;
    choiceRank: number;
    isScheduled: boolean;
    reason?: string;
}

export interface SchedulingResult {
    assignments: ScheduledAssignment[];
    totalScheduled: number;
    totalUnassigned: number;
    scheduledCount: number;
}

export function timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

export function dayToIndex(day: string): number {
    return DAYS.indexOf(day);
}

export function parseTiming(response: FormResponse, rank: number): TimingSlot | null {
    const day = rank === 1 ? response.preferred_1_day :
                rank === 2 ? response.preferred_2_day :
                rank === 3 ? response.preferred_3_day : null;
    const start = rank === 1 ? response.preferred_1_start :
                  rank === 2 ? response.preferred_2_start :
                  rank === 3 ? response.preferred_3_start : null;
    const end = rank === 1 ? response.preferred_1_end :
                rank === 2 ? response.preferred_2_end :
                rank === 3 ? response.preferred_3_end : null;
    const frequency = rank === 1 ? response.preferred_1_frequency :
                      rank === 2 ? response.preferred_2_frequency :
                      rank === 3 ? response.preferred_3_frequency : 'weekly';

    if (!day || !start || !end) return null;

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    return {
        day,
        startHour: Math.floor(startMinutes / 60),
        startMinute: startMinutes % 60,
        endHour: Math.floor(endMinutes / 60),
        endMinute: endMinutes % 60,
        frequency: frequency || 'weekly',
    };
}

function isSlotAvailable(timing: TimingSlot, availability: Map<string, Set<string>>, week: number): boolean {
    const dayKey = `${week}-${timing.day}`;
    const slotSet = availability.get(dayKey);
    
    if (!slotSet) return false;
    
    const startMinutes = timing.startHour * 60 + timing.startMinute;
    const endMinutes = timing.endHour * 60 + timing.endMinute;
    
    for (let m = startMinutes; m < endMinutes; m += 15) {
        const hour = Math.floor(m / 60);
        const minute = m % 60;
        if (!slotSet.has(`${hour}:${minute}`)) {
            return false;
        }
    }
    
    return true;
}

function markSlotOccupied(timing: TimingSlot, availability: Map<string, Set<string>>, week: number): void {
    const dayKey = `${week}-${timing.day}`;
    const slotSet = availability.get(dayKey);
    
    if (!slotSet) return;
    
    const startMinutes = timing.startHour * 60 + timing.startMinute;
    const endMinutes = timing.endHour * 60 + timing.endMinute;
    
    for (let m = startMinutes; m < endMinutes; m += 15) {
        const hour = Math.floor(m / 60);
        const minute = m % 60;
        slotSet.delete(`${hour}:${minute}`);
    }
}

function doesTimingConflict(
    timing: TimingSlot,
    availability: Map<string, Set<string>>,
    totalWeeks: number,
    frequency: string
): boolean {
    const startWeek = 0;
    const interval = frequency === '2weekly' ? 2 : 1;
    
    for (let week = startWeek; week < totalWeeks; week++) {
        if ((week - startWeek) % interval !== 0) continue;
        
        if (!isSlotAvailable(timing, availability, week)) {
            return true;
        }
    }
    return false;
}

function markTimingAsOccupied(
    timing: TimingSlot,
    availability: Map<string, Set<string>>,
    totalWeeks: number,
    frequency: string
): void {
    const startWeek = 0;
    const interval = frequency === '2weekly' ? 2 : 1;
    
    for (let week = startWeek; week < totalWeeks; week++) {
        if ((week - startWeek) % interval !== 0) continue;
        markSlotOccupied(timing, availability, week);
    }
}

// Build availability map - each entry is a single time slot
export function buildAvailabilityMap(entries: ScheduleEntry[], scheduleStart: Date, totalWeeks: number): Map<string, Set<string>> {
    const availability = new Map<string, Set<string>>();

    for (let week = 0; week < totalWeeks; week++) {
        for (const day of DAYS) {
            const dayKey = `${week}-${day}`;
            availability.set(dayKey, new Set<string>());
            
            for (let hour = 8; hour < 21; hour++) {
                for (let minute = 0; minute < 60; minute += 15) {
                    availability.get(dayKey)!.add(`${hour}:${minute}`);
                }
            }
        }
    }

    for (const entry of entries) {
        const entryStart = new Date(entry.start_time);
        const entryEnd = new Date(entry.end_time);
        
        // Calculate which week this entry falls in
        const daysFromScheduleStart = Math.floor((entryStart.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60 * 24));
        const week = Math.floor(daysFromScheduleStart / 7);
        
        if (week >= 0 && week < totalWeeks) {
            const entryDay = DAYS[entryStart.getDay()];
            const dayKey = `${week}-${entryDay}`;
            
            const startMinutes = entryStart.getHours() * 60 + entryStart.getMinutes();
            const endMinutes = entryEnd.getHours() * 60 + entryEnd.getMinutes();
            
            for (let m = startMinutes; m < endMinutes; m += 15) {
                const hour = Math.floor(m / 60);
                const minute = m % 60;
                availability.get(dayKey)?.delete(`${hour}:${minute}`);
            }
        }
    }

    return availability;
}

export function scheduleStudents(
    students: FormResponse[],
    existingEntries: ScheduleEntry[],
    scheduleStart: Date,
    totalWeeks: number
): SchedulingResult {
    const availability = buildAvailabilityMap(existingEntries, scheduleStart, totalWeeks);
    
    const studentsWithTimings = students.map(student => ({
        student,
        timings: [
            parseTiming(student, 1),
            parseTiming(student, 2),
            parseTiming(student, 3),
        ].filter(Boolean) as TimingSlot[],
    })).filter(s => s.timings.length > 0);
    
    const assignments: ScheduledAssignment[] = [];
    
    for (const { student, timings } of studentsWithTimings) {
        let scheduled = false;
        let bestTiming: TimingSlot | null = null;
        let bestRank = 0;
        
        for (let i = 0; i < timings.length; i++) {
            const timing = timings[i];
            const choiceRank = i + 1;
            
            const hasConflict = doesTimingConflict(timing, availability, totalWeeks, timing.frequency);
            
            if (!hasConflict) {
                scheduled = true;
                bestTiming = timing;
                bestRank = choiceRank;
                markTimingAsOccupied(timing, availability, totalWeeks, timing.frequency);
                break;
            }
        }
        
        if (scheduled && bestTiming) {
            assignments.push({
                student,
                timing: bestTiming,
                choiceRank: bestRank,
                isScheduled: true,
            });
        } else {
            assignments.push({
                student,
                timing: timings[0],
                choiceRank: 0,
                isScheduled: false,
                reason: 'All preferred slots are already taken',
            });
        }
    }
    
    const scheduledCount = assignments.filter(a => a.isScheduled).length;
    
    return {
        assignments,
        totalScheduled: scheduledCount,
        totalUnassigned: assignments.length - scheduledCount,
        scheduledCount,
    };
}

// Create a single entry for one week
export function createEntryFromAssignment(
    assignment: ScheduledAssignment,
    scheduleStart: Date,
    week: number
): { start_time: string; end_time: string; recurrence_rule: string } {
    const timing = assignment.timing;
    const dayIndex = dayToIndex(timing.day);
    const scheduleStartDate = new Date(scheduleStart);
    const currentDay = scheduleStartDate.getDay();
    
    let daysToAdd = dayIndex - currentDay;
    if (daysToAdd < 0) daysToAdd += 7;
    daysToAdd += week * 7;
    
    const occurrence = new Date(scheduleStartDate);
    occurrence.setDate(scheduleStartDate.getDate() + daysToAdd);
    occurrence.setHours(timing.startHour, timing.startMinute, 0, 0);
    
    const endTime = new Date(occurrence);
    endTime.setHours(timing.endHour, timing.endMinute, 0, 0);
    
    // No recurrence rule - each entry is a single occurrence
    return {
        start_time: occurrence.toISOString(),
        end_time: endTime.toISOString(),
        recurrence_rule: '',
    };
}

// Expand a recurring entry to multiple individual entries
export function expandRecurringEntry(
    entry: ScheduleEntry,
    scheduleStart: Date,
    totalWeeks: number
): { start_time: string; end_time: string }[] {
    const results: { start_time: string; end_time: string }[] = [];
    
    const entryStart = new Date(entry.start_time);
    const entryEnd = new Date(entry.end_time);
    const entryDayIndex = entryStart.getDay();
    
    const daysFromScheduleStart = Math.floor((entryStart.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60 * 24));
    const startWeek = Math.floor(daysFromScheduleStart / 7);
    
    const rule = entry.recurrence_rule || '';
    const freqMatch = rule.match(/FREQ=(\w+)/);
    const intervalMatch = rule.match(/INTERVAL=(\d+)/);
    
    const freq = freqMatch ? freqMatch[1] : 'WEEKLY';
    const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
    
    // Find the first occurrence of this day after schedule start
    let daysToFirst = entryDayIndex - scheduleStart.getDay();
    if (daysToFirst < 0) daysToFirst += 7;
    
    const firstOccurrenceDate = new Date(scheduleStart);
    firstOccurrenceDate.setDate(scheduleStart.getDate() + daysToFirst);
    
    // Generate entries for all weeks
    for (let week = 0; week < totalWeeks; week++) {
        const occurrenceDate = new Date(firstOccurrenceDate);
        occurrenceDate.setDate(firstOccurrenceDate.getDate() + (week * 7));
        
        if (week < startWeek) continue;
        
        if (freq === 'WEEKLY') {
            if ((week - startWeek) % interval !== 0) continue;
        } else if (freq === '2WEEKLY') {
            if ((week - startWeek) % 2 !== 0) continue;
        } else if (freq === 'MONTHLY') {
            if ((week - startWeek) % 4 !== 0) continue;
        }
        
        const startTime = new Date(occurrenceDate);
        startTime.setHours(entryStart.getHours(), entryStart.getMinutes(), 0, 0);
        
        const endTime = new Date(occurrenceDate);
        endTime.setHours(entryEnd.getHours(), entryEnd.getMinutes(), 0, 0);
        
        results.push({
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
        });
    }
    
    return results;
}
