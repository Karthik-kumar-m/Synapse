import React, { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, ArrowRight } from 'lucide-react';
import { fetchAnomalyReport, type AnomalyReport } from '../api';

export function PriorityProduct({ selectedProductId = '' }: { selectedProductId?: string }) {
  const [report, setReport] = useState<AnomalyReport | null>(null);

  useEffect(() => {
    if (!selectedProductId) {
      setReport(null);
      return;
    }

    const load = async () => {
      try {
        const nextReport = await fetchAnomalyReport(selectedProductId);
        setReport(nextReport);
      } catch {
        setReport(null);
      }
    };

    load();
  }, [selectedProductId]);

  const topSpike = report?.detected_spikes?.[0];

  return (
    <div className="bg-card border border-border shadow-sm rounded-[24px] p-6 lg:p-8 relative overflow-hidden flex flex-col h-full min-h-[300px]">
      <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 w-fit">
          <AlertTriangle size={14} strokeWidth={2.5} />
          <span className="text-[12px] font-bold uppercase tracking-wide">Critical Priority</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2 line-clamp-1">
          {selectedProductId || 'Select a product'}
        </h2>

        <div className="bg-secondary/50 rounded-xl p-4 border border-border mt-2 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 bg-destructive/20 p-1.5 rounded-full text-destructive shrink-0">
              <AlertTriangle size={16} />
            </div>
            <div>
              <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Key Issue</span>
              <p className="text-[15px] font-medium text-foreground leading-tight">
                {topSpike
                  ? `${topSpike.aspect} complaints rising (${topSpike.current_pct.toFixed(1)}%)`
                  : 'No active spikes detected for this product.'}
              </p>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border" />

          <div className="flex items-center gap-3">
            <div className="bg-[#FF9500]/20 p-1.5 rounded-full text-[#FF9500] shrink-0">
              <TrendingDown size={16} />
            </div>
            <div>
              <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Sentiment Risk Delta</span>
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-bold text-[#FF9500] leading-tight">
                  {topSpike ? `${topSpike.spike_delta.toFixed(1)} pp` : '0.0 pp'}
                  <span className="font-medium text-foreground ml-1">vs baseline</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end border-t border-border pt-6">
        <button className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-foreground text-background font-semibold text-[14px] shadow-sm hover:scale-105 active:scale-95 transition-all group">
          View Detailed Analytics
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
