# ScholarAI – Build Plan & Checklist

> Tagline: **"Your Future. Your Scholarship. One Intelligent Assistant."**

## Architecture & Tech Plan
- **Frontend**: React 19 + Vite + TypeScript, Tailwind CSS v4, Framer Motion, Lucide Icons, React Router
- **Backend**: Python 3.13 + FastAPI + Pydantic v2 + SQLAlchemy 2.0 (SQLite default, PostgreSQL-compatible) + PyJWT + bcrypt + pypdf
- **Vector Store**: ChromaDB (persistent local client under `data/chroma_db`) with mode-isolated collections (`gemini` vs `demo`)
- **AI Layer**: Abstract `LLMProvider` (`GeminiProvider` via official `google-genai >= 2.30.1` Interactions API with `gemini-3.8-flash`, and `DemoProvider` deterministic fallback) + `EmbeddingService` (`gemini-embedding-001` via `client.models.embed_content` + local deterministic fallback in Demo Mode)
- **Knowledge Base**: Knowledge-graph-ready schema (`Student`, `Scholarship`, `Organization`, `Course`, `State`, `Document`, `KnowledgeEdge`) + 23 Indian scholarship records (`verified` vs `sample`, never inventing unverified deadlines/criteria)
- **Rational Agent Loop**: `Perceive -> Interpret Intent -> Extract Entities -> Retrieve -> Evaluate Eligibility (Rules) -> Reason -> Respond -> Explain` with privacy PII scrubbing, follow-up questions on missing info, qualitative confidence, and user-friendly `"How did AI reach this result?"` trace

---

## Phase Checklist

### Phase 1: Scaffold
- [x] Create folder structure (`frontend/`, `backend/`, `data/`)
- [x] Create `.env.example`, `backend/requirements.txt`, `frontend/package.json`, `README.md` skeleton
- [x] Setup Python `.venv` and install backend dependencies
- [x] Install frontend npm dependencies and configure Vite + Tailwind CSS + TypeScript
- [x] **Phase 1 Verification**: Minimal FastAPI `/api/health` starts; React + Vite compiles cleanly

### Phase 2: Knowledge Base
- [x] Define JSON Schema (`data/scholarships/schema.json`) for scholarships & KG relationships
- [x] Author 23 Indian scholarship records (`data/scholarships/scholarships.json`) covering NSP, Central Sector, AICTE Pragati/Saksham/Swanath, State schemes, University schemes, and Private foundations (honestly tagged `verified` vs `sample`, no fabricated deadlines)
- [x] Implement SQLAlchemy portable models (`Scholarship`, `Organization`, `Course`, `State`, `Document`, `KnowledgeEdge`, `IngestedDocument`, `SearchLog`, `AdminUser`)
- [x] Implement database initialization, JSON seeder, and knowledge graph exporter
- [x] **Phase 2 Verification**: Seed script populates SQLite cleanly; schema validator & model unit tests pass

### Phase 3: Retrieval & Embeddings
- [x] Implement `EmbeddingProvider` abstraction (`GeminiEmbeddingProvider` + `DemoEmbeddingProvider`)
- [x] Implement persistent ChromaDB vector index for scholarships and PDF document chunks
- [x] Implement hybrid retriever (ChromaDB semantic + keyword/BM25 lexical + structured metadata filters + RRF ranking)
- [x] **Phase 3 Verification**: Indexing succeeds; query `"B.Tech student, 8.5 CGPA, family income below 3 lakh"` returns relevant ranked results

### Phase 4: Deterministic Eligibility Engine
- [x] Implement 100% rule-based `EligibilityEngine` (zero LLM involvement)
- [x] Handle Indian course aliases (`B.Tech`, `B.E.`, `CSE`, `AI&ML`), CGPA-to-% conversion notes, INR income limits, state domicile, category, and gender rules
- [x] Group results into `eligible`, `potentially_eligible`, and `not_eligible` with exact `met_conditions`, `unmet_conditions`, and `missing_requirements`
- [x] **Phase 4 Verification**: Unit tests pass for exact match, partial/missing profile, and hard rejection cases

### Phase 5: Rational Agent + RAG Chat Endpoint
- [x] Implement abstract `LLMProvider` (`GeminiProvider` via `google-genai` `interactions.create` + `DemoProvider`)
- [x] Implement privacy PII scrubber (Aadhaar, PAN, phone, email, bank details)
- [x] Implement rational agent loop (intent classification, entity extraction, retrieval, rule evaluation, follow-up detection, RAG prompt grounding, trace generation)
- [x] Expose `POST /api/chat` with citations, confidence, limitations, and `"Final eligibility is decided by the provider."`
- [x] **Phase 5 Verification**: Chat endpoint tests pass for missing info follow-ups, B.Tech query, NSP documents, deadlines, and Demo Mode

### Phase 6: All Other REST Endpoints + Admin Auth
- [x] Implement `GET /api/health`, `GET /api/stats`, `GET /api/scholarships`, `GET /api/scholarships/{id}`, `GET /api/search`, `POST /api/eligibility/check`
- [x] Implement JWT auth (`POST /api/admin/login`, `GET /api/admin/me`)
- [x] Implement Admin CRUD (`POST/PUT/DELETE /api/admin/scholarships`) synced with SQLite, KG edges, and ChromaDB
- [x] Implement PDF upload & ingestion (`POST /api/admin/documents/upload`, `GET/DELETE /api/admin/documents`)
- [x] Implement analytics & failed searches (`GET /api/admin/analytics`)
- [x] Add Pydantic validation & global exception handlers + CORS
- [x] **Phase 6 Verification**: API integration tests pass (`/docs`, CRUD reflects in search, unauthorized access returns 401)

### Phase 7: Frontend Pages, Wired to Backend
- [x] Build shared design system, Layout, Navbar, Dark Mode toggle, Demo Mode banner, Privacy Policy modal, Clear My Data action
- [x] Build Landing Page (`/`)
- [x] Build Chat Dashboard (`/chat`) with history sidebar, 6 suggested chips, markdown, citations, copy, expandable AI trace
- [x] Build Scholarship Explorer (`/explore`) with all filters, sorting, pagination, bookmarks, reminders drawer, CSV/PDF export
- [x] Build Eligibility Checker (`/eligibility`) with privacy consent notice, grouped results, export report
- [x] Build Scholarship Details (`/scholarships/:id`) with step-by-step guide, document checklist, deadline reminder (.ics + local), KG view
- [x] Build Admin Dashboard (`/admin`) with JWT auth, CRUD modals, PDF uploader, analytics & failed searches
- [x] **Phase 7 Verification**: `tsc --noEmit` and `npm run build` succeed cleanly

### Phase 8: Testing, Bug Fixing & Final Acceptance
- [x] Run full backend `pytest` suite
- [x] Run live end-to-end tests against running backend & frontend servers
- [x] Verify responsive CSS breakpoints for mobile width (`375px`) & desktop width (`1440px`) and test live HTTP Vite proxy + FastAPI API flows
- [x] Finalize `README.md` with complete local setup & architecture docs
- [x] Verify all Acceptance Checks pass
