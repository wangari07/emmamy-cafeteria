import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, Send, Clock, CheckCircle, XCircle,
  RefreshCw, User, Phone, AlertTriangle, Utensils,
  Search, Filter, Eye, Trash2, Edit2, X, ChevronDown
} from 'lucide-react';

interface SMSDraft {
  id: number;
  student_id: string;
  student_name: string;
  student_class: string;
  parent_name: string;
  parent_phone: string;
  type: 'low_balance' | 'empty_balance' | 'meal_confirmation' | 'meal_served' | 'topup_confirmation' | 'otp';
  message: string;
  status: 'draft' | 'sent' | 'failed';
  created_at: string;
  sent_at?: string;
  balance?: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  low_balance: { label: 'Low Balance', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: <AlertTriangle size={12} /> },
  empty_balance: { label: 'Empty Balance', color: 'text-red-600 bg-red-50 border-red-200', icon: <AlertTriangle size={12} /> },
  meal_confirmation: { label: 'Meal History', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: <Utensils size={12} /> },
  meal_served: { label: 'Meal Served', color: 'text-green-600 bg-green-50 border-green-200', icon: <CheckCircle size={12} /> },
  topup_confirmation: { label: 'Top-up Confirm', color: 'text-purple-600 bg-purple-50 border-purple-200', icon: <CheckCircle size={12} /> },
  otp: { label: 'OTP', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: <MessageSquare size={12} /> },
};

export function SMSCenter() {
  const [drafts, setDrafts] = useState<SMSDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedDraft, setSelectedDraft] = useState<SMSDraft | null>(null);
  const [editingMessage, setEditingMessage] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [draftingFor, setDraftingFor] = useState<string | null>(null);

  // Manual draft modal
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [draftType, setDraftType] = useState<'low_balance' | 'meal_confirmation'>('low_balance');
  const [studentSearch, setStudentSearch] = useState('');

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sms/drafts', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDrafts(data);
      }
    } catch {
      showToast('Failed to load messages', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students', { credentials: 'include' });
      if (res.ok) setStudents(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleSend = async (draft: SMSDraft) => {
    setSending(draft.id);
    try {
      const body = editingMessage && selectedDraft?.id === draft.id
        ? editingMessage
        : draft.message;

      const res = await fetch(`/api/sms/send/${draft.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: body }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Message sent to ${draft.parent_name}`, 'success');
        setSelectedDraft(null);
        fetchDrafts();
      } else {
        showToast(data.error || 'Failed to send', 'error');
      }
    } catch {
      showToast('Failed to send message', 'error');
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/sms/drafts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== id));
        if (selectedDraft?.id === id) setSelectedDraft(null);
        showToast('Draft deleted', 'success');
      }
    } catch {
      showToast('Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleManualDraft = async () => {
    if (!selectedStudent) return;
    setDraftingFor(selectedStudent.id);
    try {
      const res = await fetch('/api/sms/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ student_id: selectedStudent.id, type: draftType }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Draft created successfully', 'success');
        setShowDraftModal(false);
        setSelectedStudent(null);
        setStudentSearch('');
        fetchDrafts();
      } else {
        showToast(data.error || 'Failed to create draft', 'error');
      }
    } catch {
      showToast('Failed to create draft', 'error');
    } finally {
      setDraftingFor(null);
    }
  };

  const filtered = drafts.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false;
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.student_name?.toLowerCase().includes(q) ||
        d.parent_name?.toLowerCase().includes(q) ||
        d.student_class?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const draftCount = drafts.filter(d => d.status === 'draft').length;
  const sentCount = drafts.filter(d => d.status === 'sent').length;
  const failedCount = drafts.filter(d => d.status === 'failed').length;

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.id.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition-all
          ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">SMS Center</h1>
          <p className="text-sm text-brand-muted mt-0.5">Manage parent notifications and message drafts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDrafts}
            className="p-2 border border-brand-border rounded-lg hover:bg-brand-surface transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className="text-brand-muted" />
          </button>
          <button
            onClick={() => { setShowDraftModal(true); fetchStudents(); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors text-sm font-medium"
          >
            <Edit2 size={14} />
            Draft Message
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Drafts', value: draftCount, color: 'text-amber-600', bg: 'bg-amber-50', icon: <Clock size={18} className="text-amber-600" /> },
          { label: 'Sent', value: sentCount, color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle size={18} className="text-green-600" /> },
          { label: 'Failed', value: failedCount, color: 'text-red-600', bg: 'bg-red-50', icon: <XCircle size={18} className="text-red-600" /> },
        ].map(stat => (
          <div key={stat.label} className="bg-brand-card border border-brand-border rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
            <div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-brand-muted">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Left — Message List */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
              <input
                type="text"
                placeholder="Search by student or parent..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-brand-border rounded-lg bg-brand-card focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div className="flex rounded-lg border border-brand-border overflow-hidden bg-brand-card">
              {(['all', 'draft', 'sent', 'failed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 text-xs font-medium transition-colors capitalize
                    ${filter === f ? 'bg-brand-primary text-white' : 'text-brand-muted hover:bg-brand-surface'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-brand-border rounded-lg bg-brand-card focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="low_balance">Low Balance</option>
              <option value="empty_balance">Empty Balance</option>
              <option value="meal_confirmation">Meal History</option>
              <option value="meal_served">Meal Served</option>
            </select>
          </div>

          {/* List */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-brand-muted">
                <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-brand-muted">
                <MessageSquare size={40} className="mb-3 opacity-30" />
                <p className="font-medium">No messages found</p>
                <p className="text-sm mt-1">Drafts are auto-created when a student's balance is low</p>
              </div>
            ) : (
              filtered.map(draft => {
                const typeInfo = TYPE_LABELS[draft.type] || TYPE_LABELS['low_balance'];
                const isSelected = selectedDraft?.id === draft.id;
                return (
                  <div
                    key={draft.id}
                    onClick={() => {
                      setSelectedDraft(isSelected ? null : draft);
                      setEditingMessage(draft.message);
                    }}
                    className={`bg-brand-card border rounded-xl p-4 cursor-pointer transition-all
                      ${isSelected ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-brand-border hover:border-brand-primary/30'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                          <User size={14} className="text-brand-muted" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-brand-text">{draft.student_name}</span>
                            <span className="text-xs text-brand-muted">{draft.student_class}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${typeInfo.color}`}>
                              {typeInfo.icon} {typeInfo.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Phone size={10} className="text-brand-muted" />
                            <span className="text-xs text-brand-muted">{draft.parent_phone} · {draft.parent_name}</span>
                          </div>
                          <p className="text-xs text-brand-muted mt-1.5 line-clamp-2">{draft.message}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                          ${draft.status === 'sent' ? 'bg-green-100 text-green-700' :
                            draft.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'}`}>
                          {draft.status}
                        </span>
                        <span className="text-xs text-brand-muted">
                          {new Date(draft.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right — Detail / Edit Panel */}
        {selectedDraft && (
          <div className="w-80 shrink-0">
            <div className="bg-brand-card border border-brand-border rounded-xl p-5 sticky top-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-brand-text text-sm">Message Details</h3>
                <button onClick={() => setSelectedDraft(null)} className="text-brand-muted hover:text-brand-text">
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-brand-muted">Student</span>
                  <span className="font-medium text-brand-text">{selectedDraft.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Class</span>
                  <span className="font-medium text-brand-text">{selectedDraft.student_class}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Parent</span>
                  <span className="font-medium text-brand-text">{selectedDraft.parent_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-muted">Phone</span>
                  <span className="font-medium text-brand-text">{selectedDraft.parent_phone}</span>
                </div>
                {selectedDraft.balance !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-brand-muted">Balance</span>
                    <span className="font-medium text-red-600">KES {Number(selectedDraft.balance).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-brand-muted block mb-1.5">Message (editable)</label>
                <textarea
                  value={editingMessage}
                  onChange={e => setEditingMessage(e.target.value)}
                  rows={6}
                  className="w-full text-xs border border-brand-border rounded-lg p-3 bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-none"
                />
                <p className="text-xs text-brand-muted mt-1">{editingMessage.length} characters</p>
              </div>

              <div className="flex gap-2">
                {selectedDraft.status !== 'sent' && (
                  <button
                    onClick={() => handleSend(selectedDraft)}
                    disabled={sending === selectedDraft.id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {sending === selectedDraft.id ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {sending === selectedDraft.id ? 'Sending...' : 'Send SMS'}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedDraft.id)}
                  disabled={deleting === selectedDraft.id}
                  className="p-2.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {deleting === selectedDraft.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual Draft Modal */}
      {showDraftModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-brand-card rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-text">Draft New Message</h2>
              <button onClick={() => { setShowDraftModal(false); setSelectedStudent(null); setStudentSearch(''); }}>
                <X size={18} className="text-brand-muted" />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-brand-text block mb-1.5">Message Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'low_balance', label: 'Low Balance Alert', icon: <AlertTriangle size={14} /> },
                  { value: 'meal_confirmation', label: 'Meal History', icon: <Utensils size={14} /> },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDraftType(opt.value as any)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors
                      ${draftType === opt.value
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                        : 'border-brand-border text-brand-muted hover:border-brand-primary/40'}`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-brand-text block mb-1.5">Select Student</label>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Search student..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-brand-border rounded-lg focus:outline-none"
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 border border-brand-border rounded-lg p-1">
                {filteredStudents.length === 0 ? (
                  <p className="text-xs text-brand-muted text-center py-3">No students found</p>
                ) : filteredStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors
                      ${selectedStudent?.id === s.id
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'hover:bg-brand-surface text-brand-text'}`}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-brand-muted text-xs ml-2">{s.class}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedStudent && (
              <div className="bg-brand-surface rounded-lg p-3 text-xs space-y-1">
                <p><span className="text-brand-muted">Parent:</span> <span className="font-medium">{selectedStudent.parent_name}</span></p>
                <p><span className="text-brand-muted">Phone:</span> <span className="font-medium">{selectedStudent.parent_phone}</span></p>
              </div>
            )}

            <button
              onClick={handleManualDraft}
              disabled={!selectedStudent || !!draftingFor}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
            >
              {draftingFor ? <RefreshCw size={14} className="animate-spin" /> : <Edit2 size={14} />}
              {draftingFor ? 'Drafting...' : 'Create Draft'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}