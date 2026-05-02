import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  User,
  CreditCard,
  Phone,
  Utensils,
  Clock,
  TrendingUp,
  AlertCircle,
  Loader2,
  MessageSquare,
  Send,
  X,
  Wallet,
  ShieldAlert,
} from 'lucide-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';

interface StudentProfileProps {
  studentId: string;
  onBack: () => void;
}

type MessageType = 'low_balance' | 'meal_confirmation' | 'debt_alert';

const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  low_balance: 'Low Balance Alert',
  meal_confirmation: 'Meal Summary',
  debt_alert: 'Debt Alert',
};

export function StudentProfile({ studentId, onBack }: StudentProfileProps) {
  const { user } = useAuth();

  const student = useQuery(api.students.getProfileByAdmNo, {
    admNo: studentId,
  });

  const [activeTab, setActiveTab] = useState<'meals' | 'transactions'>('meals');
  const [messageModal, setMessageModal] = useState<'sms' | 'whatsapp' | null>(null);
  const [messageType, setMessageType] = useState<MessageType>('low_balance');
  const [messageText, setMessageText] = useState('');
  const [draftLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);

  const loading = student === undefined;
  const error = student === null ? 'Student not found' : '';

  const currentPoints = student?.current_points ?? 0;
  const debtBalance = student?.debt_balance ?? 0;
  const debtLimit = student?.debt_limit ?? 200;
  const lowBalanceThreshold = student?.low_balance_threshold ?? 100;

  const getDefaultMessageType = (): MessageType => {
    if (!student) return 'meal_confirmation';
    if (debtBalance > 0) return 'debt_alert';
    if (currentPoints <= lowBalanceThreshold) return 'low_balance';
    return 'meal_confirmation';
  };

  const buildMessage = (type: MessageType) => {
    if (!student) return '';

    if (type === 'low_balance') {
      return `Hello ${student.parent_name || 'Parent'}, this is ${import.meta.env.VITE_SCHOOL_NAME || 'the school'}.\n\nYour child ${student.name} (${student.id}) currently has a low meal wallet balance of ${currentPoints} points.\nLow balance threshold: ${lowBalanceThreshold} points.\n\nPlease top up at your earliest convenience.\n\nThank you.`;
    }

    if (type === 'debt_alert') {
      return `Hello ${student.parent_name || 'Parent'}, this is ${import.meta.env.VITE_SCHOOL_NAME || 'the school'}.\n\nYour child ${student.name} (${student.id}) is currently using meal debt.\nCurrent debt balance: ${debtBalance} points.\nDebt limit: ${debtLimit} points.\n\nPlease top up the wallet to clear the debt and avoid meal interruption.\n\nThank you.`;
    }

    return `Hello ${student.parent_name || 'Parent'}, this is ${import.meta.env.VITE_SCHOOL_NAME || 'the school'}.\n\nHere is the current meal wallet summary for ${student.name} (${student.id}).\nCurrent points: ${currentPoints}\nDebt balance: ${debtBalance}\nMeal package: ${student.mealPackage || 'No package'}\nMeal registration: ${student.hasMealRegistration ? 'Yes' : 'No'}\n\nThank you.`;
  };

  const openModal = (channel: 'sms' | 'whatsapp') => {
    const defaultType = getDefaultMessageType();
    setMessageType(defaultType);
    setMessageText(buildMessage(defaultType));
    setSendError('');
    setSendSuccess(false);
    setMessageModal(channel);
  };

  const handleTypeChange = (type: MessageType) => {
    setMessageType(type);
    setMessageText(buildMessage(type));
    setSendError('');
  };

  const handleSendMessage = async () => {
    if (!student || !messageModal || !messageText.trim()) return;

    setIsSending(true);
    setSendError('');
    setSendSuccess(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      setSendSuccess(true);
    } catch (err: any) {
      setSendError(err.message || 'An error occurred');
    } finally {
      setIsSending(false);
    }
  };

  const mealsServed = student?.meals_served ?? [];
  const transactions = student?.transactions ?? [];

  const totalMeals = mealsServed.length;
  const totalSpent = transactions
    .filter((t: any) => t.type === 'Purchase' || t.amount < 0)
    .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);

  const totalTopUp = transactions
    .filter((t: any) => t.type === 'Top-up' || t.amount > 0)
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const mealBadges = useMemo(() => {
    if (!student) return [];
    return [
      student.meals?.lunch ? 'Lunch' : null,
      student.meals?.fruit ? 'Fruit' : null,
      student.meals?.tea ? 'Tea' : null,
      student.meals?.snacks ? 'Snacks' : null,
    ].filter(Boolean) as string[];
  }, [student]);

  const balanceTone =
    debtBalance > 0
      ? 'text-red-600'
      : currentPoints <= lowBalanceThreshold
      ? 'text-amber-600'
      : 'text-emerald-600';

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-[calc(100vh-80px)]">
        <Loader2 className="animate-spin text-brand-primary" size={40} />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[calc(100vh-80px)] gap-4">
        <AlertCircle className="text-red-500" size={40} />
        <p className="text-brand-text font-medium">{error || 'Student not found'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-brand-navy"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Student Profile</h1>
          <p className="text-brand-text-muted mt-0.5 text-sm">
            View student details, wallet status, and meal history
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-navy font-bold text-2xl shrink-0">
            {student.name.split(' ').map((n: string) => n[0]).join('')}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-brand-text">{student.name}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-sm text-brand-text-muted">{student.id}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span className="text-sm text-brand-text-muted">{student.class}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span className="text-sm text-brand-text-muted">{student.school}</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  student.status === 'Active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}
              >
                {student.status}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-2xl font-bold ${balanceTone}`}>
              {currentPoints.toLocaleString()} pts
            </span>
            <span className="text-xs text-brand-text-muted">Wallet Balance</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-brand-primary/10 flex items-center justify-center">
            <Wallet size={20} className="text-brand-navy" />
          </div>
          <div>
            <p className="text-xs text-brand-text-muted font-medium">Current Points</p>
            <p className={`text-2xl font-bold mt-0.5 ${balanceTone}`}>
              {currentPoints.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
            <ShieldAlert size={20} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-brand-text-muted font-medium">Debt Balance</p>
            <p className="text-2xl font-bold text-brand-text mt-0.5">
              {debtBalance.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
            <AlertCircle size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-brand-text-muted font-medium">Low Balance Alert</p>
            <p className="text-2xl font-bold text-brand-text mt-0.5">
              {lowBalanceThreshold.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CreditCard size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-brand-text-muted font-medium">Debt Limit</p>
            <p className="text-2xl font-bold text-brand-text mt-0.5">
              {debtLimit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-brand-primary/10 flex items-center justify-center">
            <Utensils size={20} className="text-brand-navy" />
          </div>
          <div>
            <p className="text-xs text-brand-text-muted font-medium">Total Meals Eaten</p>
            <p className="text-2xl font-bold text-brand-text mt-0.5">{totalMeals}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
            <TrendingUp size={20} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-brand-text-muted font-medium">Total Spent</p>
            <p className="text-2xl font-bold text-brand-text mt-0.5">
              Ksh {totalSpent.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CreditCard size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-brand-text-muted font-medium">Total Topped Up</p>
            <p className="text-2xl font-bold text-brand-text mt-0.5">
              Ksh {totalTopUp.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-brand-text mb-4 flex items-center gap-2">
              <User size={16} className="text-brand-primary" />
              Student Information
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Admission No.</p>
                <p className="text-sm font-medium text-brand-text">{student.id}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Class</p>
                <p className="text-sm font-medium text-brand-text">{student.class}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">School</p>
                <p className="text-sm font-medium text-brand-text">{student.school}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Meal Package</p>
                <p className="text-sm font-medium text-brand-text">{student.mealPackage || '—'}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Wallet Balance</p>
                <p className={`text-sm font-semibold ${balanceTone}`}>
                  {currentPoints.toLocaleString()} pts
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Debt Balance</p>
                <p className={`text-sm font-semibold ${debtBalance > 0 ? 'text-red-600' : 'text-brand-text'}`}>
                  {debtBalance.toLocaleString()} pts
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Debt Limit</p>
                <p className="text-sm font-medium text-brand-text">{debtLimit.toLocaleString()} pts</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Low Balance Threshold</p>
                <p className="text-sm font-medium text-brand-text">
                  {lowBalanceThreshold.toLocaleString()} pts
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Registered Meals</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {mealBadges.length > 0 ? (
                    mealBadges.map((meal) => (
                      <span
                        key={meal}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-100"
                      >
                        {meal}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-brand-text-muted">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-brand-text mb-4 flex items-center gap-2">
              <Phone size={16} className="text-brand-navy" />
              Parent / Guardian
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Name</p>
                <p className="text-sm font-medium text-brand-text">{student.parent_name || '—'}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                <p className="text-sm font-medium text-brand-text">{student.parent_phone || '—'}</p>
              </div>
            </div>

            {user?.role !== 'staff' && student.parent_phone && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => openModal('sms')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-medium hover:bg-gray-50 transition-colors"
                >
                  <MessageSquare size={14} className="text-blue-500" />
                  SMS
                </button>

                <button
                  onClick={() => openModal('whatsapp')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#25D366]/10 text-[#128C7E] border border-[#25D366]/20 rounded-xl text-xs font-medium hover:bg-[#25D366]/20 transition-colors"
                >
                  <Phone size={14} />
                  WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('meals')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'meals'
                  ? 'text-brand-navy border-b-2 border-brand-primary bg-brand-primary/5'
                  : 'text-brand-text-muted hover:text-brand-text hover:bg-gray-50'
              }`}
            >
              <Utensils size={15} />
              Meal History
              <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                {mealsServed.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'transactions'
                  ? 'text-brand-navy border-b-2 border-brand-primary bg-brand-primary/5'
                  : 'text-brand-text-muted hover:text-brand-text hover:bg-gray-50'
              }`}
            >
              <CreditCard size={15} />
              Transactions
              <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                {transactions.length}
              </span>
            </button>
          </div>

          {activeTab === 'meals' && (
            <div className="divide-y divide-gray-50">
              {mealsServed.length === 0 ? (
                <div className="p-12 text-center">
                  <Utensils className="mx-auto text-gray-300 mb-3" size={32} />
                  <p className="text-brand-text-muted text-sm">No meals recorded yet</p>
                </div>
              ) : (
                mealsServed.map((meal: any) => (
                  <div
                    key={meal.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                        <Utensils size={16} className="text-brand-navy" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-brand-text">{meal.meal_type}</p>
                        <p className="text-xs text-brand-text-muted flex items-center gap-1 mt-0.5">
                          <Clock size={11} />
                          {new Date(meal.served_at).toLocaleString('en-KE', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Served
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="divide-y divide-gray-50">
              {transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <CreditCard className="mx-auto text-gray-300 mb-3" size={32} />
                  <p className="text-brand-text-muted text-sm">No transactions recorded yet</p>
                </div>
              ) : (
                transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          tx.amount > 0 ? 'bg-emerald-50' : 'bg-red-50'
                        }`}
                      >
                        <CreditCard
                          size={16}
                          className={tx.amount > 0 ? 'text-emerald-600' : 'text-red-500'}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-brand-text">{tx.item || tx.type}</p>
                        <p className="text-xs text-brand-text-muted flex items-center gap-1 mt-0.5">
                          <Clock size={11} />
                          {new Date(tx.created_at).toLocaleString('en-KE', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.amount > 0 ? '+' : ''}Ksh {tx.amount.toLocaleString()}
                      </p>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          tx.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {tx.status || tx.type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {messageModal && student && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">
                {messageModal === 'whatsapp' ? (
                  <>
                    <Phone size={20} className="text-[#25D366]" /> Send WhatsApp
                  </>
                ) : (
                  <>
                    <MessageSquare size={20} className="text-blue-500" /> Send SMS
                  </>
                )}
              </h3>

              <button
                onClick={() => {
                  setMessageModal(null);
                  setMessageText('');
                  setSendError('');
                  setSendSuccess(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Sending to</p>
              <p className="text-sm font-semibold text-brand-text">{student.parent_name}</p>
              <p className="text-xs text-gray-500">{student.parent_phone}</p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Message Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(MESSAGE_TYPE_LABELS) as [MessageType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleTypeChange(key)}
                    disabled={draftLoading}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors ${
                      messageType === key
                        ? 'bg-brand-primary/10 border-brand-primary text-brand-navy'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    } disabled:opacity-50`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-gray-500">Message (editable)</label>

              {draftLoading ? (
                <div className="h-36 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 size={16} className="animate-spin" />
                    Building message...
                  </div>
                </div>
              ) : (
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Message will appear here..."
                  rows={7}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none text-sm leading-relaxed"
                />
              )}

              {!draftLoading && messageText && (
                <p className="text-[11px] text-gray-400 text-right">
                  {messageText.length} chars · ~{Math.ceil(messageText.length / 160)} SMS segment
                  {Math.ceil(messageText.length / 160) !== 1 ? 's' : ''}
                </p>
              )}

              {sendError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                  {sendError}
                </div>
              )}

              {sendSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-xl border border-emerald-100">
                  ✅ Message prepared. Wire your SMS/WhatsApp backend next.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => {
                    setMessageModal(null);
                    setMessageText('');
                    setSendError('');
                  }}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
                  disabled={isSending}
                >
                  Cancel
                </button>

                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || isSending || sendSuccess || draftLoading}
                  className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}