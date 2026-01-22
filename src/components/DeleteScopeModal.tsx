import Modal from './Modal';
import { type ScheduleEntry } from '../lib/api/schedule-entries';

interface DeleteScopeModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: ScheduleEntry | null;
    onDelete: (scope: 'single' | 'future') => void;
}

const styles = {
    content: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.25rem',
    },
    infoSection: {
        padding: '1rem',
        backgroundColor: '#fef2f2',
        borderRadius: '0.5rem',
        border: '1px solid #fecaca',
    },
    studentName: {
        fontSize: '1.125rem',
        fontWeight: '600',
        color: '#991b1b',
        marginBottom: '0.25rem',
    },
    timeInfo: {
        fontSize: '0.875rem',
        color: '#7f1d1d',
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
    deleteButton: {
        backgroundColor: '#dc2626',
        color: 'white',
    },
    deleteFutureButton: {
        backgroundColor: '#ea580c',
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

export default function DeleteScopeModal({ isOpen, onClose, entry, onDelete }: DeleteScopeModalProps) {
    const [selectedScope, setSelectedScope] = useState<'single' | 'future'>('single');

    if (!entry) return null;

    const handleDelete = () => {
        onDelete(selectedScope);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Delete Event" maxWidth="40rem">
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
                            <div style={styles.optionTitle}>Delete this occurrence only</div>
                            <div style={styles.optionDescription}>
                                Removes only this specific instance from the schedule
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
                            <div style={styles.optionTitle}>Delete all future occurrences</div>
                            <div style={styles.optionDescription}>
                                Keeps this occurrence but removes the recurrence rule
                            </div>
                        </div>
                    </div>
                </div>

                <div style={styles.buttonGroup}>
                    <button
                        onClick={handleDelete}
                        style={{
                            ...styles.button,
                            ...(selectedScope === 'single' ? styles.deleteButton : styles.deleteFutureButton),
                        }}
                    >
                        {selectedScope === 'single' ? 'Delete This' : 'Delete Future'}
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
