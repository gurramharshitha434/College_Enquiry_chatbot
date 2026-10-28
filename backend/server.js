const { loadEnv } = require("./loadEnv");
const envInfo = loadEnv();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { supabase } = require("./supabase");

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
  : null;

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, postman) or same-origin
    if (!origin) return callback(null, true);
    if (allowedOrigins) {
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS policy does not allow access from this origin."));
    }
    // Allow local development ports by default (e.g. Live Server on 5500, Vite on 5173, etc.)
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-8", legacyHeaders: false }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "CampusConnect API",
    databaseConfigured: Boolean(supabase),
    envLoaded: envInfo.loaded,
    envFile: envInfo.path ? path.basename(envInfo.path) : null
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    ok: true,
    service: "CampusConnect API",
    databaseConfigured: Boolean(supabase),
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || null,
    environment: process.env.NODE_ENV || "development"
  });
});

const FAQ = [
  { keys: ["admission", "apply", "application", "eligibility", "documents", "join"], answer: "A typical admission process is: check the college's official eligibility criteria, complete the application, upload or submit the required documents, and follow the official selection and fee-payment instructions. Exact dates and requirements depend on your college, so confirm them with the admissions office." },
  { keys: ["course", "branch", "programme", "program", "engineering", "degree"], answer: "Common B.Tech options can include Computer Science and Engineering, Information Technology, Electronics and Communication Engineering, Electrical and Electronics Engineering, Mechanical Engineering, and Civil Engineering. The actual programmes offered vary by college. Check your college's official course list before applying." },
  { keys: ["fee", "fees", "tuition", "cost", "scholarship", "financial", "payment"], answer: "Fees vary by programme, category, and academic year. Scholarships may be offered through government schemes, merit, or college support, subject to eligibility. Please check the latest official fee circular and scholarship portal; this demo does not contain verified college-specific amounts." },
  { keys: ["campus", "facility", "facilities", "library", "hostel", "lab", "laboratory", "sports", "transport", "canteen"], answer: "Common campus facilities may include libraries, computer and engineering labs, Wi-Fi, sports areas, hostels, transport, and a canteen. Facilities differ between institutions, so confirm availability with your college." },
  { keys: ["contact", "phone", "email", "office", "address", "reach"], answer: "Please use the college's official website to find verified contact details for its admissions office. You can also submit an enquiry using the form on this page." },
  { keys: ["hello", "hi", "hey", "good morning"], answer: "Hello! 👋 I can help with general questions about admissions, courses, fees and scholarships, and campus facilities. What would you like to know?" },
  { keys: ["thank"], answer: "You're welcome! 😊 If you have another question, feel free to ask." }
];

function answerQuestion(question) {
  const normalized = question.toLowerCase();
  const match = FAQ.find(item => item.keys.some(key => normalized.includes(key)));
  return match ? match.answer : "I don't have a specific answer for that yet. Try asking about admissions, courses, fees and scholarships, or campus facilities. For official dates, prices, and eligibility rules, contact your college directly.";
}

app.post("/api/chat", (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!question || question.length > 500) {
    return res.status(400).json({ error: "Enter a question between 1 and 500 characters." });
  }
  return res.json({ answer: answerQuestion(question), source: "built-in-faq" });
});

app.post("/api/enquiries", async (req, res, next) => {
  try {
    const { name, email, phone = "", category, message } = req.body || {};
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (typeof phone !== "string" || phone.length > 20) return res.status(400).json({ error: "Phone number must be 20 characters or fewer." });
    const allowed = ["Admissions", "Courses", "Fees & Scholarships", "Campus Facilities", "Other"];
    if (!allowed.includes(category)) return res.status(400).json({ error: "Choose a valid enquiry topic." });
    if (typeof message !== "string" || message.trim().length < 5 || message.trim().length > 2000) {
      return res.status(400).json({ error: "Question must be between 5 and 2000 characters." });
    }
    if (!supabase) {
      return res.status(503).json({
        error: "Database is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env, then restart the server."
      });
    }

    const { data, error } = await supabase.from("enquiries").insert({
      name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || null,
      category, message: message.trim(), status: "new"
    }).select("id, created_at").single();

    if (error) {
      console.error("Supabase insert failed:", error.message || error.code || error);
      return res.status(500).json({
        error: error.message && error.message.includes("fetch failed")
          ? "Database connection failed (network fetch failed). Please verify your internet connection and Supabase URL/keys."
          : `We could not save your enquiry: ${error.message || "database error"}`
      });
    }
    return res.status(201).json({ message: "Enquiry submitted", enquiry: data });
  } catch (error) {
    if (error && error.message && error.message.includes("fetch failed")) {
      return res.status(500).json({
        error: "Database connection failed (network fetch failed). Please verify your internet connection and Supabase URL/keys."
      });
    }
    next(error);
  }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));

app.use((err, _req, res, _next) => {
  console.error("Request failed:", err.message);
  if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "Invalid JSON request body." });
  return res.status(500).json({ error: err.message || "An unexpected server error occurred." });
});

if (require.main === module) {
  const server = app.listen(port, () => {
    console.log(`\n========================================`);
    console.log(` CampusConnect server is running!`);
    console.log(` URL: http://localhost:${port}`);
    console.log(` .env file: ${envInfo.path || "None detected (using process environment)"}`);
    console.log(` Database configured: ${supabase ? "YES" : "NO (check .env)"}`);
    console.log(`========================================\n`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ ERROR: Port ${port} is already in use by an old Node process!`);
      console.error(`Run this command in PowerShell to stop it:`);
      console.error(`  taskkill /F /IM node.exe`);
      console.error(`Then start the server again.\n`);
    } else {
      console.error("Server error:", err);
    }
  });
}

module.exports = { app };

