const express = require("express");
const path = require("path");
const cors = require("cors");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 5000;

// CORS for your frontend (important!)
app.use(cors({
  origin: "https://transcript-frontend.onrender.com"
}));

// Serve React build (optional — if you decide to merge frontend + backend later)
const FRONTEND_DIST = path.join(__dirname, "../frontend/dist");
app.use(express.static(FRONTEND_DIST));

// ✅ Health check route
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "Backend running", time: new Date().toISOString() });
});

// Example API (if you use Whisper transcription)
app.post("/api/transcribe", (req, res) => {
  const script = path.join(__dirname, "whisper", "transcribe.py");
  exec(`python3 ${script}`, (err, stdout, stderr) => {
    if (err) {
      console.error("Transcription failed:", stderr);
      return res.status(500).json({ error: "Transcription failed" });
    }
    res.json({ transcript: stdout.trim() });
  });
});

// SPA fallback for frontend
app.get("*", (req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
