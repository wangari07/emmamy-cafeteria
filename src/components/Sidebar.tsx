import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  CreditCard,
  Package,
  CalendarDays,
  ArrowRightLeft,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Receipt,
  Wallet,
  Utensils,
  UserCog,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onLogout: () => void | Promise<void>;
}

export function Sidebar({ currentView, setCurrentView, onLogout }: SidebarProps) {
  const { user } = useAuth();

  const access = useMemo(() => {
    if (!user) {
      return {
        canSeeDashboard: false,
        canSeeStudents: false,
        canManageStudentAccounts: false,
        canSeeMealCards: false,
        canSeeInventory: false,
        canSeeMenu: false,
        canSeeTransactions: false,
        canSeeReceipts: false,
        canSeeReports: false,
        canSeeSettings: false,
        canSeePaymentReview: false,
        canServeMeals: false,
      };
    }

    const isAdminLike = ['super_admin', 'admin'].includes(user.role);
    const isLeadership = ['super_admin', 'admin', 'headteacher'].includes(user.role);

    return {
      canSeeDashboard:
        isLeadership ||
        user.permissions.generateReports ||
        user.permissions.viewHistoricalData,

      canSeeStudents:
        user.permissions.viewMainStudents ||
        user.permissions.viewDigitalStudents ||
        user.permissions.viewAllClasses,

      canManageStudentAccounts: user.role === 'super_admin',

      canSeeMealCards:
        isAdminLike ||
        user.permissions.markMealsServed ||
        user.permissions.editMealRegistration,

      canSeeInventory:
        isAdminLike ||
        user.role === 'manager' ||
        user.role === 'staff',

      canSeeMenu:
        isAdminLike ||
        user.role === 'manager' ||
        user.role === 'staff',

      canSeeTransactions:
        isAdminLike ||
        user.permissions.generateReports,

      canSeeReceipts:
        isAdminLike ||
        user.permissions.generateReports,

      canSeeReports:
        isAdminLike ||
        user.permissions.generateReports ||
        user.permissions.viewHistoricalData,

      canSeeSettings: isAdminLike,

      canSeePaymentReview:
        isAdminLike ||
        user.role === 'manager',

      canServeMeals:
        isAdminLike ||
        user.role === 'staff',
    };
  }, [user]);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      visible: access.canSeeDashboard,
    },
    {
      id: 'serve-meal',
      label: 'Serve Meal',
      icon: Utensils,
      visible: access.canServeMeals,
    },
    {
      id: 'payment-review',
      label: 'Payment Review',
      icon: Wallet,
      visible: access.canSeePaymentReview,
    },
    {
      id: 'students',
      label: 'Students',
      icon: Users,
      visible: access.canSeeStudents,
    },
    {
      id: 'student-account-manager',
      label: 'Student Accounts',
      icon: UserCog,
      visible: access.canManageStudentAccounts,
    },
    {
      id: 'meal-cards',
      label: 'Meal Cards',
      icon: CreditCard,
      visible: access.canSeeMealCards,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Package,
      visible: access.canSeeInventory,
    },
    {
      id: 'menu',
      label: 'Menu Planner',
      icon: CalendarDays,
      visible: access.canSeeMenu,
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: ArrowRightLeft,
      visible: access.canSeeTransactions,
    },
    {
      id: 'receipts',
      label: 'Receipts',
      icon: Receipt,
      visible: access.canSeeReceipts,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      visible: access.canSeeReports,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      visible: access.canSeeSettings,
    },
  ];

  const filteredNavItems = navItems.filter((item) => item.visible);

  return (
    <aside className="w-64 bg-brand-navy text-white flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center">
            <span className="text-brand-navy font-bold text-xl">C</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Cafeteria Hub</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive
                  ? 'bg-brand-primary text-brand-navy font-medium'
                  : 'text-gray-400 hover:bg-brand-navy-light hover:text-white'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-brand-navy' : ''} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-brand-navy-light">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-brand-navy-light hover:text-white transition-colors"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}