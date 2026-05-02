import React, { useMemo, useState } from 'react';
import {
  Building2,
  Users,
  Shield,
  CheckCircle,
  XCircle,
  Save,
  Loader2,
} from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';

type Role =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'teacher'
  | 'headteacher';

type School = 'main' | 'digital' | 'both';

type Permissions = {
  viewMainStudents: boolean;
  viewDigitalStudents: boolean;
  viewParentContacts: boolean;
  markMealsServed: boolean;
  editMealRegistration: boolean;
  viewHistoricalData: boolean;
  generateReports: boolean;
  viewAllClasses: boolean;
  viewFullHistory: boolean;
};

const getPermissionsForRole = (role: Role): Permissions => {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return {
        viewMainStudents: true,
        viewDigitalStudents: true,
        viewParentContacts: true,
        markMealsServed: true,
        editMealRegistration: true,
        viewHistoricalData: true,
        generateReports: true,
        viewAllClasses: true,
        viewFullHistory: true,
      };
    case 'manager':
      return {
        viewMainStudents: true,
        viewDigitalStudents: true,
        viewParentContacts: true,
        markMealsServed: true,
        editMealRegistration: true,
        viewHistoricalData: true,
        generateReports: true,
        viewAllClasses: true,
        viewFullHistory: false,
      };
    case 'teacher':
      return {
        viewMainStudents: true,
        viewDigitalStudents: true,
        viewParentContacts: false,
        markMealsServed: false,
        editMealRegistration: false,
        viewHistoricalData: false,
        generateReports: false,
        viewAllClasses: false,
        viewFullHistory: false,
      };
    case 'headteacher':
      return {
        viewMainStudents: true,
        viewDigitalStudents: true,
        viewParentContacts: true,
        markMealsServed: false,
        editMealRegistration: false,
        viewHistoricalData: true,
        generateReports: true,
        viewAllClasses: true,
        viewFullHistory: true,
      };
    case 'staff':
    default:
      return {
        viewMainStudents: true,
        viewDigitalStudents: true,
        viewParentContacts: false,
        markMealsServed: true,
        editMealRegistration: false,
        viewHistoricalData: false,
        generateReports: false,
        viewAllClasses: true,
        viewFullHistory: false,
      };
  }
};

export function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'security'>('general');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const allUsers = useQuery(api.appUsers.listAllUsers, {}) || [];
  const approveUser = useMutation(api.appUsers.approveUser);
  const updateUserPermissions = useMutation(api.appUsers.updateUserPermissions);
  const deactivateUser = useMutation(api.appUsers.deactivateUser);
  const reactivateUser = useMutation(api.appUsers.reactivateUser);

  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        role: Role;
        school: School;
        class_assigned?: string;
      }
    >
  >({});

  const visibleUsers = useMemo(() => {
    return [...allUsers].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allUsers]);

  const getDraft = (u: any) => {
    return drafts[u._id] || {
      role: u.role as Role,
      school: u.school as School,
      class_assigned: u.class_assigned || '',
    };
  };

  const setDraft = (
    userId: string,
    patch: Partial<{ role: Role; school: School; class_assigned?: string }>
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        ...patch,
      },
    }));
  };

  const clearDraft = (userId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const handleApprove = async (u: any) => {
    const draft = getDraft(u);
    setSavingUserId(u._id);

    try {
      await approveUser({
        userId: u._id,
        approvedBy: user?.email || 'system',
        role: draft.role,
        school: draft.school,
        permissions: getPermissionsForRole(draft.role),
        class_assigned: draft.role === 'teacher' ? draft.class_assigned || undefined : undefined,
      });

      clearDraft(u._id);
    } catch (error) {
      console.error('Failed to approve user', error);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleSaveAccess = async (u: any) => {
    const draft = getDraft(u);
    setSavingUserId(u._id);

    try {
      await updateUserPermissions({
        userId: u._id,
        role: draft.role,
        school: draft.school,
        permissions: getPermissionsForRole(draft.role),
        class_assigned: draft.role === 'teacher' ? draft.class_assigned || undefined : undefined,
      });

      clearDraft(u._id);
    } catch (error) {
      console.error('Failed to update user access', error);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDeactivate = async (userId: string) => {
    setSavingUserId(userId);
    try {
      await deactivateUser({ userId: userId as any });
      clearDraft(userId);
    } catch (error) {
      console.error('Failed to deactivate user', error);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    setSavingUserId(userId);
    try {
      await reactivateUser({ userId: userId as any });
      clearDraft(userId);
    } catch (error) {
      console.error('Failed to reactivate user', error);
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Settings</h1>
        <p className="text-brand-text-muted mt-1">
          Manage school details, user approvals, and account access.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 shrink-0">
          <nav className="space-y-1">
            {[
              { id: 'general', label: 'School Profile', icon: Building2 },
              ...(user?.role === 'super_admin'
                ? [{ id: 'users', label: 'User Management', icon: Users }]
                : []),
              { id: 'security', label: 'Security', icon: Shield },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as 'general' | 'users' | 'security')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-brand-primary/20 text-brand-navy'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-brand-navy'
                }`}
              >
                <item.icon
                  size={18}
                  className={activeTab === item.id ? 'text-brand-navy' : 'text-gray-400'}
                />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 space-y-6">
          {activeTab === 'general' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-brand-text">School Profile</h2>
                <p className="text-sm text-brand-text-muted mt-1">
                  Simple read-only profile for now. We can make this editable later after the core
                  flows are done.
                </p>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-text">School Name</label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    {import.meta.env.VITE_SCHOOL_NAME || 'Emmamy group of schools'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-text">School Phone</label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    {import.meta.env.VITE_SCHOOL_PHONE || 'Not set'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-text">Signed In As</label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    {user?.name || 'Unknown'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-text">Your Role</label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm capitalize">
                    {user?.role || 'Unknown'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && user?.role === 'super_admin' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-brand-text">User Management</h2>
                <p className="text-sm text-brand-text-muted mt-1">
                  Approve pending users, assign campus, and control access.
                </p>
              </div>

              <div className="p-6 space-y-4">
                {visibleUsers.length === 0 ? (
                  <div className="text-sm text-brand-text-muted">No users found.</div>
                ) : (
                  visibleUsers.map((u) => {
                    const draft = getDraft(u);
                    const isSaving = savingUserId === u._id;

                    return (
                      <div
                        key={u._id}
                        className="border border-gray-100 rounded-2xl p-5 space-y-4"
                      >
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div>
                            <div className="text-base font-semibold text-brand-text">{u.name}</div>
                            <div className="text-sm text-brand-text-muted">{u.email}</div>
                            <div className="text-xs text-brand-text-muted mt-1">
                              Staff ID: {u.staff_id}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                u.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : u.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {u.status}
                            </span>

                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                              {u.role}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                              Requested Campus
                            </label>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm capitalize">
                              {u.requestedSchool || 'Not specified'}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                              Assigned Campus
                            </label>
                            <select
                              value={draft.school}
                              onChange={(e) =>
                                setDraft(u._id, { school: e.target.value as School })
                              }
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            >
                              <option value="main">Main School</option>
                              <option value="digital">Digital School</option>
                              <option value="both">Both</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                              Role
                            </label>
                            <select
                              value={draft.role}
                              onChange={(e) =>
                                setDraft(u._id, { role: e.target.value as Role })
                              }
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            >
                              <option value="super_admin">Super Admin</option>
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                              <option value="staff">Staff</option>
                              <option value="teacher">Teacher</option>
                              <option value="headteacher">Headteacher</option>
                            </select>
                          </div>
                        </div>

                        {draft.role === 'teacher' && (
                          <div className="max-w-sm space-y-2">
                            <label className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                              Assigned Class
                            </label>
                            <input
                              type="text"
                              value={draft.class_assigned || ''}
                              onChange={(e) =>
                                setDraft(u._id, { class_assigned: e.target.value })
                              }
                              placeholder="e.g. Form 2A"
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            />
                          </div>
                        )}

                        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                          <div className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">
                            Default Permissions For This Role
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-brand-text-muted">
                            {Object.entries(getPermissionsForRole(draft.role)).map(
                              ([key, value]) => (
                                <div key={key} className="flex items-center justify-between">
                                  <span>{key}</span>
                                  <span
                                    className={
                                      value ? 'text-emerald-600 font-medium' : 'text-gray-400'
                                    }
                                  >
                                    {value ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {u.status === 'pending' ? (
                            <button
                              onClick={() => handleApprove(u)}
                              disabled={isSaving}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                              {isSaving ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <CheckCircle size={16} />
                              )}
                              Approve User
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSaveAccess(u)}
                              disabled={isSaving}
                              className="px-4 py-2 bg-brand-navy text-white rounded-xl text-sm font-medium hover:bg-brand-navy-light transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                              {isSaving ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Save size={16} />
                              )}
                              Save Access
                            </button>
                          )}

                          {u.status === 'deactivated' ? (
                            <button
                              onClick={() => handleReactivate(u._id)}
                              disabled={isSaving}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeactivate(u._id)}
                              disabled={isSaving}
                              className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                              <XCircle size={16} />
                              Deactivate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-brand-text">Security</h2>
                <p className="text-sm text-brand-text-muted mt-1">
                  Basic account information for now. We can add password-change flow here next.
                </p>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-text">Name</label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    {user?.name || 'Unknown'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-text">Email</label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    {user?.email || 'Unknown'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-text">Campus</label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm capitalize">
                    {user?.school || 'Unknown'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-text">Status</label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm capitalize">
                    {user?.status || 'Unknown'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}