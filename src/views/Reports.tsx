import React, { useMemo, useState } from 'react';
import {
  Download,
  Calendar,
  TrendingUp,
  Utensils,
  AlertCircle,
  RefreshCcw,
  BarChart3,
  Wallet,
  Package,
  Trash2,
  Archive,
  Brain,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';

type CampusCode = 'MAIN_SCHOOL' | 'DIGITAL_SCHOOL';

const campuses: CampusCode[] = ['MAIN_SCHOOL', 'DIGITAL_SCHOOL'];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekStart(dateString: string) {
  const date = new Date(dateString);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + diff);

  return date.toISOString().slice(0, 10);
}

function getWeekEnd(weekStartDate: string) {
  const date = new Date(weekStartDate);
  date.setDate(date.getDate() + 6);
  return date.toISOString().slice(0, 10);
}

function niceLabel(value: string) {
  return value.replaceAll('_', ' ');
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-KE').format(value || 0);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(1)}%`;
}

function getValue(report: any, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = report?.[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return fallback;
}

function getText(report: any, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = report?.[key];

    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return fallback;
}

function getArray(report: any, keys: string[]) {
  for (const key of keys) {
    const value = report?.[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

export function Reports() {
  const { user } = useAuth();

  const appUserId = (
    (user as any)?._id ||
    (user as any)?.id ||
    (user as any)?.userId ||
    (user as any)?.appUserId
  ) as Id<'appUsers'> | undefined;

  const [selectedCampus, setSelectedCampus] = useState<CampusCode>('MAIN_SCHOOL');
  const [selectedDate, setSelectedDate] = useState(todayDate());
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const weekStartDate = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekEndDate = useMemo(() => getWeekEnd(weekStartDate), [weekStartDate]);

  const previewReport = useQuery((api.mealReports as any).previewWeeklyReport, {
    campusCode: selectedCampus,
    weekStartDate,
  });

  const savedReports = useQuery((api.mealReports as any).listWeeklyReports, {
    campusCode: selectedCampus,
    limit: 20,
  });

  const categoryBreakdown = useQuery(
    (api.mealReports as any).getWeeklyCategoryBreakdown,
    {
      campusCode: selectedCampus,
      weekStartDate,
    }
  );

  const generateWeeklyReport = useMutation(
    (api.mealReports as any).generateWeeklyReport
  );

  const loading =
    previewReport === undefined ||
    savedReports === undefined ||
    categoryBreakdown === undefined;

  const report = previewReport || {};

  const totalPurchases = getValue(report, [
    'totalPurchaseCost',
    'totalPurchases',
    'purchaseTotal',
    'weeklyPurchaseCost',
  ]);

  const kitchenIssuedCost = getValue(report, [
    'totalKitchenIssueCost',
    'kitchenIssuedCost',
    'issuedCost',
    'totalIssuedCost',
  ]);

  const wasteCost = getValue(report, [
    'totalWasteCost',
    'wasteCost',
  ]);

  const leftoverValue = getValue(report, [
    'totalLeftoverValue',
    'leftoverValue',
  ]);

  const mealsServed = getValue(report, [
    'totalMealsServed',
    'mealsServed',
    'servedCount',
  ]);

  const lunchServed = getValue(report, ['lunchServedCount', 'lunchServed']);
  const teaServed = getValue(report, ['teaServedCount', 'teaServed']);
  const snackServed = getValue(report, ['snackServedCount', 'snackServed']);
  const fruitServed = getValue(report, ['fruitServedCount', 'fruitServed']);

  const estimatedRevenue = getValue(report, [
    'estimatedRevenue',
    'totalEstimatedRevenue',
    'revenue',
  ]);

  const grossProfit = getValue(report, [
    'grossProfit',
    'estimatedGrossProfit',
    'profit',
  ]);

  const profitMargin = getValue(report, [
    'profitMargin',
    'estimatedProfitMargin',
    'margin',
  ]);

  const aiSummary = getText(report, [
    'aiSummary',
    'summary',
    'insightSummary',
  ]);

  const alerts = getArray(report, [
    'alerts',
    'warnings',
    'systemAlerts',
  ]);

  const chartData = [
    {
      name: 'Purchases',
      value: totalPurchases,
    },
    {
      name: 'Kitchen Issued',
      value: kitchenIssuedCost,
    },
    {
      name: 'Waste',
      value: wasteCost,
    },
    {
      name: 'Leftovers',
      value: leftoverValue,
    },
    {
      name: 'Revenue',
      value: estimatedRevenue,
    },
    {
      name: 'Profit',
      value: grossProfit,
    },
  ];

  const servedData = [
    { name: 'Lunch', value: lunchServed },
    { name: 'Tea', value: teaServed },
    { name: 'Snacks', value: snackServed },
    { name: 'Fruit', value: fruitServed },
  ].filter((item) => item.value > 0);

  const categoryRows = Array.isArray(categoryBreakdown)
    ? categoryBreakdown
    : [];

  const handleGenerateReport = async () => {
    setMessage(null);

    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your user ID is missing from the login session. Please log out and log back in.',
      });
      return;
    }

    try {
      await generateWeeklyReport({
        campusCode: selectedCampus,
        weekStartDate,
        generatedByUserId: appUserId,
      });

      setMessage({
        type: 'success',
        text: 'Weekly profit/loss report generated successfully.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          error?.message ||
          'Failed to generate weekly report. If this is an argument error, paste it here and I will align the frontend to the backend.',
      });
    }
  };

  const handleDownloadReport = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Cafeteria Profit/Loss Report', 14, 22);

    doc.setFontSize(11);
    doc.text(`Campus: ${niceLabel(selectedCampus)}`, 14, 31);
    doc.text(`Week: ${weekStartDate} to ${weekEndDate}`, 14, 38);

    doc.setFontSize(14);
    doc.text('Weekly Summary', 14, 52);

    autoTable(doc, {
      startY: 58,
      head: [['Metric', 'Value']],
      body: [
        ['Total Purchases', formatMoney(totalPurchases)],
        ['Stock Issued to Kitchen', formatMoney(kitchenIssuedCost)],
        ['Waste Cost', formatMoney(wasteCost)],
        ['Leftover Value', formatMoney(leftoverValue)],
        ['Meals Served', formatNumber(mealsServed)],
        ['Estimated Revenue', formatMoney(estimatedRevenue)],
        ['Gross Profit / Loss', formatMoney(grossProfit)],
        ['Profit Margin', formatPercent(profitMargin)],
      ],
    });

    const afterSummaryY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.text('Served Breakdown', 14, afterSummaryY);

    autoTable(doc, {
      startY: afterSummaryY + 6,
      head: [['Meal Type', 'Count']],
      body: [
        ['Lunch', formatNumber(lunchServed)],
        ['Tea', formatNumber(teaServed)],
        ['Snacks', formatNumber(snackServed)],
        ['Fruit', formatNumber(fruitServed)],
      ],
    });

    const afterServedY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(14);
    doc.text('Alerts', 14, afterServedY);

    autoTable(doc, {
      startY: afterServedY + 6,
      head: [['Alert']],
      body:
        alerts.length > 0
          ? alerts.map((alert: any) => [
              typeof alert === 'string'
                ? alert
                : alert.message || JSON.stringify(alert),
            ])
          : [['No alerts for this week.']],
    });

    if (aiSummary) {
      const afterAlertsY = (doc as any).lastAutoTable.finalY + 15;

      doc.setFontSize(14);
      doc.text('Summary', 14, afterAlertsY);

      doc.setFontSize(10);
      const lines = doc.splitTextToSize(aiSummary, 180);
      doc.text(lines, 14, afterAlertsY + 8);
    }

    doc.save(`profit-loss-report-${selectedCampus}-${weekStartDate}.pdf`);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <RefreshCcw className="animate-spin text-brand-primary" size={32} />
          <p className="text-sm text-brand-text-muted">Loading profit/loss report...</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Weekly Purchases',
      value: formatMoney(totalPurchases),
      icon: Wallet,
      subtext: 'Shopping and receipt total',
      color: 'bg-brand-navy',
    },
    {
      label: 'Kitchen Issued',
      value: formatMoney(kitchenIssuedCost),
      icon: Package,
      subtext: 'Store stock issued to kitchen',
      color: 'bg-blue-600',
    },
    {
      label: 'Waste Cost',
      value: formatMoney(wasteCost),
      icon: Trash2,
      subtext: 'Recorded daily waste',
      color: 'bg-red-500',
    },
    {
      label: 'Gross Profit / Loss',
      value: formatMoney(grossProfit),
      icon: TrendingUp,
      subtext: `${formatPercent(profitMargin)} margin`,
      color: grossProfit >= 0 ? 'bg-emerald-600' : 'bg-red-600',
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">
            Profit/Loss Reports
          </h1>
          <p className="text-brand-text-muted mt-1">
            Weekly accountability report for purchases, stock issued to kitchen,
            waste, leftovers, served meals, revenue, and profitability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value as CampusCode)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            {campuses.map((campus) => (
              <option key={campus} value={campus}>
                {niceLabel(campus)}
              </option>
            ))}
          </select>

          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm"
            />
            <Calendar
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-brand-primary-hover"
          >
            <CheckCircle2 size={18} />
            Generate Weekly Report
          </button>

          <button
            type="button"
            onClick={handleDownloadReport}
            className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-brand-navy-light"
          >
            <Download size={18} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <p className="text-sm text-brand-text">
          Showing week:{' '}
          <span className="font-bold">
            {weekStartDate} to {weekEndDate}
          </span>
        </p>
      </div>

      {message && (
        <div
          className={`rounded-2xl border p-4 flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <StatCard
          label="Meals Served"
          value={formatNumber(mealsServed)}
          icon={Utensils}
          subtext="Lunch, tea, snacks, and fruit"
          color="bg-amber-500"
        />

        <StatCard
          label="Estimated Revenue"
          value={formatMoney(estimatedRevenue)}
          icon={BarChart3}
          subtext="Based on served meals"
          color="bg-purple-600"
        />

        <StatCard
          label="Leftover Value"
          value={formatMoney(leftoverValue)}
          icon={Archive}
          subtext="Reusable or remaining value"
          color="bg-slate-600"
        />

        <StatCard
          label="Alerts"
          value={alerts.length}
          icon={AlertCircle}
          subtext="Low stock, losses, price changes"
          color={alerts.length > 0 ? 'bg-red-500' : 'bg-emerald-600'}
        />
      </div>

      {aiSummary && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={20} className="text-brand-primary" />
            <h3 className="font-bold text-brand-text">Management Summary</h3>
          </div>

          <p className="text-sm text-brand-text-muted leading-relaxed">
            {aiSummary}
          </p>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={20} className="text-red-600" />
            <h3 className="font-bold text-brand-text">Report Alerts</h3>
          </div>

          <div className="space-y-3">
            {alerts.map((alert: any, index: number) => (
              <div
                key={index}
                className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-800"
              >
                {typeof alert === 'string'
                  ? alert
                  : alert.message || JSON.stringify(alert)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold mb-4 text-brand-text">
            Weekly Money Flow
          </h3>

          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis />
              <Tooltip formatter={(value: any) => formatMoney(Number(value))} />
              <Bar dataKey="value" fill="#0F172A" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold mb-4 text-brand-text">
            Meals Served Breakdown
          </h3>

          {servedData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-brand-text-muted text-sm">
              No served meal breakdown available for this week.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RePieChart>
                <Pie
                  data={servedData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  {servedData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={['#0F172A', '#FACC15', '#10B981', '#F43F5E'][index % 4]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-brand-text">
            Category Breakdown
          </h3>
          <p className="text-sm text-brand-text-muted mt-1">
            Purchase, issue, waste, or meal category data returned by the backend.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-brand-text-muted">
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Quantity</th>
                <th className="px-6 py-3">Cost</th>
                <th className="px-6 py-3">Revenue</th>
                <th className="px-6 py-3">Profit</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {categoryRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-brand-text-muted"
                  >
                    No category breakdown available yet.
                  </td>
                </tr>
              ) : (
                categoryRows.map((row: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50/60">
                    <td className="px-6 py-4 text-sm font-semibold text-brand-text">
                      {niceLabel(
                        row.category ||
                          row.mealCategory ||
                          row.name ||
                          `Category ${index + 1}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-brand-text-muted">
                      {formatNumber(row.quantity || row.count || row.servedCount || 0)}
                    </td>
                    <td className="px-6 py-4 text-sm text-brand-text-muted">
                      {formatMoney(row.cost || row.totalCost || row.purchaseCost || 0)}
                    </td>
                    <td className="px-6 py-4 text-sm text-brand-text-muted">
                      {formatMoney(row.revenue || row.estimatedRevenue || 0)}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm font-semibold ${
                        (row.profit || row.grossProfit || 0) >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      {formatMoney(row.profit || row.grossProfit || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-brand-text">Saved Weekly Reports</h3>
          <p className="text-sm text-brand-text-muted mt-1">
            Recently generated reports for {niceLabel(selectedCampus)}.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase text-brand-text-muted">
                <th className="px-6 py-3">Report</th>
                <th className="px-6 py-3">Week</th>
                <th className="px-6 py-3">Purchases</th>
                <th className="px-6 py-3">Revenue</th>
                <th className="px-6 py-3">Profit/Loss</th>
                <th className="px-6 py-3">Margin</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {(savedReports ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-sm text-brand-text-muted"
                  >
                    No saved weekly reports yet. Generate this week’s report first.
                  </td>
                </tr>
              ) : (
                (savedReports ?? []).map((saved: any) => {
                  const savedProfit = getValue(saved, [
                    'grossProfit',
                    'estimatedGrossProfit',
                    'profit',
                  ]);

                  return (
                    <tr key={saved._id} className="hover:bg-gray-50/60">
                      <td className="px-6 py-4 text-sm font-semibold text-brand-text">
                        {saved.reportNumber || saved._id}
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-text-muted">
                        {saved.weekStartDate || '—'} to {saved.weekEndDate || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-text-muted">
                        {formatMoney(
                          getValue(saved, [
                            'totalPurchaseCost',
                            'totalPurchases',
                            'purchaseTotal',
                          ])
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-text-muted">
                        {formatMoney(
                          getValue(saved, [
                            'estimatedRevenue',
                            'totalEstimatedRevenue',
                            'revenue',
                          ])
                        )}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm font-semibold ${
                          savedProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {formatMoney(savedProfit)}
                      </td>
                      <td className="px-6 py-4 text-sm text-brand-text-muted">
                        {formatPercent(
                          getValue(saved, [
                            'profitMargin',
                            'estimatedProfitMargin',
                            'margin',
                          ])
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  subtext,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  subtext: string;
  color: string;
}) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm text-brand-text-muted">{label}</h3>
          <p className="text-2xl font-bold text-brand-text mt-2">{value}</p>
          <p className="text-xs text-brand-text-muted mt-1">{subtext}</p>
        </div>

        <div className={`p-3 rounded-xl ${color} text-white shrink-0`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}