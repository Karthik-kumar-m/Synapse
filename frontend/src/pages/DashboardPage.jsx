import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getSummary, getAlerts } from '../api';
import SeverityBadge from '../components/SeverityBadge';
import LoadingSpinner from '../components/LoadingSpinner';

const REFRESH_INTERVAL = 30_000;

function StatCard({ label, value, sub, valueColor }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: valueColor || 'var(--text)', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card" style={{ flex: 1, minWidth: 140 }}>
      <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 28, width: '40%', marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 10, width: '50%' }} />
    </div>
  );
}

function sentimentColor(score) {
  if (score >= 0.6) return 'var(--positive)';
  if (score <= 0.35) return 'var(--negative)';
  return 'var(--neutral)';
}

function buildChartData(summary) {
  if (!summary) return [];
  const total = summary.total_reviews || 0;
  const avgScore = summary.avg_sentiment_score ?? 0.5;
  const positiveEst = Math.round(total * avgScore);
  const negativeEst = Math.round(total * (1 - avgScore) * 0.6);
  const neutralEst = Math.max(0, total - positiveEst - negativeEst);
  return [
    { name: 'Positive', count: positiveEst, color: '#22c55e' },
    { name: 'Neutral',  count: neutralEst,  color: '#f59e0b' },
    { name: 'Negative', count: negativeEst,  color: '#ef4444' },
  ];
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ color: payload[0].color }}>{payload[0].value} reviews</div>
    </div>
  );
};

export default function DashboardPage() {
  const [summary, setSummary]   = useState(null);
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError]       = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, alertsData] = await Promise.all([getSummary(), getAlerts()]);
      setSummary(summaryData);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  const chartData = buildChartData(summary);
  const topAspect = summary?.top_aspects?.[0]?.aspect ?? summary?.top_aspects?.[0] ?? '—';
  const activeAlertCount = summary?.active_alerts ?? alerts.length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Review Intelligence Dashboard</h1>
          {lastUpdated && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
        {loading && <LoadingSpinner />}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--negative)', borderRadius: 10, padding: '12px 18px', color: 'var(--negative)', marginBottom: 24, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Reviews"
              value={(summary?.total_reviews ?? 0).toLocaleString()}
              sub="across all products"
            />
            <StatCard
              label="Avg Sentiment"
              value={summary?.avg_sentiment_score != null ? summary.avg_sentiment_score.toFixed(3) : '—'}
              sub="sentiment score"
              valueColor={sentimentColor(summary?.avg_sentiment_score ?? 0.5)}
            />
            <StatCard
              label="Active Alerts"
              value={activeAlertCount}
              sub="anomalies detected"
              valueColor={activeAlertCount > 0 ? 'var(--negative)' : 'var(--positive)'}
            />
            <StatCard
              label="Bot Rate"
              value={summary?.bot_rate != null ? `${(summary.bot_rate * 100).toFixed(1)}%` : '—'}
              sub="suspicious reviews"
              valueColor={summary?.bot_rate > 0.1 ? 'var(--neutral)' : 'var(--text)'}
            />
            <StatCard
              label="Sarcasm Rate"
              value={summary?.sarcasm_rate != null ? `${(summary.sarcasm_rate * 100).toFixed(1)}%` : '—'}
              sub="of all reviews"
            />
            <StatCard
              label="Top Aspect"
              value={typeof topAspect === 'string' ? topAspect : topAspect?.aspect ?? '—'}
              sub="most mentioned"
              valueColor="var(--primary)"
            />
          </>
        )}
      </div>

      {/* Chart + Alerts side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Sentiment Distribution */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Sentiment Distribution</h2>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {!loading && summary?.total_reviews === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: -180, paddingBottom: 80, fontSize: 12 }}>
              No review data yet. Ingest some reviews to see distribution.
            </div>
          )}
        </div>

        {/* Active Alerts */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
            Active Alerts
            {activeAlertCount > 0 && (
              <span className="badge badge-critical" style={{ marginLeft: 10, fontSize: 10 }}>{activeAlertCount}</span>
            )}
          </h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
              No active alerts — all systems normal.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
              {alerts.slice(0, 8).map((alert, i) => (
                <div key={i} style={{
                  padding: '12px 14px',
                  background: 'var(--surface-2)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alert.aspect || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {alert.product_id || alert.product} &middot;&nbsp;
                      {alert.baseline_rate != null && alert.current_rate != null
                        ? `${(alert.baseline_rate * 100).toFixed(1)}% → ${(alert.current_rate * 100).toFixed(1)}%`
                        : alert.message || ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <SeverityBadge severity={alert.severity} />
                    {alert.spike_delta != null && (
                      <span style={{ fontSize: 11, color: 'var(--negative)', fontWeight: 600 }}>
                        +{(alert.spike_delta * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
