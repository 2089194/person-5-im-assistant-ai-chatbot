# Nexus — AI Chief of Staff

A Persona-inspired chat UI (jagged bubbles, animated zigzag "spine", comic-panel styling) backed by a real Node/Express server. Nexus is a Claude-powered assistant with genuine tool-use access to **Linear**, **Outlook Calendar**, and **Outlook Mail** — plus file attachments (images, PDFs, text).

## What's real here

- The frontend never touches your API keys — everything sensitive lives server-side in env vars.
- Claude is given real tool definitions (`linear_search_issues`, `calendar_create_event`, `outlook_send_email`, etc.). When it calls one, the server actually executes it against the real API and feeds the result back to Claude in an agentic loop.
- If Linear/Microsoft aren't configured, those tools simply aren't offered to Claude, and it will draft things (like an email body) instead of claiming to have sent them.

---

## Option A: Deploy to Render (so it works on your phone)

Render gives you a free, public HTTPS URL — no server to babysit, works from any device.

### 1. Push this project to GitHub
```bash
cd nexus-assistant
git init
git add .
git commit -m "Nexus assistant"
```
Create a new empty repo on https://github.com/new, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/nexus-assistant.git
git branch -M main
git push -u origin main
```

### 2. Create the Render service
1. Go to https://render.com and sign up / log in (free).
2. **New +** → **Web Service** → connect your GitHub account → pick the `nexus-assistant` repo. Render will detect `render.yaml` automatically and prompt you to create the service from it.
3. It'll ask you to fill in the env vars marked `sync: false` — you can leave `LINEAR_API_KEY` / `MICROSOFT_*` blank for now and add them after the first deploy once you have your app's live URL (needed for the Microsoft redirect URI — see below).
4. Click **Deploy**. First deploy takes a couple of minutes. You'll get a URL like `https://nexus-assistant-xxxx.onrender.com`.

### 3. Add your API keys
In the Render dashboard → your service → **Environment**:
- **`ANTHROPIC_API_KEY`** — from https://console.anthropic.com
- **`LINEAR_API_KEY`** — optional, from https://linear.app/settings/api
- **`MICROSOFT_CLIENT_ID`** / **`MICROSOFT_CLIENT_SECRET`** / **`MICROSOFT_REDIRECT_URI`** — see step 4 below

### 4. Set up Microsoft (Outlook) OAuth
1. Go to https://portal.azure.com → **App registrations** → **New registration**.
   - Name: anything, e.g. "Nexus Assistant"
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: type **Web**, value = `https://YOUR-RENDER-URL.onrender.com/auth/microsoft/callback` (use your actual Render URL from step 2)
2. **Certificates & secrets** → **New client secret** → copy the **Value** (not the ID).
3. **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → add: `Mail.Send`, `Calendars.ReadWrite`, `offline_access`, `User.Read`. Click **Grant admin consent** if you're on a work/school account.
4. Copy the **Application (client) ID** from the Overview page.
5. Back in Render, set:
   - `MICROSOFT_CLIENT_ID` = the Application (client) ID
   - `MICROSOFT_CLIENT_SECRET` = the secret value from step 2
   - `MICROSOFT_REDIRECT_URI` = `https://YOUR-RENDER-URL.onrender.com/auth/microsoft/callback`
6. Render will redeploy automatically after you save env vars.

### 5. Open it on your phone
Just visit your Render URL in your phone's browser — `https://YOUR-RENDER-URL.onrender.com`. Tap **Add to Home Screen** in your browser's share menu for an app-like icon.

Tap the **Outlook** pill in the header to connect your Microsoft account (first time only).

**Note on free tier:** Render's free web services spin down after ~15 min of inactivity and take a few seconds to wake back up on the next request — that's normal, not a bug. Also, the OAuth token file (`tokens.json`) lives on local disk, which is wiped on redeploys (not on simple restarts/sleep) — if that happens, just reconnect Outlook via the pill again.

---

## Option B: Run locally first (recommended before deploying)

```bash
cd nexus-assistant
npm install
cp .env.example .env
# fill in .env with your keys, using http://localhost:3000/auth/microsoft/callback
# as the Azure redirect URI for local testing
npm start
```
Open http://localhost:3000.

---

## Slash commands

- `/checkin` — morning review
- `/triage` — sort a task/email dump into Immediate Action / Delegate / Archive
- `/done` — log the output of a finished meeting or focus block
- `/observe` — surface `[BIZ]/[OPS]/[DEV]/[PAT]` observations with confidence scores

## Project layout

```
nexus-assistant/
├── public/
│   └── index.html          # the whole frontend (UI, attachments, status pills)
├── server/
│   ├── index.js             # express app entry point
│   ├── routes/
│   │   ├── chat.js          # POST /api/chat — the agent loop endpoint
│   │   └── auth.js          # GET /auth/microsoft, /auth/microsoft/callback, /api/status
│   ├── services/
│   │   ├── claude.js        # Claude API + tool-use loop
│   │   ├── linear.js        # Linear GraphQL calls
│   │   └── outlook.js       # Microsoft OAuth + Mail + Calendar (Graph API)
│   └── tools/
│       └── definitions.js   # tool schemas handed to Claude
├── render.yaml               # Render deploy blueprint
├── .env.example
└── package.json
```

## Notes & limits

- This is a single-user app — conversation history lives in the browser tab (refresh clears it), and Outlook tokens live in one shared `tokens.json` file on the server's disk.
- Attachments are sent inline as base64 in the request body (25MB request limit) — fine for typical images/PDFs, not built for huge files.
- Linear "create issue" resolves your team by its short key (e.g. `ENG`) — ask Nexus to list your teams first if you're not sure of yours.
