import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, User, Star, X, Check, Flag, MessageSquarePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchReviews, type Review } from '../api';

function toQueueFlag(review: Review): string {
  return 'Ambiguity';
}

function toRating(review: Review): number {
  if (typeof review.rating === 'number' && review.rating > 0) {
    return Math.max(1, Math.min(5, Math.round(review.rating)));
  }
  const score = Number(review.overall_score ?? 0);
  return Math.max(1, Math.min(5, Math.round(score / 2)));
}

export function ReviewQueue({ selectedProductId = '' }: { selectedProductId?: string }) {
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!selectedProductId) {
      setReviews([]);
      return;
    }

    const load = async () => {
      try {
        const data = await fetchReviews({ product_id: selectedProductId, page: 1, page_size: 40 });
        setReviews(data);
      } catch (error) {
        setReviews([]);
        console.error('Failed to load moderation queue', error);
      }
    };

    load();
  }, [selectedProductId]);

  const queueReviews = useMemo(() => {
    const flagged = reviews.filter((review) => review.aspects.some((aspect) => aspect.sentiment === 'ambiguous'));
    return flagged.slice(0, 12);
  }, [reviews]);

  return (
    <>
      <div className="bg-white rounded-[24px] p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] h-full flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">Human Moderation</h2>
            <p className="text-[14px] text-[#86868B] mt-1 font-medium">Requires manual review categorization</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center font-bold text-[13px] shadow-sm">
            {queueReviews.length}
          </div>
        </div>

        <div className="space-y-5 flex-1 overflow-y-auto pr-2 -mr-2">
          {queueReviews.map((review) => (
            <div
              key={review.id}
              onClick={() => setSelectedReview(review)}
              className="p-5 rounded-2xl bg-[#F5F5F7] hover:bg-[#E5E5EA]/40 transition-all cursor-pointer border border-[#E5E5EA]/50 hover:shadow-sm group hover:scale-[1.01]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <User size={14} className="text-[#86868B]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-semibold text-[#1D1D1F] leading-tight group-hover:text-[#0071E3] transition-colors">
                      {review.product_name}
                    </h4>
                    <p className="text-[12px] text-[#86868B] font-medium mt-0.5">
                      {new Date(review.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-full shadow-sm">
                  <AlertCircle size={12} className="text-[#FF9500]" strokeWidth={2.5} />
                  <span className="text-[12px] font-semibold text-[#1D1D1F]">{toQueueFlag(review)}</span>
                </div>
              </div>

              <p className="text-[14px] leading-relaxed text-[#1D1D1F] font-medium mb-4 pr-4 line-clamp-2">
                "{review.raw_text}"
              </p>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-[#E5E5EA]/50">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, j) => (
                    <Star
                      key={j}
                      size={14}
                      className={
                        j < toRating(review)
                          ? 'text-[#FF9500] fill-[#FF9500]'
                          : 'text-[#E5E5EA] fill-[#E5E5EA]'
                      }
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <span className="text-[#0071E3] text-[13px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Review Details →
                </span>
              </div>
            </div>
          ))}

          {queueReviews.length === 0 && (
            <div className="text-sm text-[#86868B] font-medium">No ambiguous reviews available for moderation.</div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedReview && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedReview(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-[32px] shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-8 border-b border-[#E5E5EA]">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#F5F5F7] flex items-center justify-center shadow-inner">
                      <User size={20} className="text-[#86868B]" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#1D1D1F]">{selectedReview.product_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[14px] text-[#86868B] font-medium">{selectedReview.source.toUpperCase()}</span>
                        <span className="w-1 h-1 rounded-full bg-[#E5E5EA]"></span>
                        <span className="text-[14px] text-[#86868B] font-medium">
                          {new Date(selectedReview.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedReview(null)}
                    className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] flex items-center justify-center transition-colors"
                  >
                    <X size={16} className="text-[#86868B]" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-1 bg-[#F5F5F7] px-3 py-1.5 rounded-full">
                    {[...Array(5)].map((_, j) => (
                      <Star
                        key={j}
                        size={16}
                        className={
                          j < toRating(selectedReview)
                            ? 'text-[#FF9500] fill-[#FF9500]'
                            : 'text-[#E5E5EA] fill-[#E5E5EA]'
                        }
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 bg-[#FF9500]/10 px-3 py-1.5 rounded-full">
                    <AlertCircle size={14} className="text-[#FF9500]" strokeWidth={2.5} />
                    <span className="text-[13px] font-bold text-[#C16B00] tracking-wide uppercase">
                      {toQueueFlag(selectedReview)}
                    </span>
                  </div>
                </div>

                <div className="bg-[#F5F5F7] rounded-2xl p-6 border border-[#E5E5EA]/50">
                  <p className="text-[16px] leading-[1.6] text-[#1D1D1F] font-medium">"{selectedReview.raw_text}"</p>
                </div>

                <div className="mt-8 flex items-center justify-between gap-4">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedReview(null)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#E5E5EA] text-[#86868B] font-semibold text-[14px] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors"
                    >
                      <Flag size={16} /> Flag Issue
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#E5E5EA] text-[#86868B] font-semibold text-[14px] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors">
                      <MessageSquarePlus size={16} /> Add Note
                    </button>
                  </div>

                  <button
                    onClick={() => setSelectedReview(null)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#34C759] hover:bg-[#248A3D] text-white font-bold text-[14px] shadow-[0_4px_12px_rgba(52,199,89,0.3)] transition-all hover:scale-105 active:scale-95"
                  >
                    <Check size={18} strokeWidth={3} />
                    Mark as Resolved
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
