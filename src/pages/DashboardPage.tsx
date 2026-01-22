// src/pages/DashboardPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSchedules, type Schedule, restoreSchedule, permanentDeleteAllTrashed, updateSchedule, permanentDeleteSchedule } from '../lib/api/schedules';
import { supabase } from '../lib/supabase';
import { Plus, Calendar, Clock, Archive, Trash2, FileText, RotateCcw, XCircle, Sparkles } from 'lucide-react';
import CreateScheduleModal from '../components/CreateScheduleModal';
import EditScheduleModal from '../components/EditScheduleModal';
import ProfileDropdown from '../components/ProfileDropdown';
import logo from '../assets/images/aria-logo.png';

	const styles: Record<string, React.CSSProperties> = {
	page: {
		minHeight: '100vh',
		background: 'linear-gradient(180deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)',
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		paddingBottom: '4rem',
	},
	header: {
		background: 'rgba(255, 255, 255, 0.9)',
		backdropFilter: 'blur(8px)',
		borderBottom: '1px solid rgba(249, 115, 22, 0.1)',
		position: 'sticky' as const,
		top: 0,
		zIndex: 100,
	},
	headerContent: {
		maxWidth: '1100px',
		margin: '0 auto',
		padding: '1rem 1.5rem',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	logoSection: {
		display: 'flex',
		alignItems: 'center',
		flexShrink: 0,
	},
	logo: {
		height: '40px',
		width: 'auto',
	},
	greetingSection: {
		flex: 1,
		textAlign: 'center',
	},
	greeting: {
		fontSize: '1.25rem',
		fontWeight: '700',
		color: '#111827',
		margin: 0,
	},
	headerActions: {
		display: 'flex',
		alignItems: 'center',
		gap: '0.75rem',
		flexShrink: 0,
	},
	button: {
		backgroundColor: '#f97316',
		color: 'white',
		border: 'none',
		borderRadius: '9999px',
		fontWeight: '600',
		cursor: 'pointer',
		display: 'inline-flex',
		alignItems: 'center',
		gap: '0.5rem',
		transition: 'all 0.2s ease',
		padding: '0.625rem 1.25rem',
		fontSize: '0.875rem',
		boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
		whiteSpace: 'nowrap' as const,
	},
	main: {
		maxWidth: '1100px',
		margin: '0 auto',
		padding: '1.5rem 1rem',
	},
	sectionHeader: {
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'stretch',
		gap: '1rem',
		marginBottom: '1.5rem',
	},
	filterBar: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: '1rem',
		marginBottom: '1.5rem',
	},
	filterTabsContainer: {
		display: 'flex',
		gap: '0.25rem',
		background: 'white',
		padding: '0.25rem',
		borderRadius: '9999px',
		boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
		overflowX: 'auto' as const,
		msOverflowStyle: 'none' as const,
		scrollbarWidth: 'none' as const,
	},
	filterTabsMobile: {
		padding: '0.25rem 0.5rem',
		gap: '0.125rem',
	},
	tab: {
		padding: '0.5rem 0.75rem',
		background: 'transparent',
		border: 'none',
		borderRadius: '9999px',
		fontSize: '0.8125rem',
		fontWeight: '500',
		color: '#6b7280',
		cursor: 'pointer',
		transition: 'all 0.2s ease',
		display: 'flex',
		alignItems: 'center',
		gap: '0.375rem',
		whiteSpace: 'nowrap' as const,
		flexShrink: 0 as const,
	},
	tabActive: {
		background: '#fff7ed',
		color: '#f97316',
	},
	card: {
		backgroundColor: 'white',
		padding: '1.25rem',
		borderRadius: '16px',
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
		border: '1px solid rgba(0, 0, 0, 0.04)',
		transition: 'all 0.25s ease',
		cursor: 'pointer',
	},
	statusBadge: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: '0.375rem',
		padding: '0.25rem 0.625rem',
		borderRadius: '9999px',
		fontSize: '0.75rem',
		fontWeight: '500',
		border: '1px solid',
	},
	emptyState: {
		display: 'flex',
		flexDirection: 'column' as const,
		alignItems: 'center',
		justifyContent: 'center',
		padding: '4rem 1.5rem',
		textAlign: 'center' as const,
	},
	emptyIcon: {
		width: '64px',
		height: '64px',
		borderRadius: '50%',
		background: 'linear-gradient(135deg, #fb923c, #fdba74)',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: '1.25rem',
		boxShadow: '0 4px 16px rgba(249, 115, 22, 0.25)',
	},
	emptyTitle: {
		fontSize: '1.25rem',
		fontWeight: '600',
		color: '#111827',
		margin: '0 0 0.5rem 0',
	},
	emptyText: {
		fontSize: '0.9375rem',
		color: '#6b7280',
		maxWidth: '320px',
		margin: '0 0 1.5rem 0',
		lineHeight: 1.5,
	},
	trashedEmptyIcon: {
		width: '64px',
		height: '64px',
		borderRadius: '50%',
		background: '#fef3c7',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: '1.25rem',
	},
	toast: {
		position: 'fixed' as const,
		bottom: '1.5rem',
		left: '1rem',
		right: '1rem',
		padding: '0.75rem 1.25rem',
		borderRadius: '9999px',
		fontWeight: '500',
		boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
		zIndex: 1000,
		animation: 'slideUp 0.3s ease',
		textAlign: 'center' as const,
	},
	toastSuccess: {
		background: '#10b981',
		color: 'white',
	},
	toastError: {
		background: '#ef4444',
		color: 'white',
	},
	headerContentMobile: {
		gridTemplateColumns: 'auto 1fr',
		gridTemplateRows: 'auto auto',
		gap: '0.5rem',
		padding: '0.75rem',
	},
	logoMobile: {
		height: '28px',
	},
	greetingSectionMobile: {
		gridColumn: '1 / -1',
		order: 3,
		textAlign: 'left' as const,
		paddingTop: '0.5rem',
		borderTop: '1px solid rgba(249, 115, 22, 0.1)',
		marginTop: '0.25rem',
	},
	headerActionsMobile: {
		display: 'flex',
		alignItems: 'center',
		gap: '0.5rem',
	},
	buttonMobile: {
		padding: '0.5rem 0.875rem',
		fontSize: '0.8125rem',
	},
	mainMobile: {
		padding: '1rem 0.75rem',
	},
	cardMobile: {
		padding: '1rem',
		borderRadius: '12px',
	},
	emptyIconMobile: {
		width: '56px',
		height: '56px',
	},
	emptyIconMobileSvg: {
		width: '32px',
		height: '32px',
	},
};

interface StatusBadgeProps {
	status: Schedule['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
	const statusConfig = {
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

	const config = statusConfig[status];
	const Icon = config.icon;

	return (
		<div style={config.style}>
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
	onRecover,
	onRename,
	onHardDelete,
	isTrashed = false 
}: { 
	schedule: Schedule; 
	onView: () => void; 
	onEdit: () => void;
	onTrash?: (schedule: Schedule) => void;
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
			className="card"
			style={{
				...styles.card,
				opacity: isTrashed ? 0.65 : 1,
				backgroundColor: isTrashed ? '#fafafa' : 'white',
				transform: isTrashed ? 'none' : 'translateY(0)',
			}}
			onMouseEnter={(e) => {
				if (!isTrashed) {
					e.currentTarget.style.transform = 'translateY(-2px)';
					e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.1)';
				}
			}}
			onMouseLeave={(e) => {
				if (!isTrashed) {
					e.currentTarget.style.transform = 'translateY(0)';
					e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
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
								style={{ ...styles.button, flex: 1, backgroundColor: '#10b981', borderRadius: '12px' }}
							>
								<RotateCcw size={16} />
								Recover
							</button>
							<button 
								onClick={() => onHardDelete?.(schedule)}
								style={{ ...styles.button, flex: 1, backgroundColor: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '12px' }}
							>
								<XCircle size={16} />
								Delete
							</button>
						</>
					) : (
						<>
							<button 
								onClick={onView}
								style={{ ...styles.button, flex: 1, borderRadius: '12px' }}
							>
								<Sparkles size={16} />
								View
							</button>
							<button 
								onClick={onEdit}
								style={{ ...styles.button, flex: 1, backgroundColor: 'white', color: '#374151', border: '1px solid #e5e7eb', boxShadow: 'none', borderRadius: '12px' }}
							>
								Edit
							</button>
							<button 
								onClick={() => onTrash?.(schedule)}
								style={{ ...styles.button, backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid #e5e7eb', boxShadow: 'none', padding: '0.75rem', borderRadius: '12px' }}
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
		<div style={styles.emptyState}>
			<div className="emptyIcon" style={styles.emptyIcon}>
				<Calendar size={40} color='white' />
			</div>
			<h2 style={styles.emptyTitle}>Welcome to Aria!</h2>
			<p style={styles.emptyText}>
				Let's create your first schedule. It only takes a moment to get started.
			</p>
			<button 
				onClick={onCreateSchedule}
				style={styles.button}
			>
				<Plus size={20} />
				Create Schedule
			</button>
		</div>
	);
}

function TrashedEmptyState({ count, onViewTrash }: { count: number; onViewTrash: () => void }) {
	return (
		<div style={styles.emptyState}>
			<div style={styles.trashedEmptyIcon}>
				<Trash2 size={40} color='#f59e0b' />
			</div>
			<h2 style={styles.emptyTitle}>All caught up!</h2>
			<p style={styles.emptyText}>
				You have {count} schedule{count > 1 ? 's' : ''} in trash. They will be permanently deleted after 30 days.
			</p>
			<button 
				onClick={onViewTrash}
				style={styles.button}
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
			.update({ status: 'trashed', previous_status: 'collecting' })
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
			<div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<div style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<div style={{ textAlign: 'center', color: '#dc2626' }}>
					{error}
					<button onClick={loadSchedules} style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#f97316', textDecoration: 'underline', cursor: 'pointer' }}>Try again</button>
				</div>
			</div>
		);
	}

	return (
		<div style={styles.page}>
			<style>
				{`
					@keyframes slideUp {
						from { opacity: 0; transform: translate(-50%, 20px); }
						to { opacity: 1; transform: translate(-50%, 0); }
					}
					.tab:hover:not(.active) { background: #f3f4f6 !important; }
					.tab.active { background: #fff7ed !important; color: #f97316 !important; }
					.filterTabs::-webkit-scrollbar { display: none; }
					.filterTabs { -ms-overflow-style: none; scrollbar-width: none; }
					
					@media (max-width: 640px) {
						.headerContent { grid-template-columns: auto 1fr !important; grid-template-rows: auto auto !important; gap: 0.5rem !important; padding: 0.75rem !important; }
						.logo { height: 28px !important; }
						.greetingSection { grid-column: 1 / -1 !important; order: 3 !important; text-align: left !important; padding-top: 0.5rem !important; border-top: 1px solid rgba(249, 115, 22, 0.1) !important; margin-top: 0.25rem !important; }
						.headerActions { display: flex !important; align-items: center !important; gap: 0.5rem !important; }
						.createButton { padding: 0.5rem 0.875rem !important; font-size: 0.8125rem !important; }
						.main { padding: 1rem 0.75rem !important; }
						.card { padding: 1rem !important; border-radius: 12px !important; }
						.emptyIcon { width: 56px !important; height: 56px !important; }
						.emptyIcon svg { width: 32px !important; height: 32px !important; }
						.toast { left: 0.75rem !important; right: 0.75rem !important; bottom: 1rem !important; }
						.sectionTitle { font-size: 1rem !important; }
						.tab { padding: 0.375rem 0.625rem !important; font-size: 0.75rem !important; }
					}
					
					@media (min-width: 641px) and (max-width: 1024px) {
						.headerContent { padding: 1rem 1.25rem !important; }
						.main { padding: 1.25rem 1.25rem !important; }
						.card { padding: 1.125rem !important; }
					}
				`}
			</style>

			{/* Header */}
			<header style={styles.header}>
				<div className="headerContent" style={styles.headerContent}>
					<div style={styles.logoSection}>
						<img src={logo} alt='Aria' className="logo" style={styles.logo} />
					</div>
					<div className="greetingSection" style={styles.greetingSection}>
						<p style={styles.greeting}>{getTimeBasedGreeting()}, {getUserFirstName()}!</p>
					</div>
					<div className="headerActions" style={styles.headerActions}>
						<ProfileDropdown user={user || {}} />
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="main" style={styles.main}>
				{/* Filter Bar */}
				<div style={styles.filterBar}>
					<div style={styles.filterTabsContainer}>
						{filterTabs.map((tab) => (
							<button
								key={tab.key}
								onClick={() => setFilter(tab.key as any)}
								className={`tab ${filter === tab.key ? 'active' : ''}`}
								style={filter === tab.key ? { ...styles.tab, ...styles.tabActive } : styles.tab}
							>
								{tab.label}
								<span style={{
									fontSize: '0.75rem',
									padding: '0.125rem 0.5rem',
									borderRadius: '9999px',
									backgroundColor: filter === tab.key ? '#ffedd5' : '#f3f4f6',
									color: filter === tab.key ? '#c2410c' : '#9ca3af',
								}}>
									{getFilteredCount(tab.key)}
								</span>
							</button>
						))}
					</div>
					<button className="createButton" onClick={handleCreateSchedule} style={styles.button}>
						<Plus size={18} />
						New Schedule
					</button>
				</div>

				{/* Schedule List */}
					{visibleSchedules.length === 0 ? (
						showAllTrashedEmptyState ? (
							<TrashedEmptyState count={schedules.length} onViewTrash={() => setFilter('trashed')} />
						) : filter === 'all' ? (
							<EmptyState onCreateSchedule={handleCreateSchedule} />
						) : (
							<div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#6b7280' }}>
								<p>No {filter} schedules found.</p>
								<button onClick={() => setFilter('all')} style={{ marginTop: '1rem', ...styles.button, background: 'white', color: '#f97316', border: '1px solid #fed7aa' }}>
									View All
								</button>
							</div>
						)
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
						{filter === 'trashed' && (
							<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
								<button
									onClick={() => setShowDeleteAllConfirm(true)}
									style={{ ...styles.button, background: 'white', color: '#dc2626', border: '1px solid #fecaca', padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '12px' }}
								>
									<XCircle size={16} />
									Delete All
								</button>
							</div>
						)}
						{visibleSchedules.map((schedule) => (
							<ScheduleCard
								key={schedule.id}
								schedule={schedule}
								onView={() => handleViewSchedule(schedule)}
								onEdit={() => handleEditSchedule(schedule)}
								onTrash={handleTrashClick}
								onRecover={handleRecover}
								onRename={handleRename}
								onHardDelete={handleHardDelete}
								isTrashed={schedule.status === 'trashed'}
							/>
						))}
					</div>
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
							<button onClick={handleTrashConfirm} style={{ ...styles.button, borderRadius: '12px' }}>Move to Trash</button>
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
							<button onClick={async () => { await permanentDeleteAllTrashed(); showToast('All schedules deleted'); loadSchedules(); setShowDeleteAllConfirm(false); }} style={{ ...styles.button, background: '#dc2626', borderRadius: '12px' }}>Delete All</button>
						</div>
					</div>
				</div>
			)}

			{/* Toast */}
			{toast && (
				<div style={{ ...styles.toast, ...(toast.type === 'success' ? styles.toastSuccess : styles.toastError) }}>
					{toast.message}
				</div>
			)}
		</div>
	);
}
