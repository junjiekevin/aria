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

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#fcfcfd',
    color: '#111827',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    paddingBottom: '5rem',
  },
  header: {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    padding: '1rem 0',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    background: 'white',
    cursor: 'pointer',
    color: '#374151',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  hero: {
    background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)',
    padding: '4rem 1.5rem',
    textAlign: 'center',
    borderBottom: '1px solid #fee2e2',
  },
  heroTitle: {
    fontSize: '2.5rem',
    fontWeight: '800',
    letterSpacing: '-0.025em',
    marginBottom: '1rem',
    background: 'linear-gradient(to right, #111827, #4b5563)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '1.125rem',
    color: '#4b5563',
    maxWidth: '600px',
    margin: '0 auto 2.5rem',
  },
  searchContainer: {
    maxWidth: '600px',
    margin: '0 auto',
    position: 'relative',
  },
  searchInput: {
    width: '100%',
    padding: '1.25rem 1.5rem 1.25rem 3.5rem',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    fontSize: '1rem',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
    outline: 'none',
    transition: 'all 0.2s',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '3rem 1.5rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    marginBottom: '4rem',
  },
  categoryCard: {
    padding: '1.5rem',
    borderRadius: '20px',
    background: 'white',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  iconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.5rem',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    marginBottom: '2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  faqList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '900px',
  },
  faqItem: {
    background: 'white',
    borderRadius: '16px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    transition: 'all 0.2s',
  },
  faqHeader: {
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '1rem',
  },
  faqContent: {
    padding: '0 1.5rem 1.5rem',
    color: '#4b5563',
    lineHeight: '1.6',
    fontSize: '0.9375rem',
  },
  contactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
    marginTop: '4rem',
  },
  contactCard: {
    padding: '2rem',
    borderRadius: '24px',
    background: '#111827',
    color: 'white',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  contactButton: {
    marginTop: '1rem',
    padding: '0.75rem 1.5rem',
    borderRadius: '12px',
    background: '#f97316',
    color: 'white',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  }
};

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
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <button
            onClick={() => navigate('/dashboard')}
            style={styles.backButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f97316';
              e.currentTarget.style.color = '#f97316';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.color = '#374151';
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <span style={{ fontWeight: '600', color: '#6b7280' }}>Help Center</span>
        </div>
      </header>

      <section style={styles.hero}>
        <h1 style={styles.heroTitle}>How can we help?</h1>
        <p style={styles.heroSubtitle}>
          Everything you need to know about Aria, the intelligent scheduling assistant.
        </p>
        <div style={styles.searchContainer}>
          <Search
            size={20}
            color="#9ca3af"
            style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search for guides, features, and tips..."
            style={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#f97316';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(249, 115, 22, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05)';
            }}
          />
        </div>
      </section>

      <main style={styles.main}>
        {!searchQuery && (
          <div style={styles.grid}>
            {HELP_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                style={{
                  ...styles.categoryCard,
                  borderColor: activeCategory === cat.id ? cat.color : '#e5e7eb',
                  boxShadow: activeCategory === cat.id ? `0 10px 20px -5px ${cat.color}20` : 'none',
                  transform: activeCategory === cat.id ? 'translateY(-4px)' : 'none'
                }}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                onMouseEnter={(e) => {
                  if (activeCategory !== cat.id) {
                    e.currentTarget.style.borderColor = cat.color;
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeCategory !== cat.id) {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <div style={{ ...styles.iconBox, background: cat.bg, color: cat.color }}>
                  <cat.icon size={24} />
                </div>
                <div>
                  <h3 style={{ fontWeight: '700', fontSize: '1.125rem', marginBottom: '0.25rem' }}>{cat.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.5' }}>{cat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={styles.sectionTitle}>
          {searchQuery ? `Search Results for "${searchQuery}"` : activeCategory ? `${HELP_CATEGORIES.find(c => c.id === activeCategory)?.title} FAQ` : 'Common Questions'}
        </h2>

        <div style={styles.faqList}>
          {filteredFaqs.length > 0 ? filteredFaqs.map((faq, i) => (
            <div
              key={i}
              style={{
                ...styles.faqItem,
                borderColor: openFaq === faq.question ? '#f97316' : '#e5e7eb'
              }}
            >
              <div
                style={styles.faqHeader}
                onClick={() => setOpenFaq(openFaq === faq.question ? null : faq.question)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', background: '#f9fafb', borderRadius: '8px' }}>
                    {faq.category === 'ai' && <Sparkles size={16} color="#8b5cf6" />}
                    {faq.category === 'timetable' && <MousePointer2 size={16} color="#f97316" />}
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
                <div style={styles.faqContent}>
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
              <p style={{ color: '#6b7280' }}>Try using broader keywords or check another category.</p>
            </div>
          )}
        </div>

        <div style={styles.contactGrid}>
          <div style={styles.contactCard}>
            <div style={{ ...styles.iconBox, background: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <Mail size={24} />
            </div>
            <h3 style={{ fontWeight: '700' }}>Technical Support</h3>
            <p style={{ opacity: 0.7, fontSize: '0.875rem' }}>Have a bug or feature request? Our engineering team is here to help.</p>
            <button
              style={styles.contactButton}
              onClick={() => window.location.href = 'mailto:support@aria.app'}
            >
              Email Support
            </button>
          </div>
          <div style={{ ...styles.contactCard, background: '#f97316' }}>
            <div style={{ ...styles.iconBox, background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <MessageSquare size={24} />
            </div>
            <h3 style={{ fontWeight: '700' }}>Feature Guides</h3>
            <p style={{ opacity: 0.9, fontSize: '0.875rem' }}>Want to see Aria in action? Check out our visual tutorials and community forum.</p>
            <button
              style={{ ...styles.contactButton, background: 'white', color: '#f97316' }}
            >
              View Tutorials
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
