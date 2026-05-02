import React, { useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Mail,
  CreditCard,
  X,
  Phone,
  MessageSquare,
  User,
  Send,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface StudentsProps {
  onViewCard?: (cardId: string) => void;
  onViewStudent?: (studentId: string) => void;
}

interface StudentRow {
  id: string;
  cardId: string;
  name: string;
  grade: string;
  balance: number;
  status: string;
  mealStatus: 'Pending' | 'Served';
  dietary: string[];
  email: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  school: 'MAIN_SCHOOL' | 'DIGITAL_SCHOOL';
  hasMealRegistration: boolean;
  mealPackage: string | null;
}

export function Students({ onViewCard, onViewStudent }: StudentsProps) {
  const { user } = useAuth();

  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [messageModal, setMessageModal] = useState<'sms' | 'whatsapp' | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('All');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({
    admNo: '',
    name: '',
    grade: '',
    school: 'MAIN_SCHOOL' as 'MAIN_SCHOOL' | 'DIGITAL_SCHOOL',
    parentName: '',
    parentPhone: '',
    dietary: [] as string[],
  });

  const createStudent = useMutation(api.students.createStudent);

  const studentsQuery = useQuery(api.students.list, {
    search: searchTerm.trim() || undefined,
    className: gradeFilter !== 'All' ? gradeFilter : undefined,
  });

  const loading = studentsQuery === undefined;

  const studentsData: StudentRow[] = useMemo(() => {
    const raw = studentsQuery ?? [];

    return raw.map((s: any) => ({
      id: s.admNo,
      cardId: '',
      name: s.studentName,
      grade: s.class,
      balance: 0,
      status: s.hasMealRegistration ? 'Active' : 'No Meal Plan',
      mealStatus: 'Pending',
      dietary: [],
      email: '',
      parentName: s.parentName,
      parentPhone: s.contact,
      parentEmail: '',
      school: s.school,
      hasMealRegistration: s.hasMealRegistration,
      mealPackage: s.mealPackage,
    }));
  }, [studentsQuery]);

  const grades = ['All', ...Array.from(new Set(studentsData.map((s) => s.grade)))].sort();

  const filteredStudents = useMemo(() => {
    return studentsData.filter((student) => {
      if (user?.role === 'teacher') {
        if (!user.class_assigned || student.grade !== user.class_assigned) {
          return false;
        }
      }

      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.parentPhone.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGrade = gradeFilter === 'All' || student.grade === gradeFilter;

      return matchesSearch && matchesGrade;
    });
  }, [studentsData, searchTerm, gradeFilter, user]);

  const stats = useMemo(() => {
    return {
      total: studentsData.length,
      lowBalance: studentsData.filter((s) => s.balance > 0 && s.balance < 1500).length,
      outstanding: studentsData
        .filter((s) => s.balance < 0)
        .reduce((sum, s) => sum + Math.abs(s.balance), 0),
    };
  }, [studentsData]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createStudent({
        admNo: newStudent.admNo.trim(),
        studentName: newStudent.name.trim(),
        className:
          user?.role === 'teacher' && user.class_assigned
            ? user.class_assigned
            : newStudent.grade.trim(),
        school: newStudent.school,
        parentName: newStudent.parentName.trim(),
        contact: newStudent.parentPhone.trim(),
      });

      setIsAddModalOpen(false);
      setNewStudent({
        admNo: '',
        name: '',
        grade: '',
        school: 'MAIN_SCHOOL',
        parentName: '',
        parentPhone: '',
        dietary: [],
      });
    } catch (error) {
      console.error('Error adding student:', error);
      alert('Failed to add student');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedStudent || !messageModal || !messageText.trim()) return;

    setIsSending(true);
    setSendError('');
    setSendSuccess(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      setSendSuccess(true);
      setTimeout(() => {
        setMessageModal(null);
        setMessageText('');
        setSendSuccess(false);
      }, 1200);
    } catch (err: any) {
      setSendError(err.message || 'An error occurred while sending the message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkServed = (_studentId: string) => {
    // Hook meal service mutation here later
  };

  const handleExportList = () => {
    const csvContent = [
      ['ID', 'Name', 'Class', 'School', 'Parent Name', 'Parent Phone', 'Status', 'Meal Package'],
      ...filteredStudents.map((s) => [
        s.id,
        s.name,
        s.grade,
        s.school,
        s.parentName,
        s.parentPhone,
        s.status,
        s.mealPackage || 'None',
      ]),
    ]
      .map((e) => e.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'students_list.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">Student Directory</h1>
          <p className="text-brand-text-muted mt-1">Manage student accounts, balances, and dietary restrictions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportList}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Export List
          </button>
          {['super_admin', 'admin', 'manager'].includes(user?.role || '') && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Add Student
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-brand-text-muted text-sm font-medium">Total Students</h3>
          <p className="text-3xl font-bold text-brand-text mt-2">{stats.total.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-brand-text-muted text-sm font-medium">Low Balance Accounts</h3>
          <p className="text-3xl font-bold text-amber-600 mt-2">{stats.lowBalance.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-brand-text-muted text-sm font-medium">Total Outstanding</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">Ksh {stats.outstanding.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/30">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, ID, or parent phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm shadow-sm"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {user?.role !== 'teacher' && (
              <div className="relative">
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="appearance-none flex items-center gap-2 pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-brand-text hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {grades.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            )}
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-brand-text hover:bg-gray-50 transition-colors shadow-sm">
              <Filter size={16} />
              Status
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-brand-primary" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Student</th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Dietary Info</th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Meal Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/50 transition-colors group bg-white">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-navy font-medium">
                          {student.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <p
                            className="text-sm font-medium text-brand-text hover:text-brand-primary cursor-pointer transition-colors"
                            onClick={() => onViewStudent?.(student.id)}
                            title="View student profile"
                          >
                            {student.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-brand-text-muted">{student.id}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span className="text-xs text-brand-text-muted">{student.grade}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span className="text-xs text-brand-text-muted">{student.school}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-brand-text-muted">
                          <Phone size={14} />
                          {student.parentPhone || '—'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-brand-text-muted">
                          <Mail size={14} />
                          {student.parentEmail || '—'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {student.dietary.length > 0 ? (
                          student.dietary.map((diet, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-100"
                            >
                              {diet}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[11px] font-medium px-2 py-1 rounded-full ${
                          student.mealStatus === 'Served'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                      >
                        {student.mealStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`text-sm font-semibold ${
                            student.balance < 0
                              ? 'text-red-600'
                              : student.balance < 1500
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          Ksh {student.balance.toLocaleString()}
                        </span>
                        <span
                          className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                            student.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : student.status === 'Low Balance'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {student.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {['super_admin', 'admin', 'manager', 'staff'].includes(user?.role || '') &&
                          student.mealStatus === 'Pending' && (
                            <button
                              onClick={() => handleMarkServed(student.id)}
                              className="px-2 py-1 bg-brand-primary/10 text-brand-navy hover:bg-brand-primary hover:text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              Mark Served
                            </button>
                          )}
                        {['super_admin', 'admin', 'manager'].includes(user?.role || '') && (
                          <button
                            onClick={() => onViewCard?.(student.cardId)}
                            className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                            title="View Card Details"
                          >
                            <CreditCard size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="p-1.5 text-gray-400 hover:text-brand-navy hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-brand-text-muted">
                      No students found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-navy font-bold text-xl">
                  {selectedStudent.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-brand-text">{selectedStudent.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-brand-text-muted">{selectedStudent.id}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span className="text-sm text-brand-text-muted">{selectedStudent.grade}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h4 className="text-sm font-semibold text-brand-text mb-3 flex items-center gap-2">
                  <User size={16} className="text-brand-primary" />
                  Student Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">School</p>
                    <p className="text-sm font-medium text-brand-text">{selectedStudent.school}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Card ID</p>
                    <p className="text-sm font-medium text-brand-text">{selectedStudent.cardId || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Balance</p>
                    <p
                      className={`text-sm font-semibold ${
                        selectedStudent.balance < 0
                          ? 'text-red-600'
                          : selectedStudent.balance < 1500
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      Ksh {selectedStudent.balance.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Meal Package</p>
                    <p className="text-sm font-medium text-brand-text">{selectedStudent.mealPackage || 'None'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <h4 className="text-sm font-semibold text-brand-text mb-3 flex items-center gap-2">
                  <User size={16} className="text-brand-navy" />
                  Parent/Guardian Information
                </h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Name</p>
                    <p className="text-sm font-medium text-brand-text">{selectedStudent.parentName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                      <p className="text-sm font-medium text-brand-text">{selectedStudent.parentPhone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Email</p>
                      <p className="text-sm font-medium text-brand-text">{selectedStudent.parentEmail || '—'}</p>
                    </div>
                  </div>
                </div>

                {user?.role !== 'staff' && (
                  <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3">
                    <button
                      onClick={() => setMessageModal('sms')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      <MessageSquare size={16} className="text-blue-500" />
                      Send SMS
                    </button>
                    <button
                      onClick={() => setMessageModal('whatsapp')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366]/10 text-[#128C7E] border border-[#25D366]/20 rounded-xl text-sm font-medium hover:bg-[#25D366]/20 transition-colors"
                    >
                      <Phone size={16} />
                      WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {messageModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">
                {messageModal === 'whatsapp' ? (
                  <>
                    <Phone size={20} className="text-[#25D366]" /> Send WhatsApp
                  </>
                ) : (
                  <>
                    <MessageSquare size={20} className="text-blue-500" /> Send SMS
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  setMessageModal(null);
                  setMessageText('');
                  setSendError('');
                  setSendSuccess(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">
                To: <span className="font-medium text-brand-text">{selectedStudent.parentName}</span>
              </p>
              <p className="text-xs text-gray-400">{selectedStudent.parentPhone}</p>
            </div>

            <div className="space-y-4">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message here..."
                className="w-full h-32 px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none text-sm"
              />

              {sendError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                  {sendError}
                </div>
              )}

              {sendSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-xl border border-emerald-100">
                  Message prepared. Wire your messaging backend next.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setMessageModal(null);
                    setMessageText('');
                    setSendError('');
                  }}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                  disabled={isSending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || isSending || sendSuccess}
                  className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-brand-text">Add New Student</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-brand-text mb-4 pb-2 border-b border-gray-100">Student Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admission Number</label>
                    <input
                      type="text"
                      required
                      value={newStudent.admNo}
                      onChange={(e) => setNewStudent({ ...newStudent, admNo: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                      placeholder="e.g. 3206"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <input
                      type="text"
                      required
                      value={user?.role === 'teacher' && user.class_assigned ? user.class_assigned : newStudent.grade}
                      onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                      disabled={user?.role === 'teacher'}
                      className={`w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm ${
                        user?.role === 'teacher' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
                      }`}
                      placeholder="e.g. 1 BLUE"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                    <select
                      value={newStudent.school}
                      onChange={(e) =>
                        setNewStudent({
                          ...newStudent,
                          school: e.target.value as 'MAIN_SCHOOL' | 'DIGITAL_SCHOOL',
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                    >
                      <option value="MAIN_SCHOOL">MAIN_SCHOOL</option>
                      <option value="DIGITAL_SCHOOL">DIGITAL_SCHOOL</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-brand-text mb-4 pb-2 border-b border-gray-100">Parent/Guardian Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent Name</label>
                    <input
                      type="text"
                      required
                      value={newStudent.parentName}
                      onChange={(e) => setNewStudent({ ...newStudent, parentName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent Phone</label>
                    <input
                      type="tel"
                      required
                      value={newStudent.parentPhone}
                      onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                      placeholder="e.g. +254712345678"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-primary text-brand-navy rounded-xl text-sm font-medium hover:bg-brand-primary-hover transition-colors"
                >
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}