import React, { useState, useEffect } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  query,
  where
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { UserRole, UserProfile, College } from "../types";
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  User, 
  BookOpen, 
  School, 
  Layers, 
  Compass, 
  ArrowRight,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LoginScreenProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

export default function LoginScreen({ onAuthSuccess }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  
  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [collegeCode, setCollegeCode] = useState("");
  const [year, setYear] = useState("1st Year");
  const [department, setDepartment] = useState("Computer Engineering");
  const [division, setDivision] = useState("A");

  // Dynamic College Lists
  const [colleges, setColleges] = useState<College[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Dynamic Year and Department selections matching selected college
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableDepts, setAvailableDepts] = useState<string[]>([]);

  const DEFAULT_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
  const DEFAULT_DEPTS = [
    "Computer Engineering",
    "AIDS Engineering",
    "Information Technology",
    "Electronics & Telecom",
    "Mechanical Engineering"
  ];

  // Fetch created colleges so they can just select or type a valid one
  useEffect(() => {
    async function loadColleges() {
      try {
        const querySnapshot = await getDocs(collection(db, "colleges"));
        const list: College[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            name: data.name || "",
            code: data.code || ""
          });
        });
        setColleges(list);
        if (list.length > 0 && !collegeCode) {
          setCollegeCode(list[0].code);
        }
      } catch (err) {
        console.error("Colleges list failed to fetch", err);
      }
    }
    loadColleges();
  }, []);

  // Fetch years and departments dynamically based on chosen collegeCode
  useEffect(() => {
    if (!collegeCode) return;
    async function loadStructure() {
      try {
        const yearQuery = query(collection(db, "years"), where("collegeCode", "==", collegeCode));
        const yearSnap = await getDocs(yearQuery);
        const yearList: string[] = [];
        yearSnap.forEach((doc) => {
          const data = doc.data();
          if (data.name) yearList.push(data.name);
        });
        
        const deptQuery = query(collection(db, "departments"), where("collegeCode", "==", collegeCode));
        const deptSnap = await getDocs(deptQuery);
        const deptList: string[] = [];
        deptSnap.forEach((doc) => {
          const data = doc.data();
          if (data.name) deptList.push(data.name);
        });

        // Set dynamic lists or default to fallbacks if empty
        const finalYears = yearList.length > 0 ? yearList : DEFAULT_YEARS;
        const finalDepts = deptList.length > 0 ? deptList : DEFAULT_DEPTS;

        setAvailableYears(finalYears);
        setAvailableDepts(finalDepts);

        // Auto-select first element from the lists
        if (finalYears.length > 0) {
          setYear(finalYears[0]);
        }
        if (finalDepts.length > 0) {
          setDepartment(finalDepts[0]);
        }
      } catch (err) {
        console.error("Structure list failed to fetch", err);
        setAvailableYears(DEFAULT_YEARS);
        setAvailableDepts(DEFAULT_DEPTS);
      }
    }
    loadStructure();
  }, [collegeCode]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    if (!email || !password) {
      setErrorMsg("Please enter email and password.");
      setLoading(false);
      return;
    }

    if (isSignUp && !name) {
      setErrorMsg("Please enter your name.");
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // 1. Create client credential
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Map metadata profile
        const profile: UserProfile = {
          userId: user.uid,
          name,
          email,
          role,
          collegeCode: collegeCode || "DEFAULT",
          ...(role === "student" && { year, department, division }),
          ...(role === "teacher" && { department })
        };

        // 3. Write user profile to Firestore
        try {
          await setDoc(doc(db, "users", user.uid), profile);
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.CREATE, "users/" + user.uid);
        }

        onAuthSuccess(profile);
      } else {
        // Login flow
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Fetch User details
        let userDoc;
        try {
          userDoc = await getDoc(doc(db, "users", user.uid));
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.GET, "users/" + user.uid);
        }

        if (userDoc?.exists()) {
          onAuthSuccess(userDoc.data() as UserProfile);
        } else {
          // Fallback if record somehow isn't saved in database
          const fallbackProfile: UserProfile = {
            userId: user.uid,
            name: user.displayName || email.split("@")[0],
            email: email,
            role: "student"
          };
          onAuthSuccess(fallbackProfile);
        }
      }
    } catch (err: any) {
      console.error("Auth helper error:", err);
      let friendlyMessage = err.message;
      if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "This email is already registered.";
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        friendlyMessage = "Invalid email credentials or password.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "Password must be at least 6 characters.";
      }
      setErrorMsg(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 overflow-hidden bg-slate-50 font-sans" id="login-container">
      {/* Decorative branding rail */}
      <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-tr from-indigo-700 via-indigo-600 to-violet-600 flex-col justify-between p-12 text-white relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
        
        <motion.div 
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="flex items-center gap-3.5 z-10 select-none cursor-pointer" 
          id="login-logo-panel"
        >
          <div className="relative group">
            <div className="absolute -inset-1 rounded-2xl bg-white/20 opacity-20 blur-sm group-hover:opacity-45 transition duration-300" />
            <div className="relative bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/25 pr-3 pl-3">
              <GraduationCap className="h-6 w-6 text-white transform group-hover:rotate-6 transition-transform duration-300" />
            </div>
          </div>
          <div>
            <span className="font-sans font-extrabold text-white text-xl tracking-tight block leading-tight antialiased">
              Smart Attendance
            </span>
            <span className="text-[10px] font-mono font-bold tracking-[0.16em] text-indigo-200/90 block uppercase pt-0.5">
              Curriculum Integration
            </span>
          </div>
        </motion.div>

        <div className="space-y-6 z-10 max-w-sm">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-mono tracking-wider uppercase text-indigo-200">
            <Sparkles className="h-3 w-3" /> Live Campus Platform
          </div>
          <h1 className="font-display font-bold text-4xl leading-tight">
            Connecting active study sessions with interactive curriculum.
          </h1>
          <p className="text-sm text-indigo-100/90 leading-relaxed">
            Eliminate proxy check-ins with location-based verification, digital QR codes, and instant learning-to-attendance checks.
          </p>
        </div>

        <div className="text-indigo-200 text-xs font-mono" id="login-footer-panel">
          Smart Attendance Suite &bull; Built with Cloud Run and Firestore
        </div>
      </div>

      {/* Main Form content wrapper */}
      <div className="col-span-12 lg:col-span-7 flex items-center justify-center p-6 md:p-12 relative">
        <div className="w-full max-w-md space-y-8" id="login-card-root">
          <div className="space-y-2">
            <h2 className="font-display font-extrabold text-3xl tracking-tight text-slate-900">
              {isSignUp ? "Create academic account" : "Sign in to your campus"}
            </h2>
            <p className="text-slate-500 text-sm">
              {isSignUp ? "Join as an Administrator, Educator, or Student" : "Enter your standard university logins below"}
            </p>
          </div>

          {/* Role selector chips on signup */}
          {isSignUp && (
            <div className="bg-slate-100 p-1.5 rounded-xl grid grid-cols-3 gap-1" id="signup-role-selector">
              {(["student", "teacher", "admin"] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 text-xs font-medium rounded-lg capitalize transition-all duration-200 ${
                    role === r 
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium"
              id="auth-error-notif"
            >
              <span className="inline-block w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
              {errorMsg}
            </motion.div>
          )}

          <form onSubmit={handleAction} className="space-y-4">
            {/* Display name field on signup */}
            {isSignUp && (
              <div className="space-y-1" id="form-name-block">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your registered name"
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div className="space-y-1" id="form-email-block">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1" id="form-password-block">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Additional metadata fields depending on role */}
            {isSignUp && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-4 pt-2"
                id="form-dynamic-block"
              >
                {/* College Mapping */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">College Code / Campus</label>
                  <div className="relative">
                    <School className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                    {colleges.length > 0 ? (
                      <select
                        value={collegeCode}
                        onChange={(e) => setCollegeCode(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none"
                      >
                        {colleges.map((col, idx) => (
                          <option key={`${col.id}-${col.code}-${idx}`} value={col.code}>
                            {col.name} ({col.code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={collegeCode}
                        onChange={(e) => setCollegeCode(e.target.value.toUpperCase())}
                        placeholder="e.g. SFIT, COEP"
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>
                </div>

                {/* Student specific: Year, Dept, Division */}
                {role === "student" && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Year</label>
                      <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none"
                      >
                        {availableYears.map((yr, idx) => (
                          <option key={`${yr}-${idx}`} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Dep.</label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none"
                      >
                        {availableDepts.map((d, idx) => (
                          <option key={`${d}-${idx}`} value={d}>
                            {d.length > 12 ? d.substring(0, 10) + "..." : d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Div</label>
                      <select
                        value={division}
                        onChange={(e) => setDivision(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Teacher specific: Department */}
                {role === "teacher" && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-widest">Department</label>
                    <div className="relative">
                      <Compass className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none"
                      >
                        {availableDepts.map((d, idx) => (
                          <option key={`${d}-${idx}`} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group border border-indigo-500 shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
              id="auth-submit-btn"
            >
              {loading ? (
                <span className="flex items-center gap-1.5 text-sm font-light">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ) : (
                <>
                  <span>{isSignUp ? "Create Campus Profile" : "Secure Sign In"}</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setErrorMsg(null);
                setIsSignUp(!isSignUp);
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
              id="toggle-auth-btn"
            >
              {isSignUp ? "Already have an account? Sign In" : "New to the platform? Register account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
