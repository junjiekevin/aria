// src/lib/aria/intentRouter.ts
// Deterministic intent classifier with optional LLM fallback.
// Routes each user turn to execution/advisory/simple mode explicitly.

import { sendChatMessage } from '../openrouter';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type AriaMode = 'simple' | 'execution' | 'advisory';

export interface ModeClassification {
    mode: AriaMode;
    confidence: number;
    source: 'deterministic' | 'llm';
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword sets
// ─────────────────────────────────────────────────────────────────────────────

const SIMPLE_RE =
    /^(hi|hello|hey|thanks|thank you|bye|ok|okay|got it|cool|nice|great|yo|sup)[\s!?.]*$/i;

/** Advisory-intent keywords — reasoning, analysis, planning, suggestions. */
const ADVISORY_KEYWORDS: RegExp[] = [
    /\b(suggest|recommend)\b/i,
    /\b(analy[sz]e|review|inspect|audit)\b/i,
    /\b(plan|propose|what if|dry run|draft)\b/i,
    /\b(how should|should i|best way|options|help me decide)\b/i,
    /\b(compar[ei]|evaluat[ei]|optimi[sz]e)\b/i,
    /\b(coverage|gap|strategy|advise|insight)\b/i,
    /\b(spot issues|health check|explain)\b/i,
];

/** Execution-intent keywords — direct action verbs. */
const EXECUTION_KEYWORDS: RegExp[] = [
    /\b(add|create|make|book|put|insert)\b/i,
    /\b(delete|remove|cancel|drop|trash|empty)\b/i,
    /\b(move|swap|switch|trade|exchange|shift)\b/i,
    /\b(update|change|edit|rename|modify|reschedule)\b/i,
    /\b(schedule all|assign everyone|auto[- ]?schedule|bulk schedule|fill schedule)\b/i,
    /\b(publish|go live|finalize|send emails)\b/i,
    /\b(recover|restore|undelete|bring back)\b/i,
    /\b(export|download|ical|csv)\b/i,
    /\b(commit|confirm|apply|approve|execute plan)\b/i,
    /\b(mark assigned|mark scheduled)\b/i,
    /\b(configure form|form deadline|max choices)\b/i,
];

/**
 * Informational queries that look like execution but are actually read-only.
 * These shift the classification toward advisory.
 */
const INFORMATIONAL_OVERRIDES: RegExp[] = [
    /\b(how many|count|number of)\b/i,
    /\b(who|which|what|list|show)\b.*\b(unassigned|unscheduled|pending|remaining)\b/i,
    /\b(unassigned|unscheduled|pending)\b.*\b(who|which|what|list|show)\b/i,
];

const DEBUG = import.meta.env.DEV;

// ─────────────────────────────────────────────────────────────────────────────
// LLM fallback prompt
// ─────────────────────────────────────────────────────────────────────────────

const MODE_CLASSIFIER_PROMPT = `You are a request classifier for a scheduling assistant.
Classify the user's request into exactly one mode.

Modes:
- "execution": The user wants to CREATE, MODIFY, DELETE, MOVE, SWAP, SCHEDULE, PUBLISH, or perform any mutating action on schedules/events/participants.
- "advisory": The user wants SUGGESTIONS, ANALYSIS, RECOMMENDATIONS, COMPARISONS, PLANNING ADVICE, or information about coverage/gaps/conflicts.
- "simple": Greetings, thanks, or casual non-scheduling chat.

Return exactly one minified JSON object and nothing else:
{"mode":"execution|advisory|simple","confidence":0.0-1.0}`;

const CLASSIFIER_MAX_TOKENS = 80;

// ─────────────────────────────────────────────────────────────────────────────
// Core classifier
// ─────────────────────────────────────────────────────────────────────────────

function countHits(text: string, patterns: RegExp[]): number {
    return patterns.filter((re) => re.test(text)).length;
}

/**
 * Classify a user message into a runtime mode.
 *
 * 1. Deterministic pass — fast, free, handles ~90% of inputs.
 * 2. LLM fallback — only when deterministic confidence is below threshold.
 */
export async function classifyMode(
    message: string,
): Promise<ModeClassification> {
    const trimmed = message.trim();

    // ── Simple greetings ──────────────────────────────────────────────────────
    if (SIMPLE_RE.test(trimmed)) {
        return { mode: 'simple', confidence: 1.0, source: 'deterministic' };
    }

    // ── Deterministic keyword scoring ─────────────────────────────────────────
    const advisoryHits = countHits(trimmed, ADVISORY_KEYWORDS);
    const executionHits = countHits(trimmed, EXECUTION_KEYWORDS);
    const informationalHits = countHits(trimmed, INFORMATIONAL_OVERRIDES);

    // Informational questions should stay in advisory mode even when they
    // contain ambiguous scheduling words.
    if (informationalHits > 0) {
        const conf = Math.min(0.78 + informationalHits * 0.07, 0.96);
        return { mode: 'advisory', confidence: conf, source: 'deterministic' };
    }

    // Informational queries shift weight toward advisory even if execution
    // keywords are nominally present (e.g., "how many unscheduled" has "schedule"
    // but the user is asking a question, not requesting a mutation).
    const effectiveAdvisory = advisoryHits + informationalHits;

    const totalHits = effectiveAdvisory + executionHits;

    if (totalHits > 0) {
        if (effectiveAdvisory > 0 && executionHits === 0) {
            const conf = Math.min(0.65 + advisoryHits * 0.1, 0.95);
            return { mode: 'advisory', confidence: conf, source: 'deterministic' };
        }

        if (executionHits > 0 && effectiveAdvisory === 0) {
            const conf = Math.min(0.65 + executionHits * 0.1, 0.95);
            return { mode: 'execution', confidence: conf, source: 'deterministic' };
        }

        // Both present — advisory takes precedence (safer: it can still call tools
        // but won't mutate unless reclassified).
        if (effectiveAdvisory >= executionHits) {
            return { mode: 'advisory', confidence: 0.6, source: 'deterministic' };
        }

        // Execution clearly dominates
        return { mode: 'execution', confidence: 0.6, source: 'deterministic' };
    }

    // ── No keyword hits — try LLM fallback ────────────────────────────────────
    return classifyModeWithLlm(trimmed);
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM fallback
// ─────────────────────────────────────────────────────────────────────────────

async function classifyModeWithLlm(
    message: string,
): Promise<ModeClassification> {
    try {
        const response = await sendChatMessage(
            [{ role: 'user', content: message }],
            MODE_CLASSIFIER_PROMPT,
            { maxTokensOverride: CLASSIFIER_MAX_TOKENS },
        );

        const raw = response.rawContent || response.message;
        const jsonMatch = raw.match(/\{[^}]+\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as {
                mode?: string;
                confidence?: number;
            };
            const mode = parsed.mode as AriaMode | undefined;
            if (mode && ['simple', 'execution', 'advisory'].includes(mode)) {
                const conf =
                    typeof parsed.confidence === 'number'
                        ? Math.max(0, Math.min(1, parsed.confidence))
                        : 0.5;
                return { mode, confidence: conf, source: 'llm' };
            }
        }
    } catch (err) {
        if (DEBUG) console.warn('[IntentRouter] LLM fallback failed:', err);
    }

    // Ultimate fallback — default to execution (preserves existing behavior).
    return { mode: 'execution', confidence: 0.3, source: 'deterministic' };
}
