// src/pages/AboutPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Sparkles, Shield, FileText, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import logoWithText from '../assets/images/logo-with-text.png';

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#fffcf9',
    color: '#2d2d2d',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    lineHeight: 1.6,
    overflowX: 'hidden',
  },
  header: {
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'fixed',
    top: 0,
    width: '100%',
    zIndex: 100,
    background: 'rgba(255, 252, 249, 0.8)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.2rem',
    background: 'white',
    border: '1px solid #e2e2e2',
    borderRadius: '2rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: '#444',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  hero: {
    height: '70vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    padding: '0 2rem',
    background: 'radial-gradient(circle at 50% 50%, #fff 0%, #fffcf9 100%)',
    position: 'relative',
  },
  heroTitle: {
    fontSize: 'clamp(3.5rem, 10vw, 6rem)',
    fontWeight: 800,
    background: 'linear-gradient(to right, #1a1a1a, #f97316)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '1.5rem',
    letterSpacing: '-0.02em',
  },
  heroSubtitle: {
    fontSize: '1.4rem',
    color: '#666',
    maxWidth: '700px',
    marginBottom: '3rem',
    lineHeight: 1.4,
  },
  section: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '4rem 2rem',
  },
  sectionHeading: {
    fontSize: '2.5rem',
    fontWeight: 700,
    color: '#1a1a1a',
    marginBottom: '2rem',
    letterSpacing: '-0.01em',
  },
  textBlock: {
    fontSize: '1.125rem',
    color: '#444',
    marginBottom: '1.5rem',
  },
  quote: {
    fontSize: '1.5rem',
    fontStyle: 'italic',
    color: '#f97316',
    padding: '2rem',
    borderLeft: '4px solid #f97316',
    background: 'rgba(249, 115, 22, 0.05)',
    margin: '3rem 0',
    borderRadius: '0 1rem 1rem 0',
  },
  card: {
    background: 'white',
    padding: '2.5rem',
    borderRadius: '1.5rem',
    border: '1px solid #f0f0f0',
    boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
    marginBottom: '2rem',
  },
  footer: {
    padding: '4rem 2rem',
    background: '#1a1a1a',
    color: '#888',
    textAlign: 'center',
  },
  legalSection: {
    marginTop: '2rem',
    textAlign: 'left',
    maxWidth: '1000px',
    margin: '2rem auto 0 auto',
  },
  legalToggle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 0',
    borderBottom: '1px solid #333',
    cursor: 'pointer',
    color: '#ccc',
  },
  logoInHeader: {
    height: '32px',
    width: 'auto',
  }
};

const LegalItem = ({ title, icon: Icon, isLast, children }: { title: string, icon: React.ElementType, isLast?: boolean, children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
      <div
        style={{ ...styles.legalToggle, color: isOpen ? '#f97316' : '#ccc' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Icon size={20} />
          <span style={{ fontWeight: 600 }}>{title}</span>
        </div>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>
      {isOpen && (
        <div style={{ padding: '2rem 0', color: '#888', fontSize: '0.95rem' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default function AboutPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);

    // Simple intersection observer for reveal animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).style.opacity = '1';
          (entry.target as HTMLElement).style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .reveal {
            opacity: 0;
            transform: translateY(30px);
            transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          }
        `}
      </style>

      <header style={styles.header}>
        <button
          onClick={() => navigate('/dashboard')}
          style={styles.backButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f97316';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.borderColor = '#f97316';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.color = '#444';
            e.currentTarget.style.borderColor = '#e2e2e2';
          }}
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
        <img src={logoWithText} alt="Aria" style={styles.logoInHeader} />
      </header>

      <section style={styles.hero}>
        <h1 style={styles.heroTitle}>Origins of Aria</h1>
        <p style={styles.heroSubtitle}>
          A journey from the stage to the architecture of intelligent scheduling.
        </p>
      </section>

      <div style={styles.section} className="reveal">
        <h2 style={styles.sectionHeading}>Why Aria Exists</h2>
        <div style={styles.textBlock}>
          Aria started with a simple observation about the weight of organization.
        </div>
        <div style={styles.textBlock}>
          I noticed that instructors and organizers spent an enormous amount of time dealing with scheduling. Slot conflicts, last-minute changes, initial placements, and constant coordination. It often took more time and energy than the actual work they were passionate about. Over time, I realized this was not unique to any one field. The same frustration came up across faculty, managers, and independent professionals everywhere.
        </div>
        <div style={styles.textBlock}>
          Capable, passionate people were spending hours managing logistics instead of doing the work they actually cared about.
        </div>
        <div style={styles.textBlock}>
          The tools they had were not wrong. They were just heavy. Over time, many became complicated, rigid, or exhausting to use. The intention was always good, but the experience slowly drifted away from the people using them.
        </div>
        <div style={styles.textBlock}>
          I kept thinking there had to be a better way.
        </div>
      </div>

      <div style={{ ...styles.section, background: '#fff' }} className="reveal">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Brain size={40} color="#f97316" />
          <h2 style={{ ...styles.sectionHeading, marginBottom: 0 }}>Built With Simplicity in Mind</h2>
        </div>
        <div style={styles.textBlock}>
          My background in music shaped how I think about structure, flow, and clarity. In that world, we often spoke about simplicity—about removing what was unnecessary so the intent could come through clearly and effortlessly.
        </div>
        <div style={styles.textBlock}>
          During one of those experiences, I encountered a quote that later became the guiding principle behind Aria:
        </div>
        <blockquote style={styles.quote}>
          “Everything should be made as simple as possible, but not simpler.”
          <br />
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#666', fontStyle: 'normal' }}>— Albert Einstein</span>
        </blockquote>
        <div style={styles.textBlock}>
          That idea guided every decision. Aria was never meant to do everything. It was meant to do the right things well, without getting in the way.
        </div>
        <div style={styles.textBlock}>
          Many products start simple and grow complicated over time. Aria was built to resist that. The goal was always ease, intuition, and respect for the user’s time.
        </div>
      </div>

      <div style={styles.section} className="reveal">
        <h2 style={styles.sectionHeading}>A Purpose-Driven Tool</h2>
        <div style={styles.textBlock}>
          Aria began as a project built specifically to help practitioners. The goal was straightforward: reduce the time spent scheduling so they could focus on their expertise, which was the reason they chose their profession in the first place.
        </div>
        <div style={styles.textBlock}>
          It was never built for me. From the start, it was meant for others.
        </div>
        <div style={styles.textBlock}>
          As development continued, it became clear that the same scheduling friction existed far beyond its original scope. Different roles, different industries, same problem. Too much energy spent organizing instead of doing meaningful work.
        </div>
        <div style={styles.textBlock}>
          That is when Aria started to evolve into a tool for anyone who needs to manage time and people.
        </div>
      </div>

      <div style={{ ...styles.section, padding: '4rem 2rem' }}>
        <div style={styles.card} className="reveal">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <Sparkles size={24} color="#f97316" />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>An Assistant, Not Just Software</h3>
          </div>
          <p style={styles.textBlock}>
            Aria is not meant to replace people. It is meant to work alongside them.
          </p>
          <p style={styles.textBlock}>
            The intention was always to create something that feels supportive rather than demanding. Something precise but warm. Reliable without being rigid. A tool that helps people feel in control instead of overwhelmed.
          </p>
          <p style={styles.textBlock}>
            When Aria works well, it fades into the background. Scheduling feels lighter. Organization feels clearer. The administrative weight is reduced enough that people can focus on what actually matters in their day.
          </p>
        </div>

        <div style={styles.card} className="reveal">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <Music size={24} color="#f97316" />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Why the Name Aria</h3>
          </div>
          <p style={styles.textBlock}>
            An aria is a moment in an opera where everything becomes clear. The structure is there, but it never overshadows the expression.
          </p>
          <p style={styles.textBlock}>
            That idea felt right.
          </p>
          <p style={styles.textBlock}>
            Aria is meant to bring clarity and calm to something that is usually frustrating. To make scheduling feel simpler, even enjoyable, without forcing people to change how they naturally work.
          </p>
        </div>
      </div>

      <div style={{ ...styles.section, textAlign: 'center' }} className="reveal">
        <h2 style={styles.sectionHeading}>Responsibility</h2>
        <p style={{ ...styles.textBlock, maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          Aria is something I am proud of, and something I feel responsible for.
        </p>
        <p style={{ ...styles.textBlock, maxWidth: '600px', margin: '0 auto' }}>
          Its success is not about adding more features or complexity. It is about staying true to its original purpose. Making scheduling easier without making everything else harder.
        </p>
        <p style={{ ...styles.textBlock, maxWidth: '600px', margin: '2rem auto', fontWeight: 600 }}>
          If Aria does its job well, people spend less time organizing and more time doing the work they care about.
        </p>
      </div>

      <footer style={styles.footer}>
        <div style={styles.legalSection}>
          <LegalItem title="Privacy Policy" icon={Shield}>
            <p style={{ marginBottom: '1.5rem' }}>Your privacy is a core priority at Aria. We believe in total transparency regarding how your information is handled.</p>

            <p style={{ marginBottom: '0.5rem', color: '#ccc', fontWeight: 600 }}>Data Collection & Usage</p>
            <p style={{ marginBottom: '1rem' }}>We only collect the minimum amount of personal information necessary to provide our scheduling services. This includes your name and email provided via Google OAuth. We do not sell, rent, or trade your personal data with third parties for marketing purposes.</p>

            <p style={{ marginBottom: '0.5rem', color: '#ccc', fontWeight: 600 }}>Security & Infrastructure</p>
            <p style={{ marginBottom: '1rem' }}>Aria leverages enterprise-grade security via Supabase and PostgreSQL. All class data and schedules are protected by Row Level Security (RLS) policies, ensuring that only you can access or modify your information. All data is encrypted both in transit and at rest.</p>

            <p style={{ marginBottom: '0.5rem', color: '#ccc', fontWeight: 600 }}>User Control</p>
            <p>You maintain full ownership of your data. You can access, update, or request the permanent deletion of your account and all associated schedules at any time through your account settings or by contacting our support team.</p>
          </LegalItem>

          <LegalItem title="Terms of Service" icon={FileText} isLast>
            <p style={{ marginBottom: '1.5rem' }}>By using Aria, you agree to the following terms and conditions designed to ensure a safe and reliable environment for all educators.</p>

            <p style={{ marginBottom: '0.5rem', color: '#ccc', fontWeight: 600 }}>Account Stewardship</p>
            <p style={{ marginBottom: '1rem' }}>Aria is intended for legitimate educational and professional scheduling. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your profile.</p>

            <p style={{ marginBottom: '0.5rem', color: '#ccc', fontWeight: 600 }}>Service Quality & Liability</p>
            <p style={{ marginBottom: '1rem' }}>While we strive for 99.9% uptime and a bug-free experience, Aria is provided "as is." We are not liable for any incidental or consequential damages resulting from service interruptions or data handling beyond our reasonable control.</p>

            <p style={{ marginBottom: '0.5rem', color: '#ccc', fontWeight: 600 }}>Future Evolution</p>
            <p>We reserve the right to evolve Aria's features and terms. Significant changes to service terms will be communicated ahead of time to ensure you remain in control of your scheduling workflow.</p>
          </LegalItem>
        </div>

        <p style={{ marginTop: '3rem', fontSize: '0.9rem' }}>© 2026 Aria. Designed for focus.</p>
      </footer>
    </div>
  );
}
