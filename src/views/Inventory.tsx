import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Package,
  Activity,
  RefreshCcw,
  X,
  Save,
  History,
  Edit3,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Minus,
  Lightbulb,
  CornerDownLeft,
  LogOut,
  Layers,
  Info,
  ArrowUpDown,
  FolderOpen,
  Folder,
} from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type CampusCode = 'MAIN_SCHOOL' | 'DIGITAL_SCHOOL';
type Category = 'LUNCH' | 'SNACK' | 'DRINK' | 'FRUIT' | 'TEA' | 'SUPPLY' | 'OTHER';
type MovementType =
  | 'STOCK_IN'
  | 'DISPATCH_OUT'
  | 'RECEIPT_IN'
  | 'ADJUSTMENT'
  | 'KITCHEN_ISSUE'
  | 'WASTE'
  | 'LEFTOVER_RETURN';

const categories: Category[] = ['LUNCH', 'TEA', 'SNACK', 'FRUIT', 'DRINK', 'SUPPLY', 'OTHER'];
const campuses: CampusCode[] = ['MAIN_SCHOOL', 'DIGITAL_SCHOOL'];
const movementTypes: MovementType[] = [
  'STOCK_IN', 'DISPATCH_OUT', 'RECEIPT_IN', 'ADJUSTMENT', 'KITCHEN_ISSUE', 'WASTE', 'LEFTOVER_RETURN',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

function movementTone(type: MovementType) {
  if (['STOCK_IN', 'RECEIPT_IN', 'LEFTOVER_RETURN'].includes(type)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['WASTE', 'DISPATCH_OUT', 'KITCHEN_ISSUE'].includes(type)) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function isInbound(type: string) {
  return ['STOCK_IN', 'RECEIPT_IN', 'LEFTOVER_RETURN'].includes(type);
}

function isOutbound(type: string) {
  return ['DISPATCH_OUT', 'KITCHEN_ISSUE', 'WASTE'].includes(type);
}

function movementIcon(type: MovementType) {
  if (isInbound(type)) return <ArrowDownCircle size={13} className="text-emerald-600" />;
  if (isOutbound(type)) return <ArrowUpCircle size={13} className="text-red-500" />;
  return <Minus size={13} className="text-blue-500" />;
}

// Stock fill percentage & colour helpers
function stockPct(item: any) {
  if (!item.reorderLevel || item.reorderLevel === 0) return item.currentStock > 0 ? 100 : 0;
  return Math.min(100, Math.round((item.currentStock / (item.reorderLevel * 3)) * 100));
}

function stockBarColor(item: any) {
  if (!item.isActive) return 'bg-gray-300';
  if (item.currentStock === 0) return 'bg-red-500';
  if (item.isLowStock) return 'bg-amber-400';
  return 'bg-emerald-400';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Inventory() {
  const { user } = useAuth();
  const defaultCampus = userCampusToInventoryCampus(user?.school);
  const actor = user?.name || user?.email || 'Unknown user';

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [campusFilter, setCampusFilter] = useState<CampusCode | 'All'>(defaultCampus || 'All');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'All'>('All');
  const [movementFilter, setMovementFilter] = useState<MovementType | 'All'>('All');

  // Selection
  const [selectedItemId, setSelectedItemId] = useState<Id<'inventoryItems'> | null>(null);

  // Sidebar folder collapse (by category)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const toggleCategory = (cat: string) =>
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Queries
  const items = useQuery(api.inventory.listItems, {
    campusCode: campusFilter === 'All' ? undefined : campusFilter,
    category: categoryFilter === 'All' ? undefined : categoryFilter,
    activeOnly: true,
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

  // Mutations
  const createItem = useMutation(api.inventory.createItem);
  const updateItem = useMutation(api.inventory.updateItem);
  const stockIn = useMutation(api.inventory.stockIn);
  const adjustStock = useMutation(api.inventory.adjustStock);
  const recordWaste = useMutation(api.inventory.recordWaste);

  const selectedItem = useMemo(() => {
    if (!items || !selectedItemId) return null;
    return items.find((item) => item._id === selectedItemId) ?? null;
  }, [items, selectedItemId]);

  // Group items by category for the sidebar "folders"
  const groupedItems = useMemo(() => {
    if (!items) return {};
    return items.reduce<Record<string, typeof items>>((acc, item) => {
      const cat = item.category || 'OTHER';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [items]);

  const openAction = (modal: 'edit' | 'stockIn' | 'adjust' | 'waste') => {
    setMessage(null);
    if (modal === 'edit') setShowEditModal(true);
    if (modal === 'stockIn') setShowStockInModal(true);
    if (modal === 'adjust') setShowAdjustModal(true);
    if (modal === 'waste') setShowWasteModal(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F8FAFC]">

      {/* ── Top bar ── */}
      <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-navy rounded-lg flex items-center justify-center">
            <Layers size={16} className="text-brand-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-brand-text leading-none">Inventory & Stock</h1>
            <p className="text-[10px] text-brand-text-muted mt-0.5">Every litre, kilogram, and bunch accounted for</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Summary pills */}
          {summary && (
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-brand-text-muted font-medium">
                {summary.activeItems} items
              </span>
              {(summary.lowStockCount ?? 0) > 0 && (
                <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 font-semibold flex items-center gap-1">
                  <AlertTriangle size={11} /> {summary.lowStockCount} low stock
                </span>
              )}
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-semibold">
                {formatMoney(summary.totalStockValue ?? 0)}
              </span>
            </div>
          )}

          {/* Campus filter */}
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value as CampusCode | 'All')}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-brand-text"
          >
            <option value="All">All Campuses</option>
            {campuses.map((c) => <option key={c} value={c}>{niceLabel(c)}</option>)}
          </select>

          <button
            onClick={() => { setShowAddModal(true); setMessage(null); }}
            className="px-3 py-1.5 bg-brand-primary text-brand-navy rounded-xl text-xs font-bold hover:bg-brand-primary-hover transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>
      </header>

      {/* ── Main 3-column layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT SIDEBAR: Item Explorer ─────────────────────────────────── */}
        <aside className="w-72 border-r border-gray-100 bg-white flex flex-col shrink-0 overflow-hidden">

          {/* Search + category filter */}
          <div className="p-3 border-b border-gray-100 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider">Pantry Items</span>
              <span className="text-[10px] text-brand-text-muted">
                {items?.length ?? 0} items
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[11px] text-brand-text focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 placeholder:text-gray-400"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as Category | 'All')}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[11px] text-brand-text"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Item list grouped by category */}
          <div className="flex-1 overflow-y-auto">
            {items === undefined ? (
              <div className="p-4 text-center text-xs text-brand-text-muted flex items-center justify-center gap-2 h-32">
                <RefreshCcw size={14} className="animate-spin" /> Loading...
              </div>
            ) : Object.keys(groupedItems).length === 0 ? (
              <div className="p-4 text-center text-xs text-brand-text-muted h-32 flex items-center justify-center">
                No items found.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {Object.entries(groupedItems).map(([category, catItems]) => {
                  const isCollapsed = collapsedCategories.has(category);
                  const hasLowStock = catItems.some((i) => i.isLowStock);
                  const hasOutOfStock = catItems.some((i) => i.currentStock === 0 && i.isActive);

                  return (
                    <div key={category}>
                      {/* Category folder header */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
                      >
                        {isCollapsed
                          ? <Folder size={12} className="text-brand-text-muted shrink-0" />
                          : <FolderOpen size={12} className="text-brand-primary shrink-0" />
                        }
                        <span className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest flex-1">
                          {category}
                        </span>
                        <span className="text-[9px] text-brand-text-muted">{catItems.length}</span>
                        {(hasLowStock || hasOutOfStock) && (
                          <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                        )}
                        {isCollapsed
                          ? <ChevronRight size={11} className="text-gray-400 shrink-0" />
                          : <ChevronDown size={11} className="text-gray-400 shrink-0" />
                        }
                      </button>

                      {/* Items within folder */}
                      {!isCollapsed && (
                        <div className="divide-y divide-gray-50/50">
                          {catItems.map((item) => {
                            const isSelected = selectedItemId === item._id;
                            const pct = stockPct(item);
                            const barColor = stockBarColor(item);

                            return (
                              <button
                                key={item._id}
                                type="button"
                                onClick={() => setSelectedItemId(item._id)}
                                className={`w-full px-3 py-2.5 text-left transition-colors relative ${
                                  isSelected
                                    ? 'bg-brand-navy/5 border-l-2 border-brand-navy'
                                    : 'hover:bg-gray-50/80 border-l-2 border-transparent'
                                }`}
                              >
                                <div className="flex items-start gap-2.5 pl-1">
                                  {/* Avatar */}
                                  <div className={`w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-[10px] font-bold mt-0.5 transition-colors ${
                                    isSelected
                                      ? 'bg-brand-navy text-brand-primary'
                                      : item.currentStock === 0
                                      ? 'bg-red-100 text-red-600'
                                      : item.isLowStock
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {item.name.substring(0, 1).toUpperCase()}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <span className={`text-[11px] font-semibold truncate ${isSelected ? 'text-brand-navy' : 'text-brand-text'}`}>
                                        {item.name}
                                      </span>
                                      {item.currentStock === 0 && item.isActive && (
                                        <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 rounded shrink-0">OUT</span>
                                      )}
                                      {item.isLowStock && item.currentStock > 0 && (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded shrink-0">LOW</span>
                                      )}
                                    </div>

                                    {/* Stock amount */}
                                    <div className="flex items-center justify-between">
                                      <span className={`text-[10px] font-mono font-bold ${
                                        item.currentStock === 0 ? 'text-red-500'
                                        : item.isLowStock ? 'text-amber-600'
                                        : 'text-brand-text-muted'
                                      }`}>
                                        {formatNumber(item.currentStock)} {item.unit}
                                      </span>
                                      <span className="text-[9px] text-brand-text-muted font-mono">
                                        {formatMoney(item.stockValue ?? 0)}
                                      </span>
                                    </div>

                                    {/* Mini stock bar */}
                                    <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${barColor}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ─── CENTRE: Item Detail / Ledger ────────────────────────────────── */}
        <section className="flex-1 flex flex-col overflow-hidden bg-white">
          {selectedItem ? (
            <ItemDetailPanel
              item={selectedItem}
              ledger={itemLedger}
              movementFilter={movementFilter}
              setMovementFilter={setMovementFilter}
              message={message}
              setMessage={setMessage}
              onEdit={() => openAction('edit')}
              onStockIn={() => openAction('stockIn')}
              onAdjust={() => openAction('adjust')}
              onWaste={() => openAction('waste')}
            />
          ) : (
            <EmptyDetailState lowStock={lowStock} allItems={items} onSelect={setSelectedItemId} />
          )}
        </section>

        {/* ─── RIGHT PANEL: Alerts & Quick Info ────────────────────────────── */}
        <aside className="w-64 border-l border-gray-100 bg-gray-50/50 hidden xl:flex flex-col shrink-0 overflow-hidden">
          <RightInfoPanel
            summary={summary}
            lowStock={lowStock}
            onSelectItem={setSelectedItemId}
          />
        </aside>
      </div>

      {/* Footer status bar */}
      <footer className="h-7 bg-brand-navy text-white/50 flex items-center px-5 justify-between text-[9px] uppercase tracking-widest shrink-0 z-20">
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
            Live
          </span>
          <span>Campus: {campusFilter === 'All' ? 'All' : niceLabel(campusFilter)}</span>
        </div>
        <span>{items?.length ?? 0} active items · {formatMoney(summary?.totalStockValue ?? 0)} total value</span>
      </footer>

      {/* ── Action Modals ── */}
      {showAddModal && (
        <AddItemModal onClose={() => setShowAddModal(false)} actor={actor} createItem={createItem} setMessage={setMessage} />
      )}
      {showEditModal && selectedItem && (
        <EditItemModal item={selectedItem} actor={actor} updateItem={updateItem} onClose={() => setShowEditModal(false)} setMessage={setMessage} />
      )}
      {showStockInModal && selectedItem && (
        <StockInModal item={selectedItem} actor={actor} stockIn={stockIn} onClose={() => setShowStockInModal(false)} setMessage={setMessage} />
      )}
      {showAdjustModal && selectedItem && (
        <AdjustStockModal item={selectedItem} actor={actor} adjustStock={adjustStock} onClose={() => setShowAdjustModal(false)} setMessage={setMessage} />
      )}
      {showWasteModal && selectedItem && (
        <WasteModal item={selectedItem} actor={actor} recordWaste={recordWaste} onClose={() => setShowWasteModal(false)} setMessage={setMessage} />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyDetailState({
  lowStock,
  allItems,
  onSelect,
}: {
  lowStock: any;
  allItems: any;
  onSelect: (id: Id<'inventoryItems'>) => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-navy/5 flex items-center justify-center mb-4">
        <Package size={28} className="text-brand-navy/30" />
      </div>
      <h3 className="text-sm font-bold text-brand-text mb-1">Select an item to view its ledger</h3>
      <p className="text-xs text-brand-text-muted max-w-xs">
        Click any item in the sidebar to see its full stock history, movements, and insights.
      </p>

      {(lowStock?.length ?? 0) > 0 && (
        <div className="mt-8 w-full max-w-sm">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5 justify-center">
            <AlertTriangle size={12} /> Items needing attention
          </p>
          <div className="space-y-2">
            {lowStock.slice(0, 4).map((item: any) => (
              <button
                key={item._id}
                type="button"
                onClick={() => onSelect(item._id)}
                className="w-full text-left bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 hover:border-amber-300 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-brand-text">{item.name}</span>
                  <span className="text-xs font-bold text-amber-700">{formatNumber(item.currentStock)} {item.unit}</span>
                </div>
                <div className="text-[10px] text-brand-text-muted mt-0.5">
                  Reorder at {formatNumber(item.reorderLevel)} {item.unit}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right Info Panel ─────────────────────────────────────────────────────────

function RightInfoPanel({
  summary,
  lowStock,
  onSelectItem,
}: {
  summary: any;
  lowStock: any;
  onSelectItem: (id: Id<'inventoryItems'>) => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      <p className="text-[10px] font-bold text-brand-text-muted uppercase tracking-widest mb-1">Pantry Health</p>

      {/* Summary cards */}
      <div className="space-y-2">
        <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
          <p className="text-[10px] text-brand-text-muted uppercase font-semibold">Total Value</p>
          <p className="text-lg font-bold text-emerald-700 font-mono">{formatMoney(summary?.totalStockValue ?? 0)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white border border-gray-100 rounded-xl p-2.5 shadow-sm text-center">
            <p className="text-[9px] text-brand-text-muted uppercase font-semibold">Active</p>
            <p className="text-base font-bold text-brand-text">{summary?.activeItems ?? 0}</p>
          </div>
          <div className={`border rounded-xl p-2.5 shadow-sm text-center ${(summary?.lowStockCount ?? 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
            <p className="text-[9px] text-brand-text-muted uppercase font-semibold">Low</p>
            <p className={`text-base font-bold ${(summary?.lowStockCount ?? 0) > 0 ? 'text-amber-700' : 'text-brand-text'}`}>
              {summary?.lowStockCount ?? 0}
            </p>
          </div>
        </div>
        {(summary?.outOfStockCount ?? 0) > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 shadow-sm text-center">
            <p className="text-[9px] text-red-600 uppercase font-bold">{summary.outOfStockCount} Out of Stock</p>
          </div>
        )}
      </div>

      {/* Low stock list */}
      {(lowStock?.length ?? 0) > 0 && (
        <div className="mt-1">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-1">
            <AlertTriangle size={10} /> Restock Needed
          </p>
          <div className="space-y-1.5">
            {lowStock.slice(0, 6).map((item: any) => (
              <button
                key={item._id}
                type="button"
                onClick={() => onSelectItem(item._id)}
                className="w-full text-left bg-white border border-amber-100 rounded-lg px-2.5 py-2 hover:border-amber-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <p className="text-[11px] font-semibold text-brand-text leading-tight">{item.name}</p>
                  <p className={`text-[10px] font-bold ml-1 shrink-0 ${item.currentStock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {formatNumber(item.currentStock)}
                  </p>
                </div>
                <p className="text-[9px] text-brand-text-muted">{item.unit} · need {formatNumber(item.reorderLevel)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item Detail Panel (inline — replaces old ItemDetailsModal) ───────────────

type LedgerTab = 'overview' | 'insights' | 'daily' | 'ledger';

function ItemDetailPanel({
  item,
  ledger,
  movementFilter,
  setMovementFilter,
  message,
  setMessage,
  onEdit,
  onStockIn,
  onAdjust,
  onWaste,
}: {
  item: any;
  ledger: any;
  movementFilter: MovementType | 'All';
  setMovementFilter: (v: MovementType | 'All') => void;
  message: { type: 'success' | 'error'; text: string } | null;
  setMessage: (m: any) => void;
  onEdit: () => void;
  onStockIn: () => void;
  onAdjust: () => void;
  onWaste: () => void;
}) {
  const [tab, setTab] = useState<LedgerTab>('overview');

  const s = ledger?.summary;
  const movements: any[] = ledger?.movements ?? [];
  const unit = s?.unit || item.unit;

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

  const dailyGroups = useMemo(() => {
    if (!movements.length) return [];
    const groups: Record<string, any> = {};
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

  const visibleMovements = movementFilter === 'All'
    ? movementsWithBalance
    : movementsWithBalance.filter((m) => m.movementType === movementFilter);

  const pct = stockPct(item);
  const totalIn = s?.totalReceived ?? 0;
  const totalOut = s?.totalUsed ?? 0;
  const remaining = s?.remainingStock ?? item.currentStock;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Item header ── */}
      <div className="bg-brand-navy px-6 pt-5 pb-0 shrink-0">
        {message && (
          <div className={`mb-3 rounded-lg border p-3 flex items-center gap-2 text-xs font-medium ${
            message.type === 'success' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 'bg-red-500/20 border-red-400/40 text-red-100'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={12} /></button>
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Stock Ledger</span>
              <span className="text-white/20">·</span>
              <span className="text-[9px] text-white/40 uppercase">{item.category}</span>
              <span className="text-white/20">·</span>
              <span className="text-[9px] text-white/40 uppercase">{niceLabel(item.campusCode)}</span>
            </div>
            <h2 className="text-xl font-bold text-white truncate">{item.name}</h2>
            <p className="text-xs text-white/50 mt-0.5">Unit: <strong className="text-white/70">{unit}</strong> · Updated {formatDate(item.updatedAt)}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onEdit} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors">
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={onStockIn} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1 transition-colors">
              <ArrowDownCircle size={12} /> Stock In
            </button>
            <button onClick={onAdjust} className="px-2.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-semibold transition-colors">
              Adjust
            </button>
            <button onClick={onWaste} className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-semibold flex items-center gap-1 transition-colors">
              <Trash2 size={12} /> Waste
            </button>
          </div>
        </div>

        {/* 3-number flow */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/20 px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowDownCircle size={11} className="text-emerald-400" />
              <p className="text-[9px] text-emerald-300 font-bold uppercase tracking-wide">Received</p>
            </div>
            <p className="text-lg font-bold text-white">{formatNumber(totalIn)}</p>
            <p className="text-[9px] text-white/40">{unit} ever</p>
          </div>
          <div className="rounded-lg bg-red-500/15 border border-red-400/20 px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowUpCircle size={11} className="text-red-400" />
              <p className="text-[9px] text-red-300 font-bold uppercase tracking-wide">Used / Out</p>
            </div>
            <p className="text-lg font-bold text-white">{formatNumber(totalOut)}</p>
            <p className="text-[9px] text-white/40">{unit} consumed</p>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 ${item.isLowStock ? 'bg-amber-500/20 border-amber-400/30' : 'bg-white/8 border-white/10'}`}>
            <div className="flex items-center gap-1 mb-0.5">
              <Package size={11} className={item.isLowStock ? 'text-amber-300' : 'text-white/50'} />
              <p className={`text-[9px] font-bold uppercase tracking-wide ${item.isLowStock ? 'text-amber-300' : 'text-white/50'}`}>
                Remaining
              </p>
            </div>
            <p className="text-lg font-bold text-white">{formatNumber(remaining)}</p>
            <p className="text-[9px] text-white/40">{unit} in stock</p>
          </div>
        </div>

        {/* Stock bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[9px] text-white/40 mb-1">
            <span>Stock level</span>
            <span>Reorder @ {formatNumber(item.reorderLevel)} {unit} · {pct}% of safe level</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${item.isLowStock ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5">
          {([
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'insights', label: 'Insights', icon: Lightbulb },
            { id: 'daily', label: 'Daily', icon: Calendar },
            { id: 'ledger', label: 'Full Ledger', icon: History },
          ] as { id: LedgerTab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-semibold transition-all ${
                tab === id
                  ? 'bg-white text-brand-navy'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={12} />{label}
            </button>
          ))}
          <div className="ml-auto flex items-end pb-1 text-[9px] text-white/30">
            {s?.movementCount ?? 0} movements
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto bg-white">
        {ledger === undefined ? (
          <div className="flex items-center justify-center h-32 text-brand-text-muted text-sm">
            <RefreshCcw size={16} className="animate-spin mr-2" /> Loading ledger...
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
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ item, s, unit }: { item: any; s: any; unit: string }) {
  if (!s) return <div className="p-6 text-brand-text-muted text-sm">No summary data yet — add some stock movements to see an overview.</div>;

  return (
    <div className="p-6 space-y-6">
      {s.isLowStock && item.isActive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="text-sm font-bold">Below reorder level — restock soon</p>
            <p className="text-xs mt-0.5">{formatNumber(s.remainingStock)} {unit} remaining · reorder level is {formatNumber(item.reorderLevel)} {unit}</p>
          </div>
        </div>
      )}

      <section>
        <h3 className="text-xs font-bold text-brand-text mb-3 flex items-center gap-2">
          <ArrowDownCircle size={14} className="text-emerald-600" /> What came in
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <FlowCard label="Stock In" value={`${formatNumber(s.purchasedStockIn ?? 0)} ${unit}`} tone="success" />
          <FlowCard label="Receipt In" value={`${formatNumber(s.receiptIn ?? 0)} ${unit}`} tone="success" />
          <FlowCard label="Leftovers Returned" value={`${formatNumber(s.leftoverReturned ?? 0)} ${unit}`} tone="success" />
          <FlowCard label="Total Inbound" value={`${formatNumber(s.totalReceived ?? 0)} ${unit}`} tone="success" bold />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold text-brand-text mb-3 flex items-center gap-2">
          <ArrowUpCircle size={14} className="text-red-500" /> What went out
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <FlowCard label="Kitchen Used" value={`${formatNumber(s.kitchenUsed ?? 0)} ${unit}`} tone="danger" />
          <FlowCard label="Dispatched Out" value={`${formatNumber(s.dispatchedOut ?? 0)} ${unit}`} tone="danger" />
          <FlowCard label="Waste / Spoilage" value={`${formatNumber(s.wasted ?? 0)} ${unit}`} tone="danger" />
          <FlowCard label="Total Outbound" value={`${formatNumber(s.totalUsed ?? 0)} ${unit}`} tone="danger" bold />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold text-brand-text mb-3 flex items-center gap-2">
          <Package size={14} className="text-brand-text-muted" /> Balance & cost
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <FlowCard label="Remaining" value={`${formatNumber(s.remainingStock)} ${unit}`} tone={s.isLowStock ? 'warning' : 'default'} bold />
          <FlowCard label="Stock Value" value={formatMoney(s.stockValue ?? 0)} tone="default" />
          <FlowCard label="Avg Cost" value={`${formatMoney(s.averageUnitCost ?? 0)} / ${unit}`} tone="default" />
          <FlowCard label="Last Purchase" value={`${formatMoney(s.lastUnitCost ?? 0)} / ${unit}`} tone="default" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          <FlowCard label="Reorder Level" value={`${formatNumber(item.reorderLevel)} ${unit}`} tone="default" />
          <FlowCard label="Net Adjustments" value={`${(s.netAdjustments ?? 0) >= 0 ? '+' : ''}${formatNumber(s.netAdjustments ?? 0)} ${unit}`} tone="default" />
          <FlowCard label="Last Purchase Date" value={formatDateShort(s.lastPurchaseDate)} tone="default" />
          <FlowCard label="Total Movements" value={s.movementCount ?? 0} tone="default" />
        </div>
      </section>
    </div>
  );
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────

function InsightsTab({ movements, unit, item }: { movements: any[]; unit: string; item: any }) {
  const dispatched = movements.filter((m) => m.movementType === 'DISPATCH_OUT' || m.movementType === 'KITCHEN_ISSUE');
  const returned = movements.filter((m) => m.movementType === 'LEFTOVER_RETURN');
  const wasted = movements.filter((m) => m.movementType === 'WASTE');
  const adjustments = movements.filter((m) => m.movementType === 'ADJUSTMENT');
  const totalDispatched = dispatched.reduce((s, m) => s + Math.abs(m.signedQuantity ?? m.quantity ?? 0), 0);
  const totalReturned = returned.reduce((s, m) => s + Math.abs(m.signedQuantity ?? m.quantity ?? 0), 0);
  const totalWasted = wasted.reduce((s, m) => s + Math.abs(m.signedQuantity ?? m.quantity ?? 0), 0);
  const netConsumed = totalDispatched - totalReturned;
  const timeline = [...movements].reverse();

  return (
    <div className="p-6 space-y-7">
      {/* Dispatch summary */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <LogOut size={14} className="text-red-500" />
          <h3 className="text-sm font-bold text-brand-text">What left the store</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-red-600 mb-1">Sent Out</p>
            <p className="text-lg font-bold text-red-800">{formatNumber(totalDispatched)}</p>
            <p className="text-[9px] text-red-500">{unit} dispatched</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 mb-1">Returned</p>
            <p className="text-lg font-bold text-emerald-800">{formatNumber(totalReturned)}</p>
            <p className="text-[9px] text-emerald-500">{unit} came back</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500 mb-1">Net Used</p>
            <p className="text-lg font-bold text-brand-text">{formatNumber(netConsumed)}</p>
            <p className="text-[9px] text-brand-text-muted">{unit} actually used</p>
          </div>
        </div>

        {dispatched.length > 0 && (
          <div className="rounded-xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
              <LogOut size={12} className="text-red-500" />
              <p className="text-[9px] font-bold text-brand-text-muted uppercase tracking-wide">Outbound ({dispatched.length})</p>
            </div>
            {dispatched.map((m) => {
              const qty = Math.abs(m.signedQuantity ?? m.quantity ?? 0);
              return (
                <div key={m._id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${movementTone(m.movementType)}`}>{niceLabel(m.movementType)}</span>
                      <span className="text-sm font-bold text-red-700">−{formatNumber(qty)} {unit}</span>
                    </div>
                    {m.notes && <p className="text-[10px] text-brand-text-muted mt-0.5">{m.notes}</p>}
                    {m.createdByName && <p className="text-[10px] text-brand-text-muted">By {m.createdByName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-brand-text-muted">{formatDateShort(m.createdAt)}</p>
                    <p className="text-[10px] text-brand-text-muted">{formatMoney(Math.abs(m.totalCost ?? 0))}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Returns */}
      {returned.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <CornerDownLeft size={14} className="text-emerald-600" />
            <h3 className="text-sm font-bold text-brand-text">Returns ({returned.length})</h3>
          </div>
          <div className="rounded-xl border border-emerald-100 divide-y divide-gray-50 overflow-hidden">
            {returned.map((m) => {
              const qty = Math.abs(m.signedQuantity ?? m.quantity ?? 0);
              return (
                <div key={m._id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-emerald-700">+{formatNumber(qty)} {unit} returned</p>
                    {m.notes && <p className="text-[10px] text-brand-text-muted">{m.notes}</p>}
                    {m.createdByName && <p className="text-[10px] text-brand-text-muted">By {m.createdByName}</p>}
                  </div>
                  <p className="text-[10px] text-brand-text-muted shrink-0">{formatDateShort(m.createdAt)}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Waste */}
      {wasted.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Trash2 size={14} className="text-orange-500" />
            <h3 className="text-sm font-bold text-brand-text">Waste — {formatNumber(totalWasted)} {unit} across {wasted.length} event{wasted.length !== 1 ? 's' : ''}</h3>
          </div>
          <div className="rounded-xl border border-orange-100 divide-y divide-gray-50 overflow-hidden">
            {wasted.map((m) => {
              const qty = Math.abs(m.signedQuantity ?? m.quantity ?? 0);
              return (
                <div key={m._id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-orange-700">{formatNumber(qty)} {unit} wasted</p>
                    {m.notes && <p className="text-[10px] text-brand-text-muted">{m.notes}</p>}
                    {m.createdByName && <p className="text-[10px] text-brand-text-muted">By {m.createdByName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-brand-text-muted">{formatDateShort(m.createdAt)}</p>
                    <p className="text-[10px] text-red-600 font-semibold">−{formatMoney(Math.abs(m.totalCost ?? 0))}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Adjustments */}
      {adjustments.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Info size={14} className="text-blue-500" />
            <h3 className="text-sm font-bold text-brand-text">Manual Adjustments</h3>
          </div>
          <div className="rounded-xl border border-blue-100 divide-y divide-gray-50 overflow-hidden">
            {adjustments.map((m) => {
              const qty = m.signedQuantity ?? m.quantity ?? 0;
              return (
                <div key={m._id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-sm font-bold ${qty >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {qty >= 0 ? '+' : ''}{formatNumber(qty)} {unit}
                    </p>
                    {m.notes && <p className="text-[10px] text-brand-text-muted">Reason: {m.notes}</p>}
                    {m.createdByName && <p className="text-[10px] text-brand-text-muted">By {m.createdByName}</p>}
                  </div>
                  <p className="text-[10px] text-brand-text-muted shrink-0">{formatDateShort(m.createdAt)}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <History size={14} className="text-brand-text-muted" />
          <h3 className="text-sm font-bold text-brand-text">Full Event Log (oldest → newest)</h3>
        </div>
        {timeline.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-brand-text-muted">No events recorded yet.</div>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-0">
              {timeline.map((m) => {
                const qty = m.signedQuantity ?? m.quantity ?? 0;
                const absQty = Math.abs(qty);
                const narrative = buildNarrative(m, absQty, unit);
                const dotColor = isInbound(m.movementType) ? 'bg-emerald-500' : isOutbound(m.movementType) ? 'bg-red-400' : 'bg-blue-400';
                return (
                  <div key={m._id} className="relative flex gap-3 pb-4">
                    <div className="relative z-10 w-10 shrink-0 flex justify-center pt-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full ring-2 ring-white ${dotColor}`} />
                    </div>
                    <div className="flex-1 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-brand-text">{narrative}</p>
                          {m.notes && m.notes !== narrative && (
                            <p className="text-[10px] text-brand-text-muted mt-0.5 italic">"{m.notes}"</p>
                          )}
                          {m.createdByName && <p className="text-[10px] text-brand-text-muted mt-0.5">by {m.createdByName}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-brand-text-muted">{formatDateShort(m.createdAt)}</p>
                          <p className="text-[9px] text-brand-text-muted">{formatTime(m.createdAt)}</p>
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
    case 'STOCK_IN': return `${qty} received into store (stock in).`;
    case 'RECEIPT_IN': return `${qty} received from a purchase receipt.`;
    case 'DISPATCH_OUT': return `${qty} dispatched out of store.`;
    case 'KITCHEN_ISSUE': return `${qty} issued to kitchen for use.`;
    case 'WASTE': return `${qty} recorded as waste or spoilage.`;
    case 'LEFTOVER_RETURN': return `${qty} returned to store as leftover.`;
    case 'ADJUSTMENT': {
      const signed = m.signedQuantity ?? m.quantity ?? 0;
      if (signed > 0) return `Stock corrected upward by ${qty} (manual adjustment).`;
      if (signed < 0) return `Stock corrected downward by ${qty} (manual adjustment).`;
      return `Stock verified at current level (no change).`;
    }
    default: return `${qty} — ${niceLabel(m.movementType)}.`;
  }
}

// ─── Daily Usage Tab ──────────────────────────────────────────────────────────

function DailyUsageTab({ dailyGroups, unit }: { dailyGroups: any[]; unit: string }) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  if (!dailyGroups.length) {
    return <div className="p-10 text-center text-brand-text-muted text-sm">No movement history recorded yet.</div>;
  }

  return (
    <div className="p-5 space-y-2">
      {dailyGroups.map((day) => {
        const isExpanded = expandedDay === day.date;
        return (
          <div key={day.date} className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedDay(isExpanded ? null : day.date)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
            >
              <Calendar size={14} className="text-brand-text-muted shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-text">{day.date}</p>
                <p className="text-[10px] text-brand-text-muted">{day.movements.length} movement{day.movements.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {day.totalIn > 0 && <span className="text-xs font-bold text-emerald-600">+{formatNumber(day.totalIn)}</span>}
                {day.totalOut > 0 && <span className="text-xs font-bold text-red-600">−{formatNumber(day.totalOut)}</span>}
                <span className={`text-sm font-bold ${day.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {day.net >= 0 ? '+' : ''}{formatNumber(day.net)} {unit}
                </span>
                {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
            </button>
            {isExpanded && (
              <div className="divide-y divide-gray-50">
                {day.movements.map((m: any) => {
                  const qty = m.signedQuantity ?? m.quantity ?? 0;
                  return (
                    <div key={m._id} className="px-4 py-2.5 flex items-center gap-3">
                      {movementIcon(m.movementType)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${movementTone(m.movementType)}`}>{niceLabel(m.movementType)}</span>
                          <span className={`text-xs font-bold ${qty >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{qty >= 0 ? '+' : ''}{formatNumber(qty)} {unit}</span>
                        </div>
                        {m.notes && <p className="text-[10px] text-brand-text-muted mt-0.5">{m.notes}</p>}
                      </div>
                      <p className="text-[10px] text-brand-text-muted shrink-0">{formatTime(m.createdAt)}</p>
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

// ─── Full Ledger Tab ──────────────────────────────────────────────────────────

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
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/30">
        <p className="text-xs text-brand-text-muted">{movements.length} record{movements.length !== 1 ? 's' : ''}</p>
        <select value={movementFilter} onChange={(e) => setMovementFilter(e.target.value as MovementType | 'All')} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs">
          <option value="All">All types</option>
          {movementTypes.map((t) => <option key={t} value={t}>{niceLabel(t)}</option>)}
        </select>
      </div>

      {movements.length === 0 ? (
        <div className="py-12 text-center text-brand-text-muted text-sm">No movements match the filter.</div>
      ) : (
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-2.5 text-[9px] font-bold text-brand-text-muted uppercase tracking-wider">Date</th>
              <th className="px-4 py-2.5 text-[9px] font-bold text-brand-text-muted uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 text-[9px] font-bold text-brand-text-muted uppercase tracking-wider text-right">Qty</th>
              <th className="px-4 py-2.5 text-[9px] font-bold text-brand-text-muted uppercase tracking-wider text-right">Balance</th>
              <th className="px-4 py-2.5 text-[9px] font-bold text-brand-text-muted uppercase tracking-wider text-right">Total</th>
              <th className="px-4 py-2.5 text-[9px] font-bold text-brand-text-muted uppercase tracking-wider">Notes</th>
              <th className="px-4 py-2.5 text-[9px] font-bold text-brand-text-muted uppercase tracking-wider">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {movements.map((m: any) => {
              const qty = m.signedQuantity ?? m.quantity ?? 0;
              const positive = qty >= 0;
              return (
                <tr key={m._id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="text-[10px] font-medium text-brand-text">{formatDateShort(m.createdAt)}</p>
                    <p className="text-[9px] text-brand-text-muted">{formatTime(m.createdAt)}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${movementTone(m.movementType)}`}>
                      {movementIcon(m.movementType)}{niceLabel(m.movementType)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-xs font-bold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                      {positive ? '+' : ''}{formatNumber(qty)}
                    </span>
                    <span className="text-[9px] text-brand-text-muted ml-1">{unit}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-xs font-semibold text-brand-text">{formatNumber(Math.max(0, m.runningBalance ?? 0))}</span>
                    <span className="text-[9px] text-brand-text-muted ml-1">{unit}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-[10px] font-semibold ${positive ? 'text-emerald-700' : 'text-red-600'}`}>
                      {positive ? '+' : '−'}{formatMoney(Math.abs(m.totalCost ?? 0))}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 max-w-[160px]">
                    <p className="text-[10px] text-brand-text truncate">{m.purchaseBatchNumber || m.orderNumber || m.sourceLabel || '—'}</p>
                    {m.notes && <p className="text-[9px] text-brand-text-muted truncate" title={m.notes}>{m.notes}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-[10px] text-brand-text-muted">{m.createdByName || '—'}</td>
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
    <div className={`border rounded-lg p-2.5 ${toneClass}`}>
      <p className="text-[9px] uppercase tracking-wide opacity-60 font-bold">{label}</p>
      <p className={`mt-0.5 ${bold ? 'text-sm font-bold' : 'text-xs font-semibold'}`}>{value}</p>
    </div>
  );
}

// ─── Action Modals (unchanged from original) ──────────────────────────────────

function ModalShell({ title, children, onClose, maxWidth = 'max-w-xl' }: { title: string; children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl p-6 w-full ${maxWidth} max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-brand-text">{title}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddItemModal({ onClose, actor, createItem, setMessage }: any) {
  const [form, setForm] = useState({ name: '', category: 'LUNCH' as Category, unit: 'pcs', campusCode: 'MAIN_SCHOOL' as CampusCode, currentStock: '0', reorderLevel: '10', averageUnitCost: '0', notes: '' });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await createItem({ name: form.name, category: form.category, unit: form.unit, campusCode: form.campusCode, currentStock: Number(form.currentStock), reorderLevel: Number(form.reorderLevel), averageUnitCost: Number(form.averageUnitCost), actor, notes: form.notes || undefined });
      setMessage({ type: 'success', text: 'Inventory item created.' });
      onClose();
    } catch (err: any) { setMessage({ type: 'error', text: err?.message || 'Failed to create item.' }); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title="Add Inventory Item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Item Name" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" value={form.category} onChange={(v: string) => setForm({ ...form, category: v as Category })} options={categories} />
          <Select label="Campus" value={form.campusCode} onChange={(v: string) => setForm({ ...form, campusCode: v as CampusCode })} options={campuses} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Unit (kg, litres, pcs…)" value={form.unit} onChange={(v: string) => setForm({ ...form, unit: v })} required />
          <Input label="Opening Stock" type="number" value={form.currentStock} onChange={(v: string) => setForm({ ...form, currentStock: v })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={(v: string) => setForm({ ...form, reorderLevel: v })} required />
          <Input label="Avg Unit Cost (KES)" type="number" value={form.averageUnitCost} onChange={(v: string) => setForm({ ...form, averageUnitCost: v })} required />
        </div>
        <TextArea label="Notes" value={form.notes} onChange={(v: string) => setForm({ ...form, notes: v })} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Create Item" />
      </form>
    </ModalShell>
  );
}

function EditItemModal({ item, actor, updateItem, onClose, setMessage }: any) {
  const [form, setForm] = useState({ name: item.name, category: item.category as Category, unit: item.unit, reorderLevel: String(item.reorderLevel ?? 0), isActive: item.isActive ? 'active' : 'inactive', notes: 'Item details updated' });
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateItem({ inventoryItemId: item._id, name: form.name, category: form.category, unit: form.unit, reorderLevel: Number(form.reorderLevel), isActive: form.isActive === 'active', actor, notes: form.notes || undefined });
      setMessage({ type: 'success', text: 'Item updated.' });
      onClose();
    } catch (err: any) { setMessage({ type: 'error', text: err?.message || 'Failed to update.' }); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title={`Edit: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Item Name" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category" value={form.category} onChange={(v: string) => setForm({ ...form, category: v as Category })} options={categories} />
          <Select label="Status" value={form.isActive} onChange={(v: string) => setForm({ ...form, isActive: v })} options={['active', 'inactive']} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Unit" value={form.unit} onChange={(v: string) => setForm({ ...form, unit: v })} required />
          <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={(v: string) => setForm({ ...form, reorderLevel: v })} required />
        </div>
        <TextArea label="Reason / Notes" value={form.notes} onChange={(v: string) => setForm({ ...form, notes: v })} />
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
  const preview = Number(quantity) > 0 ? item.currentStock + Number(quantity) : null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await stockIn({ inventoryItemId: item._id, quantity: Number(quantity), unitCost: Number(unitCost), actor, notes: notes || undefined });
      setMessage({ type: 'success', text: `Stock added. ${item.name} now has ${formatNumber(item.currentStock + Number(quantity))} ${item.unit}.` });
      onClose();
    } catch (err: any) { setMessage({ type: 'error', text: err?.message || 'Failed to add stock.' }); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title={`Stock In: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm">
          Current: <strong>{formatNumber(item.currentStock)} {item.unit}</strong>
          {preview !== null && <span className="ml-2 text-emerald-700 font-semibold">→ {formatNumber(preview)} {item.unit}</span>}
        </div>
        <Input label={`Quantity (${item.unit})`} type="number" value={quantity} onChange={setQuantity} required />
        <Input label={`Unit Cost (KES / ${item.unit})`} type="number" value={unitCost} onChange={setUnitCost} required />
        {Number(quantity) > 0 && Number(unitCost) > 0 && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2 text-sm text-emerald-800">
            Total cost: <strong>{formatMoney(Number(quantity) * Number(unitCost))}</strong>
          </div>
        )}
        <TextArea label="Notes" value={notes} onChange={setNotes} />
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
    if (!window.confirm(`Set ${item.name} stock from ${item.currentStock} to ${newStock} ${item.unit}?`)) return;
    try {
      setSaving(true);
      await adjustStock({ inventoryItemId: item._id, newStock: Number(newStock), actor, notes });
      setMessage({ type: 'success', text: 'Stock adjusted.' });
      onClose();
    } catch (err: any) { setMessage({ type: 'error', text: err?.message || 'Failed to adjust.' }); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title={`Adjust Stock: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm">
          Current: <strong>{formatNumber(item.currentStock)} {item.unit}</strong>
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
    if (!window.confirm(`Record ${quantity} ${item.unit} of ${item.name} as waste?`)) return;
    try {
      setSaving(true);
      await recordWaste({ inventoryItemId: item._id, quantity: Number(quantity), actor, notes });
      setMessage({ type: 'success', text: 'Waste recorded.' });
      onClose();
    } catch (err: any) { setMessage({ type: 'error', text: err?.message || 'Failed to record waste.' }); }
    finally { setSaving(false); }
  };
  return (
    <ModalShell title={`Record Waste: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-800">
          Current: <strong>{formatNumber(item.currentStock)} {item.unit}</strong> — waste deducts from this.
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
      <label className="block text-xs font-semibold text-brand-text mb-1.5">{label}</label>
      <input type={type} required={required} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
    </div>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-brand-text mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
        {options.map((o: string) => <option key={o} value={o}>{niceLabel(o)}</option>)}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold text-brand-text mb-1.5">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
    </div>
  );
}

function ModalActions({ onClose, saving, submitLabel, danger }: any) {
  return (
    <div className="flex justify-end gap-2 pt-3">
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
      <button type="submit" disabled={saving}
        className={`px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60 ${danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-brand-primary text-brand-navy hover:bg-brand-primary-hover'}`}>
        {saving ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}