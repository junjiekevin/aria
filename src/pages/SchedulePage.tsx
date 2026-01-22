// src/pages/SchedulePage.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Copy, Check, Sparkles } from 'lucide-react';
import { getSchedule, updateSchedule, type Schedule } from '../lib/api/schedules';
import { getScheduleEntries, createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, type ScheduleEntry } from '../lib/api/schedule-entries';
import { getFormResponses, deleteFormResponse, updateFormResponseAssigned, getPreferredTimings, type FormResponse } from '../lib/api/form-responses';
import AddEventModal from '../components/AddEventModal';
import Modal from '../components/Modal';
import SchedulingPreviewModal from '../components/SchedulingPreviewModal';
import ConfigureFormModal from '../components/ConfigureFormModal';
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },
  header: {
    borderBottom: '1px solid #e5e7eb',
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(4px)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 50,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  headerContent: {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '0.6rem 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.35rem 0.6rem',
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '0.3rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    color: '#374151',
    transition: 'all 0.2s',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  subtitle: {
    fontSize: '0.7rem',
    color: '#6b7280',
    margin: '0.25rem 0 0 0',
  },
  main: {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '0.6rem',
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: '0.85rem',
  },
  timetableContainer: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  timetableHeader: {
    display: 'grid',
    gridTemplateColumns: '55px repeat(7, 1fr)',
    borderBottom: '2px solid #f97316',
    backgroundColor: '#fff7ed',
  },
  dayHeader: {
    padding: '0.35rem 0.5rem',
    textAlign: 'center' as const,
    fontWeight: '600',
    fontSize: '0.7rem',
    color: '#c2410c',
    borderRight: '1px solid #fed7aa',
    backgroundColor: '#ffedd5',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.15rem',
  },
  dayHeaderDate: {
    fontSize: '0.8rem',
    color: '#92400e',
  },
  timeLabel: {
    width: '55px',
    padding: '0.25rem 0.25rem',
    fontSize: '0.7rem',
    color: '#6b7280',
    textAlign: 'right' as const,
    borderRight: '1px solid #e5e7eb',
    borderBottom: '1px solid #f3f4f6',
    fontWeight: '500',
  },
  timetableGrid: {
    display: 'grid',
    gridTemplateColumns: '55px repeat(7, 1fr)',
  },
  timeSlot: {
    height: '40px',
    borderRight: '1px solid #fed7aa',
    borderBottom: '1px solid #ffedd5',
    position: 'relative' as const,
    backgroundColor: 'white',
    transition: 'background-color 0.2s',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  panel: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    padding: '0.85rem',
  },
  panelTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 0.6rem 0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '0.6rem',
    color: '#6b7280',
    fontSize: '0.7rem',
  },
  lessonBlock: {
    position: 'absolute' as const,
    top: 0,
    left: '2px',
    right: '2px',
    backgroundColor: '#f97316',
    color: 'white',
    borderRadius: '0.25rem',
    padding: '0.25rem 0.5rem',
    fontSize: '0.625rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  statusSelect: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#111827',
  },
  unassignedPanel: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    padding: '0.85rem',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  unassignedPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '0.5rem',
    flexWrap: 'wrap' as const,
    flexShrink: 0 as const,
  },
  unassignedPanelTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  unassignedPanelTitleText: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  unassignedBadge: {
    backgroundColor: '#f97316',
    color: 'white',
    padding: '0.2rem 0.45rem',
    borderRadius: '9999px',
    fontSize: '0.7rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  unassignedBadgeHover: {
    backgroundColor: '#ea580c',
  },
  scheduleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.3rem 0.6rem',
    backgroundColor: '#22c55e',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.7rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(34, 197, 94, 0.3)',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap' as const,
  },
  scheduleButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  scheduleButtonHover: {
    backgroundColor: '#16a34a',
  },
  unassignedCardList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    overflowY: 'auto' as const,
    maxHeight: '160px',
  },
  unassignedCardListScrollbar: {
    '&::-webkit-scrollbar': {
      width: '4px',
    },
    '&::-webkit-scrollbar-track': {
      background: '#f1f1f1',
      borderRadius: '2px',
    },
    '&::-webkit-scrollbar-thumb': {
      background: '#d1d5db',
      borderRadius: '2px',
    },
  },
  unassignedCard: {
    padding: '0.6rem 0.75rem',
    backgroundColor: '#fef3c7',
    borderRadius: '0.5rem',
    border: '1px solid #fde68a',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'grab',
    transition: 'all 0.2s',
  },
  unassignedCardHover: {
    backgroundColor: '#fde68a',
    borderColor: '#f59e0b',
  },
  unassignedCardDragging: {
    backgroundColor: '#fbbf24',
    borderColor: '#f59e0b',
    opacity: 0.5,
  },
  unassignedCardName: {
    fontWeight: '600',
    color: '#92400e',
  },
  unassignedCardPreferred: {
    fontSize: '0.75rem',
    color: '#a16207',
    marginTop: '0.125rem',
  },
  unassignedCardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  unassignedCardIcon: {
    color: '#9ca3af',
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  unassignedCardIconHover: {
    color: '#dc2626',
  },
  detailModalCard: {
    backgroundColor: '#fffbeb',
    borderRadius: '0.5rem',
    border: '1px solid #fde68a',
    overflow: 'hidden',
  },
  detailModalCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    backgroundColor: '#fef3c7',
    borderBottom: '1px solid #fde68a',
    cursor: 'pointer',
  },
  detailModalCardHeaderExpanded: {
    borderBottom: '1px solid #fde68a',
  },
  detailModalCardName: {
    fontWeight: '600',
    color: '#92400e',
    fontSize: '0.9375rem',
  },
  detailModalCardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  detailModalCardBody: {
    padding: '1rem',
  },
  detailModalField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    marginBottom: '0.75rem',
  },
  detailModalFieldLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#a16207',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.025em',
  },
  detailModalFieldValue: {
    fontSize: '0.875rem',
    color: '#111827',
  },
  detailModalPreferenceCard: {
    backgroundColor: 'white',
    borderRadius: '0.375rem',
    border: '1px solid #e5e7eb',
    padding: '0.625rem 0.75rem',
    marginTop: '0.5rem',
  },
  detailModalPreferenceLabel: {
    fontSize: '0.7rem',
    fontWeight: '600',
    color: '#f97316',
    marginBottom: '0.25rem',
  },
  detailModalPreferenceValue: {
    fontSize: '0.8125rem',
    color: '#374151',
  },
};

function FormLink({ scheduleId }: { scheduleId: string }) {
  const [copied, setCopied] = useState(false);
  const formUrl = `${window.location.origin}/form/${scheduleId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <input
        readOnly
        value={formUrl}
        style={{
          flex: 1,
          padding: '0.5rem 0.75rem',
          border: '1px solid #d1d5db',
          borderRadius: '0.375rem',
          fontSize: '0.75rem',
          backgroundColor: '#f9fafb',
          color: '#6b7280',
        }}
      />
      <button
        onClick={copyToClipboard}
        style={{
          padding: '0.5rem',
          backgroundColor: copied ? '#22c55e' : '#f97316',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s',
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
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
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
    
  const [participantToDelete, setParticipantToDelete] = useState<FormResponse | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);
  
  const [showSchedulingPreview, setShowSchedulingPreview] = useState(false);
  
  const [responseToView, setResponseToView] = useState<FormResponse | null>(null);
  const [expandedResponseIds, setExpandedResponseIds] = useState<Set<string>>(new Set());
  
  const [showUnassignedModal, setShowUnassignedModal] = useState(false);
  
  const [showConfigureFormModal, setShowConfigureFormModal] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editingStartDate, setEditingStartDate] = useState('');
  const [editingEndDate, setEditingEndDate] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scheduleId) {
      loadScheduleData();
    }
  }, [scheduleId]);

  // Helper to parse YYYY-MM-DD in local timezone (not UTC)
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const { weekStart, weekEnd, weekNumber, totalWeeks } = useMemo(() => {
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

    if (!rule || !rule.dayIndex) {
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

  const handleNameClick = () => {
    if (!schedule) return;
    setIsEditingName(true);
    setEditingName(schedule.label);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleNameBlur = async () => {
    setIsEditingName(false);
    if (!schedule) return;
    
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== schedule.label) {
      try {
        await updateSchedule(schedule.id, { label: trimmedName });
        setSchedule({ ...schedule, label: trimmedName });
      } catch (err) {
        console.error('Failed to rename schedule:', err);
        setEditingName(schedule.label);
      }
    } else {
      setEditingName(schedule.label);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setEditingName(schedule?.label || '');
    }
  };

  const handleDatesClick = () => {
    if (!schedule) return;
    setIsEditingDates(true);
    setEditingStartDate(schedule.start_date);
    setEditingEndDate(schedule.end_date);
    setDateError(null);
    setTimeout(() => startDateInputRef.current?.focus(), 50);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingStartDate(e.target.value);
    setDateError(null);
    if (editingEndDate && e.target.value > editingEndDate) {
      setDateError('End date must be after start date');
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingEndDate(e.target.value);
    setDateError(null);
    if (editingStartDate && e.target.value < editingStartDate) {
      setDateError('End date must be after start date');
    }
  };

  const handleDatesBlur = async () => {
    if (!schedule) return;
    
    if (dateError) {
      setIsEditingDates(false);
      setEditingStartDate(schedule.start_date);
      setEditingEndDate(schedule.end_date);
      setDateError(null);
      return;
    }
    
    if (editingStartDate && editingEndDate && 
        (editingStartDate !== schedule.start_date || editingEndDate !== schedule.end_date)) {
      try {
        await updateSchedule(schedule.id, { 
          start_date: editingStartDate, 
          end_date: editingEndDate 
        });
        setSchedule({ 
          ...schedule, 
          start_date: editingStartDate, 
          end_date: editingEndDate 
        });
      } catch (err) {
        console.error('Failed to update dates:', err);
        setEditingStartDate(schedule.start_date);
        setEditingEndDate(schedule.end_date);
      }
    }
    
    setIsEditingDates(false);
    setDateError(null);
  };

  const handleDatesKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleDatesBlur();
    } else if (e.key === 'Escape') {
      setIsEditingDates(false);
      setDateError(null);
    }
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

  const getUnassignedStudents = () => {
    return responses.filter(r => r.assigned === false);
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

  const toggleResponseExpanded = (responseId: string) => {
    setExpandedResponseIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(responseId)) {
        newSet.delete(responseId);
      } else {
        newSet.add(responseId);
      }
      return newSet;
    });
  };

  const handleSlotClick = (day: string, hour: number) => {
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

  const handleStatusChange = async (newStatus: 'draft' | 'collecting' | 'archived' | 'trashed') => {
    if (!scheduleId) return;
    
    try {
      await updateSchedule(scheduleId, { status: newStatus });
      loadScheduleData();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);

    if (!over || !schedule) {
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

    const getLessonBlockStyle = (entry: ScheduleEntry) => {
      const startTime = new Date(entry.start_time);
      const endTime = new Date(entry.end_time);
      
      const startMinutes = startTime.getMinutes();
      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      
      const topOffset = (startMinutes / 60) * 40;
      const height = (durationMinutes / 60) * 40;
      
      return {
        ...styles.lessonBlock,
        top: `${topOffset}px`,
        height: `${height}px`,
      };
      };

    function DraggableLessonBlock({ entry, children }: { entry: ScheduleEntry; children: React.ReactNode }) {
      const { attributes, listeners, setNodeRef } = useDraggable({
        id: entry.id,
        data: entry,
      });

      const isBeingDragged = activeDragId === entry.id;

      return (
        <div
          ref={setNodeRef}
          style={{
            ...getLessonBlockStyle(entry),
            opacity: isBeingDragged ? 0 : 1,
            visibility: isBeingDragged ? 'hidden' : 'visible',
            pointerEvents: isBeingDragged ? 'none' : 'auto',
          }}
          onClick={(e) => {
            if (!isDragging) {
              handleEntryClick(entry, e);
            }
          }}
          {...attributes}
          {...listeners}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fb923c'; }}
        >
          {children}
        </div>
      );
    }

    function DraggableUnassignedCard({ response }: { response: FormResponse }) {
      const { attributes, listeners, setNodeRef } = useDraggable({
        id: `unassigned-${response.id}`,
        data: { ...response, isUnassigned: true },
      });

      const isBeingDragged = activeDragId === `unassigned-${response.id}`;

      return (
        <div
          ref={setNodeRef}
          style={{
            ...styles.unassignedCard,
            ...(isBeingDragged ? styles.unassignedCardDragging : {}),
          }}
          {...attributes}
          {...listeners}
          onClick={() => setResponseToView(response)}
          onMouseEnter={(e) => {
            if (!isBeingDragged) {
              e.currentTarget.style.backgroundColor = '#fde68a';
              e.currentTarget.style.borderColor = '#f59e0b';
            }
          }}
          onMouseLeave={(e) => {
            if (!isBeingDragged) {
              e.currentTarget.style.backgroundColor = '#fef3c7';
              e.currentTarget.style.borderColor = '#fde68a';
            }
          }}
        >
          <div style={styles.unassignedCardName}>{response.student_name}</div>
          <div style={styles.unassignedCardActions}>
            <Trash2
              size={16}
              style={styles.unassignedCardIcon}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setParticipantToDelete(response);
              }}
              onMouseEnter={(e: React.MouseEvent) => { (e.target as HTMLElement).style.color = '#dc2626'; }}
              onMouseLeave={(e: React.MouseEvent) => { (e.target as HTMLElement).style.color = '#9ca3af'; }}
            />
          </div>
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
          style={{
            ...styles.timeSlot,
            backgroundColor: isOver ? '#ffedd5' : 'white',
          }}
          onClick={() => handleSlotClick(day, hour)}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffedd5'; e.currentTarget.style.cursor = 'pointer'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
        >
          {children}
        </div>
      );
    }

   function TrashDroppable() {
     const { setNodeRef, isOver } = useDroppable({
       id: 'trash',
     });
     
     return (
       <div
         ref={setNodeRef}
         style={{
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'center',
           padding: '0.6rem',
           border: '2px dashed',
           borderColor: isOver ? '#dc2626' : '#d1d5db',
           borderRadius: '0.3rem',
           backgroundColor: isOver ? '#fef2f2' : 'white',
           color: isOver ? '#dc2626' : '#6b7280',
           fontSize: '0.7rem',
           fontWeight: '500',
           transition: 'all 0.2s',
           cursor: 'pointer',
           marginTop: '0.6rem',
         }}
       >
         {isOver ? 'Drop here to delete' : 'Drag here to delete'}
       </div>
     );
   }

  if (loading) {
    return (
      <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', fontSize: '1.125rem' }}>Loading schedule...</div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ color: '#991b1b', fontSize: '1.125rem' }}>
          {error || 'Schedule not found'}
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ ...styles.backButton, backgroundColor: '#f97316', color: 'white', borderColor: '#f97316' }}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
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
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={styles.backButton}
            >
              <ArrowLeft size={18} />
              Back
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={handleNameKeyDown}
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: '#111827',
                    padding: '0.25rem 0.5rem',
                    border: '1px solid #f97316',
                    borderRadius: '0.375rem',
                    outline: 'none',
                    maxWidth: '200px',
                  }}
                />
              ) : (
                <h1 
                  style={{ ...styles.title, cursor: 'pointer', margin: 0 }}
                  onClick={handleNameClick}
                >
                  {schedule.label}
                </h1>
              )}
              
              <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                {isEditingDates ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      ref={startDateInputRef}
                      type="date"
                      value={editingStartDate}
                      onChange={handleStartDateChange}
                      onBlur={handleDatesBlur}
                      onKeyDown={handleDatesKeyDown}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.35rem',
                        border: dateError ? '1px solid #dc2626' : '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        outline: 'none',
                      }}
                    />
                    <span style={{ color: '#9ca3af' }}>-</span>
                    <input
                      ref={endDateInputRef}
                      type="date"
                      value={editingEndDate}
                      onChange={handleEndDateChange}
                      onBlur={handleDatesBlur}
                      onKeyDown={handleDatesKeyDown}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.35rem',
                        border: dateError ? '1px solid #dc2626' : '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        outline: 'none',
                      }}
                    />
                    {dateError && (
                      <span style={{ color: '#dc2626', fontSize: '0.7rem' }}>{dateError}</span>
                    )}
                  </div>
                ) : (
                  <span 
                    style={{ cursor: 'pointer' }}
                    onClick={handleDatesClick}
                  >
                    {formatLocalDate(parseLocalDate(schedule.start_date))} - {formatLocalDate(parseLocalDate(schedule.end_date))}
                  </span>
                )}
              </span>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column' as const,
            alignItems: 'center',
            flex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={goToPreviousWeek}
                disabled={currentWeekOffset === 0}
                style={{ ...styles.backButton, opacity: currentWeekOffset === 0 ? 0.5 : 1 }}
              >
                <ChevronLeft size={20} />
              </button>
              
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#111827', margin: 0 }}>
                  {weekStart && weekEnd ? `${formatLocalDate(weekStart)} - ${formatLocalDate(weekEnd)}` : ''}
                </p>
              </div>
              
              <button
                onClick={goToNextWeek}
                disabled={currentWeekOffset >= totalWeeks - 1}
                style={{ ...styles.backButton, opacity: currentWeekOffset >= totalWeeks - 1 ? 0.5 : 1 }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            
            <span style={{ marginTop: '0.35rem', fontSize: '0.85rem', fontWeight: '500', color: '#f97316' }}>
              Week {weekNumber} of {totalWeeks}
            </span>
          </div>
          
          <div style={{ width: '100px' }}></div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.timetableContainer}>
          <div style={styles.timetableHeader}>
            <div style={styles.dayHeader}></div>
            {DAYS.map((day, index) => {
              const date = weekStart ? new Date(weekStart) : null;
              if (date) date.setDate(date.getDate() + index);
              const dateStr = date ? date.getDate() : '';
              return (
                <div key={day} style={styles.dayHeader}>
                  <span>{day}</span>
                  <span style={styles.dayHeaderDate}>{dateStr}</span>
                </div>
              );
            })}
          </div>

           {HOURS.map((hour) => (
             <div key={hour} style={styles.timetableGrid}>
               <div style={styles.timeLabel}>
                 {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
               </div>
                {DAYS.map((day) => {
                 const slotEntries = getEntriesForSlot(day, hour);
                 
                 return (
                   <DroppableSlot key={`${day}-${hour}`} day={day} hour={hour}>
                     {slotEntries.map((entry) => (
                       <DraggableLessonBlock key={entry.id} entry={entry}>
                         <div style={{ fontWeight: '600' }}>{entry.student_name}</div>
                         <div style={{ fontSize: '0.625rem', opacity: 0.9 }}>
                           {formatLocalTime(entry.start_time)}
                           {' - '}
                           {formatLocalTime(entry.end_time)}
                         </div>
                       </DraggableLessonBlock>
                     ))}
                   </DroppableSlot>
                 );
               })}
             </div>
           ))}
        </div>

        <div style={styles.sidePanel}>
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Schedule Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.5rem' }}>Status:</span>
                <select
                  value={schedule.status}
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  style={styles.statusSelect}
                  disabled={schedule.status === 'collecting'}
                >
                  <option value="draft">Draft</option>
                  <option value="collecting">Active (Collecting)</option>
                  <option value="archived">Archived</option>
                  <option value="trashed">Trashed</option>
                </select>
              </div>
              <div>
                <span style={{ color: '#6b7280' }}>Duration: </span>
                <span style={{ fontWeight: '500', color: '#111827' }}>
                  {totalWeeks} weeks
                </span>
              </div>
              
              {schedule.status === 'draft' && (
                <div style={{ marginTop: '1rem' }}>
                  <button
                    onClick={() => setShowConfigureFormModal(true)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#f97316',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
                  >
                    <Sparkles size={16} />
                    Configure & Activate Form
                  </button>
                </div>
              )}
              
              {schedule.status === 'collecting' && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                  {schedule.form_deadline && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Deadline:</span>
                      <span style={{ fontWeight: '500', color: '#111827' }}>
                        {new Date(schedule.form_deadline).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                      {schedule.max_choices === 1 ? '1 choice' : `${schedule.max_choices} choices`} per student
                    </span>
                  </div>
                  <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.5rem' }}>Form Link:</span>
                  <FormLink scheduleId={scheduleId!} />
                  <button
                    onClick={() => setShowConfigureFormModal(true)}
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'white',
                      color: '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                  >
                    Edit Form Configuration
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={styles.unassignedPanel}>
            <div style={styles.unassignedPanelHeader}>
              <div style={styles.unassignedPanelTitle}>
                <h3 style={styles.unassignedPanelTitleText}>Unassigned Events</h3>
                {getUnassignedStudents().length > 0 && (
                  <span 
                    style={styles.unassignedBadge}
                    onClick={() => setShowUnassignedModal(true)}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
                  >
                    {getUnassignedStudents().length}
                  </span>
                )}
              </div>
              <button
                onClick={() => getUnassignedStudents().length > 0 && setShowSchedulingPreview(true)}
                disabled={getUnassignedStudents().length === 0}
                style={{
                  ...styles.scheduleButton,
                  ...(getUnassignedStudents().length === 0 ? styles.scheduleButtonDisabled : {}),
                }}
                onMouseEnter={(e) => { if (getUnassignedStudents().length > 0) { e.currentTarget.style.backgroundColor = '#16a34a'; } }}
                onMouseLeave={(e) => { if (getUnassignedStudents().length > 0) { e.currentTarget.style.backgroundColor = '#22c55e'; } }}
              >
                <Sparkles size={12} />
                Schedule All
              </button>
            </div>
            <div style={styles.unassignedCardList}>
              {getUnassignedStudents().map((response) => (
                <DraggableUnassignedCard key={response.id} response={response} />
              ))}
            </div>
          </div>
          
          <div style={styles.panel}>
            <TrashDroppable />
          </div>
        </div>
      </main>

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
        students={getUnassignedStudents()}
        existingEntries={entries}
        scheduleStart={new Date(schedule.start_date)}
        scheduleId={scheduleId!}
        onScheduled={loadScheduleData}
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
            <div style={styles.detailModalCard}>
              <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                <div style={{ fontWeight: '600', fontSize: '1.125rem', color: '#92400e' }}>{responseToView.student_name}</div>
                {responseToView.email && (
                  <div style={{ fontSize: '0.875rem', color: '#a16207', marginTop: '0.25rem' }}>{responseToView.email}</div>
                )}
              </div>
              <div style={{ padding: '1rem' }}>
                {getPreferredTimings(responseToView).map((timing, index) => (
                  <div key={index} style={styles.detailModalPreferenceCard}>
                    <div style={styles.detailModalPreferenceLabel}>
                      {index === 0 ? '1st Choice' : index === 1 ? '2nd Choice' : '3rd Choice'}
                    </div>
                    <div style={styles.detailModalPreferenceValue}>
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
        isOpen={showUnassignedModal}
        onClose={() => setShowUnassignedModal(false)}
        title="Unassigned Events"
        maxWidth="40rem"
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {getUnassignedStudents().length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No unassigned events
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {getUnassignedStudents().map((response) => {
                const isExpanded = expandedResponseIds.has(response.id);
                const timings = getPreferredTimings(response);
                
                return (
                  <div key={response.id} style={styles.detailModalCard}>
                    <div 
                      style={styles.detailModalCardHeader}
                      onClick={() => toggleResponseExpanded(response.id)}
                    >
                      <div>
                        <div style={styles.detailModalCardName}>{response.student_name}</div>
                        {timings[0] && (
                          <div style={{ fontSize: '0.8125rem', color: '#a16207', marginTop: '0.125rem' }}>
                            {timings[0].day} {formatTime(timings[0].start)} - {formatTime(timings[0].end)}
                            {timings[0].duration && ` (${timings[0].duration} min)`}
                          </div>
                        )}
                      </div>
                      <div style={styles.detailModalCardActions}>
                        {isExpanded ? (
                          <span style={{ fontSize: '0.875rem', color: '#f97316', fontWeight: '500' }}>Hide</span>
                        ) : (
                          <span style={{ fontSize: '0.875rem', color: '#f97316', fontWeight: '500' }}>Show</span>
                        )}
                        <Trash2
                          size={16}
                          style={{ color: '#9ca3af', cursor: 'pointer' }}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            setShowUnassignedModal(false);
                            setParticipantToDelete(response);
                          }}
                          onMouseEnter={(e: React.MouseEvent) => { (e.target as HTMLElement).style.color = '#dc2626'; }}
                          onMouseLeave={(e: React.MouseEvent) => { (e.target as HTMLElement).style.color = '#9ca3af'; }}
                        />
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={styles.detailModalCardBody}>
                        {response.email && (
                          <div style={styles.detailModalField}>
                            <span style={styles.detailModalFieldLabel}>Email</span>
                            <span style={styles.detailModalFieldValue}>{response.email}</span>
                          </div>
                        )}
                        <div style={styles.detailModalField}>
                          <span style={styles.detailModalFieldLabel}>Preferences</span>
                          {timings.map((timing, index) => (
                            <div key={index} style={styles.detailModalPreferenceCard}>
                              <div style={styles.detailModalPreferenceLabel}>
                                {index === 0 ? '1st Choice' : index === 1 ? '2nd Choice' : '3rd Choice'}
                              </div>
                              <div style={styles.detailModalPreferenceValue}>
                                {timing.day} {formatTime(timing.start)} - {formatTime(timing.end)}
                                {timing.duration && ` (${timing.duration} min)`}
                                <br />
                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formatFrequency(timing.frequency)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setShowUnassignedModal(false);
                            setResponseToView(response);
                          }}
                          style={{ marginTop: '1rem', width: '100%', padding: '0.625rem', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}
                        >
                          View Full Details
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
            <div style={{ ...getLessonBlockStyle(entry), opacity: 0.7, cursor: 'grabbing', zIndex: 9999 }}>
              <div style={{ fontWeight: '600' }}>{entry.student_name}</div>
              <div style={{ fontSize: '0.625rem', opacity: 0.9 }}>
                {formatLocalTime(entry.start_time)} - {formatLocalTime(entry.end_time)}
              </div>
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
    </div>
  );
}
