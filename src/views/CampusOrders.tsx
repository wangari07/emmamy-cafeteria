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
  Truck,
  PackageCheck,
  ClipboardCheck,
  XCircle,
  Building2,
  Send,
} from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';

type CampusCode = 'MAIN_SCHOOL' | 'DIGITAL_SCHOOL';

type OrderStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'PACKED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'CANCELLED';

const campuses: CampusCode[] = ['MAIN_SCHOOL', 'DIGITAL_SCHOOL'];

const statuses: OrderStatus[] = [
  'PENDING',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'PACKED',
  'DISPATCHED',
  'RECEIVED',
  'CANCELLED',
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function niceLabel(value: string) {
  return value.replaceAll('_', ' ');
}

function userSchoolToCampus(value?: string | null): CampusCode | undefined {
  if (value === 'main') return 'MAIN_SCHOOL';
  if (value === 'digital') return 'DIGITAL_SCHOOL';
  return undefined;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function CampusOrders() {
  const { user } = useAuth();

  const appUserId = (
    (user as any)?._id ||
    (user as any)?.id ||
    (user as any)?.userId ||
    (user as any)?.appUserId
  ) as Id<'appUsers'> | undefined;

  const actor = user?.name || user?.email || 'Unknown user';
  const defaultCampus = userSchoolToCampus(user?.school);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
  const [requestingCampusFilter, setRequestingCampusFilter] = useState<CampusCode | 'All'>(
    defaultCampus || 'All'
  );
  const [supplyingCampusFilter, setSupplyingCampusFilter] = useState<CampusCode | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedOrderId, setSelectedOrderId] = useState<Id<'campusOrders'> | null>(null);

  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);

  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const orders = useQuery((api.campusOrders as any).listOrders, {
    requestingCampusCode:
      requestingCampusFilter === 'All' ? undefined : requestingCampusFilter,
    supplyingCampusCode:
      supplyingCampusFilter === 'All' ? undefined : supplyingCampusFilter,
    status: statusFilter === 'All' ? undefined : statusFilter,
    limit: 100,
  });

  const selectedOrder = useQuery(
    (api.campusOrders as any).getOrder,
    selectedOrderId ? { orderId: selectedOrderId } : 'skip'
  );

  const inventoryItems = useQuery(api.inventory.listItems, {
    campusCode:
      supplyingCampusFilter === 'All'
        ? undefined
        : supplyingCampusFilter,
    activeOnly: true,
  });

  const createOrder = useMutation((api.campusOrders as any).createOrder);
  const approveOrder = useMutation((api.campusOrders as any).approveOrder);
  const rejectOrder = useMutation((api.campusOrders as any).rejectOrder);
  const markPacked = useMutation((api.campusOrders as any).markPacked);
  const dispatchOrder = useMutation((api.campusOrders as any).dispatchOrder);
  const confirmReceived = useMutation((api.campusOrders as any).confirmReceived);
  const cancelOrder = useMutation((api.campusOrders as any).cancelOrder);

  const filteredOrders = useMemo(() => {
    let rows = [...(orders ?? [])];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();

      rows = rows.filter(
        (order) =>
          order.orderNumber?.toLowerCase().includes(term) ||
          order.requestedByName?.toLowerCase().includes(term) ||
          order.notes?.toLowerCase().includes(term)
      );
    }

    return rows;
  }, [orders, searchTerm]);

  const pendingCount = filteredOrders.filter((order) => order.status === 'PENDING').length;
  const dispatchedCount = filteredOrders.filter((order) => order.status === 'DISPATCHED').length;
  const receivedCount = filteredOrders.filter((order) => order.status === 'RECEIVED').length;

  const openOrder = (orderId: Id<'campusOrders'>) => {
    setSelectedOrderId(orderId);
    setShowOrderDetailsModal(true);
    setMessage(null);
  };

  const openApprove = (orderId: Id<'campusOrders'>) => {
    setSelectedOrderId(orderId);
    setShowApproveModal(true);
    setMessage(null);
  };

  const handleNewOrderClick = () => {
    setMessage(null);

    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your user ID is missing from the login session. Please log out and log back in.',
      });
      return;
    }

    setShowCreateOrderModal(true);
  };

  const handleRejectOrder = async (orderId: Id<'campusOrders'>) => {
    const confirmed = window.confirm('Reject this campus order?');

    if (!confirmed) return;

    try {
      await rejectOrder({
        orderId,
        actor,
        notes: 'Order rejected from campus orders page',
      });

      setMessage({
        type: 'success',
        text: 'Campus order rejected.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to reject campus order.',
      });
    }
  };

  const handleCancelOrder = async (orderId: Id<'campusOrders'>) => {
    const confirmed = window.confirm('Cancel this campus order?');

    if (!confirmed) return;

    try {
      await cancelOrder({
        orderId,
        actor,
        notes: 'Order cancelled from campus orders page',
      });

      setMessage({
        type: 'success',
        text: 'Campus order cancelled.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to cancel campus order.',
      });
    }
  };

  const handleMarkPacked = async (orderId: Id<'campusOrders'>) => {
    try {
      await markPacked({
        orderId,
        actor,
        notes: 'Order packed from campus orders page',
      });

      setMessage({
        type: 'success',
        text: 'Order marked as packed.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to mark order as packed.',
      });
    }
  };

  const handleDispatch = async (orderId: Id<'campusOrders'>) => {
    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your user ID is missing from the login session. Please log out and log back in.',
      });
      return;
    }

    const confirmed = window.confirm(
      'Dispatch this order? This should deduct stock from the supplying campus.'
    );

    if (!confirmed) return;

    try {
      await dispatchOrder({
        orderId,
        dispatchedByUserId: appUserId,
        actor,
        notes: 'Order dispatched from campus orders page',
      });

      setMessage({
        type: 'success',
        text: 'Order dispatched successfully.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to dispatch order.',
      });
    }
  };

  const handleConfirmReceived = async (orderId: Id<'campusOrders'>) => {
    if (!appUserId) {
      setMessage({
        type: 'error',
        text: 'Your user ID is missing from the login session. Please log out and log back in.',
      });
      return;
    }

    try {
      await confirmReceived({
        orderId,
        receivedByUserId: appUserId,
        actor,
        notes: 'Order received from campus orders page',
      });

      setMessage({
        type: 'success',
        text: 'Order confirmed as received.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to confirm order received.',
      });
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Campus Orders & Delivery</h1>
          <p className="text-brand-text-muted mt-1">
            Request items between campuses, approve quantities, pack, dispatch, and confirm receipt.
          </p>
        </div>

        <button
          onClick={handleNewOrderClick}
          className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          New Campus Order
        </button>
      </div>

      {!appUserId && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-amber-900">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium">
            I cannot find your app user ID in the login context. Creating, dispatching,
            and receiving orders needs this ID.
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
          icon={Building2}
          label="Orders"
          value={filteredOrders.length}
          subtext="Visible campus orders"
        />
        <SummaryCard
          icon={ClipboardCheck}
          label="Pending"
          value={pendingCount}
          subtext="Need approval"
          warning={pendingCount > 0}
        />
        <SummaryCard
          icon={Truck}
          label="Dispatched"
          value={dispatchedCount}
          subtext="In transit"
        />
        <SummaryCard
          icon={PackageCheck}
          label="Received"
          value={receivedCount}
          subtext="Completed"
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
            placeholder="Search order number, staff, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-auto">
          <select
            value={requestingCampusFilter}
            onChange={(e) =>
              setRequestingCampusFilter(e.target.value as CampusCode | 'All')
            }
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            <option value="All">All Requesting</option>
            {campuses.map((campus) => (
              <option key={campus} value={campus}>
                {niceLabel(campus)}
              </option>
            ))}
          </select>

          <select
            value={supplyingCampusFilter}
            onChange={(e) =>
              setSupplyingCampusFilter(e.target.value as CampusCode | 'All')
            }
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            <option value="All">All Supplying</option>
            {campuses.map((campus) => (
              <option key={campus} value={campus}>
                {niceLabel(campus)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'All')}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text"
          >
            <option value="All">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {niceLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <OrdersTable
          orders={filteredOrders}
          loading={orders === undefined}
          onView={openOrder}
          onApprove={openApprove}
          onReject={handleRejectOrder}
          onCancel={handleCancelOrder}
          onPack={handleMarkPacked}
          onDispatch={handleDispatch}
          onReceive={handleConfirmReceived}
        />
      </div>

      {showCreateOrderModal && appUserId && inventoryItems && (
        <CreateOrderModal
          appUserId={appUserId}
          actor={actor}
          inventoryItems={inventoryItems}
          createOrder={createOrder}
          onClose={() => setShowCreateOrderModal(false)}
          setMessage={setMessage}
        />
      )}

      {showOrderDetailsModal && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setShowOrderDetailsModal(false)}
        />
      )}

      {showApproveModal && selectedOrder && appUserId && (
        <ApproveOrderModal
          order={selectedOrder}
          appUserId={appUserId}
          actor={actor}
          approveOrder={approveOrder}
          onClose={() => setShowApproveModal(false)}
          setMessage={setMessage}
        />
      )}
    </div>
  );
}

function OrdersTable({
  orders,
  loading,
  onView,
  onApprove,
  onReject,
  onCancel,
  onPack,
  onDispatch,
  onReceive,
}: {
  orders: any[];
  loading: boolean;
  onView: (id: Id<'campusOrders'>) => void;
  onApprove: (id: Id<'campusOrders'>) => void;
  onReject: (id: Id<'campusOrders'>) => void;
  onCancel: (id: Id<'campusOrders'>) => void;
  onPack: (id: Id<'campusOrders'>) => void;
  onDispatch: (id: Id<'campusOrders'>) => void;
  onReceive: (id: Id<'campusOrders'>) => void;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Order
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Needed By
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                Items
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
                <td colSpan={6} className="px-6 py-10 text-center text-brand-text-muted">
                  Loading campus orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-brand-text-muted">
                  No campus orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-brand-text">
                      {order.orderNumber}
                    </p>
                    <p className="text-xs text-brand-text-muted">
                      Requested by {order.requestedByName || 'Unknown'}
                    </p>
                    <p className="text-xs text-brand-text-muted">
                      {formatDate(order.createdAt)}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-sm text-brand-text">
                    <p>
                      <span className="text-brand-text-muted">From:</span>{' '}
                      {niceLabel(order.supplyingCampusCode)}
                    </p>
                    <p>
                      <span className="text-brand-text-muted">To:</span>{' '}
                      {niceLabel(order.requestingCampusCode)}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-sm text-brand-text-muted">
                    {order.neededBy || '—'}
                  </td>

                  <td className="px-6 py-4 text-sm font-semibold text-brand-text">
                    {order.itemCount ?? order.items?.length ?? 0}
                  </td>

                  <td className="px-6 py-4">
                    <OrderStatusBadge status={order.status} />
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <ActionButton icon={Eye} label="View" onClick={() => onView(order._id)} />

                      {order.status === 'PENDING' && (
                        <>
                          <ActionButton
                            label="Approve"
                            onClick={() => onApprove(order._id)}
                            color="green"
                          />
                          <ActionButton
                            label="Reject"
                            onClick={() => onReject(order._id)}
                            color="red"
                          />
                        </>
                      )}

                      {['APPROVED', 'PARTIALLY_APPROVED'].includes(order.status) && (
                        <ActionButton
                          label="Pack"
                          onClick={() => onPack(order._id)}
                          color="blue"
                        />
                      )}

                      {order.status === 'PACKED' && (
                        <ActionButton
                          label="Dispatch"
                          onClick={() => onDispatch(order._id)}
                          color="purple"
                        />
                      )}

                      {order.status === 'DISPATCHED' && (
                        <ActionButton
                          label="Receive"
                          onClick={() => onReceive(order._id)}
                          color="green"
                        />
                      )}

                      {order.status === 'PENDING' && (
                        <ActionButton
                          label="Cancel"
                          onClick={() => onCancel(order._id)}
                          color="red"
                        />
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
          Showing {orders.length} campus order{orders.length === 1 ? '' : 's'}.
        </p>
      </div>
    </>
  );
}

function CreateOrderModal({
  appUserId,
  actor,
  inventoryItems,
  createOrder,
  onClose,
  setMessage,
}: {
  appUserId: Id<'appUsers'>;
  actor: string;
  inventoryItems: any[];
  createOrder: any;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const [form, setForm] = useState({
    requestingCampusCode: 'DIGITAL_SCHOOL' as CampusCode,
    supplyingCampusCode: 'MAIN_SCHOOL' as CampusCode,
    neededBy: todayDate(),
    notes: '',
  });

  const [items, setItems] = useState<
    Array<{
      inventoryItemId: string;
      requestedQty: string;
    }>
  >([
    {
      inventoryItemId: '',
      requestedQty: '',
    },
  ]);

  const [saving, setSaving] = useState(false);

  const addRow = () => {
    setItems([...items, { inventoryItemId: '', requestedQty: '' }]);
  };

  const updateRow = (index: number, key: 'inventoryItemId' | 'requestedQty', value: string) => {
    setItems((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row
      )
    );
  };

  const removeRow = (index: number) => {
    setItems((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanItems = items
      .filter((item) => item.inventoryItemId && Number(item.requestedQty) > 0)
      .map((item) => ({
        inventoryItemId: item.inventoryItemId as Id<'inventoryItems'>,
        requestedQty: Number(item.requestedQty),
      }));

    if (cleanItems.length === 0) {
      setMessage({
        type: 'error',
        text: 'Add at least one valid item to the order.',
      });
      return;
    }

    if (form.requestingCampusCode === form.supplyingCampusCode) {
      setMessage({
        type: 'error',
        text: 'Requesting campus and supplying campus cannot be the same.',
      });
      return;
    }

    try {
      setSaving(true);

      await createOrder({
        requestedByUserId: appUserId,
        requestingCampusCode: form.requestingCampusCode,
        supplyingCampusCode: form.supplyingCampusCode,
        neededBy: form.neededBy || null,
        notes: form.notes || null,
        items: cleanItems,
        actor,
      });

      setMessage({
        type: 'success',
        text: 'Campus order created successfully.',
      });

      onClose();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to create campus order.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="New Campus Order" onClose={onClose} maxWidth="max-w-4xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Requesting Campus"
            value={form.requestingCampusCode}
            options={campuses}
            onChange={(value) =>
              setForm({ ...form, requestingCampusCode: value as CampusCode })
            }
          />

          <Select
            label="Supplying Campus"
            value={form.supplyingCampusCode}
            options={campuses}
            onChange={(value) =>
              setForm({ ...form, supplyingCampusCode: value as CampusCode })
            }
          />

          <Input
            label="Needed By"
            type="date"
            value={form.neededBy}
            onChange={(value) => setForm({ ...form, neededBy: value })}
          />
        </div>

        <TextArea
          label="Notes"
          value={form.notes}
          onChange={(value) => setForm({ ...form, notes: value })}
        />

        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-brand-text">Requested Items</h3>

            <button
              type="button"
              onClick={addRow}
              className="px-3 py-1.5 rounded-lg bg-brand-primary text-brand-navy text-xs font-bold hover:bg-brand-primary-hover inline-flex items-center gap-1"
            >
              <Plus size={14} />
              Add Row
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {items.map((item, index) => {
              const selected = inventoryItems.find((row) => row._id === item.inventoryItemId);

              return (
                <div key={index} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3 items-end">
                  <Select
                    label="Inventory Item"
                    value={item.inventoryItemId}
                    options={['', ...inventoryItems.map((row) => row._id)]}
                    onChange={(value) => updateRow(index, 'inventoryItemId', value)}
                    renderLabel={(value) => {
                      if (!value) return 'Select item...';

                      const row = inventoryItems.find((inventory) => inventory._id === value);

                      return row
                        ? `${row.name} — ${row.currentStock} ${row.unit}`
                        : value;
                    }}
                  />

                  <Input
                    label={selected ? `Qty (${selected.unit})` : 'Qty'}
                    type="number"
                    value={item.requestedQty}
                    onChange={(value) => updateRow(index, 'requestedQty', value)}
                  />

                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={items.length === 1}
                    className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <ModalActions onClose={onClose} saving={saving} submitLabel="Create Order" />
      </form>
    </ModalShell>
  );
}

function ApproveOrderModal({
  order,
  appUserId,
  actor,
  approveOrder,
  onClose,
  setMessage,
}: {
  order: any;
  appUserId: Id<'appUsers'>;
  actor: string;
  approveOrder: any;
  onClose: () => void;
  setMessage: React.Dispatch<
    React.SetStateAction<{ type: 'success' | 'error'; text: string } | null>
  >;
}) {
  const [items, setItems] = useState(
    (order.items ?? []).map((item: any) => ({
      orderItemId: item._id,
      approvedQty: String(item.approvedQty ?? item.requestedQty ?? 0),
    }))
  );

  const [saving, setSaving] = useState(false);

  const updateQty = (index: number, value: string) => {
    setItems((current: any[]) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, approvedQty: value } : row
      )
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      await approveOrder({
        orderId: order._id,
        approvedByUserId: appUserId,
        itemApprovals: items.map((item: any) => ({
          orderItemId: item.orderItemId,
          approvedQty: Number(item.approvedQty),
        })),
        actor,
        notes: 'Order approved from campus orders page',
      });

      setMessage({
        type: 'success',
        text: 'Campus order approved.',
      });

      onClose();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to approve campus order.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Approve Order: ${order.orderNumber}`} onClose={onClose} maxWidth="max-w-4xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">
          You can approve full or partial quantities. A quantity of 0 means the item will not be supplied.
        </div>

        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Item
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Requested
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Approve Qty
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {(order.items ?? []).map((item: any, index: number) => (
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
                    {item.requestedQty} {item.unitSnapshot}
                  </td>

                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={items[index]?.approvedQty ?? ''}
                      onChange={(e) => updateQty(index, e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ModalActions onClose={onClose} saving={saving} submitLabel="Approve Order" />
      </form>
    </ModalShell>
  );
}

function OrderDetailsModal({
  order,
  onClose,
}: {
  order: any;
  onClose: () => void;
}) {
  return (
    <ModalShell title={`Campus Order: ${order.orderNumber}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InfoBox label="Requesting" value={niceLabel(order.requestingCampusCode)} />
          <InfoBox label="Supplying" value={niceLabel(order.supplyingCampusCode)} />
          <InfoBox label="Status" value={niceLabel(order.status)} />
          <InfoBox label="Needed By" value={order.neededBy || '—'} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InfoBox label="Requested By" value={order.requestedByName || 'Unknown'} />
          <InfoBox label="Approved By" value={order.approvedByName || '—'} />
          <InfoBox label="Dispatched By" value={order.dispatchedByName || '—'} />
        </div>

        {order.notes && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-brand-text-muted font-semibold mb-1">
              Notes
            </p>
            <p className="text-sm text-brand-text">{order.notes}</p>
          </div>
        )}

        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Item
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Requested
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Approved
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Dispatched
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-muted uppercase">
                  Received
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {(order.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-brand-text-muted">
                    No order items found.
                  </td>
                </tr>
              ) : (
                order.items.map((item: any) => (
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
                      {item.requestedQty} {item.unitSnapshot}
                    </td>

                    <td className="px-4 py-3 text-sm text-brand-text">
                      {item.approvedQty ?? '—'}
                    </td>

                    <td className="px-4 py-3 text-sm text-brand-text">
                      {item.dispatchedQty ?? '—'}
                    </td>

                    <td className="px-4 py-3 text-sm text-brand-text">
                      {item.receivedQty ?? '—'}
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

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    PENDING: {
      label: 'Pending',
      className: 'bg-amber-50 text-amber-700 border-amber-100',
    },
    APPROVED: {
      label: 'Approved',
      className: 'bg-green-50 text-green-700 border-green-100',
    },
    PARTIALLY_APPROVED: {
      label: 'Partial',
      className: 'bg-blue-50 text-blue-700 border-blue-100',
    },
    REJECTED: {
      label: 'Rejected',
      className: 'bg-red-50 text-red-700 border-red-100',
    },
    PACKED: {
      label: 'Packed',
      className: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    },
    DISPATCHED: {
      label: 'Dispatched',
      className: 'bg-purple-50 text-purple-700 border-purple-100',
    },
    RECEIVED: {
      label: 'Received',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    CANCELLED: {
      label: 'Cancelled',
      className: 'bg-gray-100 text-gray-700 border-gray-200',
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

function ActionButton({
  label,
  onClick,
  icon: Icon,
  color = 'gray',
}: {
  label: string;
  onClick: () => void;
  icon?: any;
  color?: 'gray' | 'green' | 'red' | 'blue' | 'purple';
}) {
  const classes = {
    gray: 'bg-gray-100 text-brand-text hover:bg-gray-200',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    red: 'bg-red-50 text-red-700 hover:bg-red-100',
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${classes[color]}`}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-text mb-2">
        {label}
      </label>

      <input
        type={type}
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