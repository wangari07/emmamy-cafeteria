import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { authClient } from '../lib/auth-client';

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
  id: string | number;
  name: string;
  staff_id: string;
  email: string;
  school: 'main' | 'digital' | 'both';
  role: Role;
  status: 'active' | 'pending' | 'deactivated';
  permissions: Permissions;
  class_assigned?: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
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

function mapToContextUser(sessionUser: any, appUser: any): User {
  return {
    id: appUser?._id || sessionUser?.id || sessionUser?.email || '',
    name: appUser?.name || sessionUser?.name || '',
    staff_id: appUser?.staff_id || '',
    email: appUser?.email || sessionUser?.email || '',
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

      const session = await authClient.getSession();
      console.log('GET SESSION RESULT:', session);

      const sessionUser = session?.data?.user;

      if (!sessionUser?.email) {
        console.log('NO SESSION USER EMAIL');
        setUser(null);
        return;
      }

      const appUser = await convex.query(api.appUsers.getUserProfileByEmail, {
        email: sessionUser.email.trim().toLowerCase(),
      });

      console.log('APP USER RESULT:', appUser);

      const mergedUser = mapToContextUser(sessionUser, appUser);
      console.log('MERGED USER:', mergedUser);

      setUser(mergedUser);
    } catch (error) {
      console.error('Failed to fetch user session/profile', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error('Failed to logout', error);
    } finally {
      setUser(null);
    }
  };

  const hasPermission = (permission: keyof Permissions) => {
    if (!user) return false;
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