import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

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
  /**
   * Convex document ID for appUsers table.
   * We keep all three fields so older pages and newer pages can safely read it.
   */
  _id: Id<'appUsers'>;
  id: Id<'appUsers'>;
  appUserId: Id<'appUsers'>;

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
  login: (email: string) => Promise<boolean>;
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

function normalizePermissions(permissions: Partial<Permissions> | undefined): Permissions {
  return {
    ...emptyPermissions,
    ...(permissions || {}),
  };
}

function normalizeSchool(value: any): 'main' | 'digital' | 'both' {
  if (value === 'digital') return 'digital';
  if (value === 'both') return 'both';
  return 'main';
}

function normalizeRole(value: any): Role {
  if (
    value === 'super_admin' ||
    value === 'admin' ||
    value === 'manager' ||
    value === 'staff' ||
    value === 'teacher' ||
    value === 'headteacher'
  ) {
    return value;
  }

  return 'staff';
}

function normalizeStatus(value: any): 'active' | 'pending' | 'deactivated' {
  if (value === 'active' || value === 'pending' || value === 'deactivated') {
    return value;
  }

  return 'pending';
}

// Map Convex appUsers document to frontend auth user.
function mapToContextUser(appUser: any): User | null {
  const convexUserId = appUser?._id || appUser?.id || appUser?.appUserId;

  if (!convexUserId) {
    console.error('AuthContext: appUser is missing Convex _id/id/appUserId:', appUser);
    return null;
  }

  return {
    _id: convexUserId,
    id: convexUserId,
    appUserId: convexUserId,

    name: appUser?.name || '',
    staff_id: appUser?.staff_id || '',
    email: appUser?.email || '',
    school: normalizeSchool(appUser?.school),
    role: normalizeRole(appUser?.role),
    status: normalizeStatus(appUser?.status),
    permissions: normalizePermissions(appUser?.permissions),
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

      const savedEmail = localStorage.getItem('cafeteria_user_email');

      if (!savedEmail) {
        setUser(null);
        return;
      }

      const appUser = await convex.query(api.appUsers.getUserProfileByEmail, {
        email: savedEmail.trim().toLowerCase(),
      });

      if (!appUser) {
        localStorage.removeItem('cafeteria_user_email');
        localStorage.removeItem('cafeteria_app_user_id');
        setUser(null);
        return;
      }

      const mappedUser = mapToContextUser(appUser);

      if (!mappedUser) {
        localStorage.removeItem('cafeteria_user_email');
        localStorage.removeItem('cafeteria_app_user_id');
        setUser(null);
        return;
      }

      localStorage.setItem('cafeteria_user_email', mappedUser.email);
      localStorage.setItem('cafeteria_app_user_id', mappedUser.id);

      setUser(mappedUser);
    } catch (error) {
      console.error('Auth Refresh Error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string) => {
    try {
      setLoading(true);

      const appUser = await convex.query(api.appUsers.getUserProfileByEmail, {
        email: email.trim().toLowerCase(),
      });

      if (!appUser) {
        return false;
      }

      const mappedUser = mapToContextUser(appUser);

      if (!mappedUser) {
        return false;
      }

      localStorage.setItem('cafeteria_user_email', mappedUser.email);
      localStorage.setItem('cafeteria_app_user_id', mappedUser.id);

      setUser(mappedUser);

      return true;
    } catch (error) {
      console.error('Login Error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('cafeteria_user_email');
    localStorage.removeItem('cafeteria_app_user_id');
    setUser(null);
  };

  const hasPermission = (permission: keyof Permissions) => {
    if (!user) return false;

    if (user.role === 'super_admin' || user.role === 'admin') {
      return true;
    }

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