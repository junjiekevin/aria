// src/pages/DashboardPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSchedules, type Schedule, restoreSchedule, permanentDeleteAllTrashed, updateSchedule, permanentDeleteSchedule } from '../lib/api/schedules';
import { supabase } from '../lib/supabase';
import { Plus, Calendar, Clock, Archive, Trash2, FileText, RotateCcw, XCircle, Sparkles } from 'lucide-react';
import CreateScheduleModal from '../components/CreateScheduleModal';
import EditScheduleModal from '../components/EditScheduleModal';
import ProfileDropdown from '../components/ProfileDropdown';
import logo from '../assets/images/logo-with-text.png';
import s from './DashboardPage.module.css';


interface StatusBadgeProps {
	status: Schedule['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
	const statusConfig: Record<Schedule['status'], { label: string; icon: any; className: string }> = {
		draft: {
			label: 'Draft',
			icon: FileText,
			className: s.statusBadgeDraft
		},
		collecting: {
			label: 'Active',
			icon: Clock,
			className: s.statusBadgeCollecting
		},
		archived: {
			label: 'Archived',
			icon: Archive,
			className: s.statusBadgeArchived
		},
		trashed: {
			label: 'Trashed',
			icon: Trash2,
			className: s.statusBadgeTrashed
		}
	};

	const config = statusConfig[status];
	const Icon = config.icon;

	return (
		<div className={`${s.statusBadge} ${config.className}`}>
			<Icon size={14} />
			{config.label}
		</div>
	);
}

function ScheduleCard({
	schedule,
	onView,
	onEdit,
	onTrash,
	onArchive,
	onRecover,
	onRename,
	onHardDelete,
	isTrashed = false
}: {
	schedule: Schedule;
	onView: (schedule: Schedule) => void;
	onEdit: () => void;
	onTrash?: (schedule: Schedule) => void;
	onArchive?: (schedule: Schedule) => void;
	onRecover?: (schedule: Schedule) => void;
	onRename?: (schedule: Schedule, newLabel: string) => void;
	onHardDelete?: (schedule: Schedule) => void;
	isTrashed?: boolean;
}) {
	const [isEditingName, setIsEditingName] = useState(false);
	const [editingName, setEditingName] = useState(schedule.label);
	const nameInputRef = useRef<HTMLInputElement>(null);

	const formatDate = (dateString: string) => {
		const [year, month, day] = dateString.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	};

	const handleNameClick = () => {
		if (!isTrashed && onRename) {
			setIsEditingName(true);
			setEditingName(schedule.label);
			setTimeout(() => nameInputRef.current?.focus(), 50);
		}
	};

	const handleNameBlur = () => {
		if (isEditingName) {
			setIsEditingName(false);
			const trimmedName = editingName.trim();
			if (trimmedName && trimmedName !== schedule.label) {
				onRename?.(schedule, trimmedName);
			} else {
				setEditingName(schedule.label);
			}
		}
	};

	const handleNameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') handleNameBlur();
		else if (e.key === 'Escape') {
			setIsEditingName(false);
			setEditingName(schedule.label);
		}
	};

	return (
		<div
			className={s.card}
			style={{
				opacity: isTrashed ? 0.65 : 1,
				backgroundColor: isTrashed ? '#fafafa' : 'white',
				transform: isTrashed ? 'none' : undefined,
			}}
			onMouseEnter={(e) => {
				if (!isTrashed) {
					e.currentTarget.style.transform = 'translateY(-2px)';
					e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.1)';
				}
			}}
			onMouseLeave={(e) => {
				if (!isTrashed) {
					e.currentTarget.style.transform = '';
					e.currentTarget.style.boxShadow = '';
				}
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
					<div style={{ flex: 1 }}>
						{isEditingName ? (
							<input
								ref={nameInputRef}
								type='text'
								value={editingName}
								onChange={(e) => setEditingName(e.target.value)}
								onBlur={handleNameBlur}
								onKeyDown={handleNameKeyDown}
								style={{
									fontSize: '1.125rem',
									fontWeight: '600',
									color: '#111827',
									margin: '0 0 0.5rem 0',
									padding: '0.5rem 0.75rem',
									border: '2px solid #f97316',
									borderRadius: '8px',
									width: '100%',
									maxWidth: '320px',
									outline: 'none',
								}}
							/>
						) : (
							<h3
								onClick={handleNameClick}
								style={{
									fontSize: '1.125rem',
									fontWeight: '600',
									color: isTrashed ? '#6b7280' : '#111827',
									margin: '0 0 0.5rem 0',
									cursor: isTrashed ? 'default' : 'pointer',
									transition: 'color 0.2s',
									display: 'flex',
									alignItems: 'center',
									gap: '0.5rem',
								}}
								onMouseEnter={(e) => { if (!isTrashed) e.currentTarget.style.color = '#f97316'; }}
								onMouseLeave={(e) => { if (!isTrashed) e.currentTarget.style.color = '#111827'; }}
							>
								{schedule.label}
								{isTrashed && <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#9ca3af' }}>(Trashed)</span>}
							</h3>
						)}
						<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isTrashed ? '#9ca3af' : '#6b7280', fontSize: '0.875rem' }}>
							<Calendar size={16} />
							<span>{formatDate(schedule.start_date)} – {formatDate(schedule.end_date)}</span>
						</div>
					</div>
					<StatusBadge status={schedule.status} />
				</div>

				<div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.25rem' }}>
					{isTrashed ? (
						<>
							<button
								onClick={() => onRecover?.(schedule)}
								className={s.button}
								style={{ flex: 1, backgroundColor: '#10b981', borderRadius: '12px' }}
							>
								<RotateCcw size={16} />
								Recover
							</button>
							<button
								onClick={() => onHardDelete?.(schedule)}
								className={s.button}
								style={{ flex: 1, backgroundColor: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '12px' }}
							>
								<XCircle size={16} />
								Delete
							</button>
						</>
					) : schedule.status === 'archived' ? (
						<>
							<button
								onClick={() => onView?.(schedule)}
								className={s.button}
								style={{ flex: 1, borderRadius: '12px' }}
							>
								<Sparkles size={16} />
								View
							</button>
							<button
								onClick={() => onRecover?.(schedule)}
								className={s.button}
								style={{ flex: 1, backgroundColor: '#10b981', borderRadius: '12px' }}
							>
								<RotateCcw size={16} />
								Restore
							</button>
							<button
								onClick={() => onTrash?.(schedule)}
								className={s.button}
								style={{ flex: 1, backgroundColor: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '12px' }}
							>
								<Trash2 size={16} />
								Trash
							</button>
						</>
					) : (
						<>
							<button
								onClick={() => onView(schedule)}
								className={s.button}
								style={{ flex: 1, borderRadius: '12px' }}
							>
								<Sparkles size={16} />
								View
							</button>
							<button
								onClick={onEdit}
								className={s.button}
								style={{ flex: 1, backgroundColor: 'white', color: '#374151', border: '1px solid #e5e7eb', boxShadow: 'none', borderRadius: '12px' }}
							>
								Edit
							</button>
							{schedule.status === 'collecting' && (
								<button
									onClick={() => onArchive?.(schedule)}
									className={s.button}
									style={{ backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', boxShadow: 'none', padding: '0.75rem', borderRadius: '12px' }}
									title="Archive"
								>
									<Archive size={16} />
								</button>
							)}
							<button
								onClick={() => onTrash?.(schedule)}
								className={s.button}
								style={{ backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid #e5e7eb', boxShadow: 'none', padding: '0.75rem', borderRadius: '12px' }}
							>
								<Trash2 size={16} />
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

function EmptyState({ onCreateSchedule }: { onCreateSchedule: () => void }) {
	return (
		<div className={s.emptyState}>
			<div className={s.emptyIcon}>
				<Calendar size={40} color='white' />
			</div>
			<h2 className={s.emptyTitle}>Welcome to Aria!</h2>
			<p className={s.emptyText}>
				Let's create your first schedule. It only takes a moment to get started.
			</p>
			<button
				onClick={onCreateSchedule}
				className={s.button}
			>
				<Plus size={20} />
				Create Schedule
			</button>
		</div>
	);
}

function TrashedEmptyState({ count, onViewTrash }: { count: number; onViewTrash: () => void }) {
	return (
		<div className={s.emptyState}>
			<div className={s.trashedEmptyIcon}>
				<Trash2 size={40} color='#f59e0b' />
			</div>
			<h2 className={s.emptyTitle}>All caught up!</h2>
			<p className={s.emptyText}>
				You have {count} schedule{count > 1 ? 's' : ''} in trash. They will be permanently deleted after 30 days.
			</p>
			<button
				onClick={onViewTrash}
				className={s.button}
			>
				<Trash2 size={18} />
				View Trash
			</button>
		</div>
	);
}

export default function DashboardPage() {
	const navigate = useNavigate();
	const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string } } | null>(null);
	const [schedules, setSchedules] = useState<Schedule[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
	const [filter, setFilter] = useState<'all' | 'draft' | 'collecting' | 'archived' | 'trashed'>('all');
	const [showTrashConfirm, setShowTrashConfirm] = useState(false);
	const [scheduleToTrash, setScheduleToTrash] = useState<Schedule | null>(null);
	const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
	const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

	useEffect(() => {
		loadSchedules();
		loadUser();

		// Listen for schedule changes from chat
		const handleScheduleChange = () => {
			loadSchedules();
		};
		window.addEventListener('aria-schedule-change', handleScheduleChange);

		return () => {
			window.removeEventListener('aria-schedule-change', handleScheduleChange);
		};
	}, []);

	const loadSchedules = async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await getAllSchedules();
			setSchedules(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load schedules');
		} finally {
			setLoading(false);
		}
	};

	const loadUser = async () => {
		const { data: { user } } = await supabase.auth.getUser();
		setUser(user);
	};

	const showToast = (message: string, type: 'success' | 'error' = 'success') => {
		setToast({ message, type });
		setTimeout(() => setToast(null), 4000);
	};

	const handleCreateSchedule = () => setShowCreateModal(true);

	const handleScheduleCreated = () => {
		showToast('Schedule created successfully!');
		loadSchedules();
	};

	const handleViewSchedule = (schedule: Schedule) => {
		navigate(`/schedule/${schedule.id}`);
	};

	const handleEditSchedule = (schedule: Schedule) => {
		setSelectedSchedule(schedule);
		setShowEditModal(true);
	};

	const handleScheduleUpdated = () => {
		showToast('Schedule updated successfully!');
		loadSchedules();
	};

	const handleTrashClick = (schedule: Schedule) => {
		setScheduleToTrash(schedule);
		setShowTrashConfirm(true);
	};

	const handleTrashConfirm = async () => {
		if (!scheduleToTrash) return;
		try {
			await trashSchedule(scheduleToTrash.id);
			showToast('Schedule moved to trash');
			loadSchedules();
		} catch (err) {
			showToast('Failed to move schedule to trash', 'error');
		}
		setShowTrashConfirm(false);
		setScheduleToTrash(null);
	};

	const handleArchive = async (schedule: Schedule) => {
		try {
			await updateSchedule(schedule.id, {
				status: 'archived',
				previous_status: schedule.status as 'draft' | 'collecting' | 'archived'
			});
			showToast('Schedule archived');
			loadSchedules();
		} catch (err) {
			showToast('Failed to archive schedule', 'error');
		}
	};

	const handleRecover = async (schedule: Schedule) => {
		try {
			await restoreSchedule(schedule.id);
			showToast('Schedule restored successfully!');
			loadSchedules();
		} catch (err) {
			showToast('Failed to restore schedule', 'error');
		}
	};

	const handleRename = async (schedule: Schedule, newLabel: string) => {
		try {
			await updateSchedule(schedule.id, { label: newLabel });
			showToast('Schedule renamed');
			loadSchedules();
		} catch (err) {
			showToast('Failed to rename schedule', 'error');
		}
	};

	const handleHardDelete = async (schedule: Schedule) => {
		try {
			await permanentDeleteSchedule(schedule.id);
			showToast('Schedule permanently deleted');
			loadSchedules();
		} catch (err) {
			showToast('Failed to delete schedule', 'error');
		}
	};

	const trashSchedule = async (id: string) => {
		const { error } = await supabase
			.from('schedules')
			.update({ status: 'trashed' })
			.eq('id', id);
		if (error) throw error;
	};

	const getTimeBasedGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 17) return 'Good afternoon';
		return 'Good evening';
	};

	const getUserFirstName = () => {
		if (user?.user_metadata?.full_name) {
			return user.user_metadata.full_name.split(' ')[0];
		}
		if (user?.email) {
			return user.email.split('@')[0];
		}
		return '';
	};

	const filterTabs = [
		{ key: 'all', label: 'All' },
		{ key: 'draft', label: 'Draft' },
		{ key: 'collecting', label: 'Active' },
		{ key: 'archived', label: 'Archived' },
		{ key: 'trashed', label: 'Trash' },
	];

	const getFilteredSchedules = () => {
		if (filter === 'all') return schedules;
		return schedules.filter(s => s.status === filter);
	};

	const getFilteredCount = (tabKey: string) => {
		if (tabKey === 'all') return schedules.length;
		return schedules.filter(s => s.status === tabKey).length;
	};

	const visibleSchedules = getFilteredSchedules();
	const showAllTrashedEmptyState = filter === 'all' && schedules.length > 0 && schedules.every(s => s.status === 'trashed');

	if (loading) {
		return (
			<div className={s.page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<div style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={s.page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<div style={{ textAlign: 'center', color: '#dc2626' }}>
					{error}
					<button onClick={loadSchedules} style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#f97316', textDecoration: 'underline', cursor: 'pointer' }}>Try again</button>
				</div>
			</div>
		);
	}

	return (
		<div className={s.page}>
			{/* Persistent Header */}
			<header className={s.header}>
				<div className={s.headerContent}>
					<div className={s.logoSection}>
						<img src={logo} alt="Aria" className={s.logo} />
					</div>

					<div className={s.greetingSection}>
						<h1 className={s.greeting}>
							{getTimeBasedGreeting()}, {getUserFirstName() || 'there'}!
						</h1>
					</div>

					<div className={s.headerActions}>
						<ProfileDropdown user={user!} />
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className={s.main}>
				{/* Action Row: Filters + Create Button */}
				<div className={s.actionRow}>
					<div className={s.filterBar}>
						<div className={s.filterTabsContainer}>
							{filterTabs.map((tab) => (
								<button
									key={tab.key}
									onClick={() => setFilter(tab.key as any)}
									className={`${s.tab} ${filter === tab.key ? s.tabActive : ''}`}
								>
									{tab.key === 'collecting' ? <Clock size={16} /> :
										tab.key === 'archived' ? <Archive size={16} /> :
											tab.key === 'draft' ? <FileText size={16} /> :
												tab.key === 'trashed' ? <Trash2 size={16} /> :
													<Calendar size={16} />}
									<span>{tab.label}</span>
									{getFilteredCount(tab.key) > 0 && (
										<span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '0.125rem' }}>
											({getFilteredCount(tab.key)})
										</span>
									)}
								</button>
							))}
						</div>

						{filter === 'trashed' && schedules.filter(s => s.status === 'trashed').length > 0 && (
							<button
								onClick={() => setShowDeleteAllConfirm(true)}
								style={{
									background: 'none',
									border: 'none',
									color: '#f97316',
									fontSize: '0.8125rem',
									fontWeight: '600',
									cursor: 'pointer',
									display: 'flex',
									alignItems: 'center',
									gap: '0.375rem',
									padding: '0.5rem'
								}}
							>
								<Trash2 size={14} />
								Empty Trash
							</button>
						)}
					</div>

					<button
						onClick={handleCreateSchedule}
						className={`${s.button} ${s.createButtonMain}`}
					>
						<Plus size={20} />
						<span>Create Schedule</span>
					</button>
				</div>

				<div className={s.scheduleList}>
					{visibleSchedules.map((schedule) => (
						<ScheduleCard
							key={schedule.id}
							schedule={schedule}
							isTrashed={schedule.status === 'trashed'}
							onView={handleViewSchedule}
							onEdit={() => handleEditSchedule(schedule)}
							onTrash={handleTrashClick}
							onArchive={handleArchive}
							onRecover={handleRecover}
							onRename={handleRename}
							onHardDelete={handleHardDelete}
						/>
					))}
				</div>

				{visibleSchedules.length === 0 && !showAllTrashedEmptyState && (
					<EmptyState onCreateSchedule={handleCreateSchedule} />
				)}

				{showAllTrashedEmptyState && (
					<TrashedEmptyState
						count={schedules.filter(s => s.status === 'trashed').length}
						onViewTrash={() => setFilter('trashed')}
					/>
				)}
			</main>

			{/* Modals */}
			<CreateScheduleModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSuccess={handleScheduleCreated} />
			<EditScheduleModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} schedule={selectedSchedule} onSuccess={handleScheduleUpdated} />

			{/* Trash Confirmation */}
			{showTrashConfirm && (
				<div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowTrashConfirm(false)}>
					<div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
						<h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Move to Trash?</h3>
						<p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Are you sure you want to move <strong>{scheduleToTrash?.label}</strong> to trash?</p>
						<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
							<button onClick={() => setShowTrashConfirm(false)} style={{ padding: '0.625rem 1.25rem', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '12px', cursor: 'pointer' }}>Cancel</button>
							<button onClick={handleTrashConfirm} className={s.button} style={{ borderRadius: '12px' }}>Move to Trash</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete All Confirmation */}
			{showDeleteAllConfirm && (
				<div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowDeleteAllConfirm(false)}>
					<div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
						<h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 1rem 0' }}>Delete All?</h3>
						<p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>This will permanently delete all {schedules.filter(s => s.status === 'trashed').length} trashed schedules. This action cannot be undone.</p>
						<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
							<button onClick={() => setShowDeleteAllConfirm(false)} style={{ padding: '0.625rem 1.25rem', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '12px', cursor: 'pointer' }}>Cancel</button>
							<button onClick={async () => { await permanentDeleteAllTrashed(); showToast('All schedules deleted'); loadSchedules(); setShowDeleteAllConfirm(false); }} className={s.button} style={{ background: '#dc2626', borderRadius: '12px' }}>Delete All</button>
						</div>
					</div>
				</div>
			)}

			{/* Toast */}
			{/* Mobile FAB */}
			<button
				className={s.fab}
				onClick={handleCreateSchedule}
				aria-label="Create Schedule"
				style={{ display: window.innerWidth < 640 ? 'flex' : 'none' }}
			>
				<Plus size={28} />
			</button>

			{toast && (
				<div className={`${s.toast} ${toast.type === 'success' ? s.toastSuccess : s.toastError}`}>
					{toast.message}
				</div>
			)}
		</div>
	);
}
