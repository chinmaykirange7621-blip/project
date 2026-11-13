# ScholarAI – Intelligent Scholarship Assistant

> **"Your Future. Your Scholarship. One Intelligent Assistant."**

An end-to-end AI scholarship discovery, deterministic rule-based eligibility matching, and privacy-first Retrieval-Augmented Generation (RAG) web platform built for Indian students (B.Tech CSE AI&ML academic project).

---

## Key Highlights

- **100% Deterministic Eligibility Engine (Zero LLM Guesswork)**: Evaluates academic marks (with Indian CGPA-to-percentage conversion notes), annual family income ceilings, domicile states, social categories, education levels, courses (`B.Tech`, `B.E.`, `CSE`, `AI&ML`, `Diploma`, etc.), and gender criteria using pure Python rules—never LLM hallucination.
- **Hybrid RAG Search & Rational Agent Loop**:
  - `Perceive -> Interpret Intent -> Extract Entities -> Retrieve -> Evaluate Eligibility -> Reason -> Respond -> Explain`
  - Combines persistent **ChromaDB** cosine vector similarity with **SQLite** weighted keyword/BM25 and structured metadata filters via Reciprocal Rank Fusion (RRF).
  - Returns cited answers with inline source indices `[1]`, qualitative retrieval confidence (`High` / `Medium` / `Low`), honest limitations, follow-up questions when profile attributes are missing, an expandable **"How did AI reach this result?"** trace, and `"Final eligibility is decided by the provider."`
- **Pluggable AI Layer (`LLMProvider` & `EmbeddingProvider`) + Transparent Demo Mode**:
  - Live mode uses the official `google-genai` SDK (`GeminiProvider` via Interactions API + `gemini-3.8-flash` and `GeminiEmbeddingProvider` via `gemini-embedding-001`).
  - *Model note*: `gemini-3.8-flash` is configured by default in `.env.example` instead of legacy/deprecated `gemini-2.5-flash`. Model names can be changed anytime via `.env`.
  - When `GEMINI_API_KEY` is missing or unset, ScholarAI automatically runs `DemoProvider` + `DemoEmbeddingProvider` and displays a clear **"Demo Mode – no live LLM"** banner across the UI—never pretending a live LLM is active.
- **Knowledge-Graph-Ready Scholarship Dataset**:
  - `data/scholarships/schema.json` (JSON Schema Draft 2020-12) and `data/scholarships/scholarships.json` (23 schemes across NSP, Central Sector, AICTE Pragati/Saksham/Swanath, State portals, University waivers, and Private/CSR foundations).
  - Unverified records are explicitly tagged `source_status: "sample"` and labeled **"Sample data – verify on official site"** in the UI and citations. Unconfirmed deadlines and amounts remain `null` / `"Not available"` instead of fabricated values.
  - Knowledge triples (`Organization`, `Course`, `State`, `Document`, `KnowledgeEdge`) are synced in SQLite (PostgreSQL-compatible SQLAlchemy models).
- **Privacy-First by Design**:
  - Collects only non-identifying attributes (education level, course, CGPA/percentage, annual family income, domicile state, category, gender).
  - Regex PII scrubber redacts accidental Aadhaar numbers, PAN cards, Indian mobile numbers, emails, bank/IFSC details, and OTPs before processing.
  - No server-side personal student profile storage; browser state (`localStorage`) includes a one-click **"Clear my data"** control, Privacy Policy modal, and mandatory Eligibility Checker privacy notice.

---

## Project Structure

```text
scholarai/
├── .env.example                 # Backend environment configuration template
├── README.md
├── TODO.md                      # Phased build checklist
├── data/
│   ├── scholarships/
│   │   ├── schema.json          # JSON Schema + Entity/Relationship contract
│   │   └── scholarships.json    # 23 seeded Indian scholarship schemes
│   └── documents/               # Admin-uploaded official PDF circulars
├── backend/
│   ├── requirements.txt
│   ├── tests/                   # Automated pytest suites (Phases 1–8)
│   └── app/
│       ├── main.py              # FastAPI app, CORS, global error handlers, startup seeding
│       ├── api/                 # chat, eligibility, scholarships, search, admin routers
│       ├── agents/              # NLU intent/entity extractor + 8-stage rational agent
│       ├── rag/                 # ChromaDB vector store + hybrid RRF retriever
│       ├── knowledge_base/      # JSON validator, DB seeder, KG sync/exporter
│       ├── embeddings/          # GeminiEmbeddingProvider + DemoEmbeddingProvider
│       ├── models/              # SQLAlchemy ORM models & KnowledgeEdge triples
│       ├── schemas/             # Pydantic v2 request/response contracts
│       ├── services/            # EligibilityEngine (rules-only) + LLMProvider
│       ├── database/            # SQLAlchemy engine & session dependency
│       └── utils/               # Config, PII scrubber, JWT + bcrypt admin auth
└── frontend/
    ├── .env.example             # Optional VITE_API_BASE_URL override
    ├── package.json
    └── src/
        ├── pages/               # Landing, Chat, Explorer, Eligibility, Details, Admin
        ├── components/          # DemoBanner, SourceBadge, ScholarshipCard, Modals/Drawer
        ├── layouts/             # Responsive navbar, footer, dark mode, toasts
        ├── hooks/               # ScholarDataProvider (localStorage + health state)
        ├── services/            # Typed REST API client + CSV / PDF / .ics exporters
        ├── types/               # TypeScript API contracts
        └── assets/              # ScholarAI vector logo mark
```

---

## Prerequisites

- **Python** `3.11+` (tested on Python `3.13.14`)
- **Node.js** `20+` and `npm` (tested on Node `24.19.0`, npm `11.17.0`)
- *(Optional)* A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/). Leave `GEMINI_API_KEY` empty to run in transparent **Demo Mode**.

---

## Local Setup & Run Instructions

### 1. Configure Environment Variables

From the project root (`scholarai/`), copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Edit `.env` if you want to enable live Gemini inference or customize admin credentials:

```env
GEMINI_API_KEY=your_key_here_or_leave_blank_for_demo_mode
GEMINI_CHAT_MODEL=gemini-3.8-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ScholarAdmin@2026
```

> **Note:** Never place `GEMINI_API_KEY` inside `frontend/`. The key is read strictly on the Python backend.

### 2. Start the Backend (FastAPI + SQLite + ChromaDB)

Open a terminal in `scholarai/backend`:

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000
```

**macOS / Linux:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On startup, the backend automatically:
1. Creates SQLite tables (`data/scholarai.db`).
2. Validates and seeds the 23 Indian scholarships & Knowledge Graph edges from `data/scholarships/scholarships.json`.
3. Seeds the default Admin user (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
4. Indexes all active scholarships into persistent ChromaDB (`data/chroma_db`).

Verify the API documentation at:
- Swagger UI: **http://127.0.0.1:8000/docs**
- Health check: **http://127.0.0.1:8000/api/health**

### 3. Start the Frontend (React + Vite + TypeScript)

Open a second terminal in `scholarai/frontend`:

```bash
cd frontend
npm install
npm run dev
```

*(Windows PowerShell note: if script execution policy blocks `npm`, run `npm.cmd install` and `npm.cmd run dev` instead.)*

Vite proxies `/api/*` requests directly to `http://127.0.0.1:8000` (configured in `frontend/vite.config.ts`). Open **http://localhost:5173** in your browser.

*(Optional)* If running frontend and backend on separate origins without the Vite dev proxy, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL=http://127.0.0.1:8000`.

---

## Core API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Server status, Demo vs Gemini mode, active model names, ChromaDB vector counts |
| `GET` | `/api/stats` | Public | Dataset summary & dynamic filter options |
| `GET` | `/api/scholarships` | Public | Filterable, sortable, paginated list of scholarships |
| `GET` | `/api/scholarships/{id}` | Public | Full scheme record, application steps, KG relations, linked PDFs |
| `GET` | `/api/search` | Public | Hybrid semantic (ChromaDB) + keyword + filter search |
| `POST` | `/api/eligibility/check` | Public | Deterministic rule evaluation grouped into `eligible`, `potentially_eligible`, `not_eligible` |
| `POST` | `/api/chat` | Public | 8-stage Rational Agent RAG chat endpoint with citations, confidence & trace |
| `POST` | `/api/admin/login` | Public | Returns JWT Bearer token for admin operations |
| `GET` | `/api/admin/me` | JWT | Verify current admin session |
| `POST/PUT/DELETE` | `/api/admin/scholarships` | JWT | Manage scholarships with instant SQLite, KG & ChromaDB re-indexing |
| `POST/GET/DELETE` | `/api/admin/documents*` | JWT | Upload PDF circulars (`pypdf` text extraction, chunking & ChromaDB indexing) |
| `GET` | `/api/admin/analytics` | JWT | Usage counts, intent distribution, verification counts & zero-hit failed searches |

---

## Testing & Verification

### Backend Automated Tests (`pytest`)
From `scholarai/backend`:
```bash
pytest -v
```
Covers health/seeding (Phase 1–2), ChromaDB + hybrid search ranking (Phase 3), deterministic eligibility engine rules (Phase 4), RAG chat + PII scrubbing + explainability trace (Phase 5), admin JWT CRUD + PDF ingestion (Phase 6), and all 6 suggested chips + multi-turn follow-ups + error handling (Phase 8).

### Frontend Type-Check & Production Build
From `scholarai/frontend`:
```bash
npm run lint
npm run build
```
*(Or `npx.cmd tsc --noEmit` and `npm.cmd run build` on restricted PowerShell setups.)*

---

## Deploying to Render

ScholarAI includes [`render.yaml`](render.yaml), [`Dockerfile`](Dockerfile), [`.python-version`](.python-version), and [`RENDER_DEPLOY.md`](RENDER_DEPLOY.md) for zero-config hosting on **Render**.

- **Unified Free Web Service (Recommended):** Push `scholarai/` to GitHub and create a **New + → Blueprint** in Render. FastAPI serves the compiled `frontend/dist` SPA alongside `/api/*` and `/docs` on a single HTTPS origin.
- **PostgreSQL Ready:** Linking a Render Managed PostgreSQL `DATABASE_URL` (including legacy `postgres://` URIs) automatically switches storage away from local SQLite while ChromaDB re-indexes on startup.
- See [RENDER_DEPLOY.md](RENDER_DEPLOY.md) for both single-service Docker and split Static Site + API instructions.
