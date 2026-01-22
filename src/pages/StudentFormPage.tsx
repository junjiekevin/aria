import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { getSchedule, type Schedule } from '../lib/api/schedules';
import { createFormResponse, getFormResponses } from '../lib/api/form-responses';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);
const FREQUENCIES = [
    { value: 'weekly', label: 'Weekly' },
    { value: '2weekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Every 4 weeks' },
];

interface TimingSlot {
    day: string;
    startHour: string;
    startMinute: string;
    endHour: string;
    endMinute: string;
    frequency: string;
}

const EMPTY_TIMING: TimingSlot = {
    day: 'Monday',
    startHour: '09',
    startMinute: '00',
    endHour: '10',
    endMinute: '00',
    frequency: 'weekly',
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '2rem 1rem',
    },
    card: {
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
    },
    header: {
        backgroundColor: '#f97316',
        color: 'white',
        padding: '1.5rem',
    },
    scheduleName: {
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '0.25rem',
    },
    scheduleDates: {
        fontSize: '0.875rem',
        opacity: 0.9,
    },
    content: {
        padding: '1.5rem',
    },
    sectionTitle: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '1rem',
    },
    formGroup: {
        marginBottom: '1.25rem',
    },
    label: {
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#374151',
        marginBottom: '0.5rem',
    },
    input: {
        width: '100%',
        padding: '0.625rem 0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        boxSizing: 'border-box',
    },
    row: {
        display: 'flex',
        gap: '0.75rem',
    },
    select: {
        flex: 1,
        padding: '0.625rem 0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        backgroundColor: 'white',
    },
    timingCard: {
        backgroundColor: '#f9fafb',
        borderRadius: '0.75rem',
        padding: '1rem',
        marginBottom: '1rem',
    },
    timingHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
    },
    badge: {
        backgroundColor: '#f97316',
        color: 'white',
        padding: '0.25rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
    },
    error: {
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#dc2626',
        padding: '0.75rem',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
    },
    button: {
        width: '100%',
        padding: '0.875rem 1rem',
        backgroundColor: '#f97316',
        color: 'white',
        border: 'none',
        borderRadius: '0.5rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    loading: {
        textAlign: 'center',
        padding: '3rem',
        color: '#6b7280',
    },
    thankYou: {
        textAlign: 'center',
        padding: '2rem',
    },
    thankYouIcon: {
        width: '4rem',
        height: '4rem',
        backgroundColor: '#dcfce7',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1rem',
    },
    thankYouTitle: {
        fontSize: '1.5rem',
        fontWeight: '600',
        color: '#166534',
        marginBottom: '0.5rem',
    },
    thankYouText: {
        color: '#6b7280',
        marginBottom: '1.5rem',
    },
    copySection: {
        backgroundColor: '#f3f4f6',
        borderRadius: '0.5rem',
        padding: '1rem',
        marginTop: '1.5rem',
    },
    copyLabel: {
        fontSize: '0.75rem',
        color: '#6b7280',
        marginBottom: '0.5rem',
    },
    copyRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    copyInput: {
        flex: 1,
        padding: '0.5rem 0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '0.8rem',
        backgroundColor: 'white',
        color: '#6b7280',
    },
    copyButton: {
        padding: '0.5rem',
        backgroundColor: '#f97316',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
};

function formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TimingSelector({ 
    timing, 
    onChange, 
    index, 
    errors 
}: { 
    timing: TimingSlot; 
    onChange: (timing: TimingSlot) => void;
    index: number;
    errors: string[];
}) {
    const hasError = errors.length > 0;

    return (
        <div style={styles.timingCard}>
            <div style={styles.timingHeader}>
                <span style={styles.badge}>Choice {index + 1}</span>
            </div>
            
            <div style={styles.row}>
                <select
                    value={timing.day}
                    onChange={(e) => onChange({ ...timing, day: e.target.value })}
                    style={styles.select}
                >
                    {DAYS.map(day => (
                        <option key={day} value={day}>{day}</option>
                    ))}
                </select>
            </div>
            
            <div style={{ ...styles.row, marginTop: '0.75rem' }}>
                <select
                    value={timing.startHour}
                    onChange={(e) => onChange({ ...timing, startHour: e.target.value })}
                    style={styles.select}
                >
                    {HOURS.map(hour => (
                        <option key={hour} value={hour.toString().padStart(2, '0')}>
                            {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                        </option>
                    ))}
                </select>
                <span style={{ display: 'flex', alignItems: 'center', color: '#6b7280' }}>:</span>
                <select
                    value={timing.startMinute}
                    onChange={(e) => onChange({ ...timing, startMinute: e.target.value })}
                    style={styles.select}
                >
                    {['00', '15', '30', '45'].map(min => (
                        <option key={min} value={min}>{min}</option>
                    ))}
                </select>
                
                <span style={{ display: 'flex', alignItems: 'center', color: '#6b7280' }}>to</span>
                
                <select
                    value={timing.endHour}
                    onChange={(e) => onChange({ ...timing, endHour: e.target.value })}
                    style={styles.select}
                >
                    {HOURS.map(hour => (
                        <option key={hour} value={hour.toString().padStart(2, '0')}>
                            {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                        </option>
                    ))}
                </select>
                <span style={{ display: 'flex', alignItems: 'center', color: '#6b7280' }}>:</span>
                <select
                    value={timing.endMinute}
                    onChange={(e) => onChange({ ...timing, endMinute: e.target.value })}
                    style={styles.select}
                >
                    {['00', '15', '30', '45'].map(min => (
                        <option key={min} value={min}>{min}</option>
                    ))}
                </select>
            </div>
            
            <div style={{ marginTop: '0.75rem' }}>
                <select
                    value={timing.frequency}
                    onChange={(e) => onChange({ ...timing, frequency: e.target.value })}
                    style={styles.select}
                >
                    {FREQUENCIES.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                </select>
            </div>
            
            {hasError && (
                <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    {errors.map((err, i) => (
                        <div key={i}>{err}</div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function StudentFormPage() {
    const { scheduleId } = useParams<{ scheduleId: string }>();
    
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [copied, setCopied] = useState(false);
    const [formClosedDueToDeadline, setFormClosedDueToDeadline] = useState(false);
    
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [timing1, setTiming1] = useState<TimingSlot>({ ...EMPTY_TIMING, day: 'Monday' });
    const [timing2, setTiming2] = useState<TimingSlot>({ ...EMPTY_TIMING, day: 'Tuesday' });
    const [timing3, setTiming3] = useState<TimingSlot>({ ...EMPTY_TIMING, day: 'Wednesday' });
    
    const [formErrors, setFormErrors] = useState<string[]>([]);

    useEffect(() => {
        async function loadSchedule() {
            if (!scheduleId) return;
            
            try {
                const scheduleData = await getSchedule(scheduleId);
                setSchedule(scheduleData);
                
                // Check deadline
                if (scheduleData.form_deadline) {
                    const deadline = new Date(scheduleData.form_deadline);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    deadline.setHours(0, 0, 0, 0);
                    if (today > deadline) {
                        setFormClosedDueToDeadline(true);
                    }
                }
            } catch (err) {
                console.error('Failed to load schedule:', err);
                setError('Schedule not found');
            } finally {
                setLoading(false);
            }
        }
        
        loadSchedule();
    }, [scheduleId]);

    const formUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/form/${scheduleId}` 
        : '';

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(formUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const timesOverlap = (t1: TimingSlot, t2: TimingSlot): boolean => {
        if (t1.day !== t2.day) return false;
        
        const start1 = parseInt(t1.startHour) * 60 + parseInt(t1.startMinute);
        const end1 = parseInt(t1.endHour) * 60 + parseInt(t1.endMinute);
        const start2 = parseInt(t2.startHour) * 60 + parseInt(t2.startMinute);
        const end2 = parseInt(t2.endHour) * 60 + parseInt(t2.endMinute);
        
        return start1 < end2 && start2 < end1;
    };

    const validateForm = (): { errors: string[]; warnings: string[] } => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!firstName.trim()) errors.push('First name is required');
        if (!lastName.trim()) errors.push('Last name is required');
        if (!email.trim()) errors.push('Email is required');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Please enter a valid email address');
        }
        
        const maxChoices = schedule?.max_choices || 3;
        const timings = [timing1, timing2, timing3].slice(0, maxChoices);
        
        for (let i = 0; i < timings.length; i++) {
            const t = timings[i];
            const start = parseInt(t.startHour) * 60 + parseInt(t.startMinute);
            const end = parseInt(t.endHour) * 60 + parseInt(t.endMinute);
            
            if (start >= end) {
                errors.push(`Choice ${i + 1}: End time must be after start time`);
            }
            
            for (let j = i + 1; j < timings.length; j++) {
                if (timesOverlap(t, timings[j])) {
                    errors.push(`Choice ${i + 1} overlaps with Choice ${j + 1}`);
                }
            }
        }
        
        return { errors, warnings };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        const { errors } = validateForm();
        
        if (errors.length > 0) {
            setFormErrors(errors);
            setSubmitting(false);
            return;
        }
        
        if (!scheduleId || !schedule) return;
        
        setSubmitting(true);
        
        try {
            // Check for duplicates
            const existingResponses = await getFormResponses(scheduleId);
            
            // Block exact email match
            const emailDuplicate = existingResponses.find(r => 
                r.email.toLowerCase() === email.toLowerCase()
            );
            
            if (emailDuplicate) {
                setFormErrors(['A response with this email has already been submitted.']);
                setSubmitting(false);
                return;
            }
            
            // Warn about name match (but allow override)
            const nameMatch = existingResponses.find(r => 
                r.student_name.toLowerCase() === `${firstName} ${lastName}`.toLowerCase()
            );
            
            if (nameMatch) {
                // Show confirmation dialog
                const confirmSubmit = window.confirm(
                    `Someone with the name "${firstName} ${lastName}" has already submitted a response. ` +
                    `Is this a different person? Click OK to submit, or Cancel to go back.`
                );
                
                if (!confirmSubmit) {
                    setSubmitting(false);
                    return;
                }
            }
            
            const maxChoices = schedule.max_choices || 3;
            const timings = [timing1, timing2, timing3];
            
            const formData: any = {
                schedule_id: scheduleId,
                student_name: `${firstName} ${lastName}`,
                email: email.trim(),
            };
            
            // Add only the configured number of choices
            for (let i = 0; i < maxChoices; i++) {
                const t = timings[i];
                formData[`preferred_${i + 1}_day`] = t.day;
                formData[`preferred_${i + 1}_start`] = `${t.startHour}:${t.startMinute}`;
                formData[`preferred_${i + 1}_end`] = `${t.endHour}:${t.endMinute}`;
                formData[`preferred_${i + 1}_frequency`] = t.frequency;
            }
            
            await createFormResponse(formData);
            
            setSubmitted(true);
        } catch (err) {
            console.error('Failed to submit form:', err);
            setError('Failed to submit form. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={styles.loading}>Loading...</div>
                </div>
            </div>
        );
    }

    if (error && !schedule) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={{ ...styles.loading, color: '#dc2626' }}>
                        {error}
                    </div>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={styles.header}>
                        <div style={styles.scheduleName}>{schedule?.label}</div>
                        <div style={styles.scheduleDates}>
                            {schedule && `${formatDate(schedule.start_date)} - ${formatDate(schedule.end_date)}`}
                        </div>
                    </div>
                    <div style={styles.content}>
                        <div style={styles.thankYou}>
                            <div style={styles.thankYouIcon}>
                                <Check size={32} color="#16a34a" />
                            </div>
                            <div style={styles.thankYouTitle}>Response Received!</div>
                            <div style={styles.thankYouText}>
                                Thank you, {firstName}! Your preferred time slots have been submitted.
                                <br /><br />
                                If you need to make any changes, please contact the person who sent you this form link.
                            </div>
                        </div>
                        
                        <div style={styles.copySection}>
                            <div style={styles.copyLabel}>Share this form with others who need to submit their availability:</div>
                            <div style={styles.copyRow}>
                                <input
                                    readOnly
                                    value={formUrl}
                                    style={styles.copyInput}
                                />
                                <button
                                    onClick={copyToClipboard}
                                    style={styles.copyButton}
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <div style={styles.scheduleName}>{schedule?.label}</div>
                    <div style={styles.scheduleDates}>
                        {schedule && `${formatDate(schedule.start_date)} - ${formatDate(schedule.end_date)}`}
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} style={styles.content}>
                    {formClosedDueToDeadline && (
                        <div style={{ ...styles.error, backgroundColor: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e' }}>
                            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                                This form is closed. The deadline has passed.
                            </div>
                        </div>
                    )}
                    
                    {formErrors.length > 0 && (
                        <div style={styles.error}>
                            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                                {formErrors.map((err, i) => (
                                    <div key={i}>{err}</div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {error && (
                        <div style={styles.error}>
                            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>{error}</div>
                        </div>
                    )}
                    
                    {schedule?.form_instructions && (
                        <div style={{ 
                            backgroundColor: '#f0f9ff', 
                            border: '1px solid #bae6fd', 
                            borderRadius: '0.5rem', 
                            padding: '1rem',
                            marginBottom: '1.5rem',
                            fontSize: '0.875rem',
                            color: '#0369a1',
                        }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Instructions</div>
                            <div>{schedule.form_instructions}</div>
                        </div>
                    )}
                    
                    <div style={styles.sectionTitle}>Your Information</div>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>First Name *</label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            style={styles.input}
                            placeholder="Enter your first name"
                        />
                    </div>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Last Name *</label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            style={styles.input}
                            placeholder="Enter your last name"
                        />
                    </div>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Email Address *</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                            placeholder="Enter your email address"
                        />
                    </div>
                    
                    <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                        <div style={styles.sectionTitle}>Preferred Time Slots *</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
                            Please provide {schedule?.max_choices || 3} preferred time slot{(schedule?.max_choices || 3) !== 1 ? 's' : ''}. All {(schedule?.max_choices || 3)} are required.
                        </div>
                        
                        {(!formClosedDueToDeadline) && (
                            <>
                                <TimingSelector
                                    timing={timing1}
                                    onChange={setTiming1}
                                    index={0}
                                    errors={formErrors.filter(e => e.includes('Choice 1') || e.includes('1'))}
                                />
                                {(schedule?.max_choices || 3) >= 2 && (
                                    <TimingSelector
                                        timing={timing2}
                                        onChange={setTiming2}
                                        index={1}
                                        errors={formErrors.filter(e => e.includes('Choice 2') || e.includes('2'))}
                                    />
                                )}
                                {(schedule?.max_choices || 3) >= 3 && (
                                    <TimingSelector
                                        timing={timing3}
                                        onChange={setTiming3}
                                        index={2}
                                        errors={formErrors.filter(e => e.includes('Choice 3') || e.includes('3'))}
                                    />
                                )}
                            </>
                        )}
                    </div>
                    
                    <button
                        type="submit"
                        disabled={submitting || formClosedDueToDeadline}
                        style={{
                            ...styles.button,
                            opacity: (submitting || formClosedDueToDeadline) ? 0.7 : 1,
                        }}
                    >
                        {submitting ? 'Submitting...' : formClosedDueToDeadline ? 'Form Closed' : 'Submit Availability'}
                    </button>
                </form>
            </div>
        </div>
    );
}
