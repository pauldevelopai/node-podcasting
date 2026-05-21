/**
 * Podcast Studio — the Node's entry point.
 *
 * createServer gives us the GROUNDED chrome, telemetry, feedback, and the
 * auto-mounted welcome routes (getSetupStatus, postSetup, getActivity). The
 * voice/podcast/key routes below aren't in the standard set, so we capture the
 * returned Express app and wire them by hand.
 */

import "dotenv/config";
import { createLiteHost, createServer } from "@developai/grounded-node-runtime";
import * as handlers from "./lib/handlers.js";
import multer from "multer"; // transitive dep via the runtime
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

const SLUG = "podcasting";
const DISPLAY_NAME = "Podcast Studio";

// GROUNDED telemetry collector (a Cloudflare Worker that relays into Airtable).
// PUBLIC, low-value values committed here so every install reports its usage
// automatically over HTTP — no fork, no GitHub login, no git push. Fill these in
// after deploying collector/ in the grounded repo. Empty = telemetry off (the
// app works fine, it just won't report). A real .env value takes precedence.
process.env.GROUNDED_TELEMETRY_URL ||= "";   // e.g. "https://grounded-telemetry.<sub>.workers.dev"
process.env.GROUNDED_TELEMETRY_TOKEN ||= ""; // the INBOUND_TOKEN set on the Worker

const host = createLiteHost({
  appSlug: SLUG,
  nodeVersion: pkg.version,
  newsroom: process.env.NEWSROOM || "Explain",
});

const app = createServer({
  slug: SLUG,
  host,
  handlers,
  displayName: DISPLAY_NAME,
  nodeVersion: pkg.version,
  uploadLimitMb: 50,
});

// Voice training can be several clips of a few MB each. Our own multer instance
// (the built-in uploadLimitMb only governs the unused /api/ingest route).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 25 },
});
const toFiles = req => (req.files || []).map(f => ({ buffer: f.buffer, originalname: f.originalname }));
const parseSettings = req => {
  const raw = req.body && req.body.voice_settings;
  if (!raw) return undefined;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return undefined; }
};

// ── Voices ──────────────────────────────────────────────────────────────────
app.get("/api/voices", async (_req, res) => {
  try { res.json(await handlers.listVoices(host)); }
  catch (e) { fail(res, 500, e); }
});

app.post("/api/voices", upload.array("samples", 25), async (req, res) => {
  try {
    const files = toFiles(req);
    if (!files.length) throw new Error("Choose at least one audio sample to train the voice from.");
    res.json(await handlers.createVoice(host, {
      name: (req.body && req.body.name) || "",
      files,
      voiceSettings: parseSettings(req),
    }));
  } catch (e) { fail(res, 400, e); }
});

app.post("/api/voices/:id", upload.array("samples", 25), async (req, res) => {
  try {
    res.json(await handlers.editVoice(host, req.params.id, {
      name: (req.body && req.body.name) || "",
      files: toFiles(req),
      voiceSettings: parseSettings(req),
    }));
  } catch (e) { fail(res, 400, e); }
});

app.post("/api/voices/:id/preview", async (req, res) => {
  try {
    const buf = await handlers.previewVoice(host, req.params.id, req.body || {});
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", String(buf.length));
    res.send(buf);
  } catch (e) { fail(res, 400, e); }
});

app.delete("/api/voices/:id", async (req, res) => {
  try { res.json(await handlers.deleteVoice(host, req.params.id)); }
  catch (e) { fail(res, 400, e); }
});

// ── Podcasts ──────────────────────────────────────────────────────────────────
app.get("/api/podcasts", async (_req, res) => {
  try { res.json(await handlers.listPodcasts(host)); }
  catch (e) { fail(res, 500, e); }
});

app.post("/api/podcasts", async (req, res) => {
  try { res.json(await handlers.createPodcast(host, req.body || {})); }
  catch (e) { fail(res, 400, e); }
});

app.delete("/api/podcasts/:id", async (req, res) => {
  try { res.json(await handlers.deletePodcast(host, req.params.id)); }
  catch (e) { fail(res, 400, e); }
});

app.get("/api/podcasts/:id/audio", async (req, res) => {
  try {
    const { absPath, downloadName } = await handlers.resolvePodcastAudio(host, req.params.id);
    if (req.query.download) res.download(absPath, downloadName);
    else res.sendFile(absPath);
  } catch (e) {
    if (!res.headersSent) res.status(404).json({ error: e.message || "audio not found" });
  }
});

// ── API keys ──────────────────────────────────────────────────────────────────
app.post("/api/keys/active", async (req, res) => {
  try { res.json(await handlers.setActiveKey(host, (req.body || {}).id)); }
  catch (e) { fail(res, 400, e); }
});

app.post("/api/keys/builtin", async (req, res) => {
  try { res.json(await handlers.setBuiltinDisabled(host, !!(req.body || {}).disabled)); }
  catch (e) { fail(res, 400, e); }
});

app.delete("/api/keys/:id", async (req, res) => {
  try { res.json(await handlers.deleteKey(host, req.params.id)); }
  catch (e) { fail(res, 400, e); }
});

function fail(res, status, e) {
  res.status(status).json({ error: e?.message || "node error" });
  try { host.log?.error?.({ op: "node_route", error: e, context: { status } }); }
  catch { /* swallow */ }
}
