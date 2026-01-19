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
        
        const daysFromScheduleStart = Math.floor((entryStart.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60 * 24));
        const week = Math.floor(daysFromScheduleStart / 7);
        
        if (week >= 0 && week < totalWeeks) {
            const day = DAYS[entryStart.getDay()];
            const dayKey = `${week}-${day}`;
            
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
    const usedSlots = new Set<string>();
    
    for (const { student, timings } of studentsWithTimings) {
        let scheduled = false;
        let bestTiming: TimingSlot | null = null;
        let bestRank = 0;
        
        for (let i = 0; i < timings.length; i++) {
            const timing = timings[i];
            const choiceRank = i + 1;
            const slotKey = `${student.id}-${choiceRank}`;
            
            if (usedSlots.has(slotKey)) continue;
            
            for (let week = 0; week < totalWeeks; week++) {
                if (isSlotAvailable(timing, availability, week)) {
                    scheduled = true;
                    bestTiming = timing;
                    bestRank = choiceRank;
                    usedSlots.add(slotKey);
                    markSlotOccupied(timing, availability, week);
                    break;
                }
            }
            
            if (scheduled) break;
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
    
    const firstOccurrence = new Date(scheduleStartDate);
    firstOccurrence.setDate(scheduleStartDate.getDate() + daysToAdd);
    firstOccurrence.setHours(timing.startHour, timing.startMinute, 0, 0);
    
    const endTime = new Date(firstOccurrence);
    endTime.setHours(timing.endHour, timing.endMinute, 0, 0);
    
    const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayIndex];
    let recurrenceRule = '';
    
    if (timing.frequency === 'once') {
        recurrenceRule = '';
    } else if (timing.frequency === '2weekly') {
        recurrenceRule = `FREQ=2WEEKLY;BYDAY=${dayAbbrev}`;
    } else if (timing.frequency === 'monthly') {
        const dayIndex = DAYS.indexOf(timing.day);
        const monthStart = new Date(firstOccurrence.getFullYear(), firstOccurrence.getMonth(), 1);
        let occurrenceCount = 0;
        for (let d = new Date(monthStart); d <= firstOccurrence; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === dayIndex) {
                occurrenceCount++;
            }
        }
        recurrenceRule = `FREQ=MONTHLY;BYDAY=${dayAbbrev};BYSETPOS=${occurrenceCount}`;
    } else {
        recurrenceRule = `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
    }
    
    return {
        start_time: firstOccurrence.toISOString(),
        end_time: endTime.toISOString(),
        recurrence_rule: recurrenceRule,
    };
}
