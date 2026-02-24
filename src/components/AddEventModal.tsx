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
  workingHoursStart?: number;
  workingHoursEnd?: number;
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
  workingHoursStart,
  workingHoursEnd,
}: AddEventModalProps) {
  const isEditMode = !!existingEntry;

  const [studentName, setStudentName] = useState('');
  const [day, setDay] = useState(initialDay || 'Sunday');
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('10');
  const [endMinute, setEndMinute] = useState('00');
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

      const endHours = endDate.getHours().toString().padStart(2, '0');
      const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
      setEndHour(endHours);
      setEndMinute(endMinutes);

      // We no longer strictly enforce the previous duration state since it's now computed on the fly based on start/end.

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
      const nextHour = Math.min(initialHour + 1, workingHoursEnd ?? 21);
      setEndHour(nextHour.toString().padStart(2, '0'));
      setEndMinute('00');
    }
  }, [initialHour, isOpen, existingEntry, workingHoursEnd]);

  useEffect(() => {
    if (initialDay && isOpen && !existingEntry) {
      setDay(initialDay);
    }
  }, [initialDay, isOpen, existingEntry]);

  useEffect(() => {
    if (!isOpen) {
      if (!existingEntry) {
        setStudentName('');
        setEndHour('10');
        setEndMinute('00');
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

    if (!startHour || !startMinute || !endHour || !endMinute) {
      setError('Please select start and end times');
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

      const eHours = parseInt(endHour);
      const eMinutes = parseInt(endMinute);

      const endTime = new Date(firstOccurrence);
      endTime.setHours(eHours, eMinutes, 0, 0);

      if (endTime <= firstOccurrence) {
        setError('End time must be after start time');
        setLoading(false);
        return;
      }

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

  const handleStartTimeChange = (type: 'hour' | 'minute', value: string) => {
    // Calculate current duration before the change
    const currentStartMins = parseInt(startHour) * 60 + parseInt(startMinute);
    const currentEndMins = parseInt(endHour) * 60 + parseInt(endMinute);
    let durationMins = currentEndMins - currentStartMins;

    // Fallback to 60 mins if current duration is invalid (e.g. end < start)
    if (durationMins <= 0) durationMins = 60;

    // Apply the new start value
    let newStartHour = startHour;
    let newStartMinute = startMinute;
    if (type === 'hour') {
      newStartHour = value;
      setStartHour(value);
    } else {
      newStartMinute = value;
      setStartMinute(value);
    }

    // Calculate the new end time by adding the preserved duration
    const newStartMinsTotal = parseInt(newStartHour) * 60 + parseInt(newStartMinute);
    const newEndMinsTotal = newStartMinsTotal + durationMins;

    const computedEndHour = Math.floor(newEndMinsTotal / 60);
    const computedEndMinute = newEndMinsTotal % 60;

    // Cap the end time at the working hours end
    const maxEndHour = workingHoursEnd ?? 21;
    if (computedEndHour > maxEndHour || (computedEndHour === maxEndHour && computedEndMinute > 0)) {
      setEndHour(maxEndHour.toString().padStart(2, '0'));
      setEndMinute('00');
    } else {
      setEndHour(computedEndHour.toString().padStart(2, '0'));
      setEndMinute(computedEndMinute.toString().padStart(2, '0'));
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

        <div style={styles.row}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Start Time <span style={styles.required}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={startHour}
                onChange={(e) => handleStartTimeChange('hour', e.target.value)}
                style={{ ...styles.select, flex: 1 }}
                disabled={loading}
              >
                {Array.from({ length: (workingHoursEnd ?? 21) - (workingHoursStart ?? 8) }, (_, i) => i + (workingHoursStart ?? 8)).map((hour) => (
                  <option key={hour} value={hour.toString().padStart(2, '0')}>
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </option>
                ))}
              </select>
              <select
                value={startMinute}
                onChange={(e) => handleStartTimeChange('minute', e.target.value)}
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

          <div style={styles.formGroup}>
            <label style={styles.label}>
              End Time <span style={styles.required}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                style={{ ...styles.select, flex: 1 }}
                disabled={loading}
              >
                {Array.from({ length: (workingHoursEnd ?? 21) - (workingHoursStart ?? 8) + 1 }, (_, i) => i + (workingHoursStart ?? 8)).map((hour) => (
                  <option key={hour} value={hour.toString().padStart(2, '0')}>
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </option>
                ))}
              </select>
              <select
                value={endMinute}
                onChange={(e) => setEndMinute(e.target.value)}
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

        <div style={styles.hint}>
          {frequency === 'once'
            ? `This is a single event on ${day} from ${startHour}:${startMinute} to ${endHour}:${endMinute}`
            : `This event will repeat on ${day}s from ${startHour}:${startMinute} to ${endHour}:${endMinute}`}
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
