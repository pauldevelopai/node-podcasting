// public/app.js — Podcast Studio frontend.
// States: setup / key-manager  ↔  app (Generate · Voices · History · Activity).

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let VOICES = [];
let PODCASTS = [];
let KEYSTATUS = null;

const SLIDERS = [
  { k: "stability", label: "Stability", min: 0, max: 1, step: 0.05 },
  { k: "similarity_boost", label: "Similarity", min: 0, max: 1, step: 0.05 },
  { k: "style", label: "Style", min: 0, max: 1, step: 0.05 },
  { k: "speed", label: "Speed", min: 0.7, max: 1.2, step: 0.05 },
];

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  KEYSTATUS = await getJSON("/api/setup").catch(() => ({ configured: false, keys: [] }));
  renderKeyManager(KEYSTATUS);
  if (!KEYSTATUS.configured) { showSetup(); return; }
  showApp();
  $("#open-setup").style.display = "inline-block";
  await Promise.all([loadVoices(), loadPodcasts()]);
  loadActivity();
}

function showSetup() { $("#setup").style.display = "block"; $("#app").style.display = "none"; }
function showApp() { $("#setup").style.display = "none"; $("#app").style.display = "block"; }

// ── Key manager ───────────────────────────────────────────────────────────────
function renderKeyManager(status) {
  KEYSTATUS = status;
  const configured = !!status.configured;
  $("#setup-title").textContent = configured ? "ElevenLabs API keys" : "Welcome — add your ElevenLabs key";
  $("#setup-intro").innerHTML = configured
    ? "Manage the keys this Studio can use. The <b>active</b> key (green) is used for cloning and generation."
    : "This Studio uses <b>ElevenLabs</b> to clone voices and generate audio. <b>Paste the key Develop AI sent you</b> (or your own ElevenLabs key) to get started — voice cloning needs a paid ElevenLabs plan, Starter tier or above.";

  const list = $("#key-list");
  list.innerHTML = (status.keys || []).map(k => `
    <div class="key-row">
      <span class="lbl">${esc(k.label)}</span>
      <span class="masked">${esc(k.masked)}</span>
      ${k.builtin ? '<span class="badge builtin">built-in</span>' : ""}
      ${k.active ? '<span class="badge active">active</span>' : ""}
      <span class="spacer"></span>
      ${k.active ? "" : `<button class="btn sm ghost" data-active="${k.id}">Make active</button>`}
      ${k.builtin ? "" : `<button class="btn danger" data-delkey="${k.id}">Delete</button>`}
    </div>`).join("") || `<div class="dim" style="padding:14px 0">No keys yet — add one below.</div>`;
  list.querySelectorAll("[data-active]").forEach(b => b.addEventListener("click", () => makeActiveKey(b.dataset.active)));
  list.querySelectorAll("[data-delkey]").forEach(b => b.addEventListener("click", () => removeKey(b.dataset.delkey)));

  const br = $("#builtin-row");
  if (status.hasBuiltin) { br.style.display = "block"; $("#builtin-toggle").checked = !status.builtinDisabled; }
  else br.style.display = "none";

  $("#setup-done").style.display = configured ? "inline-block" : "none";
}

$("#setup-save").addEventListener("click", async () => {
  const errBox = $("#setup-err");
  errBox.classList.remove("on");
  const apiKey = $("#setup-key-input").value.trim();
  const label = $("#key-label-input").value.trim();
  if (!apiKey) return showErr(errBox, "Paste an ElevenLabs API key first.");
  const btn = $("#setup-save"); btn.disabled = true; btn.textContent = "Adding…";
  try {
    const data = await postJSON("/api/setup", { apiKey, label });
    if (data.ok === false) throw new Error(data.message || "Could not save the key.");
    $("#setup-key-input").value = ""; $("#key-label-input").value = "";
    renderKeyManager(data);
    if (data.configured && $("#app").style.display === "none") {
      $("#open-setup").style.display = "inline-block";
      showApp();
      await Promise.all([loadVoices(), loadPodcasts()]);
      loadActivity();
    } else if (data.configured) {
      await refreshVoicesIfReady();   // app already open — refresh stale-state
    }
  } catch (e) {
    showErr(errBox, e.message);
  } finally {
    btn.disabled = false; btn.textContent = "Add key";
  }
});

async function makeActiveKey(id) {
  try { renderKeyManager(await postJSON("/api/keys/active", { id })); await refreshVoicesIfReady(); } catch (e) { alert(e.message); }
}
async function removeKey(id) {
  if (!confirm("Remove this key from this computer?")) return;
  try { renderKeyManager(await delJSON(`/api/keys/${id}`)); await refreshVoicesIfReady(); } catch (e) { alert(e.message); }
}
$("#builtin-toggle").addEventListener("change", async e => {
  try { renderKeyManager(await postJSON("/api/keys/builtin", { disabled: !e.target.checked })); await refreshVoicesIfReady(); }
  catch (err) { alert(err.message); }
});

// Changing the active key changes which voices are usable — re-pull voices so
// the stale-state grey-out and warnings update live (only when the app is up).
async function refreshVoicesIfReady() {
  if (KEYSTATUS && KEYSTATUS.configured) await loadVoices();
}

$("#open-setup").addEventListener("click", async e => {
  e.preventDefault();
  $("#setup-err").classList.remove("on");
  $("#setup-key-input").value = ""; $("#key-label-input").value = "";
  KEYSTATUS = await getJSON("/api/setup").catch(() => KEYSTATUS);
  renderKeyManager(KEYSTATUS);
  showSetup();
});

$("#setup-done").addEventListener("click", async () => {
  if (!KEYSTATUS || !KEYSTATUS.configured) return;
  showApp();
  await Promise.all([loadVoices(), loadPodcasts()]);
  loadActivity();
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
$$(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.remove("on"));
    $$(".view").forEach(v => v.classList.remove("on"));
    tab.classList.add("on");
    $("#v-" + tab.dataset.v).classList.add("on");
    if (tab.dataset.v === "activity") loadActivity();
    if (tab.dataset.v === "history") renderHistory();
  });
});

// ── Voices ────────────────────────────────────────────────────────────────────
async function loadVoices() {
  VOICES = await getJSON("/api/voices").catch(() => []);
  renderVoices();
  renderVoicePicker();
  $("#voice-count").innerHTML = VOICES.length
    ? `<b style="color:var(--paper)">${VOICES.length}</b> voice${VOICES.length === 1 ? "" : "s"} trained`
    : "no voices yet";
}

function renderVoices() {
  const wrap = $("#voices-list");
  if (!VOICES.length) {
    wrap.innerHTML = `<div class="empty-note"><p>No voices yet. Add a name + audio samples above, then <b>Train a new voice</b>.</p></div>`;
    return;
  }
  wrap.innerHTML = VOICES.map(v => {
    const stale = v.key_available === false;
    const keyLine = v.trained_key_label
      ? ` · key <b>${esc(v.trained_key_label)}</b>`
      : (v.key_untagged ? ` · key <span class="dim">untagged</span>` : "");
    const warn = stale ? `<div class="voice-warn">⚠ Trained with the
      ${v.trained_key_label ? `<b>${esc(v.trained_key_label)}</b>` : "previous"} key — not the active one.
      Preview, editing and generation will fail until you
      <a data-open-keys="1">switch to that key</a> under API keys.</div>` : "";
    return `
    <div class="card${stale ? " stale" : ""}">
      <div class="top">
        <div>
          <div class="ttl">${esc(v.display_name)}</div>
          <div class="meta">trained <b>${fmtDate(v.created)}</b> · ${v.samples_count || 1} sample${(v.samples_count || 1) === 1 ? "" : "s"} · model <code>${esc(v.model || "")}</code>${keyLine}</div>
        </div>
        <div class="card-actions">
          <button class="btn sm ghost" data-edit="${v.id}">Edit &amp; test</button>
          <button class="btn danger" data-del-voice="${v.id}">Delete</button>
        </div>
      </div>
      ${warn}
      <div class="edit-panel" id="edit-${v.id}"></div>
    </div>`;
  }).join("");
  wrap.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => toggleEdit(b.dataset.edit)));
  wrap.querySelectorAll("[data-del-voice]").forEach(b => b.addEventListener("click", () => deleteVoice(b.dataset.delVoice)));
  wireOpenKeysLinks(wrap);
}

function renderVoicePicker() {
  const sel = $("#gen-voice");
  sel.innerHTML = VOICES.map(v => {
    const stale = v.key_available === false;
    const label = stale
      ? `⚠ ${v.display_name} — needs ${v.trained_key_label || "another"} key`
      : v.display_name;
    return `<option value="${v.id}">${esc(label)}</option>`;
  }).join("");
  const has = VOICES.length > 0;
  $("#no-voices").style.display = has ? "none" : "block";
  $("#gen-form").style.display = has ? "block" : "none";
  updateGenKeyNote();
}

// Warn (don't block) when the voice selected for generation was trained under a
// key other than the active one — generation would fail at ElevenLabs.
function updateGenKeyNote() {
  const note = $("#gen-key-note");
  if (!note) return;
  const v = VOICES.find(x => x.id === $("#gen-voice").value);
  if (v && v.key_available === false) {
    note.innerHTML = `⚠ <b>${esc(v.display_name)}</b> was trained with the
      ${v.trained_key_label ? `<b>${esc(v.trained_key_label)}</b>` : "previous"} key.
      Generation will fail until you <a data-open-keys="1">switch to that key</a> under API keys.`;
    note.style.display = "block";
    wireOpenKeysLinks(note);
  } else {
    note.style.display = "none";
  }
}

// Any element with data-open-keys opens the API-keys manager.
function wireOpenKeysLinks(container) {
  container.querySelectorAll("[data-open-keys]").forEach(a =>
    a.addEventListener("click", e => { e.preventDefault(); $("#open-setup").click(); }));
}

// New-voice training (multi-file)
$("#voice-file").addEventListener("change", e => {
  const n = e.target.files.length;
  $("#voice-filename").textContent = n ? `${n} file${n > 1 ? "s" : ""} chosen` : "no files chosen";
});

$("#voice-train").addEventListener("click", async () => {
  const errBox = $("#voice-err");
  errBox.classList.remove("on");
  const name = $("#voice-name").value.trim();
  const files = $("#voice-file").files;
  if (!name) return showErr(errBox, "Give the voice a name first.");
  if (!files.length) return showErr(errBox, "Choose at least one audio sample.");

  const btn = $("#voice-train");
  const stop = startTimer("#voice-elapsed");
  btn.disabled = true;
  $("#voice-progress").classList.add("on");
  try {
    const fd = new FormData();
    fd.append("name", name);
    for (const f of files) fd.append("samples", f);
    const res = await fetch("/api/voices", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Training failed.");
    $("#voice-name").value = "";
    $("#voice-file").value = "";
    $("#voice-filename").textContent = "no files chosen";
    await loadVoices();
    loadActivity();
  } catch (e) {
    showErr(errBox, e.message);
  } finally {
    stop();
    btn.disabled = false;
    $("#voice-progress").classList.remove("on");
  }
});

// Edit & test panel
function toggleEdit(id) {
  const panel = $(`#edit-${id}`);
  if (!panel.dataset.built) {
    panel.innerHTML = buildEditPanel(VOICES.find(v => v.id === id));
    panel.dataset.built = "1";
    wireEditPanel(id);
  }
  panel.classList.toggle("on");
}

function sliderRow(id, s, val) {
  return `<div class="slider-row">
    <span class="sl-lbl">${s.label}</span>
    <input type="range" id="sl-${id}-${s.k}" min="${s.min}" max="${s.max}" step="${s.step}" value="${val}">
    <span class="sl-val" id="slv-${id}-${s.k}">${Number(val).toFixed(2)}</span>
  </div>`;
}

function buildEditPanel(voice) {
  const id = voice.id;
  const vs = voice.voice_settings || {};
  return `
    <div class="edit-grid">
      <div>
        <div class="panel-h">Voice settings (sliders)</div>
        ${SLIDERS.map(s => sliderRow(id, s, vs[s.k])).join("")}
        <div class="check-row"><input type="checkbox" id="spk-${id}" ${vs.use_speaker_boost !== false ? "checked" : ""}> Speaker boost</div>
        <div class="field" style="margin-top:8px">
          <label>Add more clips <span class="dim">(re-clones the voice)</span></label>
          <label class="filebtn" for="file-${id}">Choose audio files</label>
          <input id="file-${id}" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" multiple>
          <span class="filename" id="fn-${id}">no files chosen</span>
        </div>
        <div class="field">
          <label for="name-${id}">Voice name</label>
          <input id="name-${id}" type="text" value="${esc(voice.display_name)}">
        </div>
        <button class="btn sm" id="save-${id}">Save changes</button>
      </div>
      <div>
        <div class="panel-h">Test this voice (not saved to History)</div>
        <div class="field">
          <textarea id="test-${id}" style="min-height:120px">This is a quick test of how this voice sounds in the Podcast Studio.</textarea>
        </div>
        <button class="btn sm ghost" id="playtest-${id}">▶ Play test</button>
        <audio id="testaudio-${id}" controls style="display:none"></audio>
        <div class="err" id="editerr-${id}"></div>
      </div>
    </div>`;
}

function wireEditPanel(id) {
  SLIDERS.forEach(s => {
    const sl = $(`#sl-${id}-${s.k}`);
    sl.addEventListener("input", () => { $(`#slv-${id}-${s.k}`).textContent = parseFloat(sl.value).toFixed(2); });
  });
  $(`#file-${id}`).addEventListener("change", e => {
    const n = e.target.files.length;
    $(`#fn-${id}`).textContent = n ? `${n} file${n > 1 ? "s" : ""} chosen` : "no files chosen";
  });
  $(`#playtest-${id}`).addEventListener("click", () => playTest(id));
  $(`#save-${id}`).addEventListener("click", () => saveEdit(id));
}

function gatherSettings(id) {
  const val = k => parseFloat($(`#sl-${id}-${k}`).value);
  return {
    stability: val("stability"),
    similarity_boost: val("similarity_boost"),
    style: val("style"),
    speed: val("speed"),
    use_speaker_boost: $(`#spk-${id}`).checked,
  };
}

async function playTest(id) {
  const errBox = $(`#editerr-${id}`);
  errBox.classList.remove("on");
  const text = $(`#test-${id}`).value.trim();
  const btn = $(`#playtest-${id}`);
  btn.disabled = true; const orig = btn.textContent; btn.textContent = "Generating…";
  try {
    const res = await fetch(`/api/voices/${id}/preview`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_settings: gatherSettings(id) }),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Preview failed."); }
    const url = URL.createObjectURL(await res.blob());
    const audio = $(`#testaudio-${id}`);
    audio.src = url; audio.style.display = "block"; audio.play().catch(() => {});
    loadActivity();
  } catch (e) {
    showErr(errBox, e.message);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

async function saveEdit(id) {
  const errBox = $(`#editerr-${id}`);
  errBox.classList.remove("on");
  const name = $(`#name-${id}`).value.trim();
  const files = $(`#file-${id}`).files;
  const btn = $(`#save-${id}`); btn.disabled = true; const orig = btn.textContent;
  btn.textContent = files.length ? "Saving + re-cloning…" : "Saving…";
  try {
    const fd = new FormData();
    fd.append("name", name);
    fd.append("voice_settings", JSON.stringify(gatherSettings(id)));
    for (const f of files) fd.append("samples", f);
    const res = await fetch(`/api/voices/${id}`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Save failed.");
    await loadVoices();   // re-render (panel closes)
    loadActivity();
  } catch (e) {
    showErr(errBox, e.message);
    btn.disabled = false; btn.textContent = orig;
  }
}

async function deleteVoice(id) {
  const v = VOICES.find(x => x.id === id);
  if (!confirm(`Delete the voice "${v ? v.display_name : id}"? This can't be undone. Existing podcasts keep playing.`)) return;
  try {
    const data = await delJSON(`/api/voices/${id}`);
    if (data.error) throw new Error(data.error);
    await loadVoices();
    loadActivity();
  } catch (e) { alert(e.message); }
}

// ── Generate ────────────────────────────────────────────────────────────────
$("#gen-transcript").addEventListener("input", e => {
  $("#char-count").textContent = e.target.value.length.toLocaleString();
});
$("#gen-voice").addEventListener("change", updateGenKeyNote);

$("#gen-go").addEventListener("click", async () => {
  const errBox = $("#gen-err");
  errBox.classList.remove("on");
  $("#gen-result").classList.remove("on");
  const voice_id = $("#gen-voice").value;
  const title = $("#gen-title").value.trim();
  const transcript = $("#gen-transcript").value.trim();
  if (!voice_id) return showErr(errBox, "Pick a voice.");
  if (!transcript) return showErr(errBox, "Paste a transcript first.");

  const btn = $("#gen-go");
  const stop = startTimer("#gen-elapsed");
  btn.disabled = true;
  $("#gen-progress").classList.add("on");
  try {
    const data = await postJSON("/api/podcasts", { voice_id, title, transcript });
    if (data.error) throw new Error(data.error);
    showResult(data);
    await loadPodcasts();
    loadActivity();
  } catch (e) {
    showErr(errBox, e.message);
  } finally {
    stop();
    btn.disabled = false;
    $("#gen-progress").classList.remove("on");
  }
});

function showResult(rec) {
  $("#gen-result-title").textContent = rec.title;
  $("#gen-audio").src = `/api/podcasts/${rec.id}/audio`;
  $("#gen-dl").href = `/api/podcasts/${rec.id}/audio?download=1`;
  $("#gen-result-meta").textContent = `${fmtDur(rec.duration_seconds)} · ${rec.transcript_chars.toLocaleString()} chars · ${esc(rec.voice_name)}`;
  $("#gen-result").classList.add("on");
}

// ── History ───────────────────────────────────────────────────────────────────
async function loadPodcasts() {
  PODCASTS = await getJSON("/api/podcasts").catch(() => []);
  renderHistory();
}

function renderHistory() {
  const wrap = $("#history-list");
  if (!PODCASTS.length) {
    wrap.innerHTML = `<div class="empty-note"><p>No podcasts yet. Generate one from the <b>Generate</b> tab.</p></div>`;
    return;
  }
  wrap.innerHTML = PODCASTS.map(p => `
    <div class="card">
      <div class="top">
        <div>
          <div class="ttl">${esc(p.title)}</div>
          <div class="meta"><b>${esc(p.voice_name)}</b> · ${fmtDate(p.created)} · ${fmtDur(p.duration_seconds)} · ${(p.transcript_chars || 0).toLocaleString()} chars</div>
        </div>
        <button class="btn danger" data-del-pod="${p.id}">Delete</button>
      </div>
      <audio controls preload="none" src="/api/podcasts/${p.id}/audio"></audio>
      <div class="card-actions">
        <a class="dl" href="/api/podcasts/${p.id}/audio?download=1" download>Download MP3</a>
      </div>
    </div>`).join("");
  wrap.querySelectorAll("[data-del-pod]").forEach(b => b.addEventListener("click", () => deletePodcast(b.dataset.delPod)));
}

async function deletePodcast(id) {
  const p = PODCASTS.find(x => x.id === id);
  if (!confirm(`Delete "${p ? p.title : id}"? This removes the MP3 from your computer and can't be undone.`)) return;
  try {
    const data = await delJSON(`/api/podcasts/${id}`);
    if (data.error) throw new Error(data.error);
    await loadPodcasts();
    loadActivity();
  } catch (e) { alert(e.message); }
}

// ── Activity ──────────────────────────────────────────────────────────────────
const OP_LABELS = {
  key_add: ["API key added", "dim"],
  key_set_active: ["API key switched", "dim"],
  key_builtin_toggle: ["Built-in key toggled", "dim"],
  key_delete: ["API key removed", "dim"],
  voice_create_start: ["Voice training started", "dim"],
  voice_create_done: ["Voice trained", "ok"],
  voice_create_failed: ["Voice training failed", "fail"],
  voice_update: ["Voice updated", "ok"],
  voice_update_failed: ["Voice update failed", "fail"],
  voice_preview: ["Voice preview", "dim"],
  voice_preview_failed: ["Preview failed", "fail"],
  podcast_generate_start: ["Generation started", "dim"],
  podcast_generate_done: ["Podcast generated", "ok"],
  podcast_generate_failed: ["Generation failed", "fail"],
  voice_delete: ["Voice deleted", "dim"],
  feedback_submit: ["Feedback sent", "dim"],
};

async function loadActivity() {
  const { activity = [] } = await getJSON("/api/activity").catch(() => ({ activity: [] }));
  const rows = activity.slice().reverse();
  const voiceName = id => {
    const v = VOICES.find(x => x.id === id);
    return v ? esc(v.display_name) : (id ? `<span class="dim mono">${esc(String(id).slice(0, 8))}</span>` : "—");
  };
  const tb = $("#activity-tb");
  $("#activity-empty").style.display = rows.length ? "none" : "block";
  tb.innerHTML = rows.map(e => {
    const [label, cls] = OP_LABELS[e.op] || [e.op || "—", "dim"];
    const reason = e.reason_short ? `<div class="dim mono" style="font-size:11px;margin-top:3px">${esc(e.reason_short)}</div>` : "";
    const took = e.generation_seconds ?? e.training_seconds;
    return `<tr>
      <td class="mono dim">${fmtTime(e.ts)}</td>
      <td><span class="op ${cls}">${esc(label)}</span>${reason}</td>
      <td>${e.voice_id ? voiceName(e.voice_id) : "—"}</td>
      <td class="r mono">${e.transcript_chars != null ? e.transcript_chars.toLocaleString() : "—"}</td>
      <td class="r mono">${e.audio_seconds != null ? fmtDur(e.audio_seconds) : "—"}</td>
      <td class="r mono">${took != null ? took + "s" : "—"}</td>
    </tr>`;
  }).join("");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getJSON(url) { return fetch(url).then(r => r.json()); }
function postJSON(url, body) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
}
function delJSON(url) { return fetch(url, { method: "DELETE" }).then(r => r.json()); }
function showErr(box, msg) { box.textContent = msg; box.classList.add("on"); }

function startTimer(sel) {
  const el = $(sel);
  const t0 = Date.now();
  el.textContent = "0s";
  const iv = setInterval(() => { el.textContent = Math.round((Date.now() - t0) / 1000) + "s"; }, 1000);
  return () => clearInterval(iv);
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDur(secs) {
  if (secs == null) return "—";
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

boot();
