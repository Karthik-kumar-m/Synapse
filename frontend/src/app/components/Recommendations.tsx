import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Bell, Tag, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchAnomalyReport, fetchAspects, type AnomalyReport, type ProductAspects } from '../api';

type RecommendationItem = {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  color: string;
  insight: string;
  details: string;
  action: string;
};

export function Recommendations({ selectedProductId = '' }: { selectedProductId?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [report, setReport] = useState<AnomalyReport | null>(null);
  const [aspects, setAspects] = useState<ProductAspects | null>(null);

  useEffect(() => {
    if (!selectedProductId) {
      setReport(null);
      setAspects(null);
      return;
    }

    const load = async () => {
      try {
        const [nextReport, nextAspects] = await Promise.all([
          fetchAnomalyReport(selectedProductId).catch(() => null),
          fetchAspects(selectedProductId).catch(() => null),
        ]);
        setReport(nextReport);
        setAspects(nextAspects);
      } catch (error) {
        console.error('Failed to load recommendations', error);
      }
    };

    load();
  }, [selectedProductId]);

  const recommendations = useMemo<RecommendationItem[]>(() => {
    const items: RecommendationItem[] = [];

    for (const spike of report?.detected_spikes ?? []) {
      const severity = spike.severity.toLowerCase();
      const priority: 'High' | 'Medium' | 'Low' =
        severity === 'critical' || severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low';
      const color =
        priority === 'High'
          ? 'bg-[#FF3B30]/10 text-[#D70015]'
          : priority === 'Medium'
            ? 'bg-[#FF9500]/10 text-[#C16B00]'
            : 'bg-[#34C759]/10 text-[#248A3D]';

      items.push({
        id: `spike-${spike.aspect}`,
        priority,
        color,
        insight: `${spike.aspect} complaints are increasing (${spike.current_pct.toFixed(1)}% now).`,
        details: `Baseline ${spike.baseline_pct.toFixed(1)}%, current ${spike.current_pct.toFixed(1)}%, delta ${spike.spike_delta.toFixed(1)} percentage points.`,
        action: 'Open Incident',
      });
    }

    const topAspect = aspects?.aspect_breakdown?.[0];
    if (topAspect) {
      items.push({
        id: `aspect-${topAspect.aspect}`,
        priority: 'Low',
        color: 'bg-[#34C759]/10 text-[#248A3D]',
        insight: `${topAspect.aspect} is highly discussed (${topAspect.count.toLocaleString()} mentions).`,
        details: `Positive: ${topAspect.positive}, Negative: ${topAspect.negative}, Neutral: ${topAspect.neutral}. Avg score ${topAspect.avg_score.toFixed(2)}.`,
        action: 'Share with Product Team',
      });
    }

    if (!items.length) {
      items.push({
        id: 'empty',
        priority: 'Low',
        color: 'bg-[#34C759]/10 text-[#248A3D]',
        insight: 'No urgent recommendations yet. Keep ingesting fresh reviews.',
        details: 'Recommendations are generated from anomaly spikes and aspect trends.',
        action: 'View Evidence',
      });
    }

    return items.slice(0, 4);
  }, [report, aspects]);

  return (
    <div className="bg-white rounded-[24px] p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">Actionable Recommendations</h2>
        <button className="text-[13px] font-semibold text-[#0071E3] hover:bg-[#0071E3]/10 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 group">
          View All <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto">
        {recommendations.map((item) => (
          <div
            key={item.id}
            className={`flex flex-col gap-3 p-4 rounded-2xl cursor-pointer transition-all border ${expandedId === item.id ? 'bg-[#F5F5F7] border-[#E5E5EA]/80 shadow-sm' : 'bg-white border-transparent hover:bg-[#F5F5F7]/50'} group`}
            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[12px] font-semibold px-3 py-1 rounded-full ${item.color} flex items-center gap-1.5`}>
                <Bell size={12} strokeWidth={3} />
                {item.priority} Priority
              </span>
              <button
                className={`w-6 h-6 flex items-center justify-center rounded-full transition-transform ${expandedId === item.id ? 'rotate-180 bg-[#E5E5EA]' : 'group-hover:bg-[#E5E5EA]'}`}
              >
                <ChevronDown size={14} className="text-[#86868B]" strokeWidth={3} />
              </button>
            </div>

            <p className={`text-[15px] leading-[1.5] text-[#1D1D1F] font-medium transition-colors ${expandedId === item.id ? '' : 'group-hover:text-[#0071E3]'}`}>
              {item.insight}
            </p>

            <AnimatePresence>
              {expandedId === item.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 mt-2 border-t border-[#E5E5EA]/60">
                    <p className="text-[13px] leading-relaxed text-[#86868B] font-medium mb-4">{item.details}</p>

                    <div className="flex items-center gap-3">
                      <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-[#E5E5EA] hover:border-[#0071E3] hover:text-[#0071E3] text-[#1D1D1F] text-[13px] font-semibold rounded-xl transition-colors shadow-sm">
                        <Search size={14} /> View Evidence
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1D1D1F] hover:bg-black text-white text-[13px] font-semibold rounded-xl shadow-sm transition-colors">
                        <Tag size={14} /> {item.action}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
