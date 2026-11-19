# KAJ – Contract-to-Cash Desk for AMC Service Businesses

> Mobile-first PWA · Firestore · Gemini AI · Cloud Run

**KAJ** is an AI-assisted workflow tool for Air Conditioning and HVAC Annual Maintenance Contract (AMC) service businesses. The promise: *no forms* — people talk, snap or tap; the AI fills the rest; humans only confirm.

---

## Screens

| Role | Screens |
|------|---------|
| **Owner** | Today dashboard, Contracts (AI extraction), Bills & Payments, Daily Digest |
| **Technician** | Today's visits list, one-tap voice recording |

Switch roles with the toggle in the top bar (demo mode).

---

## Quick Start (Local)

### 1. Prerequisites

- Node.js 20+
- A Firebase project with Firestore enabled
- A Gemini API key

### 2. Configure environment

```bash
cp .env.example .env
# Fill in all values in .env
```

Key variables:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Your Gemini API key |
| `GEMINI_MODEL` | Model name (default: `gemini-4-hydrogen`) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `VITE_FIREBASE_API_KEY` | Firebase web API key (browser) |
| `VITE_FIREBASE_PROJECT_ID` | Same project ID (browser) |
| `TENANT_ID` | Tenant slug (default: `das-cooling-services`) |

### 3. Install and seed

```bash
npm install
npm run seed      # Seeds Firestore with 1 provider, 5 contracts, 8 visits, 3 invoices
```

### 4. Run locally

```bash
# Terminal 1 – Vite dev server (frontend)
npm run dev

# Terminal 2 – Express API server (backend)
node server.js
```

Open http://localhost:5173 (Vite proxies `/api` → Express on port 3001).

---

## Contract Extraction Flow

1. Owner uploads a photo/PDF or pastes contract text on the **Contracts** screen.
2. The backend sends it to **Gemini 4 Hydrogen** with a strict JSON schema prompt.
3. If more than 2 fields are flagged, the backend retries with **Gemini 4 Carbon** and keeps the result with fewer flags.
4. `visit_schedule` and `renewal_reminder_date` are **computed by code** (never by AI).
5. Flagged fields are highlighted in amber on the confirmation screen.
6. Owner taps **Confirm** (or edits a field first). Every edit is audit-logged.

### Guardrails implemented

- ✅ AI never invents values — missing fields → `null` + `needs_review` note
- ✅ Dates validated by code (not AI)
- ✅ Every record keeps `source_ref` and `tenant_id`
- ✅ Audit log on every confirm, edit, approve
- ✅ WhatsApp reminders only after explicit owner Approve tap
- ✅ Reminder sending suggested only 09:00–20:00 IST
- ✅ All reads/writes scoped by `tenant_id`
- ✅ Document content treated as data (prompt injection hardened)

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
│   ├── App.jsx                   # Role toggle + navigation
│   ├── api.js                    # API client helpers
│   ├── firebase.js               # Firebase client SDK
│   └── index.css                 # Mobile-first styles
├── scripts/
│   └── seed.js                   # Firestore demo data seeder
├── server.js                     # Express API + Gemini integration
├── Dockerfile                    # Multi-stage Docker build
├── deploy.sh                     # Cloud Run deploy script
└── .env.example                  # Environment variable template
```

---

## Demo Data (seeded by `npm run seed`)

- **Provider:** Das Cooling Services
- **5 Contracts:** Greenview Housing Society (quarterly), Sunrise Office Park (monthly), City Hospital (monthly), Metro Mall (half-yearly), Sen Air Solutions (pending review — missing end date)
- **8 Visits:** Mix of done, scheduled, and upcoming across today and nearby dates
- **3 Invoices:** One 36+ days overdue (Greenview), one 10 days overdue (Sunrise), one upcoming (City Hospital)
- **1 Renewal:** Sunrise Office Park renewal coming in ~12 days

Every dashboard card has real data to show on first load.

---

## KAJ Guardrails

See `.agents/skills/kaj-guardrails/SKILL.md` for the full rules. Summary:

> KAJ is a workflow tool, not a chatbot. The AI proposes, code checks, the owner approves, then the system acts.
