import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Calendar, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const styles: Record<string, React.CSSProperties> = {
    container: {
        maxWidth: '28rem',
        margin: '4rem auto',
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        fontFamily: 'Inter, system-ui, sans-serif',
    },
    header: {
        textAlign: 'center',
        marginBottom: '2rem',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#111827',
        marginTop: '0.5rem',
    },
    details: {
        backgroundColor: '#f9fafb',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        marginBottom: '1.5rem',
        border: '1px solid #f3f4f6',
    },
    detailItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#4b5563',
        fontSize: '0.925rem',
        marginBottom: '0.75rem',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginBottom: '1.5rem',
    },
    label: {
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#374151',
    },
    textarea: {
        padding: '0.75rem',
        borderRadius: '0.5rem',
        border: '1px solid #d1d5db',
        minHeight: '100px',
        fontSize: '0.925rem',
        fontFamily: 'inherit',
    },
    button: {
        width: '100%',
        padding: '0.875rem',
        borderRadius: '0.5rem',
        border: 'none',
        backgroundColor: '#dc2626',
        color: 'white',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    error: {
        padding: '1rem',
        backgroundColor: '#fef2f2',
        color: '#dc2626',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
    },
    success: {
        textAlign: 'center',
        padding: '2rem 1rem',
    }
};

export default function CancelPage() {
    const { entryId } = useParams<{ entryId: string }>();
    const [searchParams] = useSearchParams();
    const date = searchParams.get('date'); // YYYY-MM-DD

    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleCancel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            setErrorMsg('Please provide a reason for cancellation.');
            return;
        }

        setLoading(true);
        setErrorMsg(null);

        try {
            const { data, error } = await supabase.functions.invoke('cancel-event', {
                body: { entry_id: entryId, occurrence_date: date, reason },
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            setStatus('success');
        } catch (err) {
            console.error('Cancellation failed:', err);
            setStatus('error');
            setErrorMsg(err instanceof Error ? err.message : 'Failed to cancel the event. Please contact your instructor directly.');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'success') {
        return (
            <div style={styles.container}>
                <div style={styles.success}>
                    <CheckCircle color="#059669" size={48} style={{ marginBottom: '1rem', marginLeft: 'auto', marginRight: 'auto', display: 'block' }} />
                    <h2 style={styles.title}>Event Canceled</h2>
                    <p style={{ color: '#4b5563', marginTop: '0.5rem' }}>
                        The occurrence has been removed from the schedule. Your instructor has been notified.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <XCircle color="#dc2626" size={40} />
                <h1 style={styles.title}>Cancel Session</h1>
            </div>

            <div style={styles.details}>
                <div style={styles.detailItem}>
                    <Calendar size={18} />
                    <span>{date ? new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}</span>
                </div>
                <div style={styles.detailItem}>
                    <AlertTriangle size={18} color="#f97316" />
                    <span style={{ fontSize: '0.8rem' }}>Subject to instructor's cancellation policy.</span>
                </div>
            </div>

            {errorMsg && (
                <div style={styles.error}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{errorMsg}</span>
                </div>
            )}

            <form onSubmit={handleCancel}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Reason for cancellation</label>
                    <textarea
                        style={styles.textarea}
                        placeholder="Please briefly explain why you are canceling..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                    />
                </div>

                <button
                    type="submit"
                    style={{
                        ...styles.button,
                        opacity: loading ? 0.7 : 1,
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                    disabled={loading}
                >
                    {loading ? 'Processing...' : 'Confirm Cancellation'}
                </button>
            </form>
        </div>
    );
}
