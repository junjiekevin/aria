// src/pages/HelpPage.tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Sparkles,
  MousePointer2,
  Users,
  Settings,
  ChevronRight,
  Mail,
  MessageSquare,
  Lock
} from 'lucide-react';
import s from './HelpPage.module.css';

const HELP_CATEGORIES = [
  {
    id: 'ai',
    title: 'AI Assistant',
    desc: 'Master natural language commands and automation.',
    icon: Sparkles,
    color: '#8b5cf6',
    bg: '#f5f3ff'
  },
  {
    id: 'timetable',
    title: 'Timetable Tools',
    desc: 'Unlocking drag-and-drop, swaps, and recurrence.',
    icon: MousePointer2,
    color: '#f97316',
    bg: '#fff7ed'
  },
  {
    id: 'forms',
    title: 'Availability Forms',
    desc: 'Managing participant info and automated submissions.',
    icon: Users,
    color: '#06b6d4',
    bg: '#ecfeff'
  },
  {
    id: 'account',
    title: 'Settings & Privacy',
    desc: 'Managing profile, hours, and data security.',
    icon: Settings,
    color: '#ec4899',
    bg: '#fdf2f8'
  }
];

const FAQ_DATA = [
  {
    category: 'ai',
    question: 'How do I talk to Aria?',
    answer: "Click the floating chat icon in the bottom right corner of any schedule page. You can give natural language commands like 'Add John on Monday at 3pm' or 'Move Sarah to tomorrow morning'. Aria uses an 'Agentic Loop' to confirm details and execute multiple steps automatically."
  },
  {
    category: 'ai',
    question: 'What can Aria actually do?',
    answer: "Aria can: \n• Add single or multiple events \n• Move events between days or times \n• Perform 'Collision-Safe Swaps' between two participants \n• Delete events and clean up unassigned entries \n• Answer questions about your current schedule data."
  },
  {
    category: 'timetable',
    question: 'How does the Collision-Safe Swap work?',
    answer: "You can drag one participant block directly onto another participant's block. Aria will perform an 'Atomic Swap'—meaning both events change places while preserving their original durations and recurrence settings. This prevents data loss and accidental overlaps."
  },
  {
    category: 'timetable',
    question: 'How do I handle recurring events?',
    answer: "When adding an event, you can choose between 'Once', 'Weekly', 'Every 2 Weeks', or 'Monthly'. The system uses RRULE logic to ensure these appear correctly every week. If you move a recurring event, it will update the pattern for future occurrences as well."
  },
  {
    category: 'timetable',
    question: 'Where is the Trash Zone?',
    answer: "When you start dragging an event, a pill-shaped 'Trash Zone' will slide down from the top-center of the screen. Drop any event there to remove it from the timetable. Don't worry—you'll see a confirmation before anything is permanently deleted."
  },
  {
    category: 'account',
    question: 'How do I change my working hours?',
    answer: "Each schedule can have its own operational window. In the 'Settings' menu of a schedule, look for 'Operating Hours'. You can define a 'Day Start' and 'Day End'. The timetable grid and public submission form will automatically shrink or expand to match these hours."
  },
  {
    category: 'account',
    question: 'What do the different statuses mean?',
    answer: "• Draft: Private workspace for planning.\n• Active (Collecting): Public form is open for submissions.\n• Archived: Closed schedule kept for records.\n• Trashed: Queued for permanent deletion in 30 days."
  },
  {
    category: 'forms',
    question: 'How do participants submit their availability?',
    answer: "Generate a 'Public Form Link' from the Action Toolbar. Participants can visit this link (no login required) to submit up to 3 preferred slots. Once they submit, they appear in your 'Unassigned' list on the schedule page."
  },
  {
    category: 'forms',
    question: 'How do I place unassigned participants?',
    answer: "Open the 'Events' menu in the Action Toolbar to see participants who have submitted forms but aren't on the grid. You can drag them directly onto an empty slot, or ask Aria to 'Schedule all unassigned participants' for you."
  }
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter(faq => {
      const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory ? faq.category === activeCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  return (
    <div className={s.container}>
      <header className={s.header}>
        <div className={s.headerContent}>
          <button
            onClick={() => navigate('/dashboard')}
            className={s.backButton}
          >
            <ArrowLeft size={20} />
          </button>
          <span style={{ fontWeight: '600', color: 'var(--text-400)' }}>Help Center</span>
        </div>
      </header>

      <section className={s.hero}>
        <h1 className={s.heroTitle}>How can we help?</h1>
        <p className={s.heroSubtitle}>
          Everything you need to know about Aria, the intelligent scheduling assistant.
        </p>
        <div className={s.searchContainer}>
          <Search
            size={20}
            color="#9ca3af"
            style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search for guides, features, and tips..."
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
                  transform: activeCategory === cat.id ? 'translateY(-4px)' : 'none'
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
          {searchQuery ? `Search Results for "${searchQuery}"` : activeCategory ? `${HELP_CATEGORIES.find(c => c.id === activeCategory)?.title} FAQ` : 'Common Questions'}
        </h2>

        <div className={s.faqList}>
          {filteredFaqs.length > 0 ? filteredFaqs.map((faq, i) => (
            <div
              key={i}
              className={s.faqItem}
              style={{
                borderColor: openFaq === faq.question ? 'var(--brand-primary)' : 'var(--border-gray-200)'
              }}
            >
              <div
                className={s.faqHeader}
                onClick={() => setOpenFaq(openFaq === faq.question ? null : faq.question)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', background: 'var(--bg-gray-50)', borderRadius: '8px' }}>
                    {faq.category === 'ai' && <Sparkles size={16} color="#8b5cf6" />}
                    {faq.category === 'timetable' && <MousePointer2 size={16} color="var(--brand-primary)" />}
                    {faq.category === 'forms' && <Users size={16} color="#06b6d4" />}
                    {faq.category === 'account' && <Lock size={16} color="#ec4899" />}
                  </div>
                  {faq.question}
                </div>
                <ChevronRight
                  size={20}
                  color="#9ca3af"
                  style={{
                    transition: 'transform 0.2s',
                    transform: openFaq === faq.question ? 'rotate(90deg)' : 'none'
                  }}
                />
              </div>
              {openFaq === faq.question && (
                <div className={s.faqContent}>
                  {faq.answer.split('\n').map((line, idx) => (
                    <p key={idx} style={{ margin: '0 0 0.5rem 0' }}>{line}</p>
                  ))}
                </div>
              )}
            </div>
          )) : (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <div style={{ background: '#f3f4f6', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <Search size={32} color="#9ca3af" />
              </div>
              <h3 style={{ fontWeight: '600' }}>No matches found</h3>
              <p style={{ color: 'var(--text-400)' }}>Try using broader keywords or check another category.</p>
            </div>
          )}
        </div>

        <div className={s.contactGrid}>
          <div className={s.contactCard}>
            <div className={s.iconBox} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <Mail size={24} />
            </div>
            <h3 style={{ fontWeight: '700' }}>Technical Support</h3>
            <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>Have a bug or feature request? Our engineering team is here to help.</p>
            <button
              className={s.contactButton}
              onClick={() => window.location.href = 'mailto:support@aria.app'}
            >
              Email Support
            </button>
          </div>
          <div className={s.contactCard} style={{ background: 'var(--brand-primary)' }}>
            <div className={s.iconBox} style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <MessageSquare size={24} />
            </div>
            <h3 style={{ fontWeight: '700' }}>Feature Guides</h3>
            <p style={{ opacity: 0.9, fontSize: '0.875rem' }}>Want to see Aria in action? Check out our visual tutorials and community forum.</p>
            <button
              className={s.contactButton}
              style={{ background: 'white', color: 'var(--brand-primary)' }}
            >
              View Tutorials
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
