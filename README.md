# KAJ – Contract-to-Cash Desk for AMC Service Businesses

> Mobile-first PWA · Firestore · Gemini AI · Cloud Run

**KAJ** is an AI-assisted workflow tool for Air Conditioning and HVAC Annual Maintenance Contract (AMC) service businesses. The promise: *no forms* — people talk, snap or tap; the AI fills the rest; humans only confirm.

---

## Screens

| Role | Screens |
|------|---------|
| **Owner** | Today dashboard (counts and rupee totals), Contracts (AI extraction), Bills & Payments (reminders), Daily Digest |
| **Technician** | Today's visits, one big mic button, optional unit photo, English/বাংলা toggle |

Switch roles with the toggle in the top bar (demo mode, no login).

---

## Quick Start (Local)

### 1. Prerequisites

- Node.js 20+
- Python 3 with `pypdf` (`pip install pypdf`), used to read PDF text for the fallback parser
- A Gemini API key
- Optional: a Firebase project with Firestore. Without valid Firebase credentials the server
  uses a local JSON store at `data/local_db.json` (already seeded), which is enough for a demo.

### 2. Configure environment

```bash
cp .env.example .env
# Fill in all values in .env
```

Key variables:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Your Gemini API key (never logged) |
| `GEMINI_MODEL` | Main model (default: `gemini-4-hydrogen`) |
| `GEMINI_USE_VERTEX` | `true` to call Gemini through Vertex AI with Application Default Credentials (no API key). Needs `GOOGLE_CLOUD_PROJECT`; `GOOGLE_CLOUD_LOCATION` defaults to `global`. On Cloud Run the service account needs `roles/aiplatform.user`. |
| `GEMINI_FALLBACK_MODEL` | Second model, used when the main one is overloaded or out of quota, and for the "too many flags" retry. If unset, those steps are skipped. |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `VITE_FIREBASE_API_KEY` | Firebase web API key (browser) |
| `VITE_FIREBASE_PROJECT_ID` | Same project ID (browser) |
| `TENANT_ID` | Tenant slug (default: `das-cooling-services`) |

### 3. Install and seed

```bash
npm install
npm run seed      # Re-seeds the demo data (see "Demo data" below)
```

Run `npm run seed` again on the day of a demo: today's visits are stamped with the date the seed runs.

### 4. Run locally

```bash
# Terminal 1 – Vite dev server (frontend, hot reload)
npm run dev

# Terminal 2 – Express API server (backend)
node server.js
```

Open http://localhost:5173 (Vite proxies `/api` → Express on port 3001).

Or build once and let Express serve everything: `npm run build && node server.js`, then open http://localhost:3001.

---

## Contract Extraction Flow

1. Owner uploads a photo/PDF or pastes contract text on the **Contracts** screen. The file is
   stored under a unique name and kept as the record's `source_ref`.
2. The backend sends the file itself (image or PDF) or the text to `GEMINI_MODEL` with a
   `responseSchema` (structured JSON; `visit_frequency` is an enum: Monthly, Quarterly, Half-yearly, Yearly).
3. If more than 2 fields are flagged, it retries with `GEMINI_FALLBACK_MODEL` and keeps the result with fewer flags.
4. Transient errors (429/5xx/overload) are retried with backoff; if the main model stays unavailable
   or its daily quota is used up, the fallback model is tried.
5. Only if Gemini fails completely does a rule-based parser run. It adds
   "AI extraction failed; please check all fields". An upload where nothing could be read is
   marked `extraction_failed` and cannot be saved.
6. Code normalises the frequency and computes `visit_schedule` and `renewal_reminder_date` (never the AI).
7. The screen shows which reader was used (badge such as "Read by Gemini 4 Hydrogen"),
   flagged fields in amber, then the owner taps **Confirm**. Edits are validated, recompute the
   schedule and renewal date, and are audit-logged.

## Voice Note Flow (technician)

1. Technician taps a visit, optionally adds a photo of the unit, and records a voice note
   (Bengali, Hindi or English). The recorder picks a format the browser supports (webm or mp4 on iPhone).
2. The audio goes straight to Gemini with a `responseSchema`; there is no separate transcription step.
3. Code checks the result: the site named must match the visit that was tapped, quantities must be
   whole numbers, and missing site or unit counts are flagged. Vague notes come back flagged, not guessed.
4. Technician sees a summary card with **Confirm** or **Re-record**. If the AI is busy, the recording is
   kept and they can tap **Try again**.
5. Extra work becomes draft bill lines priced from the rate card; items not on the card wait for the owner's price.
   A visit is marked done only after the owner confirms it.

## Dates and money

- "Today" and days overdue use the India date (IST). Example: invoice due 2026-10-15 is 36 days overdue on 2026-11-20.
- Dashboard rupee totals are sums of stored base amounts. GST is never calculated; cards say "Amounts are before GST".

### Guardrails implemented

- ✅ AI never invents values — missing fields → `null` + `needs_review` note
- ✅ Dates validated by code (not AI)
- ✅ Every record keeps `source_ref` and `tenant_id`
- ✅ Audit log on every confirm, edit, approve
- ✅ WhatsApp reminders only after explicit owner Approve tap
- ✅ Reminder sending suggested only 09:00–20:00 IST
- ✅ All reads/writes scoped by `tenant_id`
- ✅ Document content treated as data (prompt injection hardened)
- ✅ A failed extraction is flagged, never saved as an empty record

---

## Tests

| Command | What it checks |
|---------|----------------|
| `NODE_ENV=test node tests/test_step6_live.js` | **Live Gemini** contract extraction of C1 and C2 through the real upload route, scored against `AnswerKey.csv`; also checks upload names are unique |
| `NODE_ENV=test node tests/test_step6_live.js "demo-data/KAJ_Demo_Data/C4_photo.jpeg=C4"` | Same, plus a contract photo (hand-copied C4 contract, photographed) |
| `NODE_ENV=test node tests/test_voice_live.js` | **Live Gemini** voice extraction of `v1.ogg`–`v5.ogg`, scored against the V rows of `AnswerKey.csv` |
| `node tests/test_step3.js`, `test_step4.js`, `test_step5.js` | Earlier step tests (extraction, visit confirmation, rate-card billing) |

The live tests make real API calls. On the free tier `gemini-4-hydrogen` allows **20 requests per day**,
so a full run of both live tests uses about half of it. They print `extraction_method` for every file, so you can
see whether Gemini or the fallback parser answered.

## Accessibility and language

- All interactive cards and fields are real buttons with labels; keyboard focus is always visible.
- Dialogs close with Escape; recording and processing states are announced to screen readers.
- Respects "reduce motion".
- Technician screen has an English/বাংলা toggle, remembered on the device. Strings live in
  `src/i18n/technician.js`; the Bengali has not yet been reviewed by a native speaker.
  Job summaries stay in English because they are for the owner.

---

## Deploy to Cloud Run

### Prerequisites

- `gcloud` CLI installed and authenticated
- Docker (or Cloud Build)

```bash
# Option A: Use the deploy script
chmod +x deploy.sh
./deploy.sh YOUR_PROJECT_ID asia-south1

# Option B: Manual
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/kaj-app .
gcloud run deploy kaj-app \
  --image gcr.io/YOUR_PROJECT_ID/kaj-app \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,...
```

> Store secrets in **Google Secret Manager** and reference them with `--set-secrets`.

With Vertex mode no API key is needed on Cloud Run. Set `GEMINI_USE_VERTEX=true`, `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_LOCATION` and `KAJ_STORE=local` (demo without Firestore; the container seeds demo data on start,
and data lives in memory until the instance restarts). For `--source` deploys the Cloud Run service account also
needs `roles/run.builder` in new projects.

### After deploy

1. Set the `VITE_FIREBASE_*` env vars in `.env` and rebuild (`npm run build`).
2. Run `npm run seed` to populate Firestore.
3. The Cloud Run URL is printed at the end of `deploy.sh`.

---

## Project Structure

```
kaj-app/
├── src/
│   ├── pages/
│   │   ├── TodayScreen.jsx       # Owner dashboard
│   │   ├── ContractsScreen.jsx   # Contract list + AI extraction
│   │   ├── BillsScreen.jsx       # Invoices + payment reminders
│   │   ├── DigestScreen.jsx      # Daily digest + WhatsApp share
│   │   └── TechnicianScreen.jsx  # Technician visits + voice recording
│   ├── components/               # LoadError (retry on failed loads), useEscape
│   ├── i18n/technician.js        # English / Bengali strings
│   ├── App.jsx                   # Role toggle + navigation
│   ├── api.js                    # API client helpers
│   ├── firebase.js               # Firebase client SDK
│   └── index.css                 # Mobile-first styles
├── scripts/
│   ├── seed.js                   # Demo data seeder (Firestore or local store)
│   └── extract_pdf.py            # PDF text for the fallback parser
├── tests/                        # Step tests + live Gemini tests
├── demo-data/KAJ_Demo_Data/      # Contracts, invoices, voice notes, AnswerKey.csv
├── data/local_db.json            # Local store used when Firestore is not configured
├── uploads/                      # Uploaded files (git-ignored)
├── server.js                     # Express API + Gemini integration
├── db.js                         # Firestore or local JSON store
├── Dockerfile                    # Multi-stage Docker build
├── deploy.sh                     # Cloud Run deploy script
└── .env.example                  # Environment variable template
```

---

## Demo Data (seeded by `npm run seed`)

- **Provider:** Das Cooling Services
- **3 Contracts:** Greenview Housing Society (C1, quarterly), Ballygunge Dental Clinic (C2, monthly,
  flagged: only one date, no end date), Park Street Flavours Cafe (C3, half-yearly)
- **7 Visits:** two dated the day the seed runs, plus past (done) and upcoming visits
- **3 Invoices:** Greenview 36 days overdue, Park Street 10 days overdue, New Town not yet due (on 2026-11-20)
- **2 Unbilled extras:** gas top-up (Rs 1,800) and filter replacement (Rs 450) from voice notes

Not yet covered by the seed (the app-screens skill asks for both):
- **No renewal within 30 days.** C4 (New Town, renewal 2026-12-01) would cover it but is not seeded;
  add it from the photo or `C4_newtown_office_COPY_BY_HAND.pdf` through the Contracts screen.
- **5 contracts / 8 visits** in the skill vs 3 / 7 seeded.

---

## KAJ Guardrails

See `.agents/skills/kaj-guardrails/SKILL.md` for the full rules. Summary:

> KAJ is a workflow tool, not a chatbot. The AI proposes, code checks, the owner approves, then the system acts.
