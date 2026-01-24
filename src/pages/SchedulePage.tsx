// src/pages/SchedulePage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Settings, List, Sparkles, Copy, Check, Layout } from 'lucide-react';
import s from './SchedulePage.module.css';
import { getSchedule, updateSchedule, type Schedule } from '../lib/api/schedules';
import { getScheduleEntries, createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, type ScheduleEntry } from '../lib/api/schedule-entries';
import { getFormResponses, deleteFormResponse, updateFormResponseAssigned, getPreferredTimings, type FormResponse } from '../lib/api/form-responses';
import AddEventModal from '../components/AddEventModal';
import Modal from '../components/Modal';
import SchedulingPreviewModal from '../components/SchedulingPreviewModal';
import ConfigureFormModal from '../components/ConfigureFormModal';
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';


const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function TrashZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash',
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        border: `2px dashed ${isOver ? '#ef4444' : '#d1d5db'}`,
        padding: '1.5rem',
        textAlign: 'center',
        backgroundColor: isOver ? '#fee2e2' : '#f9fafb',
        borderRadius: 'var(--radius-full)',
        color: isOver ? '#991b1b' : '#6b7280',
        width: '100%',
        maxWidth: '400px',
        fontWeight: 600,
        fontSize: '0.875rem'
      }}
    >
      {isOver ? 'Drop here to delete' : 'Drag here to delete'}
    </div>
  );
}

export default function SchedulePage() {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; hour: number } | null>(null);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  const [participantToDelete, setParticipantToDelete] = useState<FormResponse | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);

  const [showSchedulingPreview, setShowSchedulingPreview] = useState(false);
  const [responseToView, setResponseToView] = useState<FormResponse | null>(null);


  const [showConfigureFormModal, setShowConfigureFormModal] = useState(false);
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const isArchived = schedule?.status === 'archived';
  const isTrashed = schedule?.status === 'trashed';
  const isViewOnly = isArchived || isTrashed;

  const HOURS = useMemo(() => {
    const start = schedule?.working_hours_start ?? 8;
    const end = schedule?.working_hours_end ?? 21;
    // Show from start hour to the hour BEFORE the end hour (so end hour 21 means last slot is 20-21)
    return Array.from({ length: end - start }, (_, i) => i + start);
  }, [schedule]);

  useEffect(() => {
    if (scheduleId) {
      loadScheduleData();
    }
  }, [scheduleId]);


  // Helper to parse YYYY-MM-DD in local timezone (not UTC)
  const parseLocalDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    // Support both YYYY-MM-DD and full ISO strings
    if (dateStr.includes('T')) return new Date(dateStr);
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const { weekStart, weekEnd, weekNumber, totalWeeks } = useMemo(() => {
    if (!schedule) return { weekStart: null, weekEnd: null, weekNumber: 0, totalWeeks: 0 };

    if (!schedule) return { weekStart: null, weekEnd: null, weekNumber: 0, totalWeeks: 0 };

    const start = parseLocalDate(schedule.start_date);
    const end = parseLocalDate(schedule.end_date);

    // Find the Sunday that starts the week containing schedule.start_date (for timetable headers)
    const startDayOfWeek = start.getDay();
    const timetableWeekStart = new Date(start);
    timetableWeekStart.setDate(start.getDate() - startDayOfWeek); // Go back to Sunday

    // Calculate total weeks from timetable start (Sunday) to end
    const totalMs = end.getTime() - timetableWeekStart.getTime();
    const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
    const total = Math.ceil(totalDays / 7);

    // Current week (for navigation)
    const currentWeekStart = new Date(timetableWeekStart);
    currentWeekStart.setDate(timetableWeekStart.getDate() + (currentWeekOffset * 7));

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

    return {
      weekStart: currentWeekStart,
      weekEnd: currentWeekEnd,
      weekNumber: currentWeekOffset + 1,
      totalWeeks: total,
      displayStartDate: schedule.start_date,
      displayEndDate: schedule.end_date
    };
  }, [schedule, currentWeekOffset]);

  const formatLocalDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatLocalTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseRecurrenceRule = (rule: string) => {
    if (!rule) return null;

    const freqMatch = rule.match(/FREQ=(\w+)/);
    const intervalMatch = rule.match(/INTERVAL=(\d+)/);
    const byDayMatch = rule.match(/BYDAY=(\w+)/);

    let freq = freqMatch ? freqMatch[1] : 'WEEKLY';
    let interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;

    // Handle INTERVAL as frequency indicators (standard iCal format)
    if (freq === 'WEEKLY') {
      if (interval === 4) {
        freq = 'MONTHLY';
      } else if (interval === 2) {
        freq = '2WEEKLY';
      }
    }

    const byDayStr = byDayMatch ? byDayMatch[1] : '';
    const dayAbbrevs = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const dayIndex = dayAbbrevs.indexOf(byDayStr);

    return { freq, interval, dayIndex: dayIndex >= 0 ? dayIndex : null };
  };

  const isEntryInCurrentWeek = (entry: ScheduleEntry): boolean => {
    if (!weekStart || !schedule) return false;

    const entryStart = new Date(entry.start_time);
    const rule = parseRecurrenceRule(entry.recurrence_rule);

    // Use == null to check for null/undefined, not falsy (0 is a valid dayIndex for Sunday)
    if (!rule || rule.dayIndex == null) {
      return entryStart >= weekStart && entryStart <= weekEnd;
    }

    const scheduleStart = parseLocalDate(schedule.start_date);
    const scheduleFirstDay = new Date(scheduleStart);
    scheduleFirstDay.setDate(scheduleStart.getDate() - scheduleStart.getDay());

    const daysFromFirst = Math.floor((entryStart.getTime() - scheduleFirstDay.getTime()) / (1000 * 60 * 60 * 24));
    const entryWeekOffset = Math.floor(daysFromFirst / 7);

    const currentWeekFirstDay = new Date(weekStart);
    const daysFromCurrentFirst = Math.floor((currentWeekFirstDay.getTime() - scheduleFirstDay.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeekOffset = Math.floor(daysFromCurrentFirst / 7);

    if (rule.freq === 'WEEKLY' || rule.freq === '2WEEKLY') {
      const weekDiff = Math.abs(entryWeekOffset - currentWeekOffset);
      const interval = rule.freq === '2WEEKLY' ? 2 : 1;
      return weekDiff % interval === 0;
    }

    if (rule.freq === 'MONTHLY') {
      // INTERVAL in MONTHLY means number of weeks (default 4 weeks for "once every 4 weeks")
      const weeksInterval = rule.interval > 0 ? rule.interval : 4;
      const weekDiff = Math.abs(entryWeekOffset - currentWeekOffset);
      return weekDiff % weeksInterval === 0;
    }

    return entryWeekOffset === currentWeekOffset;
  };

  const getEntriesForSlot = (day: string, hour: number) => {
    const dayIndex = DAYS.indexOf(day);

    return entries.filter(entry => {
      if (!isEntryInCurrentWeek(entry)) return false;

      // Get the day of week for this entry from recurrence rule BYDAY, or from actual date
      const rule = parseRecurrenceRule(entry.recurrence_rule);
      const entryDayIndex = rule?.dayIndex ?? new Date(entry.start_time).getDay();

      // Get the hour from the entry
      const entryHour = new Date(entry.start_time).getHours();

      return entryDayIndex === dayIndex && entryHour === hour;
    });
  };

  const goToPreviousWeek = () => {
    setCurrentWeekOffset(prev => Math.max(0, prev - 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekOffset(prev => Math.min(totalWeeks - 1, prev + 1));
  };


  const loadScheduleData = async () => {
    if (!scheduleId) return;

    try {
      setLoading(true);
      setError(null);

      const [scheduleData, entriesData] = await Promise.all([
        getSchedule(scheduleId),
        getScheduleEntries(scheduleId)
      ]);

      setSchedule(scheduleData);
      setEntries(entriesData);

      try {
        const responsesData = await getFormResponses(scheduleId);
        setResponses(responsesData);
      } catch (err) {
        setResponses([]);
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  };

  const getUnassignedParticipants = () => {
    return responses.filter((r) => !r.assigned);
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatFrequency = (freq: string) => {
    const labels: Record<string, string> = {
      'once': 'Once',
      'weekly': 'Weekly',
      '2weekly': 'Every 2 Weeks',
      'monthly': 'Monthly',
    };
    return labels[freq] || freq;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'draft') return 'Draft';
    if (status === 'collecting') return 'Active (Collecting)';
    if (status === 'archived') return 'Archived';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleCopyLink = () => {
    if (!schedule) return;
    const link = `${window.location.origin}/form/${schedule.id}`;
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };


  const handleSlotClick = (day: string, hour: number) => {
    if (isViewOnly) return;
    setSelectedSlot({ day, hour });
    setSelectedEntry(null);
    setShowAddModal(true);
  };

  const handleEntryClick = (entry: ScheduleEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEntry(entry);
    setSelectedSlot(null);
    setShowAddModal(true);
  };

  const handleEventSaved = () => {
    loadScheduleData();
  };

  const handleArchive = async () => {
    if (!scheduleId || !schedule) return;

    try {
      await updateSchedule(scheduleId, { status: 'archived' });
      loadScheduleData();
    } catch (err) {
      console.error('Failed to archive schedule:', err);
      alert(err instanceof Error ? err.message : 'Failed to archive schedule');
    }
  };

  const handleTrashWithRedirect = async () => {
    if (!scheduleId || !schedule) return;

    try {
      await updateSchedule(scheduleId, { status: 'trashed' });
      setShowTrashConfirm(false);
      navigate('/');
    } catch (err) {
      console.error('Failed to trash schedule:', err);
      alert(err instanceof Error ? err.message : 'Failed to trash schedule');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);

    // The user's instruction placed `useMemo` here, but it must be at the component's top level.
    // Assuming `HOURS` is meant to be a component-level memoized value,
    // this block is moved to the component's top level.
    // If `HOURS` was intended to be local to `handleDragEnd`, it would not be `useMemo`.
    // Since the instruction explicitly mentioned `useMemo` and "inside SchedulePage",
    // it implies a component-level definition.

    if (loading || !schedule || !over) {
      setActiveDragId(null);
      return;
    }

    const dropId = over.id as string;

    if (typeof active.id === 'string' && active.id.startsWith('unassigned-')) {
      const responseId = active.id.replace('unassigned-', '');
      const response = responses.find(r => r.id === responseId);

      if (!response || !dropId.startsWith('slot-')) return;

      const [, day, hourStr] = dropId.split('-');
      const hour = parseInt(hourStr);

      const dayIndex = DAYS.indexOf(day);

      // Use the current week being viewed for the date
      const firstOccurrence = new Date(weekStart!);
      firstOccurrence.setDate(weekStart!.getDate() + dayIndex);
      firstOccurrence.setHours(hour, 0, 0, 0);

      const preferredStart = response.preferred_1_start;
      const preferredEnd = response.preferred_1_end;

      if (preferredStart && preferredEnd) {
        const [startH, startM] = preferredStart.split(':').map(Number);
        const [endH, endM] = preferredEnd.split(':').map(Number);
        const durationMs = (endH * 60 + endM) - (startH * 60 + startM);

        const newEnd = new Date(firstOccurrence.getTime() + durationMs * 60 * 1000);

        const overlappingEntry = entries.find(entry => {
          const entryStart = new Date(entry.start_time);
          const entryEnd = new Date(entry.end_time);
          if (entryStart.getDay() !== dayIndex) return false;
          return (firstOccurrence < entryEnd && newEnd > entryStart);
        });

        if (overlappingEntry) {
          alert(`Cannot schedule - slot conflicts with "${overlappingEntry.student_name}"`);
          return;
        }

        const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayIndex];
        const frequency = response.preferred_1_frequency || 'weekly';
        const recurrenceRule = frequency === 'once' ? '' :
          frequency === '2weekly' ? `FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayAbbrev}` :
            frequency === 'monthly' ? `FREQ=WEEKLY;INTERVAL=4;BYDAY=${dayAbbrev}` :
              `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;

        try {
          const newEntry = await createScheduleEntry({
            schedule_id: scheduleId!,
            student_name: response.student_name,
            start_time: firstOccurrence.toISOString(),
            end_time: newEnd.toISOString(),
            recurrence_rule: recurrenceRule,
          });

          await updateFormResponseAssigned(responseId, true);
          setResponses(responses.filter(r => r.id !== responseId));
          setEntries([...entries, newEntry]);
        } catch (err) {
          console.error('Failed to create entry:', err);
          alert('Failed to schedule event');
        }
      }
      return;
    }

    const draggedEntry = entries.find(e => e.id === active.id);
    if (!draggedEntry) return;

    if (dropId.startsWith('slot-')) {
      const [, day, hourStr] = dropId.split('-');
      const hour = parseInt(hourStr);

      const dayIndex = DAYS.indexOf(day);

      // Use the current week being viewed for the date
      const firstOccurrence = new Date(weekStart!);
      firstOccurrence.setDate(weekStart!.getDate() + dayIndex);
      firstOccurrence.setHours(hour, 0, 0, 0);

      const oldStart = new Date(draggedEntry.start_time);
      const oldEnd = new Date(draggedEntry.end_time);
      const durationMs = oldEnd.getTime() - oldStart.getTime();

      const newEnd = new Date(firstOccurrence.getTime() + durationMs);

      const overlappingEntry = entries.find(entry => {
        if (entry.id === draggedEntry.id) return false;
        const entryStart = new Date(entry.start_time);
        const entryEnd = new Date(entry.end_time);
        if (entryStart.getDay() !== dayIndex) return false;
        return (firstOccurrence < entryEnd && newEnd > entryStart);
      });

      if (overlappingEntry) {
        const confirmSwap = window.confirm(
          `"${draggedEntry.student_name}" conflicts with "${overlappingEntry.student_name}". Swap them?`
        );

        if (!confirmSwap) return;

        const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayIndex];

        // Get the original day of the dragged entry for the swap
        const draggedOriginalDay = new Date(draggedEntry.start_time).getDay();
        const draggedOriginalDayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][draggedOriginalDay];

        // Helper to get frequency type from recurrence rule
        const getFrequency = (rule: string): 'once' | 'weekly' | '2weekly' | 'monthly' => {
          if (!rule) return 'once';
          if (rule.includes('INTERVAL=2')) return '2weekly';
          if (rule.includes('FREQ=MONTHLY')) return 'monthly';
          // Check for INTERVAL=4 (which represents "monthly" in our system)
          if (rule.includes('INTERVAL=4')) return 'monthly';
          return 'weekly';
        };

        // Helper to update just the BYDAY in recurrence rule while preserving frequency
        const updateRecurrenceDay = (rule: string, newDayAbbrev: string): string => {
          const freq = getFrequency(rule);
          if (freq === 'once') return '';
          if (freq === '2weekly') return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${newDayAbbrev}`;
          if (freq === 'monthly') return `FREQ=WEEKLY;INTERVAL=4;BYDAY=${newDayAbbrev}`;
          return `FREQ=WEEKLY;BYDAY=${newDayAbbrev}`;
        };

        try {
          // Preserve the overlapping entry's original duration
          const overlappingDuration = new Date(overlappingEntry.end_time).getTime() - new Date(overlappingEntry.start_time).getTime();
          const draggedNewStart = new Date(draggedEntry.start_time);
          const overlappingNewEnd = new Date(draggedNewStart.getTime() + overlappingDuration);

          const newDraggedRecurrence = updateRecurrenceDay(draggedEntry.recurrence_rule, dayAbbrev);
          const newOverlappingRecurrence = updateRecurrenceDay(overlappingEntry.recurrence_rule, draggedOriginalDayAbbrev);

          setEntries(entries.map(e => {
            if (e.id === draggedEntry.id) {
              return { ...e, start_time: firstOccurrence.toISOString(), end_time: newEnd.toISOString(), recurrence_rule: newDraggedRecurrence };
            }
            if (e.id === overlappingEntry.id) {
              return { ...e, start_time: draggedEntry.start_time, end_time: overlappingNewEnd.toISOString(), recurrence_rule: newOverlappingRecurrence };
            }
            return e;
          }));

          await updateScheduleEntry(draggedEntry.id, {
            start_time: firstOccurrence.toISOString(),
            end_time: newEnd.toISOString(),
            recurrence_rule: newDraggedRecurrence,
          });

          await updateScheduleEntry(overlappingEntry.id, {
            start_time: draggedEntry.start_time,
            end_time: overlappingNewEnd.toISOString(),
            recurrence_rule: newOverlappingRecurrence,
          });

          setActiveDragId(null);
        } catch (err) {
          console.error('Failed to swap events:', err);
          setActiveDragId(null);
          loadScheduleData();
        }
        return;
      }

      const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayIndex];

      // Preserve original frequency, just update the day
      const originalRule = draggedEntry.recurrence_rule || '';
      let recurrenceRule = originalRule;

      if (!originalRule) {
        // "Once" frequency - keep empty (no recurrence)
        recurrenceRule = '';
      } else if (originalRule.includes('INTERVAL=2')) {
        // 2weekly - extract INTERVAL if present, default to 2
        const intervalMatch = originalRule.match(/INTERVAL=(\d+)/);
        const interval = intervalMatch ? intervalMatch[1] : '2';
        recurrenceRule = `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${dayAbbrev}`;
      } else if (originalRule.includes('FREQ=MONTHLY')) {
        // Extract INTERVAL if present
        const intervalMatch = originalRule.match(/INTERVAL=(\d+)/);
        const interval = intervalMatch ? intervalMatch[1] : '4';
        recurrenceRule = `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${dayAbbrev}`;
      } else if (originalRule.includes('FREQ=WEEKLY')) {
        // Check for INTERVAL
        const intervalMatch = originalRule.match(/INTERVAL=(\d+)/);
        const interval = intervalMatch ? intervalMatch[1] : '';
        recurrenceRule = interval
          ? `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${dayAbbrev}`
          : `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
      } else {
        // Unknown format - default to weekly
        recurrenceRule = `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
      }

      try {
        await updateScheduleEntry(draggedEntry.id, {
          start_time: firstOccurrence.toISOString(),
          end_time: newEnd.toISOString(),
          recurrence_rule: recurrenceRule,
        });

        // Update local state for instant feedback
        setEntries(entries.map(e => {
          if (e.id === draggedEntry.id) {
            return {
              ...e,
              start_time: firstOccurrence.toISOString(),
              end_time: newEnd.toISOString(),
              recurrence_rule: recurrenceRule,
            };
          }
          return e;
        }));

        setActiveDragId(null);
      } catch (err) {
        console.error('Failed to move event:', err);
        setActiveDragId(null);
        loadScheduleData();
      }
    } else if (dropId === 'trash') {
      // Cancel drag first (clean transition)
      setActiveDragId(null);
      setIsDragging(false);

      // Then open delete confirmation
      if (draggedEntry.recurrence_rule && draggedEntry.recurrence_rule !== '') {
        setEntryToDelete(draggedEntry);
      } else {
        // Delete immediately for non-recurring entries
        try {
          await deleteScheduleEntry(draggedEntry.id);
          setEntries(entries.filter(e => e.id !== draggedEntry.id));
        } catch (err) {
          console.error('Failed to delete event:', err);
        }
      }
    } else if (dropId.startsWith('entry-')) {
      const targetEntryId = dropId.replace('entry-', '');
      const targetEntry = entries.find(e => e.id === targetEntryId);

      if (!targetEntry || targetEntry.id === draggedEntry.id) return;

      const confirmSwap = window.confirm(
        `Swap "${draggedEntry.student_name}" with "${targetEntry.student_name}"?`
      );

      if (!confirmSwap) return;

      try {
        // Calculate original durations (from each entry's own start/end)
        const draggedStart = new Date(draggedEntry.start_time);
        const draggedEnd = new Date(draggedEntry.end_time);
        const draggedDurationMs = draggedEnd.getTime() - draggedStart.getTime();

        const targetStart = new Date(targetEntry.start_time);
        const targetEnd = new Date(targetEntry.end_time);
        const targetDurationMs = targetEnd.getTime() - targetStart.getTime();

        // Helper to get frequency type from recurrence rule
        const getFrequency = (rule: string): 'once' | 'weekly' | '2weekly' | 'monthly' => {
          if (!rule) return 'once';
          if (rule.includes('INTERVAL=2')) return '2weekly';
          if (rule.includes('FREQ=MONTHLY')) return 'monthly';
          // Check for INTERVAL=4 (which represents "monthly" in our system)
          if (rule.includes('INTERVAL=4')) return 'monthly';
          return 'weekly';
        };

        // Helper to update just the BYDAY in recurrence rule while preserving frequency
        const updateRecurrenceDay = (rule: string, newDate: Date): string => {
          const dayAbbrevs = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          const newDayAbbrev = dayAbbrevs[newDate.getDay()];

          // Extract frequency and rebuild rule
          const freq = getFrequency(rule);

          if (freq === 'once') return '';
          if (freq === '2weekly') return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${newDayAbbrev}`;
          if (freq === 'monthly') return `FREQ=WEEKLY;INTERVAL=4;BYDAY=${newDayAbbrev}`;
          return `FREQ=WEEKLY;BYDAY=${newDayAbbrev}`;
        };

        // Calculate new recurrence rules - each entry keeps its own frequency
        const newDraggedRecurrence = updateRecurrenceDay(draggedEntry.recurrence_rule, targetStart);
        const newTargetRecurrence = updateRecurrenceDay(targetEntry.recurrence_rule, draggedStart);

        // Update entries one at a time to avoid race conditions
        await updateScheduleEntry(draggedEntry.id, {
          start_time: targetStart.toISOString(),
          end_time: new Date(targetStart.getTime() + draggedDurationMs).toISOString(),
          recurrence_rule: newDraggedRecurrence,
        });

        await updateScheduleEntry(targetEntry.id, {
          start_time: draggedStart.toISOString(),
          end_time: new Date(draggedStart.getTime() + targetDurationMs).toISOString(),
          recurrence_rule: newTargetRecurrence,
        });

        // Update local state with the new values
        setEntries(entries.map(e => {
          if (e.id === draggedEntry.id) {
            return {
              ...e,
              start_time: targetStart.toISOString(),
              end_time: new Date(targetStart.getTime() + draggedDurationMs).toISOString(),
              recurrence_rule: newDraggedRecurrence,
            };
          }
          if (e.id === targetEntry.id) {
            return {
              ...e,
              start_time: draggedStart.toISOString(),
              end_time: new Date(draggedStart.getTime() + targetDurationMs).toISOString(),
              recurrence_rule: newTargetRecurrence,
            };
          }
          return e;
        }));

        setActiveDragId(null);
      } catch (err) {
        console.error('Failed to swap events:', err);
        setActiveDragId(null);
        alert('Failed to swap events. Please try again.');
      }
    }
  };

  const getEventBlockStyle = (entry: ScheduleEntry) => {
    const startTime = new Date(entry.start_time);
    const endTime = new Date(entry.end_time);

    const startMinutes = startTime.getMinutes();
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    const topOffset = (startMinutes / 60) * 40;
    const height = (durationMinutes / 60) * 40;

    return {
      top: `${topOffset}px`,
      height: `${height}px`,
    };
  };

  function DraggableEventBlock({ entry, children }: { entry: ScheduleEntry; children: React.ReactNode }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging: isBeingDragged, // Renamed to avoid conflict with component-level isDragging
    } = useDraggable({
      id: entry.id,
      data: entry,
      disabled: isViewOnly,
    });

    const style = transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      zIndex: 1000,
      opacity: isBeingDragged ? 0 : 1,
    } : undefined;

    return (
      <div
        ref={setNodeRef}
        className={s.eventBlock}
        style={{
          ...getEventBlockStyle(entry),
          ...style, // Apply transform and opacity from useDraggable
          visibility: isBeingDragged ? 'hidden' : 'visible',
          pointerEvents: isBeingDragged ? 'none' : 'auto',
          cursor: isViewOnly ? 'default' : 'grab',
        }}
        onClick={(e) => {
          if (!isDragging && !isViewOnly) { // Use component-level isDragging here
            handleEntryClick(entry, e);
          }
        }}
        {...(!isViewOnly ? { ...attributes, ...listeners } : {})}
        onMouseEnter={(e) => { if (!isViewOnly) { e.currentTarget.style.backgroundColor = '#ea580c'; } }}
        onMouseLeave={(e) => { if (!isViewOnly) { e.currentTarget.style.backgroundColor = '#fb923c'; } }}
      >
        {children}
      </div>
    );
  }



  function DroppableSlot({ children, day, hour }: { children: React.ReactNode; day: string; hour: number }) {
    const { setNodeRef: setSlotRef, isOver } = useDroppable({
      id: `slot-${day}-${hour}`,
    });

    return (
      <div
        ref={setSlotRef}
        className={s.timeSlot}
        style={{
          backgroundColor: isOver ? '#ffedd5' : 'white',
          cursor: isViewOnly ? 'default' : 'pointer',
        }}
        onClick={() => handleSlotClick(day, hour)}
        onMouseEnter={(e) => { if (!isViewOnly) { e.currentTarget.style.backgroundColor = '#ffedd5'; e.currentTarget.style.cursor = 'pointer'; } }}
        onMouseLeave={(e) => { if (!isViewOnly) { e.currentTarget.style.backgroundColor = 'white'; } }}
      >
        {children}
      </div>
    );
  }



  if (loading) {
    return (
      <div className={s.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '1.125rem' }}>Loading schedule...</div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className={s.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ color: '#991b1b', fontSize: '1.125rem' }}>
          {error || 'Schedule not found'}
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className={s.backButton}
          style={{ backgroundColor: '#f97316', color: 'white', borderColor: '#f97316' }}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={s.container}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveDragId(null);
          setIsDragging(false);
          setEntryToDelete(null);
        }}
        autoScroll={false}
      >
        {/* New Toolbar Redesign */}
        <header className={s.toolbar}>
          <div className={s.toolbarContent}>
            {/* Left: Back & Title */}
            <div className={s.leftSection}>
              <button onClick={() => navigate('/dashboard')} className={s.backButton}>
                <ArrowLeft size={18} />
              </button>
              <div className={s.titleArea}>
                <h1 className={s.title}>{schedule.label}</h1>
                <div className={s.subtitle}>
                  {formatLocalDate(parseLocalDate(schedule.start_date))} – {formatLocalDate(parseLocalDate(schedule.end_date))}
                </div>
              </div>
            </div>

            {/* Center: Week Navigation */}
            <div className={s.centerSection}>
              <button
                onClick={goToPreviousWeek}
                className={s.backButton}
                disabled={currentWeekOffset === 0}
                style={{ opacity: currentWeekOffset === 0 ? 0.4 : 1 }}
              >
                <ChevronLeft size={20} />
              </button>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '160px', textAlign: 'center' }}>
                Week {weekNumber} of {totalWeeks}
              </div>
              <button
                onClick={goToNextWeek}
                className={s.backButton}
                disabled={currentWeekOffset >= totalWeeks - 1}
                style={{ opacity: currentWeekOffset >= totalWeeks - 1 ? 0.4 : 1 }}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Right: Actions & Dropdowns */}
            <div className={s.rightSection}>
              {/* Events Dropdown Trigger */}
              <div style={{ position: 'relative' }}>
                <button
                  className={s.toolbarButton}
                  onClick={() => { setIsEventsOpen(!isEventsOpen); setIsInfoOpen(false); }}
                >
                  <List size={16} />
                  <span>Events</span>
                  {getUnassignedParticipants().length > 0 && (
                    <div className={s.badge}>{getUnassignedParticipants().length}</div>
                  )}
                </button>

                {isEventsOpen && (
                  <>
                    <div className={s.popoverOverlay} onClick={() => setIsEventsOpen(false)} />
                    <div className={s.popover}>
                      <div className={s.popoverHeader}>
                        <h3 className={s.popoverTitle}>Unassigned Participants</h3>
                        <button
                          onClick={() => getUnassignedParticipants().length > 0 && setShowSchedulingPreview(true)}
                          disabled={getUnassignedParticipants().length === 0}
                          className={s.activateButton}
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          <Sparkles size={12} />
                          Schedule All
                        </button>
                      </div>
                      <div className={s.popoverContent}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {getUnassignedParticipants().map((response) => (
                            <div
                              key={response.id}
                              className={s.unassignedCard}
                              onClick={() => setResponseToView(response)}
                            >
                              <div className={s.unassignedCardName}>{response.student_name}</div>
                              <Trash2
                                size={14}
                                className={s.unassignedCardIcon}
                                onClick={(e) => { e.stopPropagation(); setParticipantToDelete(response); }}
                              />
                            </div>
                          ))}
                          {getUnassignedParticipants().length === 0 && (
                            <div className={s.emptyState}>No unassigned participants</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Info Dropdown Trigger */}
              <div style={{ position: 'relative' }}>
                <button
                  className={s.toolbarButton}
                  onClick={() => { setIsInfoOpen(!isInfoOpen); setIsEventsOpen(false); }}
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </button>

                {isInfoOpen && (
                  <>
                    <div className={s.popoverOverlay} onClick={() => setIsInfoOpen(false)} />
                    <div className={s.popover}>
                      <div className={s.popoverHeader}>
                        <h3 className={s.popoverTitle}>Schedule Settings</h3>
                      </div>
                      <div className={s.popoverContent}>
                        <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-500)', display: 'block', marginBottom: '0.25rem' }}>Status</span>
                            <span style={{ fontWeight: 600 }}>{getStatusLabel(schedule.status)}</span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', borderTop: '1px solid var(--border-divider)', paddingTop: '1rem' }}>
                            {schedule.status !== 'draft' && !isViewOnly && (
                              <button
                                onClick={() => { setShowConfigureFormModal(true); setIsInfoOpen(false); }}
                                className={s.toolbarButton}
                                style={{ width: '100%', justifyContent: 'flex-start' }}
                              >
                                <Settings size={14} />
                                <span>Edit Form Configuration</span>
                              </button>
                            )}

                            {schedule.status === 'collecting' && !isViewOnly && (
                              <button
                                onClick={handleArchive}
                                className={s.toolbarButton}
                                style={{ width: '100%', justifyContent: 'flex-start' }}
                              >
                                <Layout size={14} />
                                <span>Archive Schedule</span>
                              </button>
                            )}

                            <button
                              onClick={() => setShowTrashConfirm(true)}
                              className={s.toolbarButton}
                              style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--brand-error)', borderColor: 'rgba(220, 38, 38, 0.1)' }}
                            >
                              <Trash2 size={14} />
                              <span>Move to Trash</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Form Link & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {schedule.status === 'collecting' && !isViewOnly && (
                  <button
                    className={`${s.toolbarButton} ${isCopied ? s.successButton : ''}`}
                    onClick={handleCopyLink}
                    style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
                  >
                    <div className={s.pulse} />
                    <span>{isCopied ? 'Copied!' : 'Copy Form Link'}</span>
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}

                {schedule.status === 'draft' && !isViewOnly && (
                  <button
                    onClick={() => setShowConfigureFormModal(true)}
                    className={s.activateButton}
                  >
                    <Sparkles size={16} />
                    <span>Configure & Activate</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={s.main}>
          <div className={s.timetableContainer}>
            <div className={s.timetableHeader}>
              <div className={s.dayHeader}></div>
              {DAYS.map((day, index) => {
                const date = weekStart ? new Date(weekStart) : null;
                if (date) date.setDate(date.getDate() + index);
                const dateStr = date ? date.getDate() : '';
                return (
                  <div key={day} className={s.dayHeader}>
                    <span>{day}</span>
                    <span className={s.dayHeaderDate}>{dateStr}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ position: 'relative' }}>
              {HOURS.map((hour) => (
                <div key={hour} className={s.timetableGrid}>
                  <div className={s.timeLabel}>
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </div>
                  {DAYS.map((day) => {
                    const slotEntries = getEntriesForSlot(day, hour);

                    return (
                      <DroppableSlot key={`${day}-${hour}`} day={day} hour={hour}>
                        {slotEntries.map((entry) => (
                          <DraggableEventBlock key={entry.id} entry={entry}>
                            <div style={{ fontWeight: '600' }}>{entry.student_name}</div>
                            <div style={{ fontSize: '0.625rem', opacity: 0.9 }}>
                              {formatLocalTime(entry.start_time)}
                              {' - '}
                              {formatLocalTime(entry.end_time)}
                            </div>
                          </DraggableEventBlock>
                        ))}
                      </DroppableSlot>
                    );
                  })}
                </div>
              ))}

              {/* Final time label at the very bottom of the grid */}
              <div className={s.timetableGrid} style={{ borderBottom: 'none' }}>
                <div className={s.timeLabel}>
                  {(() => {
                    const lastHour = (schedule?.working_hours_end ?? 21);
                    return lastHour === 0 ? '12 AM' : lastHour === 12 ? '12 PM' : lastHour > 12 ? `${lastHour - 12} PM` : `${lastHour} AM`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Mobile FAB or other persistent overlays can go here */}

        {/* Contextual Trash Zone */}
        {isDragging && (
          <div
            className={`${s.trashZone} ${activeDragId === 'trash' ? s.trashZoneActive : ''}`}
          // Using a simple data attribute or specific ID for dnd-kit drop target
          >
            <TrashZone />
          </div>
        )}

        <AddEventModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setSelectedEntry(null);
            setSelectedSlot(null);
          }}
          onSuccess={handleEventSaved}
          scheduleId={scheduleId!}
          initialDay={selectedSlot?.day}
          initialHour={selectedSlot?.hour}
          scheduleStartDate={schedule.start_date}
          existingEntry={selectedEntry}
          onNeedDeleteConfirmation={() => {
            setEntryToDelete(selectedEntry);
          }}
          workingHoursStart={schedule.working_hours_start ?? 8}
          workingHoursEnd={schedule.working_hours_end ?? 21}
        />

        <Modal
          isOpen={!!participantToDelete}
          onClose={() => setParticipantToDelete(null)}
          title="Delete Participant"
          maxWidth="30rem"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ color: '#374151', marginBottom: '1rem' }}>
              Delete <strong>{participantToDelete?.student_name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={async () => {
                  if (!participantToDelete) return;
                  try {
                    await deleteFormResponse(participantToDelete.id);
                    setResponses(responses.filter(r => r.id !== participantToDelete.id));
                    setParticipantToDelete(null);
                  } catch (err) {
                    console.error('Failed to delete participant:', err);
                  }
                }}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                Delete
              </button>
              <button
                onClick={() => setParticipantToDelete(null)}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={!!entryToDelete && (!entryToDelete.recurrence_rule || entryToDelete.recurrence_rule === '')}
          onClose={() => setEntryToDelete(null)}
          title="Delete Event"
          maxWidth="35rem"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ color: '#374151', marginBottom: '1rem' }}>
              Delete <strong>{entryToDelete?.student_name}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={async () => {
                  if (!entryToDelete) return;
                  try {
                    await deleteScheduleEntry(entryToDelete.id);
                    setEntries(entries.filter(e => e.id !== entryToDelete.id));
                    setEntryToDelete(null);
                  } catch (err) {
                    console.error('Failed to delete event:', err);
                  }
                }}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                Delete
              </button>
              <button
                onClick={() => setEntryToDelete(null)}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={!!entryToDelete}
          onClose={() => {
            setEntryToDelete(null);
            setActiveDragId(null);
            setIsDragging(false);
          }}
          title="Delete Event"
          maxWidth="35rem"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ color: '#374151', marginBottom: '1rem' }}>
              Delete <strong>{entryToDelete?.student_name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={async () => {
                  if (!entryToDelete) return;
                  try {
                    await deleteScheduleEntry(entryToDelete.id);
                    setEntries(entries.filter(e => e.id !== entryToDelete.id));
                    setEntryToDelete(null);
                    setActiveDragId(null);
                    setIsDragging(false);
                    // Also close the AddEventModal if open
                    if (selectedEntry?.id === entryToDelete.id) {
                      setShowAddModal(false);
                      setSelectedEntry(null);
                    }
                  } catch (err) {
                    console.error('Failed to delete event:', err);
                  }
                }}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setEntryToDelete(null);
                  setActiveDragId(null);
                  setIsDragging(false);
                }}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        <SchedulingPreviewModal
          isOpen={showSchedulingPreview}
          onClose={() => setShowSchedulingPreview(false)}
          participants={getUnassignedParticipants()}
          existingEntries={entries}
          scheduleStart={parseLocalDate(schedule.start_date)}
          scheduleId={scheduleId!}
          onScheduled={loadScheduleData}
          workingHoursStart={schedule.working_hours_start ?? 8}
          workingHoursEnd={schedule.working_hours_end ?? 21}
        />

        <ConfigureFormModal
          isOpen={showConfigureFormModal}
          onClose={() => setShowConfigureFormModal(false)}
          onConfigured={loadScheduleData}
          schedule={schedule}
        />

        <Modal
          isOpen={!!responseToView}
          onClose={() => setResponseToView(null)}
          title="Event Details"
          maxWidth="35rem"
        >
          {responseToView && (
            <div style={{ padding: '0.25rem 0' }}>
              <div className={s.detailModalCard}>
                <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                  <div style={{ fontWeight: '600', fontSize: '1.125rem', color: '#92400e' }}>{responseToView.student_name}</div>
                  {responseToView.email && (
                    <div style={{ fontSize: '0.875rem', color: '#a16207', marginTop: '0.25rem' }}>{responseToView.email}</div>
                  )}
                </div>
                <div style={{ padding: '1rem' }}>
                  {getPreferredTimings(responseToView).map((timing, index) => (
                    <div key={index} className={s.detailModalPreferenceCard}>
                      <div className={s.detailModalPreferenceLabel}>
                        {index === 0 ? '1st Choice' : index === 1 ? '2nd Choice' : '3rd Choice'}
                      </div>
                      <div className={s.detailModalPreferenceValue}>
                        {timing.day} {formatTime(timing.start)} - {formatTime(timing.end)}
                        {timing.duration && ` (${timing.duration} min)`}
                        <br />
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formatFrequency(timing.frequency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  onClick={() => {
                    setResponseToView(null);
                    setParticipantToDelete(responseToView);
                  }}
                  style={{ flex: 1, padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500' }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setResponseToView(null)}
                  style={{ flex: 1, padding: '0.75rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500' }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>


        <Modal
          isOpen={showTrashConfirm}
          onClose={() => setShowTrashConfirm(false)}
          title="Move Schedule to Trash"
          maxWidth="30rem"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ color: '#374151', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Are you sure you want to move <strong>{schedule.label}</strong> to trash?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowTrashConfirm(false)}
                style={{ padding: '0.625rem 1.25rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleTrashWithRedirect}
                style={{ padding: '0.625rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}
              >
                Move to Trash
              </button>
            </div>
          </div>
        </Modal>

        <DragOverlay>
          {activeDragId && (() => {
            if (typeof activeDragId === 'string' && activeDragId.startsWith('unassigned-')) {
              const responseId = activeDragId.replace('unassigned-', '');
              const response = responses.find(r => r.id === responseId);
              if (!response) return null;
              return (
                <div style={{ padding: '0.6rem 0.75rem', backgroundColor: '#fbbf24', borderRadius: '0.5rem', border: '1px solid #f59e0b', fontSize: '0.875rem', opacity: 0.7, cursor: 'grabbing', zIndex: 9999 }}>
                  <div style={{ fontWeight: '600', color: '#92400e' }}>{response.student_name}</div>
                </div>
              );
            }

            const entry = entries.find(e => e.id === activeDragId);
            if (!entry) return null;

            return (
              <div style={{ ...getEventBlockStyle(entry), opacity: 0.7, cursor: 'grabbing', zIndex: 9999 }}>
                <div style={{ fontWeight: '600' }}>{entry.student_name}</div>
                <div style={{ fontSize: '0.625rem', opacity: 0.9 }}>
                  {formatLocalTime(entry.start_time)} - {formatLocalTime(entry.end_time)}
                </div>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext >
    </div >
  );
}


