import React, { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { College, UserProfile, SupportRequest } from "../types";
import { 
  Plus, 
  Trash2, 
  Users, 
  School, 
  Sliders, 
  BookOpen, 
  Calendar, 
  UserCheck, 
  Mail, 
  Sparkles,
  LifeBuoy,
  MessageSquare,
  Check,
  X,
  Clock,
  Info
} from "lucide-react";
import { motion } from "motion/react";

interface AdminDashboardProps {
  user: UserProfile;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"colleges" | "structure" | "users" | "support">("colleges");
  
  // Colleges tab state
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegeName, setCollegeName] = useState("");
  const [collegeCode, setCollegeCode] = useState("");

  // Structure tab state
  const [selectedColCode, setSelectedColCode] = useState("");
  const [newYearName, setNewYearName] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [years, setYears] = useState<{ id: string; name: string; collegeCode: string }[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string; collegeCode: string }[]>([]);

  // Users tab state
  const [selectedFilterColCode, setSelectedFilterColCode] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);

  // Support tickets tab state
  const [tickets, setTickets] = useState<SupportRequest[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [ticketFilterCategory, setTicketFilterCategory] = useState<string>("All");
  const [ticketFilterStatus, setTicketFilterStatus] = useState<string>("All");

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load baseline colleges
  const fetchColleges = async () => {
    try {
      const qSnapshot = await getDocs(collection(db, "colleges"));
      const list: College[] = [];
      qSnapshot.forEach((doc) => {
        list.push({ ...doc.data() as College, id: doc.id });
      });
      setColleges(list);
      if (list.length > 0) {
        if (!selectedColCode) setSelectedColCode(list[0].code);
        if (!selectedFilterColCode) setSelectedFilterColCode(list[0].code);
      }
    } catch (err) {
      console.error("Colleges reload failed", err);
    }
  };

  useEffect(() => {
    fetchColleges();
  }, []);

  // Fetch years and depts for structure tab based on selection
  useEffect(() => {
    if (!selectedColCode) return;
    
    async function loadStructure() {
      try {
        // Years
        const yearQuery = query(collection(db, "years"), where("collegeCode", "==", selectedColCode));
        const yearSnap = await getDocs(yearQuery);
        const yearList: any[] = [];
        yearSnap.forEach((doc) => {
          yearList.push({ id: doc.id, ...doc.data() });
        });
        setYears(yearList);

        // Departments
        const deptQuery = query(collection(db, "departments"), where("collegeCode", "==", selectedColCode));
        const deptSnap = await getDocs(deptQuery);
        const deptList: any[] = [];
        deptSnap.forEach((doc) => {
          deptList.push({ id: doc.id, ...doc.data() });
        });
        setDepts(deptList);
      } catch (err) {
        console.error("Structure detail loading failed", err);
      }
    }
    loadStructure();
  }, [selectedColCode, successMsg]);

  // Handle users query of a college code
  useEffect(() => {
    if (!selectedFilterColCode) return;
    
    async function fetchFilteredUsers() {
      try {
        const uQuery = query(collection(db, "users"), where("collegeCode", "==", selectedFilterColCode));
        const uSnap = await getDocs(uQuery);
        const list: UserProfile[] = [];
        uSnap.forEach((doc) => {
          const data = doc.data();
          list.push({
            userId: doc.id,
            name: data.name || "",
            email: data.email || "",
            role: data.role || "student",
            collegeCode: data.collegeCode,
            year: data.year,
            department: data.department,
            division: data.division,
          });
        });
        setFilteredUsers(list);
      } catch (err) {
        console.error("Filtered users listing query crashed", err);
      }
    }
    fetchFilteredUsers();
  }, [selectedFilterColCode]);

  // Load Support Tickets
  const fetchTickets = async () => { 
    setSupportLoading(true);
    try {
      const qSnapshot = await getDocs(collection(db, "support_requests"));
      const list: SupportRequest[] = [];
      qSnapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          userId: data.userId || "",
          userName: data.userName || "Anonymous",
          userEmail: data.userEmail || "",
          role: data.role || "student",
          category: data.category || "General",
          message: data.message || "",
          createdAt: data.createdAt || new Date().toISOString(),
          status: data.status || "open"
        });
      });
      // Sort by newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTickets(list);
    } catch (err) {
      console.error("Support requests fetch failed", err);
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "support") {
      fetchTickets();
    }
  }, [activeTab]);

  const handleUpdateTicketStatus = async (ticketId: string, currentStatus: "open" | "closed") => {
    try {
      const nextStatus = currentStatus === "open" ? "closed" : "open";
      await updateDoc(doc(db, "support_requests", ticketId), {
        status: nextStatus
      });
      setSuccessMsg(`Ticket status updated to ${nextStatus === "closed" ? "Resolved" : "Open"}`);
      fetchTickets();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `support_requests/${ticketId}`);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      await deleteDoc(doc(db, "support_requests", ticketId));
      setSuccessMsg("Support ticket archived successfully.");
      fetchTickets();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `support_requests/${ticketId}`);
    }
  };

  const handleCreateCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeName || !collegeCode) return;
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    // Ensure code is unique in local colleges list
    if (colleges.some((col) => col.code === collegeCode.toUpperCase())) {
      setErrorMsg(`A college with code "${collegeCode}" already exists.`);
      setLoading(false);
      return;
    }

    try {
      const payload = {
        name: collegeName.trim(),
        code: collegeCode.trim().toUpperCase()
      };
      // Write college doc
      const docRef = await addDoc(collection(db, "colleges"), payload);
      // Wait to populate details
      setCollegeName("");
      setCollegeCode("");
      await fetchColleges();
      setSuccessMsg(`College "${payload.name}" successfully created with Code: ${payload.code}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "colleges");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearName || !selectedColCode) return;
    setLoading(true);
    setSuccessMsg(null);

    try {
      const payload = {
        name: newYearName.trim(),
        collegeCode: selectedColCode
      };
      await addDoc(collection(db, "years"), payload);
      setNewYearName("");
      setSuccessMsg(`Added Academic Year "${payload.name}" successfully.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "years");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName || !selectedColCode) return;
    setLoading(true);
    setSuccessMsg(null);

    try {
      const payload = {
        name: newDeptName.trim(),
        collegeCode: selectedColCode
      };
      await addDoc(collection(db, "departments"), payload);
      setNewDeptName("");
      setSuccessMsg(`Added Department "${payload.name}" successfully.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "departments");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoc = async (colName: string, id: string) => {
    setSuccessMsg(null);
    try {
      await deleteDoc(doc(db, colName, id));
      setSuccessMsg(`Archived record successfully.`);
      if (colName === "colleges") {
        await fetchColleges();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${colName}/${id}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-3 sm:p-4 md:p-8" id="admin-dashboard-view">
      {/* Welcome Hero header banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-xs font-mono text-slate-800">
            🛡️ Administrative Mode
          </div>
          <h1 className="font-display font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900">
            Welcome back, admin
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Registered Email: {user.email} &bull; Manage university, branches, files, and users.
          </p>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-xl flex items-center gap-2.5 w-full md:w-auto">
          <div className="bg-indigo-500 p-2 rounded-lg text-white">
            <School className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] sm:text-xs text-indigo-400 font-medium">Total Campuses</div>
            <div className="text-base sm:text-lg font-bold text-indigo-900">{colleges.length}</div>
          </div>
        </div>
      </div>

      {activeTab === "colleges" && successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center justify-between" id="admin-success">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs font-bold text-emerald-600 hover:underline">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center justify-between" id="admin-error">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            {errorMsg}
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2 md:gap-6 sm:overflow-visible no-scrollbar pb-1.5 md:pb-0" id="admin-tabs">
        <button
          onClick={() => { setActiveTab("colleges"); setSuccessMsg(null); }}
          className={`px-3.5 py-2 md:py-0 md:pb-4 text-xs md:text-sm font-semibold transition-all duration-200 rounded-xl md:rounded-none whitespace-nowrap flex items-center gap-1.5 cursor-pointer select-none ${
            activeTab === "colleges" 
              ? "bg-indigo-600 text-white md:bg-transparent md:text-indigo-600 dark:md:text-indigo-400 md:border-b-2 md:border-indigo-600 dark:md:border-indigo-400" 
              : "bg-slate-100 dark:bg-slate-900 md:bg-transparent dark:md:bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <School className="h-4 w-4 sm:h-4.5 sm:w-4.5" /> Create College
        </button>
        <button
          onClick={() => { setActiveTab("structure"); setSuccessMsg(null); }}
          className={`px-3.5 py-2 md:py-0 md:pb-4 text-xs md:text-sm font-semibold transition-all duration-200 rounded-xl md:rounded-none whitespace-nowrap flex items-center gap-1.5 cursor-pointer select-none ${
            activeTab === "structure" 
              ? "bg-indigo-600 text-white md:bg-transparent md:text-indigo-600 dark:md:text-indigo-400 md:border-b-2 md:border-indigo-600 dark:md:border-indigo-400" 
              : "bg-slate-100 dark:bg-slate-900 md:bg-transparent dark:md:bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Sliders className="h-4 w-4 sm:h-4.5 sm:w-4.5" /> College Structure
        </button>
        <button
          onClick={() => { setActiveTab("users"); setSuccessMsg(null); }}
          className={`px-3.5 py-2 md:py-0 md:pb-4 text-xs md:text-sm font-semibold transition-all duration-200 rounded-xl md:rounded-none whitespace-nowrap flex items-center gap-1.5 cursor-pointer select-none ${
            activeTab === "users" 
              ? "bg-indigo-600 text-white md:bg-transparent md:text-indigo-600 dark:md:text-indigo-400 md:border-b-2 md:border-indigo-600 dark:md:border-indigo-400" 
              : "bg-slate-100 dark:bg-slate-900 md:bg-transparent dark:md:bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Users className="h-4 w-4 sm:h-4.5 sm:w-4.5" /> View Users
        </button>
        <button
          onClick={() => { setActiveTab("support"); setSuccessMsg(null); }}
          className={`px-3.5 py-2 md:py-0 md:pb-4 text-xs md:text-sm font-semibold transition-all duration-200 rounded-xl md:rounded-none whitespace-nowrap flex items-center gap-1.5 cursor-pointer select-none ${
            activeTab === "support" 
              ? "bg-indigo-600 text-white md:bg-transparent md:text-indigo-600 dark:md:text-indigo-400 md:border-b-2 md:border-indigo-600 dark:md:border-indigo-400" 
              : "bg-slate-100 dark:bg-slate-900 md:bg-transparent dark:md:bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
          id="admin-support-tab-button"
        >
          <LifeBuoy className="h-4 w-4 sm:h-4.5 sm:w-4.5" /> Support Tickets
        </button>
      </div>

      {activeTab === "colleges" && (
        <div className="grid md:grid-cols-12 gap-6" id="tab-colleges-view">
          {/* Create College Form */}
          <div className="md:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-base text-slate-800">Add Campus Code</h3>
            <p className="text-slate-500 text-xs">Create unique codes so teachers and students can align with their respective branch rosters.</p>

            <form onSubmit={handleCreateCollege} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">College Name</label>
                <input
                  type="text"
                  required
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  placeholder="e.g. St. Francis Inst of Tech"
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Short Code Identifier</label>
                <input
                  type="text"
                  required
                  value={collegeCode}
                  onChange={(e) => setCollegeCode(e.target.value)}
                  placeholder="e.g. SFIT"
                  className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-500 uppercase font-mono font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm border border-indigo-500 cursor-pointer text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>{loading ? "Registering..." : "Create College"}</span>
              </button>
            </form>
          </div>

          {/* Registered colleges directory */}
          <div className="md:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-base text-slate-800">Colleges Directory</h3>
            {colleges.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No campus codes registered yet. Add one to get started.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-widest pl-2">Name</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-widest">Code Key</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-widest text-right pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colleges.map((col) => (
                      <tr key={col.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                        <td className="py-3.5 pl-2">
                          <div className="font-semibold text-slate-800 text-sm">{col.name}</div>
                          <div className="text-[10px] font-mono text-slate-400 leading-none">ID: {col.id}</div>
                        </td>
                        <td className="py-3.5">
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-indigo-50 text-xs font-mono font-bold text-indigo-600">
                            {col.code}
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-2">
                          <button
                            onClick={() => handleDeleteDoc("colleges", col.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "structure" && (
        <div className="space-y-6 animate-fade-in" id="tab-structure-view">
          {/* Select College */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display font-semibold text-sm text-slate-800">Manage College Structure</h3>
              <p className="text-slate-400 text-xs">Configure Years and Departments affiliated with a specific college code.</p>
            </div>
            <div>
              <select
                value={selectedColCode}
                onChange={(e) => setSelectedColCode(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold font-mono focus:outline-none text-sm cursor-pointer"
              >
                {colleges.map((col) => (
                  <option key={col.id} value={col.code}>{col.name} ({col.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Manage Years */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-display font-extrabold text-slate-800 text-sm">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  <span>Years</span>
                </div>
                <span className="text-slate-400 text-xs font-mono">{years.length} levels</span>
              </div>

              {/* Form to create Year */}
              <form onSubmit={handleCreateYear} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  placeholder="e.g., 1st Year, FE, BE"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl border border-indigo-500 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>

              {/* Years directory list */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {years.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">No academic years set.</div>
                ) : (
                  years.map((y) => (
                    <div key={y.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center hover:border-slate-200 transition">
                      <span className="text-xs font-bold text-slate-700">{y.name}</span>
                      <button
                        onClick={() => handleDeleteDoc("years", y.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Manage Departments */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-display font-extrabold text-slate-800 text-sm">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  <span>Departments</span>
                </div>
                <span className="text-slate-400 text-xs font-mono">{depts.length} branches</span>
              </div>

              {/* Form to create Dept */}
              <form onSubmit={handleCreateDept} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g., Information Technology"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl border border-indigo-500 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>

              {/* Depts directory list */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {depts.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">No departments set.</div>
                ) : (
                  depts.map((d) => (
                    <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center hover:border-slate-200 transition">
                      <span className="text-xs font-bold text-slate-700">{d.name}</span>
                      <button
                        onClick={() => handleDeleteDoc("departments", d.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6" id="tab-users-view">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <h3 className="font-display font-bold text-base text-slate-800">Rosters & Registered Users</h3>
              <p className="text-slate-400 text-xs">Verify students, divisional groupings, and teaching profiles registered under any campus.</p>
            </div>
            <div>
              <select
                value={selectedFilterColCode}
                onChange={(e) => setSelectedFilterColCode(e.target.value)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold font-mono focus:outline-none text-sm cursor-pointer"
              >
                <option value="">Choose College Code...</option>
                {colleges.map((col) => (
                  <option key={col.id} value={col.code}>{col.name} ({col.code})</option>
                ))}
              </select>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No registered user accounts found for the college: <strong className="font-mono text-indigo-600">{selectedFilterColCode || "None Chosen"}</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-mono text-xs uppercase tracking-widest">
                    <th className="pb-3 text-xs font-semibold pl-2">User details</th>
                    <th className="pb-3 text-xs font-semibold">Role</th>
                    <th className="pb-3 text-xs font-semibold">College Code</th>
                    <th className="pb-3 text-xs font-semibold">Roster Affiliation</th>
                    <th className="pb-3 text-xs font-semibold text-right pr-2">Account ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.userId} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                      <td className="py-3.5 pl-2 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 font-bold text-xs uppercase">
                          {u.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{u.name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {u.email}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          u.role === "teacher" 
                            ? "bg-amber-50 text-amber-600 border border-amber-200/50" 
                            : u.role === "admin"
                              ? "bg-teal-50 text-teal-600 border border-teal-200/50"
                              : "bg-emerald-50 text-emerald-600 border border-emerald-200/50"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 font-mono text-xs font-extrabold text-slate-600">{u.collegeCode || "-"}</td>
                      <td className="py-3.5 text-xs text-slate-500">
                        {u.role === "student" ? (
                          <div className="space-y-0.5">
                            <div>Department: <strong className="text-slate-700">{u.department}</strong></div>
                            <div>Year: <strong className="text-slate-700">{u.year}</strong> &bull; Class div: <strong className="text-slate-700">{u.division}</strong></div>
                          </div>
                        ) : u.role === "teacher" ? (
                          <div>Faculty: <strong className="text-slate-700">{u.department}</strong></div>
                        ) : (
                          <span className="text-slate-300 font-light font-mono">system-admin</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right font-mono text-[10px] text-slate-400 pr-2">{u.userId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "support" && (
        <div className="space-y-6" id="tab-support-view">
          {/* Support Ticket Header with quick stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="support-stats-widgets">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">Total Tickets</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{tickets.length}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-955/35 rounded-xl text-amber-600 dark:text-amber-400 animate-pulse">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">Pending Assistance</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100 animate-pulse">
                  {tickets.filter(t => t.status === "open").length}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">Resolved Tickets</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  {tickets.filter(t => t.status === "closed").length}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <h3 className="font-display font-bold text-base text-slate-800 dark:text-slate-100">User Inquiries & Help Requests</h3>
                <p className="text-slate-400 dark:text-slate-500 text-xs">Review, resolve, or archive support queries submitted via student or faculty help modals.</p>
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-wrap gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Status</span>
                  <select
                    value={ticketFilterStatus}
                    onChange={(e) => setTicketFilterStatus(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Statuses</option>
                    <option value="open">Pending / Open</option>
                    <option value="closed">Resolved / Closed</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase block">Category</span>
                  <select
                    value={ticketFilterCategory}
                    onChange={(e) => setTicketFilterCategory(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    <option value="Camera & QR Help">Camera & QR Recognition</option>
                    <option value="GPS Coordinates Fail">GPS Coordinates</option>
                    <option value="Timetable & Classes">Timetable & Classes</option>
                    <option value="General Support Request">General System Inquiry</option>
                  </select>
                </div>
              </div>
            </div>

            {supportLoading ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                <span className="w-5 h-5 bg-indigo-600 rounded-full animate-bounce" />
                <span>Loading latest help queries...</span>
              </div>
            ) : (
              (() => {
                const filteredTickets = tickets.filter(t => {
                  const matchStatus = ticketFilterStatus === "All" || t.status === ticketFilterStatus;
                  const matchCat = ticketFilterCategory === "All" || t.category === ticketFilterCategory;
                  return matchStatus && matchCat;
                });

                if (filteredTickets.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                      No support tickets found matching the filters.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-mono text-xs uppercase tracking-widest">
                          <th className="pb-3 text-xs font-semibold pl-2">Submitter Details</th>
                          <th className="pb-3 text-xs font-semibold">Category & Message</th>
                          <th className="pb-3 text-xs font-semibold">Submitted On</th>
                          <th className="pb-3 text-xs font-semibold">Status</th>
                          <th className="pb-3 text-xs font-semibold text-right pr-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTickets.map((t) => (
                          <tr key={t.id} className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition">
                            <td className="py-4 pl-2 break-all max-w-[200px]">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-xs uppercase flex-shrink-0">
                                  {t.userName.substring(0, 2)}
                                </div>
                                <div className="leading-tight">
                                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{t.userName}</div>
                                  <div className="text-xs text-slate-400 dark:text-slate-500">{t.userEmail}</div>
                                  <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-mono opacity-85 uppercase">
                                    {t.role}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 text-xs pr-4 max-w-[350px]">
                              <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1 col-span-3">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                                  {t.category}
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-sans whitespace-pre-wrap">{t.message}</p>
                            </td>
                            <td className="py-4 text-xs text-slate-500 dark:text-slate-400">
                              <div className="font-medium">{new Date(t.createdAt).toLocaleDateString()}</div>
                              <div className="text-[10px] font-mono text-slate-400">{new Date(t.createdAt).toLocaleTimeString()}</div>
                            </td>
                            <td className="py-4">
                              <button
                                onClick={() => handleUpdateTicketStatus(t.id, t.status)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                                  t.status === "open"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-200"
                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-200"
                                }`}
                                title={t.status === "open" ? "Click to Mark as Resolved" : "Click to Reopen Ticket"}
                              >
                                {t.status === "open" ? (
                                  <>
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Open</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Resolved</span>
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="py-4 text-right pr-2">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleUpdateTicketStatus(t.id, t.status)}
                                  className="p-1 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-mono"
                                >
                                  {t.status === "open" ? "Resolve" : "Reopen"}
                                </button>
                                <button
                                  onClick={() => handleDeleteTicket(t.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title="Archive Ticket"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}
