# Deploying ScholarAI to Render

ScholarAI is pre-configured for **Render** (`render.com`) via a unified **Docker Web Service Blueprint** (`render.yaml` + `Dockerfile`) that runs the compiled React frontend and FastAPI + ChromaDB backend on a single origin with zero CORS conflicts.

---

## Option 1: 1-Click Render Blueprint (Recommended — Single Free Web Service)

1. **Push `scholarai/` to GitHub** (`.gitignore` already excludes `.venv/`, `node_modules/`, `.env`, SQLite DBs, and Chroma caches).
   - *Monorepo tip:* If `scholarai/` sits inside a parent repository, set **Root Directory** to `scholarai` when creating the Render service/blueprint.
2. In the **[Render Dashboard](https://dashboard.render.com)**, click **New + → Blueprint**.
3. Connect your GitHub repository — Render automatically detects `render.yaml`.
4. Fill in prompted environment values:
   - `ADMIN_PASSWORD`: choose a strong admin password (used to log into `/admin`).
   - `GEMINI_API_KEY`: leave blank (`""`) to launch immediately in transparent **Demo Mode**, or paste your Google AI Studio Gemini API key anytime under **Environment**.
5. Click **Apply**. Render builds the Vite React bundle + Python FastAPI image via `Dockerfile`, verifies `/api/health`, and gives you a live HTTPS URL (e.g., `https://scholarai.onrender.com`).

### Persistence Note on Render Free Tier
- On Render's Free plan, local files reset on container restarts/redeploys.
- ScholarAI handles this gracefully: on every boot, `FastAPI` automatically re-creates tables, re-seeds all **23 Indian scholarships** & Knowledge Graph edges from `data/scholarships/scholarships.json`, and re-indexes **ChromaDB** automatically.
- To keep **Admin CRUD edits and usage logs** across restarts, create a **Render PostgreSQL** database and add its Internal Database URL as `DATABASE_URL` in your service's **Environment** tab (`postgres://` URLs are automatically normalized to `postgresql://` for SQLAlchemy).

---

## Option 2: Split Services Without Docker (Python Web Service + Static Site)

If you prefer two separate Render services without Docker:

### A. Backend (`Web Service` — Python 3)
- **Root Directory:** `.` *(or `scholarai` if monorepo)*
- **Build Command:** `pip install -r backend/requirements.txt`
- **Start Command:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`
- **Health Check Path:** `/api/health`
- **Environment Variables:**
  - `PYTHON_VERSION=3.11.11`
  - `JWT_SECRET_KEY=<random-64-char-secret>`
  - `ADMIN_USERNAME=admin`
  - `ADMIN_PASSWORD=<your-password>`
  - `CORS_ORIGINS=https://<your-frontend>.onrender.com`
  - `ANONYMIZED_TELEMETRY=False`
  - *(Optional)* `GEMINI_API_KEY=<your-key>`

### B. Frontend (`Static Site`)
- **Root Directory:** `frontend` *(or `scholarai/frontend`)*
- **Build Command:** `npm ci && npm run build`
- **Publish Directory:** `dist`
- **Environment Variables:**
  - `VITE_API_BASE_URL=https://<your-backend>.onrender.com`
- **Redirect / Rewrite Rule** *(required for React Router deep links)*:
  - Source: `/*` → Destination: `/index.html` → Action: **Rewrite**
