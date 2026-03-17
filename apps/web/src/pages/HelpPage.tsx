// src/pages/HelpPage.tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Sparkles,
  Calendar,
  Users,
  Settings,
  ChevronRight,
  Mail,
  MessageSquare,
  Lock,
} from 'lucide-react';
import s from './HelpPage.module.css';

const HELP_CATEGORIES = [
  {
    id: 'ai',
    title: 'Calendar Assistant',
    desc: 'Use chat to orchestrate connected calendar actions.',
    icon: Sparkles,
    color: '#8b5cf6',
    bg: '#f5f3ff',
  },
  {
    id: 'calendar',
    title: 'Calendar Operations',
    desc: 'Manage events and updates from the calendar workspace.',
    icon: Calendar,
    color: '#f97316',
    bg: '#fff7ed',
  },
  {
    id: 'intake',
    title: 'Availability Intake',
    desc: 'Collect participant availability for organizer review.',
    icon: Users,
    color: '#06b6d4',
    bg: '#ecfeff',
  },
  {
    id: 'account',
    title: 'Settings & Privacy',
    desc: 'Control profile, permissions, and data safety.',
    icon: Settings,
    color: '#ec4899',
    bg: '#fdf2f8',
  },
];

const FAQ_DATA = [
  {
    category: 'ai',
    question: 'How do I talk to Aria?',
    answer: "Use the floating chat on authenticated routes. Ask for calendar actions like 'Create a 30-minute event tomorrow at 2 PM'.",
  },
  {
    category: 'ai',
    question: 'Do chat actions use the same backend path as the calendar UI?',
    answer: 'Yes. Chat and direct UI event actions share the same server command handlers and operation logging path.',
  },
  {
    category: 'calendar',
    question: 'How does sync with connected calendars work?',
    answer: 'Aria reads and reconciles selected Google calendars, then renders canonical event state in the calendar workspace.',
  },
  {
    category: 'calendar',
    question: 'How is the primary write calendar used?',
    answer: 'New event writes use the selected primary write calendar by default unless you explicitly choose another connected calendar.',
  },
  {
    category: 'intake',
    question: 'What does an availability submission mean?',
    answer: 'A submission is intake data for organizer review. It is not a final booking confirmation.',
  },
  {
    category: 'intake',
    question: 'How do I handle late submissions?',
    answer: 'If a public intake deadline has passed, participants should contact the organizer directly for next steps.',
  },
  {
    category: 'account',
    question: 'Where are provider tokens stored?',
    answer: 'Provider tokens stay server-side only. Browsers do not receive provider refresh tokens.',
  },
  {
    category: 'account',
    question: 'Can I limit which calendars are visible?',
    answer: 'Yes. Use calendar visibility toggles in the calendar workspace while keeping primary write context visible.',
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter((faq) => {
      const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase())
        || faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory ? faq.category === activeCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  return (
    <div className={s.container}>
      <header className={s.header}>
        <div className={s.headerContent}>
          <button onClick={() => navigate('/calendar')} className={s.backButton}>
            <ArrowLeft size={20} />
          </button>
          <span style={{ fontWeight: '600', color: 'var(--text-400)' }}>Help Center</span>
        </div>
      </header>

      <section className={s.hero}>
        <h1 className={s.heroTitle}>How can we help?</h1>
        <p className={s.heroSubtitle}>Aria is a calendar orchestration assistant over connected calendars.</p>
        <div className={s.searchContainer}>
          <Search size={20} color="#9ca3af" style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search guides and FAQ..."
            className={s.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      <main className={s.main}>
        {!searchQuery && (
          <div className={s.grid}>
            {HELP_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className={s.categoryCard}
                style={{
                  borderColor: activeCategory === cat.id ? cat.color : 'var(--border-gray-200)',
                  boxShadow: activeCategory === cat.id ? `0 10px 20px -5px ${cat.color}20` : 'none',
                  transform: activeCategory === cat.id ? 'translateY(-4px)' : 'none',
                }}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              >
                <div className={s.iconBox} style={{ background: cat.bg, color: cat.color }}>
                  <cat.icon size={24} />
                </div>
                <div>
                  <h3 style={{ fontWeight: '700', fontSize: '1.125rem', marginBottom: '0.25rem' }}>{cat.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-500)', lineHeight: '1.5' }}>{cat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className={s.sectionTitle}>
          {searchQuery ? `Search Results for "${searchQuery}"` : activeCategory ? `${HELP_CATEGORIES.find((c) => c.id === activeCategory)?.title} FAQ` : 'Common Questions'}
        </h2>

        <div className={s.faqList}>
          {filteredFaqs.length > 0 ? filteredFaqs.map((faq, i) => (
            <div
              key={i}
              className={s.faqItem}
              style={{ borderColor: openFaq === faq.question ? 'var(--brand-primary)' : 'var(--border-gray-200)' }}
            >
              <div className={s.faqHeader} onClick={() => setOpenFaq(openFaq === faq.question ? null : faq.question)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', background: 'var(--bg-gray-50)', borderRadius: '8px' }}>
                    {faq.category === 'ai' && <Sparkles size={16} color="#8b5cf6" />}
                    {faq.category === 'calendar' && <Calendar size={16} color="var(--brand-primary)" />}
                    {faq.category === 'intake' && <Users size={16} color="#06b6d4" />}
                    {faq.category === 'account' && <Lock size={16} color="#ec4899" />}
                  </div>
                  {faq.question}
                </div>
                <ChevronRight
                  size={20}
                  color="#9ca3af"
                  style={{ transition: 'transform 0.2s', transform: openFaq === faq.question ? 'rotate(90deg)' : 'none' }}
                />
              </div>
              {openFaq === faq.question && (
                <div className={s.faqContent}><p style={{ margin: 0 }}>{faq.answer}</p></div>
              )}
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <h3 style={{ fontWeight: '600' }}>No matches found</h3>
              <p style={{ color: 'var(--text-400)' }}>Try broader keywords.</p>
            </div>
          )}
        </div>

        <div className={s.contactGrid}>
          <div className={s.contactCard}>
            <div className={s.iconBox} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}><Mail size={24} /></div>
            <h3 style={{ fontWeight: '700' }}>Technical Support</h3>
            <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>Need help with sync, setup, or event behavior?</p>
            <button className={s.contactButton} onClick={() => { window.location.href = 'mailto:support@aria.app'; }}>
              Email Support
            </button>
          </div>
          <div className={s.contactCard} style={{ background: 'var(--brand-primary)' }}>
            <div className={s.iconBox} style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}><MessageSquare size={24} /></div>
            <h3 style={{ fontWeight: '700' }}>Feature Guides</h3>
            <p style={{ opacity: 0.9, fontSize: '0.875rem' }}>Review practical examples for calendar and intake workflows.</p>
            <button className={s.contactButton} style={{ background: 'white', color: 'var(--brand-primary)' }}>
              View Tutorials
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
