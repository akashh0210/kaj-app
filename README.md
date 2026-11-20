# KAJ – Contract-to-Cash Desk for AMC Service Businesses

> Mobile-first PWA · Gemini on Vertex AI · Cloud Run

**KAJ** is an AI-assisted workflow tool for Air Conditioning and HVAC Annual Maintenance Contract (AMC) service businesses. The promise: *no forms* — people talk, snap or tap; the AI fills the rest; humans only confirm.

## Live demo

**https://kaj-928520890495.asia-south1.run.app**

- Opens as the **Owner**. Tap the role button (top right) to switch to **Technician**.
- Technician: open a visit, allow the microphone, record a voice note (works on phones; Cloud Run serves HTTPS).
- Owner: Contracts → **+ Add** → upload a contract photo or PDF (try the files in `demo-data/KAJ_Demo_Data/`).
- Demo data is seeded on start. Changes you make are kept while the service runs (see [Demo vs production](#demo-vs-production)).

---

## Screens

| Role | Screens |
|------|---------|
| **Owner** | Today dashboard (counts and rupee totals), Contracts (AI extraction), Bills & Payments (reminders), Daily Digest |
| **Technician** | Today's visits, one big mic button, optional unit photo, English/বাংলা toggle |

Switch roles with the toggle in the top bar (demo mode, no login).

---

## AI: Gemini on Vertex AI

| | |
|---|---|
| Access | **Vertex AI** (`GEMINI_USE_VERTEX=true`), location `global`, Application Default Credentials. No API key: on Cloud Run the service account has `roles/aiplatform.user`. An API-key mode (`GEMINI_API_KEY`) is still supported. |
| Main model | **`gemini-3.8-flash`** reads first: contracts (PDF, photo or text) and voice notes, with structured JSON output (`responseSchema`). Same accuracy as Hydrogen on the test files and about 8× faster live (see below). |
| Second model | **`gemini-4-hydrogen`**: (1) a second opinion when the main model flags more than 2 fields: the two answers are compared field by field, the main model's values are kept, and every field where they differ is flagged "Two AI models disagreed; please check"; (2) a stand-in when the main model times out or is overloaded. |
| Time limit | Each Gemini call gets **20 s** (`GEMINI_TIMEOUT_MS`). On a timeout, 429 or 503/504 the app goes straight to the other model instead of waiting; only brief glitches (500/502, dropped connection) get one quick retry. Hydrogen often needs longer than 20 s live, so its second opinion may time out; the main model's answer is then kept and the timeout is logged. |
| Saved results | The same file (SHA-256) uploaded again by the same business reuses the saved result: no API call, badge "Read by Gemini (saved result)". Kept in memory, up to 200 results; only successful Gemini reads are saved. |
| Not used | `gemini-4-carbon` was tested as a stronger second model but returned `403 Access requires an eligible paid billing account in a supported region` on this project. |
| Code, not AI | Visit schedule, renewal date, days overdue, rupee totals, site-to-visit matching and all validation are computed in code. |

Every contract result carries `extraction_method` (e.g. `gemini:gemini-3.8-flash`, `saved:gemini:gemini-3.8-flash` for a reused result, or `fallback_parser` if Gemini failed)
and an `extraction_log` explaining any second-model retry, for example
`gemini-3.8-flash flagged 3 fields (more than 2)`, with the list of fields where the two models disagreed.
The contract screen shows both under a "Read by …" badge.

## Speed and accuracy on the live site (2026-11-20)

Contract and voice times measured on Cloud Run, one request at a time, timed from upload to answer.

| | Hydrogen first, 60 s waits (before) | **Flash first, 20 s switch (now)** |
|---|---|---|
| Contract uploads C1, C2, C4 photo | median 64.6 s, range 55.1–108.1 s (Vertex 504/429 retries) | **median 7.7 s, range 5.9–17.2 s** |
| Voice notes V1, V2, V3 | median 19.4 s, range 13.3–37.5 s | **median 5.7 s, range 4.8–6.0 s** |
| Repeat upload of the same file | 79.5 s (no cache) | **0.1 s** (saved result) |
| Accuracy C1 / C2 / C4 photo | 10/10, 8/8, 9/9 | **10/10, 8/8, 9/9** (scored on the live site) |

## Accuracy detail (live tests, 2026-11-20)

The tables below were measured with Hydrogen as the main model; Flash as the main model gives the same contract scores.

Real Gemini calls, scored against `demo-data/KAJ_Demo_Data/AnswerKey.csv`.

**Contracts**

| File | Read by | Result |
|------|---------|--------|
| C1 Greenview (PDF) | gemini-4-hydrogen | **10/10** fields, no flags (as expected) |
| C2 Ballygunge Dental (PDF) | gemini-4-hydrogen | **8/8**, start date, missing end date and renewal flagged (as expected) |
| C4 New Town (hand-copied, phone photo) | gemini-4-hydrogen | **9/9** |
| C5 Behala Nursing Home (PDF, on the live Cloud Run site) | gemini-3.8-flash (under the old rule, the second opinion with fewer flags was kept) | **10/10**, missing contract value flagged (as expected) |

Before the `visit_frequency` enum was added, C1 scored 9/10 ("Quarterly (4 visits per year)").

**Voice notes**

| Note | Language | Read by | Result |
|------|----------|---------|--------|
| V1 Greenview | Bengali | gemini-3.8-flash* | **4/4**: 4 split serviced, 2 pending, gas top-up ×1 |
| V2 Park Street | Hindi | gemini-3.8-flash* | **3/3**: 4 cassette serviced, filter replacement ×1 |
| V3 New Town | Mixed | gemini-4-hydrogen | **4/4** values: 5 AC, pending not stated (flagged), compressor noise flagged as follow-up. The scorer first missed "Newtown" vs "New Town"; fixed in the app and the test. |
| V4 Ballygunge Dental | Hindi | gemini-4-hydrogen | **2/3**: right count (3), no extras; type came back "AC" not "split AC" because the note does not say "split" (flagged, not guessed) |
| V5 vague note | Bengali | gemini-4-hydrogen | **2/2**: site and units left empty and flagged, nothing guessed |

\* The main model's free-tier daily quota (API-key mode, before the move to Vertex) was used up, so these went to the second model.

**Payments:** days overdue on 2026-11-20 are I1 = 36, I2 = 10, I3 not yet due, all matching the answer key
(an off-by-one timezone bug was found and fixed during testing).

---

## Quick Start (Local)

### 1. Prerequisites

- Node.js 20+
- Python 3 with `pypdf` (`pip install pypdf`), used to read PDF text for the fallback parser
- Gemini access, either:
  - **Vertex AI** (recommended): a Google Cloud project with `aiplatform.googleapis.com` enabled, and
    `gcloud auth application-default login`; or
  - a Gemini API key
- Optional: a Firebase project with Firestore. Without it the server uses a local JSON store
  at `data/local_db.json` (already seeded).

### 2. Configure environment

```bash
cp .env.example .env
# Fill in the values in .env
```

Key variables:

| Variable | Description |
|----------|-------------|
| `GEMINI_USE_VERTEX` | `true` to use Vertex AI with Application Default Credentials (no API key) |
| `GOOGLE_CLOUD_PROJECT` | Project for Vertex AI |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI location (default `global`) |
| `GEMINI_MODEL` | Main model (we use `gemini-3.8-flash`, also the default) |
| `GEMINI_FALLBACK_MODEL` | Second model (we use `gemini-4-hydrogen`). If unset, second opinions and stand-ins are skipped. |
| `GEMINI_TIMEOUT_MS` | Per-call time limit before switching model (default `20000`) |
| `GEMINI_API_KEY` | Only for API-key mode (never logged) |
| `KAJ_STORE` | `local` forces the local JSON store (used on Cloud Run for the demo) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firestore service account (production) |
| `VITE_FIREBASE_*` | Firebase web config (browser) |
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
3. If more than 2 fields are flagged, it asks `GEMINI_FALLBACK_MODEL` for a second opinion and compares
   the two field by field. Where they agree the value is kept; where they disagree the main model's value is
   kept and the field is flagged "Two AI models disagreed; please check" (with both values). Wording-only
   differences (case, "Split AC units" vs "split AC") count as agreement. The reason and the list of
   disagreements are logged and shown on screen.
4. Each call has 20 s. A timeout, 429 or 503/504 switches straight to the other model; brief glitches get
   one quick retry. A file already read before (same SHA-256) reuses the saved result with no API call.
5. Only if Gemini fails completely does a rule-based parser run. It adds
   "AI extraction failed; please check all fields". An upload where nothing could be read is
   marked `extraction_failed` and cannot be saved.
6. Code normalises the frequency and computes `visit_schedule` and `renewal_reminder_date` (never the AI).
7. The screen shows which model read it, flagged fields in amber, then the owner taps **Confirm**.
   Edits are validated, recompute the schedule and renewal date, and are audit-logged.

## Voice Note Flow (technician)

1. Technician taps a visit, optionally adds a photo of the unit, and records a voice note
   (Bengali, Hindi or English). The recorder picks a format the browser supports (webm, or mp4 on iPhone).
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
| `KAJ_BASE_URL=https://… NODE_ENV=test node tests/test_step6_live.js …` | Same scoring against a deployed site |
| `node tests/test_second_opinion.js` | Second-opinion merge with **mocked** C5 answers (no network): disagreements flagged, main values kept, no retry at 2 flags, stand-in on 503 |
| `NODE_ENV=test node tests/test_voice_live.js [V1 V2 …]` | **Live Gemini** voice extraction of `v1.ogg`–`v5.ogg` (or the ones named), scored against the V rows of `AnswerKey.csv` |
| `node tests/test_step3.js`, `test_step4.js`, `test_step5.js` | Earlier step tests (extraction, visit confirmation, rate-card billing) |

The live tests make real Gemini calls (Vertex AI or API key, whichever `.env` selects) and print
`extraction_method` for every file, so you can see which model, or the fallback parser, answered.
In API-key mode on the free tier, `gemini-4-hydrogen` allows only 20 requests per day.

## Accessibility and language

- All interactive cards and fields are real buttons with labels; keyboard focus is always visible.
- Dialogs close with Escape; recording and processing states are announced to screen readers.
- Respects "reduce motion".
- Technician screen has an English/বাংলা toggle, remembered on the device. Strings live in
  `src/i18n/technician.js`; the Bengali has not yet been reviewed by a native speaker.
  Job summaries stay in English because they are for the owner.

---

## Deploy to Cloud Run

The live demo runs as Cloud Run service `kaj` in `asia-south1`, built from source with the `Dockerfile`.

```bash
./deploy.sh YOUR_PROJECT_ID asia-south1
```

`deploy.sh` runs `gcloud run deploy kaj --source .` with Vertex mode (`GEMINI_USE_VERTEX=true`,
`GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=global`), the two models, `KAJ_STORE=local`,
`--min-instances 1 --max-instances 1 --memory 512Mi --allow-unauthenticated`. Env vars go through a temporary
file that is deleted afterwards; no API key or secret is sent.

One-time project setup:
- Enable Cloud Run, Cloud Build, Artifact Registry and Vertex AI (`aiplatform.googleapis.com`).
- Grant the Cloud Run service account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`)
  `roles/aiplatform.user` (call Gemini) and `roles/run.builder` (source builds in new projects).

On start the container runs `scripts/seed-if-empty.js` (seeds demo data into an empty local store),
then the server.

**Fresh seed for a new day** (new revision → new container → demo data dated today, India time; anything added on the site is cleared):

```powershell
gcloud run services update kaj --region asia-south1 --project kaj-app-515307 --update-env-vars "RESTARTED_AT=$(Get-Date -Format yyyyMMdd-HHmm)"
```
In bash use `$(date +%Y%m%d-%H%M)`.

### Demo vs production

| | Demo (live URL) | Production (planned) |
|---|---|---|
| Data store | **In-memory** local JSON store inside the one Cloud Run instance (`KAJ_STORE=local`) | **Firestore**, scoped by `tenant_id` (already supported by `db.js`) |
| Persistence | Kept while the instance runs (`--min-instances 1` stops it scaling to zero). Lost on redeploy or restart, then re-seeded. | Durable |
| Uploaded files | Instance memory | Cloud Storage |
| Scaling | Exactly one instance (`--max-instances 1`) so everyone sees the same data | Many instances share Firestore |
| Login | Role toggle, no auth | Firebase Auth per business |

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
│   ├── seed-if-empty.js          # Container start: seed an empty local store
│   └── extract_pdf.py            # PDF text for the fallback parser
├── tests/                        # Step tests + live Gemini tests
├── demo-data/KAJ_Demo_Data/      # Contracts, invoices, C4 photo, voice notes, AnswerKey.csv
├── data/local_db.json            # Local store used when Firestore is not configured
├── uploads/                      # Uploaded files (git-ignored)
├── server.js                     # Express API + Gemini integration (Vertex AI or API key)
├── db.js                         # Firestore or local JSON store
├── Dockerfile                    # Multi-stage Docker build
├── deploy.sh                     # Cloud Run deploy (Vertex, demo settings)
├── .gcloudignore                 # Keeps .env and local data out of uploads
└── .env.example                  # Environment variable template
```

---

## Demo Data (seeded on start / by `npm run seed`)

- **Provider:** Das Cooling Services
- **4 Contracts:** Greenview Housing Society (C1, quarterly), Ballygunge Dental Clinic (C2, monthly,
  flagged: only one date, no end date), Park Street Flavours Cafe (C3, half-yearly),
  New Town IT Office (C4, quarterly, **renewal reminder 2026-12-01**, so "Renewals in 30 days" has data)
- **7 Visits:** two dated the day the seed runs, plus past (done) and upcoming visits
- **3 Invoices:** Greenview 36 days overdue, Park Street 10 days overdue, New Town not yet due (on 2026-11-20)
- **2 Unbilled extras:** gas top-up (Rs 1,800) and filter replacement (Rs 450) from voice notes

C5 (Behala Nursing Home) is left out on purpose so it can be uploaded live. The app-screens skill
asks for 5 contracts and 8 visits; the seed has 4 and 7.

---

## KAJ Guardrails

See `.agents/skills/kaj-guardrails/SKILL.md` for the full rules. Summary:

> KAJ is a workflow tool, not a chatbot. The AI proposes, code checks, the owner approves, then the system acts.
