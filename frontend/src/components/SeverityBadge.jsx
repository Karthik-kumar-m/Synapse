export default function SeverityBadge({ severity }) {
  const map = {
    critical: { label: 'Critical', cls: 'badge-critical' },
    high:     { label: 'High',     cls: 'badge-high'     },
    medium:   { label: 'Medium',   cls: 'badge-medium'   },
    low:      { label: 'Low',      cls: 'badge-low'      },
  };
  const key = (severity || '').toLowerCase();
  const { label, cls } = map[key] || { label: severity || '—', cls: '' };
  return <span className={`badge ${cls}`}>{label}</span>;
}
