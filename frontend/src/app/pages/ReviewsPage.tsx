import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { Search, Filter, MoreHorizontal, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react';
import { PageWrapper } from '../components/PageWrapper';
import { motion, AnimatePresence } from 'motion/react';
import type { DashboardContextType } from '../RootLayout';
import { fetchReviews, type Review } from '../api';

const sentimentStyles: Record<string, string> = {
  positive: 'bg-[#34C759]/10 text-[#248A3D]',
  negative: 'bg-[#FF3B30]/10 text-[#D70015]',
  neutral: 'bg-[#E5E5EA] text-[#1D1D1F]',
  ambiguous: 'bg-[#FF9500]/10 text-[#C16B00]',
};

export function ReviewsPage() {
  const { dateFilter, category, selectedProductId } = useOutletContext<DashboardContextType>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const load = async () => {
      setIsRefreshing(true);
      try {
        const data = await fetchReviews({
          page: 1,
          page_size: 50,
          product_id: selectedProductId || undefined,
        });
        setReviews(data);
      } catch (error) {
        setReviews([]);
        console.error('Failed to load reviews', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    load();
  }, [dateFilter, category, selectedProductId]);

  const filteredReviews = useMemo(() => {
    if (!search.trim()) return reviews;
    const q = search.toLowerCase();
    return reviews.filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        r.raw_text.toLowerCase().includes(q) ||
        (r.source_review_id ?? '').toLowerCase().includes(q),
    );
  }, [reviews, search]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <PageWrapper title="Reviews Data">
      <motion.div
        animate={{ opacity: isRefreshing ? 0.5 : 1, scale: isRefreshing ? 0.98 : 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-[24px] p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col h-full min-h-[700px]"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">Review Database</h2>
            <p className="text-[14px] text-[#86868B] mt-1 font-medium">
              {filteredReviews.length.toLocaleString()} rows loaded
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reviews..."
                className="pl-9 pr-4 py-2 bg-[#F5F5F7] rounded-full text-[13px] font-medium text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 w-64 transition-all"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#F5F5F7] hover:bg-[#E5E5EA]/80 transition-colors rounded-full text-[13px] font-medium text-[#1D1D1F]">
              <Filter size={14} />
              Filter
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5EA]">
                <th className="w-8"></th>
                <th className="pb-4 font-semibold text-[12px] text-[#86868B] uppercase tracking-wider pl-4">
                  Date <ArrowDown size={12} className="inline ml-1" />
                </th>
                <th className="pb-4 font-semibold text-[12px] text-[#86868B] uppercase tracking-wider">Source</th>
                <th className="pb-4 font-semibold text-[12px] text-[#86868B] uppercase tracking-wider">Product</th>
                <th className="pb-4 font-semibold text-[12px] text-[#86868B] uppercase tracking-wider max-w-md">Snippet</th>
                <th className="pb-4 font-semibold text-[12px] text-[#86868B] uppercase tracking-wider">Sentiment</th>
                <th className="pb-4 font-semibold text-[12px] text-[#86868B] uppercase tracking-wider text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5EA]/40">
              {filteredReviews.map((review) => {
                const sentiment = (review.overall_sentiment ?? 'neutral').toLowerCase();
                return (
                  <React.Fragment key={review.id}>
                    <tr
                      onClick={() => toggleExpand(review.id)}
                      className={`hover:bg-[#F5F5F7]/80 transition-colors group cursor-pointer ${expandedId === review.id ? 'bg-[#F5F5F7]/50' : ''}`}
                    >
                      <td className="py-4 pl-2 pr-1 text-[#86868B] w-8">
                        {expandedId === review.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td className="py-4 pl-4 whitespace-nowrap text-[13px] font-medium text-[#86868B]">
                        {new Date(review.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 whitespace-nowrap text-[14px] font-medium text-[#1D1D1F] uppercase">
                        {review.source}
                      </td>
                      <td className="py-4 whitespace-nowrap text-[13px] font-medium text-[#86868B]">{review.product_name}</td>
                      <td className="py-4 text-[14px] text-[#1D1D1F] max-w-md truncate pr-8">"{review.raw_text}"</td>
                      <td className="py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold ${sentimentStyles[sentiment] ?? sentimentStyles.neutral}`}>
                          {sentiment}
                        </span>
                      </td>
                      <td
                        className="py-4 whitespace-nowrap text-right pr-4 text-[#86868B] group-hover:text-[#1D1D1F] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button className="p-1 rounded-md hover:bg-[#E5E5EA] transition-colors">
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>

                    <AnimatePresence>
                      {expandedId === review.id && (
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <td colSpan={7} className="p-0 border-0">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                              className="overflow-hidden bg-[#F5F5F7]/30"
                            >
                              <div className="p-6 pl-[3.5rem] flex gap-8 border-b border-[#E5E5EA]/40">
                                <div className="flex-1 max-w-3xl">
                                  <h4 className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider mb-2">
                                    Full Review Context
                                  </h4>
                                  <p className="text-[14px] text-[#1D1D1F] font-medium leading-relaxed">
                                    {review.raw_text}
                                  </p>
                                </div>
                                <div className="w-64 shrink-0 border-l border-[#E5E5EA]/60 pl-8 space-y-5">
                                  <div>
                                    <span className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider block mb-1.5">
                                      Source ID
                                    </span>
                                    <span className="text-[14px] font-medium text-[#1D1D1F]">
                                      {review.source_review_id || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[12px] font-bold text-[#86868B] uppercase tracking-wider block mb-1.5">
                                      AI Extracted Tags
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                      {review.aspects.slice(0, 8).map((a) => (
                                        <span
                                          key={`${review.id}-${a.id}`}
                                          className="px-2 py-1 bg-white border border-[#E5E5EA] rounded-md text-[12px] font-medium text-[#1D1D1F]"
                                        >
                                          {a.aspect}
                                        </span>
                                      ))}
                                      {review.aspects.length === 0 && (
                                        <span className="text-[12px] text-[#86868B]">No extracted aspects</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-6 mt-auto border-t border-[#E5E5EA] flex items-center justify-between text-[13px] font-medium">
          <span className="text-[#86868B]">Showing {filteredReviews.length} reviews</span>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg text-[#86868B] hover:bg-[#F5F5F7] transition-colors disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-[#0071E3] text-white shadow-sm transition-colors">1</button>
            <button className="px-3 py-1.5 rounded-lg text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors">Next</button>
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
}
