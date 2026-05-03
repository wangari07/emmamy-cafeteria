import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';

export type Role =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'teacher'
  | 'headteacher';

export interface Permissions {
  viewMainStudents: boolean;
  viewDigitalStudents: boolean;
  viewParentContacts: boolean;
  markMealsServed: boolean;
  editMealRegistration: boolean;
  viewHistoricalData: boolean;
  generateReports: boolean;
  viewAllClasses: boolean;
  viewFullHistory: boolean;
}

export interface User {
  id: string;
  name: string;
  staff_id: string;
  email: string;
  school: 'main' | 'digital' | 'both';
  role: Role;
  status: 'active' | 'pending' | 'deactivated';
  permissions: Permissions;
  class_assigned?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string) => Promise<boolean>; // Changed to handle direct login
  logout: () => void;
  hasPermission: (permission: keyof Permissions) => boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const emptyPermissions: Permissions = {
  viewMainStudents: false,
  viewDigitalStudents: false,
  viewParentContacts: false,
  markMealsServed: false,
  editMealRegistration: false,
  viewHistoricalData: false,
  generateReports: false,
  viewAllClasses: false,
  viewFullHistory: false,
};

// Map Convex data to our App User interface
function mapToContextUser(appUser: any): User {
  return {
    id: appUser?._id || '',
    name: appUser?.name || '',
    staff_id: appUser?.staff_id || '',
    email: appUser?.email || '',
    school: appUser?.school || 'main',
    role: appUser?.role || 'staff',
    status: appUser?.status || 'pending',
    permissions: appUser?.permissions || emptyPermissions,
    class_assigned: appUser?.class_assigned,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      setLoading(true);
      
      // Look for a saved email in the browser's storage
      const savedEmail = localStorage.getItem('cafeteria_user_email');

      if (!savedEmail) {
        setUser(null);
        return;
      }

      // Query Convex directly using the email
      const appUser = await convex.query(api.appUsers.getUserProfileByEmail, {
        email: savedEmail.trim().toLowerCase(),
      });

      if (appUser) {
        setUser(mapToContextUser(appUser));
      } else {
        // If email exists but user not found in Convex, clear storage
        localStorage.removeItem('cafeteria_user_email');
        setUser(null);
      }
    } catch (error) {
      console.error('Auth Refresh Error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  /**
   * Login function that checks Convex and saves session locally
   */
  const login = async (email: string) => {
    try {
      setLoading(true);
      const appUser = await convex.query(api.appUsers.getUserProfileByEmail, {
        email: email.trim().toLowerCase(),
      });

      if (appUser) {
        localStorage.setItem('cafeteria_user_email', appUser.email);
        setUser(mapToContextUser(appUser));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login Error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('cafeteria_user_email');
    setUser(null);
  };

  const hasPermission = (permission: keyof Permissions) => {
    if (!user) return false;
    // Admins bypass all permission checks
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    return user.permissions?.[permission] === true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        hasPermission,
        loading,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}