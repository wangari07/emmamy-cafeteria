import React, { useState, useEffect } from "react";
import { ConvexHttpClient } from "convex/browser";
import { Utensils, Coffee, Cookie } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";

// Safe Convex init
if (!import.meta.env.VITE_CONVEX_URL) {
  throw new Error("VITE_CONVEX_URL is missing. Check your environment variables.");
}
const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

export default function ServeMeal() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [groupedClasses, setGroupedClasses] = useState<Record<string, string[]>>({});
  const [campuses, setCampuses] = useState<string[]>([]);
  const [selectedCampus, setSelectedCampus] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const meals = [
    { name: "Lunch", id: "kd77641c1y3xxashknesq7d49h85vdsv", points: 100, icon: <Utensils /> },
    { name: "Tea", id: "kd70n8tefvg7r81xkxkme7h9jh85vw4a", points: 20, icon: <Coffee /> },
    { name: "Mandazi", id: "kd7fj69vwrst8nsq2qc8pbsgzn85t0hs", points: 10, icon: <Cookie /> },
  ];

  const groupClasses = (classes: string[]) => {
    const grouped: Record<string, string[]> = {};
    classes.forEach((cls) => {
      const grade = cls.split(" ")[0];
      if (!grouped[grade]) grouped[grade] = [];
      grouped[grade].push(cls);
    });
    return grouped;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const result = await convex.query(api.students.getCampuses);
        setCampuses(result);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await convex.query(api.students.getClasses, {
          campus: selectedCampus || undefined,
        });
        setGroupedClasses(groupClasses(result));
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [selectedCampus]);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await convex.query(api.students.list, {
          className: selectedClass || undefined,
          school: selectedCampus || undefined,
        });
        setStudents(result);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [selectedClass, selectedCampus]);

  const handleSelectStudent = (s: any) => {
    setSelectedStudent(s);
    setBalance(s.currentPoints || 0);
    setReceipt(null);
  };

  const handleServeMeal = async (meal: (typeof meals)[0]) => {
    if (!selectedStudent || loading || balance < meal.points) return;

    setLoading(true);
    try {
      const res: any = await convex.mutation(
        api.mealService.printMealPass,
        {
          studentId: selectedStudent._id,
          menuItemId: meal.id,
          printedBy: user?.email || "staff_member",
        }
      );

      setReceipt(res.receipt);
      setBalance(res.receipt.balanceAfter);
    } catch (err) {
      console.error(err);
      alert("Transaction failed. Check balance or connection.");
    }
    setLoading(false);
  };

  const filteredStudents = students.filter((s) =>
    s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admNo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-brand-bg">
      <div className="w-96 bg-white border-r flex flex-col">
        <div className="p-4">
          <input
            placeholder="Search student or adm no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border p-3 rounded-xl"
          />
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs font-semibold text-gray-500 mb-1">Campus</p>
          <select
            value={selectedCampus}
            onChange={(e) => {
              setSelectedCampus(e.target.value);
              setSelectedClass("");
              setSelectedStudent(null);
              setReceipt(null);
            }}
            className="w-full border p-2 rounded"
          >
            <option value="">All Campuses</option>
            {campuses.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="px-4 max-h-48 overflow-y-auto">
          {Object.entries(groupedClasses).map(([grade, cls]) => (
            <div key={grade}>
              <p className="text-xs font-bold text-gray-400">Grade {grade}</p>
              {cls.map((c) => (
                <div
                  key={c}
                  onClick={() => {
                    setSelectedClass(c);
                    setSelectedStudent(null);
                    setReceipt(null);
                  }}
                  className={`p-2 cursor-pointer rounded ${selectedClass === c ? "bg-brand-primary" : "hover:bg-gray-100"}`}
                >
                  {c}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredStudents.map((s) => (
            <div
              key={s._id}
              onClick={() => handleSelectStudent(s)}
              className={`p-3 rounded cursor-pointer ${selectedStudent?._id === s._id ? "bg-brand-primary" : "bg-white hover:bg-gray-100"}`}
            >
              {s.studentName}
              <div className="text-xs text-gray-500">{s.admNo}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-8 space-y-6">
        {!selectedStudent ? (
          <p className="text-gray-500">Select a student</p>
        ) : (
          <>
            <div className="bg-brand-navy text-white p-6 rounded-xl">
              <h2>{selectedStudent.studentName}</h2>
              <p>{selectedStudent.class}</p>
              <h1 className="text-3xl font-bold mt-2">{balance} pts</h1>
              {balance < 100 && <p className="text-red-400 text-sm mt-2">Low balance</p>}
            </div>
            <div className="grid grid-cols-3 gap-6">
              {meals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => handleServeMeal(meal)}
                  disabled={loading || balance < meal.points}
                  className="p-6 bg-white border rounded-xl disabled:opacity-50"
                >
                  <div className="mb-2">{meal.icon}</div>
                  {meal.name}
                  <div className="text-sm text-gray-500">{meal.points} pts</div>
                </button>
              ))}
            </div>
          </>
        )}

        <AnimatePresence>
          {receipt && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-4 w-[57mm] text-xs shadow-lg border border-dashed border-gray-300"
              id="receipt-print"
            >
              <p className="font-bold text-center mb-2">MEAL PASS</p>
              <p>{receipt.studentName}</p>
              <p>{receipt.className}</p>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span>{receipt.menuItem}</span>
                <span>{receipt.pointsCost} pts</span>
              </div>
              <hr className="my-2" />
              <p className="text-right">Balance: {receipt.balanceAfter}</p>
              <button
                onClick={() => window.print()}
                className="mt-4 w-full bg-black text-white py-2 rounded no-print"
              >
                Print Receipt
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}