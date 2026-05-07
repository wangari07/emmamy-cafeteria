import React, { useMemo, useState } from 'react';
import {
  Plus,
  Receipt,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  RefreshCcw,
  Eye,
  Trash2,
  ShoppingCart,
  PackageCheck,
} from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';

type CampusCode = 'MAIN_SCHOOL' | 'DIGITAL_SCHOOL';

type InventoryCategory =
  | 'LUNCH'
  | 'SNACK'
  | 'DRINK'
  | 'FRUIT'
  | 'TEA'
  | 'SUPPLY'
  | 'OTHER';

type ReceiptStatus =
  | 'DRAFT'
  | 'UPLOADED'
  | 'AI_EXTRACTED'
  | 'NEEDS_REVIEW'
  | 'REVIEWED'
  | 'APPROVED'
  | 'REJECTED';

const campuses: CampusCode[] = ['MAIN_SCHOOL', 'DIGITAL_SCHOOL'];

const categories: InventoryCategory[] = [
  'LUNCH',
  'TEA',
  'SNACK',
  'FRUIT',
  'DRINK',
  'SUPPLY',
  'OTHER',
];

const receiptStatuses: ReceiptStatus[] = [
  'DRAFT',
  'UPLOADED',
  'AI_EXTRACTED',
  'NEEDS_REVIEW',
  'REVIEWED',
  'APPROVED',
  'REJECTED',
];

function userCampusToInventoryCampus(value?: string | null): CampusCode | undefined {
  if (value === 'main') return 'MAIN_SCHOOL';
  if (value === 'digital') return 'DIGITAL_SCHOOL';
  return undefined;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekStartAndEnd() {
  const date = new Date();
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    weekStartDate: monday.toISOString().slice(0, 10),
    weekEndDate: sunday.toISOString().slice(0, 10),
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function Purchases() {
  const { user } = useAuth();
  const appUserId = (user as any)?._id as Id<'appUsers'> | undefined;
  const actor = user?.name || user?.email || 'Unknown user';

  const defaultCampus = userCampusToInventoryCampus(user?.school);

  const [campusFilter, setCampusFilter] = useState<CampusCode | 'All'>(
    defaultCampus || 'All'
  );
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | 'All'>('All');
  const [weekStartFilter, setWeekStartFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedBatchId, setSelectedBatchId] =
    useState<Id<'purchaseBatches'> | null>(null);

  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const batches = useQuery(api.purchases.listBatches, {
    campusCode: campusFilter === 'All' ? undefined : campusFilter,
    receiptStatus: statusFilter === 'All' ? undefined : statusFilter,
    weekStartDate: weekStartFilter || undefined,
    limit: 100,
  });

  const selectedBatch = useQuery(
    api.purchases.getBatch,
    selectedBatchId ? { purchaseBatchId: selectedBatchId } : 'skip'
  );

  const inventoryItems = useQuery(api.inventory.listItems, {
    campusCode:
      selectedBatch?.campusCode ||
      (campusFilter === 'All' ? undefined : campusFilter),
    activeOnly: true,
  });

  const createBatch = useMutation(api.purchases.createBatch);
  const addItem = useMutation(api.purchases.addItem);
  const deleteItem = useMutation(api.purchases.deleteItem);
  const markReviewed = useMutation(api.purchases.markReviewed);
  const approveBatch = useMutation(api.purchases.approveBatch);
  const rejectBatch = useMutation(api.purchases.rejectBatch);

  const filteredBatches = useMemo(() => {
    let rows = [...(batches ?? [])];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();

      rows = rows.filter(
        (batch) =>
          batch.batchNumber.toLowerCase().includes(term) ||
          (batch.supplierName ?? '').toLowerCase().includes(term) ||
          (batch.enteredByName ?? '').toLowerCase().includes(term)
      );
    }

    return rows;
  }, [batches, searchTerm]);

  const openBatch = (batchId: Id<'purchaseBatches'>) => {
    setSelectedBatchId(batchId);
    setShowBatchDetailsModal(true);
    setMessage(null);
  };

  const openAddItem = (batchId: Id<'purchaseBatches'>) => {
    setSelectedBatchId(batchId);
    setShowAddItemModal(true);
    setMessage(null);
  };

  const handleMarkReviewed = async (batchId: Id<'purchaseBatches'>) => {
    try {
      await markReviewed({
        purchaseBatchId: batchId,
        actor,
        notes: 'Purchase batch reviewed from purchases page',
      });

      setMessage({
        type: 'success',
        text: 'Purchase batch marked as reviewed.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to mark purchase batch as reviewed.',
      });
    }
  };

  const handleApprove = async (batchId: Id<'purchaseBatches'>) => {
    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your logged-in user record was not found. Please sign in again.',
      });
      return;
    }

    const confirmed = window.confirm(
      'Approve this purchase batch? This will add linked items into inventory stock.'
    );

    if (!confirmed) return;

    try {
      await approveBatch({
        purchaseBatchId: batchId,
        approvedByUserId: appUserId,
        actor,
        notes: 'Purchase batch approved from purchases page',
      });

      setMessage({
        type: 'success',
        text: 'Purchase batch approved. Inventory stock has been updated.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to approve purchase batch.',
      });
    }
  };

  const handleReject = async (batchId: Id<'purchaseBatches'>) => {
    const confirmed = window.confirm('Reject this purchase batch?');

    if (!confirmed) return;

    try {
      await rejectBatch({
        purchaseBatchId: batchId,
        actor,
        notes: 'Purchase batch rejected from purchases page',
      });

      setMessage({
        type: 'success',
        text: 'Purchase batch rejected.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to reject purchase batch.',
      });
    }
  };

  const totalSubmitted = filteredBatches.reduce(
    (sum, batch) => sum + (batch.totalAmount ?? 0),
    0
  );

  const approvedTotal = filteredBatches
    .filter((batch) => batch.receiptStatus === 'APPROVED')
    .reduce((sum, batch) => sum + (batch.totalAmount ?? 0), 0);

  const pendingReviewCount = filteredBatches.filter((batch) =>
    ['DRAFT', 'UPLOADED', 'AI_EXTRACTED', 'NEEDS_REVIEW', 'REVIEWED'].includes(
      batch.receiptStatus
    )
  ).length;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">
            Purchases / Weekly Shopping
          </h1>
          <p className="text-brand-text-muted mt-1">
            Record weekly receipts, link items to inventory, approve purchases, and update stock.
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateBatchModal(true);
            setMessage(null);
          }}
          className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          New Purchase Batch
        </button>
      </div>

      {!appUserId && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-amber-900">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium">
            I cannot find your app user ID in the login context. Creating and approving purchases needs this ID.
            If buttons fail, we’ll fix the AuthContext user object next.
          </p>
        </div>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={Receipt}
          label="Purchase Batches"
          value={filteredBatches.length}
          subtext="Visible batches"
        />
        <SummaryCard
          icon={ShoppingCart}
          label="Submitted Cost"
          value={formatMoney(totalSubmitted)}
          subtext="All visible batches"
        />
        <SummaryCard
          icon={PackageCheck}
          label="Approved Stock-In"
          value={formatMoney(approvedTotal)}
          subtext="Already entered inventory"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Pending Review"
          value={pendingReviewCount}
          subtext="Needs attention"
          warning={pendingReviewCount > 0}
        />
      </div>

      <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full xl:w-96">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search batch number, supplier, staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-auto">
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value as CampusCode | 'All')}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            <option value="All">All Campuses</option>
            {campuses.map((campus) => (
              <option key={campus} value={campus}>
                {campus.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReceiptStatus | 'All')}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            <option value="All">All Statuses</option>
            {receiptStatuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={weekStartFilter}
            onChange={(e) => setWeekStartFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
            title="Filter by week start date"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  Campus
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  Week
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {batches === undefined ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-brand-text-muted">
                    Loading purchases...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-brand-text-muted">
                    No purchase batches found.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => (
                  <tr key={batch._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-brand-text">
                        {batch.batchNumber}
                      </p>
                      <p className="text-xs text-brand-text-muted">
                        Entered by {batch.enteredByName}
                      </p>
                      <p className="text-xs text-brand-text-muted">
                        {formatDate(batch.createdAt)}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text-muted">
                      {batch.campusCode.replace('_', ' ')}
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text">
                      {batch.supplierName || '—'}
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text-muted">
                      {batch.weekStartDate}
                      <br />
                      <span className="text-xs">to {batch.weekEndDate}</span>
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text">
                      {batch.itemCount}
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold text-brand-text">
                      {formatMoney(batch.totalAmount)}
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={batch.receiptStatus} />
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => openBatch(batch._id)}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 text-brand-text text-xs font-semibold hover:bg-gray-200 inline-flex items-center gap-1"
                        >
                          <Eye size={14} />
                          View
                        </button>

                        {!['APPROVED', 'REJECTED'].includes(batch.receiptStatus) && (
                          <button
                            onClick={() => openAddItem(batch._id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                          >
                            Add Item
                          </button>
                        )}

                        {!['APPROVED', 'REJECTED'].includes(batch.receiptStatus) && (
                          <button
                            onClick={() => handleMarkReviewed(batch._id)}
                            className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100"
                          >
                            Review
                          </button>
                        )}

                        {!['APPROVED', 'REJECTED'].includes(batch.receiptStatus) && (
                          <button
                            onClick={() => handleApprove(batch._id)}
                            className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100"
                          >
                            Approve
                          </button>
                        )}

                        {!['APPROVED', 'REJECTED'].includes(batch.receiptStatus) && (
                          <button
                            onClick={() => handleReject(batch._id)}
                            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30">
          <p className="text-sm text-brand-text-muted">
            Showing {filteredBatches.length} purchase batch
            {filteredBatches.length === 1 ? '' : 'es'}.
          </p>
        </div>
      </div>

      {showCreateBatchModal && appUserId && (
        <CreateBatchModal
          appUserId={appUserId}
          actor={actor}
          createBatch={createBatch}
          onClose={() => setShowCreateBatchModal(false)}
          setMessage={setMessage}
        />
      )}

      {showAddItemModal && selectedBatch && inventoryItems && (
        <AddPurchaseItemModal
          batch={selectedBatch}
          inventoryItems={inventoryItems}
          addItem={addItem}
          actor={actor}
          onClose={() => setShowAddItemModal(false)}
          setMessage={setMessage}
        />
      )}

      {showBatchDetailsModal && selectedBatch && (
        <BatchDetailsModal
          batch={selectedBatch}
          deleteItem={deleteItem}
          actor={actor}
          onAddItem={() => {
            setShowBatchDetailsModal(false);
            setShowAddItemModal(true);
          }}
          onClose={() => setShowBatchDetailsModal(false)}
          setMessage={setMessage}
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
          <p
            className={`text-2xl font-bold mt-1 ${
              warning ? 'text-amber-700' : 'text-brand-text'
            }`}
          >
            {value}
          </p>
          <p className="text-xs text-brand-text-muted mt-1">{subtext}</p>
        </div>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            warning
              ? 'bg-amber-50 text-amber-700'
              : 'bg-brand-primary/20 text-brand-primary'
          }`}
        >
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReceiptStatus }) {
  const map: Record<
    ReceiptStatus,
    {
      label: string;
      className: string;
    }
  > = {
    DRAFT: {
      label: 'Draft',
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    },
    UPLOADED: {
      label: 'Uploaded',
      className: 'bg-blue-50 text-blue-700 border-blue-100',
    },
    AI_EXTRACTED: {
      label: 'AI Extracted',
      className: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    },
    NEEDS_REVIEW: {
      label: 'Needs Review',
      className: 'bg-amber-50 text-amber-700 border-amber-100',
    },
    REVIEWED: {
      label: 'Reviewed',
      className: 'bg-purple-50 text-purple-700 border-purple-100',
    },
    APPROVED: {
      label: 'Approved',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    REJECTED: {
      label: 'Rejected',
      className: 'bg-red-50 text-red-700 border-red-100',
    },
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${map[status].className}`}
    >
      {map[status].label}
    </span>
  );
}

function ModalShell({
  title,
  children,
  onClose,
  maxWidth = 'max-w-xl',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`bg-white rounded-2xl p-6 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-brand-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function CreateBatchModal({
  appUserId,
  actor,
  createBatch,
  onClose,
  setMessage,
}: {
  appUserId: Id<'appUsers'>;
  actor: string;
  createBatch: any;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const week = getWeekStartAndEnd();

  const [form, setForm] = useState({
    campusCode: 'MAIN_SCHOOL' as CampusCode,
    supplierName: '',
    shoppingDate: todayDate(),
    weekStartDate: week.weekStartDate,
    weekEndDate: week.weekEndDate,
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      await createBatch({
        enteredByUserId: appUserId,
        campusCode: form.campusCode,
        supplierName: form.supplierName || undefined,
        receiptEntryMode: 'MANUAL',
        shoppingDate: form.shoppingDate,
        weekStartDate: form.weekStartDate,
        weekEndDate: form.weekEndDate,
        notes: form.notes || undefined,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Purchase batch created. You can now add receipt items.',
      });

      onClose();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to create purchase batch.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="New Purchase Batch" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Campus"
          value={form.campusCode}
          options={campuses}
          onChange={(value) => setForm({ ...form, campusCode: value as CampusCode })}
        />

        <Input
          label="Supplier Name"
          value={form.supplierName}
          onChange={(value) => setForm({ ...form, supplierName: value })}
          placeholder="e.g. Naivas, Local market, Butchery..."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Shopping Date"
            type="date"
            value={form.shoppingDate}
            onChange={(value) => setForm({ ...form, shoppingDate: value })}
            required
          />

          <Input
            label="Week Start"
            type="date"
            value={form.weekStartDate}
            onChange={(value) => setForm({ ...form, weekStartDate: value })}
            required
          />

          <Input
            label="Week End"
            type="date"
            value={form.weekEndDate}
            onChange={(value) => setForm({ ...form, weekEndDate: value })}
            required
          />
        </div>

        <TextArea
          label="Notes"
          value={form.notes}
          onChange={(value) => setForm({ ...form, notes: value })}
        />

        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel="Create Batch"
        />
      </form>
    </ModalShell>
  );
}

function AddPurchaseItemModal({
  batch,
  inventoryItems,
  addItem,
  actor,
  onClose,
  setMessage,
}: {
  batch: any;
  inventoryItems: any[];
  addItem: any;
  actor: string;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const [form, setForm] = useState({
    inventoryItemId: '',
    itemNameRaw: '',
    normalizedItemName: '',
    category: 'LUNCH' as InventoryCategory,
    quantity: '',
    unit: '',
    totalCost: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  const selectedInventoryItem = inventoryItems.find(
    (item) => item._id === form.inventoryItemId
  );

  const handleInventorySelect = (inventoryItemId: string) => {
    const item = inventoryItems.find((row) => row._id === inventoryItemId);

    if (!item) {
      setForm({
        ...form,
        inventoryItemId,
      });
      return;
    }

    setForm({
      ...form,
      inventoryItemId,
      itemNameRaw: item.name,
      normalizedItemName: item.name,
      category: item.category,
      unit: item.unit,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      await addItem({
        purchaseBatchId: batch._id,
        inventoryItemId: form.inventoryItemId
          ? (form.inventoryItemId as Id<'inventoryItems'>)
          : null,
        itemNameRaw: form.itemNameRaw,
        normalizedItemName: form.normalizedItemName || form.itemNameRaw,
        category: form.category,
        quantity: Number(form.quantity),
        unit: form.unit,
        totalCost: Number(form.totalCost),
        notes: form.notes || undefined,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Purchase item added successfully.',
      });

      onClose();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to add purchase item.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Add Item to ${batch.batchNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">
          Link the receipt item to an inventory item. Approval will only work if every purchase item is linked.
        </div>

        <Select
          label="Link to Inventory Item"
          value={form.inventoryItemId}
          onChange={handleInventorySelect}
          options={[
            '',
            ...inventoryItems.map((item) => item._id),
          ]}
          renderLabel={(value) => {
            if (!value) return 'Select inventory item...';
            const item = inventoryItems.find((row) => row._id === value);
            return item
              ? `${item.name} — ${item.currentStock} ${item.unit}`
              : value;
          }}
        />

        {selectedInventoryItem && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm text-brand-text-muted">
            Current stock:{' '}
            <strong>
              {selectedInventoryItem.currentStock} {selectedInventoryItem.unit}
            </strong>
            {' '}| Avg cost:{' '}
            <strong>{formatMoney(selectedInventoryItem.averageUnitCost ?? 0)}</strong>
          </div>
        )}

        <Input
          label="Receipt Item Name"
          value={form.itemNameRaw}
          onChange={(value) => setForm({ ...form, itemNameRaw: value })}
          required
        />

        <Input
          label="Normalized Name"
          value={form.normalizedItemName}
          onChange={(value) => setForm({ ...form, normalizedItemName: value })}
          placeholder="Clean name used in reports"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category"
            value={form.category}
            options={categories}
            onChange={(value) =>
              setForm({ ...form, category: value as InventoryCategory })
            }
          />

          <Input
            label="Unit"
            value={form.unit}
            onChange={(value) => setForm({ ...form, unit: value })}
            placeholder="kg, pcs, litres..."
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(value) => setForm({ ...form, quantity: value })}
            required
          />

          <Input
            label="Total Cost"
            type="number"
            value={form.totalCost}
            onChange={(value) => setForm({ ...form, totalCost: value })}
            required
          />
        </div>

        <TextArea
          label="Notes"
          value={form.notes}
          onChange={(value) => setForm({ ...form, notes: value })}
        />

        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel="Add Purchase Item"
        />
      </form>
    </ModalShell>
  );
}

function BatchDetailsModal({
  batch,
  deleteItem,
  actor,
  onAddItem,
  onClose,
  setMessage,
}: {
  batch: any;
  deleteItem: any;
  actor: string;
  onAddItem: () => void;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const handleDeleteItem = async (purchaseItemId: Id<'purchaseItems'>) => {
    const confirmed = window.confirm('Delete this purchase item?');

    if (!confirmed) return;

    try {
      await deleteItem({
        purchaseItemId,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Purchase item deleted.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to delete purchase item.',
      });
    }
  };

  return (
    <ModalShell title={`Purchase Batch: ${batch.batchNumber}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InfoBox label="Campus" value={batch.campusCode.replace('_', ' ')} />
          <InfoBox label="Supplier" value={batch.supplierName || '—'} />
          <InfoBox label="Total" value={formatMoney(batch.totalAmount)} />
          <InfoBox label="Status" value={batch.receiptStatus.replaceAll('_', ' ')} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InfoBox label="Shopping Date" value={batch.shoppingDate} />
          <InfoBox label="Week Start" value={batch.weekStartDate} />
          <InfoBox label="Week End" value={batch.weekEndDate} />
        </div>

        {batch.notes && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold mb-1">
              Notes
            </p>
            <p className="text-sm text-brand-text">{batch.notes}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-brand-text">Receipt Items</h3>

          {!['APPROVED', 'REJECTED'].includes(batch.receiptStatus) && (
            <button
              onClick={onAddItem}
              className="px-3 py-1.5 rounded-lg bg-brand-primary text-brand-navy text-xs font-bold hover:bg-brand-primary-hover inline-flex items-center gap-1"
            >
              <Plus size={14} />
              Add Item
            </button>
          )}
        </div>

        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Item
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Linked Inventory
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Qty
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Unit Cost
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Total
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {batch.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-brand-text-muted">
                    No purchase items added yet.
                  </td>
                </tr>
              ) : (
                batch.items.map((item: any) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-brand-text">
                        {item.normalizedItemName}
                      </p>
                      <p className="text-xs text-brand-text-muted">
                        Receipt: {item.itemNameRaw}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      {item.inventoryItemId ? (
                        <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {item.inventoryItemName || 'Linked'}
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                          Not linked
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-brand-text">
                      {item.quantity} {item.unit}
                    </td>

                    <td className="px-4 py-3 text-sm text-brand-text">
                      {formatMoney(item.unitCost)}
                    </td>

                    <td className="px-4 py-3 text-sm font-semibold text-brand-text">
                      {formatMoney(item.totalCost)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {!['APPROVED', 'REJECTED'].includes(batch.receiptStatus) && (
                        <button
                          onClick={() => handleDeleteItem(item._id)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 inline-flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-brand-text font-semibold hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function InfoBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
      <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold">
        {label}
      </p>
      <p className="text-sm font-semibold text-brand-text mt-1">{value}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">
        {label}
      </label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  renderLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  renderLabel?: (value: string) => string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
      >
        {options.map((option) => (
          <option key={option || 'empty'} value={option}>
            {renderLabel ? renderLabel(option) : option.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
      />
    </div>
  );
}

function ModalActions({
  onClose,
  saving,
  submitLabel,
}: {
  onClose: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-4">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-lg font-bold inline-flex items-center gap-2 disabled:opacity-60 bg-brand-primary text-brand-navy hover:bg-brand-primary-hover"
      >
        {saving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}