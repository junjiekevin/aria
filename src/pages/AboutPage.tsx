// src/pages/AboutPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Sparkles, Shield, FileText, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import logoWithText from '../assets/images/logo-with-text.png';
import s from './AboutPage.module.css';

const LegalItem = ({ title, icon: Icon, isLast, children }: { title: string, icon: React.ElementType, isLast?: boolean, children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
      <div
        className={s.legalToggle}
        style={{ color: isOpen ? 'var(--brand-primary)' : '#ccc' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Icon size={20} />
          <span style={{ fontWeight: 600 }}>{title}</span>
        </div>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>
      {isOpen && (
        <div className={s.legalContent}>
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

    document.querySelectorAll(`.${s.reveal}`).forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={s.container}>
      <header className={s.header}>
        <button
          onClick={() => navigate('/dashboard')}
          className={s.backButton}
        >
          <ArrowLeft size={18} />
          Go Back
        </button>
        <img src={logoWithText} alt="Aria" className={s.logoInHeader} />
      </header>

      <section className={s.hero}>
        <h1 className={s.heroTitle}>Origins of Aria</h1>
        <p className={s.heroSubtitle}>
          A journey from the stage to the architecture of intelligent scheduling.
        </p>
      </section>

      <div className={`${s.section} ${s.reveal}`}>
        <h2 className={s.sectionHeading}>Why Aria Exists</h2>
        <div className={s.textBlock}>
          Aria started with a simple observation about the weight of organization.
        </div>
        <div className={s.textBlock}>
          I noticed how much time people spent just trying to manage schedules. Collecting availability. Placing people on a timetable. Handling conflicts and changes when plans shifted. Capable, passionate people were spending hours managing logistics instead of doing the work they actually cared about.
        </div>
        <div className={s.textBlock}>
          Over time, it became clear this wasn’t limited to one role or industry. The same frustration showed up across faculty, managers, administrators, and independent professionals.
        </div>
        <div className={s.textBlock}>
          The tools they had were not wrong. They were just heavy. Over time, many became complicated, rigid, or exhausting to use. The intention was always good, but the experience slowly drifted away from the people using them.
        </div>
        <div className={s.textBlock}>
          I kept thinking there had to be a better way.
        </div>
      </div>

      <div style={{ background: '#fff' }} className={`${s.section} ${s.reveal}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Brain size={40} color="#f97316" />
          <h2 className={s.sectionHeading} style={{ marginBottom: 0 }}>Built With Simplicity in Mind</h2>
        </div>
        <div className={s.textBlock}>
          My background in music shaped how I think about structure, flow, and clarity. In that world, we often speak about simplicity. About removing what is unnecessary so the intent can come through clearly and effortlessly.
        </div>
        <div className={s.textBlock}>
          During one of such conversations with my teacher, she shared a quote that stayed with me, one that continues to guide my life and eventually became the guiding principle behind Aria:
        </div>
        <blockquote className={s.quote}>
          “Everything should be made as simple as possible, but not simpler.”
          <br />
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#666', fontStyle: 'normal' }}>— Albert Einstein</span>
        </blockquote>
        <div className={s.textBlock}>
          That idea guided every decision. Aria was never meant to do everything. It was meant to do the right things well, without getting in the way.
        </div>
        <div className={s.textBlock}>
          Many products start simple and grow complicated over time. Aria was built to resist that. The goal was always ease, intuition, and respect for the user’s time.
        </div>
      </div>

      <div className={`${s.section} ${s.reveal}`}>
        <h2 className={s.sectionHeading}>A Purpose-Driven Tool</h2>
        <div className={s.textBlock}>
          Aria began as a project built specifically to help practitioners. The goal was straightforward: reduce the time spent scheduling so they could focus on their expertise, which was the reason they chose their profession in the first place.
        </div>
        <div className={s.textBlock}>
          It was never built for me. From the start, it was meant for others.
        </div>
        <div className={s.textBlock}>
          As development continued, it became clear that the same scheduling friction existed far beyond its original scope. Different roles, different industries, same problem. Too much energy spent organizing instead of doing meaningful work.
        </div>
        <div className={s.textBlock}>
          That is when Aria started to evolve into a tool for anyone who needs to manage time and people.
        </div>
      </div>

      <div className={s.section}>
        <div className={`${s.card} ${s.reveal}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <Sparkles size={24} color="#f97316" />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>An Assistant, Not Just Software</h3>
          </div>
          <p className={s.textBlock}>
            Aria is not meant to replace people. It is meant to work alongside them.
          </p>
          <p className={s.textBlock}>
            The intention was always to create something that feels supportive rather than demanding. Something precise but warm. Reliable without being rigid. A tool that helps people feel in control instead of overwhelmed.
          </p>
          <p className={s.textBlock}>
            When Aria works well, it fades into the background. Scheduling feels lighter. Organization feels clearer. The administrative weight is reduced enough that people can focus on what actually matters in their day.
          </p>
        </div>

        <div className={`${s.card} ${s.reveal}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <Music size={24} color="#f97316" />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Why the Name Aria</h3>
          </div>
          <p className={s.textBlock}>
            An aria is a moment in an opera where everything becomes clear. The structure is there, but it never overshadows the expression.
          </p>
          <p className={s.textBlock}>
            That idea felt right.
          </p>
          <p className={s.textBlock}>
            Aria is meant to bring clarity and calm to something that is usually frustrating. To make scheduling feel simpler, even enjoyable, without forcing people to change how they naturally work.
          </p>
        </div>
      </div>

      <div className={`${s.section} ${s.reveal}`} style={{ textAlign: 'center' }}>
        <h2 className={s.sectionHeading}>The Goal</h2>
        <p className={s.textBlock} style={{ maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          Aria is something I am proud of, and something I feel responsible for.
        </p>
        <p className={s.textBlock} style={{ maxWidth: '600px', margin: '0 auto' }}>
          Its success is not about adding more features or complexity. It is about staying true to its original purpose. Making scheduling easier without making everything else harder.
        </p>
        <p className={s.textBlock} style={{ maxWidth: '600px', margin: '2rem auto', fontWeight: 600 }}>
          If Aria does its job well, people spend less time organizing and more time doing the work they care about.
        </p>
      </div>

      <footer className={s.footer}>
        <div className={s.legalSection}>
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
