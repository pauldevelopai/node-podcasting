**Podcast Studio**
https://github.com/pauldevelopai/node-podcasting/

This is your newsroom's podcast app. A journalist trains their own voice from a
short, clean audio sample. Then anyone can paste a transcript, pick that voice,
and the app generates an audio podcast — an MP3 — spoken in that voice. The
audio, the transcripts, and your API key all stay on your own computer.

The app runs locally on one laptop to start with. You can adjust and develop the
code yourself (described below), and later it can be put live on the web once
it's ready.

This guide gets it running. No prior coding experience is needed.

If you get stuck on any step, that's normal. Email Paul at Develop AI and tell
him exactly which step you're on and what your screen looks like — he'll get you
unstuck. He's already done this dozens of times.

---

**Part of GROUNDED**

This app is a *Node* on GROUNDED — Develop AI's family of newsroom-owned tools.
Each Node runs on a newsroom's own laptop, uses the newsroom's own API key, and
keeps its work on disk. Because it's part of GROUNDED, it carries a thin
terracotta bar at the top, a footer, and a **Feedback** button in the
bottom-right that messages Paul directly.

Being honest up front: a small amount of *non-content* information about your
install is sent to Develop AI over the internet so they can see that the app is
being used and where it's failing — operation names, dates, durations and
counts. **Never** your transcripts, your audio, your voice samples, or your API
key. The full, exact list is in "What you share with Develop AI" near the
bottom. Read it.

---

**A quick map of what we're about to do**

We'll do six things. Each one is small. After each, the app gets a bit closer to
running.

1. Install Node.js — the free engine the app runs on. (A code editor like VS
   Code is optional.)
2. Get an ElevenLabs account and API key (this is the service that clones the
   voice and generates the audio).
3. Get a copy of the app onto your computer, through GitHub.
4. Run the app for the first time.
5. Open the app and add your ElevenLabs key on the welcome screen.
6. Train a voice, then generate your first podcast.

Ready? Let's go.

---

**Part 1 — Install Node.js (the engine that runs the app)**

Open your web browser (Chrome, Safari, Firefox, Edge — any).
In the address bar at the top, type: **nodejs.org** — then press Enter.
You'll see a page with a big button labelled **LTS** ("Long-Term Support" — the
stable version everyone uses). Click it.
A file downloads. When it finishes, find it in your Downloads folder and
double-click it to open the installer. Click Continue / Next on every screen,
accept the agreement, and click Install. You may need to type your computer
password.
When it says "Installation Successful", click Close.
You won't see a new app icon — that's normal. Node.js works behind the scenes.

**Part 2 — Install VS Code (optional)**

VS Code is a free code editor from Microsoft. You only need it if you want to
*look at or change* the app's code — it is **not** needed to run the app. If you
want it, get it at **code.visualstudio.com** (download, open, accept the
defaults). Otherwise, skip straight to Part 3.

**Part 3 — Get an ElevenLabs account and API key**

You can start by using the Develop AI ElevenLabs account so you don't need an ElevenLabs API straight away, but just so you know, this app uses **ElevenLabs** to clone voices and generate audio and you will need a paid sub and a key from them. (You do *not* need Anthropic, OpenAI, or any other key.) The free tier cannot clone voices.
> The bigger your plan, the more characters of audio you can generate per month.

When your newsroom gets its own ElevenLabs
> account, open **API keys** (top-right of the app), add your own key, and it
> becomes active automatically. You can store several keys, switch which one is
> active, and toggle the built-in shared key off entirely.

To get a key: go to **elevenlabs.io**, sign up (or sign in), click your profile
in the bottom-left → **API Keys** → create a key, and copy it somewhere safe.
You'll add it in the app in Part 6 — nothing else to do here.
Keep your key private: don't email it, don't put it in a shared document. The
app stores keys in private files on your own computer that never go to GitHub.

**Part 4 — Get the app onto your computer**

You'll use the **Terminal** — a plain text window that's already built into your
computer — to copy the app down. **No GitHub account, no sign-in, no "fork"**,
and nothing ever gets pushed back from your machine. Your copy is yours: even if
Develop AI disappears tomorrow, it keeps working.

Step 4a — Open the Terminal
- **Mac:** press **Cmd-Space**, type **Terminal**, and press Enter.
- **Windows:** click **Start**, type **PowerShell**, and press Enter.

A plain window opens with a blinking cursor. That's all it is.

Step 4b — Copy the app down
Paste this line into the Terminal and press Enter:

    git clone https://github.com/pauldevelopai/node-podcasting.git

It downloads a folder called **node-podcasting** into your home folder. (If you
see **"git: command not found"**: on a Mac, a pop-up offers to install "Command
Line Tools" — click **Install**, wait a few minutes, then paste the line again;
on Windows, install Git from **git-scm.com**, close and reopen PowerShell, and
try again.)

**Part 5 — Run the app for the first time**

Step 5a — In the **same Terminal window**, go into the app's folder:

    cd node-podcasting

Step 5b — Install the app's parts:

    npm install

Text scrolls by for 30–60 seconds. When it finishes you get a fresh prompt —
silence means success. (If you see "command not found: npm", Node.js didn't
install — restart your computer and re-do Part 1.)

Step 5c — Start the app:

    npm start

After a moment you'll see:

    ✓ Podcast Studio is running.
    ✓ Open this in your web browser:  http://localhost:3000

Leave this Terminal window open — as long as it says "is running", the app is
alive. (Next time it's just one double-click — see "Using the app after the
first day" below.)

**Part 6 — Open the app, add your key, make your first podcast**

Open your browser and go to **localhost:3000**.
If a built-in key was supplied, the app opens straight to the dashboard. If not,
you'll see a welcome screen — paste your ElevenLabs key (your own, or the shared
Develop AI key Paul sent you), give it a label (optional), and click **Add
key**. Keys are saved on your own computer and never go to GitHub.

Now you'll see the app with four tabs across the top: **Generate, Voices,
History, Activity**.

Train a voice first:
1. Click the **Voices** tab.
2. Type a name for the voice (the journalist's name works well).
3. Click **Choose audio files** and pick one or more short (1–2 minute) clean
   recordings of that one person speaking — no music, no crosstalk. More clips
   usually means a better clone.
4. Click **Train a new voice**. This takes 1–3 minutes. When it's done, the
   voice appears in the list below.

Tune and test the voice (optional but recommended):
- On a voice, click **Edit & test**. You can rename it, **add more clips**, and
  adjust the **sliders** (stability, similarity, style, speed, speaker boost).
- Type a sentence under **Test this voice** and click **▶ Play test** to hear a
  short sample *before* committing a whole episode. Click **Save changes** to
  keep your settings — they apply to every podcast made with that voice.

Then generate a podcast:
1. Click the **Generate** tab.
2. Pick your voice from the dropdown.
3. Paste your transcript, give it a title, and click **Generate podcast**.
4. When it finishes, a player appears — press play, or download the MP3. It's
   also saved under the **History** tab.

That's it. You're running.

Managing keys: click **API keys** (top-right) any time to add another key,
switch which one is active, or turn the built-in shared key off so the app uses
only your own keys.

---

**Using the app after the first day**

You don't have to repeat the setup. From now on:
- **On a Mac:** double-click **Start.command** in your folder. (The first time,
  your Mac may say "cannot verify the developer". Right-click the file → Open →
  click Open in the dialog. After that, double-clicking works normally.)
- **On Windows:** double-click **Start.bat**.

The terminal opens, the server starts, and your browser opens to the app.
To stop the app: close the terminal window (or press Ctrl+C in it).

---

**Changing the code yourself (optional)**

Your copy is yours to tinker with — it's just files on your computer. If you'd
like to look at or change how the app works, use **VS Code** (the free editor
from Part 2 — install it now if you skipped it).

Open the app in VS Code:
- **File → Open Folder…** → choose the **node-podcasting** folder → **Open**.
- If asked "Do you trust the authors?", click **Yes**.

On the left you'll see the files. The ones worth knowing:
- **public/** — the screens you see in the browser (the page, the styling, the
  buttons).
- **lib/handlers.js** — the app's logic (training voices, generating podcasts).
- **index.js** — where the app starts up and its routes are wired.

To see a change as you work:
- **Screens (`public/`):** save the file, then just **refresh the browser tab**.
- **Logic (`lib/`, `index.js`):** stop the app (Ctrl+C in the Terminal) and run
  `npm start` again — or run `npm run dev` instead of `npm start`, which watches
  the code and restarts itself every time you save.

Two things to know:
- **Updates vs. your edits:** if you change one of the app's *code* files and
  later run Update, the update may stop rather than overwrite your work (nothing
  is lost — see the troubleshooting note further down). If you want changes that
  survive updates, tell Paul — they're better folded into the app for everyone.
- **If something breaks:** nothing here can harm your voices or podcasts (those
  live in separate files). Worst case, delete the folder and redo Part 4 for a
  fresh copy — or email Paul.

---

**What you share with Develop AI**

This is the most important section. Be clear on it before you train voices.

**Stays on your laptop — NEVER uploaded:**
- Your ElevenLabs API keys (in private files `.env` and `elevenlabs-keys.json`).
- The audio samples you use to train voices (in `data/raw/voice_samples/`).
- The transcripts you paste in.
- The generated MP3 podcast files (in `data/processed/podcasts/`).

**Sent to Develop AI (over the internet, automatically):**
The app reports a little *non-content* metadata so Develop AI can see it's being
used and fix what breaks. This goes straight to Develop AI over the internet —
nothing to push, no GitHub account involved:
- **Install heartbeat** — a random install ID, the app version, your operating
  system, and how many times you've launched the app.
- **Activity** — operation names, types, durations and counts (e.g. "podcast
  generated, 612 seconds of audio, 4,823 characters"). **Never** the transcript
  or the audio.
- **Errors** — sanitised error records, so Paul can see where the app breaks.
- **Feedback** — anything you type into the in-app **Feedback** button.

Your voice list, podcast list, slider settings and history stay **on your
computer only** (in `data/processed/`) — they are never uploaded.

**The Feedback button** is the one place where text you type intentionally
leaves your laptop — it's sent to Develop AI over the internet so Paul can read
it. The feedback box says so before you send.

**About ElevenLabs:** voice training and podcast generation use ElevenLabs' API.
That means ElevenLabs sees the audio samples (during training) and the
transcripts (during generation). They have their own privacy terms — your team
should read them before training voices with anyone's voice or sensitive
material.

If you ever want to use this Node for confidential material, talk to Paul first
— the setup may need adjusting so that data doesn't leave your machine.

---

**The plan from here**

Right now the app runs on one laptop and you own the copy. Over time Develop AI
will improve the Node (better progress feedback, more voice options, and
eventually AI-assisted transcript tidying and episode notes). You pull those
improvements with one double-click (next section) and your voices, podcasts, and
settings are kept. When the workflow is settled, the same code can be put live on
the web for the whole newsroom.

---

**Getting updates from Develop AI**

- **On a Mac:** double-click **Update.command** in your folder.
- **On Windows:** double-click **Update.bat**.

A terminal opens, fetches the latest version from Develop AI, and applies it.
Your voices, podcasts, settings and history live in separate, private files, so
an update never touches them. If anything ever can't be applied cleanly, the
update stops without changing a thing and asks you to email Paul — it can't break
your app or lose your work. When it says "Update complete", close the window and
double-click Start again.

The first time you run Update, your computer may need a tool called **git**:
- **Mac:** you'll be prompted to install Apple's Command Line Tools. Click
  Install on the pop-up (about 5 minutes), then double-click Update.command again.
- **Windows:** open the link the window gives you, download the Git installer,
  click Next on every screen, restart, then double-click Update.bat again.

This is a one-time install. After that, updates are always one double-click.

---

**When something goes wrong**

**"command not found: npm" or "node"**
Node.js isn't installed correctly. Close the Terminal, restart your computer,
and re-do Part 1.

**"EADDRINUSE: address already in use :::3000"**
The app is already running in another terminal window. Close that one first.

**The welcome screen won't accept my key**
Make sure you copied the whole key. If you're sure it's right, your ElevenLabs
account may need an upgrade — see the next item.

**"This ElevenLabs plan can't clone voices" / "out of quota"**
Voice cloning needs a paid ElevenLabs plan (Starter tier or above), and
generating audio uses up your monthly character allowance. Check your plan and
usage at elevenlabs.io → your profile → Subscription.

**"…may violate our Terms of Service and requires verification"**
ElevenLabs sometimes asks you to verify a newly-cloned voice before it can be
used (a one-time anti-misuse step). Go to elevenlabs.io → **Voices**, open the
voice, and complete the verification it prompts for. Then come back and try
generating again.

**Training or generation fails with an ElevenLabs error**
Open the **Activity** tab — failed operations are listed with a short reason.
Most often it's the key or the plan (the two items above). Click **API keys**
top-right to switch or re-enter a key if needed.

**Browser shows "This site can't be reached"**
The app isn't running. Look at the terminal — does it still say "is running"? If
not, run `npm start` again.

**Update says it can't apply the update / "local changes would be overwritten"**
A file got changed locally, so the update stopped rather than risk your work —
nothing was changed. Email Paul a screenshot; nothing is lost.

**Something else**
Email Paul with: (a) which step you're on, (b) what you typed, (c) the exact text
of any error message. A screenshot helps.

---

**Glossary**

- **Terminal** — a window where you type commands instead of clicking. Just text
  in, text out.
- **npm** — "Node Package Manager". Downloads the pieces the app needs. Comes
  with Node.js.
- **GitHub** — a website that stores code and tracks changes.
- **git** — the tool that copies the app down and fetches updates. Free on
  Mac (via Apple's Command Line Tools) and Windows (via Git for Windows).
- **Node** (capital N) — a newsroom-owned app on GROUNDED. This whole project is
  a Node.
- **Node.js** (with the .js) — the engine that runs the app. Different from a
  Node.
- **GROUNDED** — the wider AI infrastructure Develop AI is building for African
  newsrooms. This Node lives inside GROUNDED's family of apps.
- **ElevenLabs** — the AI service that clones a voice and turns text into speech.
- **Instant Voice Cloning** — ElevenLabs' fast cloning, which needs only 1–2
  minutes of clean audio (what this app uses).

---

**Getting help**

Email Paul at Develop AI. Include:
- What step you were on.
- What you expected to happen.
- What actually happened (paste any error messages exactly).
- A screenshot if you can.

You're not bothering him by asking. Setup questions are normal. The point of the
Nodes system is that newsrooms own their tools — and that means the first hour of
figuring it out is part of the job, for him too.
