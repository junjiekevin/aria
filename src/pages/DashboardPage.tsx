// src/pages/DashboardPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSchedules, type Schedule } from '../lib/api/schedules';
import { Plus, Calendar, Clock, Archive, Trash2, FileText } from 'lucide-react';
import Chat from '../components/Chat';
import CreateScheduleModal from '../components/CreateScheduleModal';
import EditScheduleModal from '../components/EditScheduleModal';

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
		margin: 0
	},
	subtitle: {
		color: '#6b7280',
		margin: '0.25rem 0 0 0',
		fontSize: '1rem'
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
	grid: {
		display: 'grid',
		gap: '1.5rem',
		gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
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

function ScheduleCard({ schedule, onView, onEdit }: { schedule: Schedule; onView: () => void; onEdit: () => void }) {
	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric", 
			year: "numeric",
		});
	};

	return (
		<div 
			style={styles.card}
			onMouseEnter={(e) => {
				e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
					<div style={{ flex: 1 }}>
						<h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827', margin: '0 0 0.5rem 0' }}>
							{schedule.label}
						</h3>
						<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280' }}>
							<Calendar size={20} />
							<span>{formatDate(schedule.start_date)} – {formatDate(schedule.end_date)}</span>
						</div>
					</div>
					<StatusBadge status={schedule.status} />
				</div>

				<div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
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
	const [schedules, setSchedules] = useState<Schedule[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

	useEffect(() => {
		loadSchedules();
	}, []);

	const loadSchedules = async () => {
		try {
			setLoading(true);
			setError(null);
			const data = await getSchedules();
			setSchedules(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load schedules');
		} finally {
			setLoading(false);
		}
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

	const handleScheduleCreated = () => {
		loadSchedules(); // Refresh the list
	};

	const handleScheduleUpdated = () => {
		loadSchedules(); // Refresh the list
	};

	const visibleSchedules = schedules.filter((s) => s.status !== "trashed");

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
					<div>
						<h1 style={styles.title}>Aria</h1>
						<p style={styles.subtitle}>Your scheduling assistant</p>
					</div>
					<button 
						onClick={handleCreateSchedule}
						style={styles.button}
						onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; }}
						onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f97316'; }}
					>
						<Plus size={20} />
						Create New Schedule
					</button>
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
					{visibleSchedules.length === 0 ? (
						<EmptyState onCreateSchedule={handleCreateSchedule} />
					) : (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#111827', margin: 0 }}>Your Schedules</h2>
								<p style={{ color: '#6b7280', margin: 0 }}>
									{visibleSchedules.length} {visibleSchedules.length === 1 ? "schedule" : "schedules"}
								</p>
							</div>
							<div style={styles.grid}>
								{visibleSchedules.map((schedule) => (
									<ScheduleCard 
										key={schedule.id} 
										schedule={schedule}
										onView={() => handleViewSchedule(schedule)}
										onEdit={() => handleEditSchedule(schedule)}
									/>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Right column: Chat */}
				<div>
					<Chat />
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
</div>
	);
}
