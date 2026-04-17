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
  fetchProducts,
  fetchSummary,
  type Alert,
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
  }, [dateFilter, category, selectedProductId, setSelectedProductId]);

  useEffect(() => {
    if (!selectedProductId) {
      setAspectsData(null);
      return;
    }

    const loadProductData = async () => {
      try {
        const data = await fetchAspects(selectedProductId);
        setAspectsData(data);
      } catch (error) {
        setAspectsData(null);
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
