# Smart Attendance with Curriculum Integration 🎓

A modern, full-stack, enterprise-grade classroom attendance management portal built with **React**, **Express**, **Vite**, **Firebase Firestore**, and the **Gemini AI Developer SDK (@google/genai)**.

The application allows academic administrators, faculty members, and students to coordinate class sessions, verify attendance through dynamically changing geolocated QR codes, access shared curriculum materials, publish announcements, and get academic advice from an integrated AI Tutor.

---

## 🚀 Quick Start Guide (Local Execution)

Follow these steps to run the application on your local development machine.

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18 or higher recommended) and `npm` installed.

### 2. Install Dependencies
In your terminal, navigate to the project directory and run:
```bash
npm install
```

#### ⚠️ Troubleshooting `approve-scripts / allow-scripts` Warning
If you see warnings like:
> `npm warn allow-scripts 1 package has install scripts not yet covered by allowScripts`

And calling `npm approve-scripts --allow-scripts-pending` prints:
> `Run npm approve-scripts <pkg> to allow, or npm deny-scripts <pkg> to deny`

This happens because your local system (or global npm configuration) has security restrictions on automatic lifecycle hook execution (post-install scripts). You can resolve this by approving the dependencies individually:

```bash
# Approve each package with install scripts
npm approve-scripts @firebase/util
npm approve-scripts @google/genai
npm approve-scripts esbuild
npm approve-scripts protobufjs
```
Alternatively, to bypass this check entirely on your safe local folder, you can run:
```bash
npm install --ignore-scripts
# Or disable the script blocker for this installation
```

---

### 3. Setup Environment Variables
Create a `.env` file in the root directory based on `.env.example`:

```env
# Secure Gemini Access Token for AI Chatbot
GEMINI_API_KEY="your_actual_gemini_api_key_here"

# Base URL of your local server
APP_URL="http://localhost:3000"
```

---

### 4. Running the Development Server
Launch the full-stack server using our bundled compiler state:
```bash
npm run dev
```
The application will boot on **`http://localhost:3000`** (Express backend and Vite HMR middleware unified on a single port).

---

### 5. Production Build & Execution
To build and run the application in production mode:

```bash
# Compile client-side resources and generate single-file self-contained server Bundle
npm run build

# Start the Node.js production server
npm run start
```

---

## 🛠️ Project Architecture & Key Features

### 🌟 Key Roles & Modules

1. **Admin Portal** 🛡️
   * Register new branches, courses, and department divisions.
   * Manage users (faculties, teachers, and students) securely.
   * Handle active support tickets with visual counters and response editors.

2. **Teacher Workspace** 🏫
   * Launch geolocated, real-time classroom lecture attendance sessions with auto-refreshing QR codes.
   * View live student check-ins in the dynamic grids.
   * Manually override or update student present/absent status.
   * Publish lecture schedules, notify through the university notice board, and distribute interactive video curricula.
   * Generate and export structured attendance CSV reports.

3. **Student Portal** 🎓
   * Scan dynamic, changing session QR codes (uses browser camera/scanner API).
   * Verifies high-precision GPS georouting match against the teacher's designated classroom lock position.
   * View current term dashboards, circular score logs, and lesson modules.
   * Access interactive YouTube video classes with direct MCQ quizzes to register class credits.
   * Integrated high-speed **Gemini Academic Chatbot** facilitating tutor guidance.

---

## 📂 Directory Structure

```text
├── src/
│   ├── components/            # Portal workspaces
│   │   ├── AdminDashboard.tsx # Administrators panel
│   │   ├── TeacherDashboard.tsx # Academic management interface
│   │   └── StudentDashboard.tsx # Attendance check-ins & digital curricula
│   ├── App.tsx                # Context router, theme definitions, & state managers
│   ├── main.tsx               # Client bootstrap entrypoint
│   └── index.css              # Custom Tailwind configuration & font pairing
├── server.ts                  # Pure Node.js Express server with Vite orchestration middleware
├── package.json               # Modular script handlers & package allocations
├── .env.example               # Configurable parameter templates
└── firestore.rules            # Firestore security schemas
```

---

## 🔐 Database Configurations
The data uses **Firebase Firestore**. A template of the blueprint is located in `firebase-blueprint.json`. In production, securely configure Firestore to match permission queries inside `firestore.rules`.
