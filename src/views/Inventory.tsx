import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
  Package,
  Boxes,
  TrendingUp,
  Activity,
  RefreshCcw,
  X,
  Save,
  Eye,
  History,
  Edit3,
  Trash2,
  ClipboardList,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Minus,
  Lightbulb,
  CornerDownLeft,
  LogOut,
  Layers,
  Info,
} from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';

type CampusCode = 'MAIN_SCHOOL' | 'DIGITAL_SCHOOL';
type Category =
  | 'LUNCH'
  | 'SNACK'
  | 'DRINK'
  | 'FRUIT'
  | 'TEA'
  | 'SUPPLY'
  | 'OTHER';

type MovementType =
  | 'STOCK_IN'
  | 'DISPATCH_OUT'
  | 'RECEIPT_IN'
  | 'ADJUSTMENT'
  | 'KITCHEN_ISSUE'
  | 'WASTE'
  | 'LEFTOVER_RETURN';

const categories: Category[] = [
  'LUNCH',
  'TEA',
  'SNACK',
  'FRUIT',
  'DRINK',
  'SUPPLY',
  'OTHER',
];

const campuses: CampusCode[] = ['MAIN_SCHOOL', 'DIGITAL_SCHOOL'];

const movementTypes: MovementType[] = [
  'STOCK_IN',
  'DISPATCH_OUT',
  'RECEIPT_IN',
  'ADJUSTMENT',
  'KITCHEN_ISSUE',
  'WASTE',
  'LEFTOVER_RETURN',
];

function userCampusToInventoryCampus(value?: string | null): CampusCode | undefined {
  if (value === 'main') return 'MAIN_SCHOOL';
  if (value === 'digital') return 'DIGITAL_SCHOOL';
  return undefined;
}

function niceLabel(value?: string | null) {
  if (!value) return '—';
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
  return new Intl.NumberFormat('en-KE', {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function movementTone(type: MovementType) {
  if (type === 'STOCK_IN' || type === 'RECEIPT_IN' || type === 'LEFTOVER_RETURN') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (type === 'WASTE' || type === 'DISPATCH_OUT' || type === 'KITCHEN_ISSUE') {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function isInbound(type: string) {
  return ['STOCK_IN', 'RECEIPT_IN', 'LEFTOVER_RETURN'].includes(type);
}

function isOutbound(type: string) {
  return ['DISPATCH_OUT', 'KITCHEN_ISSUE', 'WASTE'].includes(type);
}

function movementIcon(type: MovementType) {
  if (isInbound(type)) return <ArrowDownCircle size={14} className="text-emerald-600" />;
  if (isOutbound(type)) return <ArrowUpCircle size={14} className="text-red-500" />;
  return <Minus size={14} className="text-blue-500" />;
}

export function Inventory() {
  const { user } = useAuth();

  const defaultCampus = userCampusToInventoryCampus(user?.school);
  const actor = user?.name || user?.email || 'Unknown user';

  const [searchTerm, setSearchTerm] = useState('');
  const [campusFilter, setCampusFilter] = useState<CampusCode | 'All'>(
    defaultCampus || 'All'
  );
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'Low Stock' | 'Active' | 'Inactive'>(
    'Active'
  );
  const [movementFilter, setMovementFilter] = useState<MovementType | 'All'>('All');

  const [selectedItemId, setSelectedItemId] = useState<Id<'inventoryItems'> | null>(null);

  const [sortColumn, setSortColumn] = useState<string | null>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const items = useQuery(api.inventory.listItems, {
    campusCode: campusFilter === 'All' ? undefined : campusFilter,
    category: categoryFilter === 'All' ? undefined : categoryFilter,
    activeOnly: stockFilter === 'Active' ? true : undefined,
    search: searchTerm.trim() || undefined,
  });

  const summary = useQuery(api.inventory.getSummary, {
    campusCode: campusFilter === 'All' ? undefined : campusFilter,
  });

  const lowStock = useQuery(api.inventory.listLowStock, {
    campusCode: campusFilter === 'All' ? undefined : campusFilter,
  });

  const itemLedger = useQuery(
    (api.inventory as any).getItemStockLedger,
    selectedItemId ? { inventoryItemId: selectedItemId, limit: 500 } : 'skip'
  );

  const createItem = useMutation(api.inventory.createItem);
  const updateItem = useMutation(api.inventory.updateItem);
  const stockIn = useMutation(api.inventory.stockIn);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const recordWaste = useMutation(api.inventory.recordWaste);

  const selectedItem = useMemo(() => {
    if (!items || !selectedItemId) return null;
    return items.find((item) => item._id === selectedItemId) ?? null;
  }, [items, selectedItemId]);

  const filteredItems = useMemo(() => {
    let rows = [...(items ?? [])];
    if (stockFilter === 'Low Stock') rows = rows.filter((item) => item.isLowStock);
    if (stockFilter === 'Inactive') rows = rows.filter((item) => !item.isActive);

    rows.sort((a: any, b: any) => {
      if (!sortColumn) return 0;
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];
      if (sortColumn === 'updatedAt' || sortColumn === 'createdAt') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [items, stockFilter, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const selectAndOpen = (
    itemId: Id<'inventoryItems'>,
    modal: 'details' | 'edit' | 'stockIn' | 'adjust' | 'waste'
  ) => {
    setSelectedItemId(itemId);
    setMessage(null);
    if (modal === 'details') setShowDetailsModal(true);
    if (modal === 'edit') setShowEditModal(true);
    if (modal === 'stockIn') setShowStockInModal(true);
    if (modal === 'adjust') setShowAdjustModal(true);
    if (modal === 'waste') setShowWasteModal(true);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Inventory & Stock</h1>
          <p className="text-brand-text-muted mt-1">
            Full item-by-item stock tracking — every litre, kilogram, and bunch accounted for.
          </p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setMessage(null); }}
          className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Inventory Item
        </button>
      </div>

      {message && (
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} className="shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="shrink-0 mt-0.5" />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard icon={Boxes} label="Active Items" value={summary?.activeItems ?? 0} subtext={`${summary?.totalItems ?? 0} total items`} />
        <SummaryCard icon={AlertTriangle} label="Low Stock" value={summary?.lowStockCount ?? 0} subtext={`${summary?.outOfStockCount ?? 0} out of stock`} warning={(summary?.lowStockCount ?? 0) > 0} />
        <SummaryCard icon={TrendingUp} label="Stock Value" value={formatMoney(summary?.totalStockValue ?? 0)} subtext="Estimated inventory value" />
        <SummaryCard icon={ClipboardList} label="Inactive Items" value={summary?.inactiveItems ?? 0} subtext="Hidden from active ops" />
        <SummaryCard icon={Activity} label="Campus" value={campusFilter === 'All' ? 'All' : niceLabel(campusFilter)} subtext="Current filter" />
      </div>

      {(lowStock?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-amber-700" size={20} />
            <h2 className="font-semibold text-amber-900">Low Stock Alerts</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {lowStock?.slice(0, 6).map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => selectAndOpen(item._id, 'details')}
                className="text-left bg-white rounded-xl border border-amber-100 p-3 hover:border-amber-300 transition-colors"
              >
                <p className="font-semibold text-brand-text">{item.name}</p>
                <p className="text-sm text-brand-text-muted">Current: {formatNumber(item.currentStock)} {item.unit}</p>
                <p className="text-sm text-amber-700">Reorder at: {formatNumber(item.reorderLevel)} {item.unit}</p>
                <p className="text-xs text-brand-text-muted mt-1">Shortage: {formatNumber((item as any).shortage ?? 0)} {item.unit}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full xl:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search items — milk, flour, bananas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full xl:w-auto">
          <select value={campusFilter} onChange={(e) => setCampusFilter(e.target.value as CampusCode | 'All')} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text">
            <option value="All">All Campuses</option>
            {campuses.map((campus) => <option key={campus} value={campus}>{niceLabel(campus)}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as Category | 'All')} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text">
            <option value="All">All Categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as 'All' | 'Low Stock' | 'Active' | 'Inactive')} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text">
            <option value="Active">Active Only</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Inactive">Inactive</option>
            <option value="All">All Items</option>
          </select>
          <select value={movementFilter} onChange={(e) => setMovementFilter(e.target.value as MovementType | 'All')} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text" title="Movement filter for item details">
            <option value="All">All Movements</option>
            {movementTypes.map((type) => <option key={type} value={type}>{niceLabel(type)}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <SortableHeader label="Item" column="name" sortColumn={sortColumn} onSort={handleSort} />
                <th className="px-5 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Category</th>
                <th className="px-5 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Campus</th>
                <SortableHeader label="Stock" column="currentStock" sortColumn={sortColumn} onSort={handleSort} />
                <th className="px-5 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Flow</th>
                <SortableHeader label="Value" column="stockValue" sortColumn={sortColumn} onSort={handleSort} />
                <th className="px-5 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Status</th>
                <SortableHeader label="Last Updated" column="updatedAt" sortColumn={sortColumn} onSort={handleSort} />
                <th className="px-5 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items === undefined ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-brand-text-muted">Loading inventory...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-brand-text-muted">No inventory items found.</td></tr>
              ) : (
                filteredItems.map((item) => {
                  const pct = item.reorderLevel > 0
                    ? Math.min(100, Math.round((item.currentStock / (item.reorderLevel * 3)) * 100))
                    : item.currentStock > 0 ? 100 : 0;
                  const barColor = item.isLowStock ? 'bg-amber-400' : 'bg-emerald-400';

                  return (
                    <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <button type="button" onClick={() => selectAndOpen(item._id, 'details')} className="flex items-center gap-3 text-left group">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-brand-primary/20 group-hover:text-brand-primary shrink-0">
                            <Package size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-brand-text group-hover:text-brand-primary group-hover:underline">{item.name}</p>
                            <p className="text-xs text-brand-text-muted">per {item.unit}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">{item.category}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-brand-text-muted">{niceLabel(item.campusCode)}</td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-brand-text">{formatNumber(item.currentStock)} <span className="text-xs font-normal text-brand-text-muted">{item.unit}</span></p>
                        <p className="text-xs text-brand-text-muted">reorder @ {formatNumber(item.reorderLevel)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="w-24">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-brand-text-muted mt-1">{pct}% full</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-brand-text">{formatMoney(item.stockValue ?? 0)}</p>
                        <p className="text-xs text-brand-text-muted">avg {formatMoney(item.averageUnitCost ?? 0)}/{item.unit}</p>
                      </td>
                      <td className="px-5 py-4"><StatusBadge isActive={item.isActive} isLowStock={item.isLowStock} /></td>
                      <td className="px-5 py-4 text-xs text-brand-text-muted">{formatDate(item.updatedAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button onClick={() => selectAndOpen(item._id, 'details')} className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-brand-text text-xs font-semibold hover:bg-gray-200 inline-flex items-center gap-1">
                            <Eye size={13} /> Ledger
                          </button>
                          <button onClick={() => selectAndOpen(item._id, 'stockIn')} className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100">In</button>
                          <button onClick={() => selectAndOpen(item._id, 'adjust')} className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100">Adjust</button>
                          <button onClick={() => selectAndOpen(item._id, 'waste')} className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100">Waste</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
          <p className="text-sm text-brand-text-muted">
            Showing {filteredItems.length} item{filteredItems.length === 1 ? '' : 's'} — click any row to open its full stock ledger
          </p>
        </div>
      </div>

      {showAddModal && <AddItemModal onClose={() => setShowAddModal(false)} actor={actor} createItem={createItem} setMessage={setMessage} />}
      {showEditModal && selectedItem && <EditItemModal item={selectedItem} actor={actor} updateItem={updateItem} onClose={() => setShowEditModal(false)} setMessage={setMessage} />}
      {showStockInModal && selectedItem && <StockInModal item={selectedItem} actor={actor} stockIn={stockIn} onClose={() => setShowStockInModal(false)} setMessage={setMessage} />}
      {showAdjustModal && selectedItem && <AdjustStockModal item={selectedItem} actor={actor} adjustStock={adjustStock} onClose={() => setShowAdjustModal(false)} setMessage={setMessage} />}
      {showWasteModal && selectedItem && <WasteModal item={selectedItem} actor={actor} recordWaste={recordWaste} onClose={() => setShowWasteModal(false)} setMessage={setMessage} />}

      {showDetailsModal && selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          ledger={itemLedger}
          movementFilter={movementFilter}
          setMovementFilter={setMovementFilter}
          onEdit={() => { setShowDetailsModal(false); setShowEditModal(true); }}
          onStockIn={() => { setShowDetailsModal(false); setShowStockInModal(true); }}
          onAdjust={() => { setShowDetailsModal(false); setShowAdjustModal(true); }}
          onWaste={() => { setShowDetailsModal(false); setShowWasteModal(true); }}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
}

// ─── Item Details Modal — full stock ledger ──────────────────────────────────

type LedgerTab = 'overview' | 'insights' | 'daily' | 'ledger';

function ItemDetailsModal({
  item,
  ledger,
  movementFilter,
  setMovementFilter,
  onEdit,
  onStockIn,
  onAdjust,
  onWaste,
  onClose,
}: {
  item: any;
  ledger: any;
  movementFilter: MovementType | 'All';
  setMovementFilter: (value: MovementType | 'All') => void;
  onEdit: () => void;
  onStockIn: () => void;
  onAdjust: () => void;
  onWaste: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<LedgerTab>('overview');

  const s = ledger?.summary;
  const movements: any[] = ledger?.movements ?? [];
  const unit = s?.unit || item.unit;

  // Compute running balance (movements come desc, so reverse → forward → reverse back)
  const movementsWithBalance = useMemo(() => {
    if (!movements.length) return [];
    const chronological = [...movements].reverse();
    let running = 0;
    const withBalance = chronological.map((m) => {
      running += m.signedQuantity ?? m.quantity ?? 0;
      return { ...m, runningBalance: running };
    });
    return withBalance.reverse();
  }, [movements]);

  // Group by day for daily usage tab
  const dailyGroups = useMemo(() => {
    if (!movements.length) return [];
    const groups: Record<string, { date: string; movements: any[]; totalIn: number; totalOut: number; net: number }> = {};
    movements.forEach((m) => {
      const dateKey = new Date(m.createdAt).toLocaleDateString('en-KE', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      });
      if (!groups[dateKey]) groups[dateKey] = { date: dateKey, movements: [], totalIn: 0, totalOut: 0, net: 0 };
      groups[dateKey].movements.push(m);
      const qty = m.signedQuantity ?? m.quantity ?? 0;
      if (qty > 0) groups[dateKey].totalIn += qty;
      else groups[dateKey].totalOut += Math.abs(qty);
      groups[dateKey].net += qty;
    });
    return Object.values(groups);
  }, [movements]);

  // Filter for ledger tab
  const visibleMovements = movementFilter === 'All'
    ? movementsWithBalance
    : movementsWithBalance.filter((m) => m.movementType === movementFilter);

  const stockPct = s?.reorderLevel > 0
    ? Math.min(100, Math.round(((s?.remainingStock ?? item.currentStock) / (s?.reorderLevel * 3)) * 100))
    : (s?.remainingStock ?? item.currentStock) > 0 ? 100 : 0;

  const totalIn = s?.totalReceived ?? 0;
  const totalOut = s?.totalUsed ?? 0;
  const remaining = s?.remainingStock ?? item.currentStock;

  const inPct = (totalIn + totalOut) > 0 ? Math.round((totalIn / (totalIn + totalOut)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-brand-navy via-slate-800 to-slate-900 p-6 text-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Stock Ledger</span>
                <span className="text-white/30">·</span>
                <span className="text-xs text-white/50">{item.category}</span>
                <span className="text-white/30">·</span>
                <span className="text-xs text-white/50">{niceLabel(item.campusCode)}</span>
              </div>
              <h2 className="text-2xl font-bold truncate">{item.name}</h2>
              <p className="text-sm text-white/60 mt-1">Tracked in <strong className="text-white/80">{unit}</strong> · Last updated {formatDate(item.updatedAt)}</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white shrink-0">
              <X size={20} />
            </button>
          </div>

          {/* ── 3-number flow ── */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/30 p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownCircle size={14} className="text-emerald-400" />
                <p className="text-xs text-emerald-300 font-semibold uppercase tracking-wide">Total Received</p>
              </div>
              <p className="text-xl font-bold">{formatNumber(totalIn)}</p>
              <p className="text-xs text-white/50">{unit} received ever</p>
            </div>
            <div className="rounded-xl bg-red-500/20 border border-red-400/30 p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpCircle size={14} className="text-red-400" />
                <p className="text-xs text-red-300 font-semibold uppercase tracking-wide">Total Used / Out</p>
              </div>
              <p className="text-xl font-bold">{formatNumber(totalOut)}</p>
              <p className="text-xs text-white/50">{unit} consumed / removed</p>
            </div>
            <div className={`rounded-xl border p-4 ${item.isLowStock ? 'bg-amber-500/20 border-amber-400/30' : 'bg-white/10 border-white/10'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Package size={14} className={item.isLowStock ? 'text-amber-300' : 'text-white/60'} />
                <p className={`text-xs font-semibold uppercase tracking-wide ${item.isLowStock ? 'text-amber-300' : 'text-white/60'}`}>Balance Remaining</p>
              </div>
              <p className="text-xl font-bold">{formatNumber(remaining)}</p>
              <p className="text-xs text-white/50">{unit} in stock now</p>
            </div>
          </div>

          {/* ── progress bar ── */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>Stock level</span>
              <span>{stockPct}% of safe level</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${item.isLowStock ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${stockPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/40 mt-1">
              <span>0</span>
              <span>Reorder @ {formatNumber(item.reorderLevel)} {unit}</span>
              <span>Safe level</span>
            </div>
          </div>

          {/* ── tabs ── */}
          <div className="flex gap-1 mt-5">
            {([
              { id: 'overview', label: 'Overview', icon: Layers },
              { id: 'insights', label: 'Insights', icon: Lightbulb },
              { id: 'daily', label: 'Daily Usage', icon: Calendar },
              { id: 'ledger', label: 'Full Ledger', icon: History },
            ] as { id: LedgerTab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === id
                    ? 'bg-white text-brand-navy'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Quick actions bar ── */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0 flex-wrap">
          <span className="text-xs text-brand-text-muted font-medium mr-1">Quick actions:</span>
          <button onClick={onEdit} className="px-3 py-1.5 rounded-lg bg-gray-100 text-brand-text text-xs font-semibold hover:bg-gray-200 inline-flex items-center gap-1.5">
            <Edit3 size={13} /> Edit Item
          </button>
          <button onClick={onStockIn} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 inline-flex items-center gap-1.5">
            <ArrowDownCircle size={13} /> Stock In
          </button>
          <button onClick={onAdjust} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100">Adjust Stock</button>
          <button onClick={onWaste} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 inline-flex items-center gap-1.5">
            <Trash2 size={13} /> Record Waste
          </button>
          <div className="ml-auto text-xs text-brand-text-muted">{s?.movementCount ?? 0} total movement records</div>
        </div>

        {/* ── Tab content ── */}
        <div className="overflow-y-auto flex-1">
          {ledger === undefined ? (
            <div className="flex items-center justify-center h-48 text-brand-text-muted">
              <RefreshCcw size={18} className="animate-spin mr-2" /> Loading ledger...
            </div>
          ) : (
            <>
              {tab === 'overview' && <OverviewTab item={item} s={s} unit={unit} />}
              {tab === 'insights' && <InsightsTab movements={movements} unit={unit} item={item} />}
              {tab === 'daily' && <DailyUsageTab dailyGroups={dailyGroups} unit={unit} />}
              {tab === 'ledger' && (
                <LedgerTab
                  movements={visibleMovements}
                  movementFilter={movementFilter}
                  setMovementFilter={setMovementFilter}
                  unit={unit}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ item, s, unit }: { item: any; s: any; unit: string }) {
  if (!s) return <div className="p-6 text-brand-text-muted text-sm">No summary data available.</div>;

  return (
    <div className="p-6 space-y-6">
      {s.isLowStock && item.isActive && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-start gap-3">
          <AlertTriangle size={20} className="shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="text-sm font-bold">Below reorder level — restock soon</p>
            <p className="text-sm mt-0.5">
              {formatNumber(s.remainingStock)} {unit} remaining · reorder level is {formatNumber(item.reorderLevel)} {unit}
            </p>
          </div>
        </div>
      )}

      {/* Inbound breakdown */}
      <section>
        <h3 className="text-sm font-bold text-brand-text mb-3 flex items-center gap-2">
          <ArrowDownCircle size={16} className="text-emerald-600" /> What came in
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FlowCard label="Stock In (Purchased)" value={`${formatNumber(s.purchasedStockIn ?? 0)} ${unit}`} tone="success" />
          <FlowCard label="Receipt In" value={`${formatNumber(s.receiptIn ?? 0)} ${unit}`} tone="success" />
          <FlowCard label="Leftover Returned" value={`${formatNumber(s.leftoverReturned ?? 0)} ${unit}`} tone="success" />
          <FlowCard label="Total Inbound" value={`${formatNumber(s.totalReceived ?? 0)} ${unit}`} tone="success" bold />
        </div>
      </section>

      {/* Outbound breakdown */}
      <section>
        <h3 className="text-sm font-bold text-brand-text mb-3 flex items-center gap-2">
          <ArrowUpCircle size={16} className="text-red-500" /> What went out
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FlowCard label="Kitchen Used" value={`${formatNumber(s.kitchenUsed ?? 0)} ${unit}`} tone="danger" />
          <FlowCard label="Dispatched Out" value={`${formatNumber(s.dispatchedOut ?? 0)} ${unit}`} tone="danger" />
          <FlowCard label="Waste / Spoilage" value={`${formatNumber(s.wasted ?? 0)} ${unit}`} tone="danger" />
          <FlowCard label="Total Outbound" value={`${formatNumber(s.totalUsed ?? 0)} ${unit}`} tone="danger" bold />
        </div>
      </section>

      {/* Balance & cost */}
      <section>
        <h3 className="text-sm font-bold text-brand-text mb-3 flex items-center gap-2">
          <Package size={16} className="text-brand-text-muted" /> Balance & cost
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FlowCard label="Remaining Stock" value={`${formatNumber(s.remainingStock)} ${unit}`} tone={s.isLowStock ? 'warning' : 'default'} bold />
          <FlowCard label="Stock Value" value={formatMoney(s.stockValue ?? 0)} tone="default" />
          <FlowCard label="Average Cost" value={`${formatMoney(s.averageUnitCost ?? 0)} / ${unit}`} tone="default" />
          <FlowCard label="Last Purchase Cost" value={`${formatMoney(s.lastUnitCost ?? 0)} / ${unit}`} tone="default" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <FlowCard label="Reorder Level" value={`${formatNumber(item.reorderLevel)} ${unit}`} tone="default" />
          <FlowCard label="Net Adjustments" value={`${s.netAdjustments >= 0 ? '+' : ''}${formatNumber(s.netAdjustments)} ${unit}`} tone="default" />
          <FlowCard label="Last Purchase" value={formatDateShort(s.lastPurchaseDate)} tone="default" />
          <FlowCard label="Total Movements" value={s.movementCount ?? 0} tone="default" />
        </div>
      </section>

      {/* Visual waterfall */}
    </div>
  );
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────

function InsightsTab({ movements, unit, item }: { movements: any[]; unit: string; item: any }) {
  // Partition movements by role
  const dispatched = movements.filter((m) =>
    m.movementType === 'DISPATCH_OUT' || m.movementType === 'KITCHEN_ISSUE'
  );
  const returned = movements.filter((m) => m.movementType === 'LEFTOVER_RETURN');
  const wasted = movements.filter((m) => m.movementType === 'WASTE');
  const stockIns = movements.filter((m) =>
    m.movementType === 'STOCK_IN' || m.movementType === 'RECEIPT_IN'
  );
  const adjustments = movements.filter((m) => m.movementType === 'ADJUSTMENT');

  const totalDispatched = dispatched.reduce((s, m) => s + Math.abs(m.signedQuantity ?? m.quantity ?? 0), 0);
  const totalReturned = returned.reduce((s, m) => s + Math.abs(m.signedQuantity ?? m.quantity ?? 0), 0);
  const totalWasted = wasted.reduce((s, m) => s + Math.abs(m.signedQuantity ?? m.quantity ?? 0), 0);
  const netConsumed = totalDispatched - totalReturned;

  // All events sorted chronologically (oldest first) for the event log
  const timeline = [...movements].reverse();

  return (
    <div className="p-6 space-y-8">

      {/* ── Dispatch & Return transparency ── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <LogOut size={16} className="text-red-500" />
          <h3 className="text-sm font-bold text-brand-text">What left the store</h3>
        </div>
        <p className="text-xs text-brand-text-muted mb-4">
          Everything issued or dispatched out of this store, and how much came back.
        </p>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-1">Sent Out</p>
            <p className="text-xl font-bold text-red-800">{formatNumber(totalDispatched)}</p>
            <p className="text-xs text-red-600 mt-0.5">{unit} dispatched / issued</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1">Returned</p>
            <p className="text-xl font-bold text-emerald-800">{formatNumber(totalReturned)}</p>
            <p className="text-xs text-emerald-600 mt-0.5">{unit} came back as leftover</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Net Consumed</p>
            <p className="text-xl font-bold text-brand-text">{formatNumber(netConsumed)}</p>
            <p className="text-xs text-brand-text-muted mt-0.5">{unit} actually used</p>
          </div>
        </div>

        {/* Outbound list */}
        {dispatched.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-5 py-6 text-center text-sm text-brand-text-muted">
            No dispatch or kitchen issue records yet.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
              <LogOut size={13} className="text-red-500" />
              <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Outbound movements ({dispatched.length})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {dispatched.map((m) => {
                const qty = Math.abs(m.signedQuantity ?? m.quantity ?? 0);
                return (
                  <div key={m._id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                        <LogOut size={11} className="text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${movementTone(m.movementType)}`}>
                            {niceLabel(m.movementType)}
                          </span>
                          <span className="text-sm font-bold text-red-700">−{formatNumber(qty)} {unit}</span>
                        </div>
                        {m.notes && <p className="text-xs text-brand-text-muted mt-1">{m.notes}</p>}
                        {(m.purchaseBatchNumber || m.orderNumber) && (
                          <p className="text-xs text-brand-text-muted mt-0.5">
                            Ref: {m.purchaseBatchNumber || m.orderNumber}
                          </p>
                        )}
                        {m.createdByName && (
                          <p className="text-xs text-brand-text-muted mt-0.5">By {m.createdByName}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-brand-text-muted">{formatDateShort(m.createdAt)}</p>
                      <p className="text-xs text-brand-text-muted">{formatTime(m.createdAt)}</p>
                      <p className="text-xs text-brand-text-muted mt-1">{formatMoney(Math.abs(m.totalCost ?? 0))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Returns log ── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <CornerDownLeft size={16} className="text-emerald-600" />
          <h3 className="text-sm font-bold text-brand-text">What was returned</h3>
        </div>
        <p className="text-xs text-brand-text-muted mb-4">
          Leftover stock that came back to store after dispatch or meal service.
        </p>

        {returned.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-5 py-6 text-center text-sm text-brand-text-muted">
            No returns recorded yet.
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-100 overflow-hidden">
            <div className="bg-emerald-50/60 px-4 py-2.5 border-b border-emerald-100 flex items-center gap-2">
              <CornerDownLeft size={13} className="text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Returns ({returned.length})</p>
            </div>
            <div className="divide-y divide-gray-50">
              {returned.map((m) => {
                const qty = Math.abs(m.signedQuantity ?? m.quantity ?? 0);
                return (
                  <div key={m._id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                        <CornerDownLeft size={11} className="text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-emerald-700">+{formatNumber(qty)} {unit} returned</span>
                        {m.notes && <p className="text-xs text-brand-text-muted mt-1">{m.notes}</p>}
                        {m.createdByName && <p className="text-xs text-brand-text-muted mt-0.5">By {m.createdByName}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-brand-text-muted">{formatDateShort(m.createdAt)}</p>
                      <p className="text-xs text-brand-text-muted">{formatTime(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Waste log ── */}
      {wasted.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Trash2 size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-brand-text">Waste & spoilage</h3>
          </div>
          <p className="text-xs text-brand-text-muted mb-4">
            {formatNumber(totalWasted)} {unit} recorded as wasted or spoiled across {wasted.length} event{wasted.length !== 1 ? 's' : ''}.
          </p>
          <div className="rounded-xl border border-orange-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {wasted.map((m) => {
                const qty = Math.abs(m.signedQuantity ?? m.quantity ?? 0);
                return (
                  <div key={m._id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-6 h-6 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                        <Trash2 size={11} className="text-orange-500" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-orange-700">{formatNumber(qty)} {unit} wasted</span>
                        {m.notes && <p className="text-xs text-brand-text-muted mt-1">{m.notes}</p>}
                        {m.createdByName && <p className="text-xs text-brand-text-muted mt-0.5">By {m.createdByName}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-brand-text-muted">{formatDateShort(m.createdAt)}</p>
                      <p className="text-xs text-red-600 font-semibold mt-0.5">−{formatMoney(Math.abs(m.totalCost ?? 0))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Adjustments log ── */}
      {adjustments.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Info size={16} className="text-blue-500" />
            <h3 className="text-sm font-bold text-brand-text">Manual adjustments</h3>
          </div>
          <p className="text-xs text-brand-text-muted mb-4">
            Stock corrections made outside of normal purchase or usage flows. Each requires a written reason for full transparency.
          </p>
          <div className="rounded-xl border border-blue-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {adjustments.map((m) => {
                const qty = m.signedQuantity ?? m.quantity ?? 0;
                const positive = qty >= 0;
                return (
                  <div key={m._id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-6 h-6 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <Minus size={11} className="text-blue-500" />
                      </div>
                      <div>
                        <span className={`text-sm font-bold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                          {positive ? '+' : ''}{formatNumber(qty)} {unit} adjustment
                        </span>
                        {m.notes && <p className="text-xs text-brand-text-muted mt-1">Reason: {m.notes}</p>}
                        {m.createdByName && <p className="text-xs text-brand-text-muted mt-0.5">By {m.createdByName}</p>}
                      </div>
                    </div>
                    <p className="text-xs text-brand-text-muted shrink-0">{formatDateShort(m.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Full event log ── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <History size={16} className="text-brand-text-muted" />
          <h3 className="text-sm font-bold text-brand-text">Event log</h3>
        </div>
        <p className="text-xs text-brand-text-muted mb-4">
          Every recorded event for this item — oldest to newest — with a plain-language summary of what happened.
        </p>

        {timeline.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-5 py-6 text-center text-sm text-brand-text-muted">
            No events recorded yet.
          </div>
        ) : (
          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-200" />
            <div className="space-y-0">
              {timeline.map((m, i) => {
                const qty = m.signedQuantity ?? m.quantity ?? 0;
                const absQty = Math.abs(qty);
                const isFirst = i === 0;
                const isLast = i === timeline.length - 1;

                // Narrative sentence
                const narrative = buildNarrative(m, absQty, unit);
                const dotColor = isInbound(m.movementType)
                  ? 'bg-emerald-500 border-emerald-200'
                  : isOutbound(m.movementType)
                  ? 'bg-red-400 border-red-200'
                  : m.movementType === 'LEFTOVER_RETURN'
                  ? 'bg-emerald-300 border-emerald-100'
                  : 'bg-blue-400 border-blue-100';

                return (
                  <div key={m._id} className="relative flex gap-4 pb-5">
                    {/* dot */}
                    <div className={`relative z-10 w-[38px] shrink-0 flex items-start justify-center pt-1`}>
                      <div className={`w-4 h-4 rounded-full border-2 border-white ring-1 ${dotColor}`} />
                    </div>

                    {/* content */}
                    <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-brand-text">{narrative}</p>
                          {m.notes && m.notes !== narrative && (
                            <p className="text-xs text-brand-text-muted mt-1 italic">"{m.notes}"</p>
                          )}
                          {(m.purchaseBatchNumber || m.orderNumber) && (
                            <p className="text-xs text-brand-text-muted mt-1">
                              Ref: <span className="font-medium">{m.purchaseBatchNumber || m.orderNumber}</span>
                            </p>
                          )}
                          {m.createdByName && (
                            <p className="text-xs text-brand-text-muted mt-0.5">Recorded by {m.createdByName}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium text-brand-text-muted">{formatDateShort(m.createdAt)}</p>
                          <p className="text-xs text-brand-text-muted">{formatTime(m.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function buildNarrative(m: any, absQty: number, unit: string): string {
  const qty = `${formatNumber(absQty)} ${unit}`;
  switch (m.movementType) {
    case 'STOCK_IN':
      return `${qty} received into store (stock in).`;
    case 'RECEIPT_IN':
      return `${qty} received from a purchase receipt.`;
    case 'DISPATCH_OUT':
      return `${qty} dispatched out of store.`;
    case 'KITCHEN_ISSUE':
      return `${qty} issued to kitchen for use.`;
    case 'WASTE':
      return `${qty} recorded as waste or spoilage.`;
    case 'LEFTOVER_RETURN':
      return `${qty} returned to store as leftover.`;
    case 'ADJUSTMENT':
      const signed = m.signedQuantity ?? m.quantity ?? 0;
      if (signed > 0) return `Stock corrected upward by ${qty} (manual adjustment).`;
      if (signed < 0) return `Stock corrected downward by ${qty} (manual adjustment).`;
      return `Stock verified and confirmed at current level (no change).`;
    default:
      return `${qty} — ${niceLabel(m.movementType)}.`;
  }
}

// ─── Daily Usage Tab ──────────────────────────────────────────────────────────

function DailyUsageTab({ dailyGroups, unit }: { dailyGroups: any[]; unit: string }) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  if (!dailyGroups.length) {
    return (
      <div className="p-6 text-center text-brand-text-muted text-sm py-16">
        No movement history recorded yet.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3">
      <p className="text-xs text-brand-text-muted mb-4">
        Every day that had stock movement — showing exactly what came in and what went out, sorted most recent first.
      </p>
      {dailyGroups.map((day) => {
        const isExpanded = expandedDay === day.date;
        const hasIn = day.totalIn > 0;
        const hasOut = day.totalOut > 0;
        const netPositive = day.net >= 0;

        return (
          <div key={day.date} className="border border-gray-100 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedDay(isExpanded ? null : day.date)}
              className="w-full flex items-center gap-4 px-5 py-4 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="shrink-0">
                <Calendar size={16} className="text-brand-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-text">{day.date}</p>
                <p className="text-xs text-brand-text-muted">{day.movements.length} movement{day.movements.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {hasIn && (
                  <div className="text-right">
                    <p className="text-xs text-emerald-600 font-semibold">+{formatNumber(day.totalIn)} {unit}</p>
                    <p className="text-xs text-brand-text-muted">in</p>
                  </div>
                )}
                {hasOut && (
                  <div className="text-right">
                    <p className="text-xs text-red-600 font-semibold">−{formatNumber(day.totalOut)} {unit}</p>
                    <p className="text-xs text-brand-text-muted">out</p>
                  </div>
                )}
                <div className="text-right min-w-[64px]">
                  <p className={`text-sm font-bold ${netPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                    {netPositive ? '+' : ''}{formatNumber(day.net)} {unit}
                  </p>
                  <p className="text-xs text-brand-text-muted">net</p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="divide-y divide-gray-50">
                {day.movements.map((m: any) => {
                  const qty = m.signedQuantity ?? m.quantity ?? 0;
                  const positive = qty >= 0;
                  return (
                    <div key={m._id} className="px-5 py-3 flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{movementIcon(m.movementType)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${movementTone(m.movementType)}`}>
                            {niceLabel(m.movementType)}
                          </span>
                          <span className={`text-xs font-bold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                            {positive ? '+' : ''}{formatNumber(qty)} {unit}
                          </span>
                        </div>
                        {m.notes && <p className="text-xs text-brand-text-muted mt-1">{m.notes}</p>}
                        {m.sourceLabel && m.sourceLabel !== m.notes && (
                          <p className="text-xs text-brand-text-muted mt-0.5">Source: {m.sourceLabel}</p>
                        )}
                      </div>
                      <p className="text-xs text-brand-text-muted shrink-0">{formatTime(m.createdAt)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Ledger Tab (full movement history with running balance) ──────────────────

function LedgerTab({
  movements,
  movementFilter,
  setMovementFilter,
  unit,
}: {
  movements: any[];
  movementFilter: MovementType | 'All';
  setMovementFilter: (v: MovementType | 'All') => void;
  unit: string;
}) {
  return (
    <div>
      {/* filter bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/30">
        <p className="text-sm text-brand-text-muted">
          {movements.length} record{movements.length !== 1 ? 's' : ''} shown
        </p>
        <select
          value={movementFilter}
          onChange={(e) => setMovementFilter(e.target.value as MovementType | 'All')}
          className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm"
        >
          <option value="All">All movement types</option>
          {movementTypes.map((type) => (
            <option key={type} value={type}>{niceLabel(type)}</option>
          ))}
        </select>
      </div>

      {!movements.length ? (
        <div className="px-6 py-16 text-center text-brand-text-muted text-sm">No movements match the selected filter.</div>
      ) : (
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Date & Time</th>
              <th className="px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Qty</th>
              <th className="px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Balance</th>
              <th className="px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Unit Cost</th>
              <th className="px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Total</th>
              <th className="px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Source / Notes</th>
              <th className="px-5 py-3 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Recorded by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {movements.map((m: any, idx) => {
              const qty = m.signedQuantity ?? m.quantity ?? 0;
              const positive = qty >= 0;
              const isAdj = m.movementType === 'ADJUSTMENT';

              return (
                <tr key={m._id} className={`hover:bg-gray-50/60 transition-colors ${idx === 0 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-5 py-3">
                    <p className="text-xs font-medium text-brand-text">{formatDateShort(m.createdAt)}</p>
                    <p className="text-xs text-brand-text-muted">{formatTime(m.createdAt)}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${movementTone(m.movementType)}`}>
                      {movementIcon(m.movementType)}
                      {niceLabel(m.movementType)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-sm font-bold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                      {positive ? '+' : ''}{formatNumber(qty)}
                    </span>
                    <span className="text-xs text-brand-text-muted ml-1">{unit}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm font-semibold text-brand-text">
                      {formatNumber(Math.max(0, m.runningBalance ?? 0))}
                    </span>
                    <span className="text-xs text-brand-text-muted ml-1">{unit}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-brand-text-muted">
                    {formatMoney(m.unitCost ?? 0)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-xs font-semibold ${positive ? 'text-emerald-700' : 'text-red-600'}`}>
                      {positive ? '+' : '−'}{formatMoney(Math.abs(m.totalCost ?? 0))}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs text-brand-text font-medium">
                      {m.purchaseBatchNumber || m.orderNumber || m.sourceLabel || '—'}
                    </p>
                    {m.notes && m.notes !== m.sourceLabel && (
                      <p className="text-xs text-brand-text-muted mt-0.5 max-w-xs truncate" title={m.notes}>{m.notes}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-brand-text-muted">
                    {m.createdByName || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlowCard({ label, value, tone = 'default', bold }: { label: string; value: string | number; tone?: 'default' | 'success' | 'danger' | 'warning'; bold?: boolean }) {
  const toneClass =
    tone === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
    tone === 'danger' ? 'bg-red-50 border-red-100 text-red-900' :
    tone === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-900' :
    'bg-gray-50 border-gray-100 text-brand-text';

  return (
    <div className={`border rounded-xl p-3 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-60 font-semibold">{label}</p>
      <p className={`mt-1 ${bold ? 'text-base font-bold' : 'text-sm font-semibold'}`}>{value}</p>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, subtext, warning }: { icon: any; label: string; value: string | number; subtext: string; warning?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-brand-text-muted">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${warning ? 'text-amber-700' : 'text-brand-text'}`}>{value}</p>
          <p className="text-xs text-brand-text-muted mt-1">{subtext}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${warning ? 'bg-amber-50 text-amber-700' : 'bg-brand-primary/20 text-brand-primary'}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function SortableHeader({ label, column, sortColumn, onSort }: { label: string; column: string; sortColumn: string | null; onSort: (column: string) => void }) {
  return (
    <th className="px-5 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
      <button type="button" className="flex items-center gap-2 cursor-pointer hover:text-brand-text" onClick={() => onSort(column)}>
        {label}
        <ArrowUpDown size={14} className={sortColumn === column ? 'text-brand-primary' : ''} />
      </button>
    </th>
  );
}

function StatusBadge({ isActive, isLowStock }: { isActive: boolean; isLowStock: boolean }) {
  if (!isActive) return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">Inactive</span>;
  if (isLowStock) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
      <AlertTriangle size={12} /> Low Stock
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
      <CheckCircle2 size={12} /> In Stock
    </span>
  );
}

function ModalShell({ title, children, onClose, maxWidth = 'max-w-xl' }: { title: string; children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`bg-white rounded-2xl p-6 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-brand-text">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Action modals ────────────────────────────────────────────────────────────

function AddItemModal({ onClose, actor, createItem, setMessage }: any) {
  const [form, setForm] = useState({
    name: '', category: 'LUNCH' as Category, unit: 'pcs', campusCode: 'MAIN_SCHOOL' as CampusCode,
    currentStock: '0', reorderLevel: '10', averageUnitCost: '0', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await createItem({ name: form.name, category: form.category, unit: form.unit, campusCode: form.campusCode, currentStock: Number(form.currentStock), reorderLevel: Number(form.reorderLevel), averageUnitCost: Number(form.averageUnitCost), actor, notes: form.notes || undefined });
      setMessage({ type: 'success', text: 'Inventory item created successfully.' });
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to create inventory item.' });
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Add Inventory Item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Item Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v as Category })} options={categories} />
          <Select label="Campus" value={form.campusCode} onChange={(v) => setForm({ ...form, campusCode: v as CampusCode })} options={campuses} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Unit (kg, litres, pcs, bunches...)" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="kg, litres, pcs, bunches..." required />
          <Input label="Opening Stock" type="number" value={form.currentStock} onChange={(v) => setForm({ ...form, currentStock: v })} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={(v) => setForm({ ...form, reorderLevel: v })} required />
          <Input label="Average Unit Cost (KES)" type="number" value={form.averageUnitCost} onChange={(v) => setForm({ ...form, averageUnitCost: v })} required />
        </div>
        <TextArea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Create Item" />
      </form>
    </ModalShell>
  );
}

function EditItemModal({ item, actor, updateItem, onClose, setMessage }: any) {
  const [form, setForm] = useState({
    name: item.name, category: item.category as Category, unit: item.unit,
    reorderLevel: String(item.reorderLevel ?? 0), isActive: item.isActive ? 'active' : 'inactive',
    notes: 'Inventory item details updated',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateItem({ inventoryItemId: item._id, name: form.name, category: form.category, unit: form.unit, reorderLevel: Number(form.reorderLevel), isActive: form.isActive === 'active', actor, notes: form.notes || undefined });
      setMessage({ type: 'success', text: 'Inventory item updated.' });
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to update.' });
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Edit: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Item Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v as Category })} options={categories} />
          <Select label="Status" value={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} options={['active', 'inactive']} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} required />
          <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={(v) => setForm({ ...form, reorderLevel: v })} required />
        </div>
        <TextArea label="Reason / Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Save Changes" />
      </form>
    </ModalShell>
  );
}

function StockInModal({ item, actor, stockIn, onClose, setMessage }: any) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState(String(item.lastUnitCost || item.averageUnitCost || 0));
  const [notes, setNotes] = useState('Manual stock in');
  const [saving, setSaving] = useState(false);

  const preview = Number(quantity) > 0 ? `New stock will be ${formatNumber(item.currentStock + Number(quantity))} ${item.unit}` : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await stockIn({ inventoryItemId: item._id, quantity: Number(quantity), unitCost: Number(unitCost), actor, notes: notes || undefined });
      setMessage({ type: 'success', text: `Stock added. ${item.name} now has ${formatNumber(item.currentStock + Number(quantity))} ${item.unit}.` });
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to add stock.' });
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Stock In: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-brand-text-muted">
          Current stock: <strong className="text-brand-text">{formatNumber(item.currentStock)} {item.unit}</strong>
          {preview && <span className="ml-2 text-emerald-700">→ {preview}</span>}
        </div>
        <Input label={`Quantity Received (${item.unit})`} type="number" value={quantity} onChange={setQuantity} required />
        <Input label={`Unit Cost per ${item.unit} (KES)`} type="number" value={unitCost} onChange={setUnitCost} required />
        {Number(quantity) > 0 && Number(unitCost) > 0 && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2 text-sm text-emerald-800">
            Total cost: <strong>{formatMoney(Number(quantity) * Number(unitCost))}</strong>
          </div>
        )}
        <TextArea label="Reason / Notes" value={notes} onChange={setNotes} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Add Stock" />
      </form>
    </ModalShell>
  );
}

function AdjustStockModal({ item, actor, adjustStock, onClose, setMessage }: any) {
  const [newStock, setNewStock] = useState(String(item.currentStock));
  const [notes, setNotes] = useState('Manual stock count correction');
  const [saving, setSaving] = useState(false);

  const diff = Number(newStock) - item.currentStock;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const confirmed = window.confirm(`Set ${item.name} stock from ${item.currentStock} to ${newStock} ${item.unit}?`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await adjustStock({ inventoryItemId: item._id, newStock: Number(newStock), actor, notes });
      setMessage({ type: 'success', text: 'Stock adjusted successfully.' });
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to adjust stock.' });
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Adjust Stock: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-brand-text-muted">
          Current stock: <strong className="text-brand-text">{formatNumber(item.currentStock)} {item.unit}</strong>
          {Number(newStock) !== item.currentStock && (
            <span className={`ml-2 font-semibold ${diff >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {diff >= 0 ? '+' : ''}{formatNumber(diff)} {item.unit}
            </span>
          )}
        </div>
        <Input label={`New Exact Stock (${item.unit})`} type="number" value={newStock} onChange={setNewStock} required />
        <TextArea label="Required Reason" value={notes} onChange={setNotes} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Save Adjustment" />
      </form>
    </ModalShell>
  );
}

function WasteModal({ item, actor, recordWaste, onClose, setMessage }: any) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('Spoilage / waste recorded');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const confirmed = window.confirm(`Record ${quantity} ${item.unit} of ${item.name} as waste? This will deduct from stock.`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await recordWaste({ inventoryItemId: item._id, quantity: Number(quantity), actor, notes });
      setMessage({ type: 'success', text: 'Waste recorded.' });
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to record waste.' });
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Record Waste: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-800">
          Current stock: <strong>{formatNumber(item.currentStock)} {item.unit}</strong> — waste will deduct from this.
        </div>
        <Input label={`Waste Quantity (${item.unit})`} type="number" value={quantity} onChange={setQuantity} required />
        <TextArea label="Required Reason" value={notes} onChange={setNotes} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Record Waste" danger />
      </form>
    </ModalShell>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Input({ label, value, onChange, type = 'text', placeholder, required }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">{label}</label>
      <input type={type} required={required} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
    </div>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
        {options.map((o: string) => <option key={o} value={o}>{niceLabel(o)}</option>)}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
    </div>
  );
}

function ModalActions({ onClose, saving, submitLabel, danger }: any) {
  return (
    <div className="flex justify-end gap-3 pt-4">
      <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
      <button type="submit" disabled={saving} className={`px-4 py-2 rounded-lg font-bold inline-flex items-center gap-2 disabled:opacity-60 ${danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-brand-primary text-brand-navy hover:bg-brand-primary-hover'}`}>
        {saving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}