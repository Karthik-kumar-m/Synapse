import { useState, useCallback, useEffect } from 'react';
import { getReviews, getAspects } from '../api';
import SentimentBadge from '../components/SentimentBadge';
import LoadingSpinner from '../components/LoadingSpinner';

const PAGE_SIZE = 20;

function ReviewDetailsModal({ review, onClose }) {
  const productId = review?.product_id || review?.product;
  const [aspects, setAspects]   = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!productId) {
      setAspects([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await getAspects(productId);
        if (!cancelled) setAspects(data?.aspect_breakdown || []);
      } catch {
        if (!cancelled) setAspects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  const list = Array.isArray(aspects) ? aspects : [];
  const fullText = review?.raw_text || review?.text || review?.review_text || '—';
  const sentimentScore = review?.overall_score ?? review?.sentiment_score;
  const sentiment = review?.overall_sentiment || review?.sentiment;
  const lang = review?.language_detected || review?.language || 'en';
  const source = review?.source || '—';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8,12,24,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(860px, 100%)',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Review details</h3>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Product
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{review?.product_name || productId || '—'}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Product ID
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{productId || '—'}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Language
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{lang}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Source
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{source}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sentiment
            <div style={{ marginTop: 4 }}><SentimentBadge sentiment={sentiment} /></div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Score
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{sentimentScore != null ? Number(sentimentScore).toFixed(3) : '—'}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{review?.created_at ? new Date(review.created_at).toLocaleString() : '—'}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Flags
            <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>
              {review?.is_bot ? 'Bot' : 'Human'} / {review?.is_duplicate ? 'Duplicate' : 'Unique'}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full review text</div>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, lineHeight: 1.55, fontSize: 14 }}>
            {fullText}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Product aspect summary
          </div>
          {loading ? (
            <div style={{ padding: 8, color: 'var(--text-muted)' }}><LoadingSpinner size={16} /> Loading aspects...</div>
          ) : list.length === 0 ? (
            <div style={{ padding: 8, color: 'var(--text-muted)' }}>No aspect data available.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {list.slice(0, 16).map((a, i) => (
                <div key={i} style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '7px 10px',
                  fontSize: 12,
                }}>
                  <span style={{ fontWeight: 600 }}>{a.aspect || a.name || a}</span>
                  {a.count != null && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({a.count})</span>}
                  {a.avg_score != null && (
                    <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>avg {Number(a.avg_score).toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [error, setError]       = useState(null);

  const [filters, setFilters] = useState({
    product_id: '',
    sentiment: '',
  });
  const [applied, setApplied] = useState({ product_id: '', sentiment: '' });

  const fetchReviews = useCallback(async (pageNum = 1, f = { product_id: '', sentiment: '' }) => {
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
      setSelectedReview(null);
    } catch (err) {
      setError('Failed to load reviews.');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Initial load */
  useEffect(() => {
    fetchReviews(1, { product_id: '', sentiment: '' });
  }, [fetchReviews]);

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
              <th>Actions</th>
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
                const productId = r.product_id || r.product;
                return (
                  <tr key={`row-${i}`}>
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
                    <td>
                      <button className="btn btn-secondary" onClick={() => setSelectedReview(r)}>
                        View details
                      </button>
                    </td>
                  </tr>
                );
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

      {selectedReview && (
        <ReviewDetailsModal review={selectedReview} onClose={() => setSelectedReview(null)} />
      )}
    </div>
  );
}
