import { useState } from 'react';
import Modal from './Modal';
import { createFormResponse, type FormResponse } from '../lib/api/form-responses';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);
const FREQUENCIES = [
    { value: 'once', label: 'Once' },
    { value: 'weekly', label: 'Weekly' },
    { value: '2weekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Monthly' },
];

interface AddParticipantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (participant: FormResponse) => void;
    scheduleId: string;
}

interface TimingInput {
    day: string;
    startHour: string;
    startMinute: string;
    endHour: string;
    endMinute: string;
    frequency: string;
}

const EMPTY_TIMING: TimingInput = {
    day: 'Monday',
    startHour: '16',
    startMinute: '00',
    endHour: '17',
    endMinute: '00',
    frequency: 'weekly',
};

const styles = {
    form: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.25rem',
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
    },
    timingCard: {
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        padding: '1rem',
        border: '1px solid #e5e7eb',
    },
    timingTitle: {
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: '0.75rem',
    },
    timingRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0.5rem',
        marginBottom: '0.5rem',
    },
    timeSelects: {
        display: 'grid',
        gridTemplateColumns: 'auto auto auto auto',
        gap: '0.5rem',
        alignItems: 'end',
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
    errorText: {
        color: '#dc2626',
        fontSize: '0.875rem',
    },
    hint: {
        fontSize: '0.75rem',
        color: '#6b7280',
    },
};

function TimingFields({
    timing,
    onChange,
    timingNumber,
    isOptional,
    onRemove,
}: {
    timing: TimingInput;
    onChange: (update: Partial<TimingInput>) => void;
    timingNumber: number;
    isOptional: boolean;
    onRemove?: () => void;
}) {
    return (
        <div style={styles.timingCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={styles.timingTitle}>
                    Preferred Timing {timingNumber}
                    {isOptional && <span style={{ color: '#9ca3af' }}> (optional)</span>}
                </span>
                {isOptional && onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#6b7280',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                        }}
                    >
                        Remove
                    </button>
                )}
            </div>
            
            <div style={styles.formGroup}>
                <label style={styles.label}>Day</label>
                <select
                    value={timing.day}
                    onChange={(e) => onChange({ day: e.target.value })}
                    style={styles.select}
                >
                    {DAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
            </div>
            
            <div style={{ ...styles.formGroup, marginTop: '0.75rem' }}>
                <label style={styles.label}>Time</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <select
                        value={timing.startHour}
                        onChange={(e) => {
                            onChange({ startHour: e.target.value });
                            const start = parseInt(e.target.value);
                            const end = parseInt(timing.endHour);
                            if (end <= start) {
                                onChange({ endHour: (start + 1).toString() });
                            }
                        }}
                        style={styles.select}
                    >
                        {HOURS.map((hour) => (
                            <option key={hour} value={hour.toString()}>
                                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                            </option>
                        ))}
                    </select>
                    <span style={{ color: '#6b7280' }}>:</span>
                    <select
                        value={timing.startMinute}
                        onChange={(e) => onChange({ startMinute: e.target.value })}
                        style={{ ...styles.select, width: '60px' }}
                    >
                        <option value="00">00</option>
                        <option value="15">15</option>
                        <option value="30">30</option>
                        <option value="45">45</option>
                    </select>
                    <span style={{ color: '#6b7280' }}>to</span>
                    <select
                        value={timing.endHour}
                        onChange={(e) => onChange({ endHour: e.target.value })}
                        style={styles.select}
                    >
                        {HOURS.map((hour) => (
                            <option key={hour} value={hour.toString()}>
                                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                            </option>
                        ))}
                    </select>
                    <span style={{ color: '#6b7280' }}>:</span>
                    <select
                        value={timing.endMinute}
                        onChange={(e) => onChange({ endMinute: e.target.value })}
                        style={{ ...styles.select, width: '60px' }}
                    >
                        <option value="00">00</option>
                        <option value="15">15</option>
                        <option value="30">30</option>
                        <option value="45">45</option>
                    </select>
                </div>
            </div>
            
            <div style={{ ...styles.formGroup, marginTop: '0.75rem' }}>
                <label style={styles.label}>Frequency</label>
                <select
                    value={timing.frequency}
                    onChange={(e) => onChange({ frequency: e.target.value })}
                    style={styles.select}
                >
                    {FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

export default function AddParticipantModal({
    isOpen,
    onClose,
    onSuccess,
    scheduleId,
}: AddParticipantModalProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [timing1, setTiming1] = useState<TimingInput>(EMPTY_TIMING);
    const [timing2, setTiming2] = useState<TimingInput | null>(null);
    const [timing3, setTiming3] = useState<TimingInput | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setName('');
        setEmail('');
        setTiming1(EMPTY_TIMING);
        setTiming2(null);
        setTiming3(null);
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const formatTime = (hour: string, minute: string) => {
        return `${hour.padStart(2, '0')}:${minute}:00`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!name.trim()) {
            setError('Please enter a name');
            return;
        }

        // Check if timing 1 is valid
        const start1 = parseInt(timing1.startHour) * 60 + parseInt(timing1.startMinute);
        const end1 = parseInt(timing1.endHour) * 60 + parseInt(timing1.endMinute);
        if (end1 <= start1) {
            setError('Timing 1: End time must be after start time');
            return;
        }

        // Check timing 2 if provided
        if (timing2) {
            const start2 = parseInt(timing2.startHour) * 60 + parseInt(timing2.startMinute);
            const end2 = parseInt(timing2.endHour) * 60 + parseInt(timing2.endMinute);
            if (end2 <= start2) {
                setError('Timing 2: End time must be after start time');
                return;
            }
        }

        // Check timing 3 if provided
        if (timing3) {
            const start3 = parseInt(timing3.startHour) * 60 + parseInt(timing3.startMinute);
            const end3 = parseInt(timing3.endHour) * 60 + parseInt(timing3.endMinute);
            if (end3 <= start3) {
                setError('Timing 3: End time must be after start time');
                return;
            }
        }

        try {
            setLoading(true);

            const input: any = {
                schedule_id: scheduleId,
                student_name: name.trim(),
                preferred_1_day: timing1.day,
                preferred_1_start: formatTime(timing1.startHour, timing1.startMinute),
                preferred_1_end: formatTime(timing1.endHour, timing1.endMinute),
                preferred_1_frequency: timing1.frequency,
            };

            if (email.trim()) {
                input.email = email.trim();
            }

            if (timing2) {
                input.preferred_2_day = timing2.day;
                input.preferred_2_start = formatTime(timing2.startHour, timing2.startMinute);
                input.preferred_2_end = formatTime(timing2.endHour, timing2.endMinute);
                input.preferred_2_frequency = timing2.frequency;
            }

            if (timing3) {
                input.preferred_3_day = timing3.day;
                input.preferred_3_start = formatTime(timing3.startHour, timing3.startMinute);
                input.preferred_3_end = formatTime(timing3.endHour, timing3.endMinute);
                input.preferred_3_frequency = timing3.frequency;
            }

            const student = await createFormResponse(input);
            onSuccess(student);
            handleClose();
        } catch (err) {
            console.error('Failed to add student:', err);
            setError(err instanceof Error ? err.message : 'Failed to add student');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Add Student" maxWidth="45rem">
            <form onSubmit={handleSubmit} style={styles.form}>
                {/* Name */}
                <div style={styles.formGroup}>
                    <label style={styles.label}>
                        Name <span style={styles.required}>*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter name"
                        style={styles.input}
                        onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.outline = 'none'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
                        disabled={loading}
                    />
                </div>

                {/* Email */}
                <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter email (optional)"
                        style={styles.input}
                        onFocus={(e) => { e.target.style.borderColor = '#f97316'; e.target.style.outline = 'none'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
                        disabled={loading}
                    />
                </div>

                {/* Timing 1 (Required) */}
                <TimingFields
                    timing={timing1}
                    onChange={(update) => setTiming1({ ...timing1, ...update })}
                    timingNumber={1}
                    isOptional={false}
                />

                {/* Timing 2 (Optional) */}
                {timing2 ? (
                    <TimingFields
                        timing={timing2}
                        onChange={(update) => setTiming2({ ...timing2, ...update })}
                        timingNumber={2}
                        isOptional={true}
                        onRemove={() => setTiming3(null)}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setTiming3({ ...EMPTY_TIMING, day: timing1.day })}
                        style={{
                            background: 'none',
                            border: '1px dashed #d1d5db',
                            borderRadius: '0.5rem',
                            padding: '0.75rem',
                            color: '#6b7280',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                        }}
                    >
                        + Add Preferred Timing 2
                    </button>
                )}

                {/* Timing 3 (Optional) */}
                {timing3 && (
                    <TimingFields
                        timing={timing3}
                        onChange={(update) => setTiming3({ ...timing3, ...update })}
                        timingNumber={3}
                        isOptional={true}
                        onRemove={() => setTiming3(null)}
                    />
                )}

                {/* Error Message */}
                {error && <div style={styles.errorText}>{error}</div>}

                {/* Buttons */}
                <div style={styles.buttonGroup}>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{ ...styles.button, ...styles.primaryButton, flex: 1 }}
                        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#ea580c'; }}
                        onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#f97316'; }}
                    >
                        {loading ? 'Adding...' : 'Add Student'}
                    </button>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        style={{ ...styles.button, ...styles.secondaryButton }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </Modal>
    );
}
