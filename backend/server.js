// backend/server.js  (ESM-compatible)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { exec } from 'child_process';

// Resolve __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * If your frontend is deployed separately, you can omit the static-serving bits.
 * If you prefer to serve frontend from the backend (single service), make sure
 * frontend/dist exists (built) and the path below is correct.
 */
const FRONTEND_DIST = path.join(__dirname, '../frontend/dist');

// allow large request bodies if needed (multipart/form-data usually handled by multer)
app.use(express.json({ limit: '10mb' }));

// enable CORS for your frontend domain (change as needed)
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || '*' // set FRONTEND_ORIGIN env var in Render to tighten
  })
);

// serve frontend static assets if present
app.use(express.static(FRONTEND_DIST));

// health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'Backend running', time: new Date().toISOString() });
});

// example transcribe endpoint (adjust to your implementation)
app.post('/api/transcribe', (req, res) => {
  // If you expect file uploads with multer, use multer middleware instead and get file.path here
  // For demo, we'll call transcribe.py without args.
  // Preferred: call the python venv interpreter for guaranteed env
  const venvPython = path.join(__dirname, 'whisper', 'venv', 'bin', 'python3');
  const py = venvPython; // fall back to 'python3' if venv missing
  const pyExe = (awaitsExist(venvPython) ? venvPython : 'python3');
  // Use full path to your script
  const script = path.join(__dirname, 'whisper', 'transcribe.py');

  const cmd = `"${pyExe}" "${script}"`; // add args if required
  exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
    if (err) {
      console.error('transcribe error:', stderr || err);
      return res.status(500).json({ error: stderr || String(err) });
    }
    return res.json({ result: stdout });
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'), err => {
    if (err) {
      res.status(404).send('Not Found');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

/**
 * Helper: check file existence (async)
 * Note: minimal implementation using fs.promises
 */
import fs from 'fs';
async function awaitsExist(p) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}
