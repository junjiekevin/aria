import { Link } from 'react-router-dom';

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
    },
    card: {
        maxWidth: '28rem',
        width: '100%',
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
    },
    header: {
        textAlign: 'center' as const,
        marginBottom: '2rem'
    },
    title: {
        fontSize: '1.875rem',
        fontWeight: 'bold',
        color: '#111827',
        margin: '0 0 0.5rem 0'
    },
    subtitle: {
        marginTop: '0.5rem',
        fontSize: '0.875rem',
        color: '#6b7280',
        margin: 0
    },
    buttonContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1rem'
    },
    link: {
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0.75rem 1rem',
        border: 'none',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: 'white',
        backgroundColor: '#111827',
        textDecoration: 'none',
        transition: 'background-color 0.2s ease'
    },
    studentNote: {
        textAlign: 'center' as const,
        marginTop: '1rem'
    },
    studentText: {
        fontSize: '0.75rem',
        color: '#6b7280'
    }
};

const LandingPage = () => {
    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <h1 style={styles.title}>
                        Welcome to Aria
                    </h1>
                    <p style={styles.subtitle}>
                        Intelligent scheduling assistant for teachers
                    </p>
                </div>
                
                <div style={styles.buttonContainer}>
                    <Link 
                        to="/auth"
                        style={styles.link}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1f2937'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#111827'; }}
                    >
                        Sign in as Teacher
                    </Link>
                    
                    <div style={styles.studentNote}>
                        <span style={styles.studentText}>
                            Student? Access your schedule form directly.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
