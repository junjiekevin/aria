// src/components/Modal.tsx
import { type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    position: 'relative' as const,
    margin: 'auto',
  },
  header: {
    padding: '1.5rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky' as const,
    top: 0,
    backgroundColor: 'white',
    zIndex: 10,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '0.375rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  content: {
    padding: '1.5rem',
  },
};

export default function Modal({ isOpen, onClose, title, children, maxWidth = '32rem' }: ModalProps) {
  if (!isOpen) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const responsiveMaxWidth = isMobile ? '95%' : maxWidth;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{ ...styles.modal, maxWidth: responsiveMaxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          ...styles.header,
          padding: isMobile ? '1rem' : '1.5rem',
        }}>
          <h2 style={{
            ...styles.title,
            fontSize: isMobile ? '1.25rem' : '1.5rem',
          }}>{title}</h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X size={isMobile ? 20 : 24} color="#6b7280" />
          </button>
        </div>
        <div style={{
          ...styles.content,
          padding: isMobile ? '1rem' : '1.5rem',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
