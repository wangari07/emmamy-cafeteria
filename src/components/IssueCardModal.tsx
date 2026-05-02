import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  X, 
  PlusCircle, 
  RotateCcw, 
  Recycle, 
  Wifi, 
  ChevronDown, 
  User, 
  GraduationCap, 
  ArrowRightLeft, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

interface IssueCardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IssueCardModal({ isOpen, onClose }: IssueCardModalProps) {
  const [activeTab, setActiveTab] = useState<'issue' | 'format' | 'repurpose'>('issue');
  const [isCardDetected, setIsCardDetected] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [balanceKes, setBalanceKes] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(true);
  const [manualName, setManualName] = useState('');
  const [manualGrade, setManualGrade] = useState('');
  const [manualAdmNo, setManualAdmNo] = useState('');

  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Simulate NFC detection when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset state
      setIsCardDetected(false);
      setCardId(null);
      setSelectedStudentId('');
      setBalanceKes('');
      setIsSuccess(false);
      setActiveTab('issue');
      setIsManualEntry(true);
      setManualName('');
      setManualGrade('');
      setManualAdmNo('');

      // Fetch students
      const fetchStudents = async () => {
        try {
          setLoadingStudents(true);
          const response = await fetch('/api/students');
          if (!response.ok) throw new Error('Failed to fetch students');
          const data = await response.json();
          setStudents(data);
        } catch (error) {
          console.error('Error fetching students:', error);
        } finally {
          setLoadingStudents(false);
        }
      };
      fetchStudents();

      // Simulate detection after 2.5 seconds
      const timer = setTimeout(() => {
        setIsCardDetected(true);
        setCardId(Math.random().toString(36).substring(2, 10).toUpperCase());
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const points = balanceKes ? Math.floor(parseFloat(balanceKes) / 10) : 0;

  const handleIssueCard = async () => {
    if (!isCardDetected) return;
    if (!isManualEntry && !selectedStudentId) return;
    if (isManualEntry && (!manualName || !manualGrade || !manualAdmNo)) return;
    
    setIsIssuing(true);
    try {
      let payload: any = {
        card_id: cardId,
      };

      let endpoint = '/api/cards/issue';
      if (activeTab === 'format') endpoint = '/api/cards/format';
      if (activeTab === 'repurpose') {
        endpoint = '/api/cards/repurpose';
        payload.new_student_id = isManualEntry ? manualAdmNo : selectedStudentId;
      } else {
        payload.student_id = isManualEntry ? manualAdmNo : selectedStudentId;
        payload.initial_balance = points;
      }

      // If manual entry and student doesn't exist, we might need to create them first
      // But for now, let's assume they exist or we just use the ID
      if (isManualEntry && activeTab === 'issue') {
        await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: manualAdmNo,
            name: manualName,
            class: manualGrade,
            parent_name: '',
            parent_phone: ''
          }),
        });
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Operation failed');
      }
      
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error processing card:', error);
      alert(error.message);
    } finally {
      setIsIssuing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay Background */}
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose}></div>
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[640px] bg-white rounded-2xl shadow-2xl z-10 flex flex-col max-h-[90vh] overflow-hidden border border-slate-100">
        
        {/* Header / Tabs */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <CreditCard className="text-brand-primary" size={24} />
              Card Management
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={24} />
            </button>
          </div>
          
          {/* Tab Pills */}
          <div className="flex p-1 gap-1 bg-slate-100 rounded-xl">
            <button 
              onClick={() => setActiveTab('issue')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'issue' ? 'bg-brand-primary text-brand-navy shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <PlusCircle size={18} />
              Issue New
            </button>
            <button 
              onClick={() => setActiveTab('format')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'format' ? 'bg-brand-primary text-brand-navy shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <RotateCcw size={18} />
              Format Old
            </button>
            <button 
              onClick={() => setActiveTab('repurpose')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'repurpose' ? 'bg-brand-primary text-brand-navy shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <Recycle size={18} />
              Repurpose
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 bg-white">
          {isSuccess ? (
            <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                {activeTab === 'issue' ? 'Card Issued Successfully!' : activeTab === 'format' ? 'Card Formatted Successfully!' : 'Card Repurposed Successfully!'}
              </h3>
              <p className="text-slate-500">
                {activeTab === 'issue' 
                  ? `The card has been assigned to ${isManualEntry ? manualName : selectedStudent?.name}.`
                  : activeTab === 'format'
                  ? 'All previous data has been securely erased.'
                  : `The card has been reassigned to ${isManualEntry ? manualName : selectedStudent?.name}.`
                }
              </p>
            </div>
          ) : (
            <>
              {/* NFC Zone */}
              <div className="px-6 py-8 flex flex-col items-center justify-center bg-slate-50 border-b border-dashed border-slate-200 transition-all duration-500">
                <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                  {/* Static representation of pulsing rings */}
                  <div className={`absolute inset-0 rounded-full scale-150 border transition-all duration-1000 ${isCardDetected ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-brand-primary/10 border-brand-primary/20 animate-pulse'}`}></div>
                  <div className={`absolute inset-0 rounded-full scale-125 border transition-all duration-1000 ${isCardDetected ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-brand-primary/20 border-brand-primary/30 animate-pulse'}`}></div>
                  <div className={`absolute inset-0 bg-white rounded-full shadow-lg flex items-center justify-center border-4 z-10 transition-colors duration-500 ${isCardDetected ? 'border-emerald-500 text-emerald-500' : 'border-brand-primary text-brand-primary'}`}>
                    <Wifi size={40} className={isCardDetected ? '' : 'animate-pulse'} />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {isCardDetected ? 'Card Detected!' : 'Place Card on Reader'}
                </h3>
                <p className={`text-sm text-center max-w-xs ${isCardDetected ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
                  {isCardDetected ? `NFC Tag ID: ${cardId}` : 'Waiting for NFC tag detection to proceed...'}
                </p>
              </div>

              {/* Form Section */}
              <div className={`p-6 space-y-6 transition-opacity duration-500 ${isCardDetected ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                
                {activeTab === 'format' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h4 className="text-amber-800 font-semibold mb-1">Warning: Data Erasure</h4>
                    <p className="text-amber-700 text-sm">Formatting this card will permanently erase all associated student data and clear any remaining balance. This action cannot be undone.</p>
                  </div>
                )}

                {(activeTab === 'issue' || activeTab === 'repurpose') && (
                  <>
                    {/* Student Selection / Manual Entry Toggle */}
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-700">
                        {activeTab === 'repurpose' ? 'New Student Details' : 'Student Details'}
                      </label>
                      <button 
                        onClick={() => setIsManualEntry(!isManualEntry)}
                        className="text-xs font-medium text-brand-primary hover:text-brand-primary-hover transition-colors"
                      >
                        {isManualEntry ? 'Select from list' : 'Enter manually'}
                      </button>
                    </div>

                    {!isManualEntry ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <select 
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className="w-full h-12 pl-4 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all appearance-none cursor-pointer"
                          >
                            <option disabled value="">Search for a student...</option>
                            {students.map(student => (
                              <option key={student.id} value={student.id}>{student.name} ({student.class})</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                            <ChevronDown size={20} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-400 font-medium text-sm">ADM</span>
                          </div>
                          <input 
                            className="w-full h-12 pl-14 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all" 
                            type="text" 
                            value={manualAdmNo}
                            onChange={(e) => setManualAdmNo(e.target.value)}
                            placeholder="e.g. ADM-2024"
                          />
                        </div>
                      </div>
                    )}

                    {/* Auto-fill / Manual Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700">
                          Full Name
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="text-slate-400" size={20} />
                          </div>
                          <input 
                            className={`w-full h-12 pl-12 pr-4 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all ${isManualEntry ? 'bg-white border border-slate-200 text-slate-900' : 'bg-slate-100 border-none text-slate-500 cursor-not-allowed'}`} 
                            readOnly={!isManualEntry}
                            type="text" 
                            value={isManualEntry ? manualName : (selectedStudent?.name || '')}
                            onChange={(e) => isManualEntry && setManualName(e.target.value)}
                            placeholder={isManualEntry ? "Enter full name" : "Auto-filled"}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700">
                          Class / Grade
                        </label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <GraduationCap className="text-slate-400" size={20} />
                          </div>
                          <input 
                            className={`w-full h-12 pl-12 pr-4 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all ${isManualEntry ? 'bg-white border border-slate-200 text-slate-900' : 'bg-slate-100 border-none text-slate-500 cursor-not-allowed'}`} 
                            readOnly={!isManualEntry}
                            type="text" 
                            value={isManualEntry ? manualGrade : (selectedStudent?.grade || '')}
                            onChange={(e) => isManualEntry && setManualGrade(e.target.value)}
                            placeholder={isManualEntry ? "e.g. Form 1A" : "Auto-filled"}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Balance Converter */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <ArrowRightLeft className="text-brand-primary" size={20} />
                        Initial Balance Conversion
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">KES</span>
                          <input 
                            className="w-full h-12 pl-14 pr-4 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all" 
                            placeholder="0.00" 
                            type="number"
                            value={balanceKes}
                            onChange={(e) => setBalanceKes(e.target.value)}
                          />
                        </div>
                        <div className="text-slate-400">
                          <ArrowRight size={20} />
                        </div>
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">PTS</span>
                          <input 
                            className="w-full h-12 pl-14 pr-4 bg-slate-100 border border-transparent rounded-lg text-slate-500" 
                            placeholder="0" 
                            readOnly 
                            type="number"
                            value={points || ''}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 pl-1">Exchange rate: 100 KES = 10 Points</p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer / Actions */}
        {!isSuccess && (
          <div className="p-6 border-t border-slate-100 bg-white shrink-0 space-y-4">
            <button 
              onClick={handleIssueCard}
              disabled={!isCardDetected || (activeTab !== 'format' && ((!isManualEntry && !selectedStudentId) || (isManualEntry && (!manualName || !manualGrade || !manualAdmNo)))) || isIssuing}
              className={`w-full h-14 font-bold text-lg rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group ${
                activeTab === 'format' 
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none' 
                  : 'bg-brand-primary hover:bg-brand-primary-hover text-brand-navy shadow-brand-primary/20 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none'
              }`}
            >
              <span>
                {isIssuing 
                  ? 'Processing...' 
                  : activeTab === 'issue' 
                    ? 'Format & Issue Card' 
                    : activeTab === 'format'
                      ? 'Format Card'
                      : 'Repurpose Card'
                }
              </span>
              {!isIssuing && <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />}
            </button>
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                Reader: Connected
              </div>
              <div className="flex items-center gap-4">
                <span>Admin: Sarah Jenkins</span>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline">Session ID: #8821X</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
