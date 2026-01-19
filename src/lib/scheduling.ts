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

export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
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

export function buildAvailabilityMap(
    entries: ScheduleEntry[], 
    scheduleStart: Date, 
    totalWeeks: number,
    exceptions: Record<string, string[]> = {}
): Map<string, Set<string>> {
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
        const entryDayIndex = entryStart.getDay();
        const entryDay = DAYS[entryDayIndex];
        
        const daysFromScheduleStart = Math.floor((entryStart.getTime() - scheduleStart.getTime()) / (1000 * 60 * 60 * 24));
        const startWeek = Math.floor(daysFromScheduleStart / 7);
        
        const rule = entry.recurrence_rule || '';
        const freqMatch = rule.match(/FREQ=(\w+)/);
        const intervalMatch = rule.match(/INTERVAL=(\d+)/);
        
        const freq = freqMatch ? freqMatch[1] : 'WEEKLY';
        const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
        
        // Get exceptions for this entry
        const entryExceptions = exceptions[entry.id] || [];
        
        // Determine which weeks this entry should occupy based on recurrence rule
        const weeksToOccupy: number[] = [];
        
        if (!rule) {
            // No recurrence - only the first occurrence
            if (startWeek >= 0 && startWeek < totalWeeks) {
                weeksToOccupy.push(startWeek);
            }
        } else if (freq === 'WEEKLY') {
            // Weekly - occupy all weeks (or every N weeks based on interval)
            for (let week = startWeek; week < totalWeeks; week++) {
                if ((week - startWeek) % interval === 0) {
                    weeksToOccupy.push(week);
                }
            }
        } else if (freq === '2WEEKLY') {
            // Every 2 weeks - occupy even weeks relative to start
            for (let week = startWeek; week < totalWeeks; week += 2) {
                weeksToOccupy.push(week);
            }
        } else if (freq === 'MONTHLY') {
            // Monthly
            for (let week = startWeek; week < totalWeeks; week += 4) {
                weeksToOccupy.push(week);
            }
        }
        
        // Mark slots as occupied for all applicable weeks
        for (const week of weeksToOccupy) {
            if (week >= 0 && week < totalWeeks) {
                const dayKey = `${week}-${entryDay}`;
                
                // Calculate the actual date for this occurrence
                const weekStart = new Date(scheduleStart);
                weekStart.setDate(weekStart.getDate() + (week * 7));
                
                // Find the day in this week that matches entryDay
                const targetDate = new Date(weekStart);
                targetDate.setDate(weekStart.getDate() + entryDayIndex);
                const dateStr = formatDate(targetDate);
                
                // Skip if this date is an exception
                if (entryExceptions.includes(dateStr)) {
                    console.log(`Skipping ${entry.student_name} on ${dateStr} (exception)`);
                    continue;
                }
                
                const startMinutes = entryStart.getHours() * 60 + entryStart.getMinutes();
                const endMinutes = entryEnd.getHours() * 60 + entryEnd.getMinutes();
                
                for (let m = startMinutes; m < endMinutes; m += 15) {
                    const hour = Math.floor(m / 60);
                    const minute = m % 60;
                    availability.get(dayKey)?.delete(`${hour}:${minute}`);
                }
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
            return true; // Conflict found
        }
    }
    return false; // No conflicts
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

export function scheduleStudents(
    students: FormResponse[],
    existingEntries: ScheduleEntry[],
    scheduleStart: Date,
    totalWeeks: number,
    exceptions: Record<string, string[]> = {}
): SchedulingResult {
    const availability = buildAvailabilityMap(existingEntries, scheduleStart, totalWeeks, exceptions);
    
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
            
            // Check if this timing has conflicts with ANY week it would occupy
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
        recurrenceRule = `FREQ=WEEKLY;INTERVAL=4;BYDAY=${dayAbbrev}`;
    } else {
        recurrenceRule = `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
    }
    
    return {
        start_time: firstOccurrence.toISOString(),
        end_time: endTime.toISOString(),
        recurrence_rule: recurrenceRule,
    };
}
