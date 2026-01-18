// src/pages/AboutPage.tsx
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, Heart } from 'lucide-react';

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
    maxWidth: '800px',
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
  logoSection: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  logo: {
    width: '80px',
    height: '80px',
    marginBottom: '1rem',
  },
  appName: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '0.5rem',
  },
  tagline: {
    fontSize: '1.125rem',
    color: '#6b7280',
    marginBottom: '1rem',
  },
  version: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    backgroundColor: '#ffedd5',
    color: '#c2410c',
    borderRadius: '9999px',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  description: {
    color: '#4b5563',
    lineHeight: 1.7,
    marginBottom: '1rem',
  },
  link: {
    color: '#f97316',
    textDecoration: 'none',
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
    marginBottom: '1rem',
  },
  footer: {
    textAlign: 'center',
    padding: '2rem 0',
    color: '#9ca3af',
  },
  madeWith: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
};

export default function AboutPage() {
  const navigate = useNavigate();

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
          <h1 style={styles.title}>About</h1>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.logoSection}>
            <img
              src="/src/assets/images/aria-logo.png"
              alt="Aria"
              style={styles.logo}
            />
            <h2 style={styles.appName}>Aria</h2>
            <p style={styles.tagline}>Your intelligent scheduling assistant for teachers</p>
            <span style={styles.version}>Version 1.0.0</span>
          </div>

          <p style={styles.description}>
            Aria is a modern scheduling application designed specifically for teachers to streamline
            their scheduling workflow. With AI-powered assistance powered by Gemini 2.0 Flash,
            creating and managing class schedules has never been easier.
          </p>

          <p style={styles.description}>
            Whether you're planning weekly timetables, coordinating substitute teachers, or
            managing complex scheduling constraints, Aria helps you get it done faster and
            with less stress.
          </p>
        </div>

        <div style={styles.card}>
          <div style={styles.icon}>
            <Shield size={24} />
          </div>
          <h3 style={styles.sectionTitle}>Privacy Policy</h3>
          <p style={styles.description}>
            Your privacy is important to us. Aria collects minimal personal information necessary
            to provide our services. We do not sell or share your data with third parties for
            marketing purposes. All data is encrypted and stored securely using Supabase
            infrastructure.
          </p>
          <p style={styles.description}>
            <strong>Data We Collect:</strong>
          </p>
          <ul style={{ color: '#4b5563', lineHeight: 1.8, marginBottom: '1rem', paddingLeft: '1.5rem' }}>
            <li>Account information (name, email) via Google OAuth</li>
            <li>Schedule data you create and manage</li>
            <li>Usage analytics to improve our services</li>
          </ul>
          <p style={styles.description}>
            You can request deletion of your account and all associated data at any time by
            contacting <a href="mailto:support@aria.app" style={styles.link}>support@aria.app</a>.
          </p>
        </div>

        <div style={styles.card}>
          <div style={styles.icon}>
            <FileText size={24} />
          </div>
          <h3 style={styles.sectionTitle}>Terms of Service</h3>
          <p style={styles.description}>
            By using Aria, you agree to these terms and conditions. Please read them carefully.
          </p>
          <p style={styles.description}>
            <strong>Acceptable Use:</strong> Aria is intended for legitimate educational scheduling
            purposes. Users must not use the service for illegal activities, spam, or to harm
            others.
          </p>
          <p style={styles.description}>
            <strong>Account Security:</strong> You are responsible for maintaining the
            confidentiality of your account credentials and for all activities that occur under
            your account.
          </p>
          <p style={styles.description}>
            <strong>Service Availability:</strong> While we strive to maintain 99.9% uptime,
            we do not guarantee uninterrupted service. Scheduled maintenance will be announced
            in advance when possible.
          </p>
          <p style={styles.description}>
            <strong>Limitation of Liability:</strong> Aria is provided "as is" without warranties.
            We are not liable for any indirect, incidental, or consequential damages arising
            from the use of our services.
          </p>
          <p style={styles.description}>
            <strong>Changes to Terms:</strong> We reserve the right to modify these terms at any
            time. Continued use after changes constitutes acceptance of the new terms.
          </p>
        </div>

        <footer style={styles.footer}>
          <div style={styles.madeWith}>
            <span>Made with</span>
            <Heart size={16} color="#f97316" fill="#f97316" />
            <span>for educators everywhere</span>
          </div>
          <p style={{ margin: 0 }}>© 2025 Aria. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
