import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Zap, Target } from 'lucide-react';
import { PageWrapper } from '../components/PageWrapper';
import { motion } from 'motion/react';
import type { DashboardContextType } from '../RootLayout';
import {
  downloadDashboardReport,
  fetchAIInsights,
  fetchAnomalyReport,
  fetchAspects,
  fetchBatchTrends,
  fetchCategoryComparison,
  fetchReviews,
  type AnomalyReport,
  type BatchTrendResponse,
  type CategoryComparisonItem,
  type ProductAIInsights,
  type ProductAspects,
  type Review,
} from '../api';

export function InsightsPage() {
  const { dateFilter, category, selectedProductId } = useOutletContext<DashboardContextType>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [aspects, setAspects] = useState<ProductAspects | null>(null);
  const [report, setReport] = useState<AnomalyReport | null>(null);
  const [aiInsights, setAiInsights] = useState<ProductAIInsights | null>(null);
  const [trendData, setTrendData] = useState<BatchTrendResponse | null>(null);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [categoryComparison, setCategoryComparison] = useState<CategoryComparisonItem[]>([]);

  useEffect(() => {
    if (!selectedProductId) {
      setAspects(null);
      setReport(null);
      setAiInsights(null);
      setTrendData(null);
      setRecentReviews([]);
      setCategoryComparison([]);
      return;
    }

    const load = async () => {
      setIsRefreshing(true);
      try {
        const [aspectsData, reportData, aiData, trendsData, reviewsData, categoryData] = await Promise.all([
          fetchAspects(selectedProductId).catch(() => null),
          fetchAnomalyReport(selectedProductId).catch(() => null),
          fetchAIInsights(selectedProductId).catch(() => null),
          fetchBatchTrends({ product_id: selectedProductId, batch_size: 50 }).catch(() => null),
          fetchReviews({ product_id: selectedProductId, page: 1, page_size: 20 }).catch(() => []),
          fetchCategoryComparison({ top_n: 5 }).catch(() => ({ categories: [] })),
        ]);
        setAspects(aspectsData);
        setReport(reportData);
        setAiInsights(aiData);
        setTrendData(trendsData);
        setRecentReviews(reviewsData);
        setCategoryComparison(categoryData.categories ?? []);
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
  const strongestNegativeTrend = useMemo(
    () => (trendData?.trends ?? []).sort((a, b) => b.negative_delta - a.negative_delta)[0],
    [trendData],
  );
  const riskTitle =
    topSpike?.aspect ||
    (strongestNegativeTrend && strongestNegativeTrend.negative_delta > 0 ? strongestNegativeTrend.aspect : 'No active spikes');
  const riskBody = topSpike
    ? `Current ${topSpike.current_pct.toFixed(1)}% vs baseline ${topSpike.baseline_pct.toFixed(1)}%.`
    : strongestNegativeTrend && strongestNegativeTrend.negative_delta > 0
      ? `Negative rate changed by ${(strongestNegativeTrend.negative_delta * 100).toFixed(1)}pp (${strongestNegativeTrend.classification}).`
      : 'Anomaly detector has no spike for this product now.';
  const riskDeltaLabel = topSpike
    ? `+${topSpike.spike_delta.toFixed(1)}pp`
    : strongestNegativeTrend && strongestNegativeTrend.negative_delta > 0
      ? `${(strongestNegativeTrend.negative_delta * 100).toFixed(1)}pp`
      : '0.0pp';

  const flaggedReviews = useMemo(
    () => recentReviews.filter((review) => review.is_bot || review.is_spam || review.is_duplicate),
    [recentReviews],
  );

  const translationPairs = useMemo(
    () =>
      recentReviews
        .filter(
          (review) =>
            !!review.raw_text &&
            !!review.translated_text &&
            review.language_detected &&
            review.language_detected !== 'en',
        )
        .map((review) => ({ raw: review.raw_text, translated: review.translated_text as string })),
    [recentReviews],
  );

  const renderTranslatedInsightText = (text: string): string => {
    if (!text) return text;

    let resolved = text;
    for (const pair of translationPairs) {
      if (pair.raw && pair.translated && resolved.includes(pair.raw)) {
        resolved = resolved.replaceAll(pair.raw, pair.translated);
      }
    }
    return resolved;
  };

  const aiSummaryDisplay = renderTranslatedInsightText(aiInsights?.summary || '');
  const aiRootCausesDisplay = (aiInsights?.likely_root_causes ?? []).map((item) => renderTranslatedInsightText(item));
  const aiActionsDisplay = (aiInsights?.immediate_actions ?? []).map((item) => renderTranslatedInsightText(item));

  const evidenceHighlights = useMemo(() => {
    const highlights: string[] = [];

    if (topPriority) {
      highlights.push(`${topPriority.name} leads complaints with ${topPriority.count.toLocaleString()} negative mentions.`);
    }

    if (topSpike) {
      highlights.push(`Anomaly alert: ${topSpike.aspect} spiked by ${topSpike.spike_delta.toFixed(1)}pp over baseline.`);
    }

    if (strongestNegativeTrend && strongestNegativeTrend.negative_delta > 0) {
      highlights.push(
        `Emerging shift: ${strongestNegativeTrend.aspect} negative rate moved by ${(strongestNegativeTrend.negative_delta * 100).toFixed(1)}pp (${strongestNegativeTrend.classification}).`,
      );
    }

    if (flaggedReviews.length > 0) {
      highlights.push(`${flaggedReviews.length} of the latest ${recentReviews.length} reviews were quarantined/flagged (spam, bot, or duplicate).`);
    }

    const sampleRecent = recentReviews[0];
    if (sampleRecent) {
      const sampleText =
        sampleRecent.language_detected && sampleRecent.language_detected !== 'en' && sampleRecent.translated_text
          ? sampleRecent.translated_text
          : sampleRecent.raw_text;
      const preview = sampleText.length > 110 ? `${sampleText.slice(0, 110)}...` : sampleText;
      highlights.push(`Recent signal sample: "${preview}"`);
    }

    if (highlights.length === 0) {
      highlights.push('No strong insight signals yet. Ingest at least 30 varied reviews for this product to unlock richer trend and anomaly insights.');
    }

    return highlights.slice(0, 5);
  }, [flaggedReviews.length, recentReviews.length, strongestNegativeTrend, topPriority, topSpike]);

  const handleExportReport = async () => {
    setIsDownloadingReport(true);
    setExportError(null);
    try {
      const response = await downloadDashboardReport({
        product_id: selectedProductId || undefined,
        category: category || undefined,
      });

      const contentDisposition = response.headers['content-disposition'] as string | undefined;
      const fallbackName = `synapse_report_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      const fileNameMatch = contentDisposition?.match(/filename="?([^\"]+)"?/i);
      const fileName = fileNameMatch?.[1] ?? fallbackName;

      const blobUrl = window.URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const fallbackMessage = 'Unable to export report right now. Please verify backend is running and try again.';
      setExportError(typeof detail === 'string' && detail.trim() ? detail : fallbackMessage);
    } finally {
      setIsDownloadingReport(false);
    }
  };

  return (
    <PageWrapper title="Insights & Reports">
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-6 h-full pb-8"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">Intelligence Reports</h2>
            <p className="text-[14px] text-[#86868B] mt-1 font-medium">Generated from live sentiment and anomaly detections.</p>
          </div>
          <button
            onClick={handleExportReport}
            disabled={isDownloadingReport}
            className="bg-[#0071E3] hover:bg-[#005bb5] transition-colors text-white text-[13px] font-semibold px-5 py-2.5 rounded-full shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDownloadingReport ? 'Preparing Report...' : 'Export Report'}
          </button>
        </div>

        {exportError && (
          <div className="rounded-2xl border border-[#FF3B30]/30 bg-[#FF3B30]/5 px-4 py-3 text-[13px] text-[#D70015] font-medium">
            {exportError}
          </div>
        )}

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
            <h3 className="text-2xl font-bold text-[#1D1D1F] mb-2 tracking-tight">{riskTitle}</h3>
            <p className="text-[14px] leading-relaxed text-[#86868B] font-medium">
              {riskBody}
            </p>
            <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#FF3B30]">
              <TrendingDown size={16} /> {riskDeltaLabel}
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
          <div className="mb-6 rounded-2xl border border-[#E5E5EA] bg-[#FCFCFD] p-5">
            <h3 className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight mb-3">Evidence Highlights</h3>
            <ul className="space-y-2 text-[14px] text-[#1D1D1F]">
              {evidenceHighlights.map((item, idx) => (
                <li key={`evidence-${idx}`} className="flex items-start gap-2">
                  <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-[#0071E3]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-8 border border-[#E5E5EA] rounded-2xl p-5 bg-[#F5F5F7]">
            <div className="flex items-center justify-between gap-4 mb-2">
              <h3 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">AI Root-Cause Brief</h3>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                {aiInsights?.generated_by === 'ollama' ? 'Local LLM' : 'Heuristic'}
              </span>
            </div>
            <p className="text-[14px] text-[#1D1D1F] leading-relaxed font-medium">
              {aiSummaryDisplay || 'No AI insight yet. Ingest more reviews for this product to generate root-cause analysis.'}
            </p>
            <div className="mt-3 text-[12px] text-[#86868B] font-semibold">
              Confidence: {Math.round((aiInsights?.confidence ?? 0) * 100)}%
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <div className="text-[12px] text-[#86868B] font-semibold uppercase tracking-wider mb-2">Likely Root Causes</div>
                <ul className="text-[13px] text-[#1D1D1F] space-y-1 list-disc pl-4">
                  {(aiRootCausesDisplay.length ? aiRootCausesDisplay : ['No root-cause signals yet']).map((item, idx) => (
                    <li key={`cause-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[12px] text-[#86868B] font-semibold uppercase tracking-wider mb-2">Immediate Actions</div>
                <ul className="text-[13px] text-[#1D1D1F] space-y-1 list-disc pl-4">
                  {(aiActionsDisplay.length ? aiActionsDisplay : ['No action suggestions yet']).map((item, idx) => (
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

          <div className="mt-10 mb-4">
            <h2 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">Cross-Category Comparison</h2>
            <p className="text-[14px] text-[#86868B] mt-1 font-medium">Compare sentiment across Consumer Electronics, Home Appliances, and Software Services.</p>
          </div>

          <div className="h-[260px] w-full mb-5">
            {categoryComparison.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#86868B] font-medium">
                No category-level data available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryComparison} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
                  <XAxis dataKey="category" tick={{ fill: '#1D1D1F', fontSize: 12, fontWeight: 600 }} interval={0} angle={-10} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#1D1D1F', fontSize: 12 }} domain={[-1, 1]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      borderRadius: '12px',
                      border: '1px solid rgba(0,0,0,0.05)',
                      boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="avg_sentiment_score" radius={[8, 8, 0, 0]} fill="#0071E3" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {categoryComparison.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {categoryComparison.slice(0, 3).map((item) => (
                <div key={item.category} className="rounded-2xl border border-[#E5E5EA] bg-[#FCFCFD] p-4">
                  <div className="text-[14px] font-semibold text-[#1D1D1F]">{item.category}</div>
                  <div className="text-[12px] text-[#86868B] mt-1">Reviews: {item.total_reviews.toLocaleString()}</div>
                  <div className="text-[12px] text-[#86868B]">Spam rate: {(item.spam_rate * 100).toFixed(1)}%</div>
                  <div className="text-[12px] text-[#86868B]">Bot rate: {(item.bot_rate * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </PageWrapper>
  );
}
