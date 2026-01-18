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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createSchedule(formData);
      onSuccess();
      onClose();
      // Reset form
      setFormData({ label: '', start_date: '', end_date: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ label: '', start_date: '', end_date: '' });
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
            placeholder="e.g., Fall 2026 Piano Lessons"
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
