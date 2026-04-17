import { useState, useRef } from 'react';
import { ingestCSV, ingestJSON, ingestManual } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast, ToastContainer } from '../components/Toast';

const SAMPLE_REVIEWS = [
  { product_id: 'prod_demo', product_name: 'Demo Widget', text: 'Absolutely love this product! Works perfectly every time.', source: 'api' },
  { product_id: 'prod_demo', product_name: 'Demo Widget', text: 'Battery life is terrible, drains in 2 hours. Very disappointed.', source: 'api' },
  { product_id: 'prod_demo', product_name: 'Demo Widget', text: 'It is okay, not great not bad. Does what it says on the tin.', source: 'api' },
  { product_id: 'prod_demo', product_name: 'Demo Widget', text: 'Oh sure, great product if you enjoy it breaking after a week. 10/10!', source: 'api' },
  { product_id: 'prod_demo', product_name: 'Demo Widget', text: 'The build quality is exceptional. Highly recommend for professionals.', source: 'api' },
];

function ResultBox({ result }) {
  if (!result) return null;
  return (
    <div style={{
      marginTop: 16,
      padding: '12px 16px',
      background: result.error ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
      border: `1px solid ${result.error ? 'var(--negative)' : 'var(--positive)'}`,
      borderRadius: 10,
      fontSize: 13,
    }}>
      {result.error ? (
        <div style={{ color: 'var(--negative)' }}>✕ {result.error}</div>
      ) : (
        <div style={{ color: 'var(--positive)' }}>
          ✓ {result.message || `Ingested ${result.count ?? result.ingested ?? 1} review(s) successfully.`}
          {result.skipped > 0 && <span style={{ color: 'var(--neutral)', marginLeft: 8 }}>({result.skipped} skipped)</span>}
        </div>
      )}
    </div>
  );
}

/* ── CSV Tab ── */
function CSVTab({ toast }) {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await ingestCSV(file);
      setResult(data);
      toast.success(`CSV uploaded: ${data.count ?? data.ingested ?? '?'} reviews ingested.`);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed';
      setResult({ error: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Upload CSV File</h2>
      <div
        className={`drop-zone ${dragging ? 'active' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => setFile(e.target.files[0])}
        />
        <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
        {file ? (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB</div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 600 }}>Drop a CSV file here or click to browse</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Supports: product_id, product_name, text, source, timestamp</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={handleUpload} disabled={!file || loading}>
          {loading ? <><LoadingSpinner size={14} /> Uploading…</> : 'Upload CSV'}
        </button>
        {file && (
          <button className="btn btn-secondary" onClick={() => { setFile(null); setResult(null); }}>Clear</button>
        )}
      </div>
      <ResultBox result={result} />
    </div>
  );
}

/* ── JSON Tab ── */
function JSONTab({ toast }) {
  const [raw, setRaw]         = useState('');
  const [parsed, setParsed]   = useState(null);
  const [parseErr, setParseErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);

  const handleParse = () => {
    setParseErr(null);
    setParsed(null);
    try {
      const obj = JSON.parse(raw);
      const arr = Array.isArray(obj) ? obj : [obj];
      setParsed(arr);
    } catch (e) {
      setParseErr('Invalid JSON: ' + e.message);
    }
  };

  const handleUpload = async () => {
    if (!parsed) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await ingestJSON(parsed);
      setResult(data);
      toast.success(`JSON uploaded: ${data.count ?? data.ingested ?? '?'} reviews ingested.`);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed';
      setResult({ error: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const exampleJSON = JSON.stringify([
    { product_id: 'prod_001', product_name: 'Widget Pro', text: 'Great product!', source: 'json' }
  ], null, 2);

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Upload JSON Reviews</h2>
      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paste a JSON array of review objects below</label>
        <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setRaw(exampleJSON)}>
          Load Example
        </button>
      </div>
      <textarea
        className="textarea"
        value={raw}
        onChange={e => { setRaw(e.target.value); setParsed(null); setParseErr(null); }}
        rows={10}
        style={{ width: '100%' }}
        placeholder='[{"product_id": "p1", "text": "Great!", "source": "json"}]'
      />
      {parseErr && <div style={{ color: 'var(--negative)', fontSize: 12, marginTop: 6 }}>{parseErr}</div>}
      {parsed && (
        <div style={{ color: 'var(--positive)', fontSize: 12, marginTop: 6 }}>✓ Valid JSON — {parsed.length} review(s) ready</div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="btn btn-secondary" onClick={handleParse} disabled={!raw.trim()}>Parse JSON</button>
        <button className="btn btn-primary" onClick={handleUpload} disabled={!parsed || loading}>
          {loading ? <><LoadingSpinner size={14} /> Uploading…</> : 'Upload JSON'}
        </button>
      </div>
      <ResultBox result={result} />
    </div>
  );
}

/* ── Manual Tab ── */
function ManualTab({ toast }) {
  const [form, setForm] = useState({ product_id: '', product_name: '', text: '', source: 'manual' });
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_id.trim() || !form.text.trim()) {
      toast.error('Product ID and review text are required.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await ingestManual(form);
      setResult(data);
      toast.success('Review submitted successfully.');
      setForm({ product_id: '', product_name: '', text: '', source: 'manual' });
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Submission failed';
      setResult({ error: msg });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Manual Review Entry</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Product ID <span style={{ color: 'var(--negative)' }}>*</span>
          </label>
          <input className="input" style={{ width: '100%' }} value={form.product_id}
            onChange={e => set('product_id', e.target.value)} placeholder="e.g. prod_001" required />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Product Name
          </label>
          <input className="input" style={{ width: '100%' }} value={form.product_name}
            onChange={e => set('product_name', e.target.value)} placeholder="e.g. Widget Pro" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Review Text <span style={{ color: 'var(--negative)' }}>*</span>
          </label>
          <textarea className="textarea" style={{ width: '100%' }} value={form.text}
            onChange={e => set('text', e.target.value)} rows={5}
            placeholder="Enter the review text here…" required />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Source
          </label>
          <select className="select" value={form.source} onChange={e => set('source', e.target.value)}>
            <option value="manual">Manual</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="api">API</option>
          </select>
        </div>
        <div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <><LoadingSpinner size={14} /> Submitting…</> : 'Submit Review'}
          </button>
        </div>
      </form>
      <ResultBox result={result} />
    </div>
  );
}

/* ── Real-time Tab ── */
function RealtimeTab({ toast }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [done, setDone]       = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    setResults([]);
    setDone(false);
    const out = [];
    for (const review of SAMPLE_REVIEWS) {
      try {
        const data = await ingestManual(review);
        out.push({ ok: true, text: review.text.slice(0, 50), data });
      } catch (err) {
        const msg = err.response?.data?.detail || err.message;
        out.push({ ok: false, text: review.text.slice(0, 50), error: msg });
      }
      setResults([...out]);
      await new Promise(r => setTimeout(r, 300));
    }
    setLoading(false);
    setDone(true);
    const succeeded = out.filter(r => r.ok).length;
    if (succeeded === SAMPLE_REVIEWS.length) toast.success(`Feed simulation complete: ${succeeded} reviews ingested.`);
    else toast.error(`Feed simulation: ${succeeded}/${SAMPLE_REVIEWS.length} reviews ingested.`);
  };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Real-time Feed Simulation</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, maxWidth: 540, lineHeight: 1.6 }}>
        Simulates a live review stream by sending 5 sample reviews (including positive, negative, neutral, and sarcastic)
        one-by-one to the backend ingest endpoint. Use this to quickly populate the system with demo data.
      </p>

      <button className="btn btn-primary" onClick={handleSimulate} disabled={loading}>
        {loading ? <><LoadingSpinner size={14} /> Simulating…</> : '▶ Simulate Feed'}
      </button>

      {results.length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: r.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${r.ok ? 'var(--positive)' : 'var(--negative)'}`,
              fontSize: 13,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}>
              <span style={{ color: r.ok ? 'var(--positive)' : 'var(--negative)', fontWeight: 700 }}>
                {r.ok ? '✓' : '✕'}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                "{r.text}…"
              </span>
              {!r.ok && <span style={{ color: 'var(--negative)', fontSize: 12 }}>{r.error}</span>}
            </div>
          ))}
        </div>
      )}

      {done && (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
          Simulation complete. Check the <a href="/reviews" style={{ color: 'var(--primary)' }}>Reviews</a> page to see the ingested data.
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: 'csv',      label: 'CSV Upload' },
  { key: 'json',     label: 'JSON Upload' },
  { key: 'manual',   label: 'Manual Entry' },
  { key: 'realtime', label: 'Real-time Feed' },
];

export default function IngestPage() {
  const [activeTab, setActiveTab] = useState('csv');
  const { toasts, toast } = useToast();

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Ingest Reviews</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Import review data via CSV, JSON, manual entry, or simulate a real-time feed.
        </p>
      </div>

      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        {activeTab === 'csv'      && <CSVTab toast={toast} />}
        {activeTab === 'json'     && <JSONTab toast={toast} />}
        {activeTab === 'manual'   && <ManualTab toast={toast} />}
        {activeTab === 'realtime' && <RealtimeTab toast={toast} />}
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
