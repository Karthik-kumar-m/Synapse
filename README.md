# Synapse — Customer Review Intelligence Platform

> **Hack Malenadu '26** — Moving beyond simple summarization into granular, actionable intelligence.

Synapse ingests customer reviews from multiple sources, normalizes noisy/Hinglish text, extracts per-feature sentiment with confidence scores, and automatically detects systemic complaint spikes before they become a crisis.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          React Dashboard                         │
│   Dashboard | Reviews | Alerts | Ingest  (port 3000)            │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP / REST
┌───────────────────────────▼──────────────────────────────────────┐
│                     FastAPI Backend  (port 8000)                 │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │  Ingestion  │  │  Dashboard  │  │   Background Jobs        │ │
│  │  /api/ingest│  │ /api/dash.. │  │   (anomaly sweeper)      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────────────────────┘ │
│         │                │                                        │
│  ┌──────▼────────────────▼──────────────────────────────────┐   │
│  │              Intelligence Layers                          │   │
│  │  Layer 1: preprocessing.py  (Noise Normalization)        │   │
│  │  Layer 2: analytics.py      (ABSA + Sarcasm Detection)   │   │
│  │  Layer 3: anomaly.py        (Predictive Spike Detection)  │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬──────────────────────────────────────┘
                            │ asyncpg
                    ┌───────▼───────┐
                    │  PostgreSQL   │
                    │  (port 5432)  │
                    └───────────────┘
```

---

## Intelligence Layers

### Layer 1 — Noise Normalization (`backend/logic/preprocessing.py`)

| Feature | Implementation |
|---------|----------------|
| **Hinglish normalization** | 50-word map (`accha→good`, `kharab→terrible`, `zabardast→amazing`, …) applied pre-tokenization |
| **Emoji sentiment** | Positive (😊👍🔥💯) → +0.3, Negative (😞👎💔😠) → -0.3, averaged & clamped |
| **Text cleaning** | URL removal, special-char stripping, whitespace normalization |
| **Language detection** | `langdetect` with `"en"` fallback for short texts |
| **Final score** | `0.7 × TextBlob polarity + 0.3 × emoji sentiment` |
| **Exact deduplication** | SHA-256 hash of cleaned text |
| **Near-duplicate detection** | TF-IDF cosine similarity ≥ 0.92 threshold |
| **Bot detection** | Word-count heuristic, ALL-CAPS check, repetition regex, burst-rate check |

### Layer 2 — Aspect-Based Sentiment Analysis (`backend/logic/analytics.py`)

10 aspects tracked: **Battery Life**, **Speed**, **Packaging**, **Camera**, **Display**, **Build Quality**, **Price/Value**, **Customer Support**, **Delivery**, **Software/UI**

Each aspect insight includes:
- `sentiment`: positive / negative / neutral
- `score`: TextBlob polarity of the keyword-windowed text
- `confidence`: `min(1.0, match_count × 0.4 + |polarity| × 0.6)`
- `matched_keywords`: which keywords triggered extraction

Sarcasm detection uses 12 regex patterns + polarity/negative-keyword mismatch. Sarcastic reviews with positive surface polarity are automatically **flagged for human review**.

### Layer 3 — Predictive Anomaly Detection (`backend/logic/anomaly.py`)

- Splits reviews into **baseline** (older than 7 days) vs **recent** windows
- Computes aspect percentage in each window
- `detect_spike` classifies delta:
  - `> 30 pp` → **critical**
  - `> 20 pp` → **high**
  - `> 15 pp` → **medium**
  - `> 5 pp`  → **low**
- `is_systemic_failure` returns `True` if the spike persists for ≥ 3 consecutive days

---

## Project Structure

```
Synapse/
├── backend/
│   ├── main.py               # FastAPI app + lifespan DB init
│   ├── config.py             # pydantic-settings (DATABASE_URL, CORS, …)
│   ├── database.py           # Async SQLAlchemy engine + get_db
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── models/
│   │   ├── review.py         # Review + AspectInsight ORM models
│   │   └── alert.py          # AnomalyAlert ORM model
│   ├── schemas/
│   │   ├── review.py         # Pydantic v2 schemas
│   │   └── alert.py
│   ├── logic/
│   │   ├── preprocessing.py  # Layer 1
│   │   ├── analytics.py      # Layer 2
│   │   └── anomaly.py        # Layer 3
│   └── routers/
│       ├── ingestion.py      # POST /api/ingest/{csv,json,manual,realtime-feed}
│       └── dashboard.py      # GET  /api/dashboard/{summary,reviews,alerts,…}
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── App.jsx            # Sidebar layout + routes
│       ├── api.js             # Axios client
│       ├── pages/
│       │   ├── DashboardPage.jsx
│       │   ├── ReviewsPage.jsx
│       │   ├── AlertsPage.jsx
│       │   └── IngestPage.jsx
│       └── components/
│           ├── SentimentBadge.jsx
│           ├── SeverityBadge.jsx
│           ├── LoadingSpinner.jsx
│           └── Toast.jsx
├── scripts/
│   └── seed_data.py          # 200 synthetic reviews w/ packaging spike
└── docker-compose.yml
```

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
docker compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Option B — Local development

**Backend**
```bash
cd backend
pip install -r requirements.txt
python -m textblob.download_corpora

# set env vars
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/synapse

uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm start          # http://localhost:3000
```

### Seed the database

After the backend is running with a connected PostgreSQL:

```bash
DB_URL=postgresql://postgres:postgres@localhost:5432/synapse \
  python scripts/seed_data.py
```

This inserts **200 reviews** across 3 products, with the last 50 iPhone 15 Pro reviews carrying a ~38 % Packaging complaint rate — triggering a **critical** anomaly alert.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/ingest/csv` | Upload CSV (`product_id`, `product_name`, `text`) |
| `POST` | `/api/ingest/json` | Upload JSON array of review objects |
| `POST` | `/api/ingest/manual` | Single review (JSON body) |
| `POST` | `/api/ingest/realtime-feed` | Batch of up to 50 reviews (simulated stream) |
| `GET` | `/api/dashboard/summary` | KPI summary (totals, sentiment, alerts) |
| `GET` | `/api/dashboard/reviews` | Paginated review list with filters |
| `GET` | `/api/dashboard/alerts` | Active anomaly alerts |
| `GET` | `/api/dashboard/aspects/{product_id}` | Aspect breakdown for a product |
| `GET` | `/api/dashboard/anomaly-report/{product_id}` | Full time-series anomaly report |

Interactive docs at **http://localhost:8000/docs**

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/synapse` | Async DB connection string |
| `SECRET_KEY` | auto-generated | App secret |
| `DEBUG` | `true` | Debug mode |
| `ALLOWED_ORIGINS` | `["*"]` | CORS allow-list |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.110, Python 3.12, SQLAlchemy 2 (async) |
| NLP | TextBlob, langdetect, scikit-learn (TF-IDF), emoji |
| Database | PostgreSQL 15, asyncpg |
| Frontend | React 18, Recharts, React Router 6, Axios |
| Container | Docker, nginx |