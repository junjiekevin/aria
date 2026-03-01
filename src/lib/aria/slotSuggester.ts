// src/lib/aria/slotSuggester.ts
// Deterministic slot-suggestion utility for advisory mode.
// Pure function — no side effects, no database calls.
// Takes pre-fetched schedule state and returns ranked slot candidates
// as compact machine-readable JSON for the LLM to narrate.

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Compact representation of an existing scheduled event. */
export interface ScheduledEvent {
    name: string;
    day: string;
    hour: number;
}

/** Compact representation of a participant awaiting scheduling. */
export interface UnassignedParticipant {
    id: string;
    name: string;
    preferences: Array<{
        day: string;
        startHour: number;
        endHour: number;
        frequency: string;
    }>;
}

/** A ranked slot suggestion for one participant. */
export interface SlotSuggestion {
    participantName: string;
    participantId: string;
    day: string;
    hour: number;
    score: number;
    reason: string;
    conflicts: string[];
}

/** Summary returned alongside suggestions. */
export interface SlotSuggestionResult {
    suggestions: SlotSuggestion[];
    totalUnassigned: number;
    totalSuggested: number;
    unresolvable: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeDay(raw: string): string | null {
    const lower = raw.trim().toLowerCase();
    for (const d of DAYS) {
        if (d.toLowerCase() === lower) return d;
    }
    // Partial match
    for (const d of DAYS) {
        if (d.toLowerCase().startsWith(lower)) return d;
    }
    return null;
}

/**
 * Build occupancy map: day -> Set of occupied hours.
 * Works on compact event data (no heavy parsing).
 */
function buildOccupancyMap(events: ScheduledEvent[]): Map<string, Set<number>> {
    const map = new Map<string, Set<number>>();
    for (const d of DAYS) {
        map.set(d, new Set());
    }
    for (const event of events) {
        const day = normalizeDay(event.day);
        if (!day) continue;
        const hours = map.get(day);
        if (hours) hours.add(event.hour);
    }
    return map;
}

/** Count how many events are on each day (for time-spread scoring). */
function dayLoadCounts(events: ScheduledEvent[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const d of DAYS) counts.set(d, 0);
    for (const event of events) {
        const day = normalizeDay(event.day);
        if (!day) continue;
        counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suggest optimal slots for unassigned participants.
 *
 * Scoring:
 * - 50 points: preference rank 1 match
 * - 30 points: preference rank 2 match
 * - 15 points: preference rank 3 match
 * - +20 points: no conflict with existing events at that time
 * - +10 points: day has lighter load (promotes time-spread)
 *
 * @param events Existing events in the schedule (compact format)
 * @param participants Unassigned participants with their preferences
 * @param workingHoursStart Earliest allowed hour (inclusive)
 * @param workingHoursEnd Latest allowed hour (exclusive)
 */
export function suggestSlots(
    events: ScheduledEvent[],
    participants: UnassignedParticipant[],
    workingHoursStart: number = 8,
    workingHoursEnd: number = 21,
): SlotSuggestionResult {
    const occupancy = buildOccupancyMap(events);
    const loads = dayLoadCounts(events);
    const maxLoad = Math.max(...Array.from(loads.values()), 1);

    const suggestions: SlotSuggestion[] = [];
    const unresolvable: string[] = [];

    // Track newly suggested slots to avoid suggesting the same slot to multiple people
    const pendingOccupancy = new Map<string, Set<number>>();
    for (const d of DAYS) pendingOccupancy.set(d, new Set());

    for (const participant of participants) {
        let bestSuggestion: SlotSuggestion | null = null;

        const prefScores = [50, 30, 15];

        for (let rank = 0; rank < participant.preferences.length; rank++) {
            const pref = participant.preferences[rank];
            const day = normalizeDay(pref.day);
            if (!day) continue;

            const hour = pref.startHour;
            if (hour < workingHoursStart || hour >= workingHoursEnd) continue;

            const baseScore = prefScores[rank] ?? 10;

            // Conflict check
            const hourOccupied = occupancy.get(day)?.has(hour) ?? false;
            const hourPending = pendingOccupancy.get(day)?.has(hour) ?? false;
            const hasConflict = hourOccupied || hourPending;
            const conflicts: string[] = [];

            if (hasConflict) {
                // Find the conflicting event name
                const conflictingEvent = events.find(
                    e => normalizeDay(e.day) === day && e.hour === hour
                );
                if (conflictingEvent) {
                    conflicts.push(conflictingEvent.name);
                } else if (hourPending) {
                    conflicts.push('(another suggested participant)');
                }
            }

            const conflictBonus = hasConflict ? 0 : 20;
            const spreadBonus = Math.round(10 * (1 - (loads.get(day) ?? 0) / maxLoad));

            const totalScore = baseScore + conflictBonus + spreadBonus;

            const reason = rank === 0
                ? `1st preference${hasConflict ? '' : ', no conflicts'}`
                : rank === 1
                    ? `2nd preference${hasConflict ? '' : ', no conflicts'}`
                    : `3rd preference${hasConflict ? '' : ', no conflicts'}`;

            const suggestion: SlotSuggestion = {
                participantName: participant.name,
                participantId: participant.id,
                day,
                hour,
                score: totalScore,
                reason,
                conflicts,
            };

            if (!bestSuggestion || totalScore > bestSuggestion.score) {
                bestSuggestion = suggestion;
            }
        }

        // Fallback: if no preferences yielded a conflict-free slot, try finding
        // any open hour in working range on the lightest day.
        if (!bestSuggestion || bestSuggestion.conflicts.length > 0) {
            const sortedDays = Array.from(loads.entries())
                .sort((a, b) => a[1] - b[1])
                .map(([d]) => d);

            for (const day of sortedDays) {
                for (let h = workingHoursStart; h < workingHoursEnd; h++) {
                    const hourOccupied = occupancy.get(day)?.has(h) ?? false;
                    const hourPending = pendingOccupancy.get(day)?.has(h) ?? false;
                    if (!hourOccupied && !hourPending) {
                        const fallback: SlotSuggestion = {
                            participantName: participant.name,
                            participantId: participant.id,
                            day,
                            hour: h,
                            score: 5,
                            reason: 'open slot (no preference match)',
                            conflicts: [],
                        };
                        // Only use fallback if it's better than best (which has conflicts)
                        if (!bestSuggestion || bestSuggestion.conflicts.length > 0) {
                            bestSuggestion = fallback;
                        }
                        break;
                    }
                }
                if (bestSuggestion && bestSuggestion.conflicts.length === 0) break;
            }
        }

        if (bestSuggestion) {
            suggestions.push(bestSuggestion);
            // Reserve this slot
            pendingOccupancy.get(bestSuggestion.day)?.add(bestSuggestion.hour);
        } else {
            unresolvable.push(participant.name);
        }
    }

    // Sort suggestions by score descending
    suggestions.sort((a, b) => b.score - a.score);

    return {
        suggestions,
        totalUnassigned: participants.length,
        totalSuggested: suggestions.length,
        unresolvable,
    };
}

/**
 * Format suggestion result as a compact string for LLM narration.
 * The LLM can use this to produce a natural-language recommendation.
 */
export function formatSuggestionsForLlm(result: SlotSuggestionResult): string {
    if (result.suggestions.length === 0) {
        return 'No slot suggestions available — schedule may be full or participants have no preferences on file.';
    }

    const lines = result.suggestions.map(s => {
        const time = `${s.day} at ${s.hour > 12 ? s.hour - 12 : s.hour}${s.hour >= 12 ? 'pm' : 'am'}`;
        const conflict = s.conflicts.length > 0 ? ` ⚠️ conflicts with: ${s.conflicts.join(', ')}` : '';
        return `• ${s.participantName} → ${time} (${s.reason})${conflict}`;
    });

    let summary = `Slot suggestions for ${result.totalSuggested}/${result.totalUnassigned} participant(s):\n`;
    summary += lines.join('\n');

    if (result.unresolvable.length > 0) {
        summary += `\n\nCould not find slots for: ${result.unresolvable.join(', ')}`;
    }

    return summary;
}
