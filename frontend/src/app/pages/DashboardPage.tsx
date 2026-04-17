import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { KPICards } from '../components/KPICards';
import { TrendChart } from '../components/TrendChart';
import { Recommendations } from '../components/Recommendations';
import { ReviewQueue } from '../components/ReviewQueue';
import { PageWrapper } from '../components/PageWrapper';
import { ProductSelector } from '../components/ProductSelector';
import { PriorityProduct } from '../components/PriorityProduct';
import { Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { DashboardContextType } from '../RootLayout';
import {
  fetchAlerts,
  fetchAspects,
  fetchBatchTrends,
  fetchProducts,
  fetchSummary,
  type Alert,
  type BatchTrendResponse,
  type DashboardSummary,
  type ProductAspects,
  type ProductSummary,
} from '../api';

export function DashboardPage() {
  const { dateFilter, category, selectedProductId, setSelectedProductId } =
    useOutletContext<DashboardContextType>();

  const [isGenerating, setIsGenerating] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [aspectsData, setAspectsData] = useState<ProductAspects | null>(null);
  const [trendData, setTrendData] = useState<BatchTrendResponse | null>(null);

  useEffect(() => {
    const loadTopLevel = async () => {
      setIsRefreshing(true);
      try {
        const [productsData, summaryData, alertsData] = await Promise.all([
          fetchProducts(),
          fetchSummary(),
          fetchAlerts(),
        ]);
        setProducts(productsData);
        setSummary(summaryData);
        setAlerts(alertsData);

        if (!selectedProductId && productsData.length > 0) {
          setSelectedProductId(productsData[0].product_id);
        }
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    loadTopLevel();
  }, [dateFilter, category, setSelectedProductId]);

  useEffect(() => {
    if (!selectedProductId) {
      setAspectsData(null);
      setTrendData(null);
      return;
    }

    const loadProductData = async () => {
      try {
        const [data, trends] = await Promise.all([
          fetchAspects(selectedProductId),
          fetchBatchTrends({ product_id: selectedProductId, batch_size: 50 }),
        ]);
        setAspectsData(data);
        setTrendData(trends);
      } catch (error) {
        setAspectsData(null);
        setTrendData(null);
        console.error('Failed to load aspect breakdown', error);
      }
    };

    loadProductData();
  }, [selectedProductId]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.product_id === selectedProductId),
    [products, selectedProductId],
  );

  const insightCards = useMemo(() => {
    if (alerts.length === 0) {
      return [
        {
          title: 'System Status',
          tone: 'text-[#34C759]',
          body: 'No active anomaly alerts. Ingest more reviews to keep intelligence current.',
        },
      ];
    }

    return alerts.slice(0, 3).map((alert) => ({
      title: `${alert.severity.toUpperCase()} • ${alert.aspect}`,
      tone:
        alert.severity === 'critical' || alert.severity === 'high'
          ? 'text-[#FF3B30]'
          : alert.severity === 'medium'
            ? 'text-[#FF9500]'
            : 'text-[#34C759]',
      body: `${alert.product_id}: ${alert.current_pct.toFixed(1)}% now vs ${alert.baseline_pct.toFixed(1)}% baseline (Δ ${alert.spike_delta.toFixed(1)}).`,
    }));
  }, [alerts]);

  const handleGenerateInsights = () => {
    setIsGenerating(true);
    setShowInsights(false);
    setTimeout(() => {
      setIsGenerating(false);
      setShowInsights(true);
    }, 900);
  };

  return (
    <PageWrapper title={`Dashboard - ${category}`}>
      <div className="flex flex-col gap-6 h-full pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1D1D1F] tracking-tight">{category} Overview</h1>
            <p className="text-[#86868B] font-medium mt-1">Intelligence tracking for {dateFilter.toLowerCase()}</p>
          </div>

          <button
            onClick={handleGenerateInsights}
            disabled={isGenerating}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-semibold text-[14px] shadow-[0_4px_12px_rgba(0,113,227,0.3)] transition-all ${isGenerating ? 'bg-[#0071E3]/70 cursor-not-allowed' : 'bg-[#0071E3] hover:bg-[#005bb5] hover:scale-105 active:scale-95'}`}
          >
            {isGenerating ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <Loader2 size={16} strokeWidth={3} />
              </motion.div>
            ) : (
              <Sparkles size={16} strokeWidth={2.5} />
            )}
            {isGenerating ? 'Analyzing Data...' : 'Generate AI Insights'}
          </button>
        </div>

        <AnimatePresence>
          {showInsights && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="bg-gradient-to-r from-[#0071E3]/10 to-[#A78BFA]/10 rounded-[24px] p-6 border border-[#0071E3]/20 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={18} className="text-[#0071E3]" />
                <h3 className="text-[15px] font-semibold text-[#1D1D1F]">AI Summary</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {insightCards.map((card) => (
                  <div key={card.title} className="bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white/50 shadow-sm">
                    <h4 className={`text-[13px] font-bold mb-1 ${card.tone}`}>{card.title}</h4>
                    <p className="text-[14px] text-[#1D1D1F] font-medium leading-relaxed">{card.body}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ProductSelector
          products={products}
          selectedProductId={selectedProductId}
          onSelectProduct={setSelectedProductId}
        />

        <motion.div
          animate={{ opacity: isRefreshing ? 0.5 : 1, scale: isRefreshing ? 0.98 : 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-6"
        >
          <KPICards product={selectedProduct} aspectsData={aspectsData} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <TrendChart selectedProductId={selectedProductId} />
            </div>
            <div>
              <PriorityProduct selectedProductId={selectedProductId} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[500px]">
            <Recommendations selectedProductId={selectedProductId} />
            <ReviewQueue selectedProductId={selectedProductId} />
          </div>

          <div className="bg-white border border-[#E5E5EA] rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-[#1D1D1F]">Emerging Trends (Current vs Previous Batch)</h3>
              <span className="text-[12px] text-[#86868B] font-semibold uppercase tracking-wider">
                batch {trendData?.batch_size ?? 50}
              </span>
            </div>
            {!trendData || trendData.trends.length === 0 ? (
              <p className="text-[14px] text-[#86868B]">No meaningful trend shift detected yet.</p>
            ) : (
              <div className="space-y-3">
                {trendData.trends.slice(0, 6).map((trend) => (
                  <div key={trend.aspect} className="rounded-2xl border border-[#E5E5EA] p-4 bg-[#F5F5F7]/40">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[14px] font-semibold text-[#1D1D1F]">{trend.aspect}</div>
                        <div className="text-[12px] text-[#86868B] mt-1">
                          Current negative: {(trend.current_negative_rate * 100).toFixed(1)}% | Previous: {(trend.previous_negative_rate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-[13px] font-bold ${
                            trend.negative_delta > 0 ? 'text-[#D70015]' : 'text-[#248A3D]'
                          }`}
                        >
                          Δ {(trend.negative_delta * 100).toFixed(1)} pp
                        </div>
                        <div className="text-[12px] text-[#86868B] uppercase tracking-wider mt-1">
                          {trend.trend_type.replaceAll('_', ' ')} • {trend.classification}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {summary && (
            <div className="text-[12px] text-[#86868B] font-medium text-right">
              Global summary: {summary.total_reviews.toLocaleString()} reviews, avg sentiment {summary.avg_sentiment_score.toFixed(2)}
            </div>
          )}
        </motion.div>
      </div>
    </PageWrapper>
  );
}
