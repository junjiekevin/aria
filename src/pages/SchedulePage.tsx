// src/pages/SchedulePage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Users } from 'lucide-react';
import { getSchedule, updateSchedule, type Schedule } from '../lib/api/schedules';
import { getScheduleEntries, type ScheduleEntry } from '../lib/api/schedule-entries';
import { getFormResponses, type FormResponse } from '../lib/api/form-responses';
import AddEventModal from '../components/AddEventModal';

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
    padding: '1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    color: '#374151',
    transition: 'all 0.2s',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: '0.25rem 0 0 0',
  },
  main: {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '2rem',
  },
  timetableContainer: {
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  timetableHeader: {
    display: 'grid',
    gridTemplateColumns: '80px repeat(7, 1fr)',
    borderBottom: '2px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  dayHeader: {
    padding: '1rem',
    textAlign: 'center' as const,
    fontWeight: '600',
    fontSize: '0.875rem',
    color: '#374151',
    borderRight: '1px solid #e5e7eb',
  },
  timeLabel: {
    width: '80px',
    padding: '0.75rem',
    fontSize: '0.75rem',
    color: '#6b7280',
    textAlign: 'right' as const,
    borderRight: '1px solid #e5e7eb',
    borderBottom: '1px solid #f3f4f6',
  },
  timetableGrid: {
    display: 'grid',
    gridTemplateColumns: '80px repeat(7, 1fr)',
  },
  timeSlot: {
    minHeight: '60px',
    borderRight: '1px solid #e5e7eb',
    borderBottom: '1px solid #f3f4f6',
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
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    padding: '1.5rem',
  },
  panelTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 1rem 0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '2rem 1rem',
    color: '#6b7280',
    fontSize: '0.875rem',
  },
  lessonBlock: {
    position: 'absolute' as const,
    top: 0,
    left: '4px',
    right: '4px',
    backgroundColor: '#fb923c',
    color: 'white',
    borderRadius: '0.375rem',
    padding: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: '500',
    overflow: 'hidden',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.2s',
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
    
    const topOffset = (startMinutes / 60) * 60; // 60px per hour
    const height = (durationMinutes / 60) * 60;
    
    return {
      ...styles.lessonBlock,
      top: `${topOffset}px`,
      height: `${height}px`,
    };
  };

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
                  <div
                    key={`${day}-${hour}`}
                    style={styles.timeSlot}
                    onClick={() => handleSlotClick(day, hour)}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef3c7'; e.currentTarget.style.cursor = 'pointer'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                  >
                    {slotEntries.map((entry) => (
                      <div
                        key={entry.id}
                        style={getLessonBlockStyle(entry)}
                        onClick={(e) => handleEntryClick(entry, e)}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fb923c'; }}
                      >
                        <div style={{ fontWeight: '600' }}>{entry.student_name}</div>
                        <div style={{ fontSize: '0.625rem', opacity: 0.9 }}>
                          {new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {new Date(entry.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
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
        existingEntry={selectedEntry}
      />
    </div>
  );
}
