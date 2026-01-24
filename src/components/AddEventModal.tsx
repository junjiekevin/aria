import { useState, useEffect } from 'react';
import { createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, getScheduleEntries, type ScheduleEntry } from '../lib/api/schedule-entries';
import Modal from './Modal';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scheduleId: string;
  initialDay?: string;
  initialHour?: number;
  scheduleStartDate: string;
  existingEntry?: ScheduleEntry | null;
  onNeedDeleteConfirmation?: () => void;
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
  onNeedDeleteConfirmation,
}: AddEventModalProps) {
  const isEditMode = !!existingEntry;

  const [studentName, setStudentName] = useState('');
  const [day, setDay] = useState(initialDay || 'Sunday');
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [duration, setDuration] = useState('60');
  const [frequency, setFrequency] = useState('weekly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingEntry && isOpen) {
      const startDate = new Date(existingEntry.start_time);
      const endDate = new Date(existingEntry.end_time);

      setStudentName(existingEntry.student_name);

      const dayOfWeek = startDate.getDay();
      setDay(DAYS[dayOfWeek]);

      const hours = startDate.getHours().toString().padStart(2, '0');
      const minutes = startDate.getMinutes().toString().padStart(2, '0');
      setStartHour(hours);
      setStartMinute(minutes);

      const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
      setDuration(durationMinutes.toString());

      const rule = existingEntry.recurrence_rule || '';
      if (!rule) {
        setFrequency('once');
      } else if (rule.includes('INTERVAL=2')) {
        setFrequency('2weekly');
      } else if (rule.includes('FREQ=MONTHLY') || rule.includes('INTERVAL=4')) {
        setFrequency('monthly');
      } else {
        setFrequency('weekly');
      }
    }
  }, [existingEntry, isOpen]);

  useEffect(() => {
    if (initialHour !== undefined && isOpen && !existingEntry) {
      const hour = initialHour.toString().padStart(2, '0');
      setStartHour(hour);
      setStartMinute('00');
    }
  }, [initialHour, isOpen, existingEntry]);

  useEffect(() => {
    if (initialDay && isOpen && !existingEntry) {
      setDay(initialDay);
    }
  }, [initialDay, isOpen, existingEntry]);

  useEffect(() => {
    if (!isOpen) {
      if (!existingEntry) {
        setStudentName('');
        setDuration('60');
        setFrequency('weekly');
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

    if (!startHour || !startMinute) {
      setError('Please select a start time');
      return;
    }

    try {
      setLoading(true);

      const dayIndex = DAYS.indexOf(day);
      const dayOfWeek = dayIndex;
      const scheduleStart = new Date(scheduleStartDate);
      const currentDay = scheduleStart.getDay();
      let daysToAdd = dayOfWeek - currentDay;
      if (daysToAdd < 0) daysToAdd += 7;

      const firstOccurrence = new Date(scheduleStart);
      firstOccurrence.setDate(scheduleStart.getDate() + daysToAdd);

      const hours = parseInt(startHour);
      const minutes = parseInt(startMinute);
      firstOccurrence.setHours(hours, minutes, 0, 0);

      const endTime = new Date(firstOccurrence);
      endTime.setMinutes(endTime.getMinutes() + parseInt(duration));

      const allEntries = await getScheduleEntries(scheduleId);

      const overlappingEntry = allEntries.find(entry => {
        if (isEditMode && existingEntry && entry.id === existingEntry.id) {
          return false;
        }

        const entryStart = new Date(entry.start_time);
        const entryEnd = new Date(entry.end_time);

        if (entryStart.getDay() !== dayOfWeek) {
          return false;
        }

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

      let recurrenceRule = '';
      if (frequency === 'once') {
        recurrenceRule = '';
      } else if (frequency === '2weekly') {
        recurrenceRule = `FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayAbbrev}`;
      } else if (frequency === 'monthly') {
        recurrenceRule = `FREQ=WEEKLY;INTERVAL=4;BYDAY=${dayAbbrev}`;
      } else {
        recurrenceRule = `FREQ=WEEKLY;BYDAY=${dayAbbrev}`;
      }

      if (isEditMode && existingEntry) {
        await updateScheduleEntry(existingEntry.id, {
          student_name: studentName.trim(),
          start_time: firstOccurrence.toISOString(),
          end_time: endTime.toISOString(),
          recurrence_rule: recurrenceRule,
        });
      } else {
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

    // If recurring entry, show confirmation modal via callback
    if (existingEntry.recurrence_rule && existingEntry.recurrence_rule !== '' && onNeedDeleteConfirmation) {
      onNeedDeleteConfirmation();
      return;
    }

    // Otherwise delete immediately
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
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Participant Name <span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Enter name"
            style={styles.input}
            disabled={loading}
          />
        </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Day <span style={styles.required}>*</span>
            </label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              style={styles.select}
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                style={{ ...styles.select, flex: 1 }}
                disabled={loading}
              >
                {Array.from({ length: 14 }, (_, i) => i + 8).map((hour) => (
                  <option key={hour} value={hour.toString().padStart(2, '0')}>
                    {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </option>
                ))}
              </select>
              <select
                value={startMinute}
                onChange={(e) => setStartMinute(e.target.value)}
                style={{ ...styles.select, flex: 1, minWidth: '70px' }}
                disabled={loading}
              >
                <option value="00">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
              </select>
            </div>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Duration <span style={styles.required}>*</span>
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={styles.select}
              disabled={loading}
            >
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes (1 hour)</option>
              <option value="90">90 minutes (1.5 hours)</option>
              <option value="120">120 minutes (2 hours)</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Frequency <span style={styles.required}>*</span>
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              style={styles.select}
              disabled={loading}
            >
              <option value="once">Once</option>
              <option value="weekly">Weekly</option>
              <option value="2weekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        <div style={styles.hint}>
          {frequency === 'once'
            ? `This is a single event on ${day} at ${startHour}:${startMinute}`
            : `This event will repeat on ${day}s at ${startHour}:${startMinute}`}
        </div>

        {error && <div style={styles.errorText}>{error}</div>}

        <div style={styles.buttonGroup}>
          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, ...styles.primaryButton, flex: 1 }}
          >
            {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Event' : 'Add Event')}
          </button>

          {isEditMode && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              style={{ ...styles.button, ...styles.deleteButton }}
            >
              Delete
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{ ...styles.button, ...styles.secondaryButton }}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
