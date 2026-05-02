import React from 'react';
import { Plus, CreditCard, Upload } from 'lucide-react';

export function AddCard() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Add New Cards</h1>
        <p className="text-brand-text-muted mt-1">Register new blank cards into the system inventory</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Single Card Entry */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-text mb-4">Register Single Card</h2>
          <form className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Card UID (Hex)</label>
              <input 
                type="text" 
                placeholder="e.g. 04:82:3A:12:F1:34:80" 
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Batch Number (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. BATCH-2024-A" 
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
              />
            </div>
            <button type="button" className="w-full h-12 bg-brand-primary hover:bg-brand-primary-hover text-brand-navy font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              <Plus size={20} />
              Register Card
            </button>
          </form>
        </div>

        {/* Bulk Upload */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-text mb-4">Bulk Registration</h2>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4 hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="w-16 h-16 bg-brand-primary/20 text-brand-navy rounded-full flex items-center justify-center">
              <Upload size={32} />
            </div>
            <div>
              <p className="font-medium text-slate-900">Click to upload CSV file</p>
              <p className="text-sm text-slate-500 mt-1">or drag and drop</p>
            </div>
            <p className="text-xs text-slate-400 max-w-xs">CSV must contain a 'UID' column. Maximum 500 cards per upload.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
