// src/components/Chat.tsx
import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { sendChatMessage, ARIA_SYSTEM_PROMPT, type Message } from '../lib/openrouter';
import { executeFunction } from '../lib/functions';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '600px',
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  header: {
    padding: '1rem 1.5rem',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  headerIcon: {
    width: '2rem',
    height: '2rem',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #fb923c, #fdba74)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  messageWrapper: {
    display: 'flex',
    gap: '0.75rem',
    maxWidth: '80%',
  },
  userMessageWrapper: {
    alignSelf: 'flex-end' as const,
    flexDirection: 'row-reverse' as const,
  },
  assistantMessageWrapper: {
    alignSelf: 'flex-start' as const,
  },
  avatar: {
    width: '2rem',
    height: '2rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatar: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  assistantAvatar: {
    background: 'linear-gradient(135deg, #fb923c, #fdba74)',
    color: 'white',
  },
  messageBubble: {
    padding: '0.75rem 1rem',
    borderRadius: '0.75rem',
    fontSize: '0.9375rem',
    lineHeight: '1.5',
  },
  userBubble: {
    backgroundColor: '#2563eb',
    color: 'white',
  },
  assistantBubble: {
    backgroundColor: '#f3f4f6',
    color: '#111827',
  },
  inputContainer: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  inputForm: {
    display: 'flex',
    gap: '0.75rem',
  },
  input: {
    flex: 1,
    padding: '0.75rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.9375rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  sendButton: {
    padding: '0.75rem 1.25rem',
    backgroundColor: '#f97316',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'background-color 0.2s',
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
    padding: '2rem',
  },
  emptyStateIcon: {
    marginBottom: '1rem',
  },
  emptyStateTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 0.5rem 0',
  },
  emptyStateText: {
    fontSize: '0.9375rem',
    margin: 0,
  },
};

interface ChatMessage extends Message {
  id: string;
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Prepare conversation history for API
      const conversationHistory: Message[] = [
        ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: userMessage.content },
      ];

      const response = await sendChatMessage(conversationHistory, ARIA_SYSTEM_PROMPT);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If there's a function call, execute it
      if (response.functionCall) {
        const { name, arguments: args } = response.functionCall;
        
        // Show a system message that we're executing the function
        const executingMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `Executing ${name}...`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, executingMessage]);

        // Execute the function
        const result = await executeFunction(name, args);

        // Remove the "executing" message and show result
        setMessages((prev) => prev.filter((msg) => msg.id !== executingMessage.id));

        const resultMessage: ChatMessage = {
          id: (Date.now() + 3).toString(),
          role: 'assistant',
          content: result.success
            ? `✓ Done! ${result.data?.label ? `Created "${result.data.label}"` : 'Action completed successfully.'}`
            : `✗ Error: ${result.error}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, resultMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>
          <Bot size={20} color="white" />
        </div>
        <h3 style={styles.headerText}>Chat with Aria</h3>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>
              <Bot size={48} color="#d1d5db" />
            </div>
            <h4 style={styles.emptyStateTitle}>Start a conversation with Aria</h4>
            <p style={styles.emptyStateText}>
              Ask me to help you create schedules, place students, or manage your lessons.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  ...styles.messageWrapper,
                  ...(message.role === 'user'
                    ? styles.userMessageWrapper
                    : styles.assistantMessageWrapper),
                }}
              >
                <div
                  style={{
                    ...styles.avatar,
                    ...(message.role === 'user' ? styles.userAvatar : styles.assistantAvatar),
                  }}
                >
                  {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
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
                <div style={{ ...styles.avatar, ...styles.assistantAvatar }}>
                  <Bot size={16} />
                </div>
                <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <style>
                    {`
                      @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                      }
                    `}
                  </style>
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
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            style={styles.input}
            disabled={loading}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#f97316';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            style={{
              ...styles.sendButton,
              ...(!input.trim() || loading ? styles.sendButtonDisabled : {}),
            }}
            onMouseEnter={(e) => {
              if (!loading && input.trim()) {
                e.currentTarget.style.backgroundColor = '#ea580c';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f97316';
            }}
          >
            {loading ? <Loader2 size={18} /> : <Send size={18} />}
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
