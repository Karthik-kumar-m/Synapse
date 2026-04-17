import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search } from 'lucide-react';
import { fetchAnomalyReport, fetchReviews, type AnomalyReport } from '../api';

type ChartPoint = {
  name: string;
  sentiment: number;
  reviews: number;
  anomaly?: boolean;
};

export function TrendChart({ selectedProductId = '' }: { selectedProductId?: string }) {
  const [selectedPoint, setSelectedPoint] = useState<ChartPoint | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [report, setReport] = useState<AnomalyReport | null>(null);

  useEffect(() => {
    if (!selectedProductId) {
      setChartData([]);
      setReport(null);
      return;
    }

    const load = async () => {
      try {
        const [reviews, anomalyReport] = await Promise.all([
          fetchReviews({ product_id: selectedProductId, page: 1, page_size: 200 }),
          fetchAnomalyReport(selectedProductId).catch(() => null),
        ]);

        const buckets = new Map<string, { sum: number; count: number }>();
        for (const review of reviews) {
          const dateLabel = new Date(review.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          const score = Number(review.overall_score ?? 0);
          const prev = buckets.get(dateLabel) ?? { sum: 0, count: 0 };
          buckets.set(dateLabel, { sum: prev.sum + score, count: prev.count + 1 });
        }

        const points = Array.from(buckets.entries()).map(([name, v]) => ({
          name,
          sentiment: Number((v.sum / Math.max(v.count, 1)).toFixed(2)),
          reviews: v.count,
        }));

        const withAnomaly = points.map((point, idx) => ({
          ...point,
          anomaly: (anomalyReport?.spike_count ?? 0) > 0 && idx === points.length - 1,
        }));

        setChartData(withAnomaly);
        setReport(anomalyReport);
      } catch (error) {
        setChartData([]);
        setReport(null);
        console.error('Failed to load trend chart data', error);
      }
    };

    load();
  }, [selectedProductId]);

  const anomalyPoint = useMemo(() => chartData.find((d) => d.anomaly), [chartData]);

  const handleClick = (point: any) => {
    if (point?.activePayload?.length) {
      setSelectedPoint(point.activePayload[0].payload as ChartPoint);
    }
  };

  return (
    <>
      <div className="bg-white rounded-[24px] p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] h-[400px] flex flex-col relative z-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">Feature Sentiment Trends</h2>
            <p className="text-[14px] text-[#86868B] mt-1 font-medium">Live trend from recent product reviews.</p>
          </div>
          <div className="flex items-center gap-4 text-[13px] font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0071E3]"></span>
              <span className="text-[#1D1D1F]">Sentiment</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF9500]"></span>
              <span className="text-[#1D1D1F]">Anomaly Detected</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative -ml-4 cursor-pointer">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-[#86868B] font-medium">
              No trend data yet for this product.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={handleClick}>
                <defs key="defs">
                  <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0071E3" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid key="grid" strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" strokeOpacity={0.5} />
                <XAxis
                  key="xaxis"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#86868B', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  key="yaxis"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#86868B', fontSize: 12, fontWeight: 500 }}
                  domain={['auto', 'auto']}
                  tickCount={6}
                />
                <Tooltip
                  key="tooltip"
                  cursor={{ stroke: '#0071E3', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(0,0,0,0.05)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    padding: '12px',
                  }}
                  itemStyle={{ color: '#1D1D1F', fontWeight: 600 }}
                  labelStyle={{ color: '#86868B', marginBottom: '4px', fontSize: '12px' }}
                />
                <Area
                  key="area"
                  type="monotone"
                  dataKey="sentiment"
                  stroke="#0071E3"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorSentiment)"
                  activeDot={{ r: 6, fill: '#0071E3', stroke: '#fff', strokeWidth: 3 }}
                />
                {anomalyPoint && (
                  <ReferenceDot
                    x={anomalyPoint.name}
                    y={anomalyPoint.sentiment}
                    r={6}
                    fill="#FF9500"
                    stroke="#fff"
                    strokeWidth={3}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedPoint && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedPoint(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className={`p-6 border-b ${selectedPoint.anomaly ? 'bg-[#FF9500]/10 border-[#FF9500]/20' : 'bg-[#F5F5F7]/50 border-[#E5E5EA]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-[#1D1D1F]">{selectedPoint.name} Summary</h3>
                  <button onClick={() => setSelectedPoint(null)} className="p-1 rounded-full hover:bg-black/5 transition-colors">
                    <X size={20} className="text-[#86868B]" />
                  </button>
                </div>
                {selectedPoint.anomaly && (
                  <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#FF9500] text-white text-[12px] font-bold tracking-wide uppercase">
                    Anomaly Detected
                  </div>
                )}
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#F5F5F7] p-4 rounded-2xl">
                    <p className="text-[13px] text-[#86868B] font-semibold mb-1">Sentiment Score</p>
                    <p className={`text-3xl font-bold ${selectedPoint.anomaly ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>
                      {selectedPoint.sentiment.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-[#F5F5F7] p-4 rounded-2xl">
                    <p className="text-[13px] text-[#86868B] font-semibold mb-1">Reviews That Day</p>
                    <p className="text-3xl font-bold text-[#1D1D1F]">{selectedPoint.reviews.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-[14px] font-semibold text-[#1D1D1F] mb-3">Current Spike Signals</h4>
                  <ul className="space-y-2">
                    {(report?.detected_spikes ?? []).slice(0, 3).map((spike) => (
                      <li key={spike.aspect} className="flex items-center justify-between text-[14px] p-2 hover:bg-[#F5F5F7] rounded-lg transition-colors cursor-pointer group">
                        <span className="text-[#86868B] group-hover:text-[#1D1D1F]">{spike.aspect}</span>
                        <span className="text-[#FF3B30] font-semibold">+{spike.spike_delta.toFixed(1)}pp</span>
                      </li>
                    ))}
                    {(report?.detected_spikes ?? []).length === 0 && (
                      <li className="text-[13px] text-[#86868B]">No active spikes for this product.</li>
                    )}
                  </ul>
                </div>

                <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0071E3] hover:bg-[#005bb5] transition-colors text-white font-semibold rounded-[14px] shadow-sm">
                  <Search size={16} />
                  Deep Dive into Reviews
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
