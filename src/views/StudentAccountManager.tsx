import React, { useMemo, useState } from 'react';
import {
  Search,
  UserCog,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  RefreshCcw,
  Save,
} from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

type MealSelection = {
  lunch: boolean;
  fruit: boolean;
  tea: boolean;
  snacks: boolean;
};

type AdjustmentType = 'TOP_UP' | 'DEDUCTION' | 'SET_BALANCE';

export function StudentAccountManager() {
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<Id<'students'> | null>(null);

  const [mealPackage, setMealPackage] = useState('MID_TERM_PACKAGE');
  const [openingPoints, setOpeningPoints] = useState('3000');
  const [adjustAmount, setAdjustAmount] = useState('300');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('TOP_UP');
  const [reason, setReason] = useState('Parent paid before system launch');

  const [meals, setMeals] = useState<MealSelection>({
    lunch: true,
    fruit: true,
    tea: true,
    snacks: true,
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const students = useQuery(api.students.list, {
    search: search.trim() || undefined,
  });

  const activateWithOpeningBalance = useMutation(
    api.students.activateStudentWithOpeningBalance
  );

  const updateMealRegistration = useMutation(api.students.updateMealRegistration);
  const manualAdjustStudentPoints = useMutation(api.students.manualAdjustStudentPoints);
  const deactivateMealRegistration = useMutation(api.students.deactivateMealRegistration);

  const selectedStudent = useMemo(() => {
    if (!students || !selectedStudentId) return null;
    return students.find((student) => student._id === selectedStudentId) ?? null;
  }, [students, selectedStudentId]);

  const visibleStudents = students ?? [];

  const handleSelectStudent = (student: any) => {
    setSelectedStudentId(student._id);

    setMealPackage(student.mealPackage || 'MID_TERM_PACKAGE');

    setMeals({
      lunch: student.meals?.lunch ?? true,
      fruit: student.meals?.fruit ?? true,
      tea: student.meals?.tea ?? true,
      snacks: student.meals?.snacks ?? true,
    });

    setMessage(null);
  };

  const toggleMeal = (meal: keyof MealSelection) => {
    setMeals((prev) => ({
      ...prev,
      [meal]: !prev[meal],
    }));
  };

  const handleActivateWithOpeningBalance = async () => {
    if (!selectedStudentId) {
      setMessage({ type: 'error', text: 'Select a student first.' });
      return;
    }

    const parsedOpeningPoints = Number(openingPoints);

    if (!mealPackage.trim()) {
      setMessage({ type: 'error', text: 'Meal package is required.' });
      return;
    }

    if (Number.isNaN(parsedOpeningPoints) || parsedOpeningPoints < 0) {
      setMessage({ type: 'error', text: 'Opening points must be a valid number.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);

      await activateWithOpeningBalance({
        studentId: selectedStudentId,
        mealPackage: mealPackage.trim(),
        meals,
        openingPoints: parsedOpeningPoints,
        reason: reason.trim() || undefined,
      });

      setMessage({
        type: 'success',
        text: 'Student activated and opening balance set successfully.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to activate student.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMealRegistration = async () => {
    if (!selectedStudentId) {
      setMessage({ type: 'error', text: 'Select a student first.' });
      return;
    }

    if (!mealPackage.trim()) {
      setMessage({ type: 'error', text: 'Meal package is required.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);

      await updateMealRegistration({
        studentId: selectedStudentId,
        hasMealRegistration: true,
        mealPackage: mealPackage.trim(),
        meals,
      });

      setMessage({
        type: 'success',
        text: 'Meal registration updated successfully.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to update meal registration.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivateMealRegistration = async () => {
    if (!selectedStudentId) {
      setMessage({ type: 'error', text: 'Select a student first.' });
      return;
    }

    const confirmed = window.confirm(
      'Deactivate meal registration for this student? This will remove their meal package but will not remove their points.'
    );

    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      setMessage(null);

      await deactivateMealRegistration({
        studentId: selectedStudentId,
        reason: reason.trim() || undefined,
      });

      setMessage({
        type: 'success',
        text: 'Meal registration deactivated.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to deactivate meal registration.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualAdjustment = async () => {
    if (!selectedStudentId) {
      setMessage({ type: 'error', text: 'Select a student first.' });
      return;
    }

    const parsedAmount = Number(adjustAmount);

    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      setMessage({ type: 'error', text: 'Amount must be a valid number.' });
      return;
    }

    if (adjustmentType !== 'SET_BALANCE' && parsedAmount <= 0) {
      setMessage({ type: 'error', text: 'Amount must be greater than zero.' });
      return;
    }

    const actionText =
      adjustmentType === 'TOP_UP'
        ? `add ${parsedAmount} points`
        : adjustmentType === 'DEDUCTION'
          ? `deduct ${parsedAmount} points`
          : `set balance to ${parsedAmount} points`;

    const confirmed = window.confirm(
      `Confirm you want to ${actionText} for ${selectedStudent?.studentName || 'this student'}?`
    );

    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      setMessage(null);

      await manualAdjustStudentPoints({
        studentId: selectedStudentId,
        amount: parsedAmount,
        type: adjustmentType,
        reason: reason.trim() || undefined,
      });

      setMessage({
        type: 'success',
        text: 'Student points updated successfully.',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to update points.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-brand-primary/20 flex items-center justify-center">
              <UserCog className="text-brand-primary" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-brand-text">
                Student Account Manager
              </h1>
              <p className="text-brand-text-muted">
                Activate students, assign meal packages, and adjust points manually.
              </p>
            </div>
          </div>
        </div>
      </div>

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
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
          )}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-1 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-brand-text mb-3">Find Student</h2>
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, adm no, parent, phone..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
            </div>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {students === undefined ? (
              <div className="p-5 text-sm text-brand-text-muted">Loading students...</div>
            ) : visibleStudents.length === 0 ? (
              <div className="p-5 text-sm text-brand-text-muted">No students found.</div>
            ) : (
              visibleStudents.slice(0, 80).map((student: any) => {
                const active = selectedStudentId === student._id;

                return (
                  <button
                    key={student._id}
                    onClick={() => handleSelectStudent(student)}
                    className={`w-full text-left p-4 border-b border-gray-100 transition ${
                      active ? 'bg-brand-primary/10' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-brand-text">
                          {student.studentName}
                        </p>
                        <p className="text-sm text-brand-text-muted">
                          Adm: {student.admNo} • {student.class}
                        </p>
                        <p className="text-xs text-brand-text-muted mt-1">
                          {student.school}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                            student.hasMealRegistration
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {student.hasMealRegistration ? 'Active' : 'Inactive'}
                        </span>
                        <p className="text-sm font-bold mt-2">
                          {student.currentPoints ?? 0} pts
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-brand-text mb-4">Selected Student</h2>

            {!selectedStudent ? (
              <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-8 text-center">
                <p className="text-brand-text-muted">
                  Select a student from the list to manage their account.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <p className="text-sm text-brand-text-muted">Student</p>
                  <h3 className="text-xl font-bold text-brand-text">
                    {selectedStudent.studentName}
                  </h3>
                  <p className="text-sm text-brand-text-muted">
                    {selectedStudent.admNo} • {selectedStudent.class} •{' '}
                    {selectedStudent.school}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-brand-text-muted">Meal Status</p>
                  <p
                    className={`font-bold ${
                      selectedStudent.hasMealRegistration
                        ? 'text-green-700'
                        : 'text-gray-600'
                    }`}
                  >
                    {selectedStudent.hasMealRegistration ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-sm text-brand-text-muted">
                    {selectedStudent.mealPackage || 'No package'}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-brand-text-muted">Current Points</p>
                  <p className="text-2xl font-bold text-brand-text">
                    {selectedStudent.currentPoints ?? 0}
                  </p>
                  <p className="text-sm text-brand-text-muted">
                    Debt limit: {selectedStudent.debtLimit ?? 200}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="text-brand-primary" size={21} />
              <h2 className="font-semibold text-brand-text">
                Activate Meal Registration
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-2">
                  Meal Package
                </label>
                <input
                  value={mealPackage}
                  onChange={(event) => setMealPackage(event.target.value)}
                  placeholder="e.g. MID_TERM_PACKAGE"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-text mb-2">
                  Opening Points
                </label>
                <input
                  value={openingPoints}
                  onChange={(event) => setOpeningPoints(event.target.value)}
                  type="number"
                  min="0"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </div>
            </div>

            <div className="mt-5">
              <p className="block text-sm font-medium text-brand-text mb-3">
                Enabled Meals
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['lunch', 'fruit', 'tea', 'snacks'] as const).map((meal) => (
                  <button
                    key={meal}
                    onClick={() => toggleMeal(meal)}
                    className={`px-4 py-3 rounded-2xl border text-sm font-semibold capitalize transition ${
                      meals[meal]
                        ? 'bg-brand-primary text-brand-navy border-brand-primary'
                        : 'bg-white text-brand-text-muted border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {meal}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium text-brand-text mb-2">
                Reason / Note
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleActivateWithOpeningBalance}
                disabled={!selectedStudent || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-primary text-brand-navy font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                Activate & Set Opening Balance
              </button>

              <button
                onClick={handleUpdateMealRegistration}
                disabled={!selectedStudent || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-navy text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCcw size={18} />
                Update Meal Package Only
              </button>

              <button
                onClick={handleDeactivateMealRegistration}
                disabled={!selectedStudent || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gray-100 text-brand-text font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Deactivate
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="text-brand-primary" size={21} />
              <h2 className="font-semibold text-brand-text">
                Manual Points Adjustment
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-brand-text mb-2">
                  Adjustment Type
                </label>
                <select
                  value={adjustmentType}
                  onChange={(event) =>
                    setAdjustmentType(event.target.value as AdjustmentType)
                  }
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                >
                  <option value="TOP_UP">Add Points</option>
                  <option value="DEDUCTION">Deduct Points</option>
                  <option value="SET_BALANCE">Set Exact Balance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-text mb-2">
                  Amount
                </label>
                <input
                  value={adjustAmount}
                  onChange={(event) => setAdjustAmount(event.target.value)}
                  type="number"
                  min="0"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleManualAdjustment}
                  disabled={!selectedStudent || isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-primary text-brand-navy font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adjustmentType === 'DEDUCTION' ? <Minus size={18} /> : <Plus size={18} />}
                  Apply Adjustment
                </button>
              </div>
            </div>

            <p className="mt-4 text-sm text-brand-text-muted">
              Use this for opening balances, cash/bank payments, corrections, and admin-approved adjustments.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}