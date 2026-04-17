import { useState, useCallback } from 'react';
import { getReviews, getAspects } from '../api';
import SentimentBadge from '../components/SentimentBadge';
import LoadingSpinner from '../components/LoadingSpinner';

const PAGE_SIZE = 20;

function AspectRow({ productId }) {
  const [aspects, setAspects]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [fetched, setFetched]   = useState(false);

  const load = async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const data = await getAspects(productId);
      setAspects(data);
    } catch {
      setAspects([]);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  if (!fetched) {
    load();
  }

  if (loading) {
    return (
      <tr>
        <td colSpan={8} style={{ padding: '10px 14px', background: 'var(--surface-2)' }}>
          <LoadingSpinner size={16} /> Loading aspects…
        </td>
      </tr>
    );
  }

  const list = Array.isArray(aspects) ? aspects : [];

  return (
    <tr>
      <td colSpan={8} style={{ padding: '12px 20px', background: 'rgba(99,102,241,0.05)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Aspect Insights for {productId}
        </div>
        {list.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No aspect data available.</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {list.slice(0, 12).map((a, i) => (
              <div key={i} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
              }}>
                <span style={{ fontWeight: 600 }}>{a.aspect || a.name || a}</span>
                {a.count != null && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({a.count})</span>}
                {a.sentiment_score != null && (
                  <span style={{
                    marginLeft: 6,
                    color: a.sentiment_score >= 0.6 ? 'var(--positive)' : a.sentiment_score <= 0.35 ? 'var(--negative)' : 'var(--neutral)',
                  }}>
                    {a.sentiment_score.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [error, setError]       = useState(null);

  const [filters, setFilters] = useState({
    product_id: '',
    sentiment: '',
  });
  const [applied, setApplied] = useState({ product_id: '', sentiment: '' });

  const fetchReviews = useCallback(async (pageNum = 1, f = applied) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: pageNum, page_size: PAGE_SIZE };
      if (f.product_id) params.product_id = f.product_id;
      if (f.sentiment)  params.sentiment  = f.sentiment;
      const data = await getReviews(params);
      const items = Array.isArray(data) ? data : data.reviews ?? data.items ?? [];
      setReviews(items);
      setHasMore(items.length === PAGE_SIZE);
      setExpandedIdx(null);
    } catch (err) {
      setError('Failed to load reviews.');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [applied]);

  /* Initial load */
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    fetchReviews(1, { product_id: '', sentiment: '' });
  }

  const handleSearch = () => {
    setApplied(filters);
    setPage(1);
    fetchReviews(1, filters);
  };

  const handlePage = (dir) => {
    const next = page + dir;
    if (next < 1) return;
    setPage(next);
    fetchReviews(next, applied);
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, flex: 1 }}>Reviews</h1>
        {loading && <LoadingSpinner />}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product ID</label>
          <input
            className="input"
            placeholder="e.g. prod_123"
            value={filters.product_id}
            onChange={e => setFilters(f => ({ ...f, product_id: e.target.value }))}
            style={{ width: 200 }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sentiment</label>
          <select
            className="select"
            value={filters.sentiment}
            onChange={e => setFilters(f => ({ ...f, sentiment: e.target.value }))}
            style={{ width: 150 }}
          >
            <option value="">All</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleSearch}>
          Search
        </button>
        <button className="btn btn-secondary" onClick={() => {
          const reset = { product_id: '', sentiment: '' };
          setFilters(reset);
          setApplied(reset);
          setPage(1);
          fetchReviews(1, reset);
        }}>
          Reset
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--negative)', padding: '10px 0', fontSize: 13 }}>⚠ {error}</div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Review Text</th>
              <th>Language</th>
              <th>Sentiment</th>
              <th>Score</th>
              <th>Source</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && reviews.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, width: j === 1 ? 180 : 60 }} /></td>
                  ))}
                </tr>
              ))
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No reviews found. Try adjusting filters.
                </td>
              </tr>
            ) : (
              reviews.map((r, i) => {
                const isExpanded = expandedIdx === i;
                const productId = r.product_id || r.product;
                return [
                  <tr
                    key={`row-${i}`}
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    style={{ background: isExpanded ? 'rgba(99,102,241,0.08)' : undefined }}
                  >
                    <td style={{ fontWeight: 500, fontSize: 12, color: 'var(--primary)' }}>{productId || '—'}</td>
                    <td style={{ maxWidth: 300 }}>
                      <span title={r.text || r.review_text} style={{ fontSize: 13 }}>
                        {(r.text || r.review_text || '').slice(0, 80)}
                        {(r.text || r.review_text || '').length > 80 ? '…' : ''}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.language || 'en'}</td>
                    <td><SentimentBadge sentiment={r.sentiment} /></td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{r.sentiment_score != null ? r.sentiment_score.toFixed(3) : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.source || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(r.timestamp || r.date || r.created_at)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</td>
                  </tr>,
                  isExpanded && productId && (
                    <AspectRow key={`aspects-${i}`} productId={productId} />
                  ),
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, justifyContent: 'center' }}>
        <button className="btn btn-secondary" onClick={() => handlePage(-1)} disabled={page === 1 || loading}>
          ← Prev
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page}</span>
        <button className="btn btn-secondary" onClick={() => handlePage(1)} disabled={!hasMore || loading}>
          Next →
        </button>
      </div>
    </div>
  );
}
