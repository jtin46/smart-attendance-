export type UserRole = "admin" | "teacher" | "student";

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  collegeCode?: string;
  year?: string;
  department?: string;
  division?: string;
}

export interface College {
  id: string; // matches document ID or manual ID
  name: string;
  code: string;
}

export interface ClassSession {
  id: string;
  className: string;
  sessionTime: string;
  collegeCode: string;
  year: string;
  department: string;
  division: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  createdAt: string;
  durationSeconds: number; // class duration e.g. 3600 for 1 hour
  verificationCode?: string; // fallback QR code match word
  isActive?: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  className: string;
  collegeCode: string;
  year: string;
  department: string;
  division: string;
  status: "Present" | "Absent";
  timestamp: string;
  verifiedByGps?: boolean;
  verifiedByPhrase?: boolean;
  distanceDisplacement?: number;
  curriculumScore?: number;
}

export interface NoticeItem {
  id: string;
  teacherId: string;
  teacherName: string;
  message: string;
  collegeCode: string;
  year?: string;
  department?: string;
  division?: string;
  createdAt: string; // date ISO string
}

export interface TimetableItem {
  id: string;
  subject: string;
  time: string;
  collegeCode: string;
  year: string;
  department: string;
  division: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string; // "A", "B", "C", "D"
}

export interface CurriculumActivityItem {
  id: string;
  teacherId: string;
  youtubeUrl: string;
  topic: string;
  collegeCode: string;
  year: string;
  department: string;
  division: string;
  createdAt: string;
  quiz: QuizQuestion[];
}

export interface CurriculumAttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  activityId: string;
  topic: string;
  collegeCode: string;
  year: string;
  department: string;
  division: string;
  quizScore: number; // percent e.g. 80
  completedAt: string;
  status: "Completed";
}

export interface SupportRequest {
  id: string; // Document ID
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  category: string;
  message: string;
  createdAt: string;
  status: "open" | "closed";
}

