import { useState, useEffect } from 'react';
import { getAlerts } from '../api';
import SeverityBadge from '../components/SeverityBadge';
import LoadingSpinner from '../components/LoadingSpinner';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

export default function AlertsPage() {
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const data = await getAlerts();
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
        setAlerts(list);
      } catch {
        setError('Failed to load alerts.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity?.toLowerCase() === filter);

  const countFor = (sev) => alerts.filter(a => (a.severity || '').toLowerCase() === sev).length;

  const formatDate = (d) => {
    if (!d) return null;
    try { return new Date(d).toLocaleString(); } catch { return d; }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            Anomaly Alerts
            {alerts.length > 0 && (
              <span className="badge badge-critical" style={{ marginLeft: 12, fontSize: 11 }}>{alerts.length} active</span>
            )}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Detected anomalies across products and aspects</p>
        </div>
        {loading && <LoadingSpinner />}
      </div>

      {error && (
        <div style={{ color: 'var(--negative)', fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>
      )}

      {/* Severity filter tabs */}
      <div className="tab-bar">
        {[
          { key: 'all', label: `All (${alerts.length})` },
          { key: 'critical', label: `Critical (${countFor('critical')})` },
          { key: 'high',     label: `High (${countFor('high')})` },
          { key: 'medium',   label: `Medium (${countFor('medium')})` },
          { key: 'low',      label: `Low (${countFor('low')})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`tab-btn ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Alert cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>No {filter !== 'all' ? filter : ''} alerts</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>All systems are operating within normal parameters.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((alert, i) => {
            const baselinePct = alert.baseline_rate != null ? (alert.baseline_rate * 100).toFixed(1) : null;
            const currentPct  = alert.current_rate  != null ? (alert.current_rate  * 100).toFixed(1) : null;
            const deltaPct    = alert.spike_delta    != null ? (alert.spike_delta   * 100).toFixed(1) : null;
            const isCritical  = alert.severity?.toLowerCase() === 'critical';

            return (
              <div
                key={i}
                className="card"
                style={{
                  borderLeft: `3px solid ${isCritical ? 'var(--critical)' : alert.severity?.toLowerCase() === 'high' ? 'var(--high)' : alert.severity?.toLowerCase() === 'medium' ? 'var(--medium)' : 'var(--low)'}`,
                  padding: '16px 20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  {/* Left content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{alert.aspect || '—'}</span>
                      <SeverityBadge severity={alert.severity} />
                      {alert.is_systemic && (
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary)' }}>Systemic</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {alert.product_id && (
                        <span>📦 {alert.product_id}</span>
                      )}
                      {alert.product && !alert.product_id && (
                        <span>📦 {alert.product}</span>
                      )}
                      {baselinePct != null && currentPct != null && (
                        <span>
                          Baseline: <strong style={{ color: 'var(--text)' }}>{baselinePct}%</strong>
                          &nbsp;→&nbsp;Current: <strong style={{ color: 'var(--text)' }}>{currentPct}%</strong>
                        </span>
                      )}
                      {alert.message && <span>{alert.message}</span>}
                    </div>
                    {formatDate(alert.timestamp || alert.created_at) && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                        {formatDate(alert.timestamp || alert.created_at)}
                      </div>
                    )}
                  </div>

                  {/* Right: spike delta */}
                  {deltaPct != null && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: isCritical ? 'var(--critical)' : 'var(--negative)' }}>
                        +{deltaPct}%
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>spike</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
