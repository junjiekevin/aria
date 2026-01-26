import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, MessageCircle, X, Minimize2 } from 'lucide-react';
import { sendChatMessage, type Message } from '../lib/openrouter';
import { getSystemPrompt, type PromptContext } from '../lib/aria';
import { executeFunction } from '../lib/functions';
import ariaProfile from '../assets/images/aria-profile.png';

const CHAT_STORAGE_KEY = 'aria_chat_messages';
const MAX_MESSAGES = 100;

interface ChatMessage extends Message {
  id: string;
  timestamp: Date;
}

interface FloatingChatProps {
  onScheduleChange?: () => void;
  onShowAutoSchedule?: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  // Chat Button (collapsed state)
  chatButton: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    right: '1.5rem',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #fb923c, #fdba74)',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  chatButtonHover: {
    transform: 'scale(1.05)',
    boxShadow: '0 6px 20px rgba(249, 115, 22, 0.5)',
  },
  notificationBadge: {
    position: 'absolute' as const,
    top: '-4px',
    right: '-4px',
    minWidth: '20px',
    height: '20px',
    padding: '0 6px',
    borderRadius: '10px',
    background: '#ef4444',
    color: 'white',
    fontSize: '12px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chat Window (expanded state)
  chatWindow: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    right: '1.5rem',
    width: '380px',
    height: '520px',
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100vh - 120px)',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 9999,
    overflow: 'hidden',
    animation: 'slideIn 0.3s ease',
  },
  chatWindowMobile: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100dvh', // Use dynamic viewport height for mobile browsers
    maxWidth: '100%',
    maxHeight: '100dvh',
    borderRadius: 0,
  },
  header: {
    padding: '1rem 1.25rem',
    background: 'linear-gradient(135deg, #fb923c, #fdba74)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexShrink: 0,
  },
  headerAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '2px solid rgba(255, 255, 255, 0.8)',
  },
  headerText: {
    flex: 1,
    color: 'white',
  },
  headerTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.2,
  },
  headerSubtitle: {
    fontSize: '0.75rem',
    opacity: 0.9,
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  headerButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    transition: 'background 0.2s',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    background: '#f9fafb',
  },
  messageWrapper: {
    display: 'flex',
    gap: '0.5rem',
    maxWidth: '85%',
  },
  userMessageWrapper: {
    alignSelf: 'flex-end' as const,
    flexDirection: 'row-reverse' as const,
  },
  assistantMessageWrapper: {
    alignSelf: 'flex-start' as const,
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '14px',
  },
  userAvatar: {
    background: '#2563eb',
    color: 'white',
  },
  messageBubble: {
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    fontSize: '0.875rem',
    lineHeight: 1.4,
  },
  userBubble: {
    background: '#2563eb',
    color: 'white',
    borderBottomRightRadius: '4px',
  },
  assistantBubble: {
    background: 'white',
    color: '#111827',
    borderBottomLeftRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  inputContainer: {
    padding: '0.75rem 1rem',
    background: 'white',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  inputForm: {
    display: 'flex',
    gap: '0.5rem',
  },
  input: {
    flex: 1,
    padding: '0.625rem 0.875rem',
    border: '1px solid #e5e7eb',
    borderRadius: '20px',
    fontSize: '0.875rem',
    outline: 'none',
    background: '#f9fafb',
    transition: 'border-color 0.2s, background 0.2s',
  },
  sendButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#f97316',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center' as const,
    color: '#6b7280',
    padding: '1.5rem',
  },
  emptyStateIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #fb923c, #fdba74)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  emptyStateTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 0.25rem 0',
  },
  emptyStateText: {
    fontSize: '0.8125rem',
    margin: 0,
    lineHeight: 1.5,
  },
};

function AnimatedIcon({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
      {children}
    </span>
  );
}

export default function FloatingChat({ onScheduleChange, onShowAutoSchedule }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load chat from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error('Failed to load chat from sessionStorage:', e);
      }
    }
  }, []);

  // Save chat to sessionStorage when messages change (with 100 message limit)
  useEffect(() => {
    if (messages.length > 0) {
      const limitedMessages = messages.length > MAX_MESSAGES
        ? messages.slice(-MAX_MESSAGES)
        : messages;
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(limitedMessages));
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Helper: Format function result for display vs for LLM
  const formatFunctionResult = (name: string, result: { success: boolean; data?: unknown; error?: string }) => {
    // Functions that need raw data sent back to LLM for follow-up
    const functionsNeedingRawData = [
      'listSchedules',
      'listTrashedSchedules',
      'getEventSummaryInSchedule',
      'listUnassignedParticipants',
      'getParticipantPreferences',
    ];

    let displayContent = '';
    let llmContent = '';
    let scheduleModified = false;

    if (result.success) {
      if (functionsNeedingRawData.includes(name) && result.data) {
        // Show raw JSON to both user and LLM (LLM needs IDs)
        const jsonResult = JSON.stringify(result.data, null, 2);
        displayContent = `[Function Result] ${name}:\n${jsonResult}`;
        llmContent = `[Function Result] ${name} succeeded:\n${jsonResult}`;
      } else if (name === 'createSchedule' && (result.data as { label?: string })?.label) {
        displayContent = `✓ Created "${(result.data as { label: string }).label}"`;
        llmContent = `[Function Result] ${name} succeeded: Created schedule "${(result.data as { label: string }).label}"`;
        scheduleModified = true;
      } else if (name === 'addEventToSchedule' && result.data) {
        const eventName = (result.data as { student_name?: string }).student_name || 'Event';
        displayContent = `✓ Added "${eventName}" to the schedule`;
        llmContent = `[Function Result] ${name} succeeded: Added "${eventName}" to the schedule`;
        scheduleModified = true;
      } else if (name === 'updateEventInSchedule') {
        displayContent = '✓ Event updated';
        llmContent = `[Function Result] ${name} succeeded: Event updated`;
        scheduleModified = true;
      } else if (name === 'deleteEventFromSchedule') {
        displayContent = '✓ Event deleted';
        llmContent = `[Function Result] ${name} succeeded: Event deleted`;
        scheduleModified = true;
      } else if (name === 'deleteSchedule' || name === 'trashSchedule') {
        displayContent = '✓ Schedule moved to trash';
        llmContent = `[Function Result] ${name} succeeded: Schedule moved to trash`;
        scheduleModified = true;
      } else if (name === 'updateSchedule') {
        displayContent = '✓ Schedule updated';
        llmContent = `[Function Result] ${name} succeeded: Schedule updated`;
        scheduleModified = true;
      } else if (name === 'recoverSchedule') {
        displayContent = '✓ Schedule restored';
        llmContent = `[Function Result] ${name} succeeded: Schedule restored`;
        scheduleModified = true;
      } else if (name === 'emptyTrash') {
        displayContent = '✓ Trash emptied';
        llmContent = `[Function Result] ${name} succeeded: Trash emptied`;
        scheduleModified = true;
      } else if (name === 'swapEvents') {
        displayContent = '✓ Events swapped';
        llmContent = `[Function Result] ${name} succeeded: Events swapped`;
        scheduleModified = true;
      } else if (name === 'markParticipantAssigned') {
        displayContent = '✓ Participant status updated';
        llmContent = `[Function Result] ${name} succeeded: Participant status updated`;
      } else {
        displayContent = '✓ Action completed';
        llmContent = `[Function Result] ${name} succeeded`;
      }
    } else {
      displayContent = `✗ Error: ${result.error}`;
      llmContent = `[Function Result] ${name} FAILED: ${result.error}`;
    }

    return { displayContent, llmContent, scheduleModified };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Add user message
    setMessages((prev) => {
      const updated = [...prev, userMessage];
      return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
    });
    setInput('');
    setLoading(true);

    try {
      // Extract schedule ID from URL
      const scheduleMatch = window.location.pathname.match(/\/schedule\/([a-f0-9-]{36})/i);
      const currentScheduleId = scheduleMatch ? scheduleMatch[1] : null;

      const promptContext: PromptContext = {
        scheduleId: currentScheduleId || undefined,
      };

      if (currentScheduleId) {
        console.log('[FloatingChat Debug] Current schedule context:', currentScheduleId);
      }

      // Build initial conversation history
      let conversationHistory: Message[] = [
        ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage.content },
      ];

      const systemPrompt = getSystemPrompt(userMessage.content, promptContext) +
        `\n\n---\n\n## SYSTEM CONTEXT\nCurrent Date & Time: ${new Date().toLocaleString()}\nIMPORTANT: Wrap your internal thinking in <thought>...</thought> tags. These will be hidden from the user.`;

      // Agentic loop - keep processing until no more function calls
      const MAX_ITERATIONS = 10; // Safety limit
      let iterations = 0;
      let anyScheduleModified = false;

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[FloatingChat Debug] Agentic loop iteration ${iterations}`);

        const response = await sendChatMessage(conversationHistory, systemPrompt);
        console.log('[FloatingChat Debug] Got response:', response);

        // History Logic: Use RAW content to preserve Function Call for LLM memory
        // This prevents the infinite loop "amnesia"
        conversationHistory = [
          ...conversationHistory,
          { role: 'assistant', content: response.rawContent || response.message },
        ];

        // UX Logic: Clean up usage
        // 1. Show FIRST message ("I'm on it")
        // 2. Hide intermediate messages (iterations > 1 with function calls)
        // 3. Show FINAL message (no function call)
        const shouldShowMessage = iterations === 1 || !response.functionCall;

        if (shouldShowMessage && response.message && response.message.trim()) {
          // Strip <thought>...</thought> tags and any legacy THOUGHT: blocks
          const displayMessage = response.message
            .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
            .replace(/THOUGHT:[\s\S]*?(?=\n|$)/gi, '')
            .trim();

          if (displayMessage) {
            const assistantMessage: ChatMessage = {
              id: (Date.now() + iterations * 10).toString(),
              role: 'assistant',
              content: displayMessage,
              timestamp: new Date(),
            };
            setMessages((prev) => {
              const updated = [...prev, assistantMessage];
              return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
            });
          }
        }

        // If no function call, we're done
        if (!response.functionCall) {
          console.log('[FloatingChat Debug] No function call, agentic loop complete');
          break;
        }

        // Execute the function
        const { name, arguments: args } = response.functionCall;
        console.log(`[FloatingChat Debug] Executing function: ${name}`, args);

        const result = await executeFunction(name, args);
        const { displayContent, llmContent, scheduleModified } = formatFunctionResult(name, result);

        if (scheduleModified) {
          anyScheduleModified = true;
        }

        // Special handling for Auto-Schedule Preview
        if (name === 'autoScheduleParticipants' && result.success && (result.data as any)?.previewHelper) {
          console.log('[FloatingChat] Triggering Auto-Schedule Preview UI');
          if (onShowAutoSchedule) {
            onShowAutoSchedule();
          }
        }

        // Show result to user ONLY IF ERROR
        // Success messages are hidden to reduce noise
        if (!result.success) {
          const resultMessage: ChatMessage = {
            id: (Date.now() + iterations * 10 + 1).toString(),
            role: 'assistant',
            content: displayContent, // Shows "Error: ..."
            timestamp: new Date(),
          };
          setMessages((prev) => {
            const updated = [...prev, resultMessage];
            return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
          });
        }

        // Add result to conversation history for LLM to continue
        // IMPORTANT: Use 'user' role to signal this is system feedback, not assistant output
        // This prompts the LLM to continue processing rather than assuming it's done
        const continuationPrompt = result.success
          ? `${llmContent}\n\n[System: Action completed. Check if there are more pending actions from the original request. If yes, proceed with the next FUNCTION_CALL. If all actions are complete, respond with a final confirmation.]`
          : llmContent;

        conversationHistory = [
          ...conversationHistory,
          { role: 'user', content: continuationPrompt },
        ];

        // If the function failed, break the loop
        if (!result.success) {
          console.log('[FloatingChat Debug] Function failed, stopping loop');
          break;
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        console.warn('[FloatingChat Debug] Max iterations reached');
      }

      // Trigger schedule refresh if any modifications were made
      if (anyScheduleModified && onScheduleChange) {
        setTimeout(() => onScheduleChange(), 100);
      }

    } catch (error) {
      console.error('Error in agentic loop:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const updated = [...prev, errorMessage];
        return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't render on auth page
  if (typeof window !== 'undefined' && window.location.pathname === '/') {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes pulse-ring {
            0% {
              transform: scale(0.8);
              opacity: 0.8;
            }
            50% {
              transform: scale(1);
              opacity: 0.4;
            }
            100% {
              transform: scale(0.8);
              opacity: 0.8;
            }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .chat-button:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5);
          }
          .send-button:hover:not(:disabled) {
            background-color: #ea580c !important;
          }
          .header-button:hover {
            background: rgba(255, 255, 255, 0.3) !important;
          }
          .input:focus {
            border-color: #f97316 !important;
            background: white !important;
          }
        `}
      </style>

      {/* Chat Window */}
      {isOpen && (
        <div style={{ ...styles.chatWindow, ...(isMobile ? styles.chatWindowMobile : {}) }}>
          {/* Header */}
          <div style={styles.header}>
            <img src={ariaProfile} alt="Aria" style={styles.headerAvatar} />
            <div style={styles.headerText}>
              <h3 style={styles.headerTitle}>Aria</h3>
              <p style={styles.headerSubtitle}>Your scheduling assistant</p>
            </div>
            <div style={styles.headerActions}>
              <button
                className="header-button"
                style={styles.headerButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                <Minimize2 size={18} />
              </button>
              <button
                className="header-button"
                style={styles.headerButton}
                onClick={() => setIsOpen(false)}
                aria-label="Minimize chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messagesContainer}>
            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyStateIcon}>
                  <MessageCircle size={24} color="white" />
                </div>
                <h4 style={styles.emptyStateTitle}>Start a conversation</h4>
                <p style={styles.emptyStateText}>
                  Ask me to help you create schedules or manage your events.
                </p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      ...styles.messageWrapper,
                      ...(message.role === 'user' ? styles.userMessageWrapper : styles.assistantMessageWrapper),
                    }}
                  >
                    <div
                      style={{
                        ...styles.avatar,
                        ...(message.role === 'user' ? styles.userAvatar : {}),
                      }}
                    >
                      {message.role === 'user' ? (
                        <User size={16} />
                      ) : (
                        <img src={ariaProfile} alt="Aria" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      )}
                    </div>
                    <div
                      style={{
                        ...styles.messageBubble,
                        ...(message.role === 'user' ? styles.userBubble : styles.assistantBubble),
                      }}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ ...styles.messageWrapper, ...styles.assistantMessageWrapper }}>
                    <img src={ariaProfile} alt="Aria" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div style={{ ...styles.messageBubble, ...styles.assistantBubble, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◉</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div style={styles.inputContainer}>
            <form onSubmit={handleSubmit} style={styles.inputForm}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                style={styles.input}
                disabled={loading}
                className="input"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="send-button"
                style={{
                  ...styles.sendButton,
                  ...(!input.trim() || loading ? styles.sendButtonDisabled : {}),
                }}
              >
                {loading ? (
                  <AnimatedIcon><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></AnimatedIcon>
                ) : (
                  <AnimatedIcon><Send size={18} /></AnimatedIcon>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Chat Button (when closed) */}
      {!isOpen && (
        <button
          className="chat-button"
          style={styles.chatButton}
          onClick={() => setIsOpen(true)}
          aria-label="Open chat"
        >
          {messages.length > 0 && (
            <div style={styles.notificationBadge} />
          )}
          <MessageCircle size={28} color="white" />
        </button>
      )}
    </>
  );
}
