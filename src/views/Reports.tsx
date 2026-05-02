import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Calendar, 
  TrendingUp, 
  Users,
  Utensils,
  AlertCircle,
  ChevronRight,
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
  Legend
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ✅ ADD CONVEX
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

if (!import.meta.env.VITE_CONVEX_URL) {
  throw new Error("Missing VITE_CONVEX_URL");
}
const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

export function Reports() {
  const [summary, setSummary] = useState<any>(null);
  const [popularItems, setPopularItems] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // 🔥 FIXED: CONVEX DATA FETCH
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);

        const [summaryRes, popularRes, distributionRes] = await Promise.all([
          convex.query(api.reports.getSummary),
          convex.query(api.reports.getPopularItems),
          convex.query(api.reports.getDistribution),
        ]);

        setSummary(summaryRes);
        setPopularItems(popularRes);
        setDistributionData(distributionRes);

      } catch (error) {
        console.error('Error fetching reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [dateRange, selectedDate]);

  const COLORS = ['#0F172A', '#FACC15', '#10B981', '#F43F5E'];

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Cafeteria Operations Report', 14, 22);
    
    doc.setFontSize(11);
    const displayDate = new Date(selectedDate).toLocaleDateString();
    doc.text(`Report for: ${displayDate}`, 14, 30);
    
    doc.setFontSize(14);
    doc.text('Summary Statistics', 14, 45);
    
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Total Points Used', summary?.totalPoints?.toLocaleString() || '0'],
        ['Meals Served', summary?.totalMeals?.toLocaleString() || '0'],
        ['Active Students', summary?.uniqueStudents?.toLocaleString() || '0'],
      ],
    });
    
    doc.text('Popular Items', 14, (doc as any).lastAutoTable.finalY + 15);
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Item Name', 'Quantity']],
      body: popularItems.map(item => [
        item.name,
        item.count.toString(),
      ]),
    });

    doc.save(`cafeteria-report-${selectedDate}.pdf`);
  };

  const stats = [
    { label: 'Total Meals Served', value: summary?.totalMeals?.toLocaleString() || '0', icon: Utensils, trend: '', color: 'bg-brand-primary' },
    { label: 'Active Students', value: summary?.uniqueStudents?.toLocaleString() || '0', icon: Users, trend: '', color: 'bg-emerald-500' },
    { label: 'Total Points Used', value: summary?.totalPoints?.toLocaleString() || '0', icon: TrendingUp, trend: '', color: 'bg-brand-navy' },
    { label: 'Low Stock Items', value: '0', icon: AlertCircle, trend: '', color: 'bg-amber-500' },
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Reports & Analytics</h1>
          <p className="text-brand-text-muted mt-1">Detailed insights into cafeteria performance</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border rounded-xl p-1">
            {['day','week','month'].map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r as any)}
                className={`px-3 py-1.5 text-sm rounded-lg ${dateRange === r ? 'bg-gray-100' : ''}`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="relative">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border rounded-xl text-sm"
            />
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          </div>

          <button 
            onClick={handleDownloadReport}
            className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm flex items-center gap-2"
          >
            <Download size={18} />
            Download PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-2xl shadow-sm">
            <div className={`p-3 rounded-xl ${stat.color} text-white w-fit`}>
              <stat.icon size={24} />
            </div>
            <h3 className="text-sm mt-4">{stat.label}</h3>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b flex justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Utensils size={20} /> Popular Items
          </h3>
          <span className="text-sm flex items-center gap-1">
            View All <ChevronRight size={16} />
          </span>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase">
              <th className="px-6 py-3">Item</th>
              <th className="px-6 py-3">Sold</th>
            </tr>
          </thead>
          <tbody>
            {popularItems.map((item, i) => (
              <tr key={i}>
                <td className="px-6 py-4">{item.name}</td>
                <td className="px-6 py-4">{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl">
          <h3 className="font-bold mb-4">Popular Items</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={popularItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0F172A" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl">
          <h3 className="font-bold mb-4">Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RePieChart>
              <Pie data={distributionData} dataKey="value" outerRadius={80}>
                {distributionData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}