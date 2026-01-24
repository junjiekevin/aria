import { useState } from 'react';
import Modal from '../components/Modal';
import { Trash2, Copy, Check, Sparkles, Archive, FileText, Clock } from 'lucide-react';
import { type Schedule } from '../lib/api/schedules';
import { type FormResponse } from '../lib/api/form-responses';
import { useDraggable, useDroppable } from '@dnd-kit/core';

const styles = {
    sidePanel: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.5rem',
    },
    panel: {
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
        padding: '0.85rem',
    },
    panelTitle: {
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#111827',
        margin: '0 0 0.6rem 0',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '0.6rem',
        color: '#6b7280',
        fontSize: '0.7rem',
    },
    statusBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.625rem',
        borderRadius: '9999px',
        fontSize: '0.8125rem',
        fontWeight: '500',
        border: '1px solid',
    },
    panelActionButton: {
        padding: '0.5rem 0.75rem',
        borderRadius: '0.375rem',
        fontSize: '0.8125rem',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        border: '1px solid #e5e7eb',
        backgroundColor: 'white',
        color: '#6b7280',
        transition: 'all 0.2s',
    },
    unassignedPanelHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        marginBottom: '0.5rem',
        flexWrap: 'wrap' as const,
        flexShrink: 0 as const,
    },
    unassignedPanelTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    unassignedPanelTitleText: {
        fontSize: '0.8rem',
        fontWeight: '600',
        color: '#111827',
        margin: 0,
    },
    unassignedBadge: {
        backgroundColor: '#f97316',
        color: 'white',
        padding: '0.2rem 0.45rem',
        borderRadius: '9999px',
        fontSize: '0.7rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    scheduleButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.3rem 0.6rem',
        backgroundColor: '#22c55e',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        fontSize: '0.7rem',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(34, 197, 94, 0.3)',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap' as const,
    },
    scheduleButtonDisabled: {
        backgroundColor: '#9ca3af',
        cursor: 'not-allowed',
        boxShadow: 'none',
    },
    unassignedCardList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.5rem',
        overflowY: 'auto' as const,
        maxHeight: '400px', // Increased for better use of space
    },
    unassignedCard: {
        padding: '0.6rem 0.75rem',
        backgroundColor: '#fef3c7',
        borderRadius: '0.5rem',
        border: '1px solid #fde68a',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'grab',
        transition: 'all 0.2s',
    },
    unassignedCardHover: {
        backgroundColor: '#fde68a',
        borderColor: '#f59e0b',
    },
    unassignedCardDragging: {
        backgroundColor: '#fbbf24',
        borderColor: '#f59e0b',
        opacity: 0.5,
    },
    unassignedCardName: {
        fontWeight: '600',
        color: '#92400e',
    },
    unassignedCardIcon: {
        color: '#9ca3af',
        cursor: 'pointer',
        transition: 'color 0.2s',
    },
    unassignedCardIconHover: {
        color: '#dc2626',
    },
};

function FormLink({ scheduleId }: { scheduleId: string }) {
    const [copied, setCopied] = useState(false);
    const formUrl = `${window.location.origin}/form/${scheduleId}`;

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(formUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
                readOnly
                value={formUrl}
                style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    backgroundColor: '#f9fafb',
                    color: '#6b7280',
                }}
            />
            <button
                onClick={copyToClipboard}
                style={{
                    padding: '0.5rem',
                    backgroundColor: copied ? '#22c55e' : '#f97316',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s',
                }}
            >
                {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const statusConfig: Record<string, { label: string; icon: typeof FileText; style: React.CSSProperties }> = {
        draft: {
            label: 'Draft',
            icon: FileText,
            style: { ...styles.statusBadge, backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fed7aa' }
        },
        collecting: {
            label: 'Active',
            icon: Clock,
            style: { ...styles.statusBadge, backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#a7f3d0' }
        },
        archived: {
            label: 'Archived',
            icon: Archive,
            style: { ...styles.statusBadge, backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }
        },
        trashed: {
            label: 'Trashed',
            icon: Trash2,
            style: { ...styles.statusBadge, backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }
        }
    };

    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;

    return (
        <div style={config.style}>
            <Icon size={14} />
            {config.label}
        </div>
    );
}

function TrashDroppable() {
    const { setNodeRef, isOver } = useDroppable({
        id: 'trash',
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.6rem',
                border: '2px dashed',
                borderColor: isOver ? '#dc2626' : '#d1d5db',
                borderRadius: '0.3rem',
                backgroundColor: isOver ? '#fef2f2' : 'white',
                color: isOver ? '#dc2626' : '#6b7280',
                fontSize: '0.7rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                cursor: 'pointer',
                marginTop: '0.6rem',
            }}
        >
            {isOver ? 'Drop here to delete' : 'Drag here to delete'}
        </div>
    );
}

function DraggableUnassignedCard({ response, isViewOnly, onClick, onDelete }: { response: FormResponse, isViewOnly: boolean, onClick: () => void, onDelete: () => void }) {
    const { attributes, listeners, setNodeRef } = useDraggable({
        id: `unassigned-${response.id}`,
        data: { ...response, isUnassigned: true },
        disabled: isViewOnly,
    });

    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            ref={setNodeRef}
            style={{
                ...styles.unassignedCard,
                ...(isHovered && !isViewOnly ? styles.unassignedCardHover : {}),
                cursor: isViewOnly ? 'default' : 'grab',
            }}
            {...(!isViewOnly ? { ...attributes, ...listeners } : {})}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={styles.unassignedCardName}>{response.student_name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2
                    size={16}
                    style={{ ...styles.unassignedCardIcon, ...(isHovered ? styles.unassignedCardIconHover : {}) }}
                    onClick={(e: React.MouseEvent) => {
                        if (isViewOnly) return;
                        e.stopPropagation();
                        onDelete();
                    }}
                />
            </div>
        </div>
    );
}

interface SidePanelProps {
    schedule: Schedule;
    scheduleId: string;
    isViewOnly: boolean;
    totalWeeks: number;
    responses: FormResponse[];
    unassignedStudents: FormResponse[];
    onShowConfigure: () => void;
    onArchive: () => void;
    onTrash: () => void;
    onShowUnassignedModal: () => void;
    onShowSchedulingPreview: () => void;
    onResponseClick: (r: FormResponse) => void;
    onDeleteResponse: (r: FormResponse) => void;
    showTrashConfirm: boolean;
    onCloseTrashConfirm: () => void;
    onConfirmTrash: () => void;
}

export default function SidePanel({
    schedule,
    scheduleId,
    isViewOnly,
    totalWeeks,
    unassignedStudents,
    onShowConfigure,
    onArchive,
    onTrash,
    onShowSchedulingPreview,
    onResponseClick,
    onDeleteResponse,
    showTrashConfirm,
    onCloseTrashConfirm,
    onConfirmTrash
}: SidePanelProps) {
    const [activeTab, setActiveTab] = useState<'events' | 'info'>('events');

    return (
        <div style={styles.sidePanel}>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem', backgroundColor: '#e5e7eb', borderRadius: '0.5rem' }}>
                <button
                    onClick={() => setActiveTab('events')}
                    style={{
                        flex: 1,
                        padding: '0.4rem',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        borderRadius: '0.375rem',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: activeTab === 'events' ? 'white' : 'transparent',
                        color: activeTab === 'events' ? '#f97316' : '#6b7280',
                        boxShadow: activeTab === 'events' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                    }}
                >
                    Events
                    {unassignedStudents.length > 0 && (
                        <span style={{
                            backgroundColor: activeTab === 'events' ? '#f97316' : '#9ca3af',
                            color: 'white',
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '9999px',
                            minWidth: '1.2rem',
                            textAlign: 'center'
                        }}>
                            {unassignedStudents.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('info')}
                    style={{
                        flex: 1,
                        padding: '0.4rem',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        borderRadius: '0.375rem',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: activeTab === 'info' ? 'white' : 'transparent',
                        color: activeTab === 'info' ? '#f97316' : '#6b7280',
                        boxShadow: activeTab === 'info' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    Info
                </button>
            </div>

            <div style={{
                ...styles.panel,
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '300px' // Ensure visibility when stacked
            }}>
                {activeTab === 'events' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {!isViewOnly ? (
                            <>
                                <div style={styles.unassignedPanelHeader}>
                                    <div style={styles.unassignedPanelTitle}>
                                        <h3 style={styles.unassignedPanelTitleText}>Unassigned Events</h3>
                                    </div>
                                    <button
                                        onClick={() => unassignedStudents.length > 0 && onShowSchedulingPreview()}
                                        disabled={unassignedStudents.length === 0}
                                        style={{
                                            ...styles.scheduleButton,
                                            ...(unassignedStudents.length === 0 ? styles.scheduleButtonDisabled : {}),
                                        }}
                                        onMouseEnter={(e) => { if (unassignedStudents.length > 0) { e.currentTarget.style.backgroundColor = '#16a34a'; } }}
                                        onMouseLeave={(e) => { if (unassignedStudents.length > 0) { e.currentTarget.style.backgroundColor = '#22c55e'; } }}
                                    >
                                        <Sparkles size={12} />
                                        Schedule All
                                    </button>
                                </div>
                                <div style={{ ...styles.unassignedCardList, flex: 1, maxHeight: 'none' }}>
                                    {unassignedStudents.map((response) => (
                                        <DraggableUnassignedCard
                                            key={response.id}
                                            response={response}
                                            isViewOnly={isViewOnly}
                                            onClick={() => onResponseClick(response)}
                                            onDelete={() => onDeleteResponse(response)}
                                        />
                                    ))}
                                    {unassignedStudents.length === 0 && (
                                        <div style={styles.emptyState}>No unassigned events</div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div style={styles.emptyState}>View only mode</div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                        <h3 style={styles.panelTitle}>Schedule Info</h3>
                        <div>
                            <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.5rem' }}>Status:</span>
                            <StatusBadge status={schedule.status} />
                        </div>
                        <div>
                            <span style={{ color: '#6b7280' }}>Duration: </span>
                            <span style={{ fontWeight: '500', color: '#111827' }}>
                                {totalWeeks} weeks
                            </span>
                        </div>

                        {schedule.status === 'draft' && !isViewOnly && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <button
                                    onClick={onShowConfigure}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        backgroundColor: '#f97316',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
                                >
                                    <Sparkles size={16} />
                                    Configure & Activate Form
                                </button>
                            </div>
                        )}

                        {schedule.status === 'collecting' && (
                            <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                                {schedule.form_deadline && (
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Deadline:</span>
                                        <span style={{ fontWeight: '500', color: '#111827' }}>
                                            {new Date(schedule.form_deadline).toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                )}
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                                        {schedule.max_choices === 1 ? '1 choice' : `${schedule.max_choices} choices`} per student
                                    </span>
                                </div>
                                <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.5rem' }}>Form Link:</span>
                                <FormLink scheduleId={scheduleId} />
                                {!isViewOnly && (
                                    <button
                                        onClick={onShowConfigure}
                                        style={{
                                            marginTop: '0.75rem',
                                            padding: '0.5rem 0.75rem',
                                            backgroundColor: 'white',
                                            color: '#6b7280',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                            width: '100%',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                    >
                                        Edit Form Configuration
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Archive and Trash buttons - visible based on status */}
                        {schedule.status !== 'trashed' && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                                {schedule.status === 'collecting' && (
                                    <button
                                        onClick={onArchive}
                                        style={{ ...styles.panelActionButton, flex: 1 }}
                                        title="Archive"
                                    >
                                        <Archive size={14} />
                                        Archive
                                    </button>
                                )}
                                <button
                                    onClick={onTrash}
                                    style={{ ...styles.panelActionButton, flex: 1, color: '#dc2626', borderColor: '#fecaca' }}
                                    title="Trash"
                                >
                                    <Trash2 size={14} />
                                    Trash
                                </button>
                            </div>
                        )}

                        {/* Trash Confirmation Modal */}
                        <Modal
                            isOpen={showTrashConfirm}
                            onClose={onCloseTrashConfirm}
                            title="Move to Trash"
                            maxWidth="28rem"
                        >
                            <div style={{ padding: '0.5rem 0' }}>
                                <p style={{ marginBottom: '1.5rem', color: '#374151', lineHeight: 1.5 }}>
                                    Are you sure you want to move <strong>{schedule.label}</strong> to trash?
                                    This schedule can be restored later.
                                </p>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={onCloseTrashConfirm}
                                        style={{
                                            padding: '0.625rem 1.25rem',
                                            backgroundColor: 'white',
                                            color: '#374151',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={onConfirmTrash}
                                        style={{
                                            padding: '0.625rem 1.25rem',
                                            backgroundColor: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Move to Trash
                                    </button>
                                </div>
                            </div>
                        </Modal>
                    </div>
                )}
            </div>

            <div style={styles.panel}>
                {!isViewOnly && <TrashDroppable />}
            </div>
        </div>
    );
}
