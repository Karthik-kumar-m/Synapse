import React from "react";
import { ArrowRight } from "lucide-react";

export function InsightsCard() {
  const insights = [
    {
      priority: "High",
      text: "Users are reporting battery drain on the new Pro model after firmware 1.4.",
      color: "bg-[#FF3B30]/10 text-[#FF3B30]",
    },
    {
      priority: "Medium",
      text: "Display brightness requests have surged in the European market segment.",
      color: "bg-[#FF9500]/10 text-[#FF9500]",
    },
    {
      priority: "Low",
      text: "Unboxing experience reviews highlight eco-friendly packaging positively.",
      color: "bg-[#34C759]/10 text-[#34C759]",
    },
  ];

  return (
    <div className="bg-white rounded-[24px] p-8 flex flex-col h-full shadow-sm border border-transparent hover:border-[#E5E5EA] transition-all duration-300">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
          Actionable Recommendations
        </h2>
        <button className="text-[13px] font-medium text-[#0071E3] hover:underline flex items-center gap-1">
          View all <ArrowRight size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-6">
        {insights.map((insight, idx) => (
          <div key={idx} className="flex gap-4 items-start group cursor-pointer">
            <div className={`mt-0.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider shrink-0 ${insight.color}`}>
              {insight.priority}
            </div>
            <p className="text-[15px] leading-relaxed text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors">
              {insight.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
