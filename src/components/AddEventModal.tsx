// src/components/AddEventModal.tsx
import { useState, useEffect } from 'react';
import { createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, getScheduleEntries, type ScheduleEntry } from '../lib/api/schedule-entries';
import Modal from './Modal';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scheduleId: string;
  initialDay?: string; // e.g., "Monday"
  initialHour?: number; // e.g., 14 (for 2 PM)
  scheduleStartDate: string; // YYYY-MM-DD
  existingEntry?: ScheduleEntry | null; // If editing existing event
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#374151',
  },
  required: {
    color: '#dc2626',
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  select: {
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontFamily: 'inherit',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  button: {
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: 'none',
  },
  primaryButton: {
    backgroundColor: '#f97316',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    color: 'white',
  },
  errorText: {
    color: '#dc2626',
    fontSize: '0.875rem',
    marginTop: '0.25rem',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
};

export default function AddEventModal({
  isOpen,
  onClose,
  onSuccess,
  scheduleId,
  initialDay,
  initialHour,
  scheduleStartDate,
  existingEntry,
}: AddEventModalProps) {
  const isEditMode = !!existingEntry;
  
  const [studentName, setStudentName] = useState('');
  const [day, setDay] = useState(initialDay || 'Sunday');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('60'); // minutes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form when editing existing entry
  useEffect(() => {
    if (existingEntry && isOpen) {
      const startDate = new Date(existingEntry.start_time);
      const endDate = new Date(existingEntry.end_time);
      
      // Set name
      setStudentName(existingEntry.student_name);
      
      // Set day
      const dayOfWeek = startDate.getDay();
      setDay(DAYS[dayOfWeek]);
      
      // Set time
      const hours = startDate.getHours().toString().padStart(2, '0');
      const minutes = startDate.getMinutes().toString().padStart(2, '0');
      setStartTime(`${hours}:${minutes}`);
      
      // Calculate duration
      const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
      setDuration(durationMinutes.toString());
    }
  }, [existingEntry, isOpen]);

  // Pre-fill start time based on initialHour (for new entries)
  useEffect(() => {
    if (initialHour !== undefined && isOpen && !existingEntry) {
      const hour = initialHour.toString().padStart(2, '0');
      setStartTime(`${hour}:00`);
    }
  }, [initialHour, isOpen, existingEntry]);

  // Pre-fill day (for new entries)
  useEffect(() => {
    if (initialDay && isOpen && !existingEntry) {
      setDay(initialDay);
    }
  }, [initialDay, isOpen, existingEntry]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      if (!existingEntry) {
        setStudentName('');
        setDuration('60');
      }
      setError(null);
    }
  }, [isOpen, existingEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!studentName.trim()) {
      setError('Please enter a name');
      return;
    }

    if (!startTime) {
      setError('Please select a start time');
      return;
    }

    try {
      setLoading(true);

      // Calculate the time range for the new/updated event
      const scheduleStart = new Date(scheduleStartDate);
      const dayIndex = DAYS.indexOf(day);
      const dayOfWeek = dayIndex;
      const currentDay = scheduleStart.getDay();
      let daysToAdd = dayOfWeek - currentDay;
      if (daysToAdd < 0) daysToAdd += 7;
      
      const firstOccurrence = new Date(scheduleStart);
      firstOccurrence.setDate(scheduleStart.getDate() + daysToAdd);

      const [hours, minutes] = startTime.split(':').map(Number);
      firstOccurrence.setHours(hours, minutes, 0, 0);

      const endTime = new Date(firstOccurrence);
      endTime.setMinutes(endTime.getMinutes() + parseInt(duration));

      // Check for overlaps
      const allEntries = await getScheduleEntries(scheduleId);
      const overlappingEntry = allEntries.find(entry => {
        // Skip comparing with itself when editing
        if (isEditMode && existingEntry && entry.id === existingEntry.id) {
          return false;
        }

        const entryStart = new Date(entry.start_time);
        const entryEnd = new Date(entry.end_time);

        // Check if on same day of week
        if (entryStart.getDay() !== dayOfWeek) {
          return false;
        }

        // Check for any time overlap (partial or full)
        const hasOverlap = 
          (firstOccurrence < entryEnd && endTime > entryStart);

        return hasOverlap;
      });

      if (overlappingEntry) {
        const overlappingStart = new Date(overlappingEntry.start_time);
        const overlappingEnd = new Date(overlappingEntry.end_time);
        setError(
          `Time slot conflicts with "${overlappingEntry.student_name}" (${overlappingStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${overlappingEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). Please choose a different time.`
        );
        setLoading(false);
        return;
      }

      const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayOfWeek];
      const recurrenceRule = `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;

      if (isEditMode && existingEntry) {
        // UPDATE existing entry
        await updateScheduleEntry(existingEntry.id, {
          student_name: studentName.trim(),
          start_time: firstOccurrence.toISOString(),
          end_time: endTime.toISOString(),
          recurrence_rule: recurrenceRule,
        });
      } else {
        // CREATE new entry
        await createScheduleEntry({
          schedule_id: scheduleId,
          student_name: studentName.trim(),
          start_time: firstOccurrence.toISOString(),
          end_time: endTime.toISOString(),
          recurrence_rule: recurrenceRule,
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save event:', err);
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingEntry) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the event for "${existingEntry.student_name}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await deleteScheduleEntry(existingEntry.id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to delete event:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Event" : "Add Event"} maxWidth="40rem">
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Name */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Name <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Enter name"
            style={styles.input}
            onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.outline = 'none'; }}
            onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
            disabled={loading}
          />
        </div>

        {/* Day and Start Time */}
        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Day <span style={styles.required}>*</span>
            </label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              style={styles.select}
              onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.outline = 'none'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
              disabled={loading}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Start Time <span style={styles.required}>*</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={styles.input}
              onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.outline = 'none'; }}
              onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
              disabled={loading}
            />
          </div>
        </div>

        {/* Duration */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Duration <span style={styles.required}>*</span>
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={styles.select}
            onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.outline = 'none'; }}
            onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
            disabled={loading}
          >
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes (1 hour)</option>
            <option value="90">90 minutes (1.5 hours)</option>
            <option value="120">120 minutes (2 hours)</option>
          </select>
          <div style={styles.hint}>
            This event will repeat weekly on {day}s at {startTime || '--:--'}
          </div>
        </div>

        {/* Error Message */}
        {error && <div style={styles.errorText}>{error}</div>}

        {/* Action Buttons */}
        <div style={styles.buttonGroup}>
          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, ...styles.primaryButton, flex: 1 }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#ea580c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
          >
            {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Event' : 'Add Event')}
          </button>
          
          {isEditMode && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              style={{ ...styles.button, ...styles.deleteButton }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#b91c1c'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#dc2626'; }}
            >
              Delete
            </button>
          )}
          
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{ ...styles.button, ...styles.secondaryButton }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
