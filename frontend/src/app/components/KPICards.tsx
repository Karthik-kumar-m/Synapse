import React from 'react';
import { MessageSquare, ShieldBan, Sparkles, Cpu } from 'lucide-react';
import type { ProductAspects, ProductSummary } from '../api';

type Props = {
  product?: ProductSummary;
  aspectsData?: ProductAspects | null;
};

export function KPICards({ product, aspectsData }: Props) {
  const totalReviews = product?.total_reviews ?? 0;
  const botOrDuplicate = (product?.bot_reviews ?? 0) + (product?.duplicate_reviews ?? 0);
  const botRate = totalReviews > 0 ? (botOrDuplicate / totalReviews) * 100 : 0;
  const sentimentPct = Math.max(0, Math.min(100, Math.round((product?.avg_sentiment_score ?? 0) * 10)));
  const activeFeatureExtraction = aspectsData?.aspect_breakdown?.length ?? 0;

  const kpis = [
    {
      title: 'Total Reviews',
      value: totalReviews.toLocaleString(),
      trend: product ? `${product.active_alerts} active alerts` : 'No data',
      trendUp: (product?.active_alerts ?? 0) === 0,
      icon: MessageSquare,
    },
    {
      title: 'Spam/Bot Rejections',
      value: botOrDuplicate.toLocaleString(),
      trend: `${botRate.toFixed(1)}% of reviews`,
      trendUp: botRate < 10,
      icon: ShieldBan,
    },
    {
      title: 'Sentiment Score',
      value: `${sentimentPct}%`,
      trend: `avg ${(product?.avg_sentiment_score ?? 0).toFixed(2)} / 10`,
      trendUp: sentimentPct >= 70,
      icon: Sparkles,
    },
    {
      title: 'Active Feature Extraction',
      value: activeFeatureExtraction.toLocaleString(),
      trend: aspectsData ? 'live aspect map' : 'awaiting data',
      trendUp: activeFeatureExtraction > 0,
      icon: Cpu,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi) => (
        <div
          key={kpi.title}
          className="bg-white rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-[14px] bg-[#F5F5F7] flex items-center justify-center mb-6">
              <kpi.icon size={20} className="text-[#86868B]" strokeWidth={2} />
            </div>
            <div
              className={`text-[13px] font-semibold px-2 py-1 rounded-full ${
                kpi.trendUp
                  ? 'bg-[#34C759]/10 text-[#248A3D]'
                  : 'bg-[#FF3B30]/10 text-[#D70015]'
              }`}
            >
              {kpi.trend}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[13px] font-medium text-[#86868B]">{kpi.title}</p>
            <h3 className="text-3xl font-semibold text-[#1D1D1F] tracking-tight">{kpi.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}
