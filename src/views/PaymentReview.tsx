import React, { useMemo, useState } from 'react';
import { CheckCircle2, Link2, Search, Wallet } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function PaymentReview() {
  const [filter, setFilter] = useState<'all' | 'matched' | 'needs_review' | 'posted' | 'unmatched'>('all');
  const [search, setSearch] = useState('');
  const [attachTarget, setAttachTarget] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const allPayments = useQuery(api.payments.listPayments, {}) || [];
  const students = useQuery(api.students.list, {}) || [];

  const markPaymentPosted = useMutation(api.payments.markPaymentPosted);
  const manuallyAttachPaymentToStudent = useMutation(api.payments.manuallyAttachPaymentToStudent);

  const filteredPayments = useMemo(() => {
    let result = [...allPayments];

    if (filter !== 'all') {
      result = result.filter((p) => p.status === filter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) =>
        p.transactionCode.toLowerCase().includes(q) ||
        (p.studentAdmNo || '').toLowerCase().includes(q) ||
        (p.payerName || '').toLowerCase().includes(q) ||
        (p.accountReferenceRaw || '').toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allPayments, filter, search]);

  const handlePost = async (paymentId: any) => {
    try {
      await markPaymentPosted({ paymentId });
    } catch (error) {
      console.error('Failed to mark payment as posted', error);
    }
  };

  const handleAttach = async (paymentId: any) => {
    if (!selectedStudentId) return;

    try {
      await manuallyAttachPaymentToStudent({
        paymentId,
        studentId: selectedStudentId as any,
      });
      setAttachTarget(null);
      setSelectedStudentId('');
    } catch (error) {
      console.error('Failed to attach payment', error);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Payment Review</h1>
          <p className="text-brand-text-muted mt-1">
            Review M-Pesa payments, match students, and mark them posted.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transaction, admission, payer..."
              className="pl-9 pr-4 py-2.5 w-72 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">All</option>
            <option value="matched">Matched</option>
            <option value="needs_review">Needs Review</option>
            <option value="posted">Posted</option>
            <option value="unmatched">Unmatched</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-sm font-semibold text-brand-text">Transaction</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-text">Amount</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-text">Reference</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-text">Student</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-text">Match</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-text">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-brand-text">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment._id} className="border-b border-gray-50 align-top">
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-brand-text">{payment.transactionCode}</div>
                    <div className="text-xs text-brand-text-muted mt-1">
                      {payment.payerName || 'Unknown payer'}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-emerald-600">
                      Ksh {payment.amount.toLocaleString()}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm text-brand-text">{payment.accountReferenceRaw || '—'}</div>
                    <div className="text-xs text-brand-text-muted mt-1">
                      {payment.itemLabel || 'No item label'}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    {payment.studentAdmNo ? (
                      <div>
                        <div className="text-sm font-medium text-brand-text">
                          ADM {payment.studentAdmNo}
                        </div>
                        <div className="text-xs text-brand-text-muted mt-1">
                          {payment.studentId ? 'Linked' : 'Not linked'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-brand-text-muted">Unassigned</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 capitalize">
                      {payment.matchMethod.replace('_', ' ')}
                    </span>
                    <div className="text-xs text-brand-text-muted mt-1 capitalize">
                      {payment.matchConfidence} confidence
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        payment.status === 'posted'
                          ? 'bg-blue-100 text-blue-700'
                          : payment.status === 'matched'
                          ? 'bg-emerald-100 text-emerald-700'
                          : payment.status === 'needs_review'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2 min-w-[220px]">
                      {(payment.status === 'matched') && (
                        <button
                          onClick={() => handlePost(payment._id)}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <CheckCircle2 size={16} />
                          Mark Posted
                        </button>
                      )}

                      {(payment.status === 'needs_review' || payment.status === 'unmatched') && (
                        <>
                          <select
                            value={attachTarget === payment._id ? selectedStudentId : ''}
                            onChange={(e) => {
                              setAttachTarget(payment._id);
                              setSelectedStudentId(e.target.value);
                            }}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                          >
                            <option value="">Select student to attach</option>
                            {students.map((student) => (
                              <option key={student._id} value={student._id}>
                                {student.admNo} - {student.studentName}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => handleAttach(payment._id)}
                            disabled={!(attachTarget === payment._id && selectedStudentId)}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-brand-navy text-white text-sm font-medium hover:bg-brand-navy-light transition-colors disabled:opacity-50"
                          >
                            <Link2 size={16} />
                            Attach To Student
                          </button>
                        </>
                      )}

                      {payment.status === 'posted' && (
                        <div className="inline-flex items-center gap-2 text-sm text-blue-700 font-medium">
                          <Wallet size={16} />
                          Already posted
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-brand-text-muted">
                    No payments found for this filter.
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