import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  RefreshCcw,
  Eye,
  Trash2,
  ChefHat,
  Package,
  ClipboardCheck,
  Utensils,
  CalendarDays,
  Archive,
} from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';

type CampusCode = 'MAIN_SCHOOL' | 'DIGITAL_SCHOOL';
type KitchenIssueStatus = 'DRAFT' | 'ISSUED' | 'RECEIVED' | 'CANCELLED';
type KitchenPurpose = 'LUNCH_PREP' | 'TEA_PREP' | 'SNACK_PREP' | 'FRUIT_PREP' | 'OTHER';

const campuses: CampusCode[] = ['MAIN_SCHOOL', 'DIGITAL_SCHOOL'];

const purposes: KitchenPurpose[] = [
  'LUNCH_PREP',
  'TEA_PREP',
  'SNACK_PREP',
  'FRUIT_PREP',
  'OTHER',
];

const statuses: KitchenIssueStatus[] = ['DRAFT', 'ISSUED', 'RECEIVED', 'CANCELLED'];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function userCampusToInventoryCampus(value?: string | null): CampusCode | undefined {
  if (value === 'main') return 'MAIN_SCHOOL';
  if (value === 'digital') return 'DIGITAL_SCHOOL';
  return undefined;
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
  return value.replaceAll('_', ' ');
}

export function Kitchen() {
  const { user } = useAuth();

  const appUserId = (
    (user as any)?._id ||
    (user as any)?.id ||
    (user as any)?.userId ||
    (user as any)?.appUserId
  ) as Id<'appUsers'> | undefined;

  const actor = user?.name || user?.email || 'Unknown user';
  const defaultCampus = userCampusToInventoryCampus(user?.school);

  const [activeTab, setActiveTab] = useState<'issues' | 'closings'>('issues');

  const [campusFilter, setCampusFilter] = useState<CampusCode | 'All'>(
    defaultCampus || 'All'
  );
  const [statusFilter, setStatusFilter] = useState<KitchenIssueStatus | 'All'>('All');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedIssueId, setSelectedIssueId] =
    useState<Id<'kitchenIssues'> | null>(null);

  const [selectedClosingId, setSelectedClosingId] =
    useState<Id<'dailyKitchenClosings'> | null>(null);

  const [showCreateIssueModal, setShowCreateIssueModal] = useState(false);
  const [showIssueDetailsModal, setShowIssueDetailsModal] = useState(false);
  const [showAddIssueItemModal, setShowAddIssueItemModal] = useState(false);

  const [showCreateClosingModal, setShowCreateClosingModal] = useState(false);
  const [showClosingDetailsModal, setShowClosingDetailsModal] = useState(false);
  const [showAddClosingItemModal, setShowAddClosingItemModal] = useState(false);

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const issues = useQuery(api.kitchen.listIssues, {
    campusCode: campusFilter === 'All' ? undefined : campusFilter,
    status: statusFilter === 'All' ? undefined : statusFilter,
    issueDate: dateFilter || undefined,
    limit: 100,
  });

  const selectedIssue = useQuery(
    api.kitchen.getIssue,
    selectedIssueId ? { kitchenIssueId: selectedIssueId } : 'skip'
  );

  const closings = useQuery(api.kitchen.listDailyClosings, {
    campusCode: campusFilter === 'All' ? undefined : campusFilter,
    closingDate: dateFilter || undefined,
    limit: 100,
  });

  const selectedClosing = useQuery(
    api.kitchen.getDailyClosing,
    selectedClosingId ? { closingId: selectedClosingId } : 'skip'
  );

  const summary = useQuery(api.kitchen.getDailySummary, {
    campusCode: campusFilter === 'All' ? undefined : campusFilter,
    date: dateFilter || todayDate(),
  });

  const inventoryItems = useQuery(api.inventory.listItems, {
    campusCode:
      selectedIssue?.campusCode ||
      selectedClosing?.campusCode ||
      (campusFilter === 'All' ? undefined : campusFilter),
    activeOnly: true,
  });

  const createIssue = useMutation(api.kitchen.createIssue);
  const addIssueItem = useMutation(api.kitchen.addIssueItem);
  const deleteIssueItem = useMutation(api.kitchen.deleteIssueItem);
  const issueToKitchen = useMutation(api.kitchen.issueToKitchen);
  const receiveKitchenIssue = useMutation(api.kitchen.receiveKitchenIssue);
  const cancelKitchenIssue = useMutation(api.kitchen.cancelKitchenIssue);

  const createDailyClosing = useMutation(api.kitchen.createDailyClosing);
  const addDailyClosingItem = useMutation(api.kitchen.addDailyClosingItem);

  const filteredIssues = useMemo(() => {
    let rows = [...(issues ?? [])];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();

      rows = rows.filter(
        (issue) =>
          issue.issueNumber.toLowerCase().includes(term) ||
          (issue.issuedByName ?? '').toLowerCase().includes(term) ||
          (issue.receivedByName ?? '').toLowerCase().includes(term) ||
          (issue.notes ?? '').toLowerCase().includes(term)
      );
    }

    return rows;
  }, [issues, searchTerm]);

  const filteredClosings = useMemo(() => {
    let rows = [...(closings ?? [])];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();

      rows = rows.filter(
        (closing) =>
          (closing.closedByName ?? '').toLowerCase().includes(term) ||
          (closing.notes ?? '').toLowerCase().includes(term)
      );
    }

    return rows;
  }, [closings, searchTerm]);

  const openIssue = (issueId: Id<'kitchenIssues'>) => {
    setSelectedIssueId(issueId);
    setShowIssueDetailsModal(true);
    setMessage(null);
  };

  const openAddIssueItem = (issueId: Id<'kitchenIssues'>) => {
    setSelectedIssueId(issueId);
    setShowAddIssueItemModal(true);
    setMessage(null);
  };

  const openClosing = (closingId: Id<'dailyKitchenClosings'>) => {
    setSelectedClosingId(closingId);
    setShowClosingDetailsModal(true);
    setMessage(null);
  };

  const openAddClosingItem = (closingId: Id<'dailyKitchenClosings'>) => {
    setSelectedClosingId(closingId);
    setShowAddClosingItemModal(true);
    setMessage(null);
  };

  const handleCreateIssueClick = () => {
    setMessage(null);

    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your user ID is missing from the login session. Please log out and log back in.',
      });
      return;
    }

    setShowCreateIssueModal(true);
  };

  const handleCreateClosingClick = () => {
    setMessage(null);

    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your user ID is missing from the login session. Please log out and log back in.',
      });
      return;
    }

    setShowCreateClosingModal(true);
  };

  const handleIssueToKitchen = async (issueId: Id<'kitchenIssues'>) => {
    const confirmed = window.confirm(
      'Issue this stock to the kitchen? This will deduct inventory stock.'
    );

    if (!confirmed) return;

    try {
      await issueToKitchen({
        kitchenIssueId: issueId,
        actor,
        notes: 'Issued to kitchen from kitchen page',
      });

      setMessage({
        type: 'success',
        text: 'Stock issued to kitchen successfully. Inventory has been deducted.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to issue stock to kitchen.',
      });
    }
  };

  const handleReceiveKitchenIssue = async (issueId: Id<'kitchenIssues'>) => {
    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your logged-in user record was not found. Please sign in again.',
      });
      return;
    }

    try {
      await receiveKitchenIssue({
        kitchenIssueId: issueId,
        receivedByUserId: appUserId,
        actor,
        notes: 'Kitchen issue received from kitchen page',
      });

      setMessage({
        type: 'success',
        text: 'Kitchen issue marked as received.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to receive kitchen issue.',
      });
    }
  };

  const handleCancelKitchenIssue = async (issueId: Id<'kitchenIssues'>) => {
    const confirmed = window.confirm('Cancel this kitchen issue?');

    if (!confirmed) return;

    try {
      await cancelKitchenIssue({
        kitchenIssueId: issueId,
        actor,
        notes: 'Kitchen issue cancelled from kitchen page',
      });

      setMessage({
        type: 'success',
        text: 'Kitchen issue cancelled.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to cancel kitchen issue.',
      });
    }
  };

  const totalIssuedCost = filteredIssues.reduce(
    (sum, issue) => sum + (issue.totalEstimatedCost ?? 0),
    0
  );

  const draftCount = filteredIssues.filter((issue) => issue.status === 'DRAFT').length;
  const issuedCount = filteredIssues.filter((issue) => issue.status === 'ISSUED').length;
  const receivedCount = filteredIssues.filter((issue) => issue.status === 'RECEIVED').length;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Kitchen Operations</h1>
          <p className="text-brand-text-muted mt-1">
            Issue stock from store to kitchen, confirm receipt, record daily served counts,
            leftovers, and waste.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCreateClosingClick}
            className="px-4 py-2 bg-white border border-gray-200 text-brand-text rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <ClipboardCheck size={18} />
            Daily Closing
          </button>

          <button
            onClick={handleCreateIssueClick}
            className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            New Kitchen Issue
          </button>
        </div>
      </div>

      {!appUserId && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-amber-900">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium">
            I cannot find your app user ID in the login context. Creating kitchen issues
            and daily closings needs this ID.
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
          icon={ChefHat}
          label="Kitchen Issues"
          value={filteredIssues.length}
          subtext={`${draftCount} draft, ${issuedCount} issued`}
        />
        <SummaryCard
          icon={Package}
          label="Issued Cost"
          value={formatMoney(totalIssuedCost)}
          subtext="Visible kitchen issues"
        />
        <SummaryCard
          icon={ClipboardCheck}
          label="Received"
          value={receivedCount}
          subtext="Confirmed by kitchen"
        />
        <SummaryCard
          icon={Utensils}
          label="Served Today"
          value={
            (summary?.lunchServedCount ?? 0) +
            (summary?.teaServedCount ?? 0) +
            (summary?.snackServedCount ?? 0) +
            (summary?.fruitServedCount ?? 0)
          }
          subtext={`Using ${dateFilter || todayDate()}`}
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
            placeholder="Search issue number, staff, notes..."
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
                {niceLabel(campus)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as KitchenIssueStatus | 'All')
            }
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
            disabled={activeTab === 'closings'}
          >
            <option value="All">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {niceLabel(status)}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('issues')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${
              activeTab === 'issues'
                ? 'bg-brand-primary text-brand-navy'
                : 'bg-gray-100 text-brand-text hover:bg-gray-200'
            }`}
          >
            Store to Kitchen Issues
          </button>

          <button
            onClick={() => setActiveTab('closings')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${
              activeTab === 'closings'
                ? 'bg-brand-primary text-brand-navy'
                : 'bg-gray-100 text-brand-text hover:bg-gray-200'
            }`}
          >
            Daily Closings
          </button>
        </div>

        {activeTab === 'issues' ? (
          <KitchenIssuesTable
            issues={filteredIssues}
            loading={issues === undefined}
            onView={openIssue}
            onAddItem={openAddIssueItem}
            onIssue={handleIssueToKitchen}
            onReceive={handleReceiveKitchenIssue}
            onCancel={handleCancelKitchenIssue}
          />
        ) : (
          <DailyClosingsTable
            closings={filteredClosings}
            loading={closings === undefined}
            onView={openClosing}
            onAddItem={openAddClosingItem}
          />
        )}
      </div>

      {showCreateIssueModal && appUserId && (
        <CreateIssueModal
          appUserId={appUserId}
          actor={actor}
          createIssue={createIssue}
          onClose={() => setShowCreateIssueModal(false)}
          setMessage={setMessage}
        />
      )}

      {showIssueDetailsModal && selectedIssue && (
        <IssueDetailsModal
          issue={selectedIssue}
          deleteIssueItem={deleteIssueItem}
          actor={actor}
          onAddItem={() => {
            setShowIssueDetailsModal(false);
            setShowAddIssueItemModal(true);
          }}
          onClose={() => setShowIssueDetailsModal(false)}
          setMessage={setMessage}
        />
      )}

      {showAddIssueItemModal && selectedIssue && inventoryItems && (
        <AddIssueItemModal
          issue={selectedIssue}
          inventoryItems={inventoryItems}
          addIssueItem={addIssueItem}
          actor={actor}
          onClose={() => setShowAddIssueItemModal(false)}
          setMessage={setMessage}
        />
      )}

      {showCreateClosingModal && appUserId && (
        <CreateClosingModal
          appUserId={appUserId}
          actor={actor}
          createDailyClosing={createDailyClosing}
          onClose={() => setShowCreateClosingModal(false)}
          setMessage={setMessage}
        />
      )}

      {showClosingDetailsModal && selectedClosing && (
        <ClosingDetailsModal
          closing={selectedClosing}
          onAddItem={() => {
            setShowClosingDetailsModal(false);
            setShowAddClosingItemModal(true);
          }}
          onClose={() => setShowClosingDetailsModal(false)}
        />
      )}

      {showAddClosingItemModal && selectedClosing && inventoryItems && (
        <AddClosingItemModal
          closing={selectedClosing}
          inventoryItems={inventoryItems}
          addDailyClosingItem={addDailyClosingItem}
          actor={actor}
          onClose={() => setShowAddClosingItemModal(false)}
          setMessage={setMessage}
        />
      )}
    </div>
  );
}

function KitchenIssuesTable({
  issues,
  loading,
  onView,
  onAddItem,
  onIssue,
  onReceive,
  onCancel,
}: {
  issues: any[];
  loading: boolean;
  onView: (id: Id<'kitchenIssues'>) => void;
  onAddItem: (id: Id<'kitchenIssues'>) => void;
  onIssue: (id: Id<'kitchenIssues'>) => void;
  onReceive: (id: Id<'kitchenIssues'>) => void;
  onCancel: (id: Id<'kitchenIssues'>) => void;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Issue
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Campus
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Purpose
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Cost
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
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-brand-text-muted">
                  Loading kitchen issues...
                </td>
              </tr>
            ) : issues.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-brand-text-muted">
                  No kitchen issues found.
                </td>
              </tr>
            ) : (
              issues.map((issue) => (
                <tr key={issue._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-brand-text">
                      {issue.issueNumber}
                    </p>
                    <p className="text-xs text-brand-text-muted">
                      {issue.issueDate}
                    </p>
                    <p className="text-xs text-brand-text-muted">
                      Issued by {issue.issuedByName || 'Unknown'}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-sm text-brand-text-muted">
                    {niceLabel(issue.campusCode)}
                  </td>

                  <td className="px-6 py-4 text-sm text-brand-text">
                    {niceLabel(issue.purpose)}
                  </td>

                  <td className="px-6 py-4 text-sm text-brand-text">
                    {issue.itemCount ?? 0}
                  </td>

                  <td className="px-6 py-4 text-sm font-semibold text-brand-text">
                    {formatMoney(issue.totalEstimatedCost ?? 0)}
                  </td>

                  <td className="px-6 py-4">
                    <IssueStatusBadge status={issue.status} />
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => onView(issue._id)}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-brand-text text-xs font-semibold hover:bg-gray-200 inline-flex items-center gap-1"
                      >
                        <Eye size={14} />
                        View
                      </button>

                      {issue.status === 'DRAFT' && (
                        <button
                          onClick={() => onAddItem(issue._id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                        >
                          Add Item
                        </button>
                      )}

                      {issue.status === 'DRAFT' && (
                        <button
                          onClick={() => onIssue(issue._id)}
                          className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100"
                        >
                          Issue
                        </button>
                      )}

                      {issue.status === 'ISSUED' && (
                        <button
                          onClick={() => onReceive(issue._id)}
                          className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100"
                        >
                          Receive
                        </button>
                      )}

                      {issue.status === 'DRAFT' && (
                        <button
                          onClick={() => onCancel(issue._id)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                        >
                          Cancel
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
          Showing {issues.length} kitchen issue{issues.length === 1 ? '' : 's'}.
        </p>
      </div>
    </>
  );
}

function DailyClosingsTable({
  closings,
  loading,
  onView,
  onAddItem,
}: {
  closings: any[];
  loading: boolean;
  onView: (id: Id<'dailyKitchenClosings'>) => void;
  onAddItem: (id: Id<'dailyKitchenClosings'>) => void;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Closing Date
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Campus
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Served
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Waste
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Leftovers
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Closed By
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-brand-text-muted">
                  Loading daily closings...
                </td>
              </tr>
            ) : closings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-brand-text-muted">
                  No daily closings found.
                </td>
              </tr>
            ) : (
              closings.map((closing) => {
                const served =
                  (closing.lunchServedCount ?? 0) +
                  (closing.teaServedCount ?? 0) +
                  (closing.snackServedCount ?? 0) +
                  (closing.fruitServedCount ?? 0);

                return (
                  <tr key={closing._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-brand-text">
                        {closing.closingDate}
                      </p>
                      <p className="text-xs text-brand-text-muted">
                        {formatDate(closing.createdAt)}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text-muted">
                      {niceLabel(closing.campusCode)}
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold text-brand-text">
                      {served}
                    </td>

                    <td className="px-6 py-4 text-sm text-red-700 font-semibold">
                      {formatMoney(closing.totalWasteCost ?? 0)}
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text">
                      {formatMoney(closing.totalLeftoverValue ?? 0)}
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-text-muted">
                      {closing.closedByName || 'Unknown'}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => onView(closing._id)}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 text-brand-text text-xs font-semibold hover:bg-gray-200 inline-flex items-center gap-1"
                        >
                          <Eye size={14} />
                          View
                        </button>

                        <button
                          onClick={() => onAddItem(closing._id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                        >
                          Add Waste/Leftover
                        </button>
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
          Showing {closings.length} daily closing{closings.length === 1 ? '' : 's'}.
        </p>
      </div>
    </>
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

function IssueStatusBadge({ status }: { status: KitchenIssueStatus }) {
  const map: Record<KitchenIssueStatus, { label: string; className: string }> = {
    DRAFT: {
      label: 'Draft',
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    },
    ISSUED: {
      label: 'Issued',
      className: 'bg-blue-50 text-blue-700 border-blue-100',
    },
    RECEIVED: {
      label: 'Received',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    CANCELLED: {
      label: 'Cancelled',
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

function CreateIssueModal({
  appUserId,
  actor,
  createIssue,
  onClose,
  setMessage,
}: {
  appUserId: Id<'appUsers'>;
  actor: string;
  createIssue: any;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const [form, setForm] = useState({
    campusCode: 'MAIN_SCHOOL' as CampusCode,
    issueDate: todayDate(),
    purpose: 'LUNCH_PREP' as KitchenPurpose,
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      await createIssue({
        issuedByUserId: appUserId,
        campusCode: form.campusCode,
        issueDate: form.issueDate,
        purpose: form.purpose,
        notes: form.notes || undefined,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Kitchen issue created. You can now add inventory items.',
      });

      onClose();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to create kitchen issue.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="New Kitchen Issue" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Campus"
          value={form.campusCode}
          options={campuses}
          onChange={(value) => setForm({ ...form, campusCode: value as CampusCode })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Issue Date"
            type="date"
            value={form.issueDate}
            onChange={(value) => setForm({ ...form, issueDate: value })}
            required
          />

          <Select
            label="Purpose"
            value={form.purpose}
            options={purposes}
            onChange={(value) => setForm({ ...form, purpose: value as KitchenPurpose })}
          />
        </div>

        <TextArea
          label="Notes"
          value={form.notes}
          onChange={(value) => setForm({ ...form, notes: value })}
        />

        <ModalActions onClose={onClose} saving={saving} submitLabel="Create Issue" />
      </form>
    </ModalShell>
  );
}

function AddIssueItemModal({
  issue,
  inventoryItems,
  addIssueItem,
  actor,
  onClose,
  setMessage,
}: {
  issue: any;
  inventoryItems: any[];
  addIssueItem: any;
  actor: string;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const [form, setForm] = useState({
    inventoryItemId: '',
    quantityIssued: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  const selectedItem = inventoryItems.find((item) => item._id === form.inventoryItemId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      await addIssueItem({
        kitchenIssueId: issue._id,
        inventoryItemId: form.inventoryItemId as Id<'inventoryItems'>,
        quantityIssued: Number(form.quantityIssued),
        notes: form.notes || undefined,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Item added to kitchen issue.',
      });

      onClose();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to add item to kitchen issue.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Add Item to ${issue.issueNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Inventory Item"
          value={form.inventoryItemId}
          onChange={(value) => setForm({ ...form, inventoryItemId: value })}
          options={['', ...inventoryItems.map((item) => item._id)]}
          renderLabel={(value) => {
            if (!value) return 'Select inventory item...';

            const item = inventoryItems.find((row) => row._id === value);

            return item
              ? `${item.name} — ${item.currentStock} ${item.unit}`
              : value;
          }}
        />

        {selectedItem && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm text-brand-text-muted">
            Current stock:{' '}
            <strong>
              {selectedItem.currentStock} {selectedItem.unit}
            </strong>
            {' '}| Average cost:{' '}
            <strong>{formatMoney(selectedItem.averageUnitCost ?? 0)}</strong>
          </div>
        )}

        <Input
          label={selectedItem ? `Quantity to Issue (${selectedItem.unit})` : 'Quantity to Issue'}
          type="number"
          value={form.quantityIssued}
          onChange={(value) => setForm({ ...form, quantityIssued: value })}
          required
        />

        <TextArea
          label="Notes"
          value={form.notes}
          onChange={(value) => setForm({ ...form, notes: value })}
        />

        <ModalActions onClose={onClose} saving={saving} submitLabel="Add Item" />
      </form>
    </ModalShell>
  );
}

function IssueDetailsModal({
  issue,
  deleteIssueItem,
  actor,
  onAddItem,
  onClose,
  setMessage,
}: {
  issue: any;
  deleteIssueItem: any;
  actor: string;
  onAddItem: () => void;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const handleDelete = async (issueItemId: Id<'kitchenIssueItems'>) => {
    const confirmed = window.confirm('Delete this item from the kitchen issue?');

    if (!confirmed) return;

    try {
      await deleteIssueItem({
        kitchenIssueItemId: issueItemId,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Kitchen issue item deleted.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to delete kitchen issue item.',
      });
    }
  };

  return (
    <ModalShell title={`Kitchen Issue: ${issue.issueNumber}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InfoBox label="Campus" value={niceLabel(issue.campusCode)} />
          <InfoBox label="Purpose" value={niceLabel(issue.purpose)} />
          <InfoBox label="Status" value={niceLabel(issue.status)} />
          <InfoBox label="Cost" value={formatMoney(issue.totalEstimatedCost ?? 0)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InfoBox label="Issue Date" value={issue.issueDate} />
          <InfoBox label="Issued By" value={issue.issuedByName || 'Unknown'} />
          <InfoBox label="Received By" value={issue.receivedByName || '—'} />
        </div>

        {issue.notes && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold mb-1">
              Notes
            </p>
            <p className="text-sm text-brand-text">{issue.notes}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-brand-text">Issued Items</h3>

          {issue.status === 'DRAFT' && (
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
                  Quantity
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
              {issue.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-brand-text-muted">
                    No items added yet.
                  </td>
                </tr>
              ) : (
                issue.items.map((item: any) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-brand-text">
                        {item.itemNameSnapshot}
                      </p>
                      <p className="text-xs text-brand-text-muted">
                        {item.unitSnapshot}
                      </p>
                    </td>

                    <td className="px-4 py-3 text-sm text-brand-text">
                      {item.quantityIssued} {item.unitSnapshot}
                    </td>

                    <td className="px-4 py-3 text-sm text-brand-text">
                      {formatMoney(item.estimatedUnitCost ?? 0)}
                    </td>

                    <td className="px-4 py-3 text-sm font-semibold text-brand-text">
                      {formatMoney(item.estimatedTotalCost ?? 0)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {issue.status === 'DRAFT' && (
                        <button
                          onClick={() => handleDelete(item._id)}
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

function CreateClosingModal({
  appUserId,
  actor,
  createDailyClosing,
  onClose,
  setMessage,
}: {
  appUserId: Id<'appUsers'>;
  actor: string;
  createDailyClosing: any;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const [form, setForm] = useState({
    campusCode: 'MAIN_SCHOOL' as CampusCode,
    closingDate: todayDate(),
    lunchServedCount: '0',
    teaServedCount: '0',
    snackServedCount: '0',
    fruitServedCount: '0',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      await createDailyClosing({
        campusCode: form.campusCode,
        closingDate: form.closingDate,
        closedByUserId: appUserId,
        lunchServedCount: Number(form.lunchServedCount),
        teaServedCount: Number(form.teaServedCount),
        snackServedCount: Number(form.snackServedCount),
        fruitServedCount: Number(form.fruitServedCount),
        notes: form.notes || undefined,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Daily kitchen closing created.',
      });

      onClose();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to create daily closing.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Daily Kitchen Closing" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Campus"
          value={form.campusCode}
          options={campuses}
          onChange={(value) => setForm({ ...form, campusCode: value as CampusCode })}
        />

        <Input
          label="Closing Date"
          type="date"
          value={form.closingDate}
          onChange={(value) => setForm({ ...form, closingDate: value })}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Lunch Served"
            type="number"
            value={form.lunchServedCount}
            onChange={(value) => setForm({ ...form, lunchServedCount: value })}
            required
          />

          <Input
            label="Tea Served"
            type="number"
            value={form.teaServedCount}
            onChange={(value) => setForm({ ...form, teaServedCount: value })}
            required
          />

          <Input
            label="Snacks Served"
            type="number"
            value={form.snackServedCount}
            onChange={(value) => setForm({ ...form, snackServedCount: value })}
            required
          />

          <Input
            label="Fruit Served"
            type="number"
            value={form.fruitServedCount}
            onChange={(value) => setForm({ ...form, fruitServedCount: value })}
            required
          />
        </div>

        <TextArea
          label="Notes"
          value={form.notes}
          onChange={(value) => setForm({ ...form, notes: value })}
        />

        <ModalActions onClose={onClose} saving={saving} submitLabel="Create Closing" />
      </form>
    </ModalShell>
  );
}

function AddClosingItemModal({
  closing,
  inventoryItems,
  addDailyClosingItem,
  actor,
  onClose,
  setMessage,
}: {
  closing: any;
  inventoryItems: any[];
  addDailyClosingItem: any;
  actor: string;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const [form, setForm] = useState({
    inventoryItemId: '',
    leftoverQty: '0',
    wasteQty: '0',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  const selectedItem = inventoryItems.find((item) => item._id === form.inventoryItemId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const wasteQty = Number(form.wasteQty);

    if (wasteQty > 0) {
      const confirmed = window.confirm(
        'Waste quantity will deduct from inventory stock. Continue?'
      );

      if (!confirmed) return;
    }

    try {
      setSaving(true);

      await addDailyClosingItem({
        closingId: closing._id,
        inventoryItemId: form.inventoryItemId as Id<'inventoryItems'>,
        leftoverQty: Number(form.leftoverQty),
        wasteQty: Number(form.wasteQty),
        notes: form.notes || undefined,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Daily closing item recorded.',
      });

      onClose();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to add daily closing item.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Add Waste / Leftover for ${closing.closingDate}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Inventory Item"
          value={form.inventoryItemId}
          onChange={(value) => setForm({ ...form, inventoryItemId: value })}
          options={['', ...inventoryItems.map((item) => item._id)]}
          renderLabel={(value) => {
            if (!value) return 'Select inventory item...';

            const item = inventoryItems.find((row) => row._id === value);

            return item
              ? `${item.name} — ${item.currentStock} ${item.unit}`
              : value;
          }}
        />

        {selectedItem && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm text-brand-text-muted">
            Current stock:{' '}
            <strong>
              {selectedItem.currentStock} {selectedItem.unit}
            </strong>
            {' '}| Average cost:{' '}
            <strong>{formatMoney(selectedItem.averageUnitCost ?? 0)}</strong>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={selectedItem ? `Leftover Qty (${selectedItem.unit})` : 'Leftover Qty'}
            type="number"
            value={form.leftoverQty}
            onChange={(value) => setForm({ ...form, leftoverQty: value })}
            required
          />

          <Input
            label={selectedItem ? `Waste Qty (${selectedItem.unit})` : 'Waste Qty'}
            type="number"
            value={form.wasteQty}
            onChange={(value) => setForm({ ...form, wasteQty: value })}
            required
          />
        </div>

        <TextArea
          label="Notes"
          value={form.notes}
          onChange={(value) => setForm({ ...form, notes: value })}
        />

        <ModalActions onClose={onClose} saving={saving} submitLabel="Record Item" />
      </form>
    </ModalShell>
  );
}

function ClosingDetailsModal({
  closing,
  onAddItem,
  onClose,
}: {
  closing: any;
  onAddItem: () => void;
  onClose: () => void;
}) {
  const served =
    (closing.lunchServedCount ?? 0) +
    (closing.teaServedCount ?? 0) +
    (closing.snackServedCount ?? 0) +
    (closing.fruitServedCount ?? 0);

  return (
    <ModalShell title={`Daily Closing: ${closing.closingDate}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InfoBox label="Campus" value={niceLabel(closing.campusCode)} />
          <InfoBox label="Total Served" value={served} />
          <InfoBox label="Waste Cost" value={formatMoney(closing.totalWasteCost ?? 0)} />
          <InfoBox label="Leftover Value" value={formatMoney(closing.totalLeftoverValue ?? 0)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InfoBox label="Lunch" value={closing.lunchServedCount ?? 0} />
          <InfoBox label="Tea" value={closing.teaServedCount ?? 0} />
          <InfoBox label="Snacks" value={closing.snackServedCount ?? 0} />
          <InfoBox label="Fruit" value={closing.fruitServedCount ?? 0} />
        </div>

        {closing.notes && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold mb-1">
              Notes
            </p>
            <p className="text-sm text-brand-text">{closing.notes}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-brand-text">Waste / Leftover Items</h3>

          <button
            onClick={onAddItem}
            className="px-3 py-1.5 rounded-lg bg-brand-primary text-brand-navy text-xs font-bold hover:bg-brand-primary-hover inline-flex items-center gap-1"
          >
            <Plus size={14} />
            Add Item
          </button>
        </div>

        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Item
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Leftover
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Waste
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Leftover Value
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Waste Cost
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {closing.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-brand-text-muted">
                    No waste or leftover items recorded yet.
                  </td>
                </tr>
              ) : (
                closing.items.map((item: any) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-brand-text">
                        {item.itemNameSnapshot}
                      </p>
                      <p className="text-xs text-brand-text-muted">
                        {item.unitSnapshot}
                      </p>
                    </td>

                    <td className="px-4 py-3 text-sm text-brand-text">
                      {item.leftoverQty} {item.unitSnapshot}
                    </td>

                    <td className="px-4 py-3 text-sm text-red-700">
                      {item.wasteQty} {item.unitSnapshot}
                    </td>

                    <td className="px-4 py-3 text-sm text-brand-text">
                      {formatMoney(item.leftoverValue ?? 0)}
                    </td>

                    <td className="px-4 py-3 text-sm text-red-700 font-semibold">
                      {formatMoney(item.wasteCost ?? 0)}
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