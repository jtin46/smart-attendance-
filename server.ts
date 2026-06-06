import express from "express";
import "dotenv/config";import "dotenv/config";
import path from "path";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

// Lazy initialize Gemini Client to prevent crash if key is momentarily missing
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined in the environment.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// -------------------------------------------------------------
// LOCAL OFFLINE FALLBACK ENGINES
// -------------------------------------------------------------

// Custom fallback chatbot answers based on message contents
function getFallbackChatbotResponse(message: string): string {
  const msg = message.toLowerCase();
  
  if (msg.includes("hello") || msg.includes("hi") || msg.includes("hey")) {
    return "Hello! I am your Academic Assistant. I can help analyze educational concepts, clarify course requirements, or design customized mock practice quizzes for your subjects. \n\n*(Note: The system is currently running in Academic Offline Fallback Mode. To activate real-time Gemini AI, please configure a valid, non-leaked GEMINI_API_KEY in the Settings > Secrets menu)*";
  }
  
  if (msg.includes("attendance") || msg.includes("proxy") || msg.includes("qr code")) {
    return "Smart Attendance systems utilize localized geographical boundary validation (Geo-fencing) and synchronized dynamic QR codes. By capturing coordinates via the browser HTML5 Geolocation API, student verification is cross-referenced with the educator's active lecture coordinates. This eliminates virtual proxy check-ins and optimizes high-accuracy administrative logs.\n\n*(Note: This summary is served from our local knowledge base under Offline Fallback Mode.)*";
  }
  
  if (msg.includes("computer") || msg.includes("programming") || msg.includes("code") || msg.includes("software")) {
    return "Computer Engineering and computer science topics are centered around algorithms, data structures (like arrays, hash tables, and graphs), software design patterns, and systems engineering. Let me know if you would like me to generate a mock Quiz on programming languages or computer architectures under the Quiz Generator tab!\n\n*(Note: Serves under Offline Fallback Mode. Set a valid GEMINI_API_KEY in Settings > Secrets for Gemini AI integration.)*";
  }
  
  if (msg.includes("quiz") || msg.includes("test") || msg.includes("exam")) {
    return "You can generate custom MCQ practice quizzes on any college lecture topic. Simply switch to the Quiz Generator tab, enter a subject like 'Machine Learning' or 'Thermodynamics', and click 'Generate'. The system is fully equipped to serve practice questions offline or online.\n\n*(Note: Serves under Offline Fallback Mode.)*";
  }
  
  if (msg.includes("science") || msg.includes("physics") || msg.includes("math") || msg.includes("chemistry") || msg.includes("calculus") || msg.includes("algebra")) {
    return "Academic disciplines in mathematics and physical sciences form the foundation of modern engineering. For example, Linear Algebra drives deep neural networks, while multi-variable Calculus governs optimized trajectories in robotics and thermodynamics in mechanical designs.\n\n*(Note: Serves under Offline Fallback Mode. Add a fresh GEMINI_API_KEY to activate full AI assistance.)*";
  }
  
  return `That's an excellent academic choice! Here is a high-level scholarly summary of "${message}":\n\n1. **Core Concept**: Subject-matter understanding requires systematic review, definitions of key variables, and rigorous continuous assessment.\n2. **Engineering/Scientific Perspective**: Complex systems are best parsed by decomposing large concepts into clear modular sub-components.\n3. **Self-Assessment**: You can practice your comprehension of this subject by using our custom MCQ generator in the Quiz Generator tab.\n\n*(Note: The system is currently running in Academic Offline Fallback Mode because your environment's Gemini API key is inactive or reported as leaked. To enable unlimited real-time responses, please attach a valid key in the Settings > Secrets panel.)*`;
}

// Custom mock quiz questions for various topics
function getFallbackQuiz(topic: string) {
  const t = topic.toLowerCase();
  
  // 1. AI & Machine Learning
  if (t.includes("machine learning") || t.includes("ai") || t.includes("data science") || t.includes("neural") || t.includes("deep learning") || t.includes("aids") || t.includes("classification")) {
    return [
      {
        question: "Which of the following describes the 'overfitting' phenomenon in Machine Learning?",
        options: [
          "The model fails to map patterns on the training data.",
          "The model performs exceptionally well on training data but poorly on unseen test data.",
          "The model is too simple to capture any significant mathematical relations.",
          "The training dataset is too small to construct a neural node."
        ],
        answer: "B"
      },
      {
        question: "In neural networks, what is the primary role of an Activation Function?",
        options: [
          "To compute the loss derivative during backward propagation.",
          "To introduce non-linearity into the network, enabling it to learn complex patterns.",
          "To scale database credentials securely on the local environment.",
          "To delete unimportant weight vectors from CPU memory cache."
        ],
        answer: "B"
      },
      {
        question: "Which machine learning paradigm involves training an agent using rewards and trial-and-error?",
        options: [
          "Supervised Learning",
          "Unsupervised Learning",
          "Reinforcement Learning",
          "Semi-Supervised Learning"
        ],
        answer: "C"
      },
      {
        question: "What does 'Gradient Descent' help optimize during deep training cycles?",
        options: [
          "The network's learning rate parameters",
          "The physical clock speed of the hosting GPU unit",
          "The loss function objective, by adjusting weights in direction of steepest decrease",
          "The network's standard input file path length limit"
        ],
        answer: "C"
      },
      {
        question: "Which of the following is considered an Unsupervised Learning task?",
        options: [
          "Spam email category classification",
          "Real-estate value prediction",
          "Customer segmentation clustering",
          "Clinical scan tumor edge detection"
        ],
        answer: "C"
      }
    ];
  }
  
  // 2. Databases & Systems
  if (t.includes("database") || t.includes("sql") || t.includes("postgres") || t.includes("firestore") || t.includes("query")) {
    return [
      {
        question: "What does the 'C' in ACID transaction properties stand for?",
        options: [
          "Concurrency",
          "Consistency",
          "Compilation",
          "Categorization"
        ],
        answer: "B"
      },
      {
        question: "Which SQL clause is used to filter group results after aggregation has been performed?",
        options: [
          "WHERE",
          "HAVING",
          "GROUP BY",
          "ORDER BY"
        ],
        answer: "B"
      },
      {
        question: "What is a 'Primary Key' in a relational database management system?",
        options: [
          "A key used exclusively to encrypt confidential columns in a table.",
          "A set of one or more fields that uniquely identifies each record in a table.",
          "A backup file generator used during severe server failures.",
          "A special admin key used to drop databases without validation."
        ],
        answer: "B"
      },
      {
        question: "What is the main difference between SQL and NoSQL databases?",
        options: [
          "SQL databases cannot run on standard cloud servers.",
          "SQL databases are typically relational and schema-driven, while NoSQL are non-relational and flexible.",
          "NoSQL databases completely prohibit data queries.",
          "SQL databases do not support integer values."
        ],
        answer: "B"
      },
      {
        question: "In a relational schema, what does a 'Foreign Key' establish?",
        options: [
          "A security firewall against foreign IP addresses.",
          "A structural relationship linking columns of two separate tables.",
          "A mechanism to delete indices during runtime compilation.",
          "An external import path for third-party libraries."
        ],
        answer: "B"
      }
    ];
  }

  // 3. Web Technologies
  if (t.includes("web") || t.includes("react") || t.includes("javascript") || t.includes("html") || t.includes("css") || t.includes("programming")) {
    return [
      {
        question: "What is the primary benefit of React's Virtual DOM?",
        options: [
          "It connects the application to a local SQLite database automatically.",
          "It minimizes direct manipulation of the heavy real DOM to optimize render performance.",
          "It bypasses security check-ins on browser sandboxes.",
          "It translates CSS variables to WebGL coordinates on mobile devices."
        ],
        answer: "B"
      },
      {
        question: "In Javascript, what describes a 'Closure'?",
        options: [
          "A method that stops program execution and closes the tab.",
          "The combination of a function bundled together with references to its surrounding state (lexical environment).",
          "A command used to free RAM garbage collector queues manually.",
          "The last statement in a standard Switch execution block."
        ],
        answer: "B"
      },
      {
        question: "Which HTTP status code is returned for a successfully created resource on a server?",
        options: [
          "200 OK",
          "201 Created",
          "400 Bad Request",
          "404 Not Found"
        ],
        answer: "B"
      },
      {
        question: "What is the main purpose of the 'useEffect' Hook in React?",
        options: [
          "To compile physical CSS stylesheets into base64 blobs.",
          "To perform side-effects in functional components (e.g., data fetching, subscriptions).",
          "To securely hash user passwords prior to transit.",
          "To trigger browser alert dialogues during state modifications."
        ],
        answer: "B"
      },
      {
        question: "Which of the following is NOT a valid value for the CSS 'position' property?",
        options: [
          "absolute",
          "relative",
          "inside",
          "sticky"
        ],
        answer: "C"
      }
    ];
  }

  // Generic customized fallback
  const capitalizedTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
  return [
    {
      question: `Which of the following best describes the core academic foundation of ${capitalizedTopic}?`,
      options: [
        `It represents a systematic, logical approach to understanding the mechanics of ${capitalizedTopic}.`,
        `It is purely a secondary software helper with no practical scientific application.`,
        `It relates strictly to ancient pre-industrial manufacturing systems in Europe.`,
        `It is a transient data schema that cannot be used in actual engineering architectures.`
      ],
      answer: "A"
    },
    {
      question: `What is a primary challenge frequently faced by researchers in ${capitalizedTopic}?`,
      options: [
        "Sufficient documentation and standardized protocols on browser platforms",
        `Managing high complexity and ensuring reliable parameters in practical applications of ${capitalizedTopic}`,
        "Finding databases that fully support integer value storage",
        "Preventing the system from compiling scripts automatically"
      ],
      answer: "B"
    },
    {
      question: `In modern engineering practice, how is ${capitalizedTopic} most effectively utilized?`,
      options: [
        "By replacing all hardware logic with simple static image placeholders.",
        `By integrating structured methodologies and continuous testing to optimize the output of ${capitalizedTopic}.`,
        "By ignoring error callbacks and leaving system terminals idle.",
        "By compiling all program structures with legacy scripting frameworks."
      ],
      answer: "B"
    },
    {
      question: `Which parameter is most vital to monitor when analyzing the performance of ${capitalizedTopic}?`,
      options: [
        "The background canvas margin spacing measurements",
        `Component structural alignment and data processing accuracy of ${capitalizedTopic} variables`,
        "The number of standard comment lines compiled on the server",
        "The physical screen dimming percentage rate"
      ],
      answer: "B"
    },
    {
      question: `How does continuous education benefit student mastery of ${capitalizedTopic}?`,
      options: [
        "It eliminates the need to complete homework tasks.",
        `On-going review reinforces key concepts, validates practical code solutions, and builds confidence in ${capitalizedTopic}.`,
        "It locks the academic account until an admin resets the environment database.",
        "It forces the browser to run in full-screen orientation only."
      ],
      answer: "B"
    }
  ];
}

// -------------------------------------------------------------
// AI ENDPOINTS
// -------------------------------------------------------------

// Academic Chatbot endpoint powered by Google Gemini (with smart offline fallback)
app.post("/api/chatbot", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Please provide a message." });
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = 
      "You are a helpful and harmless academic assistant for college students. " +
      "Your purpose is to provide information related to educational topics only. " +
      "You must strictly refuse to answer any questions or engage in conversations about inappropriate, adult, harmful, illegal, or non-academic topics. " +
      "If a user asks about such a topic, you must politely decline and state that you can only assist with academic or educational content.";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || "I was unable to synthesize a helpful response at this moment.";
    res.json({ reply });
  } catch (error: any) {
    console.log("Academic chatbot fallback protocol initiated (Gemini model offline or inactive).");
    const fallbackReply = getFallbackChatbotResponse(message);
    res.json({ reply: fallbackReply });
  }
});

// MCQ Quiz generation endpoint powered by Google Gemini (with smart offline fallback)
app.post("/api/quiz/generate", async (req, res) => {
  const { topic } = req.body;
  if (!topic) {
    return res.status(400).json({ error: "Topic is required to generate a quiz." });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `Create exactly 5 comprehensive multiple-choice educational quiz questions with 4 logical option answers each for the topic: "${topic}". Make sure one of the options is correct and identified by its key.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert curriculum quiz generator. You must generate high-quality conceptual MCQs mapped strictly to the requested schema. Return only a clean JSON array.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of multiple choice quiz questions.",
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "The conceptual multiple choice question." },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of exactly 4 choices (e.g. ['Paris', 'London', 'Berlin', 'Rome'] in A, B, C, D order)."
              },
              answer: { 
                type: Type.STRING, 
                description: "The correct option selector. Strictly and exactly one of: 'A', 'B', 'C', or 'D'." 
              }
            },
            required: ["question", "options", "answer"]
          }
        }
      }
    });

    const replyText = response.text;
    if (!replyText) {
      throw new Error("Empty response from AI engine.");
    }

    const quizData = JSON.parse(replyText);
    res.json(quizData);
  } catch (error: any) {
    console.log("Practice quiz fallback generator initiated (Gemini model offline or inactive).");
    const fallbackQuiz = getFallbackQuiz(topic);
    res.json(fallbackQuiz);
  }
});

// Baseline healthcheck API
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/healthz", (req, res) => {
  res.json({ status: "healthy" });
});

// Configure Vite integration or static document server
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting full-stack integration in DEVELOPMENT mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting full-stack integration in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Attendance Server listening at http://0.0.0.0:${PORT}`);
  });
}

initServer().catch((error) => {
  console.error("Server bootstrapping crashed:", error);
});
