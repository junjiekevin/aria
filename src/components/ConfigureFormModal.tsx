// src/components/ConfigureFormModal.tsx
import { useState, useEffect } from 'react';
import { updateFormConfig, type Schedule } from '../lib/api/schedules';

interface ConfigureFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfigured: () => void;
    schedule: Schedule;
}

const styles: Record<string, React.CSSProperties> = {
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#374151',
    },
    hint: {
        fontSize: '0.75rem',
        color: '#6b7280',
        marginTop: '0.25rem',
    },
    input: {
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.5rem',
        fontSize: '1rem',
        fontFamily: 'inherit',
        transition: 'all 0.2s',
    },
    textarea: {
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.5rem',
        fontSize: '1rem',
        fontFamily: 'inherit',
        minHeight: '80px',
        resize: 'vertical',
        transition: 'all 0.2s',
    },
    dateInput: {
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.5rem',
        fontSize: '1rem',
        fontFamily: 'inherit',
        transition: 'all 0.2s',
        width: '100%',
    },
    radioGroup: {
        display: 'flex',
        gap: '1rem',
    },
    radioLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.375rem',
        border: '1px solid #e5e7eb',
        transition: 'all 0.2s',
    },
    radioLabelSelected: {
        backgroundColor: '#fff7ed',
        borderColor: '#f97316',
    },
    preview: {
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        padding: '1rem',
        border: '1px solid #e5e7eb',
    },
    previewTitle: {
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: '0.5rem',
    },
    previewItem: {
        fontSize: '0.875rem',
        color: '#374151',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
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
    error: {
        color: '#dc2626',
        fontSize: '0.875rem',
        padding: '0.75rem',
        backgroundColor: '#fef2f2',
        borderRadius: '0.5rem',
    },
};

export default function ConfigureFormModal({
    isOpen,
    onClose,
    onConfigured,
    schedule,
}: ConfigureFormModalProps) {
    const [maxChoices, setMaxChoices] = useState(3);
    const [instructions, setInstructions] = useState('');
    const [deadline, setDeadline] = useState('');
    const [workingHoursStart, setWorkingHoursStart] = useState(8);
    const [workingHoursEnd, setWorkingHoursEnd] = useState(21);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setMaxChoices(schedule.max_choices || 3);
            setInstructions(schedule.form_instructions || '');
            setDeadline(schedule.form_deadline || '');
            setWorkingHoursStart(schedule.working_hours_start ?? 8);
            setWorkingHoursEnd(schedule.working_hours_end ?? 21);
        }
    }, [isOpen, schedule]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (workingHoursStart >= workingHoursEnd) {
                throw new Error('Day start must be before day end');
            }
            await updateFormConfig(schedule.id, {
                max_choices: maxChoices,
                form_instructions: instructions || null,
                form_deadline: deadline || null,
                working_hours_start: workingHoursStart,
                working_hours_end: workingHoursEnd,
            });
            onConfigured();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to configure form');
        } finally {
            setLoading(false);
        }
    };

    const formatDeadline = (dateStr: string | null) => {
        if (!dateStr) return 'No deadline';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configure Form" maxWidth="40rem">
            <form onSubmit={handleSubmit} style={styles.form}>
                {error && <div style={styles.error}>{error}</div>}

                <div style={styles.formGroup}>
                    <label style={styles.label}>Form Title</label>
                    <input
                        type="text"
                        value={schedule.label}
                        disabled
                        style={{ ...styles.input, backgroundColor: '#f3f4f6', color: '#6b7280' }}
                    />
                    <div style={styles.hint}>The form automatically uses the schedule name</div>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Number of Preferred Timings</label>
                    <div style={styles.radioGroup}>
                        {[1, 2, 3].map((num) => (
                            <label
                                key={num}
                                style={{
                                    ...styles.radioLabel,
                                    ...(maxChoices === num ? styles.radioLabelSelected : {}),
                                }}
                            >
                                <input
                                    type="radio"
                                    name="maxChoices"
                                    value={num}
                                    checked={maxChoices === num}
                                    onChange={() => setMaxChoices(num)}
                                    style={{ accentColor: '#f97316' }}
                                />
                                {num} {num === 1 ? 'choice' : 'choices'}
                            </label>
                        ))}
                    </div>
                    <div style={styles.hint}>Participants will provide their top {maxChoices} preferred time slot{maxChoices !== 1 ? 's' : ''}</div>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Instructions (optional)</label>
                    <textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="Add any special instructions..."
                        style={styles.textarea}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#f97316';
                            e.target.style.outline = 'none';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#d1d5db';
                        }}
                    />
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>Deadline (optional)</label>
                    <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        style={styles.dateInput}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#f97316';
                            e.target.style.outline = 'none';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#d1d5db';
                        }}
                    />
                    <div style={styles.hint}>Form will close for submissions after this date</div>
                </div>

                <div style={{ ...styles.formGroup, backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
                    <label style={{ ...styles.label, color: '#f97316', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Operating Hours
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Start Time</label>
                            <select
                                value={workingHoursStart}
                                onChange={(e) => setWorkingHoursStart(parseInt(e.target.value))}
                                style={{ ...styles.input, width: '100%', padding: '0.5rem' }}
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
                            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>End Time</label>
                            <select
                                value={workingHoursEnd}
                                onChange={(e) => setWorkingHoursEnd(parseInt(e.target.value))}
                                style={{ ...styles.input, width: '100%', padding: '0.5rem' }}
                            >
                                {Array.from({ length: 24 }, (_, i) => (
                                    <option key={i} value={i}>
                                        {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <p style={{ ...styles.hint, fontSize: '0.7rem' }}>Adjusting operating hours will update the schedule grid and restrict future form submissions.</p>
                </div>

                <div style={styles.preview}>
                    <div style={styles.previewTitle}>Form Preview</div>
                    <div style={styles.previewItem}>
                        <span>•</span>
                        <strong>{schedule.label}</strong>
                    </div>
                    <div style={styles.previewItem}>
                        <span>•</span>
                        {maxChoices} preferred timing{maxChoices !== 1 ? 's' : ''} per student
                    </div>
                    {instructions && (
                        <div style={styles.previewItem}>
                            <span>•</span>
                            Custom instructions included
                        </div>
                    )}
                    <div style={styles.previewItem}>
                        <span>•</span>
                        Deadline: {formatDeadline(deadline || null)}
                    </div>
                    <div style={styles.previewItem}>
                        <span>•</span>
                        Hours: {workingHoursStart === 0 ? '12 AM' : workingHoursStart < 12 ? `${workingHoursStart} AM` : workingHoursStart === 12 ? '12 PM' : `${workingHoursStart - 12} PM`} - {workingHoursEnd === 0 ? '12 AM' : workingHoursEnd < 12 ? `${workingHoursEnd} AM` : workingHoursEnd === 12 ? '12 PM' : `${workingHoursEnd - 12} PM`}
                    </div>
                </div>

                <div style={styles.buttonGroup}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ ...styles.button, ...styles.secondaryButton }}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        style={{ ...styles.button, ...styles.primaryButton }}
                        disabled={loading}
                        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#ea580c'; }}
                        onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#f97316'; }}
                    >
                        {loading ? 'Activating...' : 'Save & Activate Form'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

import Modal from './Modal';
