import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Plus,
  BarChart3,
  Waves,
  CalendarDays,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  Clock3,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { IssueCardModal } from '../components/IssueCardModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  setCurrentView: (view: string) => void;
}

// ─── Skeleton primitives ──────────────────────────────────────────────────────
function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />;
}

function StatCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <div className="flex justify-between items-start">
        <SkeletonBox className="w-12 h-12 rounded-xl" />
        <SkeletonBox className="w-20 h-5" />
      </div>
      <div className="space-y-2">
        <SkeletonBox className="w-24 h-4" />
        <SkeletonBox className="w-32 h-8" />
      </div>
    </div>
  );
}

function TransactionRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center gap-3">
        <SkeletonBox className="w-10 h-10 rounded-full" />
        <div className="space-y-2">
          <SkeletonBox className="w-28 h-4" />
          <SkeletonBox className="w-20 h-3" />
        </div>
      </div>
      <div className="space-y-2 items-end flex flex-col">
        <SkeletonBox className="w-16 h-4" />
        <SkeletonBox className="w-12 h-3" />
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function Dashboard({ setCurrentView }: DashboardProps) {
  const { user } = useAuth();
  const [isIssueCardModalOpen, setIsIssueCardModalOpen] = useState(false);

  // ✅ Single query instead of three
  const summary = useQuery(api.dashboard.getSummary);
  const isLoading = summary === undefined;

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const formattedDate = new Date().toLocaleDateString('en-US', dateOptions);

  const handleDownloadReport = () => {
    if (!summary) return;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(20, 20, 20);
    doc.text('Cafeteria Operations Report', 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${formattedDate}`, 14, 30);

    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text('Summary Statistics', 14, 45);

    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Total Revenue', `Ksh ${summary.stats.total_revenue.toLocaleString()}`],
        ['Active Students', summary.stats.active_students.toLocaleString()],
        ['Matched Payments', summary.stats.matched_payments.toLocaleString()],
        ['Needs Review', summary.stats.review_payments.toLocaleString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.setFontSize(14);
    doc.text('Recent Payments', 14, (doc as any).lastAutoTable.finalY + 15);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Transaction Code', 'Amount', 'Student', 'Status']],
      body: summary.recentTransactions.map((p) => [
        p.transactionCode,
        `Ksh ${p.amount.toLocaleString()}`,
        p.studentAdmNo || 'Unmatched',
        p.status,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save('cafeteria-report.pdf');
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Unified Dashboard</h1>
          <p className="text-brand-text-muted mt-1">Overview of today's cafeteria operations</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadReport}
            disabled={isLoading}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Download Report
          </button>
          {user?.role !== 'headteacher' && (
            <button
              onClick={() => setCurrentView('payment-review')}
              className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navy-light transition-colors"
            >
              Review Payments
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Revenue"
              value={`Ksh ${summary.stats.total_revenue.toLocaleString()}`}
              trend={`${summary.stats.matched_payments} matched`}
              isPositive={true}
              icon={TrendingUp}
              onClick={() => setCurrentView('payment-review')}
            />
            <StatCard
              title="Active Students"
              value={summary.stats.active_students.toLocaleString()}
              trend="live"
              isPositive={true}
              icon={Users}
              onClick={() => setCurrentView('students')}
            />
            <StatCard
              title="Payments To Review"
              value={summary.stats.review_payments.toLocaleString()}
              trend={summary.stats.review_payments > 0 ? 'action needed' : 'clear'}
              isPositive={summary.stats.review_payments === 0}
              icon={AlertCircle}
              alert={summary.stats.review_payments > 0}
              onClick={() => setCurrentView('payment-review')}
            />
            <StatCard
              title="Matched Payments"
              value={summary.stats.matched_payments.toLocaleString()}
              trend="ready to post"
              isPositive={true}
              icon={CreditCard}
              onClick={() => setCurrentView('payment-review')}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-brand-text">Revenue Overview</h2>
            <button
              onClick={() => setCurrentView('payment-review')}
              className="text-sm font-medium text-brand-navy hover:underline"
            >
              Open Payments
            </button>
          </div>

          <div className="flex-1 min-h-[300px] mt-4">
            {isLoading ? (
              <div className="h-full flex flex-col justify-end gap-2 pb-4 px-2">
                {/* Fake bar chart skeleton */}
                <div className="flex items-end gap-3 h-full">
                  {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end">
                      <SkeletonBox className={`w-full rounded-lg`} style={{ height: `${h}%` } as React.CSSProperties} />
                    </div>
                  ))}
                </div>
                <SkeletonBox className="w-full h-4 mt-2" />
              </div>
            ) : summary.revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(value) =>
                      `Ksh ${value >= 1000 ? value / 1000 + 'k' : value}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px',
                    }}
                    formatter={(value: number) => [
                      `Ksh ${value.toLocaleString()}`,
                      'Revenue',
                    ]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                    {summary.revenueData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          index === summary.revenueData.length - 1
                            ? '#FACC15'
                            : '#0F172A'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-brand-text-muted">
                No payment data yet.
              </div>
            )}
          </div>
        </div>

        {/* Date Panel & Quick Actions */}
        <div className="flex flex-col gap-6">
          <div className="bg-brand-navy text-white p-6 rounded-2xl shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-brand-primary font-medium text-sm mb-1">Today's Date</p>
              <p className="text-lg font-bold leading-tight max-w-[150px]">{formattedDate}</p>
            </div>
            <CalendarDays
              size={48}
              className="text-white/10 absolute right-4 top-1/2 -translate-y-1/2"
            />
          </div>

          {user?.role !== 'headteacher' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col">
              <h2 className="text-lg font-semibold text-brand-text mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3 flex-1">
                {['super_admin', 'admin', 'manager'].includes(user?.role || '') && (
                  <>
                    <button
                      onClick={() => setIsIssueCardModalOpen(true)}
                      className="bg-gray-50 hover:bg-brand-primary/20 hover:border-brand-primary/30 border border-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                    >
                      <CreditCard
                        size={24}
                        className="text-brand-navy group-hover:scale-110 transition-transform"
                      />
                      <span className="text-xs font-medium text-brand-text">Issue Card</span>
                    </button>
                    <button
                      onClick={() => setCurrentView('add-card')}
                      className="bg-gray-50 hover:bg-brand-primary/20 hover:border-brand-primary/30 border border-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                    >
                      <Plus
                        size={24}
                        className="text-brand-navy group-hover:scale-110 transition-transform"
                      />
                      <span className="text-xs font-medium text-brand-text">Add Card</span>
                    </button>
                  </>
                )}
                {['super_admin', 'admin', 'manager', 'headteacher'].includes(
                  user?.role || ''
                ) && (
                  <button
                    onClick={() => setCurrentView('reports')}
                    className="bg-gray-50 hover:bg-brand-primary/20 hover:border-brand-primary/30 border border-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                  >
                    <BarChart3
                      size={24}
                      className="text-brand-navy group-hover:scale-110 transition-transform"
                    />
                    <span className="text-xs font-medium text-brand-text">Reports</span>
                  </button>
                )}
                <button
                  onClick={() => setCurrentView('swimming')}
                  className="bg-gray-50 hover:bg-brand-primary/20 hover:border-brand-primary/30 border border-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group"
                >
                  <Waves
                    size={24}
                    className="text-brand-navy group-hover:scale-110 transition-transform"
                  />
                  <span className="text-xs font-medium text-brand-text">Swimming</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-brand-text">Recent Transactions</h2>
            <button
              onClick={() => setCurrentView('payment-review')}
              className="text-sm font-medium text-brand-navy hover:underline"
            >
              View All
            </button>
          </div>
          <div className="space-y-1">
            {isLoading ? (
              <>
                <TransactionRowSkeleton />
                <TransactionRowSkeleton />
                <TransactionRowSkeleton />
                <TransactionRowSkeleton />
              </>
            ) : summary.recentTransactions.length > 0 ? (
              summary.recentTransactions.map((trx) => (
                <div
                  key={trx._id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-navy font-medium shrink-0">
                      {(trx.studentAdmNo || trx.payerName || 'T').charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-text truncate max-w-[140px]">
                        {trx.studentAdmNo
                          ? `ADM ${trx.studentAdmNo}`
                          : trx.payerName || 'Unmatched'}
                      </p>
                      <p className="text-[10px] text-brand-text-muted mt-0.5">
                        {trx.transactionCode} • {trx.matchMethod}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-emerald-600">
                      +Ksh {trx.amount.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-brand-text-muted mt-0.5 capitalize">
                      {trx.status}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-gray-500 text-sm">
                No recent transactions.
              </div>
            )}
          </div>
        </div>

        {/* M-Pesa Inbox */}
        {['super_admin', 'admin', 'manager'].includes(user?.role || '') && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-brand-text flex items-center gap-2">
                <MessageSquare size={20} className="text-emerald-500" />
                M-Pesa Inbox
              </h2>
              <button
                onClick={() => setCurrentView('payment-review')}
                className="text-sm font-medium text-brand-navy hover:underline"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <>
                  <SkeletonBox className="h-20 w-full" />
                  <SkeletonBox className="h-20 w-full" />
                  <SkeletonBox className="h-20 w-full" />
                </>
              ) : summary.recentMpesaMessages.length > 0 ? (
                summary.recentMpesaMessages.map((msg) => (
                  <div
                    key={msg._id}
                    className="p-3 bg-emerald-50/30 border border-emerald-100 rounded-xl"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-emerald-700">
                        {msg.transactionCode || 'NO-CODE'}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium capitalize">
                        {msg.processingStatus}
                      </span>
                    </div>
                    <p className="text-xs text-brand-text leading-relaxed">
                      Ksh{' '}
                      <span className="font-bold">
                        {msg.amount?.toLocaleString?.() || '0'}
                      </span>{' '}
                      from {msg.payerName || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-brand-text-muted">
                      {msg.processingStatus === 'matched' ||
                      msg.processingStatus === 'processed' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={12} />
                          matched
                        </span>
                      ) : msg.processingStatus === 'needs_review' ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle size={12} />
                          review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Clock3 size={12} />
                          received
                        </span>
                      )}
                      <span>•</span>
                      <span>{msg.accountReferenceRaw || 'No account ref'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No M-Pesa messages.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Status Summary */}
        {['super_admin', 'admin', 'manager'].includes(user?.role || '') && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-brand-text">Payment Status</h2>
              <button
                onClick={() => setCurrentView('payment-review')}
                className="text-sm font-medium text-brand-navy hover:underline inline-flex items-center gap-1"
              >
                Review <ChevronRight size={14} />
              </button>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <>
                  <SkeletonBox className="h-12 w-full" />
                  <SkeletonBox className="h-12 w-full" />
                  <SkeletonBox className="h-12 w-full" />
                  <SkeletonBox className="h-12 w-full" />
                </>
              ) : (
                <>
                  <StatusRow label="Matched" value={summary.paymentStatus.matched} tone="green" />
                  <StatusRow label="Needs Review" value={summary.paymentStatus.needs_review} tone="amber" />
                  <StatusRow label="Posted" value={summary.paymentStatus.posted} tone="blue" />
                  <StatusRow label="Unmatched" value={summary.paymentStatus.unmatched} tone="gray" />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <IssueCardModal
        isOpen={isIssueCardModalOpen}
        onClose={() => setIsIssueCardModalOpen(false)}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  trend,
  isPositive,
  icon: Icon,
  alert = false,
  onClick,
}: any) {
  return (
    <div
      onClick={onClick}
      className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group ${
        onClick ? 'cursor-pointer hover:border-brand-primary/30' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div
          className={`p-3 rounded-xl ${
            alert ? 'bg-red-50 text-red-500' : 'bg-brand-primary/20 text-brand-navy'
          }`}
        >
          <Icon size={24} />
        </div>
        <div
          className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {trend}
        </div>
      </div>
      <div>
        <h3 className="text-brand-text-muted text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-brand-text mt-1">{value}</p>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-primary opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'amber' | 'blue' | 'gray';
}) {
  const toneClasses =
    tone === 'green'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'amber'
      ? 'bg-amber-100 text-amber-700'
      : tone === 'blue'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-700';

  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50">
      <span className="text-sm font-medium text-brand-text">{label}</span>
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${toneClasses}`}>
        {value}
      </span>
    </div>
  );
}