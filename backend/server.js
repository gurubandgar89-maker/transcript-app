// backend/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { execFile } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// FRONTEND DIST (optional — only if you built frontend into ../frontend/dist)
const FRONTEND_DIST = path.join(__dirname, "../frontend/dist");

// Ensure uploads dir exists
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer setup: store uploads in backend/uploads with original filename (safe enough)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ts = Date.now();
    // keep extension
    const ext = path.extname(file.originalname) || "";
    cb(null, `upload-${ts}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB limit

// JSON parsing (if needed)
app.use(express.json({ limit: "10mb" }));

// CORS: tighten by setting FRONTEND_ORIGIN env var, otherwise allow all (dev)
const frontOrigin = process.env.FRONTEND_ORIGIN || "*";
app.use(cors({ origin: frontOrigin }));

// Serve frontend static files if dist exists
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  console.log("Serving frontend from:", FRONTEND_DIST);
} else {
  console.log("No frontend dist found at:", FRONTEND_DIST);
}

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "Backend running", time: new Date().toISOString() });
});

// Transcribe endpoint — accepts a single file under field 'file'
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (use field name 'file')" });
    }

    const uploadedPath = req.file.path;
    console.log("Received file:", uploadedPath);

    // prefer venv python if available
    const venvPython = path.join(__dirname, "whisper", "venv", "bin", "python3");
    const pyCmd = fs.existsSync(venvPython) ? venvPython : "python3";

    // path to your transcribe.py (adjust if script location differs)
    const scriptPath = path.join(__dirname, "whisper", "transcribe.py");
    if (!fs.existsSync(scriptPath)) {
      console.error("transcribe.py not found at", scriptPath);
      return res.status(500).json({ error: "Transcribe script not found on server" });
    }

    // Call python script with the uploaded file path as an argument (adjust transcribe.py to accept args)
    // execFile is safer than exec for passing args
    execFile(pyCmd, [scriptPath, uploadedPath], { maxBuffer: 1024 * 1024 * 200 }, (err, stdout, stderr) => {
      // Cleanup uploaded file (optional)
      try { fs.unlinkSync(uploadedPath); } catch (e) {}

      if (err) {
        console.error("Python error:", err, stderr);
        return res.status(500).json({ error: stderr || String(err) });
      }

      // stdout expected to contain transcription text — adapt to your script's output format
      console.log("Transcription output:", stdout.slice(0, 200));
      return res.json({ transcript: stdout.trim() });
    });
  } catch (e) {
    console.error("Transcribe handler failed:", e);
    return res.status(500).json({ error: String(e) });
  }
});

// SPA fallback: use '/*' instead of '*' to avoid path-to-regexp error
app.get("/*", (req, res) => {
  const indexPath = path.join(FRONTEND_DIST, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Not Found");
  }
});

// Start
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log("FRONTEND_ORIGIN:", frontOrigin);
});
