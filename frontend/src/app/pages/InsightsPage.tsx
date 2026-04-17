import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Zap, Target } from 'lucide-react';
import { PageWrapper } from '../components/PageWrapper';
import { motion } from 'motion/react';
import type { DashboardContextType } from '../RootLayout';
import { fetchAIInsights, fetchAnomalyReport, fetchAspects, type AnomalyReport, type ProductAIInsights, type ProductAspects } from '../api';

export function InsightsPage() {
  const { dateFilter, category, selectedProductId } = useOutletContext<DashboardContextType>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aspects, setAspects] = useState<ProductAspects | null>(null);
  const [report, setReport] = useState<AnomalyReport | null>(null);
  const [aiInsights, setAiInsights] = useState<ProductAIInsights | null>(null);

  useEffect(() => {
    if (!selectedProductId) {
      setAspects(null);
      setReport(null);
      setAiInsights(null);
      return;
    }

    const load = async () => {
      setIsRefreshing(true);
      try {
        const [aspectsData, reportData, aiData] = await Promise.all([
          fetchAspects(selectedProductId).catch(() => null),
          fetchAnomalyReport(selectedProductId).catch(() => null),
          fetchAIInsights(selectedProductId).catch(() => null),
        ]);
        setAspects(aspectsData);
        setReport(reportData);
        setAiInsights(aiData);
      } finally {
        setIsRefreshing(false);
      }
    };

    load();
  }, [dateFilter, category, selectedProductId]);

  const complaintData = useMemo(() => {
    const breakdown = aspects?.aspect_breakdown ?? [];
    return breakdown.slice(0, 6).map((a, idx) => ({
      name: a.aspect,
      count: a.negative,
      color: idx === 0 ? '#FF3B30' : idx === 1 ? '#FF9500' : '#86868B',
    }));
  }, [aspects]);

  const topPriority = complaintData[0];
  const topSpike = report?.detected_spikes?.[0];

  return (
    <PageWrapper title="Insights & Reports">
      <motion.div
        animate={{ opacity: isRefreshing ? 0.5 : 1, scale: isRefreshing ? 0.98 : 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-6 h-full pb-8"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">Intelligence Reports</h2>
            <p className="text-[14px] text-[#86868B] mt-1 font-medium">Generated from live sentiment and anomaly detections.</p>
          </div>
          <button className="bg-[#0071E3] hover:bg-[#005bb5] transition-colors text-white text-[13px] font-semibold px-5 py-2.5 rounded-full shadow-sm">
            Export Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-4 text-[#86868B]">
              <Target size={18} />
              <span className="text-[13px] font-semibold uppercase tracking-wider">Top Priority Feature</span>
            </div>
            <h3 className="text-2xl font-bold text-[#1D1D1F] mb-2 tracking-tight">{topPriority?.name || 'No data yet'}</h3>
            <p className="text-[14px] leading-relaxed text-[#86868B] font-medium">
              {topPriority ? `${topPriority.count.toLocaleString()} negative mentions in selected range.` : 'Ingest reviews to generate feature intelligence.'}
            </p>
            <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#34C759]">
              <TrendingUp size={16} /> Live signal
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-4 text-[#86868B]">
              <Zap size={18} />
              <span className="text-[13px] font-semibold uppercase tracking-wider">Emerging Risk</span>
            </div>
            <h3 className="text-2xl font-bold text-[#1D1D1F] mb-2 tracking-tight">{topSpike?.aspect || 'No active spikes'}</h3>
            <p className="text-[14px] leading-relaxed text-[#86868B] font-medium">
              {topSpike ? `Current ${topSpike.current_pct.toFixed(1)}% vs baseline ${topSpike.baseline_pct.toFixed(1)}%.` : 'Anomaly detector has no spike for this product now.'}
            </p>
            <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#FF3B30]">
              <TrendingDown size={16} /> {topSpike ? `+${topSpike.spike_delta.toFixed(1)}pp` : '0.0pp'}
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-4 text-[#86868B]">
              <Minus size={18} />
              <span className="text-[13px] font-semibold uppercase tracking-wider">Stabilizing Metric</span>
            </div>
            <h3 className="text-2xl font-bold text-[#1D1D1F] mb-2 tracking-tight">Active Alerts</h3>
            <p className="text-[14px] leading-relaxed text-[#86868B] font-medium">
              {(report?.active_alerts?.length ?? 0).toLocaleString()} unresolved alerts for selected product.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#86868B]">
              <Minus size={16} /> Live updates
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[24px] p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex-1 min-h-[400px]">
          <div className="mb-8 border border-[#E5E5EA] rounded-2xl p-5 bg-[#F5F5F7]">
            <div className="flex items-center justify-between gap-4 mb-2">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">AI Root-Cause Brief</h3>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                {aiInsights?.generated_by === 'ollama' ? 'Local LLM' : 'Heuristic'}
              </span>
            </div>
            <p className="text-[14px] text-[#1D1D1F] leading-relaxed font-medium">
              {aiInsights?.summary || 'No AI insight yet. Ingest more reviews for this product to generate root-cause analysis.'}
            </p>
            <div className="mt-3 text-[12px] text-[#86868B] font-semibold">
              Confidence: {Math.round((aiInsights?.confidence ?? 0) * 100)}%
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <div className="text-[12px] text-[#86868B] font-semibold uppercase tracking-wider mb-2">Likely Root Causes</div>
                <ul className="text-[13px] text-[#1D1D1F] space-y-1 list-disc pl-4">
                  {(aiInsights?.likely_root_causes?.length ? aiInsights.likely_root_causes : ['No root-cause signals yet']).map((item, idx) => (
                    <li key={`cause-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[12px] text-[#86868B] font-semibold uppercase tracking-wider mb-2">Immediate Actions</div>
                <ul className="text-[13px] text-[#1D1D1F] space-y-1 list-disc pl-4">
                  {(aiInsights?.immediate_actions?.length ? aiInsights.immediate_actions : ['No action suggestions yet']).map((item, idx) => (
                    <li key={`action-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">Top Hardware Complaints</h2>
            <p className="text-[14px] text-[#86868B] mt-1 font-medium">Negative sentiment volume by aspect</p>
          </div>

          <div className="h-[300px] w-full">
            {complaintData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#86868B] font-medium">
                No aspect data available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={complaintData} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
                  <CartesianGrid key="grid" strokeDasharray="3 3" horizontal={false} stroke="#E5E5EA" strokeOpacity={0.5} />
                  <XAxis key="xaxis" type="number" hide />
                  <YAxis
                    key="yaxis"
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#1D1D1F', fontSize: 13, fontWeight: 600 }}
                    dx={-10}
                  />
                  <Tooltip
                    key="tooltip"
                    cursor={{ fill: '#F5F5F7' }}
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '12px',
                      border: '1px solid rgba(0,0,0,0.05)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      padding: '12px',
                      fontWeight: 600,
                      color: '#1D1D1F',
                    }}
                    itemStyle={{ color: '#86868B' }}
                  />
                  <Bar key="bar" dataKey="count" radius={[0, 8, 8, 0]} barSize={32}>
                    {complaintData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </motion.div>
    </PageWrapper>
  );
}
