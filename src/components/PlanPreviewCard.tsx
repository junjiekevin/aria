// src/components/PlanPreviewCard.tsx
// Renders a lightweight preview of proposed schedule changes inline in chat.

import { Check, X, AlertTriangle, Plus, ArrowRight, Trash2, ArrowLeftRight } from 'lucide-react';

interface PlanChange {
    action: 'add' | 'move' | 'swap' | 'delete' | 'update';
    target: string;
    description: string;
}

interface PlanConflict {
    type: string;
    description: string;
    severity: 'warning' | 'error';
}

interface PlanPreviewCardProps {
    planId: string;
    changes: PlanChange[];
    conflicts: PlanConflict[];
    expiresAt: string;
    onConfirm: (planId: string) => void;
    onReject: (planId: string) => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
    add: <Plus size={14} />,
    move: <ArrowRight size={14} />,
    swap: <ArrowLeftRight size={14} />,
    delete: <Trash2 size={14} />,
    update: <ArrowRight size={14} />,
};

const ACTION_COLORS: Record<string, string> = {
    add: '#22c55e',
    move: '#3b82f6',
    swap: '#a855f7',
    delete: '#ef4444',
    update: '#f59e0b',
};

export default function PlanPreviewCard({
    planId,
    changes,
    conflicts,
    expiresAt,
    onConfirm,
    onReject,
}: PlanPreviewCardProps) {
    const hasErrors = conflicts.some(c => c.severity === 'error');
    const timeLeft = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));

    return (
        <div style={{
            background: 'linear-gradient(135deg, #1e1e2e, #2a2a3e)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '16px',
            margin: '8px 0',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            color: '#e2e8f0',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
            }}>
                <span style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    background: 'linear-gradient(90deg, #818cf8, #c084fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    📋 Proposed Plan
                </span>
                <span style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                }}>
                    Expires in {timeLeft}m
                </span>
            </div>

            {/* Changes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                {changes.map((change, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        borderLeft: `3px solid ${ACTION_COLORS[change.action] || '#94a3b8'}`,
                    }}>
                        <span style={{ color: ACTION_COLORS[change.action] || '#94a3b8', flexShrink: 0 }}>
                            {ACTION_ICONS[change.action]}
                        </span>
                        <span style={{ flex: 1 }}>{change.description}</span>
                    </div>
                ))}
            </div>

            {/* Conflicts */}
            {conflicts.length > 0 && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    padding: '10px',
                    marginBottom: '12px',
                }}>
                    {conflicts.map((conflict, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: conflict.severity === 'error' ? '#fca5a5' : '#fde68a',
                            fontSize: '12px',
                            marginBottom: i < conflicts.length - 1 ? '4px' : 0,
                        }}>
                            <AlertTriangle size={12} />
                            <span>{conflict.description}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => onConfirm(planId)}
                    disabled={hasErrors}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: hasErrors ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                        color: hasErrors ? '#64748b' : '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: hasErrors ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: '13px',
                        transition: 'transform 0.1s',
                    }}
                >
                    <Check size={14} /> Confirm
                </button>
                <button
                    onClick={() => onReject(planId)}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '13px',
                        transition: 'transform 0.1s',
                    }}
                >
                    <X size={14} /> Reject
                </button>
            </div>
        </div>
    );
}
