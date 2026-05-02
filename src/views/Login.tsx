import React, { useState } from 'react';
import { Utensils, EyeOff, Eye } from 'lucide-react';
import { useConvex, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth, type Permissions, type User } from '../context/AuthContext';
import { signIn, signUp } from '../lib/auth-client';

const emptyPermissions: Permissions = {
  viewMainStudents: false,
  viewDigitalStudents: false,
  viewParentContacts: false,
  markMealsServed: false,
  editMealRegistration: false,
  viewHistoricalData: false,
  generateReports: false,
  viewAllClasses: false,
  viewFullHistory: false,
};

function mapToContextUser(sessionUser: any, appUser: any): User {
  return {
    id: appUser?._id || sessionUser?.id || sessionUser?.email || '',
    name: appUser?.name || sessionUser?.name || '',
    staff_id: appUser?.staff_id || '',
    email: appUser?.email || sessionUser?.email || '',
    school: appUser?.school || 'main',
    role: appUser?.role || 'staff',
    status: appUser?.status || 'pending',
    permissions: appUser?.permissions || emptyPermissions,
    class_assigned: appUser?.class_assigned,
  };
}

export function Login() {
  const convex = useConvex();
  const createPendingUser = useMutation(api.appUsers.createPendingUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [requestedSchool, setRequestedSchool] = useState<'main' | 'digital' | 'both'>('main');

  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tempUserData, setTempUserData] = useState<any>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { login, refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    try {
      if (isSignUp) {
        if (!cleanName) {
          setError('Full name is required');
          return;
        }

        if (password.length < 8) {
          setError('Password must be at least 8 characters long');
          return;
        }

        const { data, error: signUpError } = await signUp.email({
          name: cleanName,
          email: cleanEmail,
          password,
        });

        if (signUpError) {
          setError(signUpError.message || 'Registration failed');
          return;
        }

        if (data?.user) {
          await createPendingUser({
            authUserId: String(data.user.id ?? ''),
            email: cleanEmail,
            name: cleanName,
            requestedSchool,
          });

          const appUser = await convex.query(api.appUsers.getUserProfileByEmail, {
            email: cleanEmail,
          });

          const mergedUser = mapToContextUser(data.user, appUser);
          login(mergedUser);
          return;
        }

        const { data: signInData, error: autoSignInError } = await signIn.email({
          email: cleanEmail,
          password,
          rememberMe: true,
        });

        if (autoSignInError) {
          setError(
            autoSignInError.message ||
              'Account created, but automatic sign-in failed. Please sign in manually.'
          );
          return;
        }

        if (signInData?.user) {
          await createPendingUser({
            authUserId: String(signInData.user.id ?? ''),
            email: cleanEmail,
            name: cleanName,
            requestedSchool,
          });

          const appUser = await convex.query(api.appUsers.getUserProfileByEmail, {
            email: cleanEmail,
          });

          const mergedUser = mapToContextUser(signInData.user, appUser);
          login(mergedUser);
          return;
        }

        setError('Account created, but sign-in could not be completed.');
      } else {
        if (!cleanEmail) {
          setError('Email is required');
          return;
        }

        if (!password) {
          setError('Password is required');
          return;
        }

        const { data, error: signInError } = await signIn.email({
          email: cleanEmail,
          password,
          rememberMe: true,
        });

        if (signInError) {
          setError(signInError.message || 'Invalid email or password');
          return;
        }

        if (data?.user) {
          const u = data.user as any;

          if (u.requires_password_change) {
            setTempUserData(u);
            return;
          }

          const appUser = await convex.query(api.appUsers.getUserProfileByEmail, {
            email: u.email.trim().toLowerCase(),
          });

          const mergedUser = mapToContextUser(u, appUser);
          login(mergedUser);
          return;
        }

        setError('Authentication failed');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err?.message || 'An error occurred during authentication');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch(`http://localhost:3000/api/users/${tempUserData.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: password, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        await refreshUser();
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch {
      setError('An error occurred while changing password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const requiresPasswordChange = !!tempUserData;

  return (
    <div className="bg-brand-bg text-slate-900 font-sans antialiased h-screen w-full overflow-hidden flex">
      <div className="hidden lg:flex lg:w-1/2 bg-brand-navy relative flex-col justify-between p-12 overflow-hidden">
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
            <Utensils className="text-brand-navy" size={24} />
          </div>
          <h2 className="text-white text-xl font-bold tracking-tight">Cafeteria Hub</h2>
        </div>

        <div className="relative z-0 flex-grow flex items-center justify-center">
          <div className="relative z-10 max-w-lg">
            <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative bg-indigo-950/50 border border-white/10 group">
              <img
                alt="Modern Cafeteria Illustration"
                className="w-full h-full object-cover opacity-80 mix-blend-overlay hover:scale-105 transition-transform duration-700"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmigIWQ4XoLzlkqRMP_OFjaryA539IPMzicKqwVOjSeux2QiwRcpi0imsVuAutKhr-h7ZHPB6fm8z69oxIQSuYD4871a9XVpSdKb28zC1K9rNcL-3q0oyczIep3nQnFRzqeepGGLHydkUY8rUF0u-n0gu0awvTN6NCAm0vtvfG2jN80w62rdbnxUqZLM0GNJarx2ISg-wzmdTomcVsbnuNLs4cRf57QSeY5QWSPhFPeQI1bFH_bbgAK8H6bvyFuHFJ5UJzHpfI1h6s"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-brand-navy/60"></div>
              <div className="absolute bottom-8 left-8 right-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/20 border border-brand-primary/30 mb-4">
                  <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
                  <span className="text-brand-primary text-xs font-bold uppercase tracking-wider">Kenyan Schools System</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-2 leading-tight">Nourishing the minds of tomorrow.</h3>
                <p className="text-indigo-200 text-sm leading-relaxed">Streamlined cafeteria management for efficient service and happy students.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-indigo-300 text-sm">
          © {new Date().getFullYear()} Cafeteria Hub Systems.
        </div>
      </div>

      <div className="w-full lg:w-1/2 bg-brand-bg flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-navy text-brand-primary rounded-lg flex items-center justify-center">
            <Utensils size={20} />
          </div>
          <span className="font-bold text-brand-navy">Cafeteria Hub</span>
        </div>

        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left space-y-2">
            <h1 className="text-[32px] font-bold text-brand-navy leading-tight">
              {requiresPasswordChange ? 'Update Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-slate-500 text-lg">
              {requiresPasswordChange
                ? 'Please change your temporary password to continue.'
                : isSignUp
                ? 'Join Cafeteria Hub to manage your school.'
                : 'Sign in to manage your school cafeteria.'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {!requiresPasswordChange ? (
            <form className="space-y-6 mt-8" onSubmit={handleSubmit}>
              <div className="space-y-5">
                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-brand-navy ml-1" htmlFor="name">Full Name</label>
                      <div className="relative">
                        <input
                          className="w-full pl-4 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/10 focus:border-brand-navy transition-all shadow-sm"
                          id="name"
                          name="name"
                          placeholder="John Doe"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-brand-navy ml-1" htmlFor="requestedSchool">
                        Requested Campus
                      </label>
                      <select
                        id="requestedSchool"
                        value={requestedSchool}
                        onChange={(e) => setRequestedSchool(e.target.value as 'main' | 'digital' | 'both')}
                        className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-navy/10 focus:border-brand-navy transition-all shadow-sm"
                      >
                        <option value="main">Main School</option>
                        <option value="digital">Digital School</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-brand-navy ml-1" htmlFor="email">Email Address</label>
                  <div className="relative">
                    <input
                      className="w-full pl-4 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/10 focus:border-brand-navy transition-all shadow-sm"
                      id="email"
                      name="email"
                      placeholder="admin@school.edu.ke"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="block text-sm font-semibold text-brand-navy" htmlFor="password">Password</label>
                    {!isSignUp && (
                      <a
                        className="text-sm font-semibold text-slate-500 hover:text-brand-navy transition-colors"
                        href="/reset-password"
                      >
                        Forgot Password?
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      className="w-full pl-4 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/10 focus:border-brand-navy transition-all shadow-sm"
                      id="password"
                      name="password"
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:text-brand-navy"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                  {isSignUp && (
                    <p className="text-xs text-slate-500 ml-1">Password must be at least 8 characters long.</p>
                  )}
                </div>
              </div>

              <button
                className="w-full bg-brand-primary hover:bg-brand-primary-hover text-brand-navy font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form className="space-y-6 mt-8" onSubmit={handlePasswordChange}>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-brand-navy ml-1" htmlFor="newPassword">New Password</label>
                  <div className="relative">
                    <input
                      className="w-full pl-4 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/10 focus:border-brand-navy transition-all shadow-sm"
                      id="newPassword"
                      name="newPassword"
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:text-brand-navy"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-brand-navy ml-1" htmlFor="confirmPassword">Confirm New Password</label>
                  <div className="relative">
                    <input
                      className="w-full pl-4 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/10 focus:border-brand-navy transition-all shadow-sm"
                      id="confirmPassword"
                      name="confirmPassword"
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                className="w-full bg-brand-primary hover:bg-brand-primary-hover text-brand-navy font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Updating...' : 'Update Password & Continue'}
              </button>
            </form>
          )}

          {!requiresPasswordChange && (
            <div className="pt-4 text-center">
              <p className="text-slate-500 font-medium">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                <button
                  className="text-brand-navy font-bold hover:underline decoration-brand-primary decoration-2 underline-offset-4 ml-1"
                  onClick={() => {
                    setError('');
                    setIsSignUp(!isSignUp);
                  }}
                >
                  {isSignUp ? 'Sign In' : 'Create Account'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}