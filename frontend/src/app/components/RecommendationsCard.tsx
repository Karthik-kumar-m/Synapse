import { Badge } from './ui/badge';
import { Share2 } from 'lucide-react';

interface Recommendation {
  priority: 'High' | 'Medium' | 'Low';
  text: string;
}

const recommendations: Recommendation[] = [
  {
    priority: 'High',
    text: 'Battery drain is a hot topic—consider reaching out to engineering for a deep dive into recent power management changes.',
  },
  {
    priority: 'Medium',
    text: 'Customers love the camera in daylight, but low-light shots are getting critiqued. This could be a great opportunity for a firmware improvement.',
  },
  {
    priority: 'Low',
    text: 'The new design is getting lots of love! This positive sentiment is perfect for your next marketing campaign.',
  },
];

export function RecommendationsCard() {
  return (
    <div className="p-7 rounded-xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 h-full shadow-lg">
      <h3 className="text-lg text-slate-50 font-semibold mb-6">Suggested Team Actions</h3>
      
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div
            key={index}
            className="group p-5 rounded-xl bg-slate-700/30 border border-slate-600/30 hover:border-indigo-500/40 hover:bg-slate-700/40 transition-all"
          >
            <div className="flex items-start gap-3 mb-3">
              <Badge
                variant={rec.priority === 'High' ? 'destructive' : 'secondary'}
                className={`mt-0.5 ${
                  rec.priority === 'High'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : rec.priority === 'Medium'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                }`}
              >
                {rec.priority}
              </Badge>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">{rec.text}</p>
            <button className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
              <Share2 className="w-3.5 h-3.5" />
              <span>Share with Team</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}