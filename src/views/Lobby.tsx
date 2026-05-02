import React from 'react';
import { Clock, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Lobby() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 border border-brand-border">
        <div className="w-20 h-20 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-8">
          <Clock className="text-brand-primary" size={40} />
        </div>
        
        <h1 className="text-2xl font-bold text-brand-navy mb-4">Account Pending Approval</h1>
        
        <p className="text-brand-text-muted mb-8 leading-relaxed">
          Welcome, <span className="font-semibold text-brand-text">{user?.name}</span>! 
          Your account has been created successfully. Please wait while a Super Admin reviews your registration and assigns the necessary permissions.
        </p>

        <div className="bg-brand-bg rounded-2xl p-6 mb-8 border border-brand-border text-left">
          <div className="flex items-start gap-3">
            <ShieldCheck className="text-brand-primary shrink-0 mt-1" size={18} />
            <div>
              <p className="text-sm font-medium text-brand-text">What happens next?</p>
              <p className="text-xs text-brand-text-muted mt-1">
                Once approved, you'll gain access to the cafeteria management tools assigned to your role. You'll be notified via email or can simply refresh this page.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-brand-navy font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-primary/20"
          >
            Check Status
          </button>
          
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-brand-text-muted hover:text-red-600 font-medium py-2 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
      
      <p className="mt-8 text-xs text-brand-text-muted">
        Lincoln High School Cafeteria Hub • Secure Access Control
      </p>
    </div>
  );
}
