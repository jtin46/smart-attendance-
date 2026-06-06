import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { UserProfile } from "./types";
import LoginScreen from "./components/LoginScreen";
import AdminDashboard from "./components/AdminDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import StudentDashboard from "./components/StudentDashboard";
import { 
  GraduationCap, 
  LogOut, 
  User, 
  Sparkles, 
  ShieldCheck, 
  School,
  HelpCircle,
  X,
  Mail,
  Send,
  BookOpen,
  Info,
  CheckCircle,
  Copy,
  Sun,
  Moon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [initAuthLoading, setInitAuthLoading] = useState(true);

  // Dark/Light Theme Switching States
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("app-theme") === "dark";
  });

  useEffect(() => {
    const rootEl = document.documentElement;
    const bodyEl = document.body;
    if (darkMode) {
      rootEl.classList.add("dark");
      bodyEl.classList.add("dark", "bg-slate-950");
      bodyEl.classList.remove("bg-slate-50");
      localStorage.setItem("app-theme", "dark");
    } else {
      rootEl.classList.remove("dark");
      bodyEl.classList.remove("dark", "bg-slate-950");
      bodyEl.classList.add("bg-slate-50");
      localStorage.setItem("app-theme", "light");
    }
  }, [darkMode]);

  // Help & Support Center Interactive States
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const [helpCategory, setHelpCategory] = useState("Camera & QR Help");
  const [ticketSuccess, setTicketSuccess] = useState(false);
  const [submittingHelp, setSubmittingHelp] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("godejatin@gmail.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleSendTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpMessage.trim() || !userProfile) return;
    setSubmittingHelp(true);
    try {
      await addDoc(collection(db, "support_requests"), {
        userId: userProfile.userId || auth.currentUser?.uid || "",
        userName: userProfile.name,
        userEmail: userProfile.email,
        role: userProfile.role,
        category: helpCategory,
        message: helpMessage,
        createdAt: new Date().toISOString(),
        status: "open"
      });
      setTicketSuccess(true);
      setHelpMessage("");
      setTimeout(() => setTicketSuccess(false), 4000);
    } catch (err) {
      console.error("Failed to commit support ticket:", err);
      handleFirestoreError(err, OperationType.CREATE, "support_requests");
    } finally {
      setSubmittingHelp(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const uDocSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (uDocSnap.exists()) {
            const data = uDocSnap.data();
            setUserProfile({
              ...data,
              userId: data.userId || data.uid || data.id || firebaseUser.uid
            } as UserProfile);
          } else {
            // Fallback profile if auth succeeded but firestore write is pending
            setUserProfile({
              userId: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Academic User",
              email: firebaseUser.email || "",
              role: "student"
            });
          }
        } catch (err) {
          console.error("UserProfile Firestore Sync crashed:", err);
        }
      } else {
        setUserProfile(null);
      }
      setInitAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (initAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-3 font-sans transition-colors duration-300" id="global-loading">
        <div className="flex space-x-1.5" id="bounce-indicators">
          <span className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">INITIALIZING LIVE ROSTER WORKSPACES...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <AnimatePresence mode="wait">
        <LoginScreen onAuthSuccess={(profile) => setUserProfile(profile)} />
      </AnimatePresence>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300" id="app-root-container">
      {/* Premium Header Layout */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800 sticky top-0 z-40 shadow-sm transition-colors duration-300" id="global-app-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex items-center gap-3.5 select-none cursor-pointer" 
            id="header-branding-logo"
          >
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 opacity-25 blur-sm group-hover:opacity-40 transition duration-300" />
              <div className="relative bg-gradient-to-tr from-indigo-600 to-violet-600 dark:from-indigo-500 dark:to-purple-500 p-2.5 rounded-2xl text-white shadow-md shadow-indigo-600/10 border border-white/10 dark:border-indigo-400/20">
                <GraduationCap className="h-5.5 w-5.5 transform group-hover:rotate-6 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <span className="font-sans font-extrabold text-[#0B1220] dark:text-[#F3F4F6] text-[19px] tracking-tight block leading-tight antialiased">
                Smart Attendance
              </span>
              <span className="text-[10px] font-mono font-black tracking-[0.16em] text-indigo-600 dark:text-indigo-400 block uppercase pt-0.5">
                Curriculum Integration
              </span>
            </div>
          </motion.div>

          <div className="flex items-center gap-4" id="header-user-badge">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">
                {userProfile.name}
              </span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-medium">
                {userProfile.email}
              </span>
            </div>

            <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            {/* Profile Avatar with dynamic role color */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="h-10 w-10 bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold uppercase text-xs">
                  {userProfile.name.substring(0, 2)}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-[7px] text-white ${
                  userProfile.role === "admin" 
                    ? "bg-teal-500" 
                    : userProfile.role === "teacher" 
                      ? "bg-amber-500" 
                      : "bg-emerald-500"
                }`}>
                  {userProfile.role === "admin" ? "A" : userProfile.role === "teacher" ? "T" : "S"}
                </div>
              </div>

              {/* Premium Light/Dark Theme Switcher */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-amber-400 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 font-semibold text-xs"
                title={darkMode ? "Switch to light academic theme" : "Switch to midnight study theme"}
                id="theme-toggle-header-trigger"
              >
                {darkMode ? (
                  <Sun className="h-4.5 w-4.5 text-amber-300 transition-all duration-500 hover:rotate-90" />
                ) : (
                  <Moon className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400 transition-all duration-500 hover:-rotate-12" />
                )}
                <span className="hidden md:inline text-[11px] font-sans">{darkMode ? "Light Mode" : "Dark Mode"}</span>
              </button>

              {/* Premium Help Center trigger next to logout */}
              <button
                onClick={() => setShowHelpModal(true)}
                className="p-2.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 font-semibold text-xs"
                title="Help & Academic Instructions"
                id="help-toggle-header-trigger"
              >
                <HelpCircle className="h-4.5 w-4.5 animate-pulse text-indigo-500 dark:text-indigo-400" />
                <span className="hidden md:inline text-[11px] font-sans">Help Center</span>
              </button>

              <button
                onClick={handleLogout}
                className="p-2.5 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition cursor-pointer"
                id="sign-out-trigger"
                title="Sign out of study sessions"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main dashboard space depending on role */}
      <main className="flex-1 pb-16" id="app-dynamic-dashboard-body">
        {userProfile.role === "admin" && <AdminDashboard user={userProfile} />}
        {userProfile.role === "teacher" && <TeacherDashboard user={userProfile} />}
        {userProfile.role === "student" && <StudentDashboard user={userProfile} />}
      </main>

      {/* Floating Bottom Help Assist Bubble */}
      <div className="fixed bottom-6 right-6 z-40 block" id="floating-support-bubble-container">
        <button
          onClick={() => setShowHelpModal(true)}
          className="group flex items-center gap-2 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-full p-3.5 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 border border-white/10 transition-all duration-300 cursor-pointer"
          title="Instant Help & Developer Contact"
        >
          <HelpCircle className="h-5.5 w-5.5 text-amber-300 group-hover:rotate-12 transition-transform duration-300" />
          <span className="text-xs font-bold font-sans pr-1 max-w-0 overflow-hidden group-hover:max-w-28 transition-all duration-500 ease-out whitespace-nowrap">
            Support Panel
          </span>
        </button>
      </div>

      {/* Modal Backdrop & Help Content Window */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto" id="help-modal-backdrop">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-4xl w-full overflow-hidden my-8 transition-colors duration-300"
              id="help-modal-panel"
            >
              {/* Header block with visual background */}
              <div className="relative p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white flex justify-between items-center">
                <div className="absolute inset-0 opacity-15 pointer-events-none">
                  <img 
                    src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop" 
                    alt="Network grids background" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1 relative z-10">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-6 w-6 text-amber-300" />
                    <h2 className="font-display font-extrabold text-lg tracking-tight text-white">Smart Attendance Assistance</h2>
                  </div>
                  <p className="text-xs text-indigo-200">Instructions, real-time portal guides, or ask for developer support.</p>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer relative z-10 flex items-center gap-1 border border-white/10 text-xs font-bold"
                >
                  <X className="h-4 w-4" />
                  <span>Close</span>
                </button>
              </div>

              {/* Dynamic Column Split */}
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800 max-h-[75vh] overflow-y-auto">
                {/* Left Side: System Instructions */}
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-indigo-50/80 dark:border-slate-800 pb-2">
                      <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-display font-bold text-slate-800 dark:text-slate-100 text-sm">System Operation Guidelines</span>
                    </div>

                    {/* Student Instructions */}
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-900/50 uppercase tracking-widest animate-pulse">
                        🎓 Student Check-In Steps
                      </span>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed font-sans">
                        <li>
                          <strong>Lock GPS Sync:</strong> Ensure your device's geographical location service is fully enabled in your settings bar.
                        </li>
                        <li>
                          <strong>Live Camera Scan:</strong> Position your device rear-lens squarely in front of the active session's QR code displayed in the lecture room.
                        </li>
                        <li>
                          <strong>Fail-safe Verification Phrase:</strong> If your browser blocks the camera lens background stream, type the secret <strong>Verification Word</strong> manually in the classroom gate card.
                        </li>
                      </ul>
                    </div>

                    {/* Teacher Instructions */}
                    <div className="space-y-2 pt-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-[10px] font-mono text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-900/50 uppercase tracking-widest font-sans">
                        🏫 Teacher Lecture Steps
                      </span>
                      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed font-sans">
                        <li>
                          <strong>Bind Divisions:</strong> Configure your target year, department, and division selectors in the administrative ribbon.
                        </li>
                        <li>
                          <strong>GPS Validation Gate:</strong> Hit the <strong>"Sync to Faculty Geolocation Gate"</strong> button to secure target room points.
                        </li>
                        <li>
                          <strong>Start & Reveal QR:</strong> Activate the classroom session; our dynamic tracker will instantly compute secure scan vectors for students!
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Creator Contact Segment */}
                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl space-y-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl text-indigo-700 dark:text-indigo-400 mt-0.5">
                        <Mail className="h-4.5 w-4.5" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest block">Direct Creator Desk</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 font-sans block">Need help with code setup?</span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-normal">
                          For integrations, custom divisions, or production deployment, reach the creator at:
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-1.5">
                      <div className="bg-white dark:bg-slate-800 px-2.5 py-1.5 border border-indigo-100 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-200 flex-1 select-all break-all">
                        godejatin@gmail.com
                      </div>
                      
                      <button
                        onClick={handleCopyEmail}
                        className="p-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 transition"
                        title="Copy support email address"
                      >
                        {copiedEmail ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedEmail ? "Copied" : "Copy"}</span>
                      </button>

                      <a
                        href="mailto:godejatin@gmail.com?subject=Smart%20Attendance%20Portal%20Inquiry"
                        className="p-1.5 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition text-center"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>Email Desk</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Right Side: Interactive Help Request Form */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-indigo-50/80 dark:border-slate-800 pb-2">
                    <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-bounce" />
                    <span className="font-display font-bold text-slate-800 dark:text-slate-100 text-sm">Ask for Help / Submit Inquiry</span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                    Have any questions, or having trouble syncing camera/GPS drivers? Submit an inquiry ticket below, and the developer desk will respond shortly.
                  </p>

                  <form onSubmit={handleSendTicket} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono tracking-wider font-bold text-slate-400 dark:text-slate-500 uppercase">Select Topic Category</label>
                      <select
                        value={helpCategory}
                        onChange={(e) => setHelpCategory(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="Camera & QR Help">Camera & QR Code Recognition Issue</option>
                        <option value="GPS Coordinates Fail">Coordinates Displacement Error</option>
                        <option value="Academic Divisions Sync">Divisions / Division Code missing</option>
                        <option value="General Support Request">General System Inquiry</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono tracking-wider font-bold text-slate-400 dark:text-slate-500 uppercase">Detailed Question / Message</label>
                      <textarea
                        required
                        rows={4}
                        value={helpMessage}
                        onChange={(e) => setHelpMessage(e.target.value)}
                        placeholder="Please describe exactly what you need help with. Make sure to specify details..."
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[90px]"
                      />
                    </div>

                    {ticketSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-1.5 font-medium"
                      >
                        <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <span>Ticket securely saved to database ledger! We will reach you soon.</span>
                      </motion.div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingHelp}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition"
                    >
                      <Send className="h-4 w-4" />
                      <span>{submittingHelp ? "Submitting Inquiry..." : "Submit Help Ticket"}</span>
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
