import { useState, useEffect } from 'react';
import Modal from './Modal';
import { scheduleStudents, createEntryFromAssignment, type SchedulingResult, type ScheduledAssignment } from '../lib/scheduling';
import { createScheduleEntry, type ScheduleEntry } from '../lib/api/schedule-entries';
import type { FormResponse } from '../lib/api/form-responses';

function formatTime(hour: number, minute: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

function formatDay(day: string): string {
    return day.substring(0, 3);
}

interface SchedulingPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    students: FormResponse[];
    existingEntries: ScheduleEntry[];
    scheduleStart: Date;
    scheduleId: string;
    onScheduled: () => void;
}

const styles = {
    content: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.25rem',
    },
    summary: {
        padding: '1rem',
        backgroundColor: '#f0fdf4',
        borderRadius: '0.5rem',
        border: '1px solid #bbf7d0',
    },
    summaryTitle: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#166534',
        marginBottom: '0.5rem',
    },
    summaryText: {
        fontSize: '0.875rem',
        color: '#15803d',
    },
    assignmentList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.75rem',
        maxHeight: '400px',
        overflowY: 'auto' as const,
    },
    assignmentCard: {
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
    },
    scheduledCard: {
        backgroundColor: '#fff7ed',
        border: '1px solid #fed7aa',
    },
    unassignedCard: {
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
    },
    choiceBadge: {
        padding: '0.15rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.7rem',
        fontWeight: '600',
    },
    scheduledBadge: {
        backgroundColor: '#22c55e',
        color: 'white',
    },
    unassignedBadge: {
        backgroundColor: '#ef4444',
        color: 'white',
    },
    studentName: {
        fontWeight: '600',
        fontSize: '0.875rem',
        color: '#111827',
    },
    timing: {
        fontSize: '0.8rem',
        color: '#6b7280',
    },
    reason: {
        fontSize: '0.8rem',
        color: '#dc2626',
    },
    buttonGroup: {
        display: 'flex',
        gap: '0.75rem',
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
        backgroundColor: '#22c55e',
        color: 'white',
        flex: 1,
    },
    secondaryButton: {
        backgroundColor: 'white',
        color: '#374151',
        border: '1px solid #d1d5db',
    },
    loadingText: {
        textAlign: 'center' as const,
        color: '#6b7280',
        padding: '2rem',
    },
};

function AssignmentCard({ assignment }: { assignment: ScheduledAssignment }) {
    const isScheduled = assignment.isScheduled;
    const choiceLabels = ['1st', '2nd', '3rd'];
    
    return (
        <div style={{
            ...styles.assignmentCard,
            ...(isScheduled ? styles.scheduledCard : styles.unassignedCard),
        }}>
            <span style={{
                ...styles.choiceBadge,
                ...(isScheduled ? styles.scheduledBadge : styles.unassignedBadge),
            }}>
                {isScheduled ? choiceLabels[assignment.choiceRank - 1] : '✗'}
            </span>
            <div>
                <div style={styles.studentName}>{assignment.student.student_name}</div>
                {isScheduled ? (
                    <div style={styles.timing}>
                        {formatDay(assignment.timing.day)} {formatTime(assignment.timing.startHour, assignment.timing.startMinute)} - {formatTime(assignment.timing.endHour, assignment.timing.endMinute)}
                    </div>
                ) : (
                    <div style={styles.reason}>{assignment.reason}</div>
                )}
            </div>
        </div>
    );
}

export default function SchedulingPreviewModal({
    isOpen,
    onClose,
    students,
    existingEntries,
    scheduleStart,
    scheduleId,
    onScheduled,
}: SchedulingPreviewModalProps) {
    const [result, setResult] = useState<SchedulingResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createdCount, setCreatedCount] = useState(0);

    // Run scheduling algorithm when modal opens
    useEffect(() => {
        if (isOpen && students.length > 0) {
            setLoading(true);
            // Calculate total weeks from schedule
            const scheduleEnd = new Date(scheduleStart);
            scheduleEnd.setMonth(scheduleEnd.getMonth() + 3); // Assume 3 months
            const totalWeeks = Math.ceil((scheduleEnd.getTime() - scheduleStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
            
            const schedulingResult = scheduleStudents(students, existingEntries, scheduleStart, totalWeeks);
            setResult(schedulingResult);
            setLoading(false);
        }
    }, [isOpen, students, existingEntries, scheduleStart]);

    const handleConfirm = async () => {
        if (!result) return;
        
        setCreating(true);
        const scheduledAssignments = result.assignments.filter(a => a.isScheduled);
        
        // Schedule for the current week (week 0)
        const week = 0;
        let created = 0;
        
        for (const assignment of scheduledAssignments) {
            try {
                const entryData = createEntryFromAssignment(assignment, scheduleStart, week);
                await createScheduleEntry({
                    schedule_id: scheduleId,
                    student_name: assignment.student.student_name,
                    ...entryData,
                });
                created++;
                setCreatedCount(created);
            } catch (err) {
                console.error('Failed to create entry:', err);
            }
        }
        
        setCreating(false);
        onScheduled();
        onClose();
    };

    if (loading) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Scheduling with Aria" maxWidth="50rem">
                <div style={styles.loadingText}>
                    Aria is analyzing the schedule and finding the best matches...
                </div>
            </Modal>
        );
    }

    if (creating || createdCount > 0) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Scheduling with Aria" maxWidth="50rem">
                <div style={styles.loadingText}>
                    {creating ? `Creating entries... ${createdCount}/${result?.assignments.filter(a => a.isScheduled).length || 0}` : 'Done!'}
                </div>
            </Modal>
        );
    }

    if (!result) return null;

    const scheduledCount = result.assignments.filter(a => a.isScheduled).length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Scheduling with Aria" maxWidth="50rem">
            <div style={styles.content}>
                <div style={styles.summary}>
                    <div style={styles.summaryTitle}>Aria's Plan</div>
                    <div style={styles.summaryText}>
                        {scheduledCount > 0 
                            ? `I can schedule ${scheduledCount} of ${result.assignments.length} students.`
                            : `I couldn't find available slots for any students.`
                        }
                    </div>
                </div>

                <div style={styles.assignmentList}>
                    {result.assignments.map((assignment, index) => (
                        <AssignmentCard key={index} assignment={assignment} />
                    ))}
                </div>

                <div style={styles.buttonGroup}>
                    <button
                        onClick={handleConfirm}
                        disabled={scheduledCount === 0}
                        style={{
                            ...styles.button,
                            ...styles.primaryButton,
                            opacity: scheduledCount === 0 ? 0.5 : 1,
                            cursor: scheduledCount === 0 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        Confirm {scheduledCount} Assignments
                    </button>
                    <button
                        onClick={onClose}
                        style={{ ...styles.button, ...styles.secondaryButton }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>
    );
}
