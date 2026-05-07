import React, { useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './views/Dashboard';
import { Inventory } from './views/Inventory';
import { Purchases } from './views/Purchases';
import { Kitchen } from './views/Kitchen';
import { CampusOrders } from './views/CampusOrders';
import { Students } from './views/Students';
import { StudentAccountManager } from './views/StudentAccountManager';
import { Settings } from './views/Settings';
import { MealCards } from './views/MealCards';
import { MenuPlanner } from './views/MenuPlanner';
import { Transactions } from './views/Transactions';
import { Reports } from './views/Reports';
import { Receipts } from './views/Receipts';
import { Login } from './views/Login';
import { AddCard } from './views/AddCard';
import { Swimming } from './views/Swimming';
import { MPesaInbox } from './views/MPesaInbox';
import { CardDetails } from './views/CardDetails';
import { Lobby } from './views/Lobby';
import { StudentProfile } from './views/Studentprofile';
import { SMSCenter } from './views/SMScenter';
import { PasswordReset } from './views/Passwordreset';
import { PaymentReview } from './views/PaymentReview';
import ServeMeal from './views/ServeMeal';
import { useAuth } from './context/AuthContext';

function AccessDenied({ title = 'Access Restricted' }: { title?: string }) {
  return (
    <div className="p-8 flex items-center justify-center h-[calc(100vh-80px)]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Wrench className="text-red-400" size={32} />
        </div>
        <h2 className="text-xl font-semibold text-brand-text mb-2">{title}</h2>
        <p className="text-brand-text-muted">
          Your account does not currently have permission to view this section.
        </p>
      </div>
    </div>
  );
}

function App() {
  const { user, logout, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  if (window.location.pathname === '/reset-password') {
    return <PasswordReset />;
  }

  const access = useMemo(() => {
    if (!user) {
      return {
        canSeeDashboard: false,
        canSeeStudents: false,
        canManageStudentAccounts: false,
        canSeeMealCards: false,
        canSeeInventory: false,
        canSeePurchases: false,
        canSeeKitchen: false,
        canSeeCampusOrders: false,
        canSeeMenu: false,
        canSeeTransactions: false,
        canSeeReceipts: false,
        canSeeReports: false,
        canSeeSettings: false,
        canSeeSMSCenter: false,
        canSeeMPesaInbox: false,
        canSeePaymentReview: false,
        canSeeSwimming: false,
        canSeeAddCard: false,
        canServeMeals: false,
      };
    }

    const isAdminLike = ['super_admin', 'admin'].includes(user.role);
    const isLeadership = ['super_admin', 'admin', 'headteacher'].includes(user.role);

    return {
      canSeeDashboard:
        isLeadership ||
        user.permissions.generateReports,

      canSeeStudents:
        user.permissions.viewMainStudents ||
        user.permissions.viewDigitalStudents ||
        user.permissions.viewAllClasses,

      canManageStudentAccounts:
        user.role === 'super_admin',

      canSeeMealCards:
        isAdminLike ||
        user.permissions.markMealsServed,

      canSeeInventory:
        isAdminLike ||
        user.role === 'manager' ||
        user.role === 'staff',

      canSeePurchases:
        isAdminLike ||
        user.role === 'manager' ||
        user.role === 'staff',

      canSeeKitchen:
        isAdminLike ||
        user.role === 'manager' ||
        user.role === 'staff',

      canSeeCampusOrders:
        isAdminLike ||
        user.role === 'manager' ||
        user.role === 'staff',

      canSeeMenu:
        isAdminLike ||
        user.role === 'manager' ||
        user.role === 'staff',

      canSeeTransactions:
        isAdminLike,

      canSeeReceipts:
        isAdminLike,

      canSeeReports:
        isAdminLike ||
        user.permissions.generateReports,

      canSeeSettings:
        isAdminLike,

      canSeeSMSCenter:
        isAdminLike ||
        user.role === 'manager',

      canSeeMPesaInbox:
        isAdminLike,

      canSeePaymentReview:
        isAdminLike ||
        user.role === 'manager',

      canSeeSwimming:
        isLeadership,

      canSeeAddCard:
        isAdminLike,

      canServeMeals:
        isAdminLike ||
        user.role === 'staff',
    };
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user) return <Login />;

  if (user.status === 'pending') return <Lobby />;

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard setCurrentView={setCurrentView} />;

      case 'serve-meal':
        return access.canServeMeals ? <ServeMeal /> : <AccessDenied />;

      case 'payment-review':
        return access.canSeePaymentReview ? <PaymentReview /> : <AccessDenied />;

      case 'students':
        return access.canSeeStudents ? (
          <Students
            onViewCard={(id) => {
              setSelectedCardId(id);
              setCurrentView('card-details');
            }}
            onViewStudent={(id) => {
              setSelectedStudentId(id);
              setCurrentView('student-profile');
            }}
          />
        ) : (
          <AccessDenied />
        );

      case 'student-account-manager':
        return access.canManageStudentAccounts ? (
          <StudentAccountManager />
        ) : (
          <AccessDenied />
        );

      case 'student-profile':
        return selectedStudentId ? (
          <StudentProfile
            studentId={selectedStudentId}
            onBack={() => {
              setSelectedStudentId(null);
              setCurrentView('students');
            }}
          />
        ) : (
          <AccessDenied title="No student selected" />
        );

      case 'meal-cards':
        return access.canSeeMealCards ? (
          <MealCards
            onViewCard={(id) => {
              setSelectedCardId(id);
              setCurrentView('card-details');
            }}
          />
        ) : (
          <AccessDenied />
        );

      case 'card-details':
        return access.canSeeMealCards && selectedCardId ? (
          <CardDetails
            cardId={selectedCardId}
            onBack={() => {
              setSelectedCardId(null);
              setCurrentView('meal-cards');
            }}
          />
        ) : (
          <AccessDenied />
        );

      case 'inventory':
        return access.canSeeInventory ? <Inventory /> : <AccessDenied />;

      case 'purchases':
        return access.canSeePurchases ? <Purchases /> : <AccessDenied />;

      case 'kitchen':
        return access.canSeeKitchen ? <Kitchen /> : <AccessDenied />;

      case 'campus-orders':
        return access.canSeeCampusOrders ? <CampusOrders /> : <AccessDenied />;

      case 'menu':
        return access.canSeeMenu ? <MenuPlanner /> : <AccessDenied />;

      case 'transactions':
        return access.canSeeTransactions ? <Transactions /> : <AccessDenied />;

      case 'receipts':
        return access.canSeeReceipts ? <Receipts /> : <AccessDenied />;

      case 'reports':
        return access.canSeeReports ? <Reports /> : <AccessDenied />;

      case 'settings':
        return access.canSeeSettings ? <Settings /> : <AccessDenied />;

      case 'sms-center':
        return access.canSeeSMSCenter ? <SMSCenter /> : <AccessDenied />;

      case 'mpesa-inbox':
        return access.canSeeMPesaInbox ? <MPesaInbox /> : <AccessDenied />;

      case 'swimming':
        return access.canSeeSwimming ? <Swimming /> : <AccessDenied />;

      case 'add-card':
        return access.canSeeAddCard ? <AddCard /> : <AccessDenied />;

      default:
        return (
          <div className="p-8 flex items-center justify-center h-[calc(100vh-80px)]">
            <p className="text-brand-text-muted">Page not found.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-brand-bg">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">{renderView()}</main>
      </div>
    </div>
  );
}

export default App;