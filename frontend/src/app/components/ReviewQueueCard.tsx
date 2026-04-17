import { MessageSquare, AlertCircle } from 'lucide-react';

interface Review {
  id: string;
  text: string;
  flag: string;
  customerName: string;
  customerAvatar: string;
}

const reviews: Review[] = [
  {
    id: '1',
    text: '"This phone is absolutely terrible! Best purchase ever. Camera quality is just amazing... not!"',
    flag: 'Sarcasm Detected',
    customerName: 'Jordan M.',
    customerAvatar: 'bg-gradient-to-br from-purple-400 to-pink-500',
  },
  {
    id: '2',
    text: '"The battery life could be better or worse depending on how you use it, I guess..."',
    flag: 'Ambiguity Detected',
    customerName: 'Sam T.',
    customerAvatar: 'bg-gradient-to-br from-blue-400 to-cyan-500',
  },
];

export function ReviewQueueCard() {
  return (
    <div className="p-7 rounded-xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 h-full shadow-lg">
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-lg text-slate-50 font-semibold">Human Review Needed</h3>
        <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium">
          2 pending
        </span>
      </div>
      
      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="p-5 rounded-xl bg-slate-700/30 border border-slate-600/30"
          >
            {/* Customer Info */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-full ${review.customerAvatar} flex items-center justify-center shadow-md`}>
                <span className="text-white text-sm font-semibold">
                  {review.customerName.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-300 font-medium">{review.customerName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span className="text-xs text-amber-400">{review.flag}</span>
                </div>
              </div>
            </div>
            
            {/* Review Text */}
            <div className="flex items-start gap-2 mb-4 pl-12">
              <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-400 leading-relaxed italic">
                {review.text}
              </p>
            </div>
            
            {/* Action Button */}
            <div className="pl-12">
              <button className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-400/30 text-indigo-300 text-sm hover:from-indigo-500/30 hover:to-violet-500/30 transition-all font-medium shadow-sm">
                Review & Resolve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}