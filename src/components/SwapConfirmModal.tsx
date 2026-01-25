// src/components/SwapConfirmModal.tsx
// Modal for confirming event swap operations with visual preview

import { ArrowLeftRight } from 'lucide-react';

interface SwapEvent {
  id: string;
  student_name: string;
  start_time: string;
  day?: string; // Optional: display day name
  hour?: number; // Optional: display hour
}

interface SwapConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventA: SwapEvent | null;
  eventB: SwapEvent | null;
  isConflict?: boolean; // True if this is a conflict swap (drag to occupied slot)
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001, // Above other modals
    padding: '1rem',
    animation: 'fadeIn 0.15s ease-out',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    width: '100%',
    maxWidth: '400px',
    overflow: 'hidden',
    animation: 'slideUp 0.2s ease-out',
  },
  header: {
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-gray-200)',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--text-900)',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-500)',
    marginTop: '0.25rem',
  },
  content: {
    padding: '1.5rem',
  },
  swapPreview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
  },
  eventCard: {
    flex: 1,
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-orange-50)',
    border: '1px solid rgba(249, 115, 22, 0.2)',
    textAlign: 'center',
    minWidth: 0, // Allow flex shrink
  },
  eventName: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--text-900)',
    marginBottom: '0.25rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  eventTime: {
    fontSize: '0.75rem',
    color: 'var(--text-500)',
  },
  arrowContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    flexShrink: 0,
  },
  arrowIcon: {
    color: 'var(--brand-primary)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  arrowLabel: {
    fontSize: '0.625rem',
    fontWeight: 600,
    color: 'var(--brand-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  footer: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid var(--border-gray-200)',
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: 'none',
  },
  cancelButton: {
    backgroundColor: 'var(--bg-gray-50)',
    color: 'var(--text-600)',
    border: '1px solid var(--border-gray-200)',
  },
  confirmButton: {
    backgroundColor: 'var(--brand-primary)',
    color: 'white',
    boxShadow: 'var(--shadow-orange)',
  },
};

// Helper to format time from ISO string or hour number
function formatTime(startTime: string, hour?: number): string {
  if (hour !== undefined) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  }
  const date = new Date(startTime);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Helper to get day name from ISO string
function getDayName(startTime: string, day?: string): string {
  if (day) return day;
  const date = new Date(startTime);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export default function SwapConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  eventA,
  eventB,
  isConflict = false,
}: SwapConfirmModalProps) {
  if (!isOpen || !eventA || !eventB) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(10px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .swap-cancel-btn:hover {
            background-color: #e5e7eb !important;
          }
          .swap-confirm-btn:hover {
            background-color: var(--brand-accent) !important;
            transform: translateY(-1px);
          }
          .swap-confirm-btn:active {
            transform: translateY(0);
          }
        `}
      </style>
      <div
        style={styles.overlay}
        onClick={onClose}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-modal-title"
      >
        <div
          style={styles.modal}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={styles.header}>
            <h2 id="swap-modal-title" style={styles.title}>
              {isConflict ? 'Slot Conflict' : 'Swap Events'}
            </h2>
            <p style={styles.subtitle}>
              {isConflict
                ? 'This slot is occupied. Swap these events?'
                : 'Exchange positions of these two events?'}
            </p>
          </div>

          <div style={styles.content}>
            <div style={styles.swapPreview}>
              {/* Event A */}
              <div style={styles.eventCard}>
                <div style={styles.eventName} title={eventA.student_name}>
                  {eventA.student_name}
                </div>
                <div style={styles.eventTime}>
                  {getDayName(eventA.start_time, eventA.day)} • {formatTime(eventA.start_time, eventA.hour)}
                </div>
              </div>

              {/* Swap Arrow */}
              <div style={styles.arrowContainer}>
                <ArrowLeftRight size={24} style={styles.arrowIcon} />
                <span style={styles.arrowLabel}>Swap</span>
              </div>

              {/* Event B */}
              <div style={styles.eventCard}>
                <div style={styles.eventName} title={eventB.student_name}>
                  {eventB.student_name}
                </div>
                <div style={styles.eventTime}>
                  {getDayName(eventB.start_time, eventB.day)} • {formatTime(eventB.start_time, eventB.hour)}
                </div>
              </div>
            </div>
          </div>

          <div style={styles.footer}>
            <button
              className="swap-cancel-btn"
              style={{ ...styles.button, ...styles.cancelButton }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="swap-confirm-btn"
              style={{ ...styles.button, ...styles.confirmButton }}
              onClick={handleConfirm}
              autoFocus
            >
              Swap Events
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
