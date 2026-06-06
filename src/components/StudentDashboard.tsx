import React, { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  setDoc,
  getDoc,
  addDoc
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
  Check, 
  MapPin, 
  Video, 
  MessageSquare, 
  Bell, 
  Calendar, 
  Award, 
  Compass, 
  HelpCircle, 
  Sparkles, 
  Tv, 
  Send,
  Loader,
  BrainCircuit,
  ArrowRight,
  QrCode,
  Camera,
  School,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Html5Qrcode } from "html5-qrcode";

interface StudentDashboardProps {
  user: UserProfile;
}

// Spherical Law of Cosines to check precise GPS limits
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function StudentDashboard({ user }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<"checkin" | "lessons" | "chatbot" | "timetable" | "notices">("checkin");

  // Roster lists
  const [activeSessions, setActiveSessions] = useState<ClassSession[]>([]);
  const [pastAttendance, setPastAttendance] = useState<AttendanceRecord[]>([]);
  const [lessons, setLessons] = useState<CurriculumActivityItem[]>([]);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  // Simulation GPS variables
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLng, setMyLng] = useState<number | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [typedVerificationPhrase, setTypedVerificationPhrase] = useState("");

  // QR Scanning States
  const [showQRMode, setShowQRMode] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("Ready to scan.");
  const [scanningTargetSession, setScanningTargetSession] = useState<ClassSession | null>(null);

  // Auto clean camera resources on unmount or tab switch or scanning mode deactivate
  useEffect(() => {
    let qrScanner: Html5Qrcode | null = null;
    const scannerElementId = "camera-scanner-view";

    const stopCamera = async () => {
      if (qrScanner && qrScanner.isScanning) {
        try {
          await qrScanner.stop();
        } catch (err) {
          console.error("Camera stop failed", err);
        }
      }
    };

    if (useCamera && showQRMode) {
      // Small timeout to allow element rendering in React state cycle
      const timer = setTimeout(() => {
        const element = document.getElementById(scannerElementId);
        if (element) {
          qrScanner = new Html5Qrcode(scannerElementId);
          setScanStatus("Calibrating rear-lens stream...");

          const scanConfig = {
            fps: 10,
            qrbox: (width: number, height: number) => {
              const size = Math.min(width, height) * 0.75;
              return { width: size, height: size };
            }
          };

          const onScanSuccess = (decodedText: string) => {
            setScanStatus("QR decoded successfully!");
            handleQRDecoded(decodedText, scanningTargetSession);
            setUseCamera(false);
            if (qrScanner) {
              qrScanner.stop().catch(err => console.error(err));
            }
          };

          const onScanFailure = () => {
            // Non-critical frame check logs
          };

          qrScanner.start(
            { facingMode: "environment" },
            scanConfig,
            onScanSuccess,
            onScanFailure
          ).catch(err => {
            console.warn("Environment lens absent or barred, falling back to front camera stream...", err);
            setScanStatus("Attempting front camera stream callback...");
            if (!qrScanner) return Promise.reject(new Error("Scanner disposed"));
            return qrScanner.start(
              { facingMode: "user" },
              scanConfig,
              onScanSuccess,
              onScanFailure
            );
          }).catch(err => {
            console.warn("User camera constraint rejected, exploring generic system stream ID...", err);
            setScanStatus("Querying system camera drivers...");
            if (!qrScanner) return Promise.reject(new Error("Scanner disposed"));
            return Html5Qrcode.getCameras().then(devices => {
              if (devices && devices.length > 0) {
                const primaryId = devices[0].id;
                return qrScanner!.start(
                  primaryId,
                  scanConfig,
                  onScanSuccess,
                  onScanFailure
                );
              }
              return Promise.reject(new Error("No responsive camera driver located."));
            });
          }).catch(err => {
            console.error("All media stream tracks failed", err);
            setScanStatus("Pipeline offline. Confirm browser camera permits & enable permissions.");
            setErrorMsg("Webcam stream block: Please open the app in a new browser tab to grant permissions, or use image upload below!");
            setUseCamera(false);
          });
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    }

    return () => {
      stopCamera();
    };
  }, [useCamera, showQRMode, scanningTargetSession]);

  // Process decoded text
  const handleQRDecoded = async (text: string, specificSession: ClassSession | null) => {
    try {
      let decodedPhrase = text;
      let targetSession = specificSession;

      // Try parsing if format is JSON payload
      try {
        const payload = JSON.parse(text);
        if (payload && payload.verificationCode) {
          decodedPhrase = payload.verificationCode;
          if (!targetSession) {
            // Unbound scan - discover matching active session!
            const matchSess = activeSessions.find(s => s.id === payload.sessionId);
            if (matchSess) {
              targetSession = matchSess;
            } else {
              // Try finding session matching verification code
              const foundByCode = activeSessions.find(s => s.verificationCode?.trim().toUpperCase() === payload.verificationCode.trim().toUpperCase());
              if (foundByCode) targetSession = foundByCode;
            }
          }
        }
      } catch (e) {
        // Raw string, use as phrase
        decodedPhrase = text;
      }

      // If still no target session, search active list
      if (!targetSession) {
        const matchingSess = activeSessions.find(s => s.verificationCode?.trim().toUpperCase() === decodedPhrase.trim().toUpperCase());
        if (matchingSess) {
          targetSession = matchingSess;
        }
      }

      if (!targetSession) {
        setErrorMsg(`Scanned text: "${decodedPhrase}" but matches no active class gate in your division.`);
        return;
      }

      setTypedVerificationPhrase(decodedPhrase);
      setSuccess(`Recognized QR: "${decodedPhrase}" for course ${targetSession.className}. Validating coordinates...`);
      setShowQRMode(false);
      
      // Auto check-in instantly
      await handleCheckIn(targetSession, decodedPhrase);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to process decoded QR code matrix.");
    }
  };

  // Academic Chatbot States
  const [chatMessage, setChatMessage] = useState("");
  const [chatLogs, setChatLogs] = useState<{ sender: "user" | "bot"; text: string; time: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Curriculum Interactive Quiz Active States
  const [activeVideoItem, setActiveVideoItem] = useState<CurriculumActivityItem | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<number, string>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const [success, setSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load roster targets
  const loadStudentData = async () => {
    try {
      const col = user.collegeCode || "DEFAULT";

      // 1. Fetch live active sessions gating for this student classes
      const sessionsQ = query(
        collection(db, "class_sessions"),
        where("collegeCode", "==", col),
        where("year", "==", user.year || "3rd Year"),
        where("department", "==", user.department || "Computer Engineering"),
        where("division", "==", user.division || "A")
      );
      const sessSnap = await getDocs(sessionsQ);
      const sessList: ClassSession[] = [];
      sessSnap.forEach((doc) => { sessList.push({ ...doc.data() as ClassSession, id: doc.id }); });
      setActiveSessions(sessList);

      // 2. Fetch past attendance logs of this student
      const pastQ = query(
        collection(db, "attendance"),
        where("collegeCode", "==", col),
        where("studentId", "==", user.userId)
      );
      const pastSnap = await getDocs(pastQ);
      const pastList: AttendanceRecord[] = [];
      pastSnap.forEach((doc) => { pastList.push(doc.data() as AttendanceRecord); });
      setPastAttendance(pastList);

      // 3. Fetch lessons
      const lessonsQ = query(
        collection(db, "curriculum_activities"),
        where("collegeCode", "==", col),
        where("year", "==", user.year || "3rd Year"),
        where("department", "==", user.department || "Computer Engineering"),
        where("division", "==", user.division || "A")
      );
      const lessonsSnap = await getDocs(lessonsQ);
      const lessonsList: CurriculumActivityItem[] = [];
      lessonsSnap.forEach((doc) => { lessonsList.push({ ...doc.data() as CurriculumActivityItem, id: doc.id }); });
      setLessons(lessonsList);

      // 4. Timetable details
      const tQ = query(
        collection(db, "timetable"),
        where("collegeCode", "==", col),
        where("year", "==", user.year || "3rd Year"),
        where("department", "==", user.department || "Computer Engineering"),
        where("division", "==", user.division || "A")
      );
      const tSnap = await getDocs(tQ);
      const tList: TimetableItem[] = [];
      tSnap.forEach((doc) => { tList.push(doc.data() as TimetableItem); });
      setTimetable(tList);

      // 5. University announcements
      const nQ = query(
        collection(db, "notices"),
        where("collegeCode", "==", col),
        where("year", "==", user.year || "3rd Year"),
        where("department", "==", user.department || "Computer Engineering"),
        where("division", "==", user.division || "A")
      );
      const nSnap = await getDocs(nQ);
      const nList: NoticeItem[] = [];
      nSnap.forEach((doc) => { nList.push(doc.data() as NoticeItem); });
      setNotices(nList);
    } catch (err) {
      console.error("Failed to load student profiles", err);
    }
  };

  useEffect(() => {
    loadStudentData();
    // Simulate initial location coordinates for student device mapping
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMyLat(pos.coords.latitude);
          setMyLng(pos.coords.longitude);
        },
        () => {
          // Default near St Francis
          setMyLat(19.22745);
          setMyLng(72.85695);
        }
      );
    }
  }, [activeTab]);

  // Execute Local GPS & Code Check-In
  const handleCheckIn = async (session: ClassSession, overridePhrase?: string) => {
    setSuccess(null);
    setErrorMsg(null);
    setCheckingIn(true);

    if (pastAttendance.some((p) => p.sessionId === session.id && p.status === "Present")) {
      setErrorMsg("You have already checked into this active lesson session.");
      setCheckingIn(false);
      return;
    }

    const testPhrase = overridePhrase || typedVerificationPhrase;

    try {
      // 1. Calculate GPS mapping displacement if browser coordinates are fetched
      let distanceMetres = 0;
      if (myLat !== null && myLng !== null) {
        distanceMetres = getDistance(myLat, myLng, session.latitude, session.longitude);
      } else {
        setErrorMsg("Your GPS signals aren't active yet. Entering the secret phrase below works as a fail-safe check.");
        setCheckingIn(false);
        return;
      }

      const withinGpsLimits = distanceMetres <= session.radius;
      const matchedPhrase = testPhrase.trim().toUpperCase() === session.verificationCode.trim().toUpperCase();

      if (!withinGpsLimits && !matchedPhrase) {
        setErrorMsg(
          `Displacement verification failed! You are ${Math.round(distanceMetres)} meters away from this classroom. ` +
          "Enter your professor's active verification phrase/QR text to authenticate."
        );
        setCheckingIn(false);
        return;
      }

      // 2. Validate, record in Firestore `/attendance` catalog index
      const markId = `attendance_${session.id}_${user.userId}`;
      const payload: AttendanceRecord = {
        id: markId,
        studentId: user.userId,
        studentName: user.name,
        sessionId: session.id,
        className: session.className,
        collegeCode: user.collegeCode || "DEFAULT",
        year: user.year || "3rd Year",
        department: user.department || "Computer Engineering",
        division: user.division || "A",
        status: "Present",
        timestamp: new Date().toISOString(),
        verifiedByGps: withinGpsLimits,
        verifiedByPhrase: matchedPhrase,
        distanceDisplacement: Math.round(distanceMetres)
      };

      await setDoc(doc(db, "attendance", markId), payload);
      setSuccess(`Checked in! Attendance successfully verified for ${session.className}.`);
      setTypedVerificationPhrase("");
      await loadStudentData();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `attendance`);
    } finally {
      setCheckingIn(false);
    }
  };

  // Chatbot send request proxying endpoint
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage || chatLoading) return;

    const userText = chatMessage.trim();
    setChatMessage("");
    const newLogs = [...chatLogs, { sender: "user" as const, text: userText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    setChatLogs(newLogs);
    setChatLoading(true);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText })
      });
      const data = await response.json();
      if (response.ok) {
        setChatLogs([...newLogs, { 
          sender: "bot", 
          text: data.reply, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }]);
      } else {
        setChatLogs([...newLogs, { 
          sender: "bot", 
          text: `Error: ${data.error || "Failed to parse API output."}`, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }]);
      }
    } catch (err) {
      console.error(err);
      setChatLogs([...newLogs, { 
        sender: "bot", 
        text: "Sorry, I am offline because local server endpoints took too long to respond. Ensure your API keys are active in the Secrets menu.", 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Handle Curriculum answer selection
  const handleSelectAnswer = (qIndex: number, choice: string) => {
    setSelectedQuizAnswers(prev => ({ ...prev, [qIndex]: choice }));
  };

  // Student submits the curriculum MCQs
  const handleSubmitCurriculumQuiz = async () => {
    if (!activeVideoItem) return;

    let score = 0;
    activeVideoItem.quiz.forEach((q, idx) => {
      if (selectedQuizAnswers[idx] === q.answer) {
        score++;
      }
    });

    setQuizScore(score);
    setSuccess(`Interactive lesson complete! Assessment score: ${score}/5 questions answered correctly.`);

    // If passed (e.g. score >= 3), automatically designate them Present for the Curriculum activities session records!
    if (score >= 3) {
      try {
        const markId = `curriculum_attendance_${activeVideoItem.id}_${user.userId}`;
        const payload: AttendanceRecord = {
          id: markId,
          studentId: user.userId,
          studentName: user.name,
          sessionId: activeVideoItem.id, // Maps curriculum activity id
          className: `Curriculum: ${activeVideoItem.topic}`,
          collegeCode: user.collegeCode || "DEFAULT",
          year: user.year || "3rd Year",
          department: user.department || "Computer Engineering",
          division: user.division || "A",
          status: "Present",
          timestamp: new Date().toISOString(),
          curriculumScore: score
        };

        await setDoc(doc(db, "attendance", markId), payload);
        await loadStudentData();
      } catch (err) {
        console.error("Curriculum attendance mark write failed", err);
      }
    }
  };

  const handleResetQuiz = () => {
    setCurrentQuizIndex(0);
    setSelectedQuizAnswers({});
    setQuizScore(null);
  };

  // Dynamic visual charts tracking attendance proportions
  const totalLecturesCount = Math.max(activeSessions.length + pastAttendance.filter(p => !p.id.startsWith("curriculum_")).length, 1);
  const presentLecturesCount = pastAttendance.filter(p => p.status === "Present" && !p.id.startsWith("curriculum_")).length;
  const attendanceRatio = Math.round((presentLecturesCount / totalLecturesCount) * 100);

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-8 font-sans" id="student-dashboard-view">
      {/* Visual greeting and stats dashboard layout */}
      <div className="grid md:grid-cols-12 gap-6">
        {/* Academic Premium Welcome Banner with Image Blend */}
        <div className="md:col-span-8 relative rounded-2xl overflow-hidden shadow-md border border-indigo-100/50 p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white min-h-[180px] flex flex-col justify-between">
          <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
            <img 
              src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1200&auto=format&fit=crop" 
              alt="University banner background" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          
          <div className="space-y-1.5 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[10px] font-mono text-indigo-200 font-bold border border-white/10 uppercase tracking-widest">
              🎓 Digital Student Pass
            </div>
            <h1 className="font-display font-extrabold text-2xl tracking-tight text-white mt-1">
              Hello, {user.name}
            </h1>
            <p className="text-xs text-indigo-100/90 leading-relaxed">
              Campus: <strong className="font-mono text-amber-300">{user.collegeCode}</strong> &bull; Class: <strong className="font-sans text-amber-300">{user.year} (Division {user.division}, {user.department})</strong>
            </p>
          </div>

          <div className="p-3.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl relative z-10 flex items-center justify-between mt-4">
            <div className="space-y-0.5">
              <span className="text-[9px] font-mono tracking-widest text-indigo-300 font-bold uppercase block">Classroom Geolocation Sync</span>
              <div className="text-xs font-sans font-bold flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {myLat !== null && myLng !== null ? "Secure GPS Location Service Locked" : "Calibrating safe satellite connection..."}
              </div>
            </div>
            <div className="text-[10px] text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg font-mono font-bold uppercase tracking-wider">
              PORTAL ENGAGED
            </div>
          </div>
        </div>

        {/* Circular score gauge */}
        <div className="md:col-span-4 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center space-y-2">
          <div className="relative flex items-center justify-center h-28 w-28">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="56" cy="56" r="48" className="stroke-slate-100 fill-none" strokeWidth="8" />
              <circle 
                cx="56" 
                cy="56" 
                r="48" 
                className="stroke-indigo-600 fill-none transition-all duration-500" 
                strokeWidth="8" 
                strokeDasharray="301.6" 
                strokeDashoffset={301.6 - (301.6 * (attendanceRatio || 0)) / 100} 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-display font-extrabold text-slate-800">{attendanceRatio || 0}%</span>
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Attendance</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Verified {presentLecturesCount} of {totalLecturesCount} live class sessions
          </div>
        </div>
      </div>

      {/* Roster state feedback alerts */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center justify-between" id="student-success">
          <p className="flex items-center gap-2 m-0 leading-relaxed">
            <Check className="h-4.5 w-4.5 text-emerald-600" />
            {success}
          </p>
          <button onClick={() => setSuccess(null)} className="text-xs font-bold text-emerald-600 hover:underline">Dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center justify-between" id="student-error">
          <p className="flex items-center gap-2 m-0 leading-relaxed">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
            {errorMsg}
          </p>
          <button onClick={() => setErrorMsg(null)} className="text-xs font-bold text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs list menu */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-6 sm:overflow-visible no-scrollbar" id="student-tabs">
        <button
          onClick={() => { setActiveTab("checkin"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "checkin" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <MapPin className="h-4.5 w-4.5" /> Check-In Gate
        </button>
        <button
          onClick={() => { setActiveTab("lessons"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "lessons" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <Tv className="h-4.5 w-4.5" /> Digital Curricula
        </button>
        <button
          onClick={() => { setActiveTab("chatbot"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "chatbot" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <MessageSquare className="h-4.5 w-4.5" /> Academic Chatbot
        </button>
        <button
          onClick={() => { setActiveTab("timetable"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "timetable" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <Calendar className="h-4.5 w-4.5" /> Schedule Timetable
        </button>
        <button
          onClick={() => { setActiveTab("notices"); setSuccess(null); }}
          className={`pb-4 text-sm font-semibold transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "notices" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-800"
          }`}
        >
          <Bell className="h-4.5 w-4.5" /> Campus Notices
        </button>
      </div>

      {activeTab === "checkin" && (
        <div className="space-y-6" id="student-checkin-tab">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="font-display font-bold text-slate-800 text-lg">Active Classrooms Gates</h3>
            {activeSessions.length > 0 && (
              <button
                onClick={() => {
                  setScanningTargetSession(null);
                  setShowQRMode(!showQRMode);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm border border-indigo-500 cursor-pointer transition-all duration-200"
              >
                <QrCode className="h-4 w-4" />
                <span>{showQRMode ? "Close QR Scanner" : "Scan Professor's QR"}</span>
              </button>
            )}
          </div>

          {/* QR Scan Console Block */}
          {showQRMode && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-150 shadow-md space-y-4 max-w-lg mx-auto"
              id="qr-scan-interactive-console"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-indigo-600 animate-pulse" />
                  <span className="font-display font-bold text-slate-800 text-sm">Attendance QR Scanner</span>
                </div>
                <button 
                  onClick={() => { setShowQRMode(false); setUseCamera(false); }}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Align your device camera with your course instructor's projected QR code on the lecture screen. Once recognized, classroom coordinates are automatically authenticated.
              </p>
              <div className="p-3.5 bg-indigo-50 border border-indigo-100/70 rounded-xl text-[11px] text-indigo-800 leading-relaxed font-sans">
                <strong>Iframe Preview Info:</strong> If you are running inside the sandbox preview layout, modern browsers may require camera hardware confirmation prompts. Click <strong>"Open in New Tab"</strong> at the top-right of your application border if your rear-facing camera stream is blocked!
              </div>

              <div className="flex" id="qr-scan-methods">
                <button
                  type="button"
                  onClick={() => setUseCamera(!useCamera)}
                  className={`w-full py-3.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${
                    useCamera 
                      ? "bg-rose-600 border-rose-500 text-white shadow-md hover:bg-rose-700"
                      : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700 shadow-sm"
                  }`}
                >
                  <Camera className="h-4.5 w-4.5" />
                  <span>{useCamera ? "Deactivate Camera Lens" : "Initiate Live Camera Scan"}</span>
                </button>
              </div>

              {/* Active webcam view finder */}
              {useCamera && (
                <div className="space-y-2">
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-900" id="camera-frame-box">
                    <div id="camera-scanner-view" className="absolute inset-0 w-full h-full" />
                    
                    {/* Reticle overlay to guide user */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 border-[3px] border-indigo-400 border-dashed rounded-2xl opacity-60 animate-pulse relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-600 -mt-1 -ml-1 rounded-tl-sm" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-600 -mt-1 -mr-1 rounded-tr-sm" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-600 -mb-1 -ml-1 rounded-bl-sm" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-600 -mb-1 -mr-1 rounded-br-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status bar */}
              <div className="text-[10px] font-mono font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50/50 p-2.5 border border-indigo-100/50 rounded-xl text-center">
                Status: {scanStatus}
              </div>
            </motion.div>
          )}

          {activeSessions.length === 0 ? (
            <div className="text-center bg-white p-12 rounded-2xl border border-slate-100/80 shadow-sm max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 bg-indigo-50/80 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                <School className="h-8 w-8 text-indigo-500" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-display font-bold text-slate-800 text-base">Classroom Gates Closed</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-sm mx-auto">
                  No classroom gates are currently active for your division. Wait for your professor to open attendance checks in the lecture hall.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {activeSessions.map((session) => {
                const attended = pastAttendance.some((p) => p.sessionId === session.id && p.status === "Present");
                return (
                  <div key={session.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-indigo-500 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded">
                          {session.sessionTime}
                        </span>
                        <h4 className="font-display font-extrabold text-lg text-slate-900 leading-snug">{session.className}</h4>
                        <p className="text-slate-500 text-xs">Faculty College: {session.collegeCode}</p>
                      </div>
                      
                      {attended ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 px-3 py-1 rounded-xl">
                          <Check className="h-4 w-4" /> Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100 px-3 py-1 rounded-xl">
                          Active Gate
                        </span>
                      )}
                    </div>

                    {!attended && (
                      <div className="space-y-4 pt-2 border-t border-slate-50" id={`checkin-form-${session.id}`}>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-mono tracking-wider text-slate-400 font-bold uppercase">Secret Verification Phrase</label>
                            <button
                              type="button"
                              onClick={() => {
                                setScanningTargetSession(session);
                                setShowQRMode(true);
                              }}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                              <span>Scan QR</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            value={typedVerificationPhrase}
                            onChange={(e) => setTypedVerificationPhrase(e.target.value)}
                            placeholder="Input QR verification code..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-indigo-500 uppercase font-mono font-medium"
                          />
                        </div>

                        <button
                          onClick={() => handleCheckIn(session)}
                          disabled={checkingIn}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl shadow-sm border border-indigo-500 text-sm flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                        >
                          {checkingIn ? (
                            <Loader className="h-4.5 w-4.5 animate-spin" />
                          ) : (
                            <>
                              <MapPin className="h-4.5 w-4.5" />
                              <span>Validate Coordinates & Check-In</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "lessons" && (
        <div className="grid md:grid-cols-12 gap-6" id="student-lessons-tab">
          {/* Lessons List panel */}
          <div className="md:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-slate-800 text-base">Digital Curriculum Modules</h3>
            <p className="text-slate-400 text-xs leading-relaxed">Watch lecture links and play assessments to log present marks directly in Firestore.</p>

            {lessons.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">No remote activities shared yet. Check back later.</div>
            ) : (
              <div className="space-y-3">
                {lessons.map((act) => {
                  const lessonAttended = pastAttendance.some((p) => p.sessionId === act.id && p.status === "Present");
                  return (
                    <div 
                      key={act.id}
                      onClick={() => {
                        setActiveVideoItem(act);
                        handleResetQuiz();
                      }}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition duration-150 ${
                        activeVideoItem?.id === act.id 
                          ? "bg-indigo-50/50 border-indigo-300" 
                          : "bg-white hover:bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="font-bold text-slate-800 text-sm">{act.topic}</div>
                      <div className="text-[10px] text-slate-400 mt-1 flex justify-between items-center">
                        <span className="font-mono text-indigo-500 uppercase font-black">Interactive Quiz</span>
                        {lessonAttended && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold border border-emerald-100">Verified</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Video Lesson & Interactive Quiz module */}
          <div className="md:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center" id="active-lesson-module">
            {activeVideoItem ? (
              <div className="space-y-6">
                <div>
                  <h4 className="font-display font-extrabold text-lg text-slate-900 leading-tight">
                    Lesson: {activeVideoItem.topic}
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold font-mono truncate">{activeVideoItem.youtubeUrl}</p>
                </div>

                {/* Youtube Video Embed Frame */}
                {getYouTubeId(activeVideoItem.youtubeUrl) ? (
                  <div className="w-full relative rounded-xl overflow-hidden aspect-video border border-slate-200">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${getYouTubeId(activeVideoItem.youtubeUrl)}`}
                      title="Curriculum Video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border rounded-xl text-center text-slate-400 text-xs">
                    Could not resolve a standard video ID. Launch video directly: <a href={activeVideoItem.youtubeUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">Link</a>
                  </div>
                )}

                {/* Interactive MCQs */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                    <BrainCircuit className="h-5 w-5 text-indigo-600" />
                    <span className="font-display font-bold text-slate-800 text-sm">Interactive Lesson Assessment</span>
                  </div>

                  {quizScore === null ? (
                    <div className="space-y-4" id="quiz-question-box">
                      <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-400">
                        <span>QUESTION {currentQuizIndex + 1} OF {activeVideoItem.quiz.length}</span>
                        <span>Pass Limit: 3/5 Correct</span>
                      </div>

                      <p className="font-bold text-sm text-slate-800 leading-relaxed">
                        {activeVideoItem.quiz[currentQuizIndex].question}
                      </p>

                      <div className="grid gap-2">
                        {activeVideoItem.quiz[currentQuizIndex].options.map((option, choiceIdx) => {
                          const optionSelector = String.fromCharCode(65 + choiceIdx); // A, B, C, D
                          return (
                            <button
                              key={choiceIdx}
                              onClick={() => handleSelectAnswer(currentQuizIndex, optionSelector)}
                              className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium transition ${
                                selectedQuizAnswers[currentQuizIndex] === optionSelector
                                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                                  : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                              }`}
                            >
                              <strong className="font-mono pr-1">{optionSelector}.</strong> {option}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <button
                          disabled={currentQuizIndex === 0}
                          onClick={() => setCurrentQuizIndex(prev => prev - 1)}
                          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Previous
                        </button>

                        {currentQuizIndex < activeVideoItem.quiz.length - 1 ? (
                          <button
                            disabled={!selectedQuizAnswers[currentQuizIndex]}
                            onClick={() => setCurrentQuizIndex(prev => prev + 1)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <span>Next Question</span>
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            disabled={Object.keys(selectedQuizAnswers).length < activeVideoItem.quiz.length}
                            onClick={handleSubmitCurriculumQuiz}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 font-bold text-white rounded-xl text-xs cursor-pointer shadow-sm disabled:opacity-50 border border-indigo-500"
                          >
                            Submit Assessment
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-4" id="quiz-result-score-box">
                      <div className="h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 font-black text-lg mx-auto">
                        {quizScore}/5
                      </div>
                      <h5 className="font-display font-extrabold text-slate-800 text-sm">
                        {quizScore >= 3 ? "🎉 Assessment Passed Successfully!" : "📚 We Recommend Reviewing the Video Lesson"}
                      </h5>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {quizScore >= 3 
                          ? "Your present attendance mark for this curriculum activity was successfully logged in Firestore databases!"
                          : "A passing score of 3 correct questions is required to unlock direct attendance marks."}
                      </p>
                      <button
                        onClick={handleResetQuiz}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
                      >
                        Reset quiz and retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-2">
                <Tv className="h-12 w-12 text-slate-300 mx-auto" />
                <h4 className="font-display font-semibold text-slate-700 text-sm">No Active Lesson Module Loaded</h4>
                <p className="text-slate-400 text-xs max-w-xs mx-auto text-center">
                  Select any curriculum activity on the left column list to load lessons and generated MCQs.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "chatbot" && (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[520px]" id="student-chatbot-tab">
          {/* Header */}
          <div className="p-4 bg-gradient-to-tr from-indigo-700 to-indigo-600 flex items-center justify-between text-white border-b border-indigo-500/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 backdrop-blur rounded-xl">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-sm leading-tight">Gemini Academic Chatbot</h4>
                <div className="text-[10px] text-indigo-200">Online &bull; Ask any educational question</div>
              </div>
            </div>
            <div className="text-[10px] bg-white/15 px-2.5 py-1.5 rounded-lg border border-white/10 font-bold uppercase tracking-wider font-mono">
              Powered by flash-3.5
            </div>
          </div>

          {/* Logs */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 no-scrollbar" id="chatlogs-container">
            {chatLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 py-12">
                <MessageSquare className="h-10 w-10 text-slate-200" />
                <h5 className="font-display font-bold text-slate-700 text-xs">Curriculum AI Assistant</h5>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Ask me anything about subjects, mathematical theories, algorithm details, or study techniques.
                </p>
              </div>
            ) : (
              chatLogs.map((log, index) => (
                <div key={index} className={`flex ${log.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                    log.sender === "user"
                      ? "bg-indigo-600 font-semibold text-white rounded-br-none"
                      : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/50"
                  }`}>
                    <p className="m-0 select-text whitespace-pre-line">{log.text}</p>
                    <span className="block text-[8px] text-right mt-1.5 uppercase font-mono opacity-60">{log.time}</span>
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-50 text-slate-600 rounded-2xl rounded-bl-none p-3.5 text-xs border border-slate-200/50 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Form write */}
          <form onSubmit={handleSendChat} className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Ask an academic query..."
              disabled={chatLoading}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatMessage}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl border border-indigo-500 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </form>
        </div>
      )}

      {activeTab === "timetable" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4" id="student-timetable-tab">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h3 className="font-display font-extrabold text-base text-slate-800">Your Assigned Schedule</h3>
          </div>

          {timetable.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">No scheduled activities mapping to your branch at this moment.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {timetable.map((t, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-[9px] bg-indigo-50 text-indigo-600 rounded px-2 py-0.5 font-bold uppercase tracking-wider font-mono">lecture</span>
                    <h5 className="font-bold text-sm text-slate-800 leading-snug">{t.subject}</h5>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-600 bg-white p-2 border border-slate-200/50 rounded-xl shadow-sm">
                    {t.time}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "notices" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4" id="student-notices-tab">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Bell className="h-5 w-5 text-indigo-600" />
            <h3 className="font-display font-extrabold text-base text-slate-800">University Broadcast Board</h3>
          </div>

          {notices.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs col-span-3">No active bulletin notices. Check back later.</div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto no-scrollbar">
              {notices.map((n, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative">
                  <p className="text-slate-800 text-xs leading-relaxed m-0">{n.message}</p>
                  <div className="text-[10px] text-slate-400 mt-2">
                    Broadcasted by Prof. {n.teacherName} &bull; {new Date(n.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
