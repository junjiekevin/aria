// src/components/EditScheduleModal.tsx
import { useState, useEffect } from 'react';
import Modal from './Modal';
import { updateSchedule, type Schedule, type UpdateScheduleInput } from '../lib/api/schedules';

interface EditScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
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

export default function EditScheduleModal({ isOpen, onClose, schedule, onSuccess }: EditScheduleModalProps) {
  const [formData, setFormData] = useState<UpdateScheduleInput>({
    label: '',
    start_date: '',
    end_date: '',
    status: 'draft',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (schedule) {
      setFormData({
        label: schedule.label,
        start_date: schedule.start_date,
        end_date: schedule.end_date,
        status: schedule.status,
      });
    }
  }, [schedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule) return;

    setError(null);
    setLoading(true);

    try {
      await updateSchedule(schedule.id, formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!schedule) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit Schedule">
      <form onSubmit={handleSubmit} style={styles.form}>
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <div style={styles.formGroup}>
          <label htmlFor="edit-label" style={styles.label}>
            Schedule Name *
          </label>
          <input
            id="edit-label"
            type="text"
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            placeholder="e.g., Fall 2026 Piano Lessons"
            required
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#f97316'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="edit-start" style={styles.label}>
            Start Date *
          </label>
          <input
            id="edit-start"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#f97316'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="edit-end" style={styles.label}>
            End Date *
          </label>
          <input
            id="edit-end"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#f97316'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          />
        </div>

        <div style={styles.formGroup}>
          <label htmlFor="edit-status" style={styles.label}>
            Status
          </label>
          <select
            id="edit-status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            style={styles.select}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#f97316'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; }}
          >
            <option value="draft">Draft</option>
            <option value="collecting">Active (Collecting Responses)</option>
            <option value="archived">Archived</option>
          </select>
          <p style={styles.helpText}>
            {formData.status === 'draft' && 'Schedule is not yet active'}
            {formData.status === 'collecting' && 'Students can submit their preferences'}
            {formData.status === 'archived' && 'Schedule is completed and archived'}
          </p>
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
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
