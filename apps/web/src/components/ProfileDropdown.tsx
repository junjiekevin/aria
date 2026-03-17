// src/components/ProfileDropdown.tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { User, HelpCircle, Info, LogOut, ChevronDown } from 'lucide-react';
import s from './ProfileDropdown.module.css';

interface ProfileDropdownProps {
  user: {
    email?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}


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
    <div className={s.container} ref={dropdownRef}>
      <button
        className={s.trigger}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f97316'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
      >
        <div className={s.avatar}>
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
        <div className={s.dropdown}>
          {/* User info */}
          <div className={s.userInfo}>
            <div className={s.userName}>
              {fullName}
            </div>
            <div className={s.userEmail}>{email}</div>
          </div>

          {/* Menu items */}
          {menuItems.map((item) => (
            <button
              key={item.label}
              className={s.dropdownItem}
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

          <div className={s.divider} />

          {/* Sign out */}
          <button
            className={`${s.dropdownItem} ${s.dropdownItemSignOut}`}
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
