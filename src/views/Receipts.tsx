import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Printer, 
  Plus, 
  FileText,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';

export function Receipts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isPrinting, setIsPrinting] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newReceipt, setNewReceipt] = useState({
    student: '',
    admNo: '',
    amount: '',
    method: 'Cash'
  });

  const [mockPayments, setMockPayments] = useState([
    { id: 'RCP-2024-001', student: 'Emma Thompson', admNo: 'ADM-2024-01', amount: 4500, points: 450, date: 'Today, 10:30 AM', method: 'M-Pesa', status: 'Completed' },
    { id: 'RCP-2024-002', student: 'James Wilson', admNo: 'ADM-2024-02', amount: 1200, points: 120, date: 'Yesterday, 02:15 PM', method: 'Cash', status: 'Completed' },
    { id: 'RCP-2024-003', student: 'Sophia Martinez', admNo: 'ADM-2024-03', amount: 8500, points: 850, date: 'Oct 24, 09:00 AM', method: 'Bank Transfer', status: 'Completed' },
    { id: 'RCP-2024-004', student: 'Lucas Brown', admNo: 'ADM-2024-04', amount: 3000, points: 300, date: 'Oct 23, 11:45 AM', method: 'M-Pesa', status: 'Pending' },
    { id: 'RCP-2024-005', student: 'Olivia Davis', admNo: 'ADM-2024-05', amount: 5000, points: 500, date: 'Oct 22, 08:30 AM', method: 'Cash', status: 'Completed' },
  ]);

  const filteredPayments = mockPayments.filter(payment => 
    payment.student.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.admNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrint = (id: string) => {
    setIsPrinting(id);
    const payment = mockPayments.find(p => p.id === id);
    if (payment) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Receipt ${payment.id}</title>
              <style>
                body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 20px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .divider { border-top: 1px dashed #000; margin: 10px 0; }
              </style>
            </head>
            <body>
              <div class="header">
                <h2>SCHOOL RECEIPT</h2>
                <p>${payment.id}</p>
              </div>
              <div class="row"><span>Date:</span><span>${payment.date}</span></div>
              <div class="row"><span>Student:</span><span>${payment.student}</span></div>
              <div class="row"><span>Adm No:</span><span>${payment.admNo}</span></div>
              <div class="divider"></div>
              <div class="row"><span>Amount:</span><span>KES ${payment.amount}</span></div>
              <div class="row"><span>Method:</span><span>${payment.method}</span></div>
              <div class="divider"></div>
              <p style="text-align: center">Thank you!</p>
              <script>
                window.onload = () => { window.print(); window.close(); }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
    
    setTimeout(() => {
      setIsPrinting(null);
      setToastMessage(`Receipt ${id} has been sent to the printer.`);
      setTimeout(() => setToastMessage(null), 3000);
    }, 1000);
  };

  const handleGenerateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `RCP-${new Date().getFullYear()}-${String(mockPayments.length + 1).padStart(3, '0')}`;
    const newPayment = {
      id: newId,
      student: newReceipt.student,
      admNo: newReceipt.admNo,
      amount: Number(newReceipt.amount),
      points: Math.floor(Number(newReceipt.amount) / 10),
      date: 'Just now',
      method: newReceipt.method,
      status: 'Completed'
    };
    setMockPayments([newPayment, ...mockPayments]);
    setIsAddModalOpen(false);
    setNewReceipt({ student: '', admNo: '', amount: '', method: 'Cash' });
    setToastMessage(`Receipt ${newId} generated successfully.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Receipts & Payments</h1>
          <p className="text-brand-text-muted mt-1">View payment history, generate manual receipts, and print records.</p>
          <p className="text-xs text-brand-text-muted mt-1 italic">To print receipts automatically, ensure your device is connected to a thermal receipt printer and configured as the default printer in your OS settings.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors flex items-center gap-2">
            <Plus size={18} />
            Generate Manual Receipt
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={20} />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Add Receipt Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xl font-bold text-brand-text">Generate Manual Receipt</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleGenerateReceipt} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
                <input
                  type="text"
                  required
                  value={newReceipt.student}
                  onChange={(e) => setNewReceipt({...newReceipt, student: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admission Number</label>
                <input
                  type="text"
                  required
                  value={newReceipt.admNo}
                  onChange={(e) => setNewReceipt({...newReceipt, admNo: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                  placeholder="e.g. ADM-2024-01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newReceipt.amount}
                  onChange={(e) => setNewReceipt({...newReceipt, amount: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                  placeholder="e.g. 1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={newReceipt.method}
                  onChange={(e) => setNewReceipt({...newReceipt, method: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                >
                  <option value="Cash">Cash</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-brand-navy text-white text-sm font-medium rounded-xl hover:bg-brand-navy-light transition-colors"
                >
                  Generate Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/30">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by student name, ADM no, or receipt ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm shadow-sm"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-brand-text hover:bg-gray-50 transition-colors shadow-sm">
              <Filter size={16} />
              Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Receipt ID & Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Student Details</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Payment Method</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors group bg-white">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-brand-navy">{payment.id}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{payment.date}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-brand-text">{payment.student}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{payment.admNo}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-brand-text">KES {payment.amount.toLocaleString()}</p>
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">+{payment.points} Pts</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-brand-text-muted bg-gray-100 px-2.5 py-1 rounded-md font-medium">
                      {payment.method}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {payment.status === 'Completed' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                        <CheckCircle2 size={12} /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                        <Clock size={12} /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handlePrint(payment.id)}
                      disabled={isPrinting === payment.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-brand-text hover:bg-gray-50 hover:text-brand-navy rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Printer size={16} className={isPrinting === payment.id ? "animate-pulse" : ""} />
                      {isPrinting === payment.id ? 'Printing...' : 'Print'}
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-base font-medium text-brand-text">No receipts found</p>
                    <p className="text-sm mt-1">Try adjusting your search terms.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
