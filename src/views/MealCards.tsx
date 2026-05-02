import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  CheckCircle2, 
  XCircle,
  RefreshCw
} from 'lucide-react';
import { IssueCardModal } from '../components/IssueCardModal';

interface MealCardsProps {
  onViewCard?: (id: string) => void;
}

export function MealCards({ onViewCard }: MealCardsProps = {}) {
  const [isIssueCardModalOpen, setIsIssueCardModalOpen] = useState(false);
  const [cardsData, setCardsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showBatchTopup, setShowBatchTopup] = useState(false);
  const [batchAmount, setBatchAmount] = useState('');
  const [batchTarget, setBatchTarget] = useState('All');

  const fetchCards = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'All') params.append('status', statusFilter);

      const response = await fetch(`/api/cards?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch cards');
      const data = await response.json();
      setCardsData(data);
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/cards/batch-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseInt(batchAmount),
          target: batchTarget
        }),
      });
      if (!response.ok) throw new Error('Failed to perform batch top-up');
      setShowBatchTopup(false);
      fetchCards();
    } catch (error) {
      console.error('Error batch top-up:', error);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [searchTerm, statusFilter]);

  const activeCount = cardsData.filter(c => c.status === 'Active').length;
  const suspendedCount = cardsData.filter(c => c.status === 'Suspended' || c.status === 'Blocked').length;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Meal Cards</h1>
          <p className="text-brand-text-muted mt-1">Manage student meal cards, balances, and auto-reload settings</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowBatchTopup(true)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Batch Top-up
          </button>
          <button 
            onClick={() => setIsIssueCardModalOpen(true)}
            className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Issue New Card
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-text-muted">Active Cards</p>
            <p className="text-2xl font-bold text-brand-text">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <RefreshCw size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-text-muted">Low Balance</p>
            <p className="text-2xl font-bold text-brand-text">{cardsData.filter(c => c.balance < 500).length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-brand-text-muted">Suspended Cards</p>
            <p className="text-2xl font-bold text-brand-text">{suspendedCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/30">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by card ID or student name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm shadow-sm"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-brand-text hover:bg-gray-50 transition-colors shadow-sm">
              <Filter size={16} />
              Status
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Card Details</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Balance</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Auto-Reload</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cardsData.map((card) => (
                <tr key={card.id} className="hover:bg-gray-50/50 transition-colors group bg-white">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <button 
                          onClick={() => onViewCard?.(card.id)}
                          className="text-sm font-medium text-brand-navy hover:underline text-left"
                        >
                          {card.id}
                        </button>
                        <br />
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded mt-1 inline-block ${
                          card.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                          card.status === 'Low Balance' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {card.status}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-brand-text">{card.student_name || 'Unassigned'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-semibold ${
                      card.balance < 0 ? 'text-red-600' : 
                      card.balance < 500 ? 'text-amber-600' : 'text-brand-text'
                    }`}>
                      {Number(card.balance).toLocaleString()} Pts
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {card.auto_reload ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                        <RefreshCw size={12} /> Enabled
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Disabled</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-brand-text-muted">
                    {card.last_used ? new Date(card.last_used).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-gray-400 hover:text-brand-navy hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <IssueCardModal 
        isOpen={isIssueCardModalOpen} 
        onClose={() => {
          setIsIssueCardModalOpen(false);
          fetchCards();
        }} 
      />

      {/* Batch Top-up Modal */}
      {showBatchTopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Batch Top-up Cards</h2>
            <form onSubmit={handleBatchTopup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Top-up Amount (Points)</label>
                <input 
                  type="number" required
                  className="w-full px-4 py-2 border rounded-lg"
                  value={batchAmount}
                  onChange={e => setBatchAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Target Group</label>
                <select 
                  className="w-full px-4 py-2 border rounded-lg"
                  value={batchTarget}
                  onChange={e => setBatchTarget(e.target.value)}
                >
                  <option value="All">All Active Cards</option>
                  <option value="LowBalance">Low Balance Only (&lt; 500)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowBatchTopup(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-primary text-brand-navy rounded-lg font-bold">Perform Batch Top-up</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
