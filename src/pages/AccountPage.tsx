// src/pages/AccountPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 50%, #fff7ed 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },
  header: {
    borderBottom: '1px solid #e5e7eb',
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(4px)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  headerContent: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '1rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#374151',
    transition: 'all 0.2s',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  main: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    padding: '2rem',
    marginBottom: '1.5rem',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#f9fafb',
    borderRadius: '0.5rem',
    marginBottom: '0.75rem',
  },
  icon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#ffedd5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f97316',
  },
  infoLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginBottom: '0.25rem',
  },
  infoValue: {
    fontSize: '1rem',
    fontWeight: '500',
    color: '#111827',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '500',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    marginLeft: 'auto',
  },
  note: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#fef3c7',
    borderRadius: '0.5rem',
    border: '1px solid #fde68a',
  },
  noteText: {
    fontSize: '0.875rem',
    color: '#92400e',
    margin: 0,
  },
};

export default function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <button
              onClick={() => navigate('/dashboard')}
              style={styles.backButton}
            >
              <ArrowLeft size={20} />
              Back
            </button>
            <h1 style={styles.title}>Account Settings</h1>
          </div>
        </header>
        <main style={styles.main}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</div>
        </main>
      </div>
    );
  }

  const fullName = user?.user_metadata?.full_name || 'User';
  const email = user?.email || 'No email';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <button
            onClick={() => navigate('/dashboard')}
            style={styles.backButton}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          <h1 style={styles.title}>Account Settings</h1>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>
            <User size={24} />
            Profile Information
          </h2>

          <div style={styles.infoRow}>
            <div style={styles.icon}>
              <User size={20} />
            </div>
            <div>
              <div style={styles.infoLabel}>Name</div>
              <div style={styles.infoValue}>{fullName}</div>
            </div>
          </div>

          <div style={styles.infoRow}>
            <div style={styles.icon}>
              <Mail size={20} />
            </div>
            <div>
              <div style={styles.infoLabel}>Email</div>
              <div style={styles.infoValue}>{email}</div>
            </div>
            <span style={styles.badge}>Google OAuth</span>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>
            <Shield size={24} />
            Authentication
          </h2>
          <div style={styles.note}>
            <p style={styles.noteText}>
              <strong>Note:</strong> Since you signed in with Google OAuth, your account
              is managed by Google. To update your name or profile picture, please make
              those changes in your Google account settings.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
