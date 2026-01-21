// src/pages/HelpPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Mail, ExternalLink, ChevronDown, ChevronUp, FileText } from 'lucide-react';

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
    padding: '1.5rem',
    marginBottom: '1rem',
  },
  cardTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  faqItem: {
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '1rem',
    marginBottom: '1rem',
  },
  faqQuestion: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    fontWeight: '500',
    color: '#111827',
    marginBottom: '0.5rem',
  },
  faqAnswer: {
    color: '#6b7280',
    lineHeight: 1.6,
    paddingLeft: '1.5rem',
  },
  contactOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#f9fafb',
    borderRadius: '0.5rem',
    marginBottom: '0.75rem',
  },
  contactIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '0.5rem',
    backgroundColor: '#ffedd5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f97316',
  },
  contactText: {
    flex: 1,
  },
  contactLabel: {
    fontWeight: '500',
    color: '#111827',
    marginBottom: '0.25rem',
  },
  contactDesc: {
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  link: {
    color: '#f97316',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
};

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "How do I create a new schedule?",
    answer: "Click the 'New Schedule' button on your dashboard. You can either start from scratch or use our AI assistant to help you create a schedule based on your preferences and constraints."
  },
  {
    question: "Can I edit a schedule after creating it?",
    answer: "Yes! Click the 'Edit' button on any schedule card to make changes. You can update the schedule name, dates, and all other details."
  },
  {
    question: "What do the schedule statuses mean?",
    answer: "• Draft: Work in progress, not yet shared\n• Active: Currently collecting or being used\n• Archived: Past schedules you want to keep\n• Trashed: Deleted schedules (can be restored before permanent deletion)"
  },
  {
    question: "How does the AI scheduling assistant work?",
    answer: "Our AI assistant (powered by OpenRouter/Gemini) can help you create optimized schedules based on your constraints. Just describe what you need in the chat, and it will generate schedule suggestions that you can customize."
  },
  {
    question: "How do I add lessons or events to a schedule?",
    answer: "Open a schedule and click the 'Add Event' button. Fill in the student name, day, time, duration, and frequency. You can also ask the AI assistant to add events for you."
  },
  {
    question: "What frequency options are available for events?",
    answer: "• Once: Single occurrence on the selected date\n• Weekly: Repeats every week on the selected day\n• 2Weekly: Repeats every 2 weeks on the selected day\n• Monthly: Repeats every 4 weeks on the selected day"
  },
  {
    question: "Can I move or swap events on the timetable?",
    answer: "Yes! Drag any event card and drop it onto another time slot to move it. You can also drag one event onto another to swap their positions. The frequency and duration are preserved when swapping."
  },
  {
    question: "How do I manage my students?",
    answer: "Visit the Students page to view all your students. You can add new students with their contact information, edit existing details, or remove students from your list."
  },
  {
    question: "Can I share my schedules with others?",
    answer: "Currently, schedules are viewable by anyone with the schedule link. We're working on adding more sharing and collaboration features in future updates."
  },
  {
    question: "How do I delete a schedule?",
    answer: "Click 'Edit' on a schedule, then use the trash icon or change the status to 'Trashed'. Trashed schedules are kept for 30 days before permanent deletion."
  },
  {
    question: "How do I view or edit a specific event?",
    answer: "Click on any event card in the timetable to open the Event Details modal. From there you can view all details, edit the event, or delete it."
  },
  {
    question: "How do I navigate between weeks?",
    answer: "Use the Previous Week and Next Week buttons at the top of the timetable view to navigate through the schedule. You can also click on the date range to jump to a specific week."
  }
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

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
          <h1 style={styles.title}>Help & Support</h1>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>
            <MessageCircle size={24} />
            Frequently Asked Questions
          </h2>

          {faqData.map((faq, index) => (
            <div key={index} style={styles.faqItem}>
              <div
                style={styles.faqQuestion}
                onClick={() => toggleFaq(index)}
              >
                <span>{faq.question}</span>
                {openFaqIndex === index ? (
                  <ChevronUp size={20} color="#6b7280" />
                ) : (
                  <ChevronDown size={20} color="#6b7280" />
                )}
              </div>
              {openFaqIndex === index && (
                <div style={styles.faqAnswer}>{faq.answer}</div>
              )}
            </div>
          ))}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>
            <Mail size={24} />
            Contact Support
          </h2>

          <div style={styles.contactOption}>
            <div style={styles.contactIcon}>
              <Mail size={24} />
            </div>
            <div style={styles.contactText}>
              <div style={styles.contactLabel}>Email Support</div>
              <div style={styles.contactDesc}>
                Get help via email. We typically respond within 24-48 hours.
              </div>
            </div>
            <a
              href="mailto:support@aria.app"
              style={{
                ...styles.link,
                padding: '0.5rem 1rem',
                backgroundColor: '#fff7ed',
                borderRadius: '0.5rem',
              }}
            >
              Email Us
            </a>
          </div>

          <div style={styles.contactOption}>
            <div style={styles.contactIcon}>
              <FileText size={24} />
            </div>
            <div style={styles.contactText}>
              <div style={styles.contactLabel}>Documentation</div>
              <div style={styles.contactDesc}>
                Check our documentation for detailed guides and tutorials.
              </div>
            </div>
            <a
              href="#"
              style={{
                ...styles.link,
                padding: '0.5rem 1rem',
                backgroundColor: '#fff7ed',
                borderRadius: '0.5rem',
              }}
            >
              View Docs
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
