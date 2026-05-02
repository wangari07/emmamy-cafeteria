import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
  Package
} from 'lucide-react';

export function Inventory() {
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'Produce', stock: 0, unit: 'lbs' });
  const [delivery, setDelivery] = useState({ itemId: '', quantity: 0, supplier: '' });
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter !== 'All') params.append('category', categoryFilter);
      if (statusFilter !== 'All') params.append('status', statusFilter);

      const response = await fetch(`/api/inventory?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch inventory');
      const data = await response.json();
      setInventoryData(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
      if (!response.ok) throw new Error('Failed to add item');
      setShowAddModal(false);
      fetchInventory();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleLogDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/inventory/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delivery),
      });
      if (!response.ok) throw new Error('Failed to log delivery');
      setShowDeliveryModal(false);
      fetchInventory();
    } catch (error) {
      console.error('Error logging delivery:', error);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [searchTerm, categoryFilter, statusFilter]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedInventoryData = [...inventoryData].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let aValue = a[sortColumn];
    let bValue = b[sortColumn];

    if (sortColumn === 'last_updated') {
      aValue = new Date(aValue || 0).getTime();
      bValue = new Date(bValue || 0).getTime();
    } else if (sortColumn === 'name') {
      aValue = (aValue || '').toLowerCase();
      bValue = (bValue || '').toLowerCase();
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Inventory & Stock</h1>
          <p className="text-brand-text-muted mt-1">Manage ingredients, supplies, and deliveries</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowDeliveryModal(true)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Log Delivery
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Add Item
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search inventory items..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
          />
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text hover:bg-gray-100 transition-colors">
            <Filter size={16} />
            Category
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-brand-text hover:bg-gray-100 transition-colors">
            <Filter size={16} />
            Status
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:text-brand-text"
                    onClick={() => handleSort('name')}
                  >
                    Item Name <ArrowUpDown size={14} className={sortColumn === 'name' ? 'text-brand-primary' : ''} />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:text-brand-text"
                    onClick={() => handleSort('stock')}
                  >
                    Stock Level <ArrowUpDown size={14} className={sortColumn === 'stock' ? 'text-brand-primary' : ''} />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:text-brand-text"
                    onClick={() => handleSort('last_updated')}
                  >
                    Last Updated <ArrowUpDown size={14} className={sortColumn === 'last_updated' ? 'text-brand-primary' : ''} />
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedInventoryData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-brand-text">{item.name}</p>
                        <p className="text-xs text-brand-text-muted">{item.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-brand-text">{item.stock}</span>
                      <span className="text-xs text-brand-text-muted">{item.unit}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-brand-text-muted">
                    {item.last_updated ? new Date(item.last_updated).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-gray-400 hover:text-brand-navy rounded-lg hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
          <p className="text-sm text-brand-text-muted">Showing 1 to 6 of 124 items</p>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">Previous</button>
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-brand-text hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>
      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New Inventory Item</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Item Name</label>
                <input 
                  type="text" required
                  className="w-full px-4 py-2 border rounded-lg"
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select 
                  className="w-full px-4 py-2 border rounded-lg"
                  value={newItem.category}
                  onChange={e => setNewItem({...newItem, category: e.target.value})}
                >
                  <option>Produce</option>
                  <option>Dairy</option>
                  <option>Meat</option>
                  <option>Bakery</option>
                  <option>Dry Goods</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Initial Stock</label>
                  <input 
                    type="number" required
                    className="w-full px-4 py-2 border rounded-lg"
                    value={newItem.stock}
                    onChange={e => setNewItem({...newItem, stock: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Unit</label>
                  <input 
                    type="text" required placeholder="lbs, kg, Gallons..."
                    className="w-full px-4 py-2 border rounded-lg"
                    value={newItem.unit}
                    onChange={e => setNewItem({...newItem, unit: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-primary text-brand-navy rounded-lg font-bold">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Delivery Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Log Delivery</h2>
            <form onSubmit={handleLogDelivery} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Item</label>
                <select 
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                  value={delivery.itemId}
                  onChange={e => setDelivery({...delivery, itemId: e.target.value})}
                >
                  <option value="">Select an item...</option>
                  {inventoryData.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity Received</label>
                <input 
                  type="number" required
                  className="w-full px-4 py-2 border rounded-lg"
                  value={delivery.quantity}
                  onChange={e => setDelivery({...delivery, quantity: parseInt(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Supplier</label>
                <input 
                  type="text" required
                  className="w-full px-4 py-2 border rounded-lg"
                  value={delivery.supplier}
                  onChange={e => setDelivery({...delivery, supplier: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowDeliveryModal(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-primary text-brand-navy rounded-lg font-bold">Log Delivery</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'In Stock':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
          <CheckCircle2 size={12} />
          {status}
        </span>
      );
    case 'Low Stock':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
          <AlertTriangle size={12} />
          {status}
        </span>
      );
    case 'Critical':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-100">
          <AlertTriangle size={12} />
          {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
          {status}
        </span>
      );
  }
}
