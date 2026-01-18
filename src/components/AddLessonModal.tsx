// src/components/AddLessonModal.tsx
import { useState, useEffect } from 'react';
import { createScheduleEntry } from '../lib/api/schedule-entries';
import Modal from './Modal';

interface AddLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scheduleId: string;
  initialDay?: string; // e.g., "Monday"
  initialHour?: number; // e.g., 14 (for 2 PM)
  scheduleStartDate: string; // YYYY-MM-DD
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

export default function AddLessonModal({
  isOpen,
  onClose,
  onSuccess,
  scheduleId,
  initialDay,
  initialHour,
  scheduleStartDate,
}: AddLessonModalProps) {
  const [studentName, setStudentName] = useState('');
  const [day, setDay] = useState(initialDay || 'Sunday');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('60'); // minutes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill start time based on initialHour
  useEffect(() => {
    if (initialHour !== undefined && isOpen) {
      const hour = initialHour.toString().padStart(2, '0');
      setStartTime(`${hour}:00`);
    }
  }, [initialHour, isOpen]);

  // Pre-fill day
  useEffect(() => {
    if (initialDay && isOpen) {
      setDay(initialDay);
    }
  }, [initialDay, isOpen]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStudentName('');
      setError(null);
      setDuration('60');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!studentName.trim()) {
      setError('Please enter a student name');
      return;
    }

    if (!startTime) {
      setError('Please select a start time');
      return;
    }

    try {
      setLoading(true);

      // Calculate the actual date for the first occurrence
      const scheduleStart = new Date(scheduleStartDate);
      const dayIndex = DAYS.indexOf(day);
      
      // dayIndex now matches JS day of week (0 = Sunday, 1 = Monday, etc.)
      const dayOfWeek = dayIndex;
      const currentDay = scheduleStart.getDay();
      let daysToAdd = dayOfWeek - currentDay;
      if (daysToAdd < 0) daysToAdd += 7;
      
      const firstOccurrence = new Date(scheduleStart);
      firstOccurrence.setDate(scheduleStart.getDate() + daysToAdd);

      // Set the time
      const [hours, minutes] = startTime.split(':').map(Number);
      firstOccurrence.setHours(hours, minutes, 0, 0);

      // Calculate end time
      const endTime = new Date(firstOccurrence);
      endTime.setMinutes(endTime.getMinutes() + parseInt(duration));

      // Create the recurrence rule (weekly on this day)
      const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayOfWeek];
      const recurrenceRule = `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;

      await createScheduleEntry({
        schedule_id: scheduleId,
        student_name: studentName.trim(),
        start_time: firstOccurrence.toISOString(),
        end_time: endTime.toISOString(),
        recurrence_rule: recurrenceRule,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create lesson:', err);
      setError(err instanceof Error ? err.message : 'Failed to create lesson');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Lesson" maxWidth="40rem">
      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Student Name */}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Student Name <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Enter student name"
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
            This lesson will repeat weekly on {day}s at {startTime || '--:--'}
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
            {loading ? 'Creating...' : 'Create Lesson'}
          </button>
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
