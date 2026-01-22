import Modal from './Modal';
import { type ScheduleEntry } from '../lib/api/schedule-entries';

interface EditScopeModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: ScheduleEntry | null;
    onApply: (scope: 'single' | 'future') => void;
}

const styles = {
    content: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.25rem',
    },
    infoSection: {
        padding: '1rem',
        backgroundColor: '#fff7ed',
        borderRadius: '0.5rem',
        border: '1px solid #fed7aa',
    },
    studentName: {
        fontSize: '1.125rem',
        fontWeight: '600',
        color: '#9a3412',
        marginBottom: '0.25rem',
    },
    timeInfo: {
        fontSize: '0.875rem',
        color: '#c2410c',
    },
    optionGroup: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.75rem',
    },
    option: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        border: '1px solid #e5e7eb',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    optionSelected: {
        backgroundColor: '#fff7ed',
        borderColor: '#f97316',
    },
    radioCircle: {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: '2px solid #d1d5db',
        flexShrink: 0,
        marginTop: '2px',
    },
    radioCircleSelected: {
        borderColor: '#f97316',
        backgroundColor: '#f97316',
    },
    optionText: {
        flex: 1,
    },
    optionTitle: {
        fontWeight: '600',
        fontSize: '0.9375rem',
        color: '#111827',
        marginBottom: '0.25rem',
    },
    optionDescription: {
        fontSize: '0.8125rem',
        color: '#6b7280',
    },
    buttonGroup: {
        display: 'flex',
        gap: '0.75rem',
        marginTop: '0.5rem',
    },
    button: {
        padding: '0.75rem 1.25rem',
        borderRadius: '0.5rem',
        fontSize: '0.9375rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: 'none',
        flex: 1,
    },
    applyButton: {
        backgroundColor: '#22c55e',
        color: 'white',
    },
    applyFutureButton: {
        backgroundColor: '#f97316',
        color: 'white',
    },
    cancelButton: {
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db',
    },
};

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDay(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function EditScopeModal({ isOpen, onClose, entry, onApply }: EditScopeModalProps) {
    const [selectedScope, setSelectedScope] = useState<'single' | 'future'>('single');

    if (!entry) return null;

    const handleApply = () => {
        onApply(selectedScope);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Apply Changes to" maxWidth="40rem">
            <div style={styles.content}>
                <div style={styles.infoSection}>
                    <div style={styles.studentName}>{entry.student_name}</div>
                    <div style={styles.timeInfo}>
                        {formatDay(entry.start_time)}, {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                    </div>
                </div>

                <div style={styles.optionGroup}>
                    <div
                        style={{
                            ...styles.option,
                            ...(selectedScope === 'single' ? styles.optionSelected : {}),
                        }}
                        onClick={() => setSelectedScope('single')}
                    >
                        <div style={{
                            ...styles.radioCircle,
                            ...(selectedScope === 'single' ? styles.radioCircleSelected : {}),
                        }} />
                        <div style={styles.optionText}>
                            <div style={styles.optionTitle}>Apply to this occurrence only</div>
                            <div style={styles.optionDescription}>
                                Changes will apply only to this specific instance
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            ...styles.option,
                            ...(selectedScope === 'future' ? styles.optionSelected : {}),
                        }}
                        onClick={() => setSelectedScope('future')}
                    >
                        <div style={{
                            ...styles.radioCircle,
                            ...(selectedScope === 'future' ? styles.radioCircleSelected : {}),
                        }} />
                        <div style={styles.optionText}>
                            <div style={styles.optionTitle}>Apply to all future occurrences</div>
                            <div style={styles.optionDescription}>
                                Keeps this occurrence, creates new recurring entry for future
                            </div>
                        </div>
                    </div>
                </div>

                <div style={styles.buttonGroup}>
                    <button
                        onClick={handleApply}
                        style={{
                            ...styles.button,
                            ...(selectedScope === 'single' ? styles.applyButton : styles.applyFutureButton),
                        }}
                    >
                        {selectedScope === 'single' ? 'Apply This' : 'Apply Future'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{ ...styles.button, ...styles.cancelButton }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>
    );
}

import { useState } from 'react';
