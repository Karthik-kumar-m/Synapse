import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  FileJson,
  Edit3,
  Activity,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Send,
} from 'lucide-react';
import { PageWrapper } from '../components/PageWrapper';
import { Progress } from '../components/ui/progress';
import {
  fetchIngestProgress,
  ingestCsv,
  ingestJson,
  ingestManual,
  ingestRealtimeFeed,
  type BulkUploadResponse,
  type UploadProgressHandler,
} from '../api';

type Tab = 'csv' | 'json' | 'manual' | 'realtime';
type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export function IngestPage() {
  const [activeTab, setActiveTab] = useState<Tab>('csv');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressCompleted, setUploadProgressCompleted] = useState(0);
  const [uploadProgressTotal, setUploadProgressTotal] = useState(0);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastUpload, setLastUpload] = useState<BulkUploadResponse | null>(null);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState('[\n  {\n    "product_id": "demo-product",\n    "product_name": "Demo Product",\n    "text": "Battery life is decent but charging takes too long."\n  }\n]');

  const [manualProductId, setManualProductId] = useState('manual-product');
  const [manualProductName, setManualProductName] = useState('Manual Product');
  const [manualSource, setManualSource] = useState('manual');
  const [manualText, setManualText] = useState('');

  const [liveReviews, setLiveReviews] = useState<
    { id: number; text: string; time: string; sentiment: 'positive' | 'negative' | 'neutral' }[]
  >([]);

  useEffect(() => {
    setUploadState('idle');
    setErrorMessage('');
  }, [activeTab]);

  useEffect(() => {
    if (uploadState !== 'uploading' || !activeUploadId) {
      if (uploadState !== 'uploading') {
        setUploadProgress(0);
        setUploadProgressCompleted(0);
        setUploadProgressTotal(0);
        setActiveUploadId(null);
      }
      return;
    }

    let isActive = true;
    const poll = async () => {
      try {
        const progress = await fetchIngestProgress(activeUploadId);
        if (!isActive) {
          return;
        }

        const total = Math.max(1, progress.total_reviews || 1);
        const completed = Math.max(0, Math.min(total, progress.processed_reviews || 0));
        setUploadProgressTotal(total);
        setUploadProgressCompleted(completed);
        setUploadProgress(Math.round((completed / total) * 100));

        if (progress.status === 'failed') {
          setUploadState('error');
          setErrorMessage(progress.error || 'Upload processing failed.');
          return;
        }
      } catch {
        // Ignore transient polling failures while upload request is still active.
      }
    };

    const interval = setInterval(poll, 300);
    void poll();

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [uploadState, activeUploadId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(async () => {
        const payload = [
          {
            product_id: 'live-product',
            product_name: 'Live Product',
            text:
              [
                'Just received mine, setup was smooth and fast.',
                'Battery seems to drain quickly after latest update.',
                'Packaging was premium and delivery was timely.',
                'Bluetooth drops for a second every few minutes.',
                'Customer support resolved my issue in one call.',
              ][Math.floor(Math.random() * 5)],
          },
        ];

        try {
          await ingestRealtimeFeed(payload);
          const text = payload[0].text as string;
          const sentiment: 'positive' | 'negative' | 'neutral' = text.includes('drain') || text.includes('drops')
            ? 'negative'
            : text.includes('smooth') || text.includes('premium') || text.includes('resolved')
              ? 'positive'
              : 'neutral';

          setLiveReviews((prev) => [
            {
              id: Date.now(),
              text,
              time: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              sentiment,
            },
            ...prev,
          ].slice(0, 10));
        } catch (error) {
          console.error('Failed to post realtime sample', error);
        }
      }, 3500);
    }

    return () => clearInterval(interval);
  }, [isLive]);

  const summaryCards = useMemo(() => {
    if (!lastUpload) return null;

    const spamQuarantined = lastUpload.spam_quarantined ?? 0;
    const botRate = lastUpload.total_processed
      ? (lastUpload.bots_quarantined / lastUpload.total_processed) * 100
      : 0;
    const spamRate = lastUpload.total_processed
      ? (spamQuarantined / lastUpload.total_processed) * 100
      : 0;

    return {
      total: lastUpload.total_processed,
      botRate,
      spamRate,
      spamQuarantined,
      duplicateCount: lastUpload.duplicates_quarantined,
      topIssue: lastUpload.duplicates_quarantined > 0 ? 'Duplicate Review Spike' : 'No critical issue',
      insight:
        lastUpload.insights_generated > 0
          ? `Generated ${lastUpload.insights_generated} aspect insights and updated aggregate intelligence.`
          : 'No new aspect insights generated for this batch.',
    };
  }, [lastUpload]);

  const countCsvRows = async (file: File): Promise<number> => {
    const contents = await file.text();
    return contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1).length;
  };

  const getJsonRecordCount = (payload: unknown): number => {
    if (Array.isArray(payload)) {
      return payload.length;
    }

    if (payload && typeof payload === 'object') {
      const maybeImages = (payload as { images?: unknown[] }).images;
      if (Array.isArray(maybeImages)) {
        return maybeImages.length;
      }
    }

    return 0;
  };

  const beginUpload = (totalRecords: number) => {
    setUploadProgressTotal(Math.max(1, totalRecords));
    setUploadProgressCompleted(0);
    setUploadProgress(0);
    setUploadState('uploading');
    setErrorMessage('');
  };

  const createUploadId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `upload-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  };

  const buildUploadProgressHandler = (totalRecords: number): UploadProgressHandler => {
    const safeTotal = Math.max(1, totalRecords);

    return (event) => {
      const ratioFromProgress = typeof event.progress === 'number' ? event.progress : undefined;
      const ratioFromBytes = event.total ? event.loaded / event.total : undefined;
      const ratio = Math.max(0, Math.min(1, ratioFromProgress ?? ratioFromBytes ?? 0));

      const visualProgress = Math.max(8, Math.min(92, Math.round(ratio * 92)));
      setUploadProgress((current) => Math.max(current, visualProgress));

      const uploadedEstimate = Math.max(0, Math.min(safeTotal - 1, Math.ceil(ratio * safeTotal)));
      setUploadProgressCompleted((current) => Math.max(current, uploadedEstimate));
    };
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setUploadState('error');
      setErrorMessage('Please select a CSV file before uploading.');
      return;
    }

    const totalRecords = await countCsvRows(csvFile);
    const uploadId = createUploadId();
    setActiveUploadId(uploadId);
    beginUpload(totalRecords);

    try {
      const result = await ingestCsv(csvFile, buildUploadProgressHandler(totalRecords), uploadId);
      setLastUpload(result);
      const finalTotal = Math.max(1, result.total_processed);
      setUploadProgressTotal(finalTotal);
      setUploadProgressCompleted(finalTotal);
      setUploadProgress(100);
      setUploadState('success');
    } catch (error: any) {
      setUploadState('error');
      setErrorMessage(error?.response?.data?.detail || 'CSV upload failed.');
    }
  };

  const handleJsonUpload = async () => {
    let payload: unknown;

    try {
      payload = JSON.parse(jsonText);
    } catch (error: any) {
      setUploadState('error');
      setErrorMessage('JSON upload failed. Make sure the payload is a valid array.');
      return;
    }

    const totalRecords = getJsonRecordCount(payload);
    const uploadId = createUploadId();
    setActiveUploadId(uploadId);
    beginUpload(totalRecords);

    try {
      const result = await ingestJson(payload, buildUploadProgressHandler(totalRecords), uploadId);
      setLastUpload(result);
      const finalTotal = Math.max(1, result.total_processed);
      setUploadProgressTotal(finalTotal);
      setUploadProgressCompleted(finalTotal);
      setUploadProgress(100);
      setUploadState('success');
    } catch (error: any) {
      setUploadState('error');
      setErrorMessage(error?.response?.data?.detail || 'JSON upload failed. Make sure the payload is a valid array.');
    }
  };

  const handleManualSubmit = async () => {
    if (!manualText.trim() || !manualProductId.trim() || !manualProductName.trim()) {
      setUploadState('error');
      setErrorMessage('Product ID, product name, and review text are required.');
      return;
    }

    const uploadId = createUploadId();
    setActiveUploadId(uploadId);
    beginUpload(1);

    try {
      await ingestManual({
        product_id: manualProductId.trim(),
        product_name: manualProductName.trim(),
        raw_text: manualText.trim(),
        source: 'manual',
      }, buildUploadProgressHandler(1), uploadId);
      setUploadProgressTotal(1);
      setUploadProgressCompleted(1);
      setUploadProgress(100);
      setUploadState('success');
      setLastUpload({
        total_processed: 1,
        duplicates_quarantined: 0,
        bots_quarantined: 0,
        spam_quarantined: 0,
        insights_generated: 1,
      });
      setManualText('');
    } catch (error: any) {
      setUploadState('error');
      setErrorMessage(error?.response?.data?.detail || 'Manual submit failed.');
    }
  };

  const renderUploadResult = () => {
    if (uploadState === 'uploading') {
      return (
        <motion.div
          key="uploading"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center p-16 rounded-[24px] bg-[#F5F5F7]/50 border border-[#E5E5EA]"
        >
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold text-[#1D1D1F]">Processing Data...</h3>
              <span className="text-[13px] font-semibold text-[#0071E3]">Uploading</span>
            </div>
            <Progress value={uploadProgress} className="h-3 rounded-full bg-[#E5E5EA]" />
            <div className="mt-4 flex items-center justify-between text-[13px] font-semibold text-[#86868B]">
              <span>Analyzing text and classifying sentiments</span>
              <span>
                {uploadProgressCompleted} / {uploadProgressTotal} records uploaded
              </span>
            </div>
          </div>
        </motion.div>
      );
    }

    if (uploadState === 'error') {
      return (
        <div className="rounded-[20px] border border-[#FF3B30]/30 bg-[#FF3B30]/5 p-5 text-sm text-[#D70015] font-medium">
          {errorMessage || 'Request failed.'}
        </div>
      );
    }

    if (uploadState === 'success' && summaryCards) {
      return (
        <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
          <div className="flex flex-col items-center text-center p-8 rounded-[24px] bg-[#F5F5F7]/50 border border-[#E5E5EA]">
            <div className="w-16 h-16 rounded-full bg-[#34C759]/10 flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-[#34C759]" strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-bold text-[#1D1D1F] mb-2 tracking-tight">Upload Successful</h3>
            <p className="text-[#86868B] text-[15px] font-medium">Data has been successfully ingested into Synapse Intelligence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E5EA] shadow-sm rounded-[20px] p-6 flex flex-col">
              <span className="text-[#86868B] text-[13px] font-semibold uppercase tracking-wider mb-2">Total Processed</span>
              <span className="text-3xl font-bold text-[#1D1D1F]">{summaryCards.total}</span>
            </div>
            <div className="bg-white border border-[#E5E5EA] shadow-sm rounded-[20px] p-6 flex flex-col">
              <span className="text-[#86868B] text-[13px] font-semibold uppercase tracking-wider mb-2">Flagged as Bots</span>
              <span className="text-3xl font-bold text-[#FF9500]">{summaryCards.botRate.toFixed(1)}%</span>
            </div>
            <div className="bg-white border border-[#E5E5EA] shadow-sm rounded-[20px] p-6 flex flex-col">
              <span className="text-[#86868B] text-[13px] font-semibold uppercase tracking-wider mb-2">Flagged as Spam</span>
              <span className="text-3xl font-bold text-[#FF9500]">{summaryCards.spamRate.toFixed(1)}%</span>
            </div>
            <div className="bg-white border border-[#E5E5EA] shadow-sm rounded-[20px] p-6 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-[0.03]">
                <AlertTriangle size={80} className="text-[#1D1D1F]" />
              </div>
              <span className="text-[#86868B] text-[13px] font-semibold uppercase tracking-wider mb-1">Top Issue Detected</span>
              <span className="text-xl font-semibold text-[#FF3B30] leading-tight">
                {summaryCards.topIssue} ({summaryCards.duplicateCount})
              </span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-r from-[#0071E3]/5 to-[#A78BFA]/5 border border-[#0071E3]/20 rounded-[20px] p-6 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
              <Sparkles size={60} className="text-[#1D1D1F]" />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-[#0071E3]" />
              <h4 className="text-[14px] font-bold text-[#1D1D1F] uppercase tracking-wider">AI Insight Generated</h4>
            </div>
            <p className="text-[16px] text-[#1D1D1F] font-medium leading-relaxed max-w-2xl">{summaryCards.insight}</p>
          </motion.div>

          <div className="flex justify-center mt-2">
            <button onClick={() => setUploadState('idle')} className="text-[#86868B] hover:text-[#1D1D1F] text-[14px] font-medium transition-colors">
              Upload another file
            </button>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <PageWrapper title="Ingest Reviews">
      <div className="flex-1 bg-white rounded-[32px] overflow-hidden flex flex-col shadow-sm border border-[#E5E5EA] relative">
        <div className="px-10 pt-10 pb-6 border-b border-[#E5E5EA]/60">
          <h1 className="text-3xl font-bold text-[#1D1D1F] tracking-tight mb-2">Ingest Reviews</h1>
          <p className="text-[#86868B] font-medium text-[15px]">Import review data via CSV, JSON, manual entry, or simulate a real-time feed.</p>
        </div>

        <div className="px-10 pt-6">
          <div className="flex items-center gap-2 bg-[#F5F5F7] p-1.5 rounded-full w-fit border border-[#E5E5EA]/50">
            {[
              { id: 'csv', label: 'CSV Upload', icon: FileText },
              { id: 'json', label: 'JSON Upload', icon: FileJson },
              { id: 'manual', label: 'Manual Entry', icon: Edit3 },
              { id: 'realtime', label: 'Real-time Feed', icon: Activity },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all relative z-10 ${
                  activeTab === tab.id ? 'text-[#1D1D1F]' : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/5'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabBackground"
                    className="absolute inset-0 bg-white rounded-full -z-10 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#E5E5EA]/50"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-10 flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto h-full">
            <AnimatePresence mode="wait">
              {(activeTab === 'csv' || activeTab === 'json') && (
                <motion.div key={activeTab} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="h-full flex flex-col gap-6 justify-center">
                  <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-[#E5E5EA] rounded-[24px] bg-[#F5F5F7]/50 transition-all">
                    <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-6">
                      <UploadCloud size={28} className="text-[#0071E3]" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#1D1D1F] mb-2 tracking-tight">
                      {activeTab === 'csv' ? 'Upload CSV reviews file' : 'Upload JSON reviews payload'}
                    </h3>
                    <p className="text-[14px] text-[#86868B] mb-6 font-medium">Supports product_id, product_name, and text.</p>

                    {activeTab === 'csv' ? (
                      <div className="w-full max-w-xl flex flex-col gap-3">
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                          className="w-full bg-white border border-[#E5E5EA] rounded-xl px-4 py-3 text-[#1D1D1F] text-[14px]"
                        />
                        <button onClick={handleCsvUpload} className="bg-[#0071E3] hover:bg-[#005bb5] transition-all text-white font-semibold px-8 py-3 rounded-full shadow-[0_4px_16px_rgba(0,113,227,0.3)]">
                          Upload CSV
                        </button>
                      </div>
                    ) : (
                      <div className="w-full max-w-xl flex flex-col gap-3">
                        <textarea
                          value={jsonText}
                          onChange={(e) => setJsonText(e.target.value)}
                          rows={10}
                          className="w-full bg-white border border-[#E5E5EA] rounded-xl px-4 py-3 text-[#1D1D1F] text-[13px] font-mono"
                        />
                        <button onClick={handleJsonUpload} className="bg-[#0071E3] hover:bg-[#005bb5] transition-all text-white font-semibold px-8 py-3 rounded-full shadow-[0_4px_16px_rgba(0,113,227,0.3)]">
                          Upload JSON
                        </button>
                      </div>
                    )}
                  </div>

                  {renderUploadResult()}
                </motion.div>
              )}

              {activeTab === 'manual' && (
                <motion.div key="manual" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="bg-white border border-[#E5E5EA] shadow-sm rounded-[24px] p-8 space-y-5">
                  <h3 className="text-xl font-semibold text-[#1D1D1F]">Manual Entry</h3>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider">Product ID</label>
                      <input value={manualProductId} onChange={(e) => setManualProductId(e.target.value)} className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[#1D1D1F] text-[14px]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider">Product Name</label>
                      <input value={manualProductName} onChange={(e) => setManualProductName(e.target.value)} className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[#1D1D1F] text-[14px]" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider">Source</label>
                    <select value={manualSource} onChange={(e) => setManualSource(e.target.value)} className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[#1D1D1F] text-[14px]">
                      <option value="manual">Manual</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[13px] font-semibold text-[#86868B] uppercase tracking-wider">Review Text</label>
                    <textarea value={manualText} onChange={(e) => setManualText(e.target.value)} rows={6} className="w-full bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-4 py-3 text-[#1D1D1F] text-[14px]" />
                  </div>

                  <button onClick={handleManualSubmit} className="bg-[#0071E3] hover:bg-[#005bb5] transition-all text-white font-semibold px-8 py-3 rounded-full shadow-[0_4px_16px_rgba(0,113,227,0.3)] hover:scale-105 active:scale-95 flex items-center gap-2">
                    <Send size={16} /> Add Review
                  </button>

                  {renderUploadResult()}
                </motion.div>
              )}

              {activeTab === 'realtime' && (
                <motion.div key="realtime" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex flex-col h-full max-h-[500px]">
                  <div className="flex items-center justify-between mb-6 bg-white shadow-sm p-6 rounded-[24px] border border-[#E5E5EA]">
                    <div>
                      <h3 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">Simulate Live Reviews</h3>
                      <p className="text-[14px] text-[#86868B] font-medium mt-1">Posts to /api/ingest/realtime-feed every few seconds</p>
                    </div>
                    <button onClick={() => setIsLive(!isLive)} className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${isLive ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}>
                      <motion.div className="w-6 h-6 bg-white rounded-full absolute top-1 shadow-sm border border-[#000000]/5" animate={{ left: isLive ? '28px' : '4px' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                    </button>
                  </div>

                  {isLive && (
                    <div className="flex items-center gap-2 mb-4 px-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B30] animate-pulse"></span>
                      <span className="text-[13px] font-bold text-[#FF3B30] uppercase tracking-wider">Live Feed Active</span>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 relative min-h-[300px]">
                    {liveReviews.length === 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-[#86868B]">
                        <Activity size={40} className="mb-4 opacity-50 text-[#1D1D1F]" />
                        <p className="font-medium">{isLive ? 'Waiting for incoming data...' : 'Toggle live feed to start simulation'}</p>
                      </div>
                    )}
                    <AnimatePresence>
                      {liveReviews.map((review) => (
                        <motion.div key={review.id} initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="bg-white border border-[#E5E5EA] shadow-sm p-4 rounded-2xl flex items-start gap-4">
                          <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${review.sentiment === 'positive' ? 'bg-[#34C759]' : review.sentiment === 'negative' ? 'bg-[#FF3B30]' : 'bg-[#86868B]'}`} />
                          <div className="flex-1">
                            <p className="text-[14px] text-[#1D1D1F] font-medium leading-relaxed">{review.text}</p>
                            <span className="text-[12px] text-[#86868B] font-medium mt-1 inline-block">{review.time}</span>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
