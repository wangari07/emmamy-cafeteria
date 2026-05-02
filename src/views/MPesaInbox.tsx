import React, { useState, useEffect } from 'react';
import { MessageSquare, Search, Filter, Download, Loader2 } from 'lucide-react';

export function MPesaInbox() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch('/api/mpesa/transactions');
        if (res.ok) {
          const data = await res.json();
          setTransactions(data);
        }
      } catch (error) {
        console.error('Failed to fetch M-Pesa transactions', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter(tx => 
    tx.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.sender_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.phone_number?.includes(searchTerm)
  );

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">M-Pesa Inbox</h1>
          <p className="text-brand-text-muted mt-1">View and manage all incoming M-Pesa payments</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-brand-text flex items-center gap-2">
            <MessageSquare size={20} className="text-emerald-500" />
            Recent Messages
          </h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search transaction ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary w-full sm:w-64"
              />
            </div>
            <button className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors">
              <Filter size={18} />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="animate-spin text-brand-primary" size={32} />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sender</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone Number</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount (Ksh)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((msg) => (
                    <tr key={msg.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-emerald-700">{msg.transaction_id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-brand-text">{new Date(msg.created_at).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleTimeString()}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-brand-text">{msg.sender_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{msg.phone_number}</td>
                      <td className="px-6 py-4 text-sm font-bold text-brand-text text-right">{msg.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-100 text-emerald-700">
                          {msg.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
