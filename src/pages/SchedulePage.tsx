// src/pages/SchedulePage.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Users, ChevronLeft, ChevronRight, Trash2, Copy, Check } from 'lucide-react';
import { getSchedule, updateSchedule, type Schedule } from '../lib/api/schedules';
import { getScheduleEntries, createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, deleteThisAndSubsequentEntries, getEntryExceptions, type ScheduleEntry } from '../lib/api/schedule-entries';
import { getFormResponses, deleteFormResponse, type FormResponse } from '../lib/api/form-responses';
import AddEventModal from '../components/AddEventModal';
import Modal from '../components/Modal';
import AddParticipantModal from '../components/AddParticipantModal';
import ParticipantDetailsModal from '../components/ParticipantDetailsModal';
import SchedulingPreviewModal from '../components/SchedulingPreviewModal';
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 9 PM

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
  logo: {
    height: '32px',
    width: 'auto',
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
    minHeight: '40px',
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
  // Sensor configuration - must be inside component
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
  const [exceptions, setExceptions] = useState<Record<string, string[]>>({}); // entryId -> array of exception dates
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; hour: number } | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
   
  // Participant modal states
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<FormResponse | null>(null);
  const [participantToDelete, setParticipantToDelete] = useState<FormResponse | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);
  
  // Scheduling preview modal state
  const [showSchedulingPreview, setShowSchedulingPreview] = useState(false);
  
  // Inline editing states
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

  // Get user's local timezone abbreviation (e.g., EST, PST)
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userTimezoneAbbrev = new Date().toLocaleString('en-US', { 
    timeZone: userTimezone,
    timeZoneName: 'short' 
  }).split(' ').pop() || userTimezone;

  // Calculate week dates based on schedule start date and current offset
  const { weekStart, weekEnd, weekNumber, totalWeeks } = useMemo(() => {
    if (!schedule) return { weekStart: null, weekEnd: null, weekNumber: 0, totalWeeks: 0 };
    
    const start = new Date(schedule.start_date);
    const end = new Date(schedule.end_date);
    
    // Calculate total weeks
    const totalMs = end.getTime() - start.getTime();
    const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
    const total = Math.ceil(totalDays / 7);
    
    // Calculate current week start (schedule start + 7 days * offset)
    const weekStartDate = new Date(start);
    weekStartDate.setDate(start.getDate() + (currentWeekOffset * 7));
    
    // Calculate week end (week start + 6 days)
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    
    return {
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      weekNumber: currentWeekOffset + 1,
      totalWeeks: total
    };
  }, [schedule, currentWeekOffset]);

  // Format date in user's local timezone
  const formatLocalDate = (date: Date) => {
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      timeZone: userTimezone 
    });
  };

  // Format time in user's local timezone
  const formatLocalTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: userTimezone 
    });
  };

   // Check if an entry should appear in the current week based on recurrence rule
   const isEntryInCurrentWeek = (entry: ScheduleEntry): boolean => {
     if (!weekStart) return false;
     
     const entryStart = new Date(entry.start_time);
     const entryDay = entryStart.getDay(); // 0-6
     const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][entryDay];
     
      // Parse recurrence rule
      const rule = entry.recurrence_rule || '';
      const freqMatch = rule.match(/FREQ=(\w+)/);
      const byDayMatch = rule.match(/BYDAY=([^;]+)/);
      const bySetPosMatch = rule.match(/BYSETPOS=([^;]+)/);
      const intervalMatch = rule.match(/INTERVAL=(\d+)/);
      
      const freq = freqMatch ? freqMatch[1] : 'WEEKLY';
      const byDay = byDayMatch ? byDayMatch[1] : dayAbbrev;
      const bySetPos = bySetPosMatch ? parseInt(bySetPosMatch[1]) : null;
      const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
     
     // Check if the entry's day matches
     if (!byDay.includes(dayAbbrev)) return false;
     
     // "Once" frequency (empty rule) - only show in the week containing the original date
     if (!rule) {
       // Get the entry's actual week start (Sunday)
       const entryWeekStart = new Date(entryStart);
       entryWeekStart.setDate(entryStart.getDate() - entryStart.getDay());
       entryWeekStart.setHours(0, 0, 0, 0);
       
       // Get the current view's week start (Sunday)
       const currentViewWeekStart = new Date(weekStart);
       currentViewWeekStart.setHours(0, 0, 0, 0);
       
       return entryWeekStart.getTime() === currentViewWeekStart.getTime();
     }
     
     // Calculate which week this entry originally falls on
     const scheduleStart = schedule ? new Date(schedule.start_date) : weekStart;
     const entryWeekStart = new Date(scheduleStart);
     entryWeekStart.setDate(scheduleStart.getDate() + (currentWeekOffset * 7));
     
     // Get the day index for this entry
     const entryDayIndex = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(dayAbbrev);
     
     // Find the first occurrence of this day in the current view week
     const viewWeekFirstDay = weekStart.getDay();
     let daysToAdd = entryDayIndex - viewWeekFirstDay;
     if (daysToAdd < 0) daysToAdd += 7;
     
     const occurrenceDate = new Date(weekStart);
     occurrenceDate.setDate(weekStart.getDate() + daysToAdd);
     
     // Calculate the week number of this occurrence relative to schedule start
     const scheduleFirstDay = new Date(scheduleStart);
     scheduleFirstDay.setDate(scheduleStart.getDate() - scheduleStart.getDay()); // Start of first week
     
     const weeksSinceStart = Math.floor((occurrenceDate.getTime() - scheduleFirstDay.getTime()) / (7 * 24 * 60 * 60 * 1000));
     
     // Apply frequency rules
      if (freq === 'WEEKLY') {
        return weeksSinceStart % interval === 0; // Show every N weeks based on interval
      } else if (freq === '2WEEKLY') {
        return weeksSinceStart % 2 === 0; // Show every other week (even weeks)
      } else if (freq === 'MONTHLY') {
        // Legacy: For monthly, check if this is the Nth occurrence of the day in the month
        if (bySetPos) {
          const monthStart = new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth(), 1);
          const monthEnd = new Date(occurrenceDate.getFullYear(), occurrenceDate.getMonth() + 1, 0);
          
          // Find all occurrences of this day in the month
          let occurrenceCount = 0;
          for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === entryDayIndex) {
              occurrenceCount++;
              if (d.getTime() === occurrenceDate.getTime()) {
                break;
              }
            }
          }
          return occurrenceCount === bySetPos;
        }
        return true;
      }
     
     return true;
   };

  // Navigate weeks
  const goToPreviousWeek = () => {
    setCurrentWeekOffset(prev => Math.max(0, prev - 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekOffset(prev => Math.min(totalWeeks - 1, prev + 1));
  };

  // Name editing handlers
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

  // Date editing handlers
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
    
    // Check if end date is before start date
    if (editingEndDate && e.target.value > editingEndDate) {
      setDateError('End date must be after start date');
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingEndDate(e.target.value);
    setDateError(null);
    
    // Check if end date is before start date
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
      
      // Load schedule and entries first (required)
      const [scheduleData, entriesData] = await Promise.all([
        getSchedule(scheduleId),
        getScheduleEntries(scheduleId)
      ]);
      
      console.log('loadScheduleData - entries fetched:', entriesData.length);
      entriesData.forEach(e => console.log(' -', e.student_name, e.id, e.start_time));
      
      setSchedule(scheduleData);
      setEntries(entriesData);
      
      // Fetch exceptions for each entry
      const exceptionsMap: Record<string, string[]> = {};
      for (const entry of entriesData) {
        const exc = await getEntryExceptions(entry.id);
        if (exc.length > 0) {
          exceptionsMap[entry.id] = exc;
          console.log(' - Exceptions for', entry.student_name + ':', exc);
        }
      }
      setExceptions(exceptionsMap);
      
      // Try to load form responses (optional - may fail if table doesn't exist yet)
      try {
        const responsesData = await getFormResponses(scheduleId);
        setResponses(responsesData);
      } catch (err) {
        console.warn('Could not load form responses:', err);
        // It's okay if this fails - the form feature may not be set up yet
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

  // Helper to get unassigned students (responses without matching entries)
  const getUnassignedStudents = () => {
    const assignedNames = entries.map(e => e.student_name.toLowerCase());
    return responses.filter(r => !assignedNames.includes(r.student_name.toLowerCase()));
  };

  // Handle time slot click (for adding new event)
  const handleSlotClick = (day: string, hour: number) => {
    setSelectedSlot({ day, hour });
    setSelectedEntry(null); // Clear any existing entry selection
    setShowAddModal(true);
  };

  // Handle lesson block click (for editing existing event)
  const handleEntryClick = (entry: ScheduleEntry, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent slot click from firing
    setSelectedEntry(entry);
    setSelectedSlot(null); // Clear slot selection
    setShowAddModal(true);
  };

  // Handle successful lesson creation/update
  const handleEventSaved = () => {
    loadScheduleData(); // Refresh the schedule data
  };

  // Handle status change
  const handleStatusChange = async (newStatus: 'draft' | 'collecting' | 'archived' | 'trashed') => {
    if (!scheduleId) return;
    
    try {
      await updateSchedule(scheduleId, { status: newStatus });
      loadScheduleData(); // Refresh to show new status
    } catch (err) {
      console.error('Failed to update status:', err);
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setIsDragging(false);

    if (!over || !schedule) return;

    const dropId = over.id as string;
    
    // Check if dragging an unassigned card
    if (typeof active.id === 'string' && active.id.startsWith('unassigned-')) {
      const responseId = active.id.replace('unassigned-', '');
      const response = responses.find(r => r.id === responseId);
      
      if (!response || !dropId.startsWith('slot-')) return;
      
      // Dropped unassigned card on empty slot - create new entry
      const [, day, hourStr] = dropId.split('-');
      const hour = parseInt(hourStr);
      
      // Calculate times
      const scheduleStart = new Date(schedule.start_date);
      const dayIndex = DAYS.indexOf(day);
      const currentDay = scheduleStart.getDay();
      let daysToAdd = dayIndex - currentDay;
      if (daysToAdd < 0) daysToAdd += 7;
      
      const firstOccurrence = new Date(scheduleStart);
      firstOccurrence.setDate(scheduleStart.getDate() + daysToAdd);
      firstOccurrence.setHours(hour, 0, 0, 0);
      
      // Use the first preferred timing to determine duration
      const preferredStart = response.preferred_1_start;
      const preferredEnd = response.preferred_1_end;
      
      if (preferredStart && preferredEnd) {
        const [startH, startM] = preferredStart.split(':').map(Number);
        const [endH, endM] = preferredEnd.split(':').map(Number);
        const durationMs = (endH * 60 + endM) - (startH * 60 + startM);
        
        const newEnd = new Date(firstOccurrence.getTime() + durationMs * 60 * 1000);
        
        // Check for overlaps
        const overlappingEntry = entries.find(entry => {
          const entryStart = new Date(entry.start_time);
          const entryEnd = new Date(entry.end_time);
          
          if (entryStart.getDay() !== dayIndex) return false;
          
          return (firstOccurrence < entryEnd && newEnd > entryStart);
        });
        
        if (overlappingEntry) {
          alert(`Cannot schedule - slot conflicts with "${overlappingEntry.student_name}" (${formatLocalTime(overlappingEntry.start_time)} - ${formatLocalTime(overlappingEntry.end_time)})`);
          return;
        }
        
        const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayIndex];
        const frequency = response.preferred_1_frequency || 'weekly';
        const recurrenceRule = frequency === 'once' ? '' : 
          frequency === '2weekly' ? `FREQ=2WEEKLY;BYDAY=${dayAbbrev}` :
          frequency === 'monthly' ? `FREQ=WEEKLY;INTERVAL=4;BYDAY=${dayAbbrev}` :
          `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
        
        try {
          // Create new entry
          const newEntry = await createScheduleEntry({
            schedule_id: scheduleId!,
            student_name: response.student_name,
            start_time: firstOccurrence.toISOString(),
            end_time: newEnd.toISOString(),
            recurrence_rule: recurrenceRule,
          });
          
          // Remove from unassigned
          setResponses(responses.filter(r => r.id !== responseId));
          
          // Add to entries
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
      // Dropped on empty slot
      const [, day, hourStr] = dropId.split('-');
      const hour = parseInt(hourStr);

      // Calculate new times
      const scheduleStart = new Date(schedule.start_date);
      const dayIndex = DAYS.indexOf(day);
      const currentDay = scheduleStart.getDay();
      let daysToAdd = dayIndex - currentDay;
      if (daysToAdd < 0) daysToAdd += 7;
      
      const firstOccurrence = new Date(scheduleStart);
      firstOccurrence.setDate(scheduleStart.getDate() + daysToAdd);
      firstOccurrence.setHours(hour, 0, 0, 0);

      const oldStart = new Date(draggedEntry.start_time);
      const oldEnd = new Date(draggedEntry.end_time);
      const durationMs = oldEnd.getTime() - oldStart.getTime();

      const newEnd = new Date(firstOccurrence.getTime() + durationMs);

      // Check for overlaps
      const overlappingEntry = entries.find(entry => {
        if (entry.id === draggedEntry.id) return false;
        
        const entryStart = new Date(entry.start_time);
        const entryEnd = new Date(entry.end_time);
        
        if (entryStart.getDay() !== dayIndex) return false;
        
        return (firstOccurrence < entryEnd && newEnd > entryStart);
      });

      if (overlappingEntry) {
        // Instead of blocking, offer to swap
        const confirmSwap = window.confirm(
          `"${draggedEntry.student_name}" conflicts with "${overlappingEntry.student_name}" (${formatLocalTime(overlappingEntry.start_time)} - ${formatLocalTime(overlappingEntry.end_time)}). Swap them?`
        );
        
        if (!confirmSwap) return;
        
        // Swap the two events
        const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayIndex];
        const draggedRule = draggedEntry.recurrence_rule;
        const draggedStart = draggedEntry.start_time;
        const draggedEnd = draggedEntry.end_time;
        
        try {
          // Update dragged entry to new slot
          setEntries(entries.map(e => {
            if (e.id === draggedEntry.id) {
              return {
                ...e,
                start_time: firstOccurrence.toISOString(),
                end_time: newEnd.toISOString(),
                recurrence_rule: `FREQ=WEEKLY;BYDAY=${dayAbbrev}`,
              };
            }
            if (e.id === overlappingEntry.id) {
              return {
                ...e,
                start_time: draggedStart,
                end_time: draggedEnd,
                recurrence_rule: draggedRule,
              };
            }
            return e;
          }));
          
          await updateScheduleEntry(draggedEntry.id, {
            start_time: firstOccurrence.toISOString(),
            end_time: newEnd.toISOString(),
            recurrence_rule: `FREQ=WEEKLY;BYDAY=${dayAbbrev}`,
          });
          
          await updateScheduleEntry(overlappingEntry.id, {
            start_time: draggedStart,
            end_time: draggedEnd,
            recurrence_rule: draggedRule,
          });
        } catch (err) {
          console.error('Failed to swap events:', err);
          alert('Failed to swap events');
          loadScheduleData();
        }
        return;
      }

      const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayIndex];
      const recurrenceRule = `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;

      // Optimistic update - update local state directly
      const updatedEntry = {
        ...draggedEntry,
        start_time: firstOccurrence.toISOString(),
        end_time: newEnd.toISOString(),
        recurrence_rule: recurrenceRule,
      };

      setEntries(entries.map(e => e.id === draggedEntry.id ? updatedEntry : e));

      try {
        await updateScheduleEntry(draggedEntry.id, {
          start_time: firstOccurrence.toISOString(),
          end_time: newEnd.toISOString(),
          recurrence_rule: recurrenceRule,
        });
      } catch (err) {
        console.error('Failed to move event:', err);
        alert('Failed to move event');
        loadScheduleData(); // Reload on error to restore state
      }
    } else if (dropId === 'trash') {
      // Dropped on trash - confirm and delete
      setEntryToDelete(draggedEntry);
    } else if (dropId.startsWith('entry-')) {
      // Dropped on another entry - offer to swap
      const targetEntryId = dropId.replace('entry-', '');
      const targetEntry = entries.find(e => e.id === targetEntryId);
      
      if (!targetEntry || targetEntry.id === draggedEntry.id) return;

      const confirmSwap = window.confirm(
        `Swap "${draggedEntry.student_name}" with "${targetEntry.student_name}"?`
      );

      if (!confirmSwap) return;

      try {
        // Swap times - optimistic update
        const draggedStart = draggedEntry.start_time;
        const draggedEnd = draggedEntry.end_time;
        const draggedRule = draggedEntry.recurrence_rule;

        const updatedDraggedEntry = {
          ...draggedEntry,
          start_time: targetEntry.start_time,
          end_time: targetEntry.end_time,
          recurrence_rule: targetEntry.recurrence_rule,
        };

        const updatedTargetEntry = {
          ...targetEntry,
          start_time: draggedStart,
          end_time: draggedEnd,
          recurrence_rule: draggedRule,
        };

        setEntries(entries.map(e => {
          if (e.id === draggedEntry.id) return updatedDraggedEntry;
          if (e.id === targetEntry.id) return updatedTargetEntry;
          return e;
        }));

        await updateScheduleEntry(draggedEntry.id, {
          start_time: targetEntry.start_time,
          end_time: targetEntry.end_time,
          recurrence_rule: targetEntry.recurrence_rule,
        });

        await updateScheduleEntry(targetEntry.id, {
          start_time: draggedStart,
          end_time: draggedEnd,
          recurrence_rule: draggedRule,
        });
      } catch (err) {
        console.error('Failed to swap events:', err);
        alert('Failed to swap events');
        loadScheduleData(); // Reload on error
      }
    }
   };

   // Helper to calculate lesson block height and position
   const getLessonBlockStyle = (entry: ScheduleEntry) => {
     const startTime = new Date(entry.start_time);
     const endTime = new Date(entry.end_time);
     
     const startMinutes = startTime.getMinutes();
     const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
     
     const topOffset = (startMinutes / 60) * 40; // 40px per hour
     const height = (durationMinutes / 60) * 40;
     
     return {
       ...styles.lessonBlock,
       top: `${topOffset}px`,
       height: `${height}px`,
     };
    };

    const getEntriesForSlot = (day: string, hour: number) => {
      return entries.filter(entry => {
        // First check if entry should appear in current week based on recurrence
        if (!isEntryInCurrentWeek(entry)) return false;
        
        const startTime = new Date(entry.start_time);
        const dayOfWeek = startTime.getDay(); // 0 = Sunday, 1 = Monday, ...
        const dayIndex = DAYS.indexOf(day); // 0 = Sunday, 1 = Monday, ...
        
        if (dayOfWeek !== dayIndex || startTime.getHours() !== hour) return false;
        
        // Check if this specific occurrence date is an exception (should be hidden)
        const entryExceptions = exceptions[entry.id] || [];
        const occurrenceDate = startTime.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (entryExceptions.includes(occurrenceDate)) {
          console.log('Hiding', entry.student_name, 'on', occurrenceDate, '(exception)');
          return false; // Skip this occurrence
        }
        
        return true;
      });
    };

    // Draggable lesson block component
   function DraggableLessonBlock({ entry, children }: { entry: ScheduleEntry; children: React.ReactNode }) {
     const { attributes, listeners, setNodeRef } = useDraggable({
       id: entry.id,
       data: entry,
     });

     // Hide the original element while dragging, show ghost in DragOverlay instead
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

   // Draggable unassigned card component
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
           padding: '0.6rem 0.75rem',
           backgroundColor: isBeingDragged ? '#fbbf24' : '#fef3c7',
           borderRadius: '0.5rem',
           border: `1px solid ${isBeingDragged ? '#f59e0b' : '#fde68a'}`,
           fontSize: '0.875rem',
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'space-between',
           opacity: isBeingDragged ? 0.5 : 1,
           cursor: 'grab',
         }}
         {...attributes}
         {...listeners}
       >
         <div
           onClick={() => setSelectedParticipant(response)}
           style={{
             cursor: 'pointer',
             flex: 1,
           }}
         >
           <div style={{ fontWeight: '600', color: '#92400e' }}>
             {response.student_name}
           </div>
         </div>
         <Trash2
           size={16}
           style={{ color: '#9ca3af', cursor: 'pointer' }}
           onClick={(e) => {
             e.stopPropagation();
             setParticipantToDelete(response);
           }}
           onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
           onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
         />
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
          style={{
            ...styles.backButton,
            backgroundColor: '#f97316',
            color: 'white',
            borderColor: '#f97316',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
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
        autoScroll={false}
      >
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          {/* Left: Back button + Editable schedule name + Overall date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={styles.backButton}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <ArrowLeft size={18} />
              Back
            </button>
            
             {/* Name and date stacked vertically */}
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
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#f97316'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#111827'; }}
                >
                  {schedule.label}
                </h1>
              )}
              
              {/* Overall date range - below the name */}
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
                    style={{ cursor: 'pointer', color: '#6b7280' }}
                    onClick={handleDatesClick}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f97316'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
                  >
                    {schedule ? `${formatLocalDate(new Date(schedule.start_date))} - ${formatLocalDate(new Date(schedule.end_date))}` : ''}
                    <span style={{ marginLeft: '0.5rem', color: '#9ca3af', fontSize: '0.75rem' }}>
                      ({userTimezoneAbbrev})
                    </span>
                  </span>
                )}
              </span>
            </div>
          </div>
          
          {/* Center: Navigation + Date Range + Week */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column' as const,
            alignItems: 'center',
            flex: 1,
          }}>
            {/* Arrows close to date range with week below */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={goToPreviousWeek}
                disabled={currentWeekOffset === 0}
                style={{
                  ...styles.backButton,
                  opacity: currentWeekOffset === 0 ? 0.5 : 1,
                  cursor: currentWeekOffset === 0 ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => { if (currentWeekOffset > 0) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <ChevronLeft size={20} />
              </button>
              
              <div style={{ textAlign: 'center' }}>
                <p 
                  style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: '600', 
                    color: '#111827',
                    margin: 0,
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {weekStart && weekEnd ? `${formatLocalDate(weekStart)} - ${formatLocalDate(weekEnd)}` : ''}
                </p>
              </div>
              
              <button
                onClick={goToNextWeek}
                disabled={currentWeekOffset >= totalWeeks - 1}
                style={{
                  ...styles.backButton,
                  opacity: currentWeekOffset >= totalWeeks - 1 ? 0.5 : 1,
                  cursor: currentWeekOffset >= totalWeeks - 1 ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => { if (currentWeekOffset < totalWeeks - 1) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            
            {/* Week indicator below */}
            <span style={{ 
              marginTop: '0.35rem',
              fontSize: '0.85rem', 
              fontWeight: '500', 
              color: '#f97316',
            }}>
              Week {weekNumber} of {totalWeeks}
            </span>
          </div>
          
          {/* Right: Empty for balance */}
          <div style={{ width: '100px' }}></div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Timetable Grid */}
        <div style={styles.timetableContainer}>
          {/* Day Headers */}
          <div style={styles.timetableHeader}>
            <div style={styles.dayHeader}></div>
            {DAYS.map((day, index) => {
              const date = weekStart ? new Date(weekStart) : null;
              if (date) {
                date.setDate(date.getDate() + index);
              }
              const dateStr = date ? date.getDate() : '';
              return (
                <div key={day} style={styles.dayHeader}>
                  <span>{day}</span>
                  <span style={styles.dayHeaderDate}>{dateStr}</span>
                </div>
              );
            })}
          </div>

           {/* Time Grid */}
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

        {/* Side Panel */}
        <div style={styles.sidePanel}>
          {/* Schedule Info */}
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>
              <Calendar size={20} />
              Schedule Info
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.5rem' }}>Status:</span>
                <select
                  value={schedule.status}
                  onChange={(e) => handleStatusChange(e.target.value as any)}
                  style={styles.statusSelect}
                  onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.outline = 'none'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
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
                  {Math.ceil((new Date(schedule.end_date).getTime() - new Date(schedule.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7))} weeks
                </span>
              </div>
              
              {schedule.status === 'collecting' && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.5rem' }}>Form Link:</span>
                  <FormLink scheduleId={scheduleId!} />
                  
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={schedule.send_confirmation_email || false}
                        onChange={(e) => {
                          updateSchedule(scheduleId!, { send_confirmation_email: e.target.checked });
                          setSchedule({ ...schedule, send_confirmation_email: e.target.checked });
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#f97316' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#374151' }}>
                        Send confirmation emails
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Unassigned Events */}
          <div style={styles.panel}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.6rem' }}>
              <h3 style={{ ...styles.panelTitle, margin: 0 }}>
                <Users size={20} />
                Unassigned Events
                {getUnassignedStudents().length > 0 && (
                  <span style={{
                    marginLeft: '0.5rem',
                    backgroundColor: '#f97316',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}>
                    {getUnassignedStudents().length}
                  </span>
                )}
              </h3>
              {getUnassignedStudents().length > 0 && (
                <button
                  onClick={() => setShowSchedulingPreview(true)}
                  style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.35rem 0.6rem',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#16a34a'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#22c55e'; }}
                >
                  Schedule
                </button>
              )}
            </div>
            {getUnassignedStudents().length === 0 ? (
              <div style={styles.emptyState}>
                No unassigned events
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {getUnassignedStudents().map((response) => (
                  <DraggableUnassignedCard key={response.id} response={response} />
                ))}
              </div>
            )}
          </div>
          
          {/* Trash Zone */}
          <div style={styles.panel}>
            <TrashDroppable />
          </div>
        </div>
      </main>

      {/* Add/Edit Event Modal */}
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
        currentWeekStart={weekStart ? weekStart.toISOString() : undefined}
        existingEntry={selectedEntry}
      />

      {/* Add Participant Modal */}
      <AddParticipantModal
        isOpen={showAddParticipantModal}
        onClose={() => setShowAddParticipantModal(false)}
        onSuccess={(participant) => {
          setResponses([...responses, participant]);
        }}
        scheduleId={scheduleId!}
      />

      {/* Participant Details Modal */}
      {selectedParticipant && (
        <ParticipantDetailsModal
          isOpen={!!selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
          participant={selectedParticipant}
        />
      )}

      {/* Scheduling Preview Modal */}
      <SchedulingPreviewModal
        isOpen={showSchedulingPreview}
        onClose={() => setShowSchedulingPreview(false)}
        students={getUnassignedStudents()}
        existingEntries={entries}
        scheduleStart={weekStart || new Date()}
        scheduleId={scheduleId!}
        onScheduled={() => {
          loadScheduleData();
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!participantToDelete}
        onClose={() => setParticipantToDelete(null)}
        title="Delete Unassigned Event"
        maxWidth="30rem"
      >
        <div style={{ padding: '1rem 0' }}>
          <p style={{ color: '#374151', marginBottom: '1.5rem' }}>
            Delete <strong>{participantToDelete?.student_name}</strong> from unassigned events? This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setParticipantToDelete(null)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (participantToDelete) {
                  try {
                    await deleteFormResponse(participantToDelete.id);
                    setResponses(responses.filter(r => r.id !== participantToDelete.id));
                    setParticipantToDelete(null);
                  } catch (err) {
                    console.error('Failed to delete:', err);
                  }
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Schedule Entry Delete Confirmation Modal */}
      <Modal
        isOpen={!!entryToDelete}
        onClose={() => setEntryToDelete(null)}
        title="Delete Event"
        maxWidth="35rem"
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ color: '#374151', marginBottom: '1.25rem' }}>
            Delete <strong>{entryToDelete?.student_name}</strong>?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={async () => {
                if (!entryToDelete) return;
                const entryIdToDelete = entryToDelete.id;
                try {
                  await deleteScheduleEntry(entryIdToDelete);
                  // Force complete reload to ensure fresh data from server
                  setEntries([]);
                  await loadScheduleData();
                  setEntryToDelete(null);
                } catch (err) {
                  console.error('Failed to delete event:', err);
                  loadScheduleData();
                }
              }}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
            >
              <div style={{ fontWeight: '500' }}>This event only</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>Keep future occurrences</div>
            </button>
            <button
              onClick={async () => {
                if (!entryToDelete) return;
                try {
                  await deleteThisAndSubsequentEntries(entryToDelete.id, entryToDelete.start_time);
                  await loadScheduleData();
                  setEntryToDelete(null);
                } catch (err) {
                  console.error('Failed to delete events:', err);
                  loadScheduleData();
                }
              }}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
            >
              <div style={{ fontWeight: '500' }}>This and all future events</div>
              <div style={{ fontSize: '0.8rem', color: '#991b1b', marginTop: '0.25rem' }}>Delete the entire series</div>
            </button>
            <button
              onClick={() => setEntryToDelete(null)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                marginTop: '0.5rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Drag Overlay for smooth ghost */}
      <DragOverlay>
        {activeDragId && (() => {
          // Check if it's an unassigned card
          if (typeof activeDragId === 'string' && activeDragId.startsWith('unassigned-')) {
            const responseId = activeDragId.replace('unassigned-', '');
            const response = responses.find(r => r.id === responseId);
            if (!response) return null;
            return (
              <div style={{
                padding: '0.6rem 0.75rem',
                backgroundColor: '#fbbf24',
                borderRadius: '0.5rem',
                border: '1px solid #f59e0b',
                fontSize: '0.875rem',
                opacity: 0.7,
                cursor: 'grabbing',
                zIndex: 9999,
                position: 'fixed',
                pointerEvents: 'none',
              }}>
                <div style={{ fontWeight: '600', color: '#92400e' }}>
                  {response.student_name}
                </div>
              </div>
            );
          }
          
          // Regular schedule entry
          const entry = entries.find(e => e.id === activeDragId);
          if (!entry) return null;
          return (
            <div style={{
              ...getLessonBlockStyle(entry),
              opacity: 0.7,
              cursor: 'grabbing',
              zIndex: 9999,
              position: 'fixed',
              pointerEvents: 'none',
            }}>
              <div style={{ fontWeight: '600' }}>{entry.student_name}</div>
              <div style={{ fontSize: '0.625rem', opacity: 0.9 }}>
                {formatLocalTime(entry.start_time)}
                {' - '}
                {formatLocalTime(entry.end_time)}
              </div>
            </div>
          );
        })()}
      </DragOverlay>
      </DndContext>
    </div>
  );
}
