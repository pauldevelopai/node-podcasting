/**
 * lib/handlers.js
 *
 * Application logic for Podcast Studio.
 *
 *   Auto-mounted by the runtime (names match standard routes):
 *     getSetupStatus / postSetup / getActivity
 *
 *   Wired by hand in index.js:
 *     listVoices / createVoice / editVoice / deleteVoice / previewVoice
 *     listPodcasts / createPodcast / deletePodcast / resolvePodcastAudio
 *     setActiveKey / setBuiltinDisabled / deleteKey
 *
 * Secrets: ElevenLabs keys live in a git-ignored local store
 * (elevenlabs-keys.json) — multiple labelled keys, one active, plus a
 * "built-in" (Develop AI shared) key that can be toggled off. Voice + podcast
 * metadata live in committed JSON in data/processed/ (no audio, no transcripts,
 * no keys). MP3s and raw samples stay on the laptop (git-ignored).
 */

import {
  readFileSync, writeFileSync, existsSync, mkdirSync,
  createReadStream, statSync, rmSync,
} from "node:fs";
import { join, resolve, dirname, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const ENV_PATH = ".env";
const KEY_STORE_PATH = "elevenlabs-keys.json";
const DATA_DIR = "data/processed";
const PODCASTS_DIR = join(DATA_DIR, "podcasts");
const SAMPLES_DIR = join("data/raw", "voice_samples");

// ElevenLabs choices (per the Node brief): Instant Voice Cloning + turbo model,
// 44.1 kHz / 128 kbps MP3.
const MODEL_ID = "eleven_turbo_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";
const MAX_TRANSCRIPT_CHARS = 40000;
const MAX_PREVIEW_CHARS = 800;
const BYTES_PER_SECOND = 16000; // mp3_44100_128 is CBR 128 kbps
const MAX_SAMPLES = 25;
const DEFAULT_PREVIEW_TEXT =
  "This is a quick test of how this voice sounds in the Podcast Studio.";

const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
  speed: 1.0,
};

// ── API-key store ─────────────────────────────────────────────────────────────
// One git-ignored file holds every key the install knows about. The "built-in"
// key is seeded once from .env (Paul's shared key); newsroom keys are added
// through the app. Exactly one key is active at a time.

function readEnvFile() {
  if (!existsSync(ENV_PATH)) return {};
  const env = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function readKeyStore() {
  if (existsSync(KEY_STORE_PATH)) {
    try {
      const s = JSON.parse(readFileSync(KEY_STORE_PATH, "utf8"));
      if (s && Array.isArray(s.keys)) return s;
    } catch { /* fall through to a fresh store */ }
  }
  // First run: migrate the .env key (if any) in as the built-in shared key.
  const seed = (readEnvFile().ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || "").trim();
  const store = { activeId: null, builtinDisabled: false, keys: [] };
  if (seed) {
    const id = randomUUID();
    store.keys.push({ id, label: "Built-in (Develop AI)", value: seed, builtin: true, added: new Date().toISOString() });
    store.activeId = id;
  }
  writeKeyStore(store);
  return store;
}

function writeKeyStore(store) {
  writeFileSync(KEY_STORE_PATH, JSON.stringify(store, null, 1) + "\n");
  // Keep process.env in sync for any code path that reads the key directly.
  const active = resolveActiveKey(store);
  if (active) process.env.ELEVENLABS_API_KEY = active.value;
  else delete process.env.ELEVENLABS_API_KEY;
}

/** Pick the active key: explicit selection if usable, else a newsroom key, else built-in. */
function resolveActiveKey(store) {
  const usable = store.keys.filter(k => !(k.builtin && store.builtinDisabled));
  return (
    usable.find(k => k.id === store.activeId) ||
    usable.find(k => !k.builtin) ||
    usable.find(k => k.builtin) ||
    null
  );
}

function activeKeyValue() {
  return resolveActiveKey(readKeyStore())?.value || "";
}

/**
 * A one-way fingerprint of a key value. Voices are cloned into the ElevenLabs
 * ACCOUNT a key belongs to — not the key itself — so we tag each voice with the
 * fingerprint of the key it was trained under and compare it to the active key.
 * Using the value (not the local key id) means it survives a key being deleted
 * and re-added: same key value → same fingerprint, even with a fresh local id.
 */
function keyFingerprint(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

/** Identity of the currently-active key: { id, label, fingerprint } or null. */
function activeKeyMeta() {
  const k = resolveActiveKey(readKeyStore());
  return k ? { id: k.id, label: k.label, fingerprint: keyFingerprint(k.value) } : null;
}

function maskKey(v) {
  const s = String(v || "");
  if (s.length <= 8) return "••••";
  return `${s.slice(0, 3)}…${s.slice(-4)}`;
}

/** Public-safe view of the key store for the UI. Values are masked. */
function keyStatus() {
  const store = readKeyStore();
  const active = resolveActiveKey(store);
  return {
    configured: !!active,
    builtinDisabled: !!store.builtinDisabled,
    activeId: active?.id || null,
    hasBuiltin: store.keys.some(k => k.builtin),
    keys: store.keys.map(k => ({
      id: k.id,
      label: k.label,
      masked: maskKey(k.value),
      builtin: !!k.builtin,
      active: active ? k.id === active.id : false,
      added: k.added || null,
    })),
  };
}

/** GET /api/setup — key-store status (drives the welcome screen + key manager). */
export async function getSetupStatus() {
  return keyStatus();
}

/** POST /api/setup — add a key and make it active. Body: { apiKey, label? }. */
export async function postSetup(host, body) {
  const { apiKey, label } = body || {};
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 20) {
    return { ok: false, message: "Paste a full ElevenLabs API key into the key box." };
  }
  const value = apiKey.trim();
  const store = readKeyStore();
  const existing = store.keys.find(k => k.value === value);
  if (existing) {
    store.activeId = existing.id;
    if (existing.builtin) store.builtinDisabled = false;
  } else {
    const id = randomUUID();
    store.keys.push({
      id,
      label: String(label || "").trim() || `Key ${store.keys.length + 1}`,
      value,
      builtin: false,
      added: new Date().toISOString(),
    });
    store.activeId = id;
  }
  writeKeyStore(store);
  await host.log.run({ op: "key_add", reused: !!existing });
  return { ok: true, ...keyStatus() };
}

/** POST /api/keys/active — switch the active key. */
export async function setActiveKey(host, id) {
  const store = readKeyStore();
  const k = store.keys.find(x => x.id === id);
  if (!k) throw new Error("Key not found.");
  store.activeId = id;
  if (k.builtin && store.builtinDisabled) store.builtinDisabled = false;
  writeKeyStore(store);
  await host.log.run({ op: "key_set_active", builtin: !!k.builtin });
  return keyStatus();
}

/** POST /api/keys/builtin — enable/disable the built-in shared key. */
export async function setBuiltinDisabled(host, disabled) {
  const store = readKeyStore();
  store.builtinDisabled = !!disabled;
  writeKeyStore(store);
  await host.log.run({ op: "key_builtin_toggle", disabled: !!disabled });
  return keyStatus();
}

/** DELETE /api/keys/:id — remove a key from the local store. */
export async function deleteKey(host, id) {
  const store = readKeyStore();
  const idx = store.keys.findIndex(k => k.id === id);
  if (idx === -1) throw new Error("Key not found.");
  store.keys.splice(idx, 1);
  if (store.activeId === id) store.activeId = null;
  writeKeyStore(store);
  await host.log.run({ op: "key_delete" });
  return keyStatus();
}

/** GET /api/activity — read-only view of the local activity log. */
export async function getActivity(host) {
  const file = join(DATA_DIR, `${host.tablePrefix}activity.json`);
  return { activity: readJsonArray(file) };
}

// ── Voices ────────────────────────────────────────────────────────────────────

/** GET /api/voices — each voice carries key-availability flags for the UI. */
export async function listVoices(host) {
  const active = activeKeyMeta();
  return readJsonArray(voicesFile(host)).map(v => decorateVoice(v, active));
}

/**
 * POST /api/voices — train a new voice from one or more audio samples (IVC).
 * Body: { name, files: [{buffer, originalname}], voiceSettings? }.
 */
export async function createVoice(host, { name, files, voiceSettings }) {
  const displayName = String(name || "").trim();
  if (!displayName) throw new Error("Give the voice a name — the journalist's name works well.");
  requireKey();
  const list = (files || []).filter(f => f && f.buffer && f.buffer.length);
  if (!list.length) throw new Error("Upload at least one audio sample to train the voice from.");

  const startedAt = Date.now();
  await host.log.run({ op: "voice_create_start" });
  try {
    const dir = join(SAMPLES_DIR, slugify(displayName) || "voice");
    mkdirSync(dir, { recursive: true });
    const samplePaths = list.map((f, i) => {
      const p = join(dir, `sample-${Date.now()}-${i}${extOf(f.originalname) || ".mp3"}`);
      writeFileSync(p, f.buffer);
      return p;
    });

    const client = newClient();
    const result = await client.voices.ivc.create({
      name: displayName,
      files: samplePaths.map(p => createReadStream(p)),
    });
    const elevenlabsVoiceId = result?.voiceId;
    if (!elevenlabsVoiceId) throw new Error("ElevenLabs did not return a voice id.");

    const trainedBy = activeKeyMeta();
    const record = {
      id: randomUUID(),
      elevenlabs_voice_id: elevenlabsVoiceId,
      display_name: displayName,
      created: new Date().toISOString(),
      samples_count: samplePaths.length,
      model: MODEL_ID,
      voice_settings: normalizeVoiceSettings(voiceSettings),
      // The ElevenLabs account this voice was cloned into, recorded via the
      // active key's fingerprint so we can warn if a different key is selected.
      trained_key_hash: trainedBy?.fingerprint || null,
      trained_key_label: trainedBy?.label || null,
      samples: samplePaths,
    };
    const voices = readJsonArray(voicesFile(host));
    voices.push(record);
    writeJsonArray(voicesFile(host), voices);

    await host.log.run({
      op: "voice_create_done",
      voice_id: record.id,
      samples_count: samplePaths.length,
      training_seconds: secondsSince(startedAt),
    });
    return record;
  } catch (e) {
    await host.log.run({ op: "voice_create_failed", reason_short: shortReason(e) });
    throw new Error(friendlyError(e));
  }
}

/**
 * POST /api/voices/:id — edit a voice: rename, add more clips, and/or change
 * its slider settings. Body: { name?, files?: [{buffer, originalname}], voiceSettings? }.
 * Adding clips re-clones from the full accumulated sample set.
 */
export async function editVoice(host, id, { name, files, voiceSettings }) {
  const voices = readJsonArray(voicesFile(host)).map(withVoiceDefaults);
  const voice = voices.find(v => v.id === id);
  if (!voice) throw new Error("That voice no longer exists.");

  const newName = String(name || "").trim() || voice.display_name;
  const newSettings = voiceSettings ? normalizeVoiceSettings(voiceSettings) : voice.voice_settings;
  const newFiles = (files || []).filter(f => f && f.buffer && f.buffer.length);
  const nameChanged = newName !== voice.display_name;

  let samplePaths = Array.isArray(voice.samples) ? voice.samples.slice() : [];
  if (newFiles.length) {
    const dir = join(SAMPLES_DIR, slugify(voice.display_name) || "voice");
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i];
      const p = join(dir, `sample-${Date.now()}-${i}${extOf(f.originalname) || ".mp3"}`);
      writeFileSync(p, f.buffer);
      samplePaths.push(p);
    }
  }

  // Only call ElevenLabs when something it cares about changed (name or samples).
  if (newFiles.length || nameChanged) {
    requireKey();
    const req = { name: newName };
    if (newFiles.length) {
      req.files = samplePaths.filter(p => existsSync(p)).map(p => createReadStream(p));
    }
    try {
      await newClient().voices.update(voice.elevenlabs_voice_id, req);
      // The update succeeded, so the active key owns this voice — (re)tag it
      // with the active account. This also backfills voices trained before
      // tagging existed, the moment they're next edited under the right key.
      const trainedBy = activeKeyMeta();
      if (trainedBy) { voice.trained_key_hash = trainedBy.fingerprint; voice.trained_key_label = trainedBy.label; }
    } catch (e) {
      await host.log.run({ op: "voice_update_failed", reason_short: shortReason(e) });
      throw new Error(friendlyError(e));
    }
  }

  voice.display_name = newName;
  voice.voice_settings = newSettings;
  voice.samples = samplePaths;
  voice.samples_count = samplePaths.length;
  writeJsonArray(voicesFile(host), voices);
  await host.log.run({ op: "voice_update", voice_id: voice.id, samples_added: newFiles.length });
  return voice;
}

/** DELETE /api/voices/:id — remove locally + best-effort on ElevenLabs, tidy samples. */
export async function deleteVoice(host, id) {
  const voices = readJsonArray(voicesFile(host));
  const idx = voices.findIndex(v => v.id === id);
  if (idx === -1) throw new Error("That voice no longer exists.");
  const [rec] = voices.splice(idx, 1);
  writeJsonArray(voicesFile(host), voices);
  await host.log.run({ op: "voice_delete", voice_id: rec.id });

  if (rec.elevenlabs_voice_id && activeKeyValue()) {
    try { await newClient().voices.delete(rec.elevenlabs_voice_id); }
    catch { /* best effort */ }
  }
  for (const p of rec.samples || []) {
    try { if (existsSync(p)) rmSync(p); } catch { /* leave it */ }
  }
  return { ok: true, id };
}

/**
 * POST /api/voices/:id/preview — generate a short sample (NOT saved to History)
 * so a journalist can hear the voice before committing a whole episode.
 * Body: { text?, voiceSettings? }. Returns raw MP3 bytes.
 */
export async function previewVoice(host, id, { text, voiceSettings } = {}) {
  requireKey();
  const voice = readJsonArray(voicesFile(host)).map(withVoiceDefaults).find(v => v.id === id);
  if (!voice) throw new Error("That voice no longer exists.");
  let t = String(text || "").trim() || DEFAULT_PREVIEW_TEXT;
  if (t.length > MAX_PREVIEW_CHARS) t = t.slice(0, MAX_PREVIEW_CHARS);
  const settings = voiceSettings ? normalizeVoiceSettings(voiceSettings) : voice.voice_settings;

  try {
    const audio = await newClient().textToSpeech.convert(voice.elevenlabs_voice_id, {
      text: t,
      modelId: voice.model || MODEL_ID,
      outputFormat: OUTPUT_FORMAT,
      voiceSettings: toSdkVoiceSettings(settings),
    });
    const buffer = await streamToBuffer(audio);
    await host.log.run({
      op: "voice_preview",
      voice_id: voice.id,
      transcript_chars: t.length,
      audio_seconds: Math.max(1, Math.round(buffer.length / BYTES_PER_SECOND)),
    });
    return buffer;
  } catch (e) {
    await host.log.run({ op: "voice_preview_failed", reason_short: shortReason(e) });
    throw new Error(friendlyError(e));
  }
}

// ── Podcasts ──────────────────────────────────────────────────────────────────

/** GET /api/podcasts — newest first. */
export async function listPodcasts(host) {
  return readJsonArray(podcastsFile(host))
    .slice()
    .sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")));
}

/** POST /api/podcasts — generate audio for a transcript in a chosen voice. */
export async function createPodcast(host, { voice_id, title, transcript }) {
  requireKey();
  const localVoiceId = String(voice_id || "").trim();
  const text = String(transcript || "").trim();
  if (!localVoiceId) throw new Error("Pick a voice to generate with.");
  if (!text) throw new Error("Paste a transcript to generate from.");
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    throw new Error(
      `That transcript is ${text.length.toLocaleString()} characters. The limit per episode is ` +
      `${MAX_TRANSCRIPT_CHARS.toLocaleString()} — split it into shorter parts.`
    );
  }
  const voice = readJsonArray(voicesFile(host)).map(withVoiceDefaults).find(v => v.id === localVoiceId);
  if (!voice) throw new Error("That voice no longer exists — pick another.");

  const cleanTitle = String(title || "").trim() || `Episode — ${new Date().toISOString().slice(0, 10)}`;
  const startedAt = Date.now();
  await host.log.run({ op: "podcast_generate_start", voice_id: voice.id, transcript_chars: text.length });
  try {
    const audio = await newClient().textToSpeech.convert(voice.elevenlabs_voice_id, {
      text,
      modelId: voice.model || MODEL_ID,
      outputFormat: OUTPUT_FORMAT,
      voiceSettings: toSdkVoiceSettings(voice.voice_settings),
    });

    const outDir = join(PODCASTS_DIR, slugify(voice.display_name) || "voice");
    mkdirSync(outDir, { recursive: true });
    const mp3Path = join(outDir, `${new Date().toISOString().slice(0, 10)}-${slugify(cleanTitle) || "episode"}.mp3`);
    await writeAudioStream(audio, mp3Path);

    const durationSeconds = Math.max(1, Math.round(statSync(mp3Path).size / BYTES_PER_SECOND));
    const record = {
      id: randomUUID(),
      voice_id: voice.id,
      voice_name: voice.display_name,
      title: cleanTitle,
      transcript_chars: text.length,
      duration_seconds: durationSeconds,
      mp3_path: mp3Path,
      created: new Date().toISOString(),
    };
    const podcasts = readJsonArray(podcastsFile(host));
    podcasts.push(record);
    writeJsonArray(podcastsFile(host), podcasts);

    await host.log.run({
      op: "podcast_generate_done",
      voice_id: voice.id,
      transcript_chars: text.length,
      audio_seconds: durationSeconds,
      generation_seconds: secondsSince(startedAt),
    });
    return record;
  } catch (e) {
    await host.log.run({ op: "podcast_generate_failed", reason_short: shortReason(e) });
    throw new Error(friendlyError(e));
  }
}

/** DELETE /api/podcasts/:id — drop the record and delete the MP3 from disk. */
export async function deletePodcast(host, id) {
  const podcasts = readJsonArray(podcastsFile(host));
  const idx = podcasts.findIndex(p => p.id === id);
  if (idx === -1) throw new Error("That podcast no longer exists.");
  const [rec] = podcasts.splice(idx, 1);
  writeJsonArray(podcastsFile(host), podcasts);
  const abs = safeAudioPath(rec.mp3_path);
  if (abs && existsSync(abs)) { try { rmSync(abs); } catch { /* leave it if locked */ } }
  return { ok: true, id };
}

/** Resolve a podcast's audio path, validated against the stored record. */
export async function resolvePodcastAudio(host, id) {
  const rec = readJsonArray(podcastsFile(host)).find(p => p.id === id);
  if (!rec) throw new Error("Podcast not found.");
  const abs = safeAudioPath(rec.mp3_path);
  if (!abs) throw new Error("Invalid podcast path.");
  if (!existsSync(abs)) throw new Error("Audio file is missing on disk.");
  return { absPath: abs, downloadName: `${slugify(rec.title) || "podcast"}.mp3` };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const voicesFile = host => join(DATA_DIR, `${host.tablePrefix}voices.json`);
const podcastsFile = host => join(DATA_DIR, `${host.tablePrefix}podcasts.json`);

function requireKey() {
  if (!activeKeyValue()) {
    throw new Error("Add your ElevenLabs API key first (top-right “API keys”).");
  }
}

function newClient() {
  return new ElevenLabsClient({ apiKey: activeKeyValue() });
}

function withVoiceDefaults(v) {
  return { ...v, voice_settings: normalizeVoiceSettings(v.voice_settings) };
}

/**
 * Add key-availability info the UI uses to grey out / warn on voices that the
 * active key can't generate with. `key_available` is true when the voice was
 * trained under the active key's account. Voices trained before tagging existed
 * (no fingerprint stored) are treated as available so we never raise a false
 * alarm on them. The raw fingerprint is dropped — the UI only needs the label.
 */
function decorateVoice(v, active) {
  const trainedHash = v.trained_key_hash || null;
  const out = {
    ...withVoiceDefaults(v),
    trained_key_label: v.trained_key_label || null,
    key_untagged: !trainedHash,
    key_available: !trainedHash ? true : (!!active && trainedHash === active.fingerprint),
  };
  delete out.trained_key_hash;
  return out;
}

function clamp(n, lo, hi, dflt) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt;
}

function normalizeVoiceSettings(input) {
  const s = input || {};
  const sim = s.similarity_boost ?? s.similarityBoost;
  const spk = s.use_speaker_boost ?? s.useSpeakerBoost;
  return {
    stability: clamp(s.stability, 0, 1, DEFAULT_VOICE_SETTINGS.stability),
    similarity_boost: clamp(sim, 0, 1, DEFAULT_VOICE_SETTINGS.similarity_boost),
    style: clamp(s.style, 0, 1, DEFAULT_VOICE_SETTINGS.style),
    use_speaker_boost: typeof spk === "boolean" ? spk : DEFAULT_VOICE_SETTINGS.use_speaker_boost,
    speed: clamp(s.speed, 0.7, 1.2, DEFAULT_VOICE_SETTINGS.speed),
  };
}

function toSdkVoiceSettings(s) {
  const v = normalizeVoiceSettings(s);
  return {
    stability: v.stability,
    similarityBoost: v.similarity_boost,
    style: v.style,
    useSpeakerBoost: v.use_speaker_boost,
    speed: v.speed,
  };
}

function readJsonArray(file) {
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function writeJsonArray(file, arr) {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(arr, null, 1) + "\n");
}

/** Confine a stored mp3 path to data/processed/podcasts; return abs path or null. */
function safeAudioPath(storedPath) {
  if (!storedPath) return null;
  const abs = resolve(storedPath);
  const root = resolve(PODCASTS_DIR);
  return abs === root || abs.startsWith(root + sep) ? abs : null;
}

/** Pipe an ElevenLabs audio response to a file. */
async function writeAudioStream(audio, outPath) {
  const buf = await streamToBuffer(audio);
  writeFileSync(outPath, buf);
}

/** Collect an ElevenLabs audio response (web stream / Node stream / async-iter / Buffer) into a Buffer. */
async function streamToBuffer(audio) {
  if (Buffer.isBuffer(audio)) return audio;
  let nodeStream;
  if (audio instanceof Readable) nodeStream = audio;
  else if (audio && typeof audio.getReader === "function") nodeStream = Readable.fromWeb(audio);
  else if (audio && typeof audio[Symbol.asyncIterator] === "function") nodeStream = Readable.from(audio);
  else throw new Error("Unexpected audio response from ElevenLabs.");
  const chunks = [];
  for await (const c of nodeStream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function extOf(name) {
  const m = /\.[a-z0-9]+$/i.exec(String(name || ""));
  return m ? m[0].toLowerCase() : "";
}

const secondsSince = startedAt => Math.round((Date.now() - startedAt) / 1000);
const shortReason = e => String(e?.message || e || "error").replace(/[\r\n]+/g, " ").slice(0, 120);

/** Turn raw ElevenLabs/SDK errors into newsroom-readable language. */
function friendlyError(e) {
  const status = e?.statusCode || e?.status || 0;
  const msg = String(e?.message || e || "");
  // The SDK packs the API body into the message; pull the human line out of it.
  const detail = e?.body?.detail;
  const detailMsg = typeof detail === "string" ? detail : (detail?.message || "");
  const blob = `${status} ${msg} ${safeJson(e?.body)}`.toLowerCase();
  if (status === 401 || /unauthor|invalid api key|api_?key|missing_permissions/.test(blob)) {
    return "ElevenLabs rejected the API key. Check it under “API keys” top-right.";
  }
  if (status === 402 || /quota|insufficient|out of|exceed|upgrade|payment/.test(blob)) {
    return "ElevenLabs reports the account is out of quota or needs an upgrade. Voice cloning needs a paid plan.";
  }
  if (/can_not_use_instant_voice_cloning|voice_add|cloning not|not allowed to/.test(blob)) {
    return "This ElevenLabs plan can’t clone voices. Instant Voice Cloning needs the Starter tier or above.";
  }
  return (detailMsg || msg.split("\n")[0] || "ElevenLabs request failed.").slice(0, 300);
}

function safeJson(v) {
  try { return v ? JSON.stringify(v) : ""; } catch { return ""; }
}
