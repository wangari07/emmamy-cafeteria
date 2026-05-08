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
  return new Date(value).toLocaleString();
}

function movementTone(type: MovementType) {
  if (type === 'STOCK_IN' || type === 'RECEIPT_IN' || type === 'LEFTOVER_RETURN') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (type === 'WASTE' || type === 'DISPATCH_OUT' || type === 'KITCHEN_ISSUE') {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-blue-50 text-blue-700 border-blue-100';
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

  const [selectedItemId, setSelectedItemId] = useState<Id<'inventoryItems'> | null>(
    null
  );

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

  const movements = useQuery(api.inventory.listMovements, {
    inventoryItemId: selectedItemId || undefined,
    movementType: movementFilter === 'All' ? undefined : movementFilter,
    limit: 75,
  });

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
            Manage stock, low-stock alerts, stock-in, corrections, waste, and movement accountability.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true);
            setMessage(null);
          }}
          className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Add Inventory Item
        </button>
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
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard
          icon={Boxes}
          label="Active Items"
          value={summary?.activeItems ?? 0}
          subtext={`${summary?.totalItems ?? 0} total items`}
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Low Stock"
          value={summary?.lowStockCount ?? 0}
          subtext={`${summary?.outOfStockCount ?? 0} out of stock`}
          warning={(summary?.lowStockCount ?? 0) > 0}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Stock Value"
          value={formatMoney(summary?.totalStockValue ?? 0)}
          subtext="Estimated inventory value"
        />
        <SummaryCard
          icon={ClipboardList}
          label="Inactive Items"
          value={summary?.inactiveItems ?? 0}
          subtext="Hidden from active ops"
        />
        <SummaryCard
          icon={Activity}
          label="Campus"
          value={campusFilter === 'All' ? 'All' : niceLabel(campusFilter)}
          subtext="Current filter"
        />
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
                <p className="text-sm text-brand-text-muted">
                  Current: {formatNumber(item.currentStock)} {item.unit}
                </p>
                <p className="text-sm text-amber-700">
                  Reorder at: {formatNumber(item.reorderLevel)} {item.unit}
                </p>
                <p className="text-xs text-brand-text-muted mt-1">
                  Shortage: {formatNumber((item as any).shortage ?? 0)} {item.unit}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full xl:w-96">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search inventory items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full xl:w-auto">
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value as CampusCode | 'All')}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            <option value="All">All Campuses</option>
            {campuses.map((campus) => (
              <option key={campus} value={campus}>
                {niceLabel(campus)}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as Category | 'All')}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            <option value="All">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) =>
              setStockFilter(e.target.value as 'All' | 'Low Stock' | 'Active' | 'Inactive')
            }
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            <option value="Active">Active Only</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Inactive">Inactive</option>
            <option value="All">All Items</option>
          </select>

          <select
            value={movementFilter}
            onChange={(e) => setMovementFilter(e.target.value as MovementType | 'All')}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
            title="Movement filter for item details"
          >
            <option value="All">All Movements</option>
            {movementTypes.map((type) => (
              <option key={type} value={type}>
                {niceLabel(type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <SortableHeader label="Item Name" column="name" sortColumn={sortColumn} onSort={handleSort} />
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Campus</th>
                <SortableHeader label="Stock" column="currentStock" sortColumn={sortColumn} onSort={handleSort} />
                <SortableHeader label="Value" column="stockValue" sortColumn={sortColumn} onSort={handleSort} />
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Status</th>
                <SortableHeader label="Last Updated" column="updatedAt" sortColumn={sortColumn} onSort={handleSort} />
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {items === undefined ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-brand-text-muted">Loading inventory...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-brand-text-muted">No inventory items found.</td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => selectAndOpen(item._id, 'details')}
                        className="flex items-center gap-3 text-left group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-brand-primary/20 group-hover:text-brand-primary">
                          <Package size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-brand-text group-hover:underline">{item.name}</p>
                          <p className="text-xs text-brand-text-muted">Unit: {item.unit}</p>
                        </div>
                      </button>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {item.category}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text-muted">{niceLabel(item.campusCode)}</td>

                    <td className="px-6 py-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-semibold text-brand-text">{formatNumber(item.currentStock)}</span>
                        <span className="text-xs text-brand-text-muted">{item.unit}</span>
                      </div>
                      <p className="text-xs text-brand-text-muted">Reorder: {formatNumber(item.reorderLevel)}</p>
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text">
                      {formatMoney(item.stockValue ?? 0)}
                      <p className="text-xs text-brand-text-muted">Avg: {formatMoney(item.averageUnitCost ?? 0)} / {item.unit}</p>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge isActive={item.isActive} isLowStock={item.isLowStock} />
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text-muted">{formatDate(item.updatedAt)}</td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => selectAndOpen(item._id, 'details')} className="px-3 py-1.5 rounded-lg bg-gray-100 text-brand-text text-xs font-semibold hover:bg-gray-200 inline-flex items-center gap-1">
                          <Eye size={14} /> Details
                        </button>
                        <button onClick={() => selectAndOpen(item._id, 'stockIn')} className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100">
                          Stock In
                        </button>
                        <button onClick={() => selectAndOpen(item._id, 'adjust')} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100">
                          Adjust
                        </button>
                        <button onClick={() => selectAndOpen(item._id, 'waste')} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100">
                          Waste
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
          <p className="text-sm text-brand-text-muted">
            Showing {filteredItems.length} inventory item{filteredItems.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

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

      {showDetailsModal && selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          movements={movements}
          movementFilter={movementFilter}
          setMovementFilter={setMovementFilter}
          onEdit={() => {
            setShowDetailsModal(false);
            setShowEditModal(true);
          }}
          onStockIn={() => {
            setShowDetailsModal(false);
            setShowStockInModal(true);
          }}
          onAdjust={() => {
            setShowDetailsModal(false);
            setShowAdjustModal(true);
          }}
          onWaste={() => {
            setShowDetailsModal(false);
            setShowWasteModal(true);
          }}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtext,
  warning,
}: {
  icon: any;
  label: string;
  value: string | number;
  subtext: string;
  warning?: boolean;
}) {
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
    <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
      <button type="button" className="flex items-center gap-2 cursor-pointer hover:text-brand-text" onClick={() => onSort(column)}>
        {label}
        <ArrowUpDown size={14} className={sortColumn === column ? 'text-brand-primary' : ''} />
      </button>
    </th>
  );
}

function StatusBadge({ isActive, isLowStock }: { isActive: boolean; isLowStock: boolean }) {
  if (!isActive) {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">Inactive</span>;
  }

  if (isLowStock) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
        <AlertTriangle size={12} /> Low Stock
      </span>
    );
  }

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
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ItemDetailsModal({
  item,
  movements,
  movementFilter,
  setMovementFilter,
  onEdit,
  onStockIn,
  onAdjust,
  onWaste,
  onClose,
}: {
  item: any;
  movements: any[] | undefined;
  movementFilter: MovementType | 'All';
  setMovementFilter: (value: MovementType | 'All') => void;
  onEdit: () => void;
  onStockIn: () => void;
  onAdjust: () => void;
  onWaste: () => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title={`Inventory Details: ${item.name}`} onClose={onClose} maxWidth="max-w-5xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InfoBox label="Current Stock" value={`${formatNumber(item.currentStock)} ${item.unit}`} />
          <InfoBox label="Stock Value" value={formatMoney(item.stockValue ?? 0)} />
          <InfoBox label="Average Cost" value={`${formatMoney(item.averageUnitCost ?? 0)} / ${item.unit}`} />
          <InfoBox label="Status" value={item.isActive ? (item.isLowStock ? 'Low Stock' : 'Active') : 'Inactive'} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InfoBox label="Category" value={item.category} />
          <InfoBox label="Campus" value={niceLabel(item.campusCode)} />
          <InfoBox label="Reorder Level" value={`${formatNumber(item.reorderLevel)} ${item.unit}`} />
          <InfoBox label="Last Purchase" value={formatDate(item.lastPurchaseDate)} />
        </div>

        {item.isLowStock && item.isActive && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-start gap-3">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">This item is below its reorder level.</p>
              <p className="text-sm mt-1">Current stock is {formatNumber(item.currentStock)} {item.unit}; reorder level is {formatNumber(item.reorderLevel)} {item.unit}.</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={onEdit} className="px-3 py-2 rounded-lg bg-gray-100 text-brand-text text-sm font-semibold hover:bg-gray-200 inline-flex items-center gap-2"><Edit3 size={15} /> Edit Item</button>
          <button onClick={onStockIn} className="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100">Stock In</button>
          <button onClick={onAdjust} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100">Adjust Stock</button>
          <button onClick={onWaste} className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 inline-flex items-center gap-2"><Trash2 size={15} /> Record Waste</button>
        </div>

        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <History size={18} className="text-brand-text-muted" />
              <h3 className="font-semibold text-brand-text">Movement History</h3>
            </div>
            <select
              value={movementFilter}
              onChange={(e) => setMovementFilter(e.target.value as MovementType | 'All')}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm"
            >
              <option value="All">All movement types</option>
              {movementTypes.map((type) => (
                <option key={type} value={type}>{niceLabel(type)}</option>
              ))}
            </select>
          </div>

          {movements === undefined ? (
            <p className="px-4 py-8 text-sm text-brand-text-muted text-center">Loading movements...</p>
          ) : movements.length === 0 ? (
            <p className="px-4 py-8 text-sm text-brand-text-muted text-center">No movements found for this item.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {movements.map((movement) => (
                <div key={movement._id} className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div>
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold border ${movementTone(movement.movementType)}`}>
                        {niceLabel(movement.movementType)}
                      </span>
                      <p className="text-sm text-brand-text mt-2">
                        Qty: <strong>{formatNumber(movement.quantity)} {movement.itemUnit || item.unit}</strong>
                        {' '}· Cost: <strong>{formatMoney(movement.totalCost ?? 0)}</strong>
                      </p>
                      {(movement.purchaseBatchNumber || movement.orderNumber) && (
                        <p className="text-xs text-brand-text-muted mt-1">
                          Ref: {movement.purchaseBatchNumber || movement.orderNumber}
                        </p>
                      )}
                      {movement.notes && <p className="text-sm text-brand-text-muted mt-1">{movement.notes}</p>}
                    </div>
                    <p className="text-xs text-brand-text-muted whitespace-nowrap">{formatDate(movement.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function InfoBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
      <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold">{label}</p>
      <p className="text-sm font-semibold text-brand-text mt-1">{value}</p>
    </div>
  );
}

function AddItemModal({ onClose, actor, createItem, setMessage }: { onClose: () => void; actor: string; createItem: any; setMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>> }) {
  const [form, setForm] = useState({
    name: '',
    category: 'LUNCH' as Category,
    unit: 'pcs',
    campusCode: 'MAIN_SCHOOL' as CampusCode,
    currentStock: '0',
    reorderLevel: '10',
    averageUnitCost: '0',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await createItem({
        name: form.name,
        category: form.category,
        unit: form.unit,
        campusCode: form.campusCode,
        currentStock: Number(form.currentStock),
        reorderLevel: Number(form.reorderLevel),
        averageUnitCost: Number(form.averageUnitCost),
        actor,
        notes: form.notes || undefined,
      });
      setMessage({ type: 'success', text: 'Inventory item created successfully.' });
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to create inventory item.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Add Inventory Item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Item Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value as Category })} options={categories} />
          <Select label="Campus" value={form.campusCode} onChange={(value) => setForm({ ...form, campusCode: value as CampusCode })} options={campuses} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Unit" value={form.unit} onChange={(value) => setForm({ ...form, unit: value })} placeholder="pcs, kg, litres, trays..." required />
          <Input label="Opening Stock" type="number" value={form.currentStock} onChange={(value) => setForm({ ...form, currentStock: value })} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={(value) => setForm({ ...form, reorderLevel: value })} required />
          <Input label="Average Unit Cost" type="number" value={form.averageUnitCost} onChange={(value) => setForm({ ...form, averageUnitCost: value })} required />
        </div>
        <TextArea label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Create Item" />
      </form>
    </ModalShell>
  );
}

function EditItemModal({ item, actor, updateItem, onClose, setMessage }: { item: any; actor: string; updateItem: any; onClose: () => void; setMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>> }) {
  const [form, setForm] = useState({
    name: item.name,
    category: item.category as Category,
    unit: item.unit,
    reorderLevel: String(item.reorderLevel ?? 0),
    isActive: item.isActive ? 'active' : 'inactive',
    notes: 'Inventory item details updated',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateItem({
        inventoryItemId: item._id,
        name: form.name,
        category: form.category,
        unit: form.unit,
        reorderLevel: Number(form.reorderLevel),
        isActive: form.isActive === 'active',
        actor,
        notes: form.notes || undefined,
      });
      setMessage({ type: 'success', text: 'Inventory item updated successfully.' });
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to update inventory item.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Edit Item: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Item Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value as Category })} options={categories} />
          <Select label="Status" value={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} options={['active', 'inactive']} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Unit" value={form.unit} onChange={(value) => setForm({ ...form, unit: value })} required />
          <Input label="Reorder Level" type="number" value={form.reorderLevel} onChange={(value) => setForm({ ...form, reorderLevel: value })} required />
        </div>
        <TextArea label="Reason / Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Save Changes" />
      </form>
    </ModalShell>
  );
}

function StockInModal({ item, actor, stockIn, onClose, setMessage }: { item: any; actor: string; stockIn: any; onClose: () => void; setMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>> }) {
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState(String(item.lastUnitCost || item.averageUnitCost || 0));
  const [notes, setNotes] = useState('Manual stock in');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await stockIn({ inventoryItemId: item._id, quantity: Number(quantity), unitCost: Number(unitCost), actor, notes: notes || undefined });
      setMessage({ type: 'success', text: 'Stock added successfully.' });
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to add stock.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Stock In: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-brand-text-muted">Current stock: <strong>{formatNumber(item.currentStock)} {item.unit}</strong></p>
        <Input label={`Quantity Received (${item.unit})`} type="number" value={quantity} onChange={setQuantity} required />
        <Input label="Unit Cost" type="number" value={unitCost} onChange={setUnitCost} required />
        <TextArea label="Reason / Notes" value={notes} onChange={setNotes} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Add Stock" />
      </form>
    </ModalShell>
  );
}

function AdjustStockModal({ item, actor, adjustStock, onClose, setMessage }: { item: any; actor: string; adjustStock: any; onClose: () => void; setMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>> }) {
  const [newStock, setNewStock] = useState(String(item.currentStock));
  const [notes, setNotes] = useState('Manual stock count correction');
  const [saving, setSaving] = useState(false);

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
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Adjust Stock: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-brand-text-muted">Current stock: <strong>{formatNumber(item.currentStock)} {item.unit}</strong></p>
        <Input label={`New Exact Stock (${item.unit})`} type="number" value={newStock} onChange={setNewStock} required />
        <TextArea label="Required Reason / Notes" value={notes} onChange={setNotes} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Save Adjustment" />
      </form>
    </ModalShell>
  );
}

function WasteModal({ item, actor, recordWaste, onClose, setMessage }: { item: any; actor: string; recordWaste: any; onClose: () => void; setMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>> }) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('Spoilage / waste recorded');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const confirmed = window.confirm(`Record ${quantity} ${item.unit} of ${item.name} as waste? This will deduct stock.`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await recordWaste({ inventoryItemId: item._id, quantity: Number(quantity), actor, notes });
      setMessage({ type: 'success', text: 'Waste recorded successfully.' });
      onClose();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to record waste.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Record Waste: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-brand-text-muted">Current stock: <strong>{formatNumber(item.currentStock)} {item.unit}</strong></p>
        <Input label={`Waste Quantity (${item.unit})`} type="number" value={quantity} onChange={setQuantity} required />
        <TextArea label="Required Reason / Notes" value={notes} onChange={setNotes} />
        <ModalActions onClose={onClose} saving={saving} submitLabel="Record Waste" danger />
      </form>
    </ModalShell>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">{label}</label>
      <input type={type} required={required} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40">
        {options.map((option) => (
          <option key={option} value={option}>{niceLabel(option)}</option>
        ))}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
    </div>
  );
}

function ModalActions({ onClose, saving, submitLabel, danger }: { onClose: () => void; saving: boolean; submitLabel: string; danger?: boolean }) {
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
