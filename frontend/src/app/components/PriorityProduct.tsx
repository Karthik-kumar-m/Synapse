import React, { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, ArrowRight } from 'lucide-react';
import { fetchAnomalyReport, fetchBatchTrends, type AnomalyReport, type BatchTrendResponse } from '../api';

export function PriorityProduct({ selectedProductId = '' }: { selectedProductId?: string }) {
  const MIN_WINDOW_REVIEWS = 10;
  const [report, setReport] = useState<AnomalyReport | null>(null);
  const [trendData, setTrendData] = useState<BatchTrendResponse | null>(null);

  useEffect(() => {
    if (!selectedProductId) {
      setReport(null);
      setTrendData(null);
      return;
    }

    const load = async () => {
      try {
        const [nextReport, nextTrends] = await Promise.all([
          fetchAnomalyReport(selectedProductId).catch(() => null),
          fetchBatchTrends({ product_id: selectedProductId, batch_size: 50 }).catch(() => null),
        ]);
        setReport(nextReport);
        setTrendData(nextTrends);
      } catch {
        setReport(null);
        setTrendData(null);
      }
    };

    load();
  }, [selectedProductId]);

  const topSpike = report?.detected_spikes?.[0];
  const hasEnoughTrendData =
    (trendData?.current_window_reviews ?? 0) >= MIN_WINDOW_REVIEWS &&
    (trendData?.previous_window_reviews ?? 0) >= MIN_WINDOW_REVIEWS;

  const topNegativeTrend = hasEnoughTrendData
    ? (trendData?.trends ?? [])
        .filter((trend) => trend.negative_delta > 0)
        .sort((a, b) => b.negative_delta - a.negative_delta)[0]
    : undefined;

  const hasRiskSignal = Boolean(topSpike || topNegativeTrend);

  const priorityTone = topSpike
    ? topSpike.severity.toLowerCase() === 'critical' || topSpike.severity.toLowerCase() === 'high'
      ? 'Critical Priority'
      : 'Watch Priority'
    : topNegativeTrend
      ? 'Emerging Priority'
      : 'Stable';

  const keyIssue = topSpike
    ? `${topSpike.aspect} complaints rising (${topSpike.current_pct.toFixed(1)}%)`
    : topNegativeTrend
      ? `${topNegativeTrend.aspect} negative trend rising (${(topNegativeTrend.negative_delta * 100).toFixed(1)}pp)`
      : 'No active spikes detected for this product.';

  const riskDelta = topSpike
    ? `${topSpike.spike_delta.toFixed(1)} pp`
    : topNegativeTrend
      ? `${(topNegativeTrend.negative_delta * 100).toFixed(1)} pp`
      : '0.0 pp';

  return (
    <div className="bg-card border border-border shadow-sm rounded-[24px] p-6 lg:p-8 relative overflow-hidden flex flex-col h-full min-h-[300px]">
      <div className={`absolute top-0 left-0 w-1 h-full ${hasRiskSignal ? 'bg-destructive' : 'bg-emerald-500'}`} />

      <div className="flex items-center justify-between mb-6">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full w-fit ${hasRiskSignal ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
          <AlertTriangle size={14} strokeWidth={2.5} />
          <span className="text-[12px] font-bold uppercase tracking-wide">{priorityTone}</span>
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
                {keyIssue}
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
                  {hasRiskSignal ? riskDelta : '0.0 pp'}
                  <span className="font-medium text-foreground ml-1">vs baseline</span>
                </p>
              </div>
            </div>
          </div>

          {!hasRiskSignal && (
            <p className="text-[13px] text-muted-foreground font-medium pt-2 border-t border-border">
              Not enough review history yet for a reliable priority signal. Ingest more reviews before surfacing a trend-based warning.
            </p>
          )}
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
