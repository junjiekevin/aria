// src/pages/DashboardPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSchedules, type Schedule, deleteSchedule, restoreSchedule, permanentDeleteAllTrashed, updateSchedule } from '../lib/api/schedules';
import { supabase } from '../lib/supabase';
import { Plus, Calendar, Clock, Archive, Trash2, FileText, RotateCcw, AlertTriangle, XCircle } from 'lucide-react';
import Chat from '../components/Chat';
import CreateScheduleModal from '../components/CreateScheduleModal';
import EditScheduleModal from '../components/EditScheduleModal';
import ProfileDropdown from '../components/ProfileDropdown';
import logo from '../assets/images/aria-logo.png';

// Inline styles inspired by the LLM design
const styles = {
	dashboard: {
		minHeight: '100vh',
		background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)',
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
	},
	header: {
		borderBottom: '1px solid #e5e7eb',
		background: 'rgba(255, 255, 255, 0.8)',
		backdropFilter: 'blur(4px)',
		position: 'sticky' as const,
		top: 0,
		zIndex: 10,
		boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
	},
	headerContent: {
		maxWidth: '1280px',
		margin: '0 auto',
		padding: '1.5rem',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: '1rem'
	},
	title: {
		fontSize: '2rem',
		fontWeight: 'bold',
		color: '#111827',
		margin: 0,
		display: 'flex',
		alignItems: 'center',
		gap: '0.75rem',
	},
	subtitle: {
		color: '#6b7280',
		margin: '0.25rem 0 0 0',
		fontSize: '1rem'
	},
	logo: {
		height: '48px',
		width: 'auto',
		marginTop: '-4px',
	},
	button: {
		backgroundColor: '#f97316',
		color: 'white',
		border: 'none',
		borderRadius: '0.5rem',
		fontWeight: '500',
		cursor: 'pointer',
		display: 'inline-flex',
		alignItems: 'center',
		gap: '0.5rem',
		transition: 'all 0.2s ease',
		padding: '0.75rem 1rem',
		fontSize: '1rem'
	},
	card: {
		backgroundColor: 'white',
		padding: '1.5rem',
		borderRadius: '0.75rem',
		boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
		border: '1px solid #e5e7eb',
		transition: 'box-shadow 0.2s ease'
	},
	statusBadge: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: '0.5rem',
		padding: '0.375rem 0.75rem',
		borderRadius: '9999px',
		fontSize: '0.875rem',
		fontWeight: '500',
		border: '1px solid'
	},
	main: {
		maxWidth: '1280px',
		margin: '0 auto',
		padding: '2rem 1.5rem'
	},
	list: {
		display: 'flex',
		flexDirection: 'column' as const,
		gap: '1rem'
	},
	twoColumnLayout: {
		display: 'grid',
		gridTemplateColumns: '1fr 500px',
		gap: '2rem',
		alignItems: 'start'
	}
};

interface StatusBadgeProps {
	status: Schedule['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
	const statusConfig = {
		draft: {
			label: "Draft",
			icon: FileText,
			style: { ...styles.statusBadge, backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#f3e8a8' }
		},
		collecting: {
			label: "Active", 
			icon: Clock,
			style: { ...styles.statusBadge, backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#a7f3d0' }
		},
		archived: {
			label: "Archived",
			icon: Archive,
			style: { ...styles.statusBadge, backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }
		},
		trashed: {
			label: "Trashed",
			icon: Trash2,
			style: { ...styles.statusBadge, backgroundColor: '#fce7e7', color: '#991b1b', borderColor: '#fca5a5' }
		}
	};

	const config = statusConfig[status];
	const Icon = config.icon;

	return (
		<div style={config.style}>
			<Icon size={16} />
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
	isTrashed = false 
}: { 
	schedule: Schedule; 
	onView: () => void; 
	onEdit: () => void;
	onTrash?: (schedule: Schedule) => void;
	onRecover?: (schedule: Schedule) => void;
	onRename?: (schedule: Schedule, newLabel: string) => void;
	isTrashed?: boolean;
}) {
	const [isEditingName, setIsEditingName] = useState(false);
	const [editingName, setEditingName] = useState(schedule.label);
	const nameInputRef = useRef<HTMLInputElement>(null);

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric", 
			year: "numeric",
		});
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
		if (e.key === 'Enter') {
			handleNameBlur();
		} else if (e.key === 'Escape') {
			setIsEditingName(false);
			setEditingName(schedule.label);
		}
	};

	return (
		<div 
			style={{
				...styles.card,
				opacity: isTrashed ? 0.6 : 1,
				backgroundColor: isTrashed ? '#f9fafb' : 'white',
			}}
			onMouseEnter={(e) => {
				if (!isTrashed) {
					e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
				}
			}}
			onMouseLeave={(e) => {
				if (!isTrashed) {
					e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
				}
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
					<div style={{ flex: 1 }}>
						{isEditingName ? (
							<input
								ref={nameInputRef}
								type="text"
								value={editingName}
								onChange={(e) => setEditingName(e.target.value)}
								onBlur={handleNameBlur}
								onKeyDown={handleNameKeyDown}
								style={{
									fontSize: '1.25rem',
									fontWeight: '600',
									color: '#111827',
									margin: '0 0 0.5rem 0',
									padding: '0.25rem 0.5rem',
									border: '1px solid #f97316',
									borderRadius: '0.375rem',
									width: '100%',
									maxWidth: '300px',
									outline: 'none',
								}}
							/>
						) : (
							<h3
								onClick={handleNameClick}
								style={{
									fontSize: '1.25rem',
									fontWeight: '600',
									color: isTrashed ? '#6b7280' : '#111827',
									margin: '0 0 0.5rem 0',
									cursor: isTrashed ? 'default' : 'pointer',
									transition: 'color 0.2s',
								}}
								onMouseEnter={(e) => {
									if (!isTrashed) {
										e.currentTarget.style.color = '#f97316';
									}
								}}
								onMouseLeave={(e) => {
									if (!isTrashed) {
										e.currentTarget.style.color = '#111827';
									}
								}}
							>
								{schedule.label}
								{isTrashed && <span style={{ fontSize: '0.75rem', fontWeight: 'normal', marginLeft: '0.5rem', color: '#9ca3af' }}>(Trashed)</span>}
								{!isTrashed && onRename && (
									<span style={{ fontSize: '0.75rem', fontWeight: 'normal', marginLeft: '0.5rem', color: '#9ca3af', opacity: 0 }}>(rename)</span>
								)}
							</h3>
						)}
						<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isTrashed ? '#9ca3af' : '#6b7280' }}>
							<Calendar size={20} />
							<span>{formatDate(schedule.start_date)} – {formatDate(schedule.end_date)}</span>
						</div>
					</div>
					<StatusBadge status={schedule.status} />
				</div>

				<div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
					{isTrashed ? (
						<>
							<button 
								onClick={() => onRecover?.(schedule)}
								style={{ ...styles.button, flex: 1, backgroundColor: '#10b981' }}
								onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; }}
								onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10b981'; }}
							>
								<RotateCcw size={18} />
								Recover
							</button>
							<button 
								onClick={() => onTrash?.(schedule)}
								style={{ 
									...styles.button, 
									backgroundColor: 'white', 
									color: '#dc2626', 
									border: '1px solid #fecaca',
									flex: 1 
								}}
								onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
								onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
							>
								<XCircle size={18} />
								Delete
							</button>
						</>
					) : (
						<>
							<button 
								onClick={onView}
								style={{ ...styles.button, flex: 1 }}
								onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
								onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
							>
								View Schedule
							</button>
							<button 
								onClick={onEdit}
								style={{ 
									...styles.button, 
									backgroundColor: 'white', 
									color: '#374151', 
									border: '1px solid #d1d5db',
									flex: 1 
								}}
								onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
								onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
							>
								Edit
							</button>
							<button 
								onClick={() => onTrash?.(schedule)}
								style={{ 
									...styles.button, 
									backgroundColor: 'white', 
									color: '#6b7280', 
									border: '1px solid #d1d5db',
									padding: '0.75rem',
								}}
								onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#dc2626'; }}
								onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; }}
								title="Move to trash"
							>
								<Trash2 size={18} />
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
		<div style={{ 
			display: 'flex', 
			flexDirection: 'column', 
			alignItems: 'center', 
			justifyContent: 'center', 
			padding: '4rem 1.5rem',
			textAlign: 'center' 
		}}>
			<div style={{ 
				width: '6rem', 
				height: '6rem', 
				borderRadius: '50%', 
				background: 'linear-gradient(135deg, #fb923c, #fdba74)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				marginBottom: '1.5rem'
			}}>
				<Calendar size={48} color="white" />
			</div>
			<h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: '0 0 0.75rem 0' }}>
				Welcome to Aria!
			</h2>
			<p style={{ fontSize: '1.125rem', color: '#6b7280', maxWidth: '28rem', margin: '0 0 2rem 0', lineHeight: 1.5 }}>
				Let's create your first schedule. It's easy – just click the button below to get started!
			</p>
			<button 
				onClick={onCreateSchedule}
				style={{ 
					...styles.button, 
					padding: '1rem 2rem', 
					fontSize: '1.125rem' 
				}}
				onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
				onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
			>
				<Plus size={24} />
				Create Your First Schedule
			</button>
		</div>
	);
}

export default function DashboardPage() {
	const navigate = useNavigate();
	const [user, setUser] = useState<any>(null);
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

	const handleCreateSchedule = () => {
		setShowCreateModal(true);
	};

	const handleViewSchedule = (schedule: Schedule) => {
		navigate(`/schedule/${schedule.id}`);
	};

	const handleEditSchedule = (schedule: Schedule) => {
		setSelectedSchedule(schedule);
		setShowEditModal(true);
	};

	const handleRename = async (schedule: Schedule, newLabel: string) => {
		try {
			await updateSchedule(schedule.id, { label: newLabel });
			showToast(`Renamed to "${newLabel}"`, 'success');
			loadSchedules();
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Failed to rename', 'error');
		}
	};

	const handleScheduleCreated = () => {
		loadSchedules();
	};

	const handleScheduleUpdated = () => {
		loadSchedules();
	};

	const handleTrashClick = (schedule: Schedule) => {
		setScheduleToTrash(schedule);
		setShowTrashConfirm(true);
	};

	const handleTrashConfirm = async () => {
		if (!scheduleToTrash) return;
		try {
			await deleteSchedule(scheduleToTrash.id);
			showToast(`"${scheduleToTrash.label}" moved to trash. Recoverable for 30 days.`, 'success');
			loadSchedules();
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Failed to move to trash', 'error');
		} finally {
			setShowTrashConfirm(false);
			setScheduleToTrash(null);
		}
	};

	const handleRecover = async (schedule: Schedule) => {
		try {
			await restoreSchedule(schedule.id);
			showToast(`"${schedule.label}" restored successfully`, 'success');
			loadSchedules();
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Failed to restore schedule', 'error');
		}
	};

	const handleDeleteAllTrashed = async () => {
		try {
			const result = await permanentDeleteAllTrashed();
			showToast(`Permanently deleted ${result.count} trashed schedule${result.count > 1 ? 's' : ''}`, 'success');
			loadSchedules();
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
		} finally {
			setShowDeleteAllConfirm(false);
		}
	};

	const filterTabs = [
		{ key: 'all', label: 'All' },
		{ key: 'draft', label: 'Draft' },
		{ key: 'collecting', label: 'Active' },
		{ key: 'archived', label: 'Archived' },
		{ key: 'trashed', label: 'Trashed' },
	] as const;

	const visibleSchedules = schedules.filter((s) => {
		if (filter === 'all') return true;
		return s.status === filter;
	});

	// Determine if we should show the "All trashed" empty state
	const showAllTrashedEmptyState = filter === 'all' && schedules.length > 0 && schedules.every(s => s.status === 'trashed');

	const getFilteredCount = (status: typeof filter) => {
		if (status === 'all') return schedules.length;
		return schedules.filter(s => s.status === status).length;
	};

	if (loading) {
		return (
			<div style={{ 
				...styles.dashboard, 
				display: 'flex', 
				alignItems: 'center', 
				justifyContent: 'center' 
			}}>
				<div style={{ color: '#6b7280', fontSize: '1.125rem' }}>Loading schedules...</div>
			</div>
		);
	}

	return (
		<div style={styles.dashboard}>
			<header style={styles.header}>
				<div style={styles.headerContent}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
						<img src={logo} alt="Aria" style={styles.logo} />
						<div>
							<h1 style={styles.title}>Aria</h1>
							<p style={styles.subtitle}>Your scheduling assistant</p>
						</div>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
						<button
							onClick={handleCreateSchedule}
							style={{
								...styles.button,
								padding: '0.5rem 1rem',
								fontSize: '0.875rem',
							}}
							onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
							onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
						>
							<Plus size={18} />
							New Schedule
						</button>
						{user && <ProfileDropdown user={user} />}
					</div>
				</div>
			</header>

			{error && (
				<div style={styles.main}>
					<div style={{ 
						backgroundColor: '#fef2f2', 
						border: '1px solid #fecaca', 
						color: '#991b1b', 
						padding: '0.75rem 1rem', 
						borderRadius: '0.5rem' 
					}}>
						{error}
						<button 
							onClick={loadSchedules}
							style={{ 
								background: 'none', 
								border: 'none', 
								color: '#dc2626', 
								textDecoration: 'underline', 
								cursor: 'pointer', 
								marginLeft: '1rem' 
							}}
						>
							Try again
						</button>
					</div>
				</div>
			)}

		<main style={styles.main}>
			<div style={styles.twoColumnLayout}>
				{/* Left column: Schedules */}
				<div>
					{visibleSchedules.length === 0 && filter === 'all' ? (
						<EmptyState onCreateSchedule={handleCreateSchedule} />
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: 0 }}>Your Schedules</h2>
								<p style={{ color: '#6b7280', margin: 0 }}>
									{visibleSchedules.length} {visibleSchedules.length === 1 ? "schedule" : "schedules"}
								</p>
							</div>

							{/* Filter Tabs */}
							<div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
								{filterTabs.map((tab) => (
									<button
										key={tab.key}
										onClick={() => setFilter(tab.key)}
										style={{
											padding: '0.5rem 1rem',
											background: filter === tab.key ? '#fff7ed' : 'transparent',
											border: 'none',
											borderRadius: '0.5rem',
											fontSize: '0.875rem',
											fontWeight: filter === tab.key ? '500' : '400',
											color: filter === tab.key ? '#f97316' : '#6b7280',
											cursor: 'pointer',
											transition: 'all 0.2s',
											display: 'flex',
											alignItems: 'center',
											gap: '0.5rem',
										}}
										onMouseEnter={(e) => {
											if (filter !== tab.key) {
												e.currentTarget.style.backgroundColor = '#f3f4f6';
											}
										}}
										onMouseLeave={(e) => {
											if (filter !== tab.key) {
												e.currentTarget.style.backgroundColor = 'transparent';
											}
										}}
									>
										{tab.label}
										<span style={{
											fontSize: '0.75rem',
											padding: '0.125rem 0.5rem',
											borderRadius: '9999px',
											backgroundColor: filter === tab.key ? '#ffedd5' : '#f3f4f6',
											color: filter === tab.key ? '#c2410c' : '#6b7280',
										}}>
											{getFilteredCount(tab.key)}
										</span>
									</button>
								))}
							</div>

							{/* Special empty state when all schedules are trashed */}
							{showAllTrashedEmptyState ? (
								<div style={{
									textAlign: 'center',
									padding: '4rem 1.5rem',
									color: '#6b7280',
								}}>
									<div style={{
										width: '5rem',
										height: '5rem',
										borderRadius: '50%',
										background: '#fef3c7',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										margin: '0 auto 1.5rem',
									}}>
										<Trash2 size={32} color="#f59e0b" />
									</div>
									<h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', marginBottom: '0.75rem' }}>
										All your schedules are in trash
									</h3>
									<p style={{ fontSize: '1rem', marginBottom: '1.5rem', maxWidth: '24rem', margin: '0 auto 1.5rem' }}>
										You have {schedules.length} schedule{schedules.length > 1 ? 's' : ''} in trash. 
										They will be permanently deleted after 30 days.
									</p>
									<button
										onClick={() => setFilter('trashed')}
										style={{
											padding: '0.75rem 1.5rem',
											background: '#f97316',
											color: 'white',
											border: 'none',
											borderRadius: '0.5rem',
											cursor: 'pointer',
											fontSize: '1rem',
											fontWeight: '500',
											display: 'inline-flex',
											alignItems: 'center',
											gap: '0.5rem',
										}}
										onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
										onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
									>
										<Trash2 size={20} />
										View Trashed Schedules
									</button>
								</div>
							) : visibleSchedules.length === 0 ? (
								<div style={{
									textAlign: 'center',
									padding: '3rem 1.5rem',
									color: '#6b7280',
								}}>
									<p>No {filter !== 'all' ? filter : ''} schedules found.</p>
									{filter !== 'all' && (
										<button
											onClick={() => setFilter('all')}
											style={{
												marginTop: '1rem',
												padding: '0.5rem 1rem',
												background: '#f97316',
												color: 'white',
												border: 'none',
												borderRadius: '0.5rem',
												cursor: 'pointer',
											}}
										>
											View All Schedules
										</button>
									)}
								</div>
							) : (
								<div style={styles.list}>
									{filter === 'trashed' && (
										<div style={{
											display: 'flex',
											justifyContent: 'flex-end',
											paddingBottom: '0.5rem',
										}}>
											<button
												onClick={() => setShowDeleteAllConfirm(true)}
												style={{
													padding: '0.5rem 1rem',
													background: 'white',
													color: '#dc2626',
													border: '1px solid #fecaca',
													borderRadius: '0.5rem',
													cursor: 'pointer',
													fontSize: '0.875rem',
													display: 'flex',
													alignItems: 'center',
													gap: '0.5rem',
												}}
												onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
												onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
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
											isTrashed={schedule.status === 'trashed'}
										/>
									))}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Right column: Chat */}
				<div style={{ position: 'sticky', top: '100px' }}>
					<Chat onScheduleChange={loadSchedules} />
				</div>
			</div>
		</main>

	{/* Modals */}
	<CreateScheduleModal 
		isOpen={showCreateModal}
		onClose={() => setShowCreateModal(false)}
		onSuccess={handleScheduleCreated}
	/>
	<EditScheduleModal
		isOpen={showEditModal}
		onClose={() => setShowEditModal(false)}
		schedule={selectedSchedule}
		onSuccess={handleScheduleUpdated}
	/>

	{/* Trash Confirmation Modal */}
	{showTrashConfirm && (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: 'rgba(0, 0, 0, 0.5)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 1000,
		}} onClick={() => setShowTrashConfirm(false)}>
			<div style={{
				backgroundColor: 'white',
				borderRadius: '0.75rem',
				padding: '1.5rem',
				maxWidth: '400px',
				width: '90%',
			}} onClick={(e) => e.stopPropagation()}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
					<div style={{
						width: '40px',
						height: '40px',
						borderRadius: '50%',
						backgroundColor: '#fef3c7',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}>
						<AlertTriangle size={24} color="#f59e0b" />
					</div>
					<h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Move to Trash?</h3>
				</div>
				<p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
					Are you sure you want to move <strong>{scheduleToTrash?.label}</strong> to trash? 
					This schedule will be recoverable for 30 days.
				</p>
				<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
					<button
						onClick={() => setShowTrashConfirm(false)}
						style={{
							padding: '0.5rem 1rem',
							background: 'white',
							color: '#374151',
							border: '1px solid #d1d5db',
							borderRadius: '0.5rem',
							cursor: 'pointer',
						}}
					>
						Cancel
					</button>
					<button
						onClick={handleTrashConfirm}
						style={{
							padding: '0.5rem 1rem',
							background: '#f97316',
							color: 'white',
							border: 'none',
							borderRadius: '0.5rem',
							cursor: 'pointer',
						}}
					>
						Move to Trash
					</button>
				</div>
			</div>
		</div>
	)}

	{/* Delete All Confirmation Modal */}
	{showDeleteAllConfirm && (
		<div style={{
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: 'rgba(0, 0, 0, 0.5)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 1000,
		}} onClick={() => setShowDeleteAllConfirm(false)}>
			<div style={{
				backgroundColor: 'white',
				borderRadius: '0.75rem',
				padding: '1.5rem',
				maxWidth: '400px',
				width: '90%',
			}} onClick={(e) => e.stopPropagation()}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
					<div style={{
						width: '40px',
						height: '40px',
						borderRadius: '50%',
						backgroundColor: '#fecaca',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}>
						<Trash2 size={24} color="#dc2626" />
					</div>
					<h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Permanently Delete All?</h3>
				</div>
				<p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
					Are you sure you want to permanently delete all <strong>{schedules.filter(s => s.status === 'trashed').length}</strong> trashed schedules? 
					This action <strong>cannot be undone</strong>.
				</p>
				<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
					<button
						onClick={() => setShowDeleteAllConfirm(false)}
						style={{
							padding: '0.5rem 1rem',
							background: 'white',
							color: '#374151',
							border: '1px solid #d1d5db',
							borderRadius: '0.5rem',
							cursor: 'pointer',
						}}
					>
						Cancel
					</button>
					<button
						onClick={handleDeleteAllTrashed}
						style={{
							padding: '0.5rem 1rem',
							background: '#dc2626',
							color: 'white',
							border: 'none',
							borderRadius: '0.5rem',
							cursor: 'pointer',
						}}
					>
						Delete All
					</button>
				</div>
			</div>
		</div>
	)}

	{/* Toast Notification */}
	{toast && (
		<div style={{
			position: 'fixed',
			bottom: '2rem',
			right: '2rem',
			padding: '1rem 1.5rem',
			backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
			color: 'white',
			borderRadius: '0.5rem',
			boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
			zIndex: 1000,
			animation: 'slideIn 0.3s ease',
		}}>
			{toast.message}
			<style>{`
				@keyframes slideIn {
					from { transform: translateY(20px); opacity: 0; }
					to { transform: translateY(0); opacity: 1; }
				}
			`}</style>
		</div>
	)}
</div>
	);
}
