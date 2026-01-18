// src/components/ProfileDropdown.tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { User, HelpCircle, Info, LogOut, ChevronDown } from 'lucide-react';

interface ProfileDropdownProps {
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative' as const,
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    background: 'none',
    border: '1px solid #e5e7eb',
    borderRadius: '9999px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#f97316',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontWeight: '600',
  },
  avatarImage: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
  },
  dropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 0.5rem)',
    right: 0,
    minWidth: '200px',
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    zIndex: 100,
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#374151',
    transition: 'all 0.2s',
    textAlign: 'left' as const,
  },
  divider: {
    height: '1px',
    backgroundColor: '#e5e7eb',
    margin: '0.25rem 0',
  },
};

export default function ProfileDropdown({ user }: ProfileDropdownProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fullName = user?.user_metadata?.full_name || 'User';
  const email = user?.email || '';

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const menuItems = [
    { icon: User, label: 'Account Settings', onClick: () => navigate('/account') },
    { icon: HelpCircle, label: 'Help & Support', onClick: () => navigate('/help') },
    { icon: Info, label: 'About', onClick: () => navigate('/about') },
  ];

  return (
    <div style={styles.container} ref={dropdownRef}>
      <button
        style={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f97316'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
      >
        <div style={styles.avatar}>
          <User size={20} />
        </div>
        <ChevronDown
          size={16}
          color="#6b7280"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          {/* User info */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.875rem' }}>
              {fullName}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{email}</div>
          </div>

          {/* Menu items */}
          {menuItems.map((item) => (
            <button
              key={item.label}
              style={styles.dropdownItem}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <item.icon size={18} color="#6b7280" />
              {item.label}
            </button>
          ))}

          <div style={styles.divider} />

          {/* Sign out */}
          <button
            style={{ ...styles.dropdownItem, color: '#dc2626' }}
            onClick={handleSignOut}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
