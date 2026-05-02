import React, { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Flame,
  Wheat,
  Leaf,
  X,
  Edit2,
  Trash2,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type DietaryType = 'standard' | 'vegetarian' | 'vegan' | 'healthy';

interface MealItem {
  id: string;
  name: string;
  type: DietaryType;
}

interface DayMenu {
  Breakfast: MealItem[];
  Lunch: MealItem[];
  Snack: MealItem[];
}

interface MenuData {
  [day: string]: DayMenu;
}

export function MenuPlanner() {
  const { user } = useAuth();
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const mealTypes = ['Breakfast', 'Lunch', 'Snack'] as const;
  
  const [menuData, setMenuData] = useState<MenuData>({
    Monday: { Breakfast: [], Lunch: [], Snack: [] },
    Tuesday: { Breakfast: [], Lunch: [], Snack: [] },
    Wednesday: { Breakfast: [], Lunch: [], Snack: [] },
    Thursday: { Breakfast: [], Lunch: [], Snack: [] },
    Friday: { Breakfast: [], Lunch: [], Snack: [] }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ day: string, mealType: string, item: MealItem } | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    day: 'Monday',
    mealType: 'Breakfast',
    name: '',
    type: 'standard' as DietaryType
  });

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/menu');
      if (!response.ok) throw new Error('Failed to fetch menu');
      const data = await response.json();
      
      const organized: MenuData = {
        Monday: { Breakfast: [], Lunch: [], Snack: [] },
        Tuesday: { Breakfast: [], Lunch: [], Snack: [] },
        Wednesday: { Breakfast: [], Lunch: [], Snack: [] },
        Thursday: { Breakfast: [], Lunch: [], Snack: [] },
        Friday: { Breakfast: [], Lunch: [], Snack: [] }
      };

      data.forEach((item: any) => {
        if (organized[item.day]) {
          organized[item.day][item.meal_type as keyof DayMenu].push({
            id: item.id,
            name: item.name,
            type: item.dietary_type as DietaryType
          });
        }
      });

      setMenuData(organized);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = (day?: string) => {
    setEditingItem(null);
    setFormData({
      day: day || 'Monday',
      mealType: 'Breakfast',
      name: '',
      type: 'standard'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (day: string, mealType: string, item: MealItem) => {
    setEditingItem({ day, mealType, item });
    setFormData({
      day,
      mealType,
      name: item.name,
      type: item.type
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem ? `/api/menu/${editingItem.item.id}` : '/api/menu';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: formData.day,
          meal_type: formData.mealType,
          name: formData.name,
          dietary_type: formData.type
        })
      });

      if (!response.ok) throw new Error('Failed to save menu item');
      
      await fetchMenu();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      const response = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete item');
      await fetchMenu();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getDietaryIcon = (type: DietaryType) => {
    switch (type) {
      case 'vegetarian': return <Leaf size={14} className="text-emerald-500" />;
      case 'vegan': return <Leaf size={14} className="text-green-600" />;
      case 'healthy': return <Flame size={14} className="text-orange-500" />;
      default: return <Wheat size={14} className="text-amber-500" />;
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[calc(100vh-80px)]">
        <Loader2 className="animate-spin text-brand-primary mb-4" size={48} />
        <p className="text-brand-text-muted">Loading menu planner...</p>
      </div>
    );
  }

  const renderDietaryTag = (type: DietaryType) => {
    switch (type) {
      case 'vegetarian':
        return (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            <Leaf size={10} /> Veg
          </span>
        );
      case 'vegan':
        return (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            <Leaf size={10} /> Vegan
          </span>
        );
      case 'healthy':
        return (
          <span className="flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
            <Wheat size={10} /> Healthy
          </span>
        );
      default:
        return null;
    }
  };

  const handlePrintMenu = () => {
    window.print();
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Menu Planner</h1>
          <p className="text-brand-text-muted mt-1">Plan and manage weekly cafeteria menus</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrintMenu} className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Print Menu
          </button>
          <button 
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Add Item
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
            <h2 className="text-lg font-semibold text-brand-text flex items-center gap-2">
              <CalendarDays size={20} className="text-brand-primary" />
              Oct 23 - Oct 27, 2023
            </h2>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight size={20} className="text-gray-500" />
            </button>
          </div>
          <button className="text-sm font-medium text-brand-navy hover:underline">
            Today
          </button>
        </div>

        <div className="grid grid-cols-5 divide-x divide-gray-100">
          {weekDays.map((day) => (
            <div key={day} className="min-h-[600px]">
              <div className="p-4 text-center border-b border-gray-100 bg-gray-50/50">
                <p className="font-semibold text-brand-text">{day}</p>
              </div>
              
              <div className="p-4 space-y-6">
                {mealTypes.map(mealType => (
                  <div key={mealType} className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{mealType}</h3>
                    {menuData[day][mealType].map(item => (
                      <div 
                        key={item.id}
                        onClick={() => handleOpenEditModal(day, mealType, item)}
                        className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative"
                      >
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit2 size={14} className="text-gray-400 hover:text-brand-navy" />
                        </div>
                        <p className="text-sm font-medium text-brand-text group-hover:text-brand-navy pr-5">{item.name}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {renderDietaryTag(item.type)}
                        </div>
                      </div>
                    ))}
                    {menuData[day][mealType].length === 0 && (
                      <div className="text-xs text-gray-400 italic py-2 text-center border border-dashed border-gray-100 rounded-lg">
                        No items
                      </div>
                    )}
                  </div>
                ))}

                <button 
                  onClick={() => handleOpenAddModal(day)}
                  className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs font-medium text-gray-400 hover:text-brand-navy hover:border-brand-navy hover:bg-gray-50 transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={14} /> Add Item
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-text">
                {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                  <select
                    value={formData.day}
                    onChange={(e) => setFormData({...formData, day: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  >
                    {weekDays.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meal</label>
                  <select
                    value={formData.mealType}
                    onChange={(e) => setFormData({...formData, mealType: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  >
                    {mealTypes.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="e.g. Grilled Chicken Salad"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as DietaryType})}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                >
                  <option value="standard">Standard</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="healthy">Healthy</option>
                </select>
              </div>

              <div className="mt-6 flex gap-3 pt-4 border-t border-gray-100">
                {editingItem && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors flex items-center justify-center"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors"
                >
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
