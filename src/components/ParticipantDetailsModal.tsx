import Modal from './Modal';
import { getPreferredTimings, type FormResponse } from '../lib/api/form-responses';

function formatTime(timeStr: string) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    if (hour === 0) return '12:00 AM';
    if (hour === 12) return '12:00 PM';
    if (hour > 12) return `${hour - 12}:${minutes} PM`;
    return `${hour}:${minutes} AM`;
}

interface ParticipantDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    participant: FormResponse;
}

const styles = {
    content: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.25rem',
    },
    section: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.75rem',
        fontWeight: '500',
        color: '#6b7280',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    },
    value: {
        fontSize: '1rem',
        color: '#111827',
    },
    timingCard: {
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        padding: '1rem',
        border: '1px solid #e5e7eb',
    },
    timingHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
    },
    timingBadge: {
        backgroundColor: '#f97316',
        color: 'white',
        padding: '0.15rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.7rem',
        fontWeight: '600',
    },
    timingDetails: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.25rem',
        fontSize: '0.875rem',
        color: '#374151',
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
    secondaryButton: {
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db',
    },
};

function TimingDisplay({ timing, rank }: { timing: { day: string; start: string; end: string; frequency: string; duration?: number }; rank: number }) {
    const frequencyLabels: Record<string, string> = {
        once: 'Once',
        weekly: 'Weekly',
        '2weekly': 'Every 2 weeks',
        monthly: 'Monthly',
    };
    
    const durationLabel = timing.duration ? ` (${timing.duration} min)` : '';
    
    return (
        <div style={styles.timingCard}>
            <div style={styles.timingHeader}>
                <span style={styles.timingBadge}>Choice {rank}</span>
            </div>
            <div style={styles.timingDetails}>
                <div><strong>Day:</strong> {timing.day}</div>
                <div><strong>Time:</strong> {formatTime(timing.start)} - {formatTime(timing.end)}{durationLabel}</div>
                <div><strong>Frequency:</strong> {frequencyLabels[timing.frequency] || timing.frequency}</div>
            </div>
        </div>
    );
}

export default function ParticipantDetailsModal({
    isOpen,
    onClose,
    participant,
}: ParticipantDetailsModalProps) {
    const timings = getPreferredTimings(participant);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Participant Details" maxWidth="40rem">
            <div style={styles.content}>
                {/* Participant Info */}
                <div style={styles.section}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <div style={styles.label}>Name</div>
                            <div style={styles.value}>{participant.student_name}</div>
                        </div>
                        {participant.email && (
                            <div>
                                <div style={styles.label}>Email</div>
                                <div style={styles.value}>{participant.email}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Preferred Timings */}
                <div style={styles.section}>
                    <div style={styles.label}>Preferred Timings</div>
                    {timings.length === 0 ? (
                        <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
                            No preferred timings recorded
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {timings.map((timing, index) => (
                                <TimingDisplay
                                    key={index}
                                    timing={timing}
                                    rank={index + 1}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={styles.buttonGroup}>
                    <button
                        onClick={onClose}
                        style={{ ...styles.button, ...styles.secondaryButton, flex: 1 }}
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
