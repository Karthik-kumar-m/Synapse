import axios, { type AxiosProgressEvent } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
});

export type ProductSummary = {
  product_id: string;
  product_name: string;
  total_reviews: number;
  avg_sentiment_score: number;
  bot_reviews: number;
  duplicate_reviews: number;
  active_alerts: number;
};

export type DashboardSummary = {
  total_reviews: number;
  avg_sentiment_score: number;
  top_aspects: Array<{ aspect?: string; count?: number; [key: string]: unknown }>;
  active_alerts: number;
  bot_rate: number;
  sarcasm_rate: number;
  updated_at?: string | null;
};

export type ReviewAspect = {
  id: string;
  review_id: string;
  aspect: string;
  sentiment: string;
  score: number;
  confidence: number;
  is_sarcastic: boolean;
  flagged_for_review: boolean;
};

export type Review = {
  id: string;
  product_id: string;
  product_name: string;
  category?: string | null;
  raw_text: string;
  translated_text?: string | null;
  cleaned_text?: string | null;
  language_detected?: string | null;
  is_bot: boolean;
  is_spam?: boolean;
  spam_reason?: string | null;
  is_duplicate: boolean;
  duplicate_cluster_id?: string | null;
  overall_sentiment?: string | null;
  overall_score?: number | null;
  created_at: string;
  source: string;
  source_review_id?: string | null;
  rating?: number | null;
  firmware_version?: string | null;
  component_focus?: string | null;
  aspects: ReviewAspect[];
};

export type Alert = {
  id: string;
  product_id: string;
  aspect: string;
  baseline_pct: number;
  current_pct: number;
  spike_delta: number;
  triggered_at: string;
  severity: string;
  is_resolved: boolean;
};

export type ProductAspects = {
  product_id: string;
  total_reviews: number;
  aspect_breakdown: Array<{
    aspect: string;
    count: number;
    positive: number;
    negative: number;
    neutral: number;
    ambiguous: number;
    avg_score: number;
    updated_at: string;
  }>;
};

export type AnomalyReport = {
  product_id: string;
  total_reviews_analysed: number;
  detected_spikes: Array<{
    aspect: string;
    baseline_pct: number;
    current_pct: number;
    spike_delta: number;
    severity: string;
    is_systemic: boolean;
    updated_at: string;
  }>;
  active_alerts: Alert[];
  spike_count: number;
  systemic_failures: Array<Record<string, unknown>>;
};

export type ProductAIInsights = {
  product_id: string;
  generated_by: string;
  summary: string;
  likely_root_causes: string[];
  immediate_actions: string[];
  confidence: number;
};

export type BulkUploadResponse = {
  total_processed: number;
  duplicates_quarantined: number;
  bots_quarantined: number;
  spam_quarantined?: number;
  insights_generated: number;
};

export type TrendItem = {
  aspect: string;
  previous_negative_rate: number;
  current_negative_rate: number;
  negative_delta: number;
  previous_positive_rate: number;
  current_positive_rate: number;
  positive_delta: number;
  current_mentions: number;
  classification: 'isolated' | 'systemic' | string;
  trend_type: string;
};

export type BatchTrendResponse = {
  product_id?: string | null;
  batch_size: number;
  current_window_reviews: number;
  previous_window_reviews: number;
  trends: TrendItem[];
  message?: string;
};

export type CategoryComparisonItem = {
  category: string;
  total_reviews: number;
  avg_sentiment_score: number;
  bot_rate: number;
  spam_rate: number;
  duplicate_rate: number;
};

export type CategoryComparisonResponse = {
  categories: CategoryComparisonItem[];
};

export type UploadProgressHandler = (event: AxiosProgressEvent) => void;

export type IngestProgressResponse = {
  upload_id: string;
  status: 'processing' | 'completed' | 'failed' | string;
  total_reviews: number;
  processed_reviews: number;
  updated_at: string;
  error?: string | null;
};

export const fetchSummary = async () => (await api.get<DashboardSummary>('/dashboard/summary')).data;
export const fetchProducts = async () => (await api.get<ProductSummary[]>('/dashboard/products')).data;
export const fetchAlerts = async () => (await api.get<Alert[]>('/dashboard/alerts')).data;
export const fetchReviews = async (params: {
  page?: number;
  page_size?: number;
  product_id?: string;
  sentiment?: string;
  source?: string;
}) => (await api.get<Review[]>('/dashboard/reviews', { params })).data;
export const fetchAspects = async (productId: string) =>
  (await api.get<ProductAspects>(`/dashboard/aspects/${productId}`)).data;
export const fetchAnomalyReport = async (productId: string) =>
  (await api.get<AnomalyReport>(`/dashboard/anomaly-report/${productId}`)).data;
export const fetchAIInsights = async (productId: string) =>
  (await api.get<ProductAIInsights>(`/dashboard/ai-insights/${productId}`)).data;
export const fetchBatchTrends = async (params?: { product_id?: string; batch_size?: number }) =>
  (await api.get<BatchTrendResponse>('/dashboard/trends', { params })).data;
export const fetchCategoryComparison = async (params?: { top_n?: number }) =>
  (await api.get<CategoryComparisonResponse>('/dashboard/category-comparison', { params })).data;
export const downloadDashboardReport = async (params?: { product_id?: string; category?: string }) =>
  await api.get<Blob>('/dashboard/report/export', {
    params,
    responseType: 'blob',
  });

export const ingestCsv = async (
  file: File,
  onUploadProgress?: UploadProgressHandler,
  uploadId?: string,
) => {
  const form = new FormData();
  form.append('file', file);
  return (
    await api.post<BulkUploadResponse>('/ingest/csv', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(uploadId ? { 'X-Upload-Id': uploadId } : {}),
      },
      onUploadProgress,
    })
  ).data;
};

export const ingestJson = async (
  payload: Array<Record<string, unknown>>,
  onUploadProgress?: UploadProgressHandler,
  uploadId?: string,
) =>
  (
    await api.post<BulkUploadResponse>('/ingest/json', payload, {
      onUploadProgress,
      headers: uploadId ? { 'X-Upload-Id': uploadId } : undefined,
    })
  ).data;

export const ingestManual = async (payload: {
  product_id: string;
  product_name: string;
  raw_text: string;
  category?: string;
  source: 'manual';
}, onUploadProgress?: UploadProgressHandler, uploadId?: string) =>
  (
    await api.post<Review>('/ingest/manual', payload, {
      onUploadProgress,
      headers: uploadId ? { 'X-Upload-Id': uploadId } : undefined,
    })
  ).data;

export const fetchIngestProgress = async (uploadId: string) =>
  (await api.get<IngestProgressResponse>(`/ingest/progress/${uploadId}`)).data;

export const ingestRealtimeFeed = async (payload: Array<Record<string, unknown>>) =>
  (await api.post<{ job_id: string; status: string; reviews_received: number }>('/ingest/realtime-feed', payload)).data;
