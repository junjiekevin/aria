// src/components/ViewScheduleModal.tsx
import Modal from './Modal';
import { type Schedule } from '../lib/api/schedules';
import { Calendar, Clock, Tag } from 'lucide-react';

interface ViewScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
}

const styles = {
  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  infoGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  value: {
    fontSize: '1rem',
    color: '#111827',
    fontWeight: '500',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.875rem',
    fontWeight: '500',
    width: 'fit-content',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#6b7280',
  },
  divider: {
    height: '1px',
    backgroundColor: '#e5e7eb',
    margin: '0.5rem 0',
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
  secondaryButton: {
    backgroundColor: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
  },
};

const statusConfig = {
  draft: {
    label: 'Draft',
    style: { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #f3e8a8' },
  },
  collecting: {
    label: 'Active',
    style: { backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' },
  },
  archived: {
    label: 'Archived',
    style: { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' },
  },
  trashed: {
    label: 'Trashed',
    style: { backgroundColor: '#fce7e7', color: '#991b1b', border: '1px solid #fca5a5' },
  },
};

export default function ViewScheduleModal({ isOpen, onClose, schedule }: ViewScheduleModalProps) {
  if (!schedule) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const config = statusConfig[schedule.status];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Details" maxWidth="40rem">
      <div style={styles.content}>
        {/* Schedule Name */}
        <div style={styles.infoGroup}>
          <div style={styles.label}>Schedule Name</div>
          <div style={styles.value}>{schedule.label}</div>
        </div>

        <div style={styles.divider} />

        {/* Status */}
        <div style={styles.infoGroup}>
          <div style={styles.label}>Status</div>
          <div style={{ ...styles.statusBadge, ...config.style }}>
            <Tag size={16} />
            {config.label}
          </div>
        </div>

        <div style={styles.divider} />

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={styles.infoGroup}>
            <div style={styles.label}>Start Date</div>
            <div style={styles.row}>
              <Calendar size={18} />
              <span style={styles.value}>{formatDate(schedule.start_date)}</span>
            </div>
          </div>

          <div style={styles.infoGroup}>
            <div style={styles.label}>End Date</div>
            <div style={styles.row}>
              <Calendar size={18} />
              <span style={styles.value}>{formatDate(schedule.end_date)}</span>
            </div>
          </div>
        </div>

        <div style={styles.divider} />

        {/* Created At */}
        <div style={styles.infoGroup}>
          <div style={styles.label}>Created</div>
          <div style={styles.row}>
            <Clock size={18} />
            <span style={styles.value}>{formatDate(schedule.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.buttonGroup}>
          <button
            onClick={onClose}
            style={{ ...styles.button, ...styles.secondaryButton }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
