import React, { useState } from 'react';
import { Wrench, KeyRound, Phone, Lock, CheckCircle, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';

type Step = 'request' | 'verify' | 'success';

export function PasswordReset() {
  const [step, setStep] = useState<Step>('request');
  const [staffId, setStaffId] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [resetToken, setResetToken] = useState('');

  // Step 1 — staff enters their staff ID, system looks up their phone and sends OTP
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim()) { setError('Please enter your Staff ID'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); return; }
      setMaskedPhone(data.maskedPhone);
      setStep('verify');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — staff enters OTP + new password
  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) { setError('Please enter the OTP'); return; }
    if (otp.length !== 6) { setError('OTP must be 6 digits'); return; }
    if (!newPassword) { setError('Please enter a new password'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId.trim(), otp: otp.trim(), new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to reset password'); return; }
      setStep('success');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary/10 mb-4">
            <Wrench size={28} className="text-brand-primary" />
          </div>
          <h1 className="text-2xl font-bold text-brand-text">Reset Password</h1>
          <p className="text-brand-muted text-sm mt-1">
            {step === 'request' && 'Enter your Staff ID to receive a one-time code'}
            {step === 'verify' && `Enter the 6-digit code sent to ${maskedPhone}`}
            {step === 'success' && 'Your password has been reset successfully'}
          </p>
        </div>

        {/* Step indicators */}
        {step !== 'success' && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[
              { key: 'request', label: 'Verify ID' },
              { key: 'verify', label: 'New Password' },
            ].map((s, i) => (
              <React.Fragment key={s.key}>
                <div className={`flex items-center gap-1.5 text-xs font-medium
                  ${step === s.key ? 'text-brand-primary' : 'text-brand-muted'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${step === s.key ? 'bg-brand-primary text-white' : 'bg-brand-surface text-brand-muted'}`}>
                    {i + 1}
                  </div>
                  {s.label}
                </div>
                {i < 1 && <div className="w-8 h-px bg-brand-border" />}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 shadow-sm">

          {/* ── Step 1: Request OTP ── */}
          {step === 'request' && (
            <form onSubmit={handleRequestOTP} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">Staff ID</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                  <input
                    type="text"
                    value={staffId}
                    onChange={e => { setStaffId(e.target.value); setError(''); }}
                    placeholder="e.g. SA-001"
                    className="w-full pl-9 pr-4 py-2.5 border border-brand-border rounded-lg bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-sm"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-brand-muted mt-1.5">
                  Your Staff ID is on your welcome email or ask your Super Admin.
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-primary text-white rounded-lg font-medium text-sm hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
                {loading ? 'Sending OTP...' : 'Send OTP to my phone'}
              </button>

              <a
                href="/"
                className="flex items-center justify-center gap-1.5 text-sm text-brand-muted hover:text-brand-text transition-colors"
              >
                <ArrowLeft size={14} /> Back to login
              </a>
            </form>
          )}

          {/* ── Step 2: Verify OTP + Set New Password ── */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyAndReset} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-brand-border rounded-lg bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-2xl font-mono tracking-widest text-center"
                  autoFocus
                />
                <p className="text-xs text-brand-muted mt-1.5 text-center">
                  Code sent to {maskedPhone} · valid for 10 minutes
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="Min. 6 characters"
                    className="w-full pl-9 pr-10 py-2.5 border border-brand-border rounded-lg bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-text mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="Repeat new password"
                    className="w-full pl-9 pr-10 py-2.5 border border-brand-border rounded-lg bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-sm"
                  />
                  <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-primary text-white rounded-lg font-medium text-sm hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('request'); setOtp(''); setError(''); }}
                className="flex items-center justify-center gap-1.5 w-full text-sm text-brand-muted hover:text-brand-text transition-colors"
              >
                <ArrowLeft size={14} /> Back
              </button>
            </form>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'success' && (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-brand-text text-lg">Password Reset!</h3>
                <p className="text-brand-muted text-sm mt-1">
                  Your password has been updated. You can now log in with your new password.
                </p>
              </div>
              <a
                href="/"
                className="block w-full py-2.5 bg-brand-primary text-white rounded-lg font-medium text-sm hover:bg-brand-primary/90 transition-colors text-center"
              >
                Go to Login
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}