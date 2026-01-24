// src/components/CreateScheduleModal.tsx
import { useState } from 'react';
import Modal from './Modal';
import { createSchedule, type CreateScheduleInput } from '../lib/api/schedules';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

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
  input: {
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  helpText: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
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
    flex: 1,
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
  error: {
    padding: '0.75rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '0.5rem',
    color: '#991b1b',
    fontSize: '0.875rem',
  },
};

export default function CreateScheduleModal({ isOpen, onClose, onSuccess }: CreateScheduleModalProps) {
  const [formData, setFormData] = useState<CreateScheduleInput>({
    label: '',
    start_date: '',
    end_date: '',
    working_hours_start: 8,
    working_hours_end: 21,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if ((formData.working_hours_start ?? 8) >= (formData.working_hours_end ?? 21)) {
        throw new Error('Day start must be before day end');
      }
      await createSchedule(formData);
      onSuccess();
      onClose();
      // Reset form
      setFormData({ label: '', start_date: '', end_date: '', working_hours_start: 8, working_hours_end: 21 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ label: '', start_date: '', end_date: '', working_hours_start: 8, working_hours_end: 21 });
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Schedule">
      <form onSubmit={handleSubmit} style={styles.form}>
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <div style={styles.formGroup}>
          <label htmlFor="label" style={styles.label}>
            Schedule Name *
          </label>
          <input
            id="label"
            type="text"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            placeholder="e.g., Fall 2026 Team Appointments"
            required
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#f97316'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          />
          <p style={styles.helpText}>A descriptive name for this schedule</p>
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="start_date" style={styles.label}>
            Start Date *
          </label>
          <input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#f97316'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          />
          <p style={styles.helpText}>When this schedule begins</p>
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="end_date" style={styles.label}>
            End Date *
          </label>
          <input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#f97316'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          />
          <p style={styles.helpText}>When this schedule ends</p>
        </div>

        <div style={{ ...styles.formGroup, backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
          <label style={{ ...styles.label, color: '#f97316', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Operating Hours
          </label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="start_hour" style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Start Time</label>
              <select
                id="start_hour"
                value={formData.working_hours_start}
                onChange={(e) => setFormData({ ...formData, working_hours_start: parseInt(e.target.value) })}
                style={{ ...styles.select, width: '100%', padding: '0.5rem' }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: '1rem', color: '#9ca3af', paddingTop: '1rem' }}>to</div>
            <div style={{ flex: 1 }}>
              <label htmlFor="end_hour" style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>End Time</label>
              <select
                id="end_hour"
                value={formData.working_hours_end}
                onChange={(e) => setFormData({ ...formData, working_hours_end: parseInt(e.target.value) })}
                style={{ ...styles.select, width: '100%', padding: '0.5rem' }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p style={{ ...styles.helpText, fontSize: '0.7rem' }}>Restrict schedule grid and event choices to this time range.</p>
        </div>

        <div style={styles.buttonGroup}>
          <button
            type="button"
            onClick={handleClose}
            style={{ ...styles.button, ...styles.secondaryButton }}
            disabled={loading}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ ...styles.button, ...styles.primaryButton }}
            disabled={loading}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#ea580c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
          >
            {loading ? 'Creating...' : 'Create Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
