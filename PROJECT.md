# Gym Coach Web App — project file

Fork of [openGym](https://github.com/DuarteSantos8/openGym) (AGPL-3.0). This is the one file for goal, notes, how-to and progress. Keep it current.

**Live app: https://bigchaka02.github.io/opengym/**

## Goal

A mobile-friendly **web app** (no install, no server) for one **coach** and their **clients**.

- **Coach** — the full, unmodified openGym UI. Picks a client (**Haitham** or **Aliaa**) from a dropdown and sees/changes everything for that client: plans, workouts, stats, settings.
- **Client** — a stripped-down UI with two bottom tabs: **Today** (the workout the coach assigned for today) and **Stats**.

## Ground rules (from the owner)

1. Change nothing in openGym except what's explicitly asked for. Coach UI = stock openGym + the profile icon + client dropdown. Nothing else.
2. Data security and privacy don't matter (just the owner and a friend). Client data lives in the repo (`data/`), and every change is written straight to it.
3. The coach has no account or data of his own — only a profile that acts on the client accounts.
4. Keep docs to this single file.

## How it works

- **GitHub Pages hosts the app; the repo is the database.** Each client is one file on `main`: `data/state-client1.json` (Haitham), `data/state-client2.json` (Aliaa) — names in `data/profiles.json`. Weights are in **lb**. Phones read and write those files directly through the GitHub API, so every synced change is a commit and every phone sees the same data — no server anywhere.
- **Profile picker** on every fresh launch: *Coach*, *Haitham*, *Aliaa*. Reloads within the same launch don't ask again.
- **Profile icon** at the top left of every page, with the profile's name (or "Coach") beside it, reopens the picker. For the coach, a **client dropdown** sits under it. The coach is simply working in whichever client's file the dropdown shows.
- **Client Today tab** opens today's assigned session directly on the stock workout screen, minus: the weigh-in prompt, the session clock, the ⌄ minimize button, Prev/Next (swipe between exercise cards instead), Add exercise, Add session note, and the bottom Finish button (the Finish pill in the header stays). A rest day or an already-finished session shows a simple card with the next session.
- **Client Stats tab** is the stock Stats page, plus the pages it links to (History, Structural balance, Muscles, Progress photos, Measurements).
- **Overscroll bounce:** the page rubber-bands back when pulled past the top or bottom (on for everyone; pull-to-refresh stays off so a long scroll can't reload mid-workout).
- Under the hood, `frontend/src/profiles/github-data.js` answers the app's server calls (`/api/me`, `/api/data`…) from the repo, porting the server's save rules exactly — so openGym's own sync (revisions, merging two phones' changes, checking for updates every 30 s and on app focus) runs unchanged. Changes are saved ~1.5 s after they're made; edits that don't change the saved profile (like ticking sets mid-workout) don't create commits.

## Setup (once per phone)

GitHub refuses to let a write key sit inside a public website (it detects and revokes it), so each phone stores the key itself:

1. **Make the key (once):** github.com → Settings → Developer settings → Fine-grained tokens → *Generate new token* (https://github.com/settings/personal-access-tokens/new). Repository access: *Only select repositories* → `Bigchaka02/opengym`. Permissions → Repository → **Contents: Read and write**. Longest expiry offered. Copy it.
2. **Your phone:** open the live app, paste the key, tap *Connect*.
3. **Your friend's phone:** in the app, tap the profile icon (top left) → *Share setup link for another phone* → send it. Opening that link connects his phone; no pasting.
4. Optional: *Add to Home Screen* for a full-screen app.

If the key expires or is revoked, the app asks for a new one.

## Maintain

**Publish code changes to the live site:** `scripts/profiles/deploy-pages.sh` (Git Bash on Windows) — builds the Pages version and pushes the `gh-pages` branch. Data on `main` is never touched by a deploy.

**Always `git pull --rebase` before pushing to `main`** — the phones commit data there.

**Local dev (hot reload):** `cd frontend && npm install && VITE_GITHUB_DATA=Bigchaka02/opengym npm run dev` → http://localhost:5173 (uses the real repo data; paste the key once).

**Add or rename clients:** edit `data/profiles.json`. A client with no `state-<id>.json` yet starts empty (and in kg — switch them in Settings → Units, or run the next line); the file is created on their first save.

**Switch units:** `node scripts/profiles/set-unit.mjs lb` (or `kg`, optionally followed by client ids) converts every stored weight exactly as the app's Settings → Units does, then commit and push `data/`.

**Reset the placeholder clients:** `node scripts/profiles/make-seed.mjs`, commit and push `data/` (12 weeks of Push/Pull/Legs history in lb from upstream's demo generator; Aliaa's is lighter, 8 weeks, Tue/Thu/Sat). This wipes what was logged.

**Self-hosted alternative (optional):** the original server setup still works — `docker compose up -d --build` → http://localhost:8080, client accounts from `PROFILES` in `.env` (default `client1:Haitham,client2:Aliaa`). It keeps its own copy of the data in `./data`.

**Pull upstream updates:** `git remote add upstream https://github.com/DuarteSantos8/openGym && git fetch upstream && git merge upstream/main`. Conflicts can only land in the files listed below.

## What changed vs upstream

| File | Change |
|---|---|
| `frontend/src/profiles/*` (new) | Picker + GitHub key setup, profile bar + client dropdown, client tab bar, client Today page, profile logic, GitHub data layer, CSS, tests |
| `frontend/src/lib/api.js` | Hands API calls to the GitHub data layer in the Pages build (one line) |
| `frontend/src/main.jsx` | Shows the picker and signs in before the app boots |
| `frontend/src/App.jsx` | Profile bar on every page; client routes + two-tab bar; wait for boot after a profile switch |
| `frontend/src/views/Workout.jsx` | For a client's live session: hides the clock, ⌄, Prev/Next, Add exercise, session note, bottom Finish |
| `frontend/src/index.css` | Overscroll bounce on (vertical `overscroll-behavior: contain` instead of `none`) |
| `api/server.js`, `api/openapi.yaml`, `api/test/*profiles*`, `api/package.json` | Self-hosted mode: `PROFILES` accounts, `GET /api/profiles`, `POST /api/profiles/login`, tests |
| `docker-compose.yml` | Builds local images instead of pulling upstream ones |
| `.gitignore`, `data/`, `scripts/profiles/*` | Client data in the repo, its generator, the Pages deploy script |

## Notes and decisions

- **kg → lb:** both clients' history was converted with the app's own unit switch, so converted weights land on values like 170.5 lb rather than round plate numbers. New entries follow the plan's lb steps.
- **"The timer"** was read as the session clock in the workout header — hidden for clients. The **rest timer** between sets still runs (it's a core feature). Say the word to remove it too.
- **Opening the Today tab starts the session** (that's what "show the begin-workout screen" means). So the logged duration runs from when the client opened the tab, not their first set.
- **In-progress workouts stay on the phone** they were started on (upstream behaviour); the repo gets the workout when it's finished. On one shared test phone, a session started as a client still shows as running when you switch to the coach for that same client.
- **Two phones editing the same client at the same moment** is handled: GitHub refuses a save over a file that changed since that phone read it, and the app merges both changes and saves again.
- **Switching profile or client reloads the page.** Anything not yet saved is pushed first.
- **Coach Settings → Sign out** has nothing to sign out of here; reloading the page puts you back.
- **Limits:** GitHub allows 5,000 API calls/hour per key — normal use is far below that (update checks that find nothing new are free). A client file over ~1 MB still works (fetched raw), but that's years of logging.
- Upstream test `sheets.day-note.test.jsx` (calendar day-note) fails on upstream's own code as of this fork — not ours.

## Tasks and progress

- [x] Fork openGym → `Bigchaka02/opengym`
- [x] Web app with profile picker at start (Coach, Client 1, Client 2)
- [x] Profile icon top left; client dropdown under it for the coach
- [x] Coach: stock UI, acting on the selected client's data
- [x] Client: two tabs — Today (workout screen, no weigh-in, no clock) and Stats
- [x] Live on GitHub Pages; data read/written straight to `data/` in the repo, no server
- [x] Tests: API 653/653 pass (3 skipped); frontend all pass except the upstream day-note test above; two-phone sync tested against a simulated GitHub API
- [x] Owner connected phones; live sync confirmed (commits from the app on `main`)
- [x] Clients renamed Haitham / Aliaa; profile name beside the icon; everything in lb
- [x] Client workout decluttered (no ⌄, Prev/Next, Add exercise, session note, bottom Finish); overscroll bounce
- [ ] Owner to describe the "handful of other small features" for clients
