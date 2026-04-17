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

Synapse now supports a local-LLM extraction mode powered by Ollama:
- LLM reads 1-3 reviews per call and returns strict JSON feature/sentiment insights.
- Backend enforces structured parsing and falls back to deterministic local ABSA on failure.
- Default model policy: `qwen2.5:7b` with fallback to `qwen2.5:3b`.

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
│   ├── seed_data.py          # 200 synthetic reviews w/ packaging spike
│   ├── run_backend.ps1       # Start backend locally on port 8000
│   ├── run_frontend.ps1      # Start frontend locally on port 3000
│   └── check_ollama.ps1      # Quick Ollama connectivity probe
```

---

## Quick Start

### Local Development (Frontend + Backend Separate)

Prerequisites:
- Python 3.12+
- Node.js LTS
- PostgreSQL 16+
- Ollama (for local LLM extraction)

**Backend (Terminal commands)**

macOS/Linux:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m textblob.download_corpora
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/synapse
python -m uvicorn main:app --reload --port 8000
```

Windows CMD:
```bat
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m textblob.download_corpora
set DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/synapse
.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

**Ollama (required for local extraction mode)**
```bash
# Install Ollama from https://ollama.com/download
ollama run qwen2.5:7b

# Optional lower-latency fallback model
ollama run qwen2.5:3b
```

Quick probe (optional):
```bash
curl http://localhost:8000/api/ingest/ollama-health
```

**Frontend (Terminal commands)**

macOS/Linux/Windows CMD:
```bash
cd frontend
npm install
npm start
```

If `npm` is blocked in PowerShell, run this instead:
```bat
"C:\Program Files\nodejs\npm.cmd" start
```

### Service URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Backend health: http://localhost:8000/health
- Ollama health via backend: http://localhost:8000/api/ingest/ollama-health

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
| `GET` | `/api/ingest/ollama-health` | Verify local Ollama connectivity and strict JSON mode |
| `POST` | `/api/dashboard/precompute` | Precompute and persist aggregate dashboards |
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
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama host URL |
| `OLLAMA_MODEL_PRIMARY` | `qwen2.5:7b` | Primary extraction model |
| `OLLAMA_MODEL_FALLBACK` | `qwen2.5:3b` | Fallback extraction model |
| `OLLAMA_TIMEOUT_SECONDS` | `30.0` | Timeout per Ollama request |
| `OLLAMA_RETRY_COUNT` | `1` | Retries before fallback model |
| `OLLAMA_ENABLE_EXTRACTION` | `true` | Enable local LLM extraction path |
| `OLLAMA_STRICT_JSON` | `true` | Request strict JSON output from Ollama |
| `OLLAMA_BATCH_SIZE` | `3` | Max reviews per extraction call |

---

## Demo Runbook (Fast + Reliable)

1. Precompute the night before demo:
```bash
curl -X POST "http://localhost:8000/api/dashboard/precompute?background=false"
```
2. Open dashboard and verify fast load from persisted aggregates.
3. During demo, submit one manual Hinglish review (for example: `box toota hua tha`).
4. Wait 2-3 seconds for local Ollama extraction.
5. Click Dashboard "Refresh now" to show updated metrics.

The dashboard now reads persisted aggregate tables for low-latency response and avoids heavy query-time recalculation.

---

## AI Model Integration Notes

The AI path is intentionally constrained so local models stay reliable:

1. LLM scope:
   feature + sentiment extraction only (small batches of 1-3 reviews).
2. Non-LLM scope:
   all counts, percentages, anomaly math, and aggregate reporting are Python/SQL.
3. Strict JSON mode:
   Ollama calls are sent with `format: "json"` and schema validation in backend.
4. Fallback behavior:
   primary model `qwen2.5:7b` -> fallback `qwen2.5:3b` -> deterministic local ABSA fallback on failure.
5. Demo optimization:
   precompute via `/api/dashboard/precompute` and present from persisted aggregates.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.110, Python 3.12, SQLAlchemy 2 (async) |
| NLP | TextBlob, langdetect, scikit-learn (TF-IDF), emoji |
| Database | PostgreSQL 15, asyncpg |
| Frontend | React 18, Recharts, React Router 6, Axios |
| Local LLM | Ollama + Qwen 2.5 |

---

## CSV Upload Guideline

### Overview

Upload customer reviews via CSV file to Synapse using the **Ingest → CSV Upload** page. The system automatically normalizes text, detects sentiment, performs deduplication, and flags quality issues.

### Required Columns

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `product_id` | String (max 255) | Unique product identifier | `iphone-15-pro`, `prod_001` |
| `product_name` | String (max 500) | Human-readable product name | `iPhone 15 Pro`, `Widget Pro` |
| `text` | String | Review text (any length) | `Great product! Love the design.` |

All three columns **must** be present in the header. Empty `text` cells are skipped (no error).

### Optional Columns

| Column | Type | Format | Description |
|--------|------|--------|-------------|
| `date` | String | `YYYY-MM-DD` or ISO 8601 | Review date; stored as `created_at`. Defaults to ingestion timestamp if omitted. |
| `created_at` | String | `YYYY-MM-DD` or ISO 8601 | Alternative to `date` (takes precedence if both present). |
| `source` | String | One of: `csv`, `json`, `api`, `manual` | Ingestion source. Default: `csv` |

### Enriched Data Columns (Optional)

Support for additional structured metadata from upstream sources:

| Column | Type | Format | Description |
|--------|------|--------|-------------|
| `review_id` | String (max 255) | `REV001`, `R-12345`, etc. | External review identifier (e.g., from source system). Stored as `source_review_id` for deduplication & audit trail. |
| `rating` | Float | `1.0` to `5.0` | Numerical rating from source (e.g., star rating). Stored for correlation analysis. |
| `firmware_version` | String (max 100) | `v1.4`, `1.2.3-beta`, etc. | Software/firmware version for this review (hardware/product context). Useful for identifying version-specific issues. |
| `component_focus` | String (max 255) | `battery`, `camera`, `left_bud`, etc. | Primary component/aspect mentioned. Can help weight ABSA detection. |
| `is_sarcastic` | Boolean | `True` / `False` | Optional explicit sarcasm flag override. If `True`, bypasses internal sarcasm detection and flags for human review. |

**Date formats accepted:**
- `2026-08-15` (YYYY-MM-DD) → parsed as 00:00:00 UTC
- `2026-08-15T03:30:00Z` (ISO 8601) → parsed with timezone info
- `2026-08-15T03:30:00+02:00` (ISO 8601 with offset) → parsed with timezone info

### Data Quality Rules

The system applies these rules automatically:

| Rule | Action | Consequence |
|------|--------|-------------|
| **Bot Detection** | Flags reviews with: very short text, excessive caps, repetitive words, burst patterns | Quarantined; not analyzed for aspects |
| **Exact Duplicates** | SHA-256 hash of cleaned text | Quarantined; appears in report |
| **Near Duplicates** | TF-IDF cosine similarity ≥ 0.92 | Quarantined; appears in report |
| **Sarcasm** | Positive text + negative keywords, or vice versa | Flagged for human review |
| **Missing Text** | Empty or whitespace-only rows | Skipped silently |

### CSV Format Examples

#### Minimal Valid CSV
```csv
product_id,product_name,text
prod_001,Widget Pro,Love this product!
prod_001,Widget Pro,Battery life is poor.
prod_002,Widget Lite,Works as advertised.
```

#### With Dates (Recommended)
```csv
product_id,product_name,date,text
iphone-15-pro,iPhone 15 Pro,2026-08-01,Excellent build quality and fast performance.
iphone-15-pro,iPhone 15 Pro,2026-08-02,Camera is amazing!
samsung-s24,Galaxy S24,2026-08-01,Great phone but expensive.
```

#### Full Featured
```csv
product_id,product_name,date,source,text
tws-pro-1,TWS Pro 1,2026-08-10,csv,Sound quality is crisp with punchy bass.
tws-pro-1,TWS Pro 1,2026-08-11,csv,Battery drains too quickly.
tws-lite,TWS Lite,2026-08-05,csv,Works but not as good as Pro.
```

#### With Enriched Metadata
```csv
product_id,product_name,review_id,date,rating,text,firmware_version,component_focus,is_sarcastic
earbuds-pro,Wireless Earbuds Pro,REV001,2026-08-20,5,"Excellent product quality. Left bud performs perfectly with great noise cancellation.",v1.5,left_bud,False
earbuds-pro,Wireless Earbuds Pro,REV002,2026-08-20,1,"DO NOT UPDATE FIRMWARE. Left bud completely bricked after v1.4 update this morning.",v1.4,left_bud,False
earbuds-pro,Wireless Earbuds Pro,REV003,2026-08-20,2,"Mediocre battery life. Gets hot during extended use.",v1.5,battery,True
```

**Notes on enriched data:**
- All enriched columns are optional; mix & match as needed
- `review_id` helps identify duplicate imports across systems
- `rating` enables correlation analysis (e.g., low ratings + high negative sentiment)
- `firmware_version` traces version-specific issues automatically in analytics
- `component_focus` pre-hints ABSA which aspects to prioritize
- `is_sarcastic` flag with `True` value forces human review override

### Upload Steps (UI)

1. **Open Ingest Page**
   - Navigate to the dashboard → **Ingest** tab
   - Click **CSV Upload** tab

2. **Select File**
   - Click the drop zone or drag-and-drop your `.csv` file
   - View file name and size

3. **Upload**
   - Click **Upload CSV** button
   - Monitor progress (shows spinner during upload)

4. **Review Results**
   - Success: Shows count of ingested reviews + any skipped/quarantined
   - Error: Display error message (e.g., missing columns, parse failure)

### Upload Steps (API)

```bash
curl -X POST "http://localhost:8000/api/ingest/csv" \
  -F "file=@reviews.csv"
```

**Response (200 OK):**
```json
{
  "total_processed": 200,
  "duplicates_quarantined": 3,
  "bots_quarantined": 5,
  "insights_generated": 145
}
```

**Common Error Responses:**

| Status | Error | Reason |
|--------|-------|--------|
| 400 | `Only .csv files are accepted.` | File is not `.csv` format |
| 422 | `Missing required columns: {product_id, text}` | CSV does not have all 3 required columns |
| 422 | `Failed to parse CSV: ...` | Invalid CSV structure or encoding |

### Common Issues & Fixes

#### ❌ "Missing required columns: {text}"
**Cause:** CSV header does not include `product_id`, `product_name`, or `text`.

**Fix:** Ensure your CSV has all three column headers (case-insensitive):
```csv
product_id,product_name,text
```

---

#### ❌ "Failed to parse CSV"
**Cause:** File encoding is not UTF-8 or CSV structure is malformed.

**Fix:**
1. Open CSV in a text editor (not Excel)
2. Save as **UTF-8** encoding
3. Ensure no unquoted commas in fields or proper quoting: `"Field with, comma"`

---

#### ⚠️ "Most reviews were quarantined as duplicates"
**Cause:** Exact same reviews uploaded multiple times or very similar review text.

**Fix:**
- Check for duplicate rows in your CSV
- Verify reviews are genuinely unique
- If duplicates are expected, this is expected behavior

---

#### ⚠️ "0 insights generated from X reviews"
**Cause:** Likely all reviews flagged as bot or duplicate.

**Fix:**
- Click **Reviews** page → filter by product/sentiment to inspect records
- Check if text is too short (<10 words) or repetitive
- Ensure at least some reviews have substantial, varied text

### Best Practices

1. **Use Dates:** Always include `date` or `created_at` column so analytics reflect real timeline, not ingestion time.

2. **Product Consistency:** Use consistent `product_id` and `product_name` values across uploads for accurate trend analysis.

3. **UTF-8 Encoding:** Save CSV files in UTF-8 to avoid character encoding errors.

4. **Batch Size:** Works best with 100–5000 reviews per file. Very large files (100K+) may timeout; split into smaller batches.

5. **Deduplicate Upstream:** Remove exact duplicates from your CSV before upload; the system will catch near-duplicates but not exact matches.

6. **Review Structure:** Ensure review `text` is:
   - Not just a rating number (e.g., "5" or "5 stars")
   - Between 10–5000 characters for best aspect extraction
   - In natural language (not JSON, code, or metadata)

7. **Validate Before Upload:** Open your CSV in a spreadsheet app and verify:
   - No missing headers
   - No unexpected blank rows at the end
   - All product IDs and text fields populated

### Example Workflow

```bash
# 1. Create CSV with reviews + original dates
cat > reviews.csv << 'EOF'
product_id,product_name,date,text
prod_001,Widget Pro,2026-08-01,Love this product!
prod_001,Widget Pro,2026-08-02,Battery drains quickly.
prod_002,Widget Lite,2026-08-01,Good value for money.
EOF

# 2. Upload via API or UI
curl -X POST "http://localhost:8000/api/ingest/csv" -F "file=@reviews.csv"

# 3. Check Ingest page for results or query the API
curl http://localhost:8000/api/dashboard/reviews?product_id=prod_001

# 4. View in dashboard
# Open http://localhost:3000 → Reviews page
```