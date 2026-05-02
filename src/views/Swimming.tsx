import React from 'react';
import { Waves, Search, Filter, CheckCircle2 } from 'lucide-react';

export function Swimming() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Swimming Access</h1>
          <p className="text-brand-text-muted mt-1">Manage swimming pool payments and access</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navy-light transition-colors flex items-center gap-2">
            <Waves size={18} />
            Scan Card for Entry
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-brand-text-muted text-sm font-medium">Today's Entries</h3>
          <p className="text-2xl font-bold text-brand-text mt-1">142</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-brand-text-muted text-sm font-medium">Revenue (Today)</h3>
          <p className="text-2xl font-bold text-brand-text mt-1">Ksh 14,200</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-brand-text-muted text-sm font-medium">Active Subscriptions</h3>
          <p className="text-2xl font-bold text-brand-text mt-1">85</p>
        </div>
      </div>

      {/* Recent Entries Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-brand-text">Recent Entries</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search student..." 
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary w-full sm:w-64"
              />
            </div>
            <button className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors">
              <Filter size={18} />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Access Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { id: 1, name: 'Emma Thompson', admNo: 'ADM-2021', class: 'Form 3A', time: '14:30 PM', type: 'Pay-per-use', amount: 'Ksh 100', status: 'Approved' },
                { id: 2, name: 'James Wilson', admNo: 'ADM-1984', class: 'Form 4B', time: '14:15 PM', type: 'Subscription', amount: 'Ksh 0', status: 'Approved' },
                { id: 3, name: 'Sophia Martinez', admNo: 'ADM-2105', class: 'Form 2A', time: '13:45 PM', type: 'Pay-per-use', amount: 'Ksh 100', status: 'Approved' },
              ].map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-xs">
                        {entry.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-brand-text">{entry.name}</p>
                        <p className="text-xs text-gray-500">{entry.admNo} • {entry.class}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{entry.time}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${entry.type === 'Subscription' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-brand-text">{entry.amount}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 size={16} />
                      <span className="text-xs font-medium">{entry.status}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
