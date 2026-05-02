import React from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';

export function Header() {
  const { user } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <header className="h-20 bg-brand-surface border-b border-brand-border flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search students, transactions, inventory..." 
          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
        />
      </div>

      <div className="flex items-center gap-6">
        <NotificationBell />
        
        <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-brand-text">{user?.name || 'User'}</p>
            <p className="text-xs text-brand-text-muted capitalize">{user?.role?.replace('_', ' ') || 'Staff'}</p>
          </div>
          <div className="w-10 h-10 bg-brand-primary/20 rounded-full flex items-center justify-center text-brand-navy font-medium">
            {user?.name ? getInitials(user.name) : 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
