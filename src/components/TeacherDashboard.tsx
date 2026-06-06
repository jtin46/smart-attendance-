import React, { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  setDoc,
  deleteDoc, 
  orderBy,
  updateDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  UserProfile, 
  ClassSession, 
  AttendanceRecord, 
  CurriculumActivityItem, 
  NoticeItem, 
  TimetableItem, 
  QuizQuestion 
} from "../types";
import { 
  Plus, 
  Trash2, 
  Calendar, 
  Video, 
  Bell, 
  MapPin, 
  QrCode, 
  Check, 
  FileDown, 
  Users, 
  VideoOff, 
  FileText, 
  Sparkles, 
  Brain,
  Search,
  Eye,
  Settings,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TeacherDashboardProps {
  user: UserProfile;
}

export default function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState<"session" | "manual" | "reports" | "curriculum" | "timetable" | "notices">("session");

  // Filters for targeting classes
  const [targetYear, setTargetYear] = useState("3rd Year");
  const [targetDept, setTargetDept] = useState(user.department || "Computer Engineering");
  const [targetDiv, setTargetDiv] = useState("A");

  const [collegeYears, setCollegeYears] = useState<string[]>([]);
  const [collegeDepts, setCollegeDepts] = useState<string[]>([]);

  const DEFAULT_YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
  const DEFAULT_DEPTS = [
    "Computer Engineering",
    "AIDS Engineering",
    "Information Technology",
    "Electronics & Telecom",
    "Mechanical Engineering"
  ];

  // Fetch years and departments dynamically based on chosen collegeCode for teacher
  useEffect(() => {
    async function loadCollegeStructure() {
      try {
        const colCode = user.collegeCode || "DEFAULT";
        const yearQuery = query(collection(db, "years"), where("collegeCode", "==", colCode));
        const yearSnap = await getDocs(yearQuery);
        const yearList: string[] = [];
        yearSnap.forEach((doc) => {
          const data = doc.data();
          if (data.name) yearList.push(data.name);
        });

        const deptQuery = query(collection(db, "departments"), where("collegeCode", "==", colCode));
        const deptSnap = await getDocs(deptQuery);
        const deptList: string[] = [];
        deptSnap.forEach((doc) => {
          const data = doc.data();
          if (data.name) deptList.push(data.name);
        });

        const finalYears = yearList.length > 0 ? yearList : DEFAULT_YEARS;
        const finalDepts = deptList.length > 0 ? deptList : DEFAULT_DEPTS;

        setCollegeYears(finalYears);
        setCollegeDepts(finalDepts);

        // Maintain selection if possible, otherwise set first element
        if (finalYears.length > 0 && !finalYears.includes(targetYear)) {
          setTargetYear(finalYears[0]);
        }
        if (finalDepts.length > 0 && !finalDepts.includes(targetDept)) {
          setTargetDept(finalDepts[0]);
        }
      } catch (err) {
        console.error("Teacher structure loading failed", err);
        setCollegeYears(DEFAULT_YEARS);
        setCollegeDepts(DEFAULT_DEPTS);
      }
    }
    loadCollegeStructure();
  }, [user.collegeCode]);

  // Active Session Form States
  const [className, setClassName] = useState("");
  const [latitude, setLatitude] = useState(19.2274); // Default near St. Francis Inst of Tech
  const [longitude, setLongitude] = useState(72.8569);
  const [radius, setRadius] = useState(50); // meters
  const [duration, setDuration] = useState(3600); // 1 hour seconds
  const [verificationCode, setVerificationCode] = useState("");

  const [activeSession, setActiveSession] = useState<ClassSession | null>(null);
  const [sessionUsers, setSessionUsers] = useState<UserProfile[]>([]);
  const [sessionAttendance, setSessionAttendance] = useState<Record<string, "Present" | "Absent">>({});

  // Curriculum Form States
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoTopic, setVideoTopic] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<QuizQuestion[]>([]);
  const [activitiesList, setActivitiesList] = useState<CurriculumActivityItem[]>([]);

  // Reports state
  const [allSessions, setAllSessions] = useState<ClassSession[]>([]);
  const [selectedReportSession, setSelectedReportSession] = useState("");
  const [sessionReportLogs, setSessionReportLogs] = useState<AttendanceRecord[]>([]);

  // Timetable and notices states
  const [subjectTitle, setSubjectTitle] = useState("");
  const [subjectTime, setSubjectTime] = useState("");
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);

  const [noticeMsg, setNoticeMsg] = useState("");
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  // Feedback states
  const [success, setSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadActiveSessionAndConfig();
    loadPastSessions();
    loadTimetableAndNotices();
    loadCurriculumActivities();
  }, [activeTab]);

  // Load existing active sessions or load default teacher configs
  const loadActiveSessionAndConfig = async () => {
    try {
      const q = query(
        collection(db, "class_sessions"), 
        where("collegeCode", "==", user.collegeCode || "DEFAULT"),
        where("year", "==", targetYear),
        where("department", "==", targetDept),
        where("division", "==", targetDiv)
      );
      const snap = await getDocs(q);
      const list: ClassSession[] = [];
      snap.forEach((doc) => {
        list.push({ ...doc.data() as ClassSession, id: doc.id });
      });

      // Show latest created class session in class target filters
      if (list.length > 0) {
        // Sort by date created desc
        list.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
        setActiveSession(list[0]);
        loadSessionRosters(list[0].id);
      } else {
        setActiveSession(null);
        setSessionUsers([]);
      }
    } catch (err) {
      console.error("Failed to load targets", err);
    }
  };

  const loadPastSessions = async () => {
    try {
      const snap = await getDocs(collection(db, "class_sessions"));
      const list: ClassSession[] = [];
      snap.forEach((doc) => {
        const item = doc.data() as ClassSession;
        if (item.collegeCode === user.collegeCode) {
          list.push({ ...item, id: doc.id });
        }
      });
      list.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
      setAllSessions(list);
      if (list.length > 0 && !selectedReportSession) {
        setSelectedReportSession(list[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadSessionRosters = async (sessionId: string) => {
    try {
      // 1. Load users targeting this class grouping
      const uQ = query(
        collection(db, "users"),
        where("collegeCode", "==", user.collegeCode || "DEFAULT"),
        where("role", "==", "student"),
        where("year", "==", targetYear),
        where("department", "==", targetDept),
        where("division", "==", targetDiv)
      );
      const uSnap = await getDocs(uQ);
      const uList: UserProfile[] = [];
      uSnap.forEach((doc) => { uList.push(doc.data() as UserProfile); });
      setSessionUsers(uList);

      // 2. Load attendance markers already saved
      const aQ = query(collection(db, "attendance"), where("sessionId", "==", sessionId));
      const aSnap = await getDocs(aQ);
      const marks: Record<string, "Present" | "Absent"> = {};
      aSnap.forEach((doc) => {
        const item = doc.data() as AttendanceRecord;
        marks[item.studentId] = item.status;
      });
      setSessionAttendance(marks);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTimetableAndNotices = async () => {
    try {
      // Timetable matches criteria
      const tQ = query(
        collection(db, "timetable"),
        where("collegeCode", "==", user.collegeCode || "DEFAULT"),
        where("year", "==", targetYear),
        where("department", "==", targetDept),
        where("division", "==", targetDiv)
      );
      const tSnap = await getDocs(tQ);
      const tList: TimetableItem[] = [];
      tSnap.forEach((doc) => { tList.push({ ...doc.data() as TimetableItem, id: doc.id }); });
      setTimetable(tList);

      // Notices list
      const nQ = query(
        collection(db, "notices"),
        where("collegeCode", "==", user.collegeCode || "DEFAULT"),
        orderBy("createdAt", "desc")
      );
      const nSnap = await getDocs(nQ);
      const nList: NoticeItem[] = [];
      nSnap.forEach((doc) => { nList.push({ ...doc.data() as NoticeItem, id: doc.id }); });
      setNotices(nList);
    } catch (err) {
      console.error("Timetable loading failed", err);
    }
  };

  const loadCurriculumActivities = async () => {
    try {
      const q = query(
        collection(db, "curriculum_activities"),
        where("collegeCode", "==", user.collegeCode || "DEFAULT"),
        where("teacherId", "==", user.userId)
      );
      const snap = await getDocs(q);
      const list: CurriculumActivityItem[] = [];
      snap.forEach((doc) => { list.push({ ...doc.data() as CurriculumActivityItem, id: doc.id }); });
      setActivitiesList(list);
    } catch (err) {
      console.error(err);
    }
  };

  // Run reports fetches dynamically
  useEffect(() => {
    if (!selectedReportSession) return;
    async function loadReportAttendance() {
      try {
        const q = query(collection(db, "attendance"), where("sessionId", "==", selectedReportSession));
        const snap = await getDocs(q);
        const list: AttendanceRecord[] = [];
        snap.forEach((doc) => {
          list.push({ ...doc.data() as AttendanceRecord, id: doc.id });
        });
        setSessionReportLogs(list);
      } catch (err) {
        console.error(err);
      }
    }
    loadReportAttendance();
  }, [selectedReportSession]);

  // GPS Simulation Trigger Helper
  const setLocalGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setSuccess("Fetched your exact current layout GPS coordinates!");
        },
        (err) => {
          setErrorMsg("Could not verify GPS coordinates automatically, fallback to manual definitions.");
        }
      );
    }
  };

  // Handle Create active class lock gate
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className) return;
    setSuccess(null);
    setErrorMsg(null);

    const generatedCode = verificationCode || Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      const recordId = "session_" + Date.now();
      const payload: ClassSession = {
        id: recordId,
        className: className.trim(),
        sessionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        collegeCode: user.collegeCode || "DEFAULT",
        year: targetYear,
        department: targetDept,
        division: targetDiv,
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: Number(radius),
        createdAt: new Date().toISOString(),
        durationSeconds: Number(duration),
        verificationCode: generatedCode
      };

      await setDoc(doc(db, "class_sessions", recordId), payload);
      setClassName("");
      setVerificationCode("");
      setSuccess(`Attendance gate activated for "${payload.className}"! Verification code code: "${generatedCode}"`);
      await loadActiveSessionAndConfig();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "class_sessions");
    }
  };

  // Mark student manual attendance toggle in grid
  const toggleAttendance = async (student: UserProfile, currentStatus?: "Present" | "Absent") => {
    if (!activeSession) return;
    setSuccess(null);

    const newStatus = currentStatus === "Present" ? "Absent" : "Present";
    const markId = `attendance_${activeSession.id}_${student.userId}`;

    try {
      const payload: AttendanceRecord = {
        id: markId,
        studentId: student.userId,
        studentName: student.name,
        sessionId: activeSession.id,
        className: activeSession.className,
        collegeCode: user.collegeCode || "DEFAULT",
        year: targetYear,
        department: targetDept,
        division: targetDiv,
        status: newStatus,
        timestamp: new Date().toISOString()
      };

      await setDoc(doc(db, "attendance", markId), payload);
      setSessionAttendance(prev => ({ ...prev, [student.userId]: newStatus }));
      setSuccess(`Attendance overridden index successfully: ${student.name} designated ${newStatus}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance/${markId}`);
    }
  };

  // Live Auto-Quiz builder using server proxy Google Gemini
  const handleGenerateQuiz = async () => {
    if (!videoTopic) {
      setErrorMsg("Please provide a lecture topic to construct assessment.");
      return;
    }
    setSuccess(null);
    setErrorMsg(null);
    setAiGenerating(true);
    setGeneratedQuiz([]);

    try {
      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: videoTopic })
      });
      const data = await response.json();
      if (response.ok) {
        setGeneratedQuiz(data);
        setSuccess("Success! Gemini successfully parsed your topic and constructed 5 balanced MCQs.");
      } else {
        setErrorMsg(data.error || "Gemini engine failed to construct questions.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Server timed out. Verify your backend API connections.");
    } finally {
      setAiGenerating(false);
    }
  };

  // Publish YouTube activity + quiz to Firestore
  const handlePublishCurriculum = async () => {
    if (!youtubeUrl || !videoTopic || generatedQuiz.length === 0) {
      setErrorMsg("Cannot publish without a lecture link and generated quiz.");
      return;
    }
    setSuccess(null);
    setErrorMsg(null);

    try {
      const actId = "activity_" + Date.now();
      const payload: CurriculumActivityItem = {
        id: actId,
        teacherId: user.userId,
        youtubeUrl: youtubeUrl.trim(),
        topic: videoTopic.trim(),
        collegeCode: user.collegeCode || "DEFAULT",
        year: targetYear,
        department: targetDept,
        division: targetDiv,
        createdAt: new Date().toISOString(),
        quiz: generatedQuiz
      };

      await setDoc(doc(db, "curriculum_activities", actId), payload);
      setYoutubeUrl("");
      setVideoTopic("");
      setGeneratedQuiz([]);
      setSuccess("Curriculum published successfully! Affected students will instantly receive the quiz.");
      await loadCurriculumActivities();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "curriculum_activities");
    }
  };

  // CSV Spreadsheet Roster download trigger
  const triggerCSVDownload = () => {
    if (sessionReportLogs.length === 0) {
      setErrorMsg("No actual records logged in this session to export.");
      return;
    }

    const currentReportSess = allSessions.find(s => s.id === selectedReportSession);
    const sessionName = currentReportSess ? currentReportSess.className : "Session";

    // 1. Construct headers
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student ID,Student Name,Session,Status,Timestamp\r\n";

    // 2. Map payload rows
    sessionReportLogs.forEach((row) => {
      csvContent += `"${row.studentId}","${row.studentName}","${row.className}","${row.status}","${row.timestamp}"\r\n`;
    });

    // 3. Trigger download action
    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `Attendance_Report_${sessionName.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    setSuccess("Attendance Spreadsheet exported to study records successfully.");
  };

  // Add Notice and timetable helpers
  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeMsg) return;
    setSuccess(null);

    try {
      const id = "notice_" + Date.now();
      const payload: NoticeItem = {
        id,
        teacherId: user.userId,
        teacherName: user.name,
        message: noticeMsg.trim(),
        collegeCode: user.collegeCode || "DEFAULT",
        year: targetYear,
        department: targetDept,
        division: targetDiv,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "notices", id), payload);
      setNoticeMsg("");
      setSuccess("Announcement notice broadcasted successfully!");
      await loadTimetableAndNotices();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "notices");
    }
  };

  const handleAddTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectTitle || !subjectTime) return;
    setSuccess(null);

    try {
      const id = "timetable_" + Date.now();
      const payload: TimetableItem = {
        id,
        subject: subjectTitle.trim(),
        time: subjectTime.trim(),
        collegeCode: user.collegeCode || "DEFAULT",
        year: targetYear,
        department: targetDept,
        division: targetDiv
      };

      await setDoc(doc(db, "timetable", id), payload);
      setSubjectTitle("");
      setSubjectTime("");
      setSuccess("Timetable schedule mapped successfully!");
      await loadTimetableAndNotices();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "timetable");
    }
  };

  const handleDeleteItem = async (col: string, id: string) => {
    try {
      await deleteDoc(doc(db, col, id));
      setSuccess("Record removed securely.");
      await loadTimetableAndNotices();
      await loadCurriculumActivities();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${col}/${id}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-8 font-sans" id="teacher-dashboard-view">
      {/* Visual greeting and administration card */}
      <div className="relative rounded-2xl overflow-hidden shadow-md border border-amber-100/50 p-6 bg-gradient-to-r from-slate-900 via-amber-950 to-stone-900 text-white min-h-[160px] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute inset-0 opacity-15 pointer-events-none mix-blend-overlay">
          <img 
            src="https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?q=80&w=1200&auto=format&fit=crop" 
            alt="Academic lecture background" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-mono text-amber-300 font-bold border border-white/10 uppercase tracking-widest">
            🏫 Professional Faculty Panel
          </div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-white mt-1">
            Welcome back, Prof. {user.name}
          </h1>
          <p className="text-xs text-stone-200 leading-relaxed">
            Campus: <strong className="font-mono text-amber-300">{user.collegeCode}</strong> &bull; Department: <strong className="font-sans text-amber-300">{user.department}</strong>
          </p>
        </div>

        {/* Global targeting select list to quickly partition lectures */}
        <div className="relative z-10 flex bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 gap-2 flex-wrap items-center shadow-sm">
          <div>
            <select
              value={targetYear}
              onChange={(e) => { setTargetYear(e.target.value); }}
              className="px-2.5 py-1.5 bg-slate-900 border border-white/15 text-xs text-white rounded-lg font-bold focus:outline-none"
            >
              {collegeYears.map((yr, idx) => (
                <option key={`${yr}-${idx}`} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={targetDept}
              onChange={(e) => { setTargetDept(e.target.value); }}
              className="px-2.5 py-1.5 bg-slate-900 border border-white/15 text-xs text-white rounded-lg font-bold focus:outline-none"
            >
              {collegeDepts.map((d, idx) => (
                <option key={`${d}-${idx}`} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={targetDiv}
              onChange={(e) => { setTargetDiv(e.target.value); }}
              className="px-2.5 py-1.5 bg-slate-900 border border-white/15 text-xs text-white rounded-lg font-bold focus:outline-none"
            >
              <option value="A">Div A</option>
              <option value="B">Div B</option>
              <option value="C">Div C</option>
              <option value="D">Div D</option>
            </select>
          </div>
          <button 
            onClick={loadActiveSessionAndConfig}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg shadow-sm border border-amber-400 cursor-pointer transition"
          >
            Apply Target
          </button>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex justify-between items-center" id="teacher-success">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            {success}
          </div>
          <button onClick={() => setSuccess(null)} className="text-xs font-bold text-emerald-600 hover:underline">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex justify-between items-center" id="teacher-error">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            {errorMsg}
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Dashboard Nav Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-6 sm:overflow-visible no-scrollbar" id="teacher-tabs">
        <button
          onClick={() => { setActiveTab("session"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "session" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <QrCode className="h-4.5 w-4.5" /> Start Gate
        </button>
        <button
          onClick={() => { setActiveTab("manual"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "manual" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <Users className="h-4.5 w-4.5" /> Live Grid
        </button>
        <button
          onClick={() => { setActiveTab("reports"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "reports" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <FileDown className="h-4.5 w-4.5" /> Download Reports
        </button>
        <button
          onClick={() => { setActiveTab("curriculum"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "curriculum" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <Video className="h-4.5 w-4.5" /> Shared Activities
        </button>
        <button
          onClick={() => { setActiveTab("timetable"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "timetable" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <Calendar className="h-4.5 w-4.5" /> Schedule Setup
        </button>
        <button
          onClick={() => { setActiveTab("notices"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "notices" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <Bell className="h-4.5 w-4.5" /> Notice Board
        </button>
      </div>

      {activeTab === "session" && (
        <div className="grid md:grid-cols-12 gap-6" id="teacher-session-tab">
          {/* Form to activate Class */}
          <div className="md:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-display font-extrabold text-sm text-slate-800 border-b border-slate-100 pb-2">
              <QrCode className="text-indigo-600 h-5 w-5" />
              <span>Launch Attendance Gate</span>
            </div>
            
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject Name / Class Title</label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Distributed Computing"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Coordinates configuration (Stored securely in state, hidden from display) */}
              <input type="hidden" value={latitude} readOnly />
              <input type="hidden" value={longitude} readOnly />
              
              <div className="p-4 bg-emerald-50/70 border border-emerald-100/85 rounded-xl text-xs space-y-1.5 leading-normal font-sans text-emerald-800">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span>GPS Tracking Gate Sync Active</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-normal">
                  Classroom check-ins will be secure. Students must be inside your lecture perimeter when scanning to mark presence.
                </p>
                {latitude !== 19.22745 && longitude !== 72.85695 ? (
                  <div className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-100/40 px-2 py-1 rounded inline-block">
                    ✔ GEOLOCATION SYNCED IN REAL-TIME
                  </div>
                ) : (
                  <div className="text-[10px] font-mono font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded inline-block">
                    ⚠ USING DEFAULT CAMPUS BOUNDARIES (CLICK SYNC BELOW TO BIND YOUR ROOM)
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={setLocalGPS}
                  className="w-full bg-slate-100 hover:bg-slate-200 font-bold py-2.5 text-xs text-slate-700 border border-slate-200 shadow-sm rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <MapPin className="h-4.5 w-4.5 text-emerald-600 animate-bounce" />
                  <span>Sync to Faculty Geolocation Gate</span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Validation Radius (meters)</label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm font-semibold focus:outline-none"
                >
                  <option value={10}>10 meters (strict local desk size)</option>
                  <option value={25}>25 meters (regular lecture hall)</option>
                  <option value={50}>50 meters (medium department block)</option>
                  <option value={100}>100 meters (campus radius)</option>
                  <option value={50000}>50,000 meters (Offline/Wide Area bypass)</option>
                </select>
              </div>

              {/* Advanced settings */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Verification QR Code / Word (Optional)</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  placeholder="Auto-generated if blank"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none uppercase font-mono font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm border border-indigo-500 cursor-pointer text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Initialize Class Lock</span>
              </button>
            </form>
          </div>

          {/* Dynamic Active QR panel */}
          <div className="md:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
            {activeSession ? (
              <div className="space-y-4 w-full" id="session-active-card">
                <div className="flex items-center gap-2 py-1 px-3.5 bg-emerald-50 text-emerald-700 text-xs font-mono font-bold rounded-lg border border-emerald-200 mx-auto w-fit">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE SESSION GATE ACTIVE
                </div>

                <h3 className="font-display font-extrabold text-xl text-slate-900 leading-tight">
                  {activeSession.className}
                </h3>
                <p className="text-slate-500 text-xs">
                  Target: {activeSession.year} &bull; {activeSession.department} &bull; Div {activeSession.division}
                </p>

                {/* Simulated QR block representing live verification coordinates */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 w-64 mx-auto relative group">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      JSON.stringify({
                        sessionId: activeSession.id,
                        className: activeSession.className,
                        verificationCode: activeSession.verificationCode,
                        latitude: activeSession.latitude,
                        longitude: activeSession.longitude,
                        radius: activeSession.radius
                      })
                    )}`}
                    alt="Attendance QR Code"
                    id="active-session-qr-image"
                    className="w-full h-auto rounded-lg mx-auto"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="space-y-2 text-center">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SECURE CLASSROOM BOUNDARIES</div>
                  <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 py-1.5 px-3 rounded-lg max-w-sm mx-auto flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    <span>Real-Time Perimeters Locked &bull; Sync Fence: {activeSession.radius}m</span>
                  </div>
                  <div className="text-sm font-bold text-indigo-700 font-mono bg-indigo-50 border border-indigo-100/50 py-1 py-1.5 px-3.5 rounded-xl inline-block mt-1">
                    VERIFICATION PHRASE: "{activeSession.verificationCode}"
                  </div>
                </div>

                <button
                  onClick={async () => {
                    await deleteDoc(doc(db, "class_sessions", activeSession.id));
                    setSuccess("Active class lock archived successfully.");
                    await loadActiveSessionAndConfig();
                  }}
                  className="px-4 py-2 text-xs bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 transition font-bold rounded-xl cursor-pointer"
                >
                  Terminate Active Gate
                </button>
              </div>
            ) : (
              <div className="py-12 space-y-2">
                <VideoOff className="h-12 w-12 text-slate-300 mx-auto" />
                <h4 className="font-display font-bold text-slate-700 text-sm">No Active Attendance Gates Detected</h4>
                <p className="text-slate-400 text-xs max-w-xs mx-auto">
                  Configure and launch a session on the left to reveal target QR codes representing GPS-validated check-in nodes.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "manual" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4" id="teacher-manual-tab">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="space-y-0.5">
              <h3 className="font-display font-bold text-base text-slate-800">Live Grid Student List</h3>
              <p className="text-slate-400 text-xs">
                Target: {targetYear} &bull; {targetDept} &bull; Class div {targetDiv}
              </p>
            </div>
            {activeSession ? (
              <span className="p-1 px-3 font-mono text-xs text-amber-600 bg-amber-50 rounded-lg font-bold border border-amber-200">
                Logged in Class: {activeSession.className}
              </span>
            ) : (
              <span className="p-1 px-3 font-mono text-xs text-slate-400 bg-slate-100 rounded-lg">
                No active class session
              </span>
            )}
          </div>

          {!activeSession ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Please initialize or select an active class session in the "Start Gate" tab to load student grid logs.
            </div>
          ) : sessionUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm animate-pulse">
              No students found registered under Year: <strong>{targetYear}</strong> &bull; Dept: <strong>{targetDept}</strong> &bull; Div: <strong>{targetDiv}</strong>.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sessionUsers.map((student) => {
                const status = sessionAttendance[student.userId] || "Absent";
                return (
                  <div 
                    key={student.userId} 
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-200 ${
                      status === "Present" 
                        ? "bg-emerald-50/50 border-emerald-200 shadow-sm" 
                        : "bg-white border-slate-100"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800 text-sm">{student.name}</div>
                      <div className="text-xs text-slate-400">{student.email}</div>
                      <div className="text-[10px] bg-slate-100 text-slate-500 rounded p-0.5 px-2.5 font-mono w-fit">
                        Status: <strong className={status === "Present" ? "text-emerald-600" : "text-slate-400"}>{status}</strong>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleAttendance(student, sessionAttendance[student.userId])}
                      className={`p-2.5 rounded-xl border transition-all duration-150 shadow-sm flex items-center justify-center cursor-pointer ${
                        status === "Present"
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                    >
                      <Check className="h-4.5 w-4.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "reports" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6" id="teacher-reports-tab">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <h3 className="font-display font-extrabold text-base text-slate-800">📊 Past Sessions Attendance</h3>
              <p className="text-xs text-slate-400">Filter past session registers, inspect roster marks, and trigger CSV downloads.</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedReportSession}
                onChange={(e) => setSelectedReportSession(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none"
              >
                <option value="">Choose Class Session...</option>
                {allSessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.className} ({s.sessionTime} - {new Date(s.createdAt).toLocaleDateString()})</option>
                ))}
              </select>

              <button
                onClick={triggerCSVDownload}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm border border-indigo-500 cursor-pointer"
              >
                <FileDown className="h-4 w-4" /> Download CSV
              </button>
            </div>
          </div>

          {sessionReportLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No students logged present for the selected session. Export will produce empty metrics.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-mono text-xs uppercase tracking-widest">
                    <th className="pb-3 text-xs font-semibold pl-2">Student Name</th>
                    <th className="pb-3 text-xs font-semibold">Status</th>
                    <th className="pb-3 text-xs font-semibold">Subject Title</th>
                    <th className="pb-3 text-xs font-semibold">Logged Timestamp</th>
                    <th className="pb-3 text-xs font-semibold text-right pr-2">Student ID</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionReportLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                      <td className="py-3 pl-2">
                        <div className="font-bold text-slate-800 text-sm">{log.studentName}</div>
                      </td>
                      <td className="py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600 text-xs font-semibold">{log.className}</td>
                      <td className="py-3 text-xs font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="py-3 text-right font-mono text-xs text-slate-400 pr-2">{log.studentId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "curriculum" && (
        <div className="grid md:grid-cols-12 gap-6" id="teacher-curriculum-tab">
          {/* Lecture Publish Form */}
          <div className="md:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-display font-extrabold text-sm text-slate-800 pb-2 border-b border-slate-100">
              <Video className="text-indigo-600 h-5 w-5" />
              <span>Offline Lecture Curricula</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">YouTube Lesson URL</label>
                <input
                  type="text"
                  required
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-display">Lesson Topic Keywords (Gemini AI Quiz target)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={videoTopic}
                    onChange={(e) => setVideoTopic(e.target.value)}
                    placeholder="e.g. Asymmetric Encryption, Bubble Sort"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateQuiz}
                disabled={aiGenerating || !videoTopic}
                className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold py-2.5 text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Brain className="h-4 w-4 text-indigo-600" />
                <span>{aiGenerating ? "Gemini Synthesizing interactive MCQs..." : "Synthesize AI MCQ Assessment"}</span>
              </button>

              {generatedQuiz.length > 0 && (
                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                  <h4 className="font-display font-bold text-slate-800 text-xs flex items-center gap-1">
                    <Sparkles className="h-4.5 w-4.5 text-indigo-600" /> Ready to publish quiz questions
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Students must watch the digital lesson link and submit correct answer assessments to lock attendance.
                  </p>
                  <button
                    onClick={handlePublishCurriculum}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg border border-indigo-500 text-xs cursor-pointer"
                  >
                    Publish Digital Lesson & Quiz
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Past Curriculums view */}
          <div className="md:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-base text-slate-800">Previously Shared Activities</h3>
            {activitiesList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">No remote activities shared yet. Share a YouTube link on the left to start.</div>
            ) : (
              <div className="space-y-4">
                {activitiesList.map((act) => (
                  <div key={act.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="font-bold text-slate-800 text-sm">{act.topic}</div>
                      <div className="text-xs text-indigo-600 font-mono truncate max-w-sm">{act.youtubeUrl}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                        <span>Target class: {act.year} &bull; Div {act.division}</span>
                        <span>&bull;</span>
                        <span>AI Quiz questions: {act.quiz?.length || 5}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteItem("curriculum_activities", act.id)}
                      className="p-1 px-2.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "timetable" && (
        <div className="grid md:grid-cols-12 gap-6" id="teacher-timetable-tab">
          {/* Add schedule form */}
          <div className="md:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-base text-slate-800">Map Class Schedule</h3>
            
            <form onSubmit={handleAddTimetable} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject Title</label>
                <input
                  type="text"
                  required
                  value={subjectTitle}
                  onChange={(e) => setSubjectTitle(e.target.value)}
                  placeholder="e.g., Cryptography"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Session Time Slot</label>
                <input
                  type="text"
                  required
                  value={subjectTime}
                  onChange={(e) => setSubjectTime(e.target.value)}
                  placeholder="e.g., Monday 10:00 AM - 11:30 AM"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition border border-indigo-500 text-sm cursor-pointer"
              >
                Schedule Subject
              </button>
            </form>
          </div>

          {/* Timetable schedule list */}
          <div className="md:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-base text-slate-800">Affiliated Timetable Slots</h3>
            {timetable.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">No scheduled subjects defined.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-mono text-xs uppercase tracking-widest">
                      <th className="pb-3 text-xs pl-2">Subject</th>
                      <th className="pb-3 text-xs">Assigned Time Slot</th>
                      <th className="pb-3 text-xs text-right pr-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timetable.map((t) => (
                      <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                        <td className="py-3.5 pl-2">
                          <div className="font-semibold text-slate-800 text-sm">{t.subject}</div>
                        </td>
                        <td className="py-3.5">
                          <div className="text-xs text-slate-700 font-medium font-mono bg-slate-50 p-1.5 rounded-lg border border-slate-100 w-fit">
                            {t.time}
                          </div>
                        </td>
                        <td className="py-3.5 text-right pr-2 cursor-pointer">
                          <button
                            onClick={() => handleDeleteItem("timetable", t.id)}
                            className="p-1 px-2 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {activeTab === "notices" && (
        <div className="grid md:grid-cols-12 gap-6" id="teacher-notices-tab">
          {/* Post Notice */}
          <div className="md:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-base text-slate-800">Publish Notice</h3>
            
            <form onSubmit={handleAddNotice} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Announcement Message</label>
                <textarea
                  required
                  rows={4}
                  value={noticeMsg}
                  onChange={(e) => setNoticeMsg(e.target.value)}
                  placeholder="e.g. Midterm exams start from next Monday. Ensure files are submitted."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition border border-indigo-500 text-sm cursor-pointer"
              >
                Broadcast Notice
              </button>
            </form>
          </div>

          {/* Historical Notices */}
          <div className="md:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-base text-slate-800">University Bulletin</h3>
            {notices.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">No notifications shared on the boards.</div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto no-scrollbar">
                {notices.map((n) => (
                  <div key={n.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-800 font-semibold leading-relaxed font-sans">{n.message}</div>
                      <div className="text-[10px] text-slate-400">
                        Posted by Prof. {n.teacherName} &bull; {new Date(n.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteItem("notices", n.id)}
                      className="p-1 px-2 text-slate-400 hover:text-rose-500 h-fit rounded hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
