import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  Search, 
  Filter, 
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Transactions() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    fetchTransactions();
  }, [searchQuery, filterType]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      let url = `/api/transactions?search=${encodeURIComponent(searchQuery)}`;
      if (filterType) url += `&type=${encodeURIComponent(filterType)}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      const data = await response.json();
      setTransactions(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['Transaction ID', 'Type', 'Amount', 'Student', 'Adm No', 'Class', 'Item', 'Date', 'Status'];
    const csvContent = [
      headers.join(','),
      ...transactions.map(trx => [
        trx.id,
        trx.type,
        trx.amount,
        trx.student_name,
        trx.student_adm_no,
        trx.student_class,
        trx.item,
        new Date(trx.created_at).toLocaleString(),
        trx.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Transactions</h1>
          <p className="text-brand-text-muted mt-1">View and manage all cafeteria purchases and top-ups</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport}
            disabled={transactions.length === 0}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/30">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by ID, name or adm no..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm shadow-sm"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-brand-text hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">All Types</option>
              <option value="Purchase">Purchase</option>
              <option value="Top-up">Top-up</option>
              <option value="Refund">Refund</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-brand-text-muted">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Loading transactions...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">
              <p>{error}</p>
              <button onClick={fetchTransactions} className="mt-4 text-brand-primary hover:underline">Try again</button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-brand-text-muted">
              <p>No transactions found matching your criteria.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Transaction</th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Student</th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-gray-50/50 transition-colors bg-white">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          trx.type === 'Purchase' ? 'bg-red-50 text-red-500' : 
                          trx.type === 'Top-up' ? 'bg-emerald-50 text-emerald-500' : 
                          'bg-blue-50 text-blue-500'
                        }`}>
                          {trx.type === 'Purchase' ? <ArrowDownRight size={20} /> : 
                           trx.type === 'Top-up' ? <ArrowUpRight size={20} /> : 
                           <ArrowRightLeft size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-brand-text">{trx.id}</p>
                          <p className="text-xs text-brand-text-muted">{trx.item || trx.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-brand-text">{trx.student_name}</p>
                        <p className="text-xs text-brand-text-muted">{trx.student_adm_no} • {trx.student_class}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className={`text-sm font-bold ${
                        trx.amount < 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {trx.amount < 0 ? '-' : '+'}{Math.abs(trx.amount).toLocaleString()} KES
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-brand-text">{new Date(trx.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-brand-text-muted">{new Date(trx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        trx.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : 
                        trx.status === 'Processed' ? 'bg-blue-50 text-blue-700' : 
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {trx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
