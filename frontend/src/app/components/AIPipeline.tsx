import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Brain, Shield, Lightbulb, AlertCircle, ArrowRight, Terminal } from 'lucide-react';

const agents = [
  { id: 'ingestion', label: 'Ingestion', icon: Database, color: '#0071E3' },
  { id: 'sentiment', label: 'Sentiment', icon: '#AF52DE' },
  { id: 'spam', label: 'Spam Detection', icon: Shield, color: '#34C759' },
  { id: 'insight', label: 'Insight', icon: Lightbulb, color: '#FF9500' },
  { id: 'priority', label: 'Priority', icon: AlertCircle, color: '#FF3B30' },
];

const mockLogs = [
  "[Ingestion] Receiving batch #4092...",
  "[Ingestion] 124 records parsed successfully.",
  "[Sentiment] Analyzing text embeddings...",
  "[Sentiment] Score calculated: 0.82 (Positive).",
  "[Spam Detection] Checking for bot patterns...",
  "[Spam Detection] Clean. Confidence 98%.",
  "[Insight] Correlating with historical data...",
  "[Insight] Trend identified: Battery life complaints.",
  "[Priority] Routing to 'High Priority' queue...",
];

export function AIPipeline({ isProcessing = true }: { isProcessing?: boolean }) {
  const [activeStage, setActiveStage] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!isProcessing) return;

    let currentLogIndex = 0;
    const logInterval = setInterval(() => {
      if (currentLogIndex < mockLogs.length) {
        setLogs(prev => [...prev, mockLogs[currentLogIndex]].slice(-5));
        
        // Advance stage based on log content
        const logText = mockLogs[currentLogIndex];
        if (logText.includes('[Ingestion]')) setActiveStage(0);
        else if (logText.includes('[Sentiment]')) setActiveStage(1);
        else if (logText.includes('[Spam Detection]')) setActiveStage(2);
        else if (logText.includes('[Insight]')) setActiveStage(3);
        else if (logText.includes('[Priority]')) setActiveStage(4);

        currentLogIndex++;
      } else {
        currentLogIndex = 0;
        setLogs([]);
      }
    }, 1500);

    return () => clearInterval(logInterval);
  }, [isProcessing]);

  return (
    <div className="bg-card border border-border shadow-sm rounded-[24px] p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">Multi-Agent AI Pipeline</h2>
          <p className="text-muted-foreground text-[14px] font-medium mt-1">Real-time processing and categorization</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
          <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-[#34C759] animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-[13px] font-bold text-foreground uppercase tracking-wider">{isProcessing ? 'Active' : 'Idle'}</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Pipeline Visualization */}
        <div className="flex-1 flex items-center justify-between relative">
          {/* Background connecting line */}
          <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-1 bg-secondary rounded-full hidden md:block" />
          
          <div className="flex flex-col md:flex-row items-center justify-between w-full relative z-10 gap-4 md:gap-0">
            {agents.map((agent, index) => {
              const isActive = index === activeStage;
              const isPast = index < activeStage;
              const Icon = agent.icon === '#AF52DE' ? Brain : agent.icon; // fixing icon ref

              return (
                <div key={agent.id} className="flex flex-col items-center gap-3">
                  <div 
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 relative ${
                      isActive ? 'scale-110 shadow-lg' : isPast ? 'opacity-80' : 'opacity-40 grayscale'
                    }`}
                    style={{ 
                      backgroundColor: isActive ? agent.color + '20' : 'var(--color-secondary)',
                      border: `2px solid ${isActive ? agent.color : 'var(--color-border)'}`
                    }}
                  >
                    {isActive && (
                      <motion.div 
                        className="absolute inset-0 rounded-full"
                        style={{ border: `2px solid ${agent.color}` }}
                        animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    )}
                    <Icon size={24} style={{ color: isActive || isPast ? agent.color : 'var(--color-muted-foreground)' }} />
                  </div>
                  <span className={`text-[13px] font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {agent.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Terminal Output */}
        <div className="w-full lg:w-[350px] bg-[#1D1D1F] dark:bg-[#000000] rounded-xl p-4 font-mono text-[12px] h-[160px] flex flex-col relative overflow-hidden border border-border shadow-inner">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10 text-white/50">
            <Terminal size={14} />
            <span>sys.log</span>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col justify-end space-y-1">
            <AnimatePresence>
              {logs.map((log, i) => (
                <motion.div
                  key={log + i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[#34C759] leading-relaxed"
                >
                  <span className="text-white/30 mr-2">{'>'}</span>{log}
                </motion.div>
              ))}
            </AnimatePresence>
            {!isProcessing && (
              <div className="text-white/40 italic">Waiting for input...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}