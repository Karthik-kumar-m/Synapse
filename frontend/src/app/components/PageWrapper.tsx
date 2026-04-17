import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

interface PageWrapperProps {
  children: React.ReactNode;
  title: string;
}

export function PageWrapper({ children, title }: PageWrapperProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate real-time data loading for 1 second
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <div className="w-10 h-10 rounded-full border-2 border-[#E5E5EA] border-t-[#0071E3] animate-spin" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-[#86868B] text-[14px] font-medium tracking-tight"
        >
          Loading {title}...
        </motion.p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} // Apple-like smooth ease out
      className="h-full flex flex-col"
    >
      {children}
    </motion.div>
  );
}
