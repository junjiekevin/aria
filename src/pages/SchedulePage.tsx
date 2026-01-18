// src/pages/SchedulePage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Users } from 'lucide-react';
import { getSchedule, updateSchedule, type Schedule } from '../lib/api/schedules';
import { getScheduleEntries, updateScheduleEntry, deleteScheduleEntry, type ScheduleEntry } from '../lib/api/schedule-entries';
import { getFormResponses, type FormResponse } from '../lib/api/form-responses';
import AddEventModal from '../components/AddEventModal';
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
    overflow: 'hidden',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center' as const,
    maxHeight: '40px',
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; hour: number } | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  useEffect(() => {
    if (scheduleId) {
      loadScheduleData();
    }
  }, [scheduleId]);

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
      
      setSchedule(scheduleData);
      setEntries(entriesData);
      
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

    const draggedEntry = entries.find(e => e.id === active.id);
    if (!draggedEntry) return;

    // Parse the drop target (format: "slot-day-hour" or "entry-id")
    const dropId = over.id as string;
    
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
          `"${draggedEntry.student_name}" conflicts with "${overlappingEntry.student_name}" (${new Date(overlappingEntry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(overlappingEntry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). Swap them?`
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
      // Dragged to trash - delete event
      const confirmDelete = window.confirm(
        `Delete "${draggedEntry.student_name}"? This action cannot be undone.`
      );
      
      if (!confirmDelete) return;
      
      try {
        setEntries(entries.filter(e => e.id !== draggedEntry.id));
        await deleteScheduleEntry(draggedEntry.id);
      } catch (err) {
        console.error('Failed to delete event:', err);
        alert('Failed to delete event');
        loadScheduleData();
      }
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

  const getEntriesForSlot = (day: string, hour: number) => {
    return entries.filter(entry => {
      const startTime = new Date(entry.start_time);
      const dayOfWeek = startTime.getDay(); // 0 = Sunday, 1 = Monday, ...
      const dayIndex = DAYS.indexOf(day); // 0 = Sunday, 1 = Monday, ...
      
      return dayOfWeek === dayIndex && startTime.getHours() === hour;
    });
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={styles.backButton}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
            <div>
              <h1 style={styles.title}>{schedule.label}</h1>
              <p style={styles.subtitle}>
                {new Date(schedule.start_date).toLocaleDateString()} - {new Date(schedule.end_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Timetable Grid */}
        <div style={styles.timetableContainer}>
          {/* Day Headers */}
          <div style={styles.timetableHeader}>
            <div style={styles.dayHeader}></div>
            {DAYS.map((day) => (
              <div key={day} style={styles.dayHeader}>
                {day}
              </div>
            ))}
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
                          {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            </div>
          </div>

          {/* Unassigned Students */}
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>
              <Users size={20} />
              Unassigned Students
              {getUnassignedStudents().length > 0 && (
                <span style={{
                  marginLeft: 'auto',
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
            {getUnassignedStudents().length === 0 ? (
              <div style={styles.emptyState}>
                No student responses yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {getUnassignedStudents().map((response) => (
                  <div
                    key={response.id}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#fef3c7',
                      borderRadius: '0.5rem',
                      border: '1px solid #fde68a',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.25rem' }}>
                      {response.student_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#78350f' }}>
                      {response.email}
                    </div>
                  </div>
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
         existingEntry={selectedEntry}
      />

      {/* Drag Overlay for smooth ghost */}
      <DragOverlay>
        {activeDragId && (() => {
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
                {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })()}
      </DragOverlay>
      </DndContext>
    </div>
  );
}
