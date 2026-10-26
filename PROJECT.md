# Gym Coach Web App — project file

Fork of [openGym](https://github.com/DuarteSantos8/openGym) (AGPL-3.0). This is the one file for goal, notes, how-to and progress. Keep it current.

## Goal

A mobile-friendly **web app** (no install) for one **coach** and their **clients**.

- **Coach** — the full, unmodified openGym UI. Picks a client from a dropdown and sees/changes everything for that client: plans, workouts, stats, settings.
- **Client** — a stripped-down UI with two bottom tabs: **Today** (the workout the coach assigned for today) and **Stats**.

## Ground rules (from the owner)

1. Change nothing in openGym except what's explicitly asked for. Coach UI = stock openGym + the profile icon + client dropdown. Nothing else.
2. Data and security are not a concern. Client data lives in the repo (`data/`).
3. The coach has no account or data of his own — only a profile that acts on the client accounts.
4. Keep docs to this single file.

## How it works

- **Profile picker** on every fresh launch: *Coach*, *Client 1*, *Client 2*. Reloads within the same launch don't ask again.
- **Profile icon** at the top left of every page reopens the picker. For the coach, a **client dropdown** sits under it.
- Each client is a normal openGym account on the server (`client1`, `client2`). Picking a profile signs the browser in as that client with no passkey (`POST /api/profiles/login`). The coach is simply signed in as whichever client his dropdown shows.
- Client data is the server's normal per-user file: `data/state-client1.json`, `data/state-client2.json`, committed to the repo. Coach edits and client workouts sync through the server, so the coach's phone and the clients' phones all see the same data.
- **Client Today tab** opens today's assigned session directly on the stock workout screen, with no weigh-in prompt and no session clock. A rest day or an already-finished session shows a simple card with the next session.
- **Client Stats tab** is the stock Stats page, plus the pages it links to (History, Structural balance, Muscles, Progress photos, Measurements).

## Run it

**Local dev (hot reload)** — two terminals:

```bash
cd api && npm install && DATA_DIR=../data npm start        # Windows PowerShell: $env:DATA_DIR="../data"; npm start
cd frontend && npm install && npm run dev                  # open http://localhost:5173
```

**Docker (closest to production):**

```bash
cp .env.example .env
docker compose up -d --build                               # open http://localhost:8080
```

Compose always builds from this repo (`pull_policy: build`). Never use upstream's prebuilt images — they have no profiles.

**On a phone:** same Wi-Fi → `http://<your-PC-LAN-IP>:8080`. From anywhere, put it behind HTTPS (Tailscale, Cloudflare Tunnel, or a small VPS) and set `ORIGIN`/`RP_ID` in `.env` to that address. Add it to the home screen for a full-screen app.

**Reset the placeholder clients:** `node scripts/profiles/make-seed.mjs` rewrites both `data/state-*.json` (12 weeks of Push/Pull/Legs history from upstream's demo generator; Client 2 is lighter, 8 weeks, Tue/Thu/Sat). Stop the server first.

**Add or rename clients:** set `PROFILES` in `.env`, e.g. `PROFILES=client1:Sam,client2:Alex,client3:Jo`. New accounts are created on boot with empty data. `PROFILES=off` disables the profile system.

**Pull upstream updates:** `git remote add upstream https://github.com/DuarteSantos8/openGym && git fetch upstream && git merge upstream/main`. Conflicts can only land in the files listed below.

## What changed vs upstream

| File | Change |
|---|---|
| `frontend/src/profiles/*` (new) | Picker, profile bar + client dropdown, client tab bar, client Today page, profile/session logic, CSS, tests |
| `frontend/src/main.jsx` | Shows the picker and signs in before the app boots |
| `frontend/src/App.jsx` | Profile bar on every page; client routes + two-tab bar; wait for boot after a profile switch |
| `frontend/src/views/Workout.jsx` | Hides the session clock for clients (one line) |
| `api/server.js` | `PROFILES` accounts created on boot; `GET /api/profiles`, `POST /api/profiles/login` |
| `api/openapi.yaml`, `api/test/profiles.test.js`, `api/test/no-profiles.mjs`, `api/package.json` | Route docs, tests; upstream suites run with profiles off |
| `docker-compose.yml` | Builds local images instead of pulling upstream ones |
| `.gitignore`, `data/state-*.json`, `scripts/profiles/make-seed.mjs` | Client data in the repo + its generator |

## Notes and decisions

- **"The timer"** was read as the session clock in the workout header — hidden for clients. The **rest timer** between sets still runs (it's a core feature). Say the word to remove it too.
- **Opening the Today tab starts the session** (that's what "show the begin-workout screen" means). So the logged duration runs from when the client opened the tab, not their first set.
- **In-progress workouts stay on the device** they were started on (upstream behaviour). The coach sees a client's session once it's finished. On one shared test phone, a session started as a client still shows as running when you switch to the coach for that same client.
- **Switching profile or client reloads the page.** Anything not yet synced is pushed first, or kept aside by openGym and re-applied next time that client signs in on this device.
- **Server files not in git:** `data/db.json`, `secret`, `vapid.json`, `audit.log`, `uploads/` — regenerated on boot. Only the clients' workout data is committed. Running the server rewrites the `state-*.json` files, so commit them when you want to save progress to the repo.
- Upstream test `sheets.day-note.test.jsx` (calendar day-note) fails on upstream's own code as of this fork — not ours.

## Tasks and progress

- [x] Fork openGym → `Bigchaka02/opengym`
- [x] Web app with profile picker at start (Coach, Client 1, Client 2)
- [x] Profile icon top left; client dropdown under it for the coach
- [x] Coach: stock UI, acting on the selected client's data
- [x] Client: two tabs — Today (workout screen, no weigh-in, no clock) and Stats
- [x] Client data in the repo, synced through the server
- [x] Tests: API 656 pass; frontend 5,562 pass except the upstream day-note test above
- [ ] Owner to describe the "handful of other small features" for clients
- [ ] Decide on hosting so phones can reach it from anywhere
