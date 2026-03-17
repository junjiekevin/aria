import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, MessageCircle, X, Minimize2, Lightbulb } from 'lucide-react';
import { sendChatMessage, type Message } from '../lib/openrouter';
import { buildActionPrompt, buildAdvisoryPrompt, buildAdvisoryToolBlock, buildSystemPrompt, buildToolBlock, classifyMode, getMinimalPrompt, ADVISORY_TOOL_NAMES, suggestSlots, type PromptContext, type AriaMode, type ScheduledEvent, type UnassignedParticipant } from '../lib/aria';
import { executeFunction } from '../lib/functions';
import PlanPreviewCard from './PlanPreviewCard';
import ariaProfile from '../assets/images/aria-profile.png';

const CHAT_STORAGE_KEY = 'aria_chat_messages';
const MAX_MESSAGES = 100;
const DEBUG = import.meta.env.DEV;
const MULTI_STEP_GOAL_HINT = /\b(and then|then|also|after that|afterwards|plus)\b/i;
const COMPLEX_GOAL_HINT = /\b(suggest|recommend|remaining|coverage|gap|analy[sz]e|resolve|fix|plan|propose|optimi[sz]e)\b/i;
const SIMPLE_ACTION_MAX_TOKENS = 700;
const COMPLEX_INTENT_MAX_TOKENS = 180;
const ADVISORY_MAX_ITERATIONS = 4;
const ADVISORY_MAX_TOKENS = 1200;
const ADVISORY_REPEAT_TOOL_SOFT_CAP = 2;
const ADVISORY_SEEDED_HISTORY = 4;
const MAX_SEEDED_HISTORY_MESSAGES = 10;
const ID_DELEGATION_HINT = /(need|provide|missing).*(id|ids)|event ids?|participant id/i;
const COMPLEX_INTENT_TRIGGER = /\b(swap|move|resched|change|update|delete|remove|commit|apply|approve)\b/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTO_COMPLETE_FUNCTIONS = new Set([
  'createSchedule',
  'addEventToSchedule',
  'updateEventInSchedule',
  'deleteEventFromSchedule',
  'trashSchedule',
  'recoverSchedule',
  'emptyTrash',
  'swapEvents',
  'updateSchedule',
  'markParticipantAssigned',
  'publishSchedule',
  'autoScheduleParticipants',
  'commitSchedulePlan',
]);

const COMPLEX_INTENT_PROMPT = `You are an intent extraction utility for a scheduling assistant.
Return exactly one minified JSON object and nothing else:
{"intent":"swap_events|repeat_last_swap|move_event|delete_event|commit_plan|unknown","confidence":0-1,"params":{"event_a":"","event_b":"","event_name":"","day":"","hour_24":0,"plan_id":""}}
Rules:
- Use "repeat_last_swap" for requests like "swap them again/back".
- Use full English day names when present.
- Use 24h integer for hour_24 when present.
- If unsure, set intent="unknown" and confidence below 0.65.`;

type ComplexIntentName =
  | 'swap_events'
  | 'repeat_last_swap'
  | 'move_event'
  | 'delete_event'
  | 'commit_plan'
  | 'unknown';

interface ComplexIntent {
  intent: ComplexIntentName;
  confidence?: number;
  params?: {
    event_a?: string;
    event_b?: string;
    event_name?: string;
    day?: string;
    hour_24?: number | string;
    plan_id?: string;
  };
}

function extractHourKey(event: Record<string, unknown>): string | null {
  const compactTime = event.t;
  if (typeof compactTime === 'string' && /^\d{1,2}:\d{2}$/.test(compactTime)) {
    return compactTime;
  }

  const hour = event.hour;
  if (typeof hour === 'number' && Number.isFinite(hour)) {
    return `${String(Math.max(0, Math.min(23, hour))).padStart(2, '0')}:00`;
  }
  if (typeof hour === 'string' && /^\d{1,2}(:\d{2})?$/.test(hour)) {
    const normalized = hour.includes(':') ? hour : `${hour}:00`;
    const [h, m] = normalized.split(':');
    return `${String(Number(h)).padStart(2, '0')}:${m}`;
  }

  const startTime = event.start_time;
  if (typeof startTime === 'string') {
    const date = new Date(startTime);
    if (!Number.isNaN(date.getTime())) {
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
  }

  return null;
}

function buildDeterministicHealthInsight(
  summaryData: unknown,
  unassignedCount: number
): string | null {
  const summaryByDay = (summaryData && typeof summaryData === 'object')
    ? summaryData as Record<string, unknown>
    : {};

  if (unassignedCount > 0) {
    return `👤 ${unassignedCount} participant${unassignedCount === 1 ? '' : 's'} are still unassigned — want me to schedule them?`;
  }

  let overlapCount = 0;
  let overlapDay = '';
  let overlapTime = '';
  let totalEvents = 0;
  let activeWeekdayCount = 0;
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  for (const day of weekdays) {
    const eventsRaw = summaryByDay[day];
    const events = Array.isArray(eventsRaw) ? eventsRaw : [];
    if (events.length > 0) activeWeekdayCount++;
    totalEvents += events.length;

    const bucket = new Map<string, number>();
    for (const raw of events) {
      if (!raw || typeof raw !== 'object') continue;
      const time = extractHourKey(raw as Record<string, unknown>);
      if (!time) continue;
      const next = (bucket.get(time) ?? 0) + 1;
      bucket.set(time, next);
      if (next === 2) {
        overlapCount++;
        if (!overlapDay) overlapDay = day;
        if (!overlapTime) overlapTime = time;
      }
    }
  }

  if (overlapCount > 0) {
    return `⚠️ ${overlapCount} overlap${overlapCount === 1 ? '' : 's'} detected${overlapDay ? ` on ${overlapDay}` : ''}${overlapTime ? ` at ${overlapTime}` : ''}.`;
  }

  // Coverage gaps are only meaningful once schedule has some breadth.
  if (totalEvents >= 3 && activeWeekdayCount >= 2 && activeWeekdayCount < weekdays.length) {
    const missing = weekdays.filter(day => {
      const events = summaryByDay[day];
      return !Array.isArray(events) || events.length === 0;
    });
    if (missing.length >= 2) {
      return `📅 Coverage gaps on ${missing.slice(0, 2).join(' and ')} — want suggestions to balance the week?`;
    }
  }

  return null;
}

function pickSearchResultId(searchData: unknown, query: string): string | null {
  if (!Array.isArray(searchData)) return null;
  const normalized = query.trim().toLowerCase();

  let firstId: string | null = null;
  for (const item of searchData) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = row.i;
    const name = row.n;
    if (typeof id !== 'string' || !id) continue;
    if (!firstId) firstId = id;

    if (typeof name === 'string' && name.trim().toLowerCase() === normalized) {
      return id;
    }
  }
  return firstId;
}

interface SwapIds {
  event1_id: string;
  event2_id: string;
}

type SwapIntent =
  | { kind: 'repeat' }
  | { kind: 'named'; first: string; second: string };

function cleanSwapTerm(raw: string): string {
  return raw
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/[?.!,;:]+$/g, '')
    .trim();
}

function parseSwapIntent(input: string): SwapIntent | null {
  const text = input.trim().replace(/\s+/g, ' ');
  if (!text) return null;

  if (
    /^swap\s+(them|it)\s+(again|back)(?:\s+please)?[.!?]*$/i.test(text) ||
    /^swap\s+again(?:\s+please)?[.!?]*$/i.test(text)
  ) {
    return { kind: 'repeat' };
  }

  const namedMatch = text.match(/^swap\s+(.+?)\s+(?:and|with|&)\s+(.+?)(?:\s+please)?[.!?]*$/i);
  if (!namedMatch) return null;

  const first = cleanSwapTerm(namedMatch[1]);
  const second = cleanSwapTerm(namedMatch[2]);
  if (!first || !second) return null;

  return { kind: 'named', first, second };
}

function extractSwapIdsFromArgs(args: Record<string, unknown>): SwapIds | null {
  const event1 = String(args.event1_id ?? args.event_id1 ?? args.id1 ?? '').trim();
  const event2 = String(args.event2_id ?? args.event_id2 ?? args.id2 ?? '').trim();
  if (!UUID_RE.test(event1) || !UUID_RE.test(event2)) return null;
  return { event1_id: event1, event2_id: event2 };
}

function extractFirstJsonObject(raw: string): string | null {
  const source = raw.trim();
  const start = source.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  return null;
}

function parseComplexIntent(raw: string): ComplexIntent | null {
  const json = extractFirstJsonObject(raw);
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as Partial<ComplexIntent>;
    const intent = parsed.intent;
    if (
      intent !== 'swap_events' &&
      intent !== 'repeat_last_swap' &&
      intent !== 'move_event' &&
      intent !== 'delete_event' &&
      intent !== 'commit_plan' &&
      intent !== 'unknown'
    ) {
      return null;
    }
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
    const params = parsed.params && typeof parsed.params === 'object' ? parsed.params : undefined;
    return {
      intent,
      confidence,
      params: params as ComplexIntent['params'] | undefined,
    };
  } catch {
    return null;
  }
}

function normalizeDayName(day: unknown): string | undefined {
  if (typeof day !== 'string') return undefined;
  const value = day.trim().toLowerCase();
  if (!value) return undefined;

  const dayMap: Record<string, string> = {
    mon: 'Monday',
    monday: 'Monday',
    tue: 'Tuesday',
    tues: 'Tuesday',
    tuesday: 'Tuesday',
    wed: 'Wednesday',
    weds: 'Wednesday',
    wednesday: 'Wednesday',
    thu: 'Thursday',
    thur: 'Thursday',
    thurs: 'Thursday',
    thursday: 'Thursday',
    fri: 'Friday',
    friday: 'Friday',
    sat: 'Saturday',
    saturday: 'Saturday',
    sun: 'Sunday',
    sunday: 'Sunday',
  };
  return dayMap[value];
}

function normalizeHour24(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const hour = Math.trunc(value);
    if (hour >= 0 && hour <= 23) return hour;
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d{1,2}$/.test(trimmed)) {
      const hour = Number(trimmed);
      if (hour >= 0 && hour <= 23) return hour;
    }
  }
  return undefined;
}

function isUnscheduledCountQuery(input: string): boolean {
  const lower = input.toLowerCase();
  const asksCount = /\b(how many|count|number of)\b/.test(lower);
  const asksUnscheduled = /\b(unassigned|unscheduled|not scheduled|without events|pending)\b/.test(lower);
  return asksCount && asksUnscheduled;
}

function isSuggestSpotsForUnscheduledQuery(input: string): boolean {
  const lower = input.toLowerCase();
  const asksSuggest = /\b(suggest|recommend|propose|find)\b/.test(lower);
  const asksSlots = /\b(spot|spots|slot|slots|time|times)\b/.test(lower);
  const asksUnscheduled = /\b(unassigned|unscheduled|remaining|left)\b/.test(lower);
  return asksSuggest && asksSlots && asksUnscheduled;
}

function parseHourFromTimeLike(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const hour = Math.trunc(value);
    return hour >= 0 && hour <= 23 ? hour : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

function formatHourForDisplay(hour24: number): string {
  const normalized = Math.max(0, Math.min(23, Math.trunc(hour24)));
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12}:00 ${suffix}`;
}

function mapSummaryToScheduledEvents(summaryData: unknown): ScheduledEvent[] {
  if (!summaryData || typeof summaryData !== 'object') return [];
  const byDay = summaryData as Record<string, unknown>;
  const mapped: ScheduledEvent[] = [];

  for (const [day, rawEvents] of Object.entries(byDay)) {
    if (!Array.isArray(rawEvents)) continue;
    for (const raw of rawEvents) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      const timeKey = extractHourKey(row);
      const hour = parseHourFromTimeLike(timeKey);
      if (hour === null) continue;

      const name =
        (typeof row.n === 'string' && row.n.trim()) ||
        (typeof row.student_name === 'string' && row.student_name.trim()) ||
        (typeof row.name === 'string' && row.name.trim()) ||
        'Event';

      mapped.push({ name, day, hour });
    }
  }

  return mapped;
}

function mapUnassignedToParticipants(unassignedData: unknown): UnassignedParticipant[] {
  if (!Array.isArray(unassignedData)) return [];

  return unassignedData
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const row = raw as Record<string, unknown>;
      const id = String(row.id ?? '').trim();
      if (!id) return null;

      const name =
        (typeof row.student_name === 'string' && row.student_name.trim()) ||
        (typeof row.n === 'string' && row.n.trim()) ||
        `Participant ${id.slice(0, 8)}`;

      const preferences: UnassignedParticipant['preferences'] = [];
      for (let i = 1; i <= 3; i++) {
        const dayRaw = row[`preferred_${i}_day`] ?? row[`p${i}d`];
        const startRaw = row[`preferred_${i}_start`] ?? row[`p${i}s`];
        const endRaw = row[`preferred_${i}_end`] ?? row[`p${i}e`];
        const frequencyRaw = row[`preferred_${i}_frequency`] ?? row[`p${i}f`];

        if (typeof dayRaw !== 'string' || !dayRaw.trim()) continue;
        const startHour = parseHourFromTimeLike(startRaw);
        if (startHour === null) continue;
        const endHour = parseHourFromTimeLike(endRaw) ?? Math.min(startHour + 1, 23);
        const frequency = typeof frequencyRaw === 'string' && frequencyRaw.trim()
          ? frequencyRaw.trim()
          : 'weekly';

        preferences.push({
          day: dayRaw.trim(),
          startHour,
          endHour,
          frequency,
        });
      }

      return { id, name, preferences };
    })
    .filter((participant): participant is UnassignedParticipant => participant !== null);
}

function normalizeComparableText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface PlanData {
  planId: string;
  changes: { action: string; target: string; description: string }[];
  conflicts: { type: string; description: string; severity: 'warning' | 'error' }[];
  expiresAt: string;
}

interface ChatMessage extends Message {
  id: string;
  timestamp: Date;
  planData?: PlanData;
  isInsight?: boolean; // true = proactive health-check insight bubble
  quickAction?: { label: string; message: string }; // Optional one-click actionable button
}

interface FloatingChatProps {
  onScheduleChange?: () => void;
  onShowAutoSchedule?: () => void;
}

interface ResolvedScheduleContext {
  scheduleId: string | null;
  noSchedules: boolean;
  needsUserChoice: boolean;
  scheduleLabels: string[];
}

const styles: Record<string, React.CSSProperties> = {
  // Chat Button (collapsed state)
  chatButton: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    right: '1.5rem',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #fb923c, #fdba74)',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  chatButtonHover: {
    transform: 'scale(1.05)',
    boxShadow: '0 6px 20px rgba(249, 115, 22, 0.5)',
  },
  notificationBadge: {
    position: 'absolute' as const,
    top: '-4px',
    right: '-4px',
    minWidth: '20px',
    height: '20px',
    padding: '0 6px',
    borderRadius: '10px',
    background: '#ef4444',
    color: 'white',
    fontSize: '12px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chat Window (expanded state)
  chatWindow: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    right: '1.5rem',
    width: '380px',
    height: '520px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100vh - 120px)',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 9999,
    overflow: 'hidden',
    animation: 'slideIn 0.3s ease',
  },
  chatWindowMobile: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100dvh', // Use dynamic viewport height for mobile browsers
    maxWidth: '100%',
    maxHeight: '100dvh',
    borderRadius: 0,
  },
  header: {
    padding: '1rem 1.25rem',
    background: 'linear-gradient(135deg, #fb923c, #fdba74)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexShrink: 0,
  },
  headerAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '2px solid rgba(255, 255, 255, 0.8)',
  },
  headerText: {
    flex: 1,
    color: 'white',
  },
  headerTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.2,
  },
  headerSubtitle: {
    fontSize: '0.75rem',
    opacity: 0.9,
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  headerButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    transition: 'background 0.2s',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    background: '#f9fafb',
  },
  messageWrapper: {
    display: 'flex',
    gap: '0.5rem',
    maxWidth: '85%',
  },
  userMessageWrapper: {
    alignSelf: 'flex-end' as const,
    flexDirection: 'row-reverse' as const,
  },
  assistantMessageWrapper: {
    alignSelf: 'flex-start' as const,
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '14px',
  },
  userAvatar: {
    background: '#2563eb',
    color: 'white',
  },
  messageBubble: {
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    fontSize: '0.875rem',
    lineHeight: 1.4,
  },
  userBubble: {
    background: '#2563eb',
    color: 'white',
    borderBottomRightRadius: '4px',
  },
  assistantBubble: {
    background: 'white',
    color: '#111827',
    borderBottomLeftRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  inputContainer: {
    padding: '0.75rem 1rem',
    background: 'white',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  inputForm: {
    display: 'flex',
    gap: '0.5rem',
  },
  input: {
    flex: 1,
    padding: '0.625rem 0.875rem',
    border: '1px solid #e5e7eb',
    borderRadius: '20px',
    fontSize: '0.875rem',
    outline: 'none',
    background: '#f9fafb',
    transition: 'border-color 0.2s, background 0.2s',
  },
  sendButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#f97316',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center' as const,
    color: '#6b7280',
    padding: '1.5rem',
  },
  emptyStateIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #fb923c, #fdba74)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  emptyStateTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 0.25rem 0',
  },
  emptyStateText: {
    fontSize: '0.8125rem',
    margin: 0,
    lineHeight: 1.5,
  },
  // Insight bubble — distinct amber style for proactive health-check messages
  insightWrapper: {
    alignSelf: 'flex-start' as const,
    display: 'flex',
    gap: '0.5rem',
    maxWidth: '92%',
  },
  insightAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #fb923c, #fbbf24)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  insightBubble: {
    padding: '0.5rem 0.875rem',
    borderRadius: '12px',
    borderBottomLeftRadius: '4px',
    fontSize: '0.8125rem',
    lineHeight: 1.4,
    background: '#fff7ed',
    color: '#9a3412',
    border: '1px solid #fed7aa',
    boxShadow: '0 1px 3px rgba(249,115,22,0.12)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  insightButton: {
    alignSelf: 'flex-start' as const,
    background: '#ea580c',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.2s',
    marginTop: '0.25rem',
  },
};

function AnimatedIcon({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
      {children}
    </span>
  );
}

export default function FloatingChat({ onScheduleChange, onShowAutoSchedule }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitInFlightRef = useRef(false);
  const lastSwapIdsRef = useRef<SwapIds | null>(null);
  const lastPlanIdRef = useRef<string | null>(null);
  const eventIdCacheRef = useRef<Record<string, string>>({});

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load chat from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error('Failed to load chat from sessionStorage:', e);
      }
    }
  }, []);

  // Save chat to sessionStorage when messages change (with 100 message limit)
  useEffect(() => {
    if (messages.length > 0) {
      const limitedMessages = messages.length > MAX_MESSAGES
        ? messages.slice(-MAX_MESSAGES)
        : messages;
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(limitedMessages));
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Helper: Format function result for display vs for LLM
  const formatFunctionResult = (name: string, result: { success: boolean; data?: unknown; error?: string }) => {
    // Functions that need raw data sent back to LLM for follow-up
    const functionsNeedingRawData = [
      'listSchedules',
      'listTrashedSchedules',
      'getEventSummaryInSchedule',
      'searchEventsInSchedule',
      'listUnassignedParticipants',
      'getParticipantPreferences',
    ];

    let displayContent = '';
    let llmContent = '';
    let scheduleModified = false;

    if (result.success) {
      if (name === 'listUnassignedParticipants' && Array.isArray(result.data)) {
        const rows = result.data as Array<Record<string, unknown>>;
        const compact = rows.map((row) => ({
          id: row.id,
          n: row.student_name,
          a: row.assigned,
          p1d: row.preferred_1_day,
          p1s: row.preferred_1_start,
          p1e: row.preferred_1_end,
          p1f: row.preferred_1_frequency,
        }));
        const count = compact.length;
        const names = compact
          .map((row) => (typeof row.n === 'string' ? row.n : null))
          .filter((v): v is string => Boolean(v))
          .slice(0, 5);
        displayContent = count === 0
          ? 'No unassigned participants.'
          : `Found ${count} unassigned participant${count === 1 ? '' : 's'}${names.length ? `: ${names.join(', ')}${count > names.length ? ', ...' : ''}` : ''}.`;
        llmContent = `[Function Result] ${name} succeeded: ${JSON.stringify(compact)}`;
      } else if (functionsNeedingRawData.includes(name) && result.data) {
        // Show raw JSON to both user and LLM (LLM needs IDs)
        const jsonResult = JSON.stringify(result.data, null, 2);
        displayContent = `[Function Result] ${name}:\n${jsonResult}`;
        llmContent = `[Function Result] ${name} succeeded:\n${jsonResult}`;
      } else if (name === 'createSchedule' && (result.data as { label?: string })?.label) {
        displayContent = `✓ Created "${(result.data as { label: string }).label}"`;
        llmContent = `[Function Result] ${name} succeeded: Created schedule "${(result.data as { label: string }).label}"`;
        scheduleModified = true;
      } else if (name === 'addEventToSchedule' && result.data) {
        const eventName = (result.data as { student_name?: string }).student_name || 'Event';
        displayContent = `✓ Added "${eventName}" to the schedule`;
        llmContent = `[Function Result] ${name} succeeded: Added "${eventName}" to the schedule`;
        scheduleModified = true;
      } else if (name === 'updateEventInSchedule') {
        displayContent = '✓ Event updated';
        llmContent = `[Function Result] ${name} succeeded: Event updated`;
        scheduleModified = true;
      } else if (name === 'deleteEventFromSchedule') {
        displayContent = '✓ Event deleted';
        llmContent = `[Function Result] ${name} succeeded: Event deleted`;
        scheduleModified = true;
      } else if (name === 'deleteSchedule' || name === 'trashSchedule') {
        displayContent = '✓ Schedule moved to trash';
        llmContent = `[Function Result] ${name} succeeded: Schedule moved to trash`;
        scheduleModified = true;
      } else if (name === 'updateSchedule') {
        displayContent = '✓ Schedule updated';
        llmContent = `[Function Result] ${name} succeeded: Schedule updated`;
        scheduleModified = true;
      } else if (name === 'recoverSchedule') {
        displayContent = '✓ Schedule restored';
        llmContent = `[Function Result] ${name} succeeded: Schedule restored`;
        scheduleModified = true;
      } else if (name === 'emptyTrash') {
        displayContent = '✓ Trash emptied';
        llmContent = `[Function Result] ${name} succeeded: Trash emptied`;
        scheduleModified = true;
      } else if (name === 'swapEvents') {
        displayContent = '✓ Events swapped';
        llmContent = `[Function Result] ${name} succeeded: Events swapped`;
        scheduleModified = true;
      } else if (name === 'markParticipantAssigned') {
        displayContent = '✓ Participant status updated';
        llmContent = `[Function Result] ${name} succeeded: Participant status updated`;
      } else if (name === 'publishSchedule') {
        displayContent = '✓ Schedule published! Emails sent.';
        llmContent = `[Function Result] ${name} succeeded: Schedule published and participants notified.`;
      } else if (name === 'autoScheduleParticipants' && result.success) {
        const data = result.data as any;
        displayContent = data.previewMode
          ? `✓ Auto-schedule preview generated for ${data.scheduledCount} participants.`
          : `✓ Successfully scheduled ${data.scheduledCount} participants.`;
        llmContent = `[Function Result] ${name} succeeded: ${displayContent}`;
        if (!data.previewMode) scheduleModified = true;
      } else if (name === 'getExportLink' && (result.data as any)?.link) {
        const link = (result.data as any).link;
        displayContent = `✓ Export link: ${link}`;
        llmContent = `[Function Result] ${name} succeeded: Export link is ${link}`;
      } else if (name === 'analyzeScheduleHealth' && (result.data as any)?.summary) {
        displayContent = '✓ Schedule analysis complete. Reviewing now...';
        // Minify JSON for LLM context
        llmContent = `[Function Result] ${name} succeeded. Current schedule state: ${JSON.stringify((result.data as any).summary)}`;
      } else if (name === 'proposeScheduleChanges' && result.data) {
        const planData = result.data as any;
        displayContent = `__PLAN_PREVIEW__${JSON.stringify({
          planId: planData.plan_id,
          changes: planData.changes,
          conflicts: planData.conflicts,
          expiresAt: planData.expires_at,
        })}`;
        llmContent = `[Function Result] ${name} succeeded. Plan ID: ${planData.plan_id}. ${planData.summary}. ${planData.conflicts?.length > 0 ? `Conflicts found: ${JSON.stringify(planData.conflicts)}` : 'No conflicts found.'} ${planData.message}`;
      } else if (name === 'commitSchedulePlan' && result.data) {
        displayContent = (result.data as any).message || '✓ Plan committed';
        llmContent = `[Function Result] ${name} succeeded: ${(result.data as any).message}`;
        scheduleModified = true;
      } else {
        displayContent = '✓ Action completed';
        llmContent = `[Function Result] ${name} succeeded`;
      }
    } else {
      displayContent = `✗ Error: ${result.error}`;
      llmContent = `[Function Result] ${name} FAILED: ${result.error}`;
    }

    return { displayContent, llmContent, scheduleModified };
  };

  const appendAssistantMessage = (content: string, planData?: PlanData) => {
    const assistantMessage: ChatMessage = {
      id: (Date.now() + Math.floor(Math.random() * 1000)).toString(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      planData,
    };
    setMessages((prev) => {
      const updated = [...prev, assistantMessage];
      return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
    });
  };

  const shouldKeepForSeededHistory = (msg: ChatMessage): boolean => {
    if (msg.isInsight) return false;
    if (msg.planData) return false;
    const content = msg.content?.trim();
    if (!content) return false;
    if (msg.role === 'assistant') {
      if (content === 'On it! One moment, please') return false;
      if (content.startsWith('[Function Result]')) return false;
      if (content.startsWith('✓ ')) return false;
      if (content.startsWith('✗ Error:')) return false;
    }
    return true;
  };

  const buildSeededHistory = (singleStepGoalLikely: boolean): Message[] => {
    if (singleStepGoalLikely) return [];
    return messages
      .filter(shouldKeepForSeededHistory)
      .slice(-MAX_SEEDED_HISTORY_MESSAGES)
      .map((msg) => ({ role: msg.role, content: msg.content }));
  };

  const rememberEventSearchResults = (scheduleId: string, data: unknown) => {
    if (!Array.isArray(data)) return;
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = row.i;
      const name = row.n;
      if (typeof id !== 'string' || !id || typeof name !== 'string') continue;
      const key = `${scheduleId}::${name.trim().toLowerCase()}`;
      eventIdCacheRef.current[key] = id;
    }
  };

  const resolveEventIdByName = async (scheduleId: string, rawName: string): Promise<string | null> => {
    const normalizedName = rawName.trim().toLowerCase();
    if (!normalizedName) return null;
    const cacheKey = `${scheduleId}::${normalizedName}`;
    const cached = eventIdCacheRef.current[cacheKey];
    if (cached && UUID_RE.test(cached)) return cached;

    const search = await executeFunction(
      'searchEventsInSchedule',
      { schedule_id: scheduleId, query: rawName.trim() },
      { bypassDedup: true }
    );
    if (!search.success) return null;

    rememberEventSearchResults(scheduleId, search.data);
    const picked = pickSearchResultId(search.data, rawName);
    if (!picked) return null;
    eventIdCacheRef.current[cacheKey] = picked;
    return picked;
  };

  const resolveScheduleContextForLookup = async (
    preferredScheduleId: string | null
  ): Promise<ResolvedScheduleContext> => {
    const listResult = await executeFunction('listSchedules', {}, { bypassDedup: true });
    if (!listResult.success || !Array.isArray(listResult.data)) {
      return {
        scheduleId: preferredScheduleId,
        noSchedules: false,
        needsUserChoice: false,
        scheduleLabels: [],
      };
    }

    const schedules = listResult.data
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const row = raw as Record<string, unknown>;
        const id = typeof row.id === 'string' ? row.id : '';
        const label =
          typeof row.label === 'string'
            ? row.label
            : typeof row.name === 'string'
              ? row.name
              : '';
        if (!id.trim()) return null;
        return { id: id.trim(), label: label.trim() };
      })
      .filter((item): item is { id: string; label: string } => item !== null);

    if (schedules.length === 0) {
      return {
        scheduleId: null,
        noSchedules: true,
        needsUserChoice: false,
        scheduleLabels: [],
      };
    }

    if (preferredScheduleId && schedules.some((s) => s.id === preferredScheduleId)) {
      return {
        scheduleId: preferredScheduleId,
        noSchedules: false,
        needsUserChoice: false,
        scheduleLabels: schedules.map((s) => s.label || s.id.slice(0, 8)),
      };
    }

    if (schedules.length === 1) {
      return {
        scheduleId: schedules[0].id,
        noSchedules: false,
        needsUserChoice: false,
        scheduleLabels: schedules.map((s) => s.label || s.id.slice(0, 8)),
      };
    }

    return {
      scheduleId: null,
      noSchedules: false,
      needsUserChoice: true,
      scheduleLabels: schedules.map((s) => s.label || s.id.slice(0, 8)).slice(0, 5),
    };
  };

  const classifyComplexIntent = async (messageText: string): Promise<ComplexIntent | null> => {
    if (!COMPLEX_INTENT_TRIGGER.test(messageText)) return null;

    const memoryBits = [
      `last_swap: ${lastSwapIdsRef.current ? 'available' : 'none'}`,
      `last_plan_id: ${lastPlanIdRef.current ?? 'none'}`,
    ].join('\n');

    const response = await sendChatMessage(
      [{ role: 'user', content: `Request: ${messageText}\n${memoryBits}` }],
      COMPLEX_INTENT_PROMPT,
      { maxTokensOverride: COMPLEX_INTENT_MAX_TOKENS }
    );

    const raw = response.rawContent || response.message;
    return parseComplexIntent(raw);
  };

  const tryDeterministicComplexAction = async (
    messageText: string,
    currentScheduleId: string | null
  ): Promise<{ handled: boolean; scheduleModified: boolean }> => {
    const intent = await classifyComplexIntent(messageText);
    if (!intent) return { handled: false, scheduleModified: false };

    const confidence = typeof intent.confidence === 'number' ? intent.confidence : 0;
    if (intent.intent === 'unknown' || confidence < 0.72) {
      return { handled: false, scheduleModified: false };
    }

    const executeAndRender = async (functionName: string, args: Record<string, unknown>) => {
      const result = await executeFunction(functionName, args, { bypassDedup: true });
      const { displayContent, scheduleModified } = formatFunctionResult(functionName, result);

      if (displayContent.startsWith('__PLAN_PREVIEW__')) {
        try {
          const planData = JSON.parse(displayContent.replace('__PLAN_PREVIEW__', '')) as PlanData;
          appendAssistantMessage('', planData);
        } catch {
          appendAssistantMessage(displayContent);
        }
      } else if (displayContent && !displayContent.startsWith('[Function Result]')) {
        appendAssistantMessage(displayContent);
      }

      return { result, scheduleModified };
    };

    if (intent.intent === 'repeat_last_swap') {
      if (!lastSwapIdsRef.current) return { handled: false, scheduleModified: false };
      const { result, scheduleModified } = await executeAndRender(
        'swapEvents',
        { ...lastSwapIdsRef.current } as Record<string, unknown>
      );
      if (result.success) {
        lastSwapIdsRef.current = { ...lastSwapIdsRef.current };
      }
      return { handled: true, scheduleModified };
    }

    if (intent.intent === 'swap_events') {
      const parsedSwap = parseSwapIntent(messageText);
      const fallbackFirst = parsedSwap && parsedSwap.kind === 'named' ? parsedSwap.first : undefined;
      const fallbackSecond = parsedSwap && parsedSwap.kind === 'named' ? parsedSwap.second : undefined;
      const first = intent.params?.event_a?.trim() || fallbackFirst;
      const second = intent.params?.event_b?.trim() || fallbackSecond;

      if (!currentScheduleId || !first || !second) return { handled: false, scheduleModified: false };

      const [event1Id, event2Id] = await Promise.all([
        resolveEventIdByName(currentScheduleId, first),
        resolveEventIdByName(currentScheduleId, second),
      ]);
      if (!event1Id || !event2Id) return { handled: false, scheduleModified: false };

      const swapIds: SwapIds = { event1_id: event1Id, event2_id: event2Id };
      const { result, scheduleModified } = await executeAndRender(
        'swapEvents',
        { ...swapIds } as Record<string, unknown>
      );
      if (result.success) {
        lastSwapIdsRef.current = swapIds;
      }
      return { handled: true, scheduleModified };
    }

    if (intent.intent === 'move_event') {
      if (!currentScheduleId) return { handled: false, scheduleModified: false };
      const eventName = intent.params?.event_name?.trim();
      if (!eventName) return { handled: false, scheduleModified: false };

      const eventId = await resolveEventIdByName(currentScheduleId, eventName);
      if (!eventId) return { handled: false, scheduleModified: false };

      const day = normalizeDayName(intent.params?.day);
      const hour = normalizeHour24(intent.params?.hour_24);
      if (!day && typeof hour !== 'number') return { handled: false, scheduleModified: false };

      const updateArgs: Record<string, unknown> = { event_id: eventId };
      if (day) updateArgs.day = day;
      if (typeof hour === 'number') updateArgs.hour = hour;

      const { scheduleModified } = await executeAndRender('updateEventInSchedule', updateArgs);
      return { handled: true, scheduleModified };
    }

    if (intent.intent === 'delete_event') {
      if (!currentScheduleId) return { handled: false, scheduleModified: false };
      const eventName = intent.params?.event_name?.trim();
      if (!eventName) return { handled: false, scheduleModified: false };

      const eventId = await resolveEventIdByName(currentScheduleId, eventName);
      if (!eventId) return { handled: false, scheduleModified: false };

      const { scheduleModified } = await executeAndRender('deleteEventFromSchedule', { event_id: eventId });
      return { handled: true, scheduleModified };
    }

    if (intent.intent === 'commit_plan') {
      const explicitPlanId = intent.params?.plan_id?.trim();
      const planId = explicitPlanId || lastPlanIdRef.current;
      if (!planId || !UUID_RE.test(planId)) return { handled: false, scheduleModified: false };

      const { result, scheduleModified } = await executeAndRender('commitSchedulePlan', { plan_id: planId });
      if (result.success) {
        lastPlanIdRef.current = planId;
      }
      return { handled: true, scheduleModified };
    }

    return { handled: false, scheduleModified: false };
  };

  const runPostMutationTasks = (scheduleModified: boolean, currentScheduleId: string | null) => {
    if (!scheduleModified) return;

    if (onScheduleChange) {
      setTimeout(() => onScheduleChange(), 100);
    }

    if (!currentScheduleId) return;

    // Fire-and-forget: don't block the UI, don't show errors to the user
    (async () => {
      try {
        const [summaryResult, unassignedResult] = await Promise.all([
          executeFunction('getEventSummaryInSchedule', { schedule_id: currentScheduleId }, { bypassDedup: true }),
          executeFunction('listUnassignedParticipants', { schedule_id: currentScheduleId }, { bypassDedup: true }),
        ]);

        if (!summaryResult.success || !unassignedResult.success) return;

        const unassigned = Array.isArray(unassignedResult.data) ? unassignedResult.data : [];
        const insight = buildDeterministicHealthInsight(summaryResult.data, unassigned.length);
        if (!insight) return;

        const insightMsg: ChatMessage = {
          id: `insight-${Date.now()}`,
          role: 'assistant',
          content: insight,
          timestamp: new Date(),
          isInsight: true,
        };

        if (insight.startsWith('👤')) {
          insightMsg.quickAction = { label: 'Schedule Now', message: 'Schedule all unassigned participants' };
        } else if (insight.startsWith('⚠️')) {
          insightMsg.quickAction = {
            label: 'Propose Fix',
            message: 'Resolve the current overlap by moving one conflicting event to an available slot. Propose a plan first.'
          };
        } else if (insight.startsWith('📅')) {
          insightMsg.quickAction = { label: 'Review Gap', message: 'Analyze the schedule and suggest coverage for the gap' };
        }

        setMessages(prev => {
          const updated = [...prev, insightMsg];
          return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
        });
      } catch (err) {
        if (DEBUG) console.warn('[FloatingChat] Health check failed silently:', err);
      }
    })();
  };

  const submitMessage = async (messageText: string) => {
    const trimmedInput = messageText.trim();
    if (!trimmedInput || loading || submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };

    // Add user message
    setMessages((prev) => {
      const updated = [...prev, userMessage];
      return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
    });
    setInput('');
    setLoading(true);

    try {
      // Extract schedule ID from URL
      const scheduleMatch = window.location.pathname.match(/\/schedule\/([a-f0-9-]{36})/i);
      const currentScheduleId = scheduleMatch ? scheduleMatch[1] : null;

      const promptContext: PromptContext = {
        scheduleId: currentScheduleId || undefined,
      };

      // ─── Mode classification ────────────────────────────────────────────────
      // Deterministic first, LLM fallback for ambiguous inputs.
      const modeResult = await classifyMode(userMessage.content);
      const mode: AriaMode = modeResult.mode;
      if (DEBUG) {
        console.log('[Aria Debug] Mode classification:', {
          mode: modeResult.mode,
          confidence: modeResult.confidence,
          source: modeResult.source,
        });
      }

      if (currentScheduleId) {
        if (DEBUG) console.log('[FloatingChat Debug] Current schedule context:', currentScheduleId);
      }

      // ─── Simple mode ────────────────────────────────────────────────────────
      if (mode === 'simple') {
        const response = await sendChatMessage(
          [{ role: 'user', content: userMessage.content }],
          getMinimalPrompt(),
        );
        appendAssistantMessage(response.message);
        return;
      }

      // ─── Advisory mode ──────────────────────────────────────────────────────
      if (mode === 'advisory') {
        const advisorySeeded = messages
          .filter(shouldKeepForSeededHistory)
          .slice(-ADVISORY_SEEDED_HISTORY)
          .map((msg) => ({ role: msg.role, content: msg.content }));

        const alreadyEndsWithSameUserText =
          advisorySeeded.length > 0 &&
          advisorySeeded[advisorySeeded.length - 1]?.role === 'user' &&
          normalizeComparableText(advisorySeeded[advisorySeeded.length - 1].content) === normalizeComparableText(userMessage.content);
        let advisoryHistory: Message[] = alreadyEndsWithSameUserText
          ? [...advisorySeeded]
          : [...advisorySeeded, { role: 'user', content: userMessage.content }];

        const advisorySystemPrompt = buildAdvisoryPrompt(promptContext);
        const originalGoal = userMessage.content;
        const needsDeterministicUnscheduledLookup =
          isUnscheduledCountQuery(originalGoal) || isSuggestSpotsForUnscheduledQuery(originalGoal);
        if (needsDeterministicUnscheduledLookup) {
          const resolvedSchedule = await resolveScheduleContextForLookup(currentScheduleId);

          if (resolvedSchedule.noSchedules) {
            appendAssistantMessage('You do not have any schedules yet. Create one first, then I can help with unscheduled students.');
            return;
          }

          if (!resolvedSchedule.scheduleId) {
            const labelsText = resolvedSchedule.scheduleLabels.join(', ');
            appendAssistantMessage(
              labelsText
                ? `I found multiple schedules: ${labelsText}. Tell me which schedule name you want me to check.`
                : 'I found multiple schedules. Tell me which schedule name you want me to check.'
            );
            return;
          }

          if (isUnscheduledCountQuery(originalGoal)) {
            const unassignedResult = await executeFunction(
              'listUnassignedParticipants',
              { schedule_id: resolvedSchedule.scheduleId },
              { bypassDedup: true }
            );

            if (!unassignedResult.success) {
              appendAssistantMessage('I could not access that schedule right now. Try again or pick a different schedule name.');
              return;
            }

            const count = Array.isArray(unassignedResult.data) ? unassignedResult.data.length : 0;
            appendAssistantMessage(`You have ${count} unscheduled participant${count === 1 ? '' : 's'}.`);
            return;
          }

          if (isSuggestSpotsForUnscheduledQuery(originalGoal)) {
            const [summaryResult, unassignedResult] = await Promise.all([
              executeFunction('getEventSummaryInSchedule', { schedule_id: resolvedSchedule.scheduleId }, { bypassDedup: true }),
              executeFunction('listUnassignedParticipants', { schedule_id: resolvedSchedule.scheduleId }, { bypassDedup: true }),
            ]);

            if (summaryResult.success && unassignedResult.success) {
              const events = mapSummaryToScheduledEvents(summaryResult.data);
              const participants = mapUnassignedToParticipants(unassignedResult.data);
              const suggestionResult = suggestSlots(events, participants);

              if (suggestionResult.totalSuggested === 0) {
                appendAssistantMessage('I could not find safe slot suggestions from current preferences. I can run auto-schedule preview next.');
                return;
              }

              const preview = suggestionResult.suggestions
                .slice(0, 4)
                .map((s) => `${s.participantName} on ${s.day} at ${formatHourForDisplay(s.hour)}`)
                .join('; ');
              const unresolvedText = suggestionResult.unresolvable.length > 0
                ? ` ${suggestionResult.unresolvable.length} still need manual review.`
                : '';
              appendAssistantMessage(
                `I found suggested spots for ${suggestionResult.totalSuggested}/${suggestionResult.totalUnassigned}: ${preview}.${unresolvedText} Want me to apply these as a plan?`
              );
              if (DEBUG) console.log('[Aria Debug] Advisory deterministic slot suggestion path used');
              return;
            }
          }
        }

        let lastFunctionCalled: string | undefined = undefined;
        let advisoryIterations = 0;
        const toolsCalled: string[] = [];
        let terminationReason = 'completed';
        let advisoryResponseShown = false;
        let lastAdvisoryTool: string | undefined = undefined;
        let consecutiveAdvisorySameToolCount = 0;

        while (advisoryIterations < ADVISORY_MAX_ITERATIONS) {
          advisoryIterations++;

          const toolBlock = buildAdvisoryToolBlock(promptContext, lastFunctionCalled);

          // On the last allowed iteration, inject a finish instruction
          const isLastIteration = advisoryIterations === ADVISORY_MAX_ITERATIONS;
          const finishNudge = isLastIteration
            ? '\n\n[System: This is your last turn. Synthesize your findings into 1-3 concise, actionable sentences. Do NOT call another tool.]'
            : '';

          let messagesForThisCall: Message[] = advisoryHistory;
          if (toolBlock) {
            messagesForThisCall = [
              { role: 'user', content: `[Context for this step]\n${toolBlock}${finishNudge}` },
              ...advisoryHistory,
            ];
          } else if (finishNudge) {
            messagesForThisCall = [
              ...advisoryHistory,
              { role: 'user', content: finishNudge },
            ];
          }

          const response = await sendChatMessage(
            messagesForThisCall,
            advisorySystemPrompt,
            { maxTokensOverride: ADVISORY_MAX_TOKENS },
          );

          advisoryHistory = [
            ...advisoryHistory,
            { role: 'assistant', content: response.rawContent || response.message },
          ];

          // No function call → advisory is done, show final message
          if (!response.functionCall) {
            let displayMessage = response.message
              .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, '')
              .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
              .trim();

            if (displayMessage.length > 1 && /^["']|["']$/g.test(displayMessage)) {
              displayMessage = displayMessage.replace(/^["']|["']$/g, '');
            }

            if (displayMessage) {
              appendAssistantMessage(displayMessage);
              advisoryResponseShown = true;
            }

            terminationReason = isLastIteration ? 'budget_limit' : 'completed';
            break;
          }

          // Function call — execute (read-only only)
          const { name, arguments: fnArgs } = response.functionCall;

          // Safety guard: block mutating tools in advisory mode
          if (!ADVISORY_TOOL_NAMES.has(name)) {
            if (DEBUG) console.warn(`[Aria Debug] Advisory mode blocked mutating tool: ${name}`);
            appendAssistantMessage(
              `I can see you'd like me to ${originalGoal.toLowerCase()}. Would you like me to go ahead and make those changes?`
            );
            terminationReason = 'mutation_blocked';
            break;
          }

          // Show working indicator on first iteration
          if (advisoryIterations === 1) {
            let displayMessage = response.message
              .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, '')
              .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
              .trim();
            if (!displayMessage || displayMessage === response.rawContent) {
              displayMessage = 'Let me look into that...';
            }
            const workingMessage: ChatMessage = {
              id: (Date.now() + advisoryIterations * 10).toString(),
              role: 'assistant',
              content: displayMessage,
              timestamp: new Date(),
            };
            setMessages((prev) => {
              const updated = [...prev, workingMessage];
              return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
            });
          }

          if (DEBUG) console.log(`[Aria Debug] Advisory executing: ${name}`, fnArgs);

          let executionArgs = fnArgs;
          if (
            name === 'getParticipantPreferences' &&
            currentScheduleId &&
            !String(fnArgs.schedule_id ?? '').trim()
          ) {
            executionArgs = { ...fnArgs, schedule_id: currentScheduleId };
          }

          const result = await executeFunction(name, executionArgs, { bypassDedup: true });
          toolsCalled.push(name);
          lastFunctionCalled = name;

          if (name === lastAdvisoryTool) {
            consecutiveAdvisorySameToolCount++;
          } else {
            lastAdvisoryTool = name;
            consecutiveAdvisorySameToolCount = 1;
          }

          if (
            result.success &&
            name === 'listUnassignedParticipants' &&
            isUnscheduledCountQuery(originalGoal)
          ) {
            const count = Array.isArray(result.data) ? result.data.length : 0;
            appendAssistantMessage(`You have ${count} unscheduled participant${count === 1 ? '' : 's'}.`);
            terminationReason = 'advisory_count_fast_path';
            advisoryResponseShown = true;
            break;
          }

          const { llmContent } = formatFunctionResult(name, result);

          // Inject result + continuation into history
          const repeatedToolNudge = result.success && consecutiveAdvisorySameToolCount >= ADVISORY_REPEAT_TOOL_SOFT_CAP
            ? `\n\n[System: You have called ${name} ${consecutiveAdvisorySameToolCount} times in a row. Unless essential, use a different read tool or synthesize now.]`
            : '';
          const continuationPrompt = result.success
            ? `${llmContent}\n\n[System: Data retrieved. Original question: "${originalGoal}". If you have enough information, synthesize your answer now in 1-3 concise sentences. If you need more data, call exactly one more tool.]${repeatedToolNudge}`
            : `${llmContent}\n\n[System: That lookup failed. Try a different approach or synthesize your answer from what you have.]`;

          advisoryHistory = [
            ...advisoryHistory,
            { role: 'user', content: continuationPrompt },
          ];

          if (!result.success) {
            // Don't hard-stop advisory on failure — let it try another approach
            // or synthesize from available data
            if (DEBUG) console.log('[Aria Debug] Advisory tool failed, continuing');
          }
        }

        if (advisoryIterations >= ADVISORY_MAX_ITERATIONS) {
          terminationReason = 'budget_limit';
        }

        if (!advisoryResponseShown) {
          const finalResponse = await sendChatMessage(
            [
              ...advisoryHistory,
              { role: 'user', content: '[System: Final step. Synthesize your best answer now in 1-3 concise sentences. Do NOT call tools.]' },
            ],
            advisorySystemPrompt,
            { maxTokensOverride: 320 },
          );

          const finalMessage = (finalResponse.message || '')
            .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, '')
            .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
            .trim();

          appendAssistantMessage(finalMessage || 'I reviewed what I could. Please share one more detail and I can refine this recommendation.');
          advisoryResponseShown = true;
        }

        if (DEBUG) {
          console.log('[Aria Debug] Advisory complete:', {
            stepsUsed: advisoryIterations,
            toolsCalled,
            terminationReason,
          });
        }

        return; // Advisory never mutates, so no post-mutation tasks
      }

      // ─── Execution mode ─────────────────────────────────────────────────────
      // Preserves all existing behavior: compact, full, preflight, recovery.
      const singleStepGoalLikely =
        !MULTI_STEP_GOAL_HINT.test(userMessage.content) &&
        !COMPLEX_GOAL_HINT.test(userMessage.content);

      // Hybrid preflight for complex ID-heavy actions:
      // LLM extracts intent -> deterministic resolver executes safely.
      const deterministicPreflight = await tryDeterministicComplexAction(userMessage.content, currentScheduleId);
      if (deterministicPreflight.handled) {
        runPostMutationTasks(deterministicPreflight.scheduleModified, currentScheduleId);
        return;
      }

      // ─── Conversation history ───────────────────────────────────────────────
      // Keep only relevant recent turns to avoid stale/bloated context.
      const seededHistory = buildSeededHistory(singleStepGoalLikely);
      const alreadyEndsWithSameUserText =
        seededHistory.length > 0 &&
        seededHistory[seededHistory.length - 1]?.role === 'user' &&
        normalizeComparableText(seededHistory[seededHistory.length - 1].content) === normalizeComparableText(userMessage.content);
      let conversationHistory: Message[] = alreadyEndsWithSameUserText
        ? [...seededHistory]
        : [...seededHistory, { role: 'user', content: userMessage.content }];

      // ─── Tier 1: Static system prompt ──────────────────────────────────────
      // Built ONCE per user turn. Personality + rules only — no tools.
      // Staying tool-free here keeps the system prompt short and cache-friendly.
      const systemPrompt = singleStepGoalLikely
        ? buildActionPrompt(promptContext)
        : buildSystemPrompt(promptContext);

      // Track original goal and last function called for the loop
      const originalGoal = userMessage.content;
      let lastFunctionCalled: string | undefined = undefined;

      // ─── Agentic loop ───────────────────────────────────────────────────────
      const MAX_ITERATIONS = 10;
      let iterations = 0;
      let anyScheduleModified = false;
      let forcedFunctionCallRetry = false;
      let forcedFailureRecoveryRetry = false;
      const executionToolsCalled: string[] = [];
      let consecutiveSameToolCount = 0;
      let lastToolInLoop: string | undefined = undefined;

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        if (DEBUG) console.log(`[FloatingChat Debug] Agentic loop iteration ${iterations}, last fn: ${lastFunctionCalled ?? 'none'}`);

        // ── Tier 2: Dynamic tool block ────────────────────────────────────────
        // Rebuilt every iteration based on what Aria just called.
        // Injected as a user-role context message so it doesn't pollute
        // assistant history and can be replaced cheaply each iteration.
        const toolBlock = buildToolBlock(
          originalGoal,
          promptContext,
          lastFunctionCalled,
          { compact: singleStepGoalLikely && !lastFunctionCalled }
        );

        // Build the messages array for this iteration:
        // [system prompt] + [tool context (user role)] + [conversation history]
        // The tool context is prepended fresh each call — not stored in history.
        let messagesForThisCall: Message[] = conversationHistory;
        if (toolBlock) {
          // We inject the tool block as the first user message so it always appears
          // at the top of the conversation, not buried under 10 turns of history.
          messagesForThisCall = [
            { role: 'user', content: `[Context for this step]\n${toolBlock}\n\nFor straightforward requests, output FUNCTION_CALL directly without thought tags.` },
            ...conversationHistory,
          ];
        }

        const response = await sendChatMessage(
          messagesForThisCall,
          systemPrompt,
          { maxTokensOverride: singleStepGoalLikely ? SIMPLE_ACTION_MAX_TOKENS : undefined }
        );
        if (DEBUG) console.log('[FloatingChat Debug] Got response:', response);

        // Store raw content in history so Aria remembers her own function calls
        conversationHistory = [
          ...conversationHistory,
          { role: 'assistant', content: response.rawContent || response.message },
        ];

        // ── UX: message display logic ─────────────────────────────────────────
        // Show iteration 1 acknowledgement + all final messages.
        // Hide intermediate "working" messages (iterations 2+ with function calls).
        const shouldShowMessage = iterations === 1 || !response.functionCall;

        if (shouldShowMessage) {
          let displayMessage = response.message
            .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, '')
            .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
            .replace(/THOUGHT:[\s\S]*?(?=\n|$)/gi, '')
            .replace(/```[\s\S]*?```/g, '')
            .trim();

          if (displayMessage.length > 1 && /^["']|["']$/g.test(displayMessage)) {
            displayMessage = displayMessage.replace(/^["']|["']$/g, '');
          }

          if (response.functionCall && !displayMessage) {
            displayMessage = 'On it! One moment, please';
          }

          if (displayMessage) {
            const assistantMessage: ChatMessage = {
              id: (Date.now() + iterations * 10).toString(),
              role: 'assistant',
              content: displayMessage,
              timestamp: new Date(),
            };
            setMessages((prev) => {
              const updated = [...prev, assistantMessage];
              return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
            });
          }
        }

        // No function call → Aria is done
        if (!response.functionCall) {
          const raw = response.rawContent || response.message;
          const isEmptyAssistantTurn = !raw.trim();
          const looksLikeIncompleteToolTurn =
            !forcedFunctionCallRetry &&
            (/<thought>|<think>|FUNCTION_CALL:/i.test(raw));
          const looksLikeIdDelegation =
            !forcedFunctionCallRetry &&
            ID_DELEGATION_HINT.test(raw);

          if ((!forcedFunctionCallRetry && isEmptyAssistantTurn) || looksLikeIncompleteToolTurn || looksLikeIdDelegation) {
            forcedFunctionCallRetry = true;
            conversationHistory = [
              ...conversationHistory,
              {
                role: 'user',
                content: isEmptyAssistantTurn
                  ? '[System: Your previous response was empty. Output exactly one FUNCTION_CALL now using a valid function name. No prose, no thoughts.]'
                  : looksLikeIdDelegation
                    ? '[System: Do NOT ask the user for IDs. Find IDs yourself using available tools (searchEventsInSchedule/getEventSummaryInSchedule/listUnassignedParticipants) and output exactly one FUNCTION_CALL now.]'
                    : '[System: Your previous response was incomplete. Output exactly one FUNCTION_CALL now using a valid function name. No prose, no thoughts.]',
              },
            ];
            if (DEBUG) console.warn('[FloatingChat Debug] Empty/incomplete non-tool reply detected; forcing one strict retry');
            continue;
          }

          if (DEBUG) console.log('[FloatingChat Debug] No function call — loop complete');
          break;
        }

        // ── Execute function ──────────────────────────────────────────────────
        const { name, arguments: args } = response.functionCall;
        if (DEBUG) console.log(`[FloatingChat Debug] Executing: ${name}`, args);
        executionToolsCalled.push(name);

        // Non-productive turn detection: same tool called 3+ times in a row
        if (name === lastToolInLoop) {
          consecutiveSameToolCount++;
        } else {
          consecutiveSameToolCount = 1;
          lastToolInLoop = name;
        }
        if (consecutiveSameToolCount >= 3) {
          const isReadOnlyTool = ADVISORY_TOOL_NAMES.has(name);
          if (!isReadOnlyTool || consecutiveSameToolCount >= 6) {
            if (DEBUG) console.warn(`[Aria Debug] Non-productive loop detected: ${name} called ${consecutiveSameToolCount}x consecutively`);
            appendAssistantMessage(`I'm having trouble completing this action — I keep calling the same step. Could you rephrase your request or provide more details?`);
            break;
          }
          if (DEBUG) {
            console.warn(`[Aria Debug] Soft-cap warning: read-only tool ${name} repeated ${consecutiveSameToolCount}x`);
          }
        }

        let executionArgs = args;
        if (
          name === 'getParticipantPreferences' &&
          currentScheduleId &&
          !String(args.schedule_id ?? '').trim()
        ) {
          executionArgs = { ...args, schedule_id: currentScheduleId };
        }
        if (name === 'swapEvents' && currentScheduleId) {
          const raw1 = String(args.event1_id ?? args.event_id1 ?? args.id1 ?? '').trim();
          const raw2 = String(args.event2_id ?? args.event_id2 ?? args.id2 ?? '').trim();
          const needsPreResolution = raw1 && raw2 && (!UUID_RE.test(raw1) || !UUID_RE.test(raw2));

          if (needsPreResolution) {
            const [event1Search, event2Search] = await Promise.all([
              executeFunction('searchEventsInSchedule', { schedule_id: currentScheduleId, query: raw1 }, { bypassDedup: true }),
              executeFunction('searchEventsInSchedule', { schedule_id: currentScheduleId, query: raw2 }, { bypassDedup: true }),
            ]);
            rememberEventSearchResults(currentScheduleId, event1Search.data);
            rememberEventSearchResults(currentScheduleId, event2Search.data);

            const event1Id = event1Search.success ? pickSearchResultId(event1Search.data, raw1) : null;
            const event2Id = event2Search.success ? pickSearchResultId(event2Search.data, raw2) : null;

            if (event1Id && event2Id) {
              executionArgs = { event1_id: event1Id, event2_id: event2Id };
              if (DEBUG) {
                console.log('[FloatingChat Debug] Pre-resolved swap names to IDs', { raw1, raw2, event1Id, event2Id });
              }
            }
          }
        }

        let result = await executeFunction(name, executionArgs);

        // Fast-path recovery: if swap was called with names instead of UUIDs,
        // resolve both names locally and retry swap without another LLM step.
        if (!result.success && name === 'swapEvents' && currentScheduleId) {
          const raw1 = String(args.event1_id ?? args.event_id1 ?? args.id1 ?? '').trim();
          const raw2 = String(args.event2_id ?? args.event_id2 ?? args.id2 ?? '').trim();
          const needsResolution = raw1 && raw2 && (!UUID_RE.test(raw1) || !UUID_RE.test(raw2));

          if (needsResolution) {
            const [event1Search, event2Search] = await Promise.all([
              executeFunction('searchEventsInSchedule', { schedule_id: currentScheduleId, query: raw1 }, { bypassDedup: true }),
              executeFunction('searchEventsInSchedule', { schedule_id: currentScheduleId, query: raw2 }, { bypassDedup: true }),
            ]);
            rememberEventSearchResults(currentScheduleId, event1Search.data);
            rememberEventSearchResults(currentScheduleId, event2Search.data);

            const event1Id = event1Search.success ? pickSearchResultId(event1Search.data, raw1) : null;
            const event2Id = event2Search.success ? pickSearchResultId(event2Search.data, raw2) : null;

            if (event1Id && event2Id) {
              if (DEBUG) {
                console.log('[FloatingChat Debug] Local swap recovery resolved IDs', { raw1, raw2, event1Id, event2Id });
              }
              result = await executeFunction(
                'swapEvents',
                { event1_id: event1Id, event2_id: event2Id },
                { bypassDedup: true },
              );
            }
          }
        }

        const { displayContent, llmContent, scheduleModified } = formatFunctionResult(name, result);
        const isRecoverableLookupFailure =
          !result.success &&
          /(missing event ids|event .* not found|participant not found)/i.test(result.error || '');

        if (result.success) {
          if (name === 'searchEventsInSchedule' && currentScheduleId) {
            rememberEventSearchResults(currentScheduleId, result.data);
            const query = String(executionArgs.query ?? '').trim();
            const picked = query ? pickSearchResultId(result.data, query) : null;
            if (query && picked) {
              eventIdCacheRef.current[`${currentScheduleId}::${query.toLowerCase()}`] = picked;
            }
          }
          if (name === 'proposeScheduleChanges') {
            const planId = (result.data as { plan_id?: unknown } | undefined)?.plan_id;
            if (typeof planId === 'string' && UUID_RE.test(planId)) {
              lastPlanIdRef.current = planId;
            }
          }
          if (name === 'commitSchedulePlan') {
            const committedPlan = String(executionArgs.plan_id ?? '').trim();
            if (UUID_RE.test(committedPlan)) {
              lastPlanIdRef.current = committedPlan;
            }
          }
          if (name === 'swapEvents') {
            const parsedSwap = extractSwapIdsFromArgs(executionArgs);
            if (parsedSwap) {
              lastSwapIdsRef.current = parsedSwap;
            }
          }
        }

        if (scheduleModified) anyScheduleModified = true;

        // Track which function just ran — used by buildToolBlock next iteration
        lastFunctionCalled = name;

        // ── Auto-schedule preview: hand off to modal, stop loop ───────────────
        if (name === 'autoScheduleParticipants' && result.success && (result.data as any)?.previewMode) {
          if (DEBUG) console.log('[FloatingChat] Triggering Auto-Schedule Preview UI');
          if (onShowAutoSchedule) onShowAutoSchedule();
          break;
        }

        // ── Plan preview: render card, stop loop, wait for user ───────────────
        const isPlanPreview = displayContent.startsWith('__PLAN_PREVIEW__');

        if ((isPlanPreview) || (!result.success && !isRecoverableLookupFailure)) {
          let planData: PlanData | undefined;
          let content = displayContent;

          if (isPlanPreview) {
            try {
              planData = JSON.parse(displayContent.replace('__PLAN_PREVIEW__', ''));
              content = '';
            } catch { /* fallback to text */ }
          }

          const resultMessage: ChatMessage = {
            id: (Date.now() + iterations * 10 + 1).toString(),
            role: 'assistant',
            content,
            timestamp: new Date(),
            planData,
          };
          setMessages((prev) => {
            const updated = [...prev, resultMessage];
            return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
          });

          if (isPlanPreview) {
            if (DEBUG) console.log('[FloatingChat Debug] Plan preview shown — waiting for user');
            break;
          }
        }

        const canAutoCompleteWithoutSecondLlmTurn =
          result.success &&
          !isPlanPreview &&
          singleStepGoalLikely &&
          AUTO_COMPLETE_FUNCTIONS.has(name);

        if (canAutoCompleteWithoutSecondLlmTurn) {
          if (displayContent && !displayContent.startsWith('[Function Result]')) {
            const resultMessage: ChatMessage = {
              id: (Date.now() + iterations * 10 + 2).toString(),
              role: 'assistant',
              content: displayContent,
              timestamp: new Date(),
            };
            setMessages((prev) => {
              const updated = [...prev, resultMessage];
              return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
            });
          }

          if (DEBUG) console.log('[FloatingChat Debug] Auto-completed terminal single-step goal');
          break;
        }

        // ── Continuation prompt ───────────────────────────────────────────────
        // Restates the original goal so Aria never "forgets" mid-chain.
        // On failure: tells Aria to diagnose and either retry or explain.
        const continuationPrompt = result.success
          ? `${llmContent}\n\n[System: Step ${iterations} complete. Original goal: "${originalGoal}". If the goal is NOT fully achieved yet, output the next FUNCTION_CALL immediately. Do NOT summarize or confirm until the entire goal is done.]`
          : isRecoverableLookupFailure
            ? `${llmContent}\n\n[System: Recovery required. Do NOT ask the user for IDs. Use searchEventsInSchedule or getEventSummaryInSchedule with CURRENT_SCHEDULE_ID to find the correct IDs, then output the next FUNCTION_CALL immediately.]`
            : `${llmContent}\n\n[System: The last action failed. Diagnose the error. Either retry with corrected arguments or explain the issue to the user clearly. Do NOT claim success.]`;

        // ── Context slimming ──────────────────────────────────────────────────
        // Replace older results from the same summary/list function with a
        // placeholder. Prevents token bloat from repeated state snapshots.
        const SLIM_FUNCTIONS = ['getEventSummaryInSchedule', 'listSchedules', 'listUnassignedParticipants', 'analyzeScheduleHealth'];
        if (SLIM_FUNCTIONS.includes(name)) {
          conversationHistory = conversationHistory.map(msg => {
            if (msg.role === 'user' && msg.content.includes(`[Function Result] ${name}`)) {
              return { ...msg, content: `[Superseded — see latest ${name} result below]` };
            }
            return msg;
          });
        }

        conversationHistory = [
          ...conversationHistory,
          { role: 'user', content: continuationPrompt },
        ];

        // Hard stop on failure — don't keep trying blindly
        if (!result.success) {
          if (isRecoverableLookupFailure && !forcedFailureRecoveryRetry) {
            forcedFailureRecoveryRetry = true;
            if (DEBUG) console.log('[FloatingChat Debug] Recoverable lookup failure — forcing one recovery iteration');
            continue;
          }
          if (DEBUG) console.log('[FloatingChat Debug] Function failed — stopping loop');
          break;
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        if (DEBUG) console.warn('[FloatingChat Debug] Max iterations reached');
      }

      if (DEBUG) {
        console.log('[Aria Debug] Execution complete:', {
          mode: 'execution',
          stepsUsed: iterations,
          toolsCalled: executionToolsCalled,
          terminationReason: iterations >= MAX_ITERATIONS ? 'budget_limit' : 'completed',
        });
      }

      runPostMutationTasks(anyScheduleModified, currentScheduleId);

    } catch (error) {
      console.error('Error in agentic loop:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const updated = [...prev, errorMessage];
        return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
      });
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  // Don't render on auth page
  if (typeof window !== 'undefined' && window.location.pathname === '/') {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes pulse-ring {
            0% {
              transform: scale(0.8);
              opacity: 0.8;
            }
            50% {
              transform: scale(1);
              opacity: 0.4;
            }
            100% {
              transform: scale(0.8);
              opacity: 0.8;
            }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .chat-button:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5);
          }
          .send-button:hover:not(:disabled) {
            background-color: #ea580c !important;
          }
          .header-button:hover {
            background: rgba(255, 255, 255, 0.3) !important;
          }
          .input:focus {
            border-color: #f97316 !important;
            background: white !important;
          }
        `}
      </style>

      {/* Chat Window */}
      {isOpen && (
        <div style={{ ...styles.chatWindow, ...(isMobile ? styles.chatWindowMobile : {}) }}>
          {/* Header */}
          <div style={styles.header}>
            <img src={ariaProfile} alt="Aria" style={styles.headerAvatar} />
            <div style={styles.headerText}>
              <h3 style={styles.headerTitle}>Aria</h3>
              <p style={styles.headerSubtitle}>Your scheduling assistant</p>
            </div>
            <div style={styles.headerActions}>
              <button
                className="header-button"
                style={styles.headerButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                <Minimize2 size={18} />
              </button>
              <button
                className="header-button"
                style={styles.headerButton}
                onClick={() => setIsOpen(false)}
                aria-label="Minimize chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messagesContainer}>
            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateIcon}>
                  <MessageCircle size={24} color="white" />
                </div>
                <h4 style={styles.emptyStateTitle}>Start a conversation</h4>
                <p style={styles.emptyStateText}>
                  Ask me to help you create schedules or manage your events.
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => {
                  // ── Insight bubble ────────────────────────────────────────────
                  if (message.isInsight) {
                    const quickAction = message.quickAction;
                    return (
                      <div key={message.id} style={styles.insightWrapper}>
                        <div style={styles.insightAvatar}>
                          <Lightbulb size={14} color="white" />
                        </div>
                        <div style={styles.insightBubble}>
                          <span>{message.content}</span>
                          {quickAction && (
                            <button
                              type="button"
                              style={styles.insightButton}
                              disabled={loading}
                              onClick={() => { void submitMessage(quickAction.message); }}
                              onMouseOver={(e) => (e.currentTarget.style.background = '#c2410c')}
                              onMouseOut={(e) => (e.currentTarget.style.background = '#ea580c')}
                            >
                              {quickAction.label}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // ── Normal message bubble ─────────────────────────────────────
                  return (
                    <div
                      key={message.id}
                      style={{
                        ...styles.messageWrapper,
                        ...(message.role === 'user' ? styles.userMessageWrapper : styles.assistantMessageWrapper),
                      }}
                    >
                      <div
                        style={{
                          ...styles.avatar,
                          ...(message.role === 'user' ? styles.userAvatar : {}),
                        }}
                      >
                        {message.role === 'user' ? (
                          <User size={16} />
                        ) : (
                          <img src={ariaProfile} alt="Aria" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div
                        style={{
                          ...styles.messageBubble,
                          ...(message.role === 'user' ? styles.userBubble : styles.assistantBubble),
                        }}
                      >
                        {message.planData ? (
                          <PlanPreviewCard
                            planId={message.planData.planId}
                            changes={message.planData.changes as any}
                            conflicts={message.planData.conflicts as any}
                            expiresAt={message.planData.expiresAt}
                            onConfirm={(planId) => {
                              setInput(`Yes, commit plan ${planId}`);
                              setTimeout(() => {
                                const form = document.querySelector('form');
                                if (form) form.requestSubmit();
                              }, 100);
                            }}
                            onReject={(planId) => {
                              setInput(`Reject plan ${planId}`);
                              setTimeout(() => {
                                const form = document.querySelector('form');
                                if (form) form.requestSubmit();
                              }, 100);
                            }}
                          />
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div style={{ ...styles.messageWrapper, ...styles.assistantMessageWrapper }}>
                    <div
                      style={{
                        ...styles.avatar,
                        background: '#f9fafb',
                      }}
                    >
                      <img src={ariaProfile} alt="Aria" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ ...styles.messageBubble, ...styles.assistantBubble, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6b7280', fontSize: '12px' }}>
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div style={styles.inputContainer}>
            <form onSubmit={handleSubmit} style={styles.inputForm}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                style={styles.input}
                disabled={loading}
                className="input"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="send-button"
                style={{
                  ...styles.sendButton,
                  ...(!input.trim() || loading ? styles.sendButtonDisabled : {}),
                }}
              >
                {loading ? (
                  <AnimatedIcon><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></AnimatedIcon>
                ) : (
                  <AnimatedIcon><Send size={18} /></AnimatedIcon>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Chat Button (when closed) */}
      {!isOpen && (
        <button
          className="chat-button"
          style={styles.chatButton}
          onClick={() => setIsOpen(true)}
          aria-label="Open chat"
        >
          {messages.length > 0 && (
            <div style={styles.notificationBadge} />
          )}
          <MessageCircle size={28} color="white" />
        </button>
      )}
    </>
  );
}
