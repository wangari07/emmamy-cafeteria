import React, { useEffect, useMemo, useState } from 'react';
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
  Upload,
  FileText,
  ExternalLink,
  Archive,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { useAction, useMutation, useQuery } from 'convex/react';
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

function niceLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function canEditBatch(status: ReceiptStatus) {
  return !['APPROVED', 'REJECTED'].includes(status);
}

function confidenceLabel(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}

export function Purchases() {
  const { user } = useAuth();

  const appUserId = (
    (user as any)?._id ||
    (user as any)?.id ||
    (user as any)?.userId ||
    (user as any)?.appUserId
  ) as Id<'appUsers'> | undefined;

  const actor = user?.name || user?.email || 'Unknown user';
  const isSuperAdmin = user?.role === 'super_admin';
  const defaultCampus = userCampusToInventoryCampus(user?.school);

  const [campusFilter, setCampusFilter] = useState<CampusCode | 'All'>(
    defaultCampus || 'All'
  );
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | 'All'>('All');
  const [showArchived, setShowArchived] = useState(false);
  const [weekStartFilter, setWeekStartFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedBatchId, setSelectedBatchId] =
    useState<Id<'purchaseBatches'> | null>(null);
  const [selectedPurchaseItem, setSelectedPurchaseItem] = useState<any | null>(null);

  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);
  const [showUploadReceiptModal, setShowUploadReceiptModal] = useState(false);
  const [extractingBatchId, setExtractingBatchId] = useState<string | null>(null);
  const [receivingBatchId, setReceivingBatchId] = useState<string | null>(null);

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const batches = useQuery(api.purchases.listBatches, {
    campusCode: campusFilter === 'All' ? undefined : campusFilter,
    receiptStatus: statusFilter === 'All' ? undefined : statusFilter,
    weekStartDate: weekStartFilter || undefined,
    deletedOnly: showArchived && isSuperAdmin ? true : undefined,
    includeDeleted: showArchived && isSuperAdmin ? true : undefined,
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
  const updateItem = useMutation((api.purchases as any).updateItem);
  const deleteItem = useMutation(api.purchases.deleteItem);
  const receiveBatchToInventory = useMutation(
    (api.purchases as any).receiveBatchToInventory
  );
  const rejectBatch = useMutation(api.purchases.rejectBatch);
  const softDeleteBatch = useMutation((api.purchases as any).softDeleteBatch);
  const restoreBatch = useMutation((api.purchases as any).restoreBatch);

  const generateReceiptUploadUrl = useMutation(
    (api.purchases as any).generateReceiptUploadUrl
  );

  const attachReceiptToBatch = useMutation(
    (api.purchases as any).attachReceiptToBatch
  );

  const extractReceiptWithAi = useAction((api.purchases as any).extractReceiptWithAi);

  const filteredBatches = useMemo(() => {
    let rows = [...(batches ?? [])];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();

      rows = rows.filter(
        (batch) =>
          batch.batchNumber.toLowerCase().includes(term) ||
          (batch.supplierName ?? '').toLowerCase().includes(term) ||
          (batch.enteredByName ?? '').toLowerCase().includes(term) ||
          (batch.receiptFileName ?? '').toLowerCase().includes(term)
      );
    }

    return rows;
  }, [batches, searchTerm]);

  const openBatch = (batchId: Id<'purchaseBatches'>) => {
    setSelectedBatchId(batchId);
    setSelectedPurchaseItem(null);
    setShowBatchDetailsModal(true);
    setMessage(null);
  };

  const openEditItem = (item: any) => {
    setSelectedPurchaseItem(item);
    setMessage(null);
  };

  const openUploadReceipt = (batchId: Id<'purchaseBatches'>) => {
    setSelectedBatchId(batchId);
    setShowUploadReceiptModal(true);
    setMessage(null);
  };

  const viewReceipt = (url?: string | null) => {
    if (!url) {
      setMessage({
        type: 'error',
        text: 'No receipt file is attached to this purchase batch yet.',
      });
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNewBatchClick = () => {
    setMessage(null);

    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your user ID is missing from the login session. We need to fix AuthContext next.',
      });
      return;
    }

    setShowCreateBatchModal(true);
  };

  const handleExtractReceipt = async (batchId: Id<'purchaseBatches'>) => {
    try {
      setExtractingBatchId(batchId);
      setMessage(null);

      const result = await extractReceiptWithAi({
        purchaseBatchId: batchId,
        actor,
      });

      setMessage({
        type: 'success',
        text: `AI extracted ${result?.savedCount ?? 0} receipt item(s). Open the batch, review/link each row, then click Confirm Receive Stock.`,
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to extract receipt with AI.',
      });
    } finally {
      setExtractingBatchId(null);
    }
  };

  const handleReceiveStock = async (batchId: Id<'purchaseBatches'>) => {
    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your logged-in user record was not found. Please sign in again.',
      });
      return;
    }

    const confirmed = window.confirm(
      'Confirm receiving this stock into inventory? This will update inventory quantities and create stock movement records.'
    );

    if (!confirmed) return;

    try {
      setReceivingBatchId(batchId);
      setMessage(null);

      const result = await receiveBatchToInventory({
        purchaseBatchId: batchId,
        receivedByUserId: appUserId,
        actor,
        notes: 'Receipt received into inventory from purchases offloading dock',
      });

      setMessage({
        type: 'success',
        text: `Stock received successfully. ${result?.receivedItemCount ?? 'All'} item(s) were added to inventory.`,
      });

      setSelectedPurchaseItem(null);
      setShowBatchDetailsModal(false);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to receive stock into inventory.',
      });
    } finally {
      setReceivingBatchId(null);
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

  const handleArchiveBatch = async (batchId: Id<'purchaseBatches'>) => {
    if (!appUserId || !isSuperAdmin) {
      setMessage({
        type: 'error',
        text: 'Only a super admin can archive/delete purchase batches.',
      });
      return;
    }

    const reason = window.prompt(
      'Why are you archiving/deleting this purchase batch? This will hide it from the normal Purchases page.'
    );

    if (!reason || !reason.trim()) return;

    try {
      await softDeleteBatch({
        purchaseBatchId: batchId,
        deletedByUserId: appUserId,
        reason: reason.trim(),
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Purchase batch archived/deleted. It is now hidden from the normal Purchases list.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to archive/delete purchase batch.',
      });
    }
  };

  const handleRestoreBatch = async (batchId: Id<'purchaseBatches'>) => {
    if (!appUserId || !isSuperAdmin) {
      setMessage({
        type: 'error',
        text: 'Only a super admin can restore purchase batches.',
      });
      return;
    }

    const confirmed = window.confirm(
      'Restore this archived purchase batch back to the normal Purchases list?'
    );

    if (!confirmed) return;

    try {
      await restoreBatch({
        purchaseBatchId: batchId,
        restoredByUserId: appUserId,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Purchase batch restored.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to restore purchase batch.',
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

  const uploadedReceiptCount = filteredBatches.filter(
    (batch) => Boolean(batch.receiptImageUrl)
  ).length;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">
            Purchases Offloading Dock
          </h1>
          <p className="text-brand-text-muted mt-1">
            Upload a receipt, let AI extract the items, review/link the rows, then receive stock into inventory.
          </p>
        </div>

        <button
          onClick={handleNewBatchClick}
          className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          New Receipt Intake
        </button>
      </div>

      {!appUserId && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-amber-900">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium">
            I cannot find your app user ID in the login context. Creating and receiving purchases needs this ID.
            If buttons fail, we’ll fix AuthContext next.
          </p>
        </div>
      )}

      {isSuperAdmin && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm">
          <div>
            <p className="text-sm font-bold text-brand-text">Super Admin Batch Management</p>
            <p className="text-xs text-brand-text-muted mt-1">
              Normal view hides archived batches. Switch to archived/deleted batches to restore old records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowArchived((value) => !value);
              setSelectedBatchId(null);
              setSelectedPurchaseItem(null);
              setMessage(null);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 ${
              showArchived
                ? 'bg-red-50 text-red-700 border border-red-100 hover:bg-red-100'
                : 'bg-gray-100 text-brand-text border border-gray-200 hover:bg-gray-200'
            }`}
          >
            <Archive size={16} />
            {showArchived ? 'Viewing Archived Batches' : 'Show Archived Batches'}
          </button>
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard icon={Receipt} label="Purchase Batches" value={filteredBatches.length} subtext="Visible batches" />
        <SummaryCard icon={FileText} label="Receipts Uploaded" value={uploadedReceiptCount} subtext="Attached proof files" />
        <SummaryCard icon={ShoppingCart} label="Submitted Cost" value={formatMoney(totalSubmitted)} subtext="All visible batches" />
        <SummaryCard icon={PackageCheck} label="Approved Stock-In" value={formatMoney(approvedTotal)} subtext="Already entered inventory" />
        <SummaryCard icon={AlertTriangle} label="Pending Review" value={pendingReviewCount} subtext="Needs attention" warning={pendingReviewCount > 0} />
      </div>

      <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full xl:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search batch, supplier, staff, receipt..."
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
              <option key={campus} value={campus}>{niceLabel(campus)}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReceiptStatus | 'All')}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            <option value="All">All Statuses</option>
            {receiptStatuses.map((status) => (
              <option key={status} value={status}>{niceLabel(status)}</option>
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
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Batch</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Campus</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Receipt</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Week</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Items</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {batches === undefined ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-brand-text-muted">
                    Loading purchases...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-brand-text-muted">
                    No purchase batches found.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const extracting = extractingBatchId === batch._id;

                  return (
                    <tr key={batch._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-brand-text">{batch.batchNumber}</p>
                        <p className="text-xs text-brand-text-muted">Entered by {batch.enteredByName}</p>
                        <p className="text-xs text-brand-text-muted">{formatDate(batch.createdAt)}</p>
                        {batch.isDeleted && (
                          <p className="mt-1 text-xs font-semibold text-red-700">Archived</p>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-brand-text-muted">
                        {niceLabel(batch.campusCode)}
                      </td>

                      <td className="px-6 py-4 text-sm text-brand-text">
                        {batch.supplierName || '—'}
                      </td>

                      <td className="px-6 py-4">
                        {batch.receiptImageUrl ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => viewReceipt(batch.receiptImageUrl)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                            >
                              <FileText size={14} /> View Receipt
                            </button>
                            <p className="text-[11px] text-brand-text-muted max-w-[160px] truncate">
                              {batch.receiptFileName || 'Uploaded receipt'}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            No receipt
                          </span>
                        )}
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
                            className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                              canEditBatch(batch.receiptStatus) && !batch.isDeleted && batch.itemCount > 0
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                : 'bg-gray-100 text-brand-text hover:bg-gray-200'
                            }`}
                          >
                            <Eye size={14} />
                            {canEditBatch(batch.receiptStatus) && !batch.isDeleted && batch.itemCount > 0
                              ? 'Review & Receive'
                              : 'View'}
                          </button>

                          {canEditBatch(batch.receiptStatus) && !batch.isDeleted && !batch.receiptImageUrl && (
                            <button
                              onClick={() => openUploadReceipt(batch._id)}
                              className="px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-100 text-xs font-bold hover:bg-amber-100 inline-flex items-center gap-1.5"
                            >
                              <Upload size={14} /> Upload Receipt
                            </button>
                          )}

                          {canEditBatch(batch.receiptStatus) && !batch.isDeleted && batch.receiptImageUrl && batch.itemCount === 0 && (
                            <button
                              disabled={extracting}
                              onClick={() => handleExtractReceipt(batch._id)}
                              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 inline-flex items-center gap-1.5 disabled:opacity-60 shadow-sm"
                            >
                              {extracting ? <RefreshCcw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                              {extracting ? 'Extracting' : 'Extract AI'}
                            </button>
                          )}

                          {canEditBatch(batch.receiptStatus) && !batch.isDeleted && batch.receiptImageUrl && batch.itemCount > 0 && (
                            <button
                              onClick={() => openUploadReceipt(batch._id)}
                              className="px-3 py-2 rounded-xl bg-gray-50 text-brand-text border border-gray-200 text-xs font-semibold hover:bg-gray-100 inline-flex items-center gap-1.5"
                            >
                              <Upload size={14} /> Replace Receipt
                            </button>
                          )}

                          {canEditBatch(batch.receiptStatus) && !batch.isDeleted && (
                            <button
                              onClick={() => handleReject(batch._id)}
                              className="px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-100 text-xs font-semibold hover:bg-red-100"
                            >
                              Reject
                            </button>
                          )}

                          {isSuperAdmin && !batch.isDeleted && (
                            <button
                              onClick={() => handleArchiveBatch(batch._id)}
                              className="px-3 py-2 rounded-xl bg-gray-50 text-red-700 border border-gray-200 text-xs font-semibold hover:bg-red-50 inline-flex items-center gap-1.5"
                            >
                              <Trash2 size={14} /> Archive
                            </button>
                          )}

                          {isSuperAdmin && batch.isDeleted && (
                            <button
                              onClick={() => handleRestoreBatch(batch._id)}
                              className="px-3 py-2 rounded-xl bg-green-50 text-green-700 border border-green-100 text-xs font-semibold hover:bg-green-100 inline-flex items-center gap-1.5"
                            >
                              <RefreshCcw size={14} /> Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30">
          <p className="text-sm text-brand-text-muted">
            Showing {filteredBatches.length} purchase batch{filteredBatches.length === 1 ? '' : 'es'}.
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

      {showUploadReceiptModal && selectedBatch && (
        <UploadReceiptModal
          batch={selectedBatch}
          actor={actor}
          generateReceiptUploadUrl={generateReceiptUploadUrl}
          attachReceiptToBatch={attachReceiptToBatch}
          onClose={() => setShowUploadReceiptModal(false)}
          setMessage={setMessage}
        />
      )}

      {showBatchDetailsModal && selectedBatch && (
        <BatchDetailsModal
          batch={selectedBatch}
          deleteItem={deleteItem}
          updateItem={updateItem}
          inventoryItems={inventoryItems ?? []}
          selectedPurchaseItem={selectedPurchaseItem}
          setSelectedPurchaseItem={setSelectedPurchaseItem}
          actor={actor}
          extracting={extractingBatchId === selectedBatch._id}
          receiving={receivingBatchId === selectedBatch._id}
          onExtractReceipt={() => handleExtractReceipt(selectedBatch._id)}
          onReceiveStock={() => handleReceiveStock(selectedBatch._id)}
          onEditItem={openEditItem}
          addItem={addItem}
          onAddItem={() => {
            setSelectedPurchaseItem({ __isNew: true });
          }}
          onUploadReceipt={() => {
            setShowBatchDetailsModal(false);
            setShowUploadReceiptModal(true);
          }}
          onViewReceipt={() => viewReceipt(selectedBatch.receiptImageUrl)}
          onClose={() => {
            setSelectedPurchaseItem(null);
            setShowBatchDetailsModal(false);
          }}
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
          <p className={`text-2xl font-bold mt-1 ${warning ? 'text-amber-700' : 'text-brand-text'}`}>
            {value}
          </p>
          <p className="text-xs text-brand-text-muted mt-1">{subtext}</p>
        </div>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            warning ? 'bg-amber-50 text-amber-700' : 'bg-brand-primary/20 text-brand-primary'
          }`}
        >
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReceiptStatus }) {
  const map: Record<ReceiptStatus, { label: string; className: string }> = {
    DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    UPLOADED: { label: 'Uploaded', className: 'bg-blue-50 text-blue-700 border-blue-100' },
    AI_EXTRACTED: { label: 'AI Extracted', className: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    NEEDS_REVIEW: { label: 'Needs Review', className: 'bg-amber-50 text-amber-700 border-amber-100' },
    REVIEWED: { label: 'Reviewed', className: 'bg-purple-50 text-purple-700 border-purple-100' },
    APPROVED: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-100' },
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${map[status].className}`}>
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
  children?: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-sm">
      <div
        className={`flex w-full ${maxWidth} max-h-[94vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-brand-text sm:text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
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
  setMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>>;
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
        text: 'Receipt intake created. Upload the receipt, extract with AI, review rows, then receive stock.',
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
    <ModalShell title="New Receipt Intake" onClose={onClose}>
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

        <ModalActions onClose={onClose} saving={saving} submitLabel="Create Batch" />
      </form>
    </ModalShell>
  );
}

function UploadReceiptModal({
  batch,
  actor,
  generateReceiptUploadUrl,
  attachReceiptToBatch,
  onClose,
  setMessage,
}: {
  batch: any;
  actor: string;
  generateReceiptUploadUrl: any;
  attachReceiptToBatch: any;
  onClose: () => void;
  setMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a receipt image or PDF first.' });
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setMessage({ type: 'error', text: 'Upload a JPG, PNG, WEBP, HEIC, or PDF receipt file.' });
      return;
    }

    try {
      setUploading(true);

      const uploadUrl = await generateReceiptUploadUrl({});

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      });

      if (!uploadResponse.ok) throw new Error('Receipt file upload failed.');

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.storageId) {
        throw new Error('Convex did not return a storageId for this receipt.');
      }

      await attachReceiptToBatch({
        purchaseBatchId: batch._id,
        receiptStorageId: uploadResult.storageId,
        receiptFileName: selectedFile.name,
        receiptMimeType: selectedFile.type,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Receipt uploaded. Click Extract AI to read the receipt automatically.',
      });

      onClose();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to upload receipt.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell title={`Upload Receipt: ${batch.batchNumber}`} onClose={onClose}>
      <form onSubmit={handleUpload} className="space-y-5">
        {batch.receiptImageUrl && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
            This batch already has a receipt attached. Uploading a new file will replace the current receipt reference.
          </div>
        )}

        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center bg-gray-50">
          <Upload className="mx-auto text-gray-400 mb-3" size={36} />
          <p className="font-semibold text-brand-text">Select receipt file</p>
          <p className="text-xs text-brand-text-muted mt-1">
            Supported: JPG, PNG, WEBP, HEIC, PDF
          </p>

          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="mt-4 block w-full text-sm text-brand-text file:mr-4 file:rounded-xl file:border-0 file:bg-brand-primary file:px-4 file:py-2 file:font-semibold file:text-brand-navy hover:file:bg-brand-primary-hover"
          />
        </div>

        {selectedFile && (
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold">
              Selected file
            </p>
            <p className="text-sm font-semibold text-brand-text mt-1">{selectedFile.name}</p>
            <p className="text-xs text-brand-text-muted mt-1">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {selectedFile.type || 'unknown type'}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={uploading}
            className="px-4 py-2 rounded-lg font-bold inline-flex items-center gap-2 disabled:opacity-60 bg-brand-primary text-brand-navy hover:bg-brand-primary-hover"
          >
            {uploading ? <RefreshCcw size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Uploading...' : 'Upload Receipt'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function BatchDetailsModal({
  batch,
  deleteItem,
  updateItem,
  addItem,
  inventoryItems,
  selectedPurchaseItem,
  setSelectedPurchaseItem,
  actor,
  extracting,
  receiving,
  onExtractReceipt,
  onReceiveStock,
  onEditItem,
  onAddItem,
  onUploadReceipt,
  onViewReceipt,
  onClose,
  setMessage,
}: {
  batch: any;
  deleteItem: any;
  updateItem: any;
  addItem: any;
  inventoryItems: any[];
  selectedPurchaseItem: any | null;
  setSelectedPurchaseItem: React.Dispatch<React.SetStateAction<any | null>>;
  actor: string;
  extracting: boolean;
  receiving: boolean;
  onExtractReceipt: () => void;
  onReceiveStock: () => void;
  onEditItem: (item: any) => void;
  onAddItem: () => void;
  onUploadReceipt: () => void;
  onViewReceipt: () => void;
  onClose: () => void;
  setMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>>;
}) {
  const handleDeleteItem = async (purchaseItemId: Id<'purchaseItems'>) => {
    const confirmed = window.confirm('Delete this purchase item?');
    if (!confirmed) return;

    try {
      await deleteItem({ purchaseItemId, actor });
      setMessage({ type: 'success', text: 'Purchase item deleted.' });

      if (selectedPurchaseItem?._id === purchaseItemId) {
        setSelectedPurchaseItem(null);
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to delete purchase item.',
      });
    }
  };

  const items = batch.items ?? [];
  const unlinkedItemCount = items.filter((item: any) => !item.inventoryItemId).length;
  const allItemsLinked = items.length > 0 && unlinkedItemCount === 0;
  const canReceiveStock = canEditBatch(batch.receiptStatus) && !batch.isDeleted && allItemsLinked;

  const selectedItemFromLiveBatch =
    selectedPurchaseItem && !selectedPurchaseItem.__isNew
      ? items.find((item: any) => item._id === selectedPurchaseItem._id)
      : null;

  const selectedItemForEditor = selectedPurchaseItem?.__isNew
    ? selectedPurchaseItem
    : selectedItemFromLiveBatch || null;

  return (
    <ModalShell
      title={`Review & Receive: ${batch.batchNumber}`}
      onClose={onClose}
      maxWidth="max-w-7xl"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-100 bg-gradient-to-r from-gray-50 to-white p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <InfoBox label="Campus" value={niceLabel(batch.campusCode)} />
            <InfoBox label="Supplier" value={batch.supplierName || '—'} />
            <InfoBox label="Total" value={formatMoney(batch.totalAmount)} />
            <InfoBox label="Status" value={niceLabel(batch.receiptStatus)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <InfoBox label="Shopping Date" value={batch.shoppingDate} />
            <InfoBox label="Week Start" value={batch.weekStartDate} />
            <InfoBox label="Week End" value={batch.weekEndDate} />
          </div>
        </div>

        {unlinkedItemCount > 0 && canEditBatch(batch.receiptStatus) && !batch.isDeleted && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{unlinkedItemCount} receipt item(s) still need linking.</p>
              <p className="mt-1">
                Select a row, use the side panel to link it to inventory, then save. The table updates automatically.
              </p>
            </div>
          </div>
        )}

        {canReceiveStock && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-900 flex items-start gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Ready to receive into inventory.</p>
              <p className="mt-1">
                All rows are linked. Confirm Receive Stock will update the Inventory page immediately.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold mb-1">
                    Receipt Proof
                  </p>

                  {batch.receiptImageUrl ? (
                    <>
                      <p className="text-sm font-semibold text-brand-text">
                        {batch.receiptFileName || 'Uploaded receipt'}
                      </p>
                      <p className="text-xs text-brand-text-muted mt-1">
                        {batch.receiptMimeType || 'File uploaded'} · AI confidence:{' '}
                        {confidenceLabel(batch.aiConfidence)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-brand-text-muted">
                      No receipt has been uploaded for this purchase batch yet.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {batch.receiptImageUrl && (
                    <button
                      type="button"
                      onClick={onViewReceipt}
                      className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold hover:bg-blue-100 inline-flex items-center gap-1.5"
                    >
                      <ExternalLink size={14} /> View Receipt
                    </button>
                  )}

                  {batch.receiptImageUrl && canEditBatch(batch.receiptStatus) && !batch.isDeleted && (
                    <button
                      type="button"
                      disabled={extracting}
                      onClick={onExtractReceipt}
                      className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 inline-flex items-center gap-1.5 disabled:opacity-60 shadow-sm"
                    >
                      {extracting ? <RefreshCcw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {extracting ? 'Extracting...' : 'Re-extract AI'}
                    </button>
                  )}

                  {canEditBatch(batch.receiptStatus) && !batch.isDeleted && (
                    <button
                      type="button"
                      onClick={onUploadReceipt}
                      className="px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-100 text-xs font-bold hover:bg-amber-100 inline-flex items-center gap-1.5"
                    >
                      <Upload size={14} />
                      {batch.receiptImageUrl ? 'Replace Receipt' : 'Upload Receipt'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {batch.isDeleted && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-800">
                <p className="font-bold">Archived / Deleted Batch</p>
                <p className="mt-1">Reason: {batch.deleteReason || 'No reason recorded'}</p>
                <p className="text-xs mt-1">
                  Deleted by {batch.deletedByName || 'Unknown'} on {formatDate(batch.deletedAt)}
                </p>
              </div>
            )}

            {batch.notes && (
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold mb-1">
                  Notes
                </p>
                <p className="text-sm text-brand-text">{batch.notes}</p>
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="font-bold text-brand-text">Receipt Items</h3>
                  <p className="text-xs text-brand-text-muted mt-1">
                    Select a row to edit it on the right. Link every row before receiving stock.
                  </p>
                </div>

                {canEditBatch(batch.receiptStatus) && !batch.isDeleted && (
                  <button
                    onClick={onAddItem}
                    className="px-3 py-2 rounded-xl bg-brand-primary text-brand-navy text-xs font-bold hover:bg-brand-primary-hover inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">Item</th>
                      <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">Inventory Link</th>
                      <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">Qty</th>
                      <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">Unit Cost</th>
                      <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">Total</th>
                      <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-brand-text-muted">
                          No receipt items added yet. Upload a receipt and extract with AI, or add a row manually.
                        </td>
                      </tr>
                    ) : (
                      items.map((item: any) => {
                        const isSelected = selectedPurchaseItem?._id === item._id;
                        const needsLink = !item.inventoryItemId;

                        return (
                          <tr
                            key={item._id}
                            onClick={() => {
                              if (canEditBatch(batch.receiptStatus) && !batch.isDeleted) {
                                onEditItem(item);
                              }
                            }}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-200'
                                : needsLink || item.aiNeedsReview
                                  ? 'bg-amber-50/30 hover:bg-amber-50/60'
                                  : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-brand-text">
                                  {item.normalizedItemName}
                                </p>

                                {item.entrySource === 'AI_EXTRACTED' && (
                                  <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    AI {confidenceLabel(item.aiConfidence)}
                                  </span>
                                )}

                                {(item.aiNeedsReview || needsLink) && (
                                  <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">
                                    Needs review
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-brand-text-muted mt-1">
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
                              {canEditBatch(batch.receiptStatus) && !batch.isDeleted && (
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onEditItem(item);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${
                                      isSelected
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                    }`}
                                  >
                                    <Pencil size={14} />
                                    {isSelected ? 'Editing' : 'Edit'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteItem(item._id);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 inline-flex items-center gap-1"
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </div>
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

          <div className="xl:sticky xl:top-4">
            <InlineEditPurchaseItemPanel
              item={selectedItemForEditor}
              batch={batch}
              inventoryItems={inventoryItems}
              addItem={addItem}
              updateItem={updateItem}
              actor={actor}
              onClear={() => setSelectedPurchaseItem(null)}
              setMessage={setMessage}
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-gray-100 pt-4">
          <div>
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">
              Final Step
            </p>
            <p className="text-sm text-brand-text-muted mt-1">
              Confirm Receive Stock updates Inventory and creates permanent stock movement records.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-100 text-brand-text text-sm font-semibold hover:bg-gray-200"
            >
              Close
            </button>

            {canEditBatch(batch.receiptStatus) && !batch.isDeleted && (
              <button
                type="button"
                disabled={!canReceiveStock || receiving}
                onClick={onReceiveStock}
                className={`px-5 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2 shadow-sm transition-colors ${
                  canReceiveStock
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                } disabled:opacity-70`}
                title={
                  canReceiveStock
                    ? 'Receive this receipt into inventory'
                    : 'Link all receipt rows to inventory first'
                }
              >
                {receiving ? <RefreshCcw size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                {receiving ? 'Receiving...' : 'Confirm Receive Stock'}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function InlineEditPurchaseItemPanel({
  item,
  batch,
  inventoryItems,
  addItem,
  updateItem,
  actor,
  onClear,
  setMessage,
}: {
  item: any | null;
  batch: any;
  inventoryItems: any[];
  addItem: any;
  updateItem: any;
  actor: string;
  onClear: () => void;
  setMessage: React.Dispatch<React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>>;
}) {
  const [saving, setSaving] = useState(false);
  const isNewItem = Boolean(item?.__isNew);

  const [form, setForm] = useState({
    inventoryItemId: item?.inventoryItemId || '',
    itemNameRaw: item?.itemNameRaw || '',
    normalizedItemName: item?.normalizedItemName || '',
    category: (item?.category || 'OTHER') as InventoryCategory,
    quantity: String(item?.quantity ?? ''),
    unit: item?.unit || '',
    totalCost: String(item?.totalCost ?? ''),
    notes: item?.notes || '',
  });

  useEffect(() => {
    setForm({
      inventoryItemId: item?.inventoryItemId || '',
      itemNameRaw: item?.itemNameRaw || '',
      normalizedItemName: item?.normalizedItemName || '',
      category: (item?.category || 'OTHER') as InventoryCategory,
      quantity: String(item?.quantity ?? ''),
      unit: item?.unit || '',
      totalCost: String(item?.totalCost ?? ''),
      notes: item?.notes || '',
    });
  }, [item?._id, item?.__isNew]);

  const selectedInventoryItem = inventoryItems.find(
    (inventoryItem) => inventoryItem._id === form.inventoryItemId
  );

  const unitCost =
    Number(form.quantity) > 0
      ? Number(form.totalCost || 0) / Number(form.quantity)
      : 0;

  const handleInventorySelect = (inventoryItemId: string) => {
    const inventoryItem = inventoryItems.find((row) => row._id === inventoryItemId);

    if (!inventoryItem) {
      setForm({ ...form, inventoryItemId });
      return;
    }

    setForm({
      ...form,
      inventoryItemId,
      normalizedItemName: inventoryItem.name,
      category: inventoryItem.category,
      unit: inventoryItem.unit,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!item) return;

    try {
      setSaving(true);

      const payload = {
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
      };

      if (isNewItem) {
        await addItem({
          purchaseBatchId: batch._id,
          ...payload,
        });

        setMessage({
          type: 'success',
          text: 'Receipt row added. You can now review/link the next row.',
        });
        onClear();
      } else {
        await updateItem({
          purchaseItemId: item._id,
          ...payload,
        });

        setMessage({
          type: 'success',
          text: 'Receipt row updated. The review table has refreshed.',
        });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || (isNewItem ? 'Failed to add receipt row.' : 'Failed to update receipt row.'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!item) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-400">
          <Pencil size={22} />
        </div>
        <h3 className="text-sm font-bold text-brand-text mt-4">
          Select a row to edit
        </h3>
        <p className="text-xs text-brand-text-muted mt-2 leading-relaxed">
          Click any receipt item on the left. The edit form will stay here so you can review rows and update details without leaving this window.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="bg-brand-navy text-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60 font-semibold">
              {isNewItem ? 'Adding Receipt Row' : 'Editing Receipt Row'}
            </p>
            <h3 className="text-base font-bold mt-1">
              {isNewItem ? 'New manual row' : item.normalizedItemName || item.itemNameRaw}
            </h3>
            <p className="text-xs text-white/70 mt-1">
              Batch {batch.batchNumber}
            </p>
          </div>

          <button
            type="button"
            onClick={onClear}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="Close editor"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="p-4 space-y-4">
        <div
          className={`rounded-xl border p-3 text-sm ${
            form.inventoryItemId
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-amber-50 border-amber-100 text-amber-900'
          }`}
        >
          {form.inventoryItemId
            ? 'This row is linked and can be received into inventory.'
            : 'This row is not linked yet. Choose the matching inventory item before receiving stock.'}
        </div>

        <Select
          label="Link to Inventory Item"
          value={form.inventoryItemId}
          onChange={handleInventorySelect}
          options={['', ...inventoryItems.map((inventoryItem) => inventoryItem._id)]}
          renderLabel={(value) => {
            if (!value) return 'Select inventory item...';

            const inventoryItem = inventoryItems.find((row) => row._id === value);

            return inventoryItem
              ? `${inventoryItem.name} — ${inventoryItem.currentStock} ${inventoryItem.unit}`
              : value;
          }}
        />

        {selectedInventoryItem && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-brand-text-muted">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="font-semibold text-brand-text">Current stock</p>
                <p>
                  {selectedInventoryItem.currentStock} {selectedInventoryItem.unit}
                </p>
              </div>
              <div>
                <p className="font-semibold text-brand-text">Average cost</p>
                <p>{formatMoney(selectedInventoryItem.averageUnitCost ?? 0)}</p>
              </div>
            </div>
          </div>
        )}

        <Input
          label="Receipt Item Name"
          value={form.itemNameRaw}
          onChange={(value) => setForm({ ...form, itemNameRaw: value })}
          required
        />

        <Input
          label="Inventory/Report Name"
          value={form.normalizedItemName}
          onChange={(value) => setForm({ ...form, normalizedItemName: value })}
          placeholder="Clean name used in inventory reports"
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

        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold">
            Calculated Unit Cost
          </p>
          <p className="text-lg font-bold text-brand-text mt-1">
            {formatMoney(unitCost)}
          </p>
        </div>

        <TextArea
          label="Notes"
          value={form.notes}
          onChange={(value) => setForm({ ...form, notes: value })}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClear}
            className="px-4 py-2 rounded-xl bg-gray-100 text-brand-text text-sm font-semibold hover:bg-gray-200"
          >
            Clear
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-2 shadow-sm"
          >
            {saving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : isNewItem ? 'Add Row' : 'Save Row'}
          </button>
        </div>
      </form>
    </div>
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
            {renderLabel ? renderLabel(option) : niceLabel(option)}
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