// src/pages/SchedulePage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Settings, List, Sparkles, Copy, Check, Layout, Calendar, FileText } from 'lucide-react';
import { exportToICS, exportToPDF } from '../lib/export';
import s from './SchedulePage.module.css';
import { getSchedule, updateSchedule, type Schedule } from '../lib/services/scheduleService';
import { getScheduleEntries, createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, type ScheduleEntry } from '../lib/api/schedule-entries';
import { getFormResponses, deleteFormResponse, updateFormResponseAssigned, getPreferredTimings, type FormResponse } from '../lib/api/form-responses';
import {
    parseRecurrenceRule,
    updateRecurrenceRule,
    buildRecurrenceRule,
    isEntryInWeek,
    type FrequencyType,
} from '../lib/recurrence';
import AddEventModal from '../components/AddEventModal';
import Modal from '../components/Modal';
import SchedulingPreviewModal from '../components/SchedulingPreviewModal';
import ConfigureFormModal from '../components/ConfigureFormModal';
import SwapConfirmModal from '../components/SwapConfirmModal';
import { supabase } from '../lib/supabase';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SchedulePage() {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
    );

    const { scheduleId } = useParams<{ scheduleId: string }>();
    const navigate = useNavigate();

    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [entries, setEntries] = useState<ScheduleEntry[]>([]);
    const [responses, setResponses] = useState<FormResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ day: string; hour: number } | null>(null);
    const [isEventsOpen, setIsEventsOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
    const [participantToDelete, setParticipantToDelete] = useState<FormResponse | null>(null);
    const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);
    const [showSchedulingPreview, setShowSchedulingPreview] = useState(false);
    const [responseToView, setResponseToView] = useState<FormResponse | null>(null);
    const [showConfigureFormModal, setShowConfigureFormModal] = useState(false);
    const [showTrashConfirm, setShowTrashConfirm] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const [showSwapModal, setShowSwapModal] = useState(false);
    const [pendingSwap, setPendingSwap] = useState<{
        eventA: ScheduleEntry;
        eventB: ScheduleEntry;
        isConflict: boolean;
        swapAction: () => Promise<void>;
    } | null>(null);

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [isEditingDates, setIsEditingDates] = useState(false);
    const [editedStartDate, setEditedStartDate] = useState('');
    const [editedEndDate, setEditedEndDate] = useState('');

    const isArchived = schedule?.status === 'archived';
    const isTrashed = schedule?.status === 'trashed';
    const isViewOnly = isArchived || isTrashed;

    const HOURS = useMemo(() => {
        const start = schedule?.working_hours_start ?? 8;
        const end = schedule?.working_hours_end ?? 21;
        return Array.from({ length: end - start }, (_, i) => i + start);
    }, [schedule]);

    useEffect(() => {
        if (scheduleId) loadScheduleData();
    }, [scheduleId]);

    useEffect(() => {
        const handleAriaChange = () => loadScheduleData();
        const handleAutoSchedule = () => setShowSchedulingPreview(true);
        window.addEventListener('aria-schedule-change', handleAriaChange);
        window.addEventListener('aria-show-auto-schedule', handleAutoSchedule);
        return () => {
            window.removeEventListener('aria-schedule-change', handleAriaChange);
            window.removeEventListener('aria-show-auto-schedule', handleAutoSchedule);
        };
    }, [scheduleId]);

    // ============================================
    // Date Helpers
    // ============================================

    const parseLocalDate = (dateStr: string): Date => {
        if (!dateStr) return new Date();
        if (dateStr.includes('T')) return new Date(dateStr);
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const { weekStart, weekEnd, weekNumber, totalWeeks } = useMemo(() => {
        if (!schedule) return { weekStart: null, weekEnd: null, weekNumber: 0, totalWeeks: 0 };

        const start = parseLocalDate(schedule.start_date);
        const end = parseLocalDate(schedule.end_date);

        const startDayOfWeek = start.getDay();
        const timetableWeekStart = new Date(start);
        timetableWeekStart.setDate(start.getDate() - startDayOfWeek);

        const totalMs = end.getTime() - timetableWeekStart.getTime();
        const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
        const total = Math.ceil(totalDays / 7);

        const currentWeekStart = new Date(timetableWeekStart);
        currentWeekStart.setDate(timetableWeekStart.getDate() + currentWeekOffset * 7);

        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

        return {
            weekStart: currentWeekStart,
            weekEnd: currentWeekEnd,
            weekNumber: currentWeekOffset + 1,
            totalWeeks: total,
        };
    }, [schedule, currentWeekOffset]);

    const formatLocalDate = (date: Date) =>
        date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    const formatLocalTime = (isoString: string) =>
        new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    // ============================================
    // Entry Filtering — delegates to recurrence.ts
    // ============================================

    const isEntryInCurrentWeek = (entry: ScheduleEntry): boolean => {
        if (!weekStart || !weekEnd) return false;
        return isEntryInWeek(entry.start_time, entry.recurrence_rule, weekStart, weekEnd);
    };

    const getEntriesForSlot = (day: string, hour: number) => {
        const dayIndex = DAYS.indexOf(day);
        return entries.filter(entry => {
            if (!isEntryInCurrentWeek(entry)) return false;
            const rule = parseRecurrenceRule(entry.recurrence_rule);
            const entryDayIndex = rule?.dayIndex ?? new Date(entry.start_time).getDay();
            const entryHour = new Date(entry.start_time).getHours();
            return entryDayIndex === dayIndex && entryHour === hour;
        });
    };

    // ============================================
    // Navigation
    // ============================================

    const goToPreviousWeek = () =>
        setCurrentWeekOffset(prev => Math.max(0, prev - 1));

    const goToNextWeek = () =>
        setCurrentWeekOffset(prev => Math.min(totalWeeks - 1, prev + 1));

    // ============================================
    // Data Loading
    // ============================================

    const loadScheduleData = async () => {
        if (!scheduleId) return;
        try {
            setLoading(true);
            setError(null);
            const [scheduleData, entriesData] = await Promise.all([
                getSchedule(scheduleId),
                getScheduleEntries(scheduleId),
            ]);
            setSchedule(scheduleData);
            setEntries(entriesData);
            try {
                const responsesData = await getFormResponses(scheduleId);
                setResponses(responsesData);
            } catch {
                setResponses([]);
            }
        } catch (err) {
            console.error('Failed to load schedule:', err);
            setError(err instanceof Error ? err.message : 'Failed to load schedule');
            setSchedule(null);
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // Formatting Helpers
    // ============================================

    const getUnassignedParticipants = () => responses.filter(r => !r.assigned);

    const formatTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const formatFrequency = (freq: string) => {
        const labels: Record<string, string> = {
            once: 'Once',
            daily: 'Daily',
            weekly: 'Weekly',
            '2weekly': 'Every 2 Weeks',
            monthly: 'Monthly',
        };
        return labels[freq] || freq;
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            draft: 'Draft',
            collecting: 'Active (Collecting)',
            published: 'Published',
            archived: 'Archived',
            trashed: 'Trashed',
        };
        return labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
    };

    // ============================================
    // Actions
    // ============================================

    const handleCopyLink = () => {
        if (!schedule) return;
        navigator.clipboard.writeText(`${window.location.origin}/form/${schedule.id}`);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleTitleClick = () => {
        if (isViewOnly) return;
        setEditedTitle(schedule?.label || '');
        setIsEditingTitle(true);
    };

    const handleTitleSave = async () => {
        if (!scheduleId || !schedule || !editedTitle.trim()) {
            setIsEditingTitle(false);
            return;
        }
        if (editedTitle.trim() === schedule.label) {
            setIsEditingTitle(false);
            return;
        }
        try {
            await updateSchedule(scheduleId, { label: editedTitle.trim() });
            setSchedule({ ...schedule, label: editedTitle.trim() });
            setIsEditingTitle(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to update title');
        }
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleTitleSave();
        else if (e.key === 'Escape') setIsEditingTitle(false);
    };

    const handleDatesClick = () => {
        if (isViewOnly) return;
        setEditedStartDate(schedule?.start_date || '');
        setEditedEndDate(schedule?.end_date || '');
        setIsEditingDates(true);
    };

    const handleDatesSave = async () => {
        if (!scheduleId || !schedule || !editedStartDate || !editedEndDate) {
            setIsEditingDates(false);
            return;
        }
        if (editedStartDate === schedule.start_date && editedEndDate === schedule.end_date) {
            setIsEditingDates(false);
            return;
        }
        if (new Date(editedStartDate) >= new Date(editedEndDate)) {
            alert('End date must be after start date');
            return;
        }
        try {
            await updateSchedule(scheduleId, {
                start_date: editedStartDate,
                end_date: editedEndDate,
            });
            setSchedule({ ...schedule, start_date: editedStartDate, end_date: editedEndDate });
            setIsEditingDates(false);
            setCurrentWeekOffset(0);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to update dates');
        }
    };

    const handleDatesBlur = (e: React.FocusEvent) => {
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (relatedTarget?.classList.contains(s.dateInput)) return;
        handleDatesSave();
    };

    const handleDatesKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleDatesSave();
        else if (e.key === 'Escape') setIsEditingDates(false);
    };

    const handleSlotClick = (day: string, hour: number) => {
        if (isViewOnly) return;
        setSelectedSlot({ day, hour });
        setSelectedEntry(null);
        setShowAddModal(true);
    };

    const handleEntryClick = (entry: ScheduleEntry, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedEntry(entry);
        setSelectedSlot(null);
        setShowAddModal(true);
    };

    const handleEventSaved = () => loadScheduleData();

    const handleArchive = async () => {
        if (!scheduleId) return;
        try {
            await updateSchedule(scheduleId, { status: 'archived' });
            loadScheduleData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to archive schedule');
        }
    };

    const handleTrashWithRedirect = async () => {
        if (!scheduleId) return;
        try {
            await updateSchedule(scheduleId, { status: 'trashed' });
            setShowTrashConfirm(false);
            navigate('/');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to trash schedule');
        }
    };

    const handlePublish = async () => {
        if (!scheduleId) return;
        if (!confirm('Publish this schedule? This will send confirmation emails to all assigned participants.')) return;
        try {
            setIsPublishing(true);
            const { error } = await supabase.functions.invoke('publish-schedule', {
                body: { schedule_id: scheduleId },
            });
            if (error) throw error;
            alert('Schedule published! Participants are being notified.');
            loadScheduleData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to publish schedule');
        } finally {
            setIsPublishing(false);
        }
    };

    // ============================================
    // Drag and Drop
    // ============================================

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id as string);
        setIsDragging(true);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setIsDragging(false);

        if (loading || !schedule || !over) {
            setActiveDragId(null);
            return;
        }

        const dropId = over.id as string;

        // ── Unassigned participant dropped onto a slot ──
        if (typeof active.id === 'string' && active.id.startsWith('unassigned-')) {
            const responseId = active.id.replace('unassigned-', '');
            const response = responses.find(r => r.id === responseId);
            if (!response || !dropId.startsWith('slot-')) return;

            const [, day, hourStr] = dropId.split('-');
            const hour = parseInt(hourStr);
            const dayIndex = DAYS.indexOf(day);

            const firstOccurrence = new Date(weekStart!);
            firstOccurrence.setDate(weekStart!.getDate() + dayIndex);
            firstOccurrence.setHours(hour, 0, 0, 0);

            const preferredStart = response.preferred_1_start;
            const preferredEnd = response.preferred_1_end;

            if (!preferredStart || !preferredEnd) return;

            const [startH, startM] = preferredStart.split(':').map(Number);
            const [endH, endM] = preferredEnd.split(':').map(Number);
            const durationMs = ((endH * 60 + endM) - (startH * 60 + startM)) * 60 * 1000;
            const newEnd = new Date(firstOccurrence.getTime() + durationMs);

            const hasConflict = entries.some(entry => {
                const entryStart = new Date(entry.start_time);
                const entryEnd = new Date(entry.end_time);
                if (entryStart.getDay() !== dayIndex) return false;
                return firstOccurrence < entryEnd && newEnd > entryStart;
            });

            if (hasConflict) {
                alert('Cannot schedule — slot conflicts with an existing event.');
                return;
            }

            const frequency = (response.preferred_1_frequency || 'weekly') as FrequencyType;
            const recurrenceRule = buildRecurrenceRule(frequency, firstOccurrence);

            try {
                const newEntry = await createScheduleEntry({
                    schedule_id: scheduleId!,
                    student_name: response.student_name,
                    start_time: firstOccurrence.toISOString(),
                    end_time: newEnd.toISOString(),
                    recurrence_rule: recurrenceRule,
                });
                await updateFormResponseAssigned(responseId, true);
                setResponses(prev => prev.filter(r => r.id !== responseId));
                setEntries(prev => [...prev, newEntry]);
            } catch (err) {
                console.error('Failed to create entry:', err);
                alert('Failed to schedule event');
            }
            return;
        }

        const draggedEntry = entries.find(e => e.id === active.id);
        if (!draggedEntry) return;

        // ── Existing entry dropped onto an empty slot ──
        if (dropId.startsWith('slot-')) {
            const [, day, hourStr] = dropId.split('-');
            const hour = parseInt(hourStr);
            const dayIndex = DAYS.indexOf(day);

            const firstOccurrence = new Date(weekStart!);
            firstOccurrence.setDate(weekStart!.getDate() + dayIndex);
            firstOccurrence.setHours(hour, 0, 0, 0);

            const oldStart = new Date(draggedEntry.start_time);
            const oldEnd = new Date(draggedEntry.end_time);
            const durationMs = oldEnd.getTime() - oldStart.getTime();
            const newEnd = new Date(firstOccurrence.getTime() + durationMs);

            const overlappingEntry = entries.find(entry => {
                if (entry.id === draggedEntry.id) return false;
                const entryStart = new Date(entry.start_time);
                const entryEnd = new Date(entry.end_time);
                if (entryStart.getDay() !== dayIndex) return false;
                return firstOccurrence < entryEnd && newEnd > entryStart;
            });

            if (overlappingEntry) {
                // Slot occupied — offer swap
                const swapAction = async () => {
                    try {
                        const overlappingDuration =
                            new Date(overlappingEntry.end_time).getTime() -
                            new Date(overlappingEntry.start_time).getTime();

                        const newDraggedRule = updateRecurrenceRule(
                            draggedEntry.recurrence_rule,
                            firstOccurrence
                        );
                        const newOverlappingRule = updateRecurrenceRule(
                            overlappingEntry.recurrence_rule,
                            new Date(draggedEntry.start_time)
                        );
                        const overlappingNewEnd = new Date(
                            new Date(draggedEntry.start_time).getTime() + overlappingDuration
                        );

                        // Optimistic UI update
                        setEntries(prev => prev.map(e => {
                            if (e.id === draggedEntry.id) {
                                return {
                                    ...e,
                                    start_time: firstOccurrence.toISOString(),
                                    end_time: newEnd.toISOString(),
                                    recurrence_rule: newDraggedRule,
                                };
                            }
                            if (e.id === overlappingEntry.id) {
                                return {
                                    ...e,
                                    start_time: draggedEntry.start_time,
                                    end_time: overlappingNewEnd.toISOString(),
                                    recurrence_rule: newOverlappingRule,
                                };
                            }
                            return e;
                        }));

                        await updateScheduleEntry(draggedEntry.id, {
                            start_time: firstOccurrence.toISOString(),
                            end_time: newEnd.toISOString(),
                            recurrence_rule: newDraggedRule,
                        });
                        await updateScheduleEntry(overlappingEntry.id, {
                            start_time: draggedEntry.start_time,
                            end_time: overlappingNewEnd.toISOString(),
                            recurrence_rule: newOverlappingRule,
                        });
                    } catch (err) {
                        console.error('Failed to swap events:', err);
                        loadScheduleData();
                    }
                };

                setPendingSwap({
                    eventA: draggedEntry,
                    eventB: overlappingEntry,
                    isConflict: true,
                    swapAction,
                });
                setShowSwapModal(true);
                setActiveDragId(null);
                return;
            }

            // Empty slot — just move
            const newRule = updateRecurrenceRule(draggedEntry.recurrence_rule, firstOccurrence);

            try {
                await updateScheduleEntry(draggedEntry.id, {
                    start_time: firstOccurrence.toISOString(),
                    end_time: newEnd.toISOString(),
                    recurrence_rule: newRule,
                });
                setEntries(prev => prev.map(e =>
                    e.id === draggedEntry.id
                        ? {
                            ...e,
                            start_time: firstOccurrence.toISOString(),
                            end_time: newEnd.toISOString(),
                            recurrence_rule: newRule,
                        }
                        : e
                ));
            } catch (err) {
                console.error('Failed to move event:', err);
                loadScheduleData();
            }
            setActiveDragId(null);
            return;
        }

        // ── Existing entry dropped onto another entry — swap ──
        if (dropId.startsWith('entry-')) {
            const targetEntryId = dropId.replace('entry-', '');
            const targetEntry = entries.find(e => e.id === targetEntryId);
            if (!targetEntry || targetEntry.id === draggedEntry.id) return;

            const swapAction = async () => {
                try {
                    const draggedStart = new Date(draggedEntry.start_time);
                    const draggedEnd = new Date(draggedEntry.end_time);
                    const draggedDurationMs = draggedEnd.getTime() - draggedStart.getTime();

                    const targetStart = new Date(targetEntry.start_time);
                    const targetEnd = new Date(targetEntry.end_time);
                    const targetDurationMs = targetEnd.getTime() - targetStart.getTime();

                    const newDraggedRule = updateRecurrenceRule(
                        draggedEntry.recurrence_rule,
                        targetStart
                    );
                    const newTargetRule = updateRecurrenceRule(
                        targetEntry.recurrence_rule,
                        draggedStart
                    );

                    await updateScheduleEntry(draggedEntry.id, {
                        start_time: targetStart.toISOString(),
                        end_time: new Date(targetStart.getTime() + draggedDurationMs).toISOString(),
                        recurrence_rule: newDraggedRule,
                    });
                    await updateScheduleEntry(targetEntry.id, {
                        start_time: draggedStart.toISOString(),
                        end_time: new Date(draggedStart.getTime() + targetDurationMs).toISOString(),
                        recurrence_rule: newTargetRule,
                    });

                    setEntries(prev => prev.map(e => {
                        if (e.id === draggedEntry.id) {
                            return {
                                ...e,
                                start_time: targetStart.toISOString(),
                                end_time: new Date(targetStart.getTime() + draggedDurationMs).toISOString(),
                                recurrence_rule: newDraggedRule,
                            };
                        }
                        if (e.id === targetEntry.id) {
                            return {
                                ...e,
                                start_time: draggedStart.toISOString(),
                                end_time: new Date(draggedStart.getTime() + targetDurationMs).toISOString(),
                                recurrence_rule: newTargetRule,
                            };
                        }
                        return e;
                    }));
                } catch (err) {
                    console.error('Failed to swap events:', err);
                    loadScheduleData();
                }
            };

            setPendingSwap({
                eventA: draggedEntry,
                eventB: targetEntry,
                isConflict: false,
                swapAction,
            });
            setShowSwapModal(true);
            setActiveDragId(null);
        }
    };

    // ============================================
    // Style Helpers
    // ============================================

    const getEventBlockStyle = (entry: ScheduleEntry) => {
        const startTime = new Date(entry.start_time);
        const endTime = new Date(entry.end_time);
        const startMinutes = startTime.getMinutes();
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        return {
            top: `${(startMinutes / 60) * 40}px`,
            height: `${(durationMinutes / 60) * 40}px`,
        };
    };

    const getResponseDuration = (response: FormResponse) => {
        if (response.preferred_1_start && response.preferred_1_end) {
            const [startH, startM] = response.preferred_1_start.split(':').map(Number);
            const [endH, endM] = response.preferred_1_end.split(':').map(Number);
            return (endH * 60 + endM) - (startH * 60 + startM);
        }
        return 60;
    };

    // ============================================
    // Sub-components
    // ============================================

    function DraggableEventBlock({
        entry,
        children,
    }: {
        entry: ScheduleEntry;
        children: React.ReactNode;
    }) {
        const { attributes, listeners, setNodeRef, isDragging: isBeingDragged } = useDraggable({
            id: entry.id,
            data: entry,
            disabled: isViewOnly,
        });

        return (
            <div
                ref={setNodeRef}
                className={s.eventBlock}
                style={{
                    ...getEventBlockStyle(entry),
                    opacity: isBeingDragged ? 0.3 : 1,
                    pointerEvents: isBeingDragged ? 'none' : 'auto',
                    cursor: isViewOnly ? 'default' : 'grab',
                }}
                onClick={e => {
                    if (!isDragging && !isViewOnly) handleEntryClick(entry, e);
                }}
                {...(!isViewOnly ? { ...attributes, ...listeners } : {})}
                onMouseEnter={e => {
                    if (!isViewOnly) e.currentTarget.style.backgroundColor = '#ea580c';
                }}
                onMouseLeave={e => {
                    if (!isViewOnly) e.currentTarget.style.backgroundColor = '#fb923c';
                }}
            >
                {children}
            </div>
        );
    }

    function DraggableUnassignedCard({
        response,
        children,
    }: {
        response: FormResponse;
        children: React.ReactNode;
    }) {
        const { attributes, listeners, setNodeRef, isDragging: isBeingDragged } = useDraggable({
            id: `unassigned-${response.id}`,
            data: response,
            disabled: isViewOnly,
        });

        return (
            <div
                ref={setNodeRef}
                className={s.unassignedCard}
                style={{
                    opacity: isBeingDragged ? 0.3 : 1,
                    cursor: isViewOnly ? 'default' : 'grab',
                }}
                {...(!isViewOnly ? { ...attributes, ...listeners } : {})}
            >
                {children}
            </div>
        );
    }

    function DroppableSlot({
        children,
        day,
        hour,
    }: {
        children: React.ReactNode;
        day: string;
        hour: number;
    }) {
        const { setNodeRef, isOver } = useDroppable({ id: `slot-${day}-${hour}` });

        return (
            <div
                ref={setNodeRef}
                className={s.timeSlot}
                style={{
                    backgroundColor: isOver ? '#ffedd5' : 'white',
                    cursor: isViewOnly ? 'default' : 'pointer',
                }}
                onClick={() => handleSlotClick(day, hour)}
                onMouseEnter={e => {
                    if (!isViewOnly) {
                        e.currentTarget.style.backgroundColor = '#ffedd5';
                        e.currentTarget.style.cursor = 'pointer';
                    }
                }}
                onMouseLeave={e => {
                    if (!isViewOnly) e.currentTarget.style.backgroundColor = 'white';
                }}
            >
                {children}
            </div>
        );
    }

    // ============================================
    // Render
    // ============================================

    if (loading) {
        return (
            <div className={s.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#6b7280', fontSize: '1.125rem' }}>Loading schedule...</div>
            </div>
        );
    }

    if (!schedule) {
        return (
            <div className={s.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ color: '#991b1b', fontSize: '1.125rem' }}>
                    {error || 'Schedule not found'}
                </div>
                <button onClick={() => navigate('/dashboard')} className={s.backButton} style={{ backgroundColor: '#f97316', color: 'white', borderColor: '#f97316' }}>
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className={s.container}>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => {
                    setActiveDragId(null);
                    setIsDragging(false);
                    setEntryToDelete(null);
                }}
                autoScroll={false}
            >
                <header className={s.toolbar}>
                    <div className={s.toolbarContent}>
                        {/* Left: Back & Title */}
                        <div className={s.leftSection}>
                            <button onClick={() => navigate('/dashboard')} className={`${s.backButton} ${s.dashboardBackButton}`}>
                                <ArrowLeft size={18} />
                            </button>
                            <div className={s.titleArea}>
                                {isEditingTitle ? (
                                    <input
                                        type="text"
                                        value={editedTitle}
                                        onChange={e => setEditedTitle(e.target.value)}
                                        onBlur={handleTitleSave}
                                        onKeyDown={handleTitleKeyDown}
                                        className={s.titleInput}
                                        autoFocus
                                    />
                                ) : (
                                    <h1
                                        className={`${s.title} ${!isViewOnly ? s.editable : ''}`}
                                        onClick={handleTitleClick}
                                        title={!isViewOnly ? 'Click to edit' : undefined}
                                    >
                                        {schedule.label}
                                    </h1>
                                )}
                                {isEditingDates ? (
                                    <div className={s.dateInputRow}>
                                        <input
                                            type="date"
                                            value={editedStartDate}
                                            onChange={e => setEditedStartDate(e.target.value)}
                                            onBlur={handleDatesBlur}
                                            onKeyDown={handleDatesKeyDown}
                                            className={s.dateInput}
                                            autoFocus
                                        />
                                        <span className={s.dateSeparator}>–</span>
                                        <input
                                            type="date"
                                            value={editedEndDate}
                                            onChange={e => setEditedEndDate(e.target.value)}
                                            onBlur={handleDatesBlur}
                                            onKeyDown={handleDatesKeyDown}
                                            className={s.dateInput}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className={`${s.subtitle} ${!isViewOnly ? s.editable : ''}`}
                                        onClick={handleDatesClick}
                                        title={!isViewOnly ? 'Click to edit' : undefined}
                                    >
                                        {formatLocalDate(parseLocalDate(schedule.start_date))} – {formatLocalDate(parseLocalDate(schedule.end_date))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Center: Week Navigation */}
                        <div className={s.centerSection}>
                            <button
                                onClick={goToPreviousWeek}
                                className={s.iconButton}
                                disabled={currentWeekOffset === 0}
                                style={{ opacity: currentWeekOffset === 0 ? 0.4 : 1 }}
                                title="Previous Week"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '180px', textAlign: 'center' }}>
                                {weekStart && weekEnd ? (
                                    <>
                                        {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        <div style={{ color: 'var(--text-400)', fontWeight: 400, fontSize: '0.75rem', marginTop: '2px' }}>
                                            Week {weekNumber} of {totalWeeks}
                                        </div>
                                    </>
                                ) : `Week ${weekNumber} of ${totalWeeks}`}
                            </div>
                            <button
                                onClick={goToNextWeek}
                                className={s.iconButton}
                                disabled={currentWeekOffset >= totalWeeks - 1}
                                style={{ opacity: currentWeekOffset >= totalWeeks - 1 ? 0.4 : 1 }}
                                title="Next Week"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        {/* Right: Actions */}
                        <div className={s.rightSection}>
                            {/* Events Dropdown */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    className={s.iconButton}
                                    onClick={() => { setIsEventsOpen(!isEventsOpen); setIsInfoOpen(false); }}
                                    title="Unassigned Events"
                                >
                                    <List size={18} />
                                    {getUnassignedParticipants().length > 0 && (
                                        <div className={s.badge} style={{ position: 'absolute', top: -4, right: -4 }}>
                                            {getUnassignedParticipants().length}
                                        </div>
                                    )}
                                </button>

                                {isEventsOpen && (
                                    <>
                                        <div className={s.popoverOverlay} onClick={() => setIsEventsOpen(false)} />
                                        <div className={s.popover}>
                                            <div className={s.popoverHeader}>
                                                <h3 className={s.popoverTitle}>Unassigned Participants</h3>
                                                <button
                                                    onClick={() => getUnassignedParticipants().length > 0 && setShowSchedulingPreview(true)}
                                                    disabled={getUnassignedParticipants().length === 0}
                                                    className={s.activateButton}
                                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                >
                                                    <Sparkles size={12} />
                                                    Schedule All
                                                </button>
                                            </div>
                                            <div className={s.popoverContent}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    {getUnassignedParticipants().map(response => (
                                                        <DraggableUnassignedCard key={response.id} response={response}>
                                                            <div
                                                                className={s.unassignedCardName}
                                                                onClick={() => !isDragging && setResponseToView(response)}
                                                                style={{ cursor: 'pointer', flex: 1 }}
                                                            >
                                                                {response.student_name}
                                                            </div>
                                                            <Trash2
                                                                size={14}
                                                                className={s.unassignedCardIcon}
                                                                onClick={e => { e.stopPropagation(); setParticipantToDelete(response); }}
                                                            />
                                                        </DraggableUnassignedCard>
                                                    ))}
                                                    {getUnassignedParticipants().length === 0 && (
                                                        <div className={s.emptyState}>No unassigned participants</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Settings Dropdown */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    className={s.iconButton}
                                    onClick={() => { setIsInfoOpen(!isInfoOpen); setIsEventsOpen(false); }}
                                    title="Schedule Settings Options"
                                >
                                    <Settings size={18} />
                                </button>

                                {isInfoOpen && (
                                    <>
                                        <div className={s.popoverOverlay} onClick={() => setIsInfoOpen(false)} />
                                        <div className={s.popover}>
                                            <div className={s.popoverHeader}>
                                                <h3 className={s.popoverTitle}>Schedule Settings</h3>
                                            </div>
                                            <div className={s.popoverContent}>
                                                <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    <div>
                                                        <span style={{ color: 'var(--text-500)', display: 'block', marginBottom: '0.25rem' }}>Status</span>
                                                        <span style={{ fontWeight: 600 }}>{getStatusLabel(schedule.status)}</span>
                                                    </div>

                                                    <div style={{ borderTop: '1px solid var(--border-divider)', paddingTop: '1rem' }}>
                                                        <span style={{ color: 'var(--text-500)', display: 'block', marginBottom: '0.5rem' }}>Export</span>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button
                                                                onClick={() => { if (weekStart) exportToICS(schedule, entries); setIsInfoOpen(false); }}
                                                                className={s.toolbarButton}
                                                                style={{ flex: 1, justifyContent: 'center' }}
                                                            >
                                                                <Calendar size={14} />
                                                                <span>iCal</span>
                                                            </button>
                                                            <button
                                                                onClick={() => { if (weekStart) exportToPDF(schedule, entries, weekStart); setIsInfoOpen(false); }}
                                                                className={s.toolbarButton}
                                                                style={{ flex: 1, justifyContent: 'center' }}
                                                            >
                                                                <FileText size={14} />
                                                                <span>PDF</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', borderTop: '1px solid var(--border-divider)', paddingTop: '1rem' }}>
                                                        {schedule.status !== 'draft' && !isViewOnly && (
                                                            <button
                                                                onClick={() => { setShowConfigureFormModal(true); setIsInfoOpen(false); }}
                                                                className={s.toolbarButton}
                                                                style={{ width: '100%', justifyContent: 'flex-start' }}
                                                            >
                                                                <Settings size={14} />
                                                                <span>Edit Form Configuration</span>
                                                            </button>
                                                        )}
                                                        {schedule.status === 'collecting' && !isViewOnly && (
                                                            <button
                                                                onClick={handleArchive}
                                                                className={s.toolbarButton}
                                                                style={{ width: '100%', justifyContent: 'flex-start' }}
                                                            >
                                                                <Layout size={14} />
                                                                <span>Archive Schedule</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setShowTrashConfirm(true)}
                                                            className={s.toolbarButton}
                                                            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--brand-error)', borderColor: 'rgba(220, 38, 38, 0.1)' }}
                                                        >
                                                            <Trash2 size={14} />
                                                            <span>Move to Trash</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Form Link & Publish Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {(() => {
                                    if (isViewOnly) return null;

                                    switch (schedule.status) {
                                        case 'draft':
                                            return (
                                                <button onClick={() => setShowConfigureFormModal(true)} className={s.activateButton}>
                                                    <Sparkles size={16} />
                                                    <span>Configure & Activate</span>
                                                </button>
                                            );
                                        case 'collecting':
                                            return (
                                                <>
                                                    <button
                                                        className={`${s.toolbarButton} ${isCopied ? s.successButton : ''}`}
                                                        onClick={handleCopyLink}
                                                        style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
                                                    >
                                                        <div className={s.pulse} />
                                                        <span>{isCopied ? 'Copied!' : 'Copy Form Link'}</span>
                                                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                                    </button>

                                                    <button
                                                        className={s.activateButton}
                                                        onClick={handlePublish}
                                                        disabled={isPublishing || entries.length === 0}
                                                        title={entries.length === 0 ? 'Add events before publishing' : 'Lock schedule and notify participants'}
                                                    >
                                                        <Sparkles size={16} />
                                                        <span>{isPublishing ? 'Publishing...' : 'Publish Schedule'}</span>
                                                    </button>
                                                </>
                                            );
                                        case 'published':
                                            return (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-success-bg)', fontWeight: 600, padding: '0.5rem 0.85rem', background: 'var(--bg-orange-50)', borderRadius: '9999px', border: '1px solid currentColor' }}>
                                                    <Check size={16} />
                                                    <span>Published</span>
                                                </div>
                                            );
                                        default:
                                            return null;
                                    }
                                })()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Timetable */}
                <main className={s.main}>
                    <div className={s.timetableContainer}>
                        <div className={s.timetableHeader}>
                            <div className={s.dayHeader} />
                            {DAYS.map((day, index) => {
                                const date = weekStart ? new Date(weekStart) : null;
                                if (date) date.setDate(date.getDate() + index);
                                return (
                                    <div key={day} className={s.dayHeader}>
                                        <span>{day}</span>
                                        <span className={s.dayHeaderDate}>
                                            {date ? (
                                                <>
                                                    <span style={{ fontSize: '0.65rem', marginRight: '0.15rem' }}>
                                                        {date.toLocaleDateString(undefined, { month: 'short' })}
                                                    </span>
                                                    {date.getDate()}
                                                </>
                                            ) : ''}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ position: 'relative' }}>
                            {HOURS.map(hour => (
                                <div key={hour} className={s.timetableGrid}>
                                    <div className={s.timeLabel}>
                                        {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                                    </div>
                                    {DAYS.map(day => {
                                        const slotEntries = getEntriesForSlot(day, hour);
                                        return (
                                            <DroppableSlot key={`${day}-${hour}`} day={day} hour={hour}>
                                                {slotEntries.map(entry => (
                                                    <DraggableEventBlock key={entry.id} entry={entry}>
                                                        <div style={{ fontWeight: '600' }}>{entry.student_name}</div>
                                                        <div style={{ fontSize: '0.625rem', opacity: 0.9 }}>
                                                            {formatLocalTime(entry.start_time)} – {formatLocalTime(entry.end_time)}
                                                        </div>
                                                    </DraggableEventBlock>
                                                ))}
                                            </DroppableSlot>
                                        );
                                    })}
                                </div>
                            ))}

                            <div style={{ position: 'absolute', bottom: 0, left: 0 }}>
                                <div className={s.timeLabelFooter}>
                                    {(() => {
                                        const h = schedule.working_hours_end ?? 21;
                                        return h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Modals */}
                <AddEventModal
                    isOpen={showAddModal}
                    onClose={() => { setShowAddModal(false); setSelectedEntry(null); setSelectedSlot(null); }}
                    onSuccess={handleEventSaved}
                    scheduleId={scheduleId!}
                    initialDay={selectedSlot?.day}
                    initialHour={selectedSlot?.hour}
                    scheduleStartDate={schedule.start_date}
                    existingEntry={selectedEntry}
                    onNeedDeleteConfirmation={() => setEntryToDelete(selectedEntry)}
                    workingHoursStart={schedule.working_hours_start ?? 8}
                    workingHoursEnd={schedule.working_hours_end ?? 21}
                />

                <SwapConfirmModal
                    isOpen={showSwapModal}
                    onClose={() => { setShowSwapModal(false); setPendingSwap(null); }}
                    onConfirm={() => { pendingSwap?.swapAction(); setPendingSwap(null); }}
                    eventA={pendingSwap?.eventA ?? null}
                    eventB={pendingSwap?.eventB ?? null}
                    isConflict={pendingSwap?.isConflict}
                />

                <Modal isOpen={!!participantToDelete} onClose={() => setParticipantToDelete(null)} title="Delete Participant" maxWidth="30rem">
                    <div style={{ padding: '0.5rem 0' }}>
                        <p style={{ color: '#374151', marginBottom: '1rem' }}>
                            Delete <strong>{participantToDelete?.student_name}</strong>? This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={async () => {
                                    if (!participantToDelete) return;
                                    try {
                                        await deleteFormResponse(participantToDelete.id);
                                        setResponses(prev => prev.filter(r => r.id !== participantToDelete.id));
                                        setParticipantToDelete(null);
                                    } catch (err) {
                                        console.error('Failed to delete participant:', err);
                                    }
                                }}
                                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => setParticipantToDelete(null)}
                                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>

                <Modal
                    isOpen={!!entryToDelete}
                    onClose={() => { setEntryToDelete(null); setActiveDragId(null); setIsDragging(false); }}
                    title="Delete Event"
                    maxWidth="35rem"
                >
                    <div style={{ padding: '0.5rem 0' }}>
                        <p style={{ color: '#374151', marginBottom: '1rem' }}>
                            Delete <strong>{entryToDelete?.student_name}</strong>? This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={async () => {
                                    if (!entryToDelete) return;
                                    try {
                                        await deleteScheduleEntry(entryToDelete.id);
                                        setEntries(prev => prev.filter(e => e.id !== entryToDelete.id));
                                        setEntryToDelete(null);
                                        setActiveDragId(null);
                                        setIsDragging(false);
                                        if (selectedEntry?.id === entryToDelete.id) {
                                            setShowAddModal(false);
                                            setSelectedEntry(null);
                                        }
                                    } catch (err) {
                                        console.error('Failed to delete event:', err);
                                    }
                                }}
                                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => { setEntryToDelete(null); setActiveDragId(null); setIsDragging(false); }}
                                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>

                <SchedulingPreviewModal
                    isOpen={showSchedulingPreview}
                    onClose={() => setShowSchedulingPreview(false)}
                    participants={getUnassignedParticipants()}
                    existingEntries={entries}
                    scheduleStart={parseLocalDate(schedule.start_date)}
                    scheduleId={scheduleId!}
                    onScheduled={loadScheduleData}
                    workingHoursStart={schedule.working_hours_start ?? 8}
                    workingHoursEnd={schedule.working_hours_end ?? 21}
                />

                <ConfigureFormModal
                    isOpen={showConfigureFormModal}
                    onClose={() => setShowConfigureFormModal(false)}
                    onConfigured={loadScheduleData}
                    schedule={schedule}
                />

                <Modal isOpen={!!responseToView} onClose={() => setResponseToView(null)} title="Event Details" maxWidth="35rem">
                    {responseToView && (
                        <div style={{ padding: '0.25rem 0' }}>
                            <div className={s.detailModalCard}>
                                <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                                    <div style={{ fontWeight: '600', fontSize: '1.125rem', color: '#92400e' }}>{responseToView.student_name}</div>
                                    {responseToView.email && (
                                        <div style={{ fontSize: '0.875rem', color: '#a16207', marginTop: '0.25rem' }}>{responseToView.email}</div>
                                    )}
                                </div>
                                <div style={{ padding: '1rem' }}>
                                    {getPreferredTimings(responseToView).map((timing, index) => (
                                        <div key={index} className={s.detailModalPreferenceCard}>
                                            <div className={s.detailModalPreferenceLabel}>
                                                {index === 0 ? '1st Choice' : index === 1 ? '2nd Choice' : '3rd Choice'}
                                            </div>
                                            <div className={s.detailModalPreferenceValue}>
                                                {timing.day} {formatTime(timing.start)} – {formatTime(timing.end)}
                                                {timing.duration && ` (${timing.duration} min)`}
                                                <br />
                                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                    {formatFrequency(timing.frequency)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                                <button
                                    onClick={() => { setResponseToView(null); setParticipantToDelete(responseToView); }}
                                    style={{ flex: 1, padding: '0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500' }}
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setResponseToView(null)}
                                    style={{ flex: 1, padding: '0.75rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </Modal>

                <Modal isOpen={showTrashConfirm} onClose={() => setShowTrashConfirm(false)} title="Move Schedule to Trash" maxWidth="30rem">
                    <div style={{ padding: '0.5rem 0' }}>
                        <p style={{ color: '#374151', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                            Are you sure you want to move <strong>{schedule.label}</strong> to trash?
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowTrashConfirm(false)}
                                style={{ padding: '0.625rem 1.25rem', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleTrashWithRedirect}
                                style={{ padding: '0.625rem 1.25rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}
                            >
                                Move to Trash
                            </button>
                        </div>
                    </div>
                </Modal>

                <DragOverlay dropAnimation={null}>
                    {activeDragId && (() => {
                        if (typeof activeDragId === 'string' && activeDragId.startsWith('unassigned-')) {
                            const responseId = activeDragId.replace('unassigned-', '');
                            const response = responses.find(r => r.id === responseId);
                            if (!response) return null;
                            const duration = getResponseDuration(response);
                            return (
                                <div
                                    className={s.eventBlock}
                                    style={{
                                        height: `${(duration / 60) * 40}px`,
                                        width: '180px',
                                        position: 'relative',
                                        top: 0,
                                        opacity: 0.95,
                                        cursor: 'grabbing',
                                        zIndex: 10000,
                                        boxShadow: '0 20px 50px rgba(0,0,0,0.3), 0 4px 15px rgba(0,0,0,0.1)',
                                        transform: 'scale(1.05)',
                                    }}
                                >
                                    <div style={{ fontWeight: '600' }}>{response.student_name}</div>
                                    <div style={{ fontSize: '0.625rem', opacity: 0.9 }}>{duration} minutes</div>
                                </div>
                            );
                        }
                        const entry = entries.find(e => e.id === activeDragId);
                        if (!entry) return null;
                        return (
                            <div
                                className={s.eventBlock}
                                style={{
                                    ...getEventBlockStyle(entry),
                                    top: 0,
                                    opacity: 0.95,
                                    cursor: 'grabbing',
                                    zIndex: 10000,
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.3), 0 4px 15px rgba(0,0,0,0.1)',
                                    transform: 'scale(1.05)',
                                }}
                            >
                                <div style={{ fontWeight: '600' }}>{entry.student_name}</div>
                                <div style={{ fontSize: '0.625rem', opacity: 0.9 }}>
                                    {formatLocalTime(entry.start_time)} – {formatLocalTime(entry.end_time)}
                                </div>
                            </div>
                        );
                    })()}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
