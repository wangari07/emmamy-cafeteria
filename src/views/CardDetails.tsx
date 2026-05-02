import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, History, DollarSign, AlertCircle, Cpu, Wifi, Plus, Smartphone, X, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CardDetailsProps {
  cardId: string;
  onBack: () => void;
}

export function CardDetails({ cardId, onBack }: CardDetailsProps) {
  const { user } = useAuth();
  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchCardDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/cards/${cardId}`);
        if (res.ok) {
          const data = await res.json();
          setCardData(data);
        }
      } catch (error) {
        console.error('Failed to fetch card details', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCardDetails();
  }, [cardId]);

  const handleManualTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(topUpAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessing(true);
    try {
      const res = await fetch('/api/cards/batch-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          target: 'Specific',
          cardIds: [cardId]
        })
      });

      if (res.ok) {
        // Refresh data
        const refreshRes = await fetch(`/api/cards/${cardId}`);
        if (refreshRes.ok) {
          setCardData(await refreshRes.json());
        }
        setIsTopUpModalOpen(false);
        setTopUpAmount('');
      }
    } catch (error) {
      console.error('Top-up failed', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-brand-primary" size={32} />
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Card not found.</p>
        <button onClick={onBack} className="mt-4 text-brand-navy hover:underline">Go Back</button>
      </div>
    );
  }

  const transactions = cardData.transactions || [];
  const balance = cardData.balance || 0;

  const cardInfo = {
    id: cardId,
    student: cardData.student_name || 'Unknown Student',
    admNo: cardData.student_id || 'N/A',
    grade: cardData.student_class || 'N/A',
    status: cardData.status || 'Active',
    lastUsed: cardData.last_used ? new Date(cardData.last_used).toLocaleString() : 'Never',
  };

  const simulateParentPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const amount = 1000;
      setCardData((prev: any) => ({
        ...prev,
        balance: (prev?.balance || 0) + amount,
        transactions: [
          {
            id: `TXN-${Math.floor(Math.random() * 10000)}`,
            created_at: new Date().toISOString(),
            type: 'Auto-load',
            amount: amount,
            item: 'M-Pesa (Parent)',
            status: 'Completed'
          },
          ...(prev?.transactions || [])
        ]
      }));
      setIsProcessing(false);
    }, 800);
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hover:text-brand-navy"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-brand-text">Card Details</h1>
            <p className="text-brand-text-muted mt-1">View and manage information for card {cardId}</p>
          </div>
        </div>
        {user?.role !== 'teacher' && (
          <div className="flex gap-3">
            <button 
              onClick={simulateParentPayment}
              disabled={isProcessing}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Smartphone size={18} />
              Simulate Parent Pay
            </button>
            <button 
              onClick={() => setIsTopUpModalOpen(true)}
              className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Manual Top-up
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Card Info & Balance */}
        <div className="space-y-6">
          
          {/* Credit Card UI */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden aspect-[1.586/1] flex flex-col justify-between">
            <div className="relative flex justify-between items-start">
              <Cpu size={36} className="text-yellow-400/80" strokeWidth={1.5} />
              <Wifi size={28} className="text-white/40 rotate-90" />
            </div>
            
            <div className="relative">
              <p className="text-white/60 text-[10px] uppercase tracking-widest mb-1">Card Number</p>
              <p className="font-mono text-xl tracking-widest drop-shadow-md">{cardId.replace('-', ' ')} 0000 0000</p>
            </div>
            
            <div className="relative flex justify-between items-end">
              <div>
                <p className="text-white/60 text-[10px] uppercase tracking-widest mb-1">Cardholder</p>
                <p className="font-medium tracking-wide drop-shadow-md">{cardInfo.student}</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-[10px] uppercase tracking-widest mb-1">Balance</p>
                <p className="font-bold text-xl drop-shadow-md">{balance.toLocaleString()} Pts</p>
              </div>
            </div>
          </div>

          {/* Student Info */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-brand-text">Student Information</h2>
              <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                cardInfo.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                cardInfo.status === 'Low Balance' ? 'bg-amber-50 text-amber-700' :
                'bg-red-50 text-red-700'
              }`}>
                {cardInfo.status}
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium text-brand-text">{cardInfo.student}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Admission Number</p>
                <p className="font-medium text-brand-text">{cardInfo.admNo}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Grade/Class</p>
                <p className="font-medium text-brand-text">{cardInfo.grade}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Used</p>
                <p className="font-medium text-brand-text">{cardInfo.lastUsed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Transactions */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-text flex items-center gap-2">
                <History size={20} className="text-brand-navy" />
                Transaction History
              </h2>
              <button className="text-sm font-medium text-brand-navy hover:underline">
                Download Statement
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm text-brand-text">{new Date(txn.created_at).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{txn.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                          txn.type.includes('Top-up') || txn.type.includes('Auto-load') ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {txn.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{txn.item || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right">
                        <span className={txn.amount > 0 ? 'text-emerald-600' : 'text-brand-text'}>
                          {txn.amount > 0 ? '+' : ''}{txn.amount.toLocaleString()} Pts
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Top-up Modal */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-text">Manual Top-up</h3>
              <button 
                onClick={() => setIsTopUpModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleManualTopUp}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Ksh)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">Ksh</span>
                    </div>
                    <input
                      type="number"
                      required
                      min="1"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="w-full pl-12 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                      placeholder="Enter amount"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                    <AlertCircle size={14} />
                    100 Ksh = 100 Points
                  </p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Current Balance:</span>
                    <span className="font-medium">{balance.toLocaleString()} Pts</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Points to Add:</span>
                    <span className="font-medium text-emerald-600">+{topUpAmount ? parseInt(topUpAmount).toLocaleString() : 0} Pts</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 mt-2 pt-2">
                    <span className="text-brand-text">New Balance:</span>
                    <span className="text-brand-text">{(balance + (parseInt(topUpAmount) || 0)).toLocaleString()} Pts</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !topUpAmount}
                  className="flex-1 px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isProcessing ? 'Processing...' : 'Confirm Top-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
