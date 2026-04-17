export default function SentimentBadge({ sentiment }) {
  const map = {
    positive: { label: 'Positive', cls: 'badge-positive' },
    negative: { label: 'Negative', cls: 'badge-negative' },
    neutral:  { label: 'Neutral',  cls: 'badge-neutral'  },
  };
  const key = (sentiment || '').toLowerCase();
  const { label, cls } = map[key] || { label: sentiment || '—', cls: '' };
  return <span className={`badge ${cls}`}>{label}</span>;
}
