import React from "react";
import { MessageCircleWarning } from "lucide-react";

export function QueueCard() {
  const reviews = [
    {
      author: "j.doe89",
      snippet: "\"Oh wow, I just LOVE having to charge my headphones three times a day. Best feature ever.\"",
      flag: "Sarcasm Detected",
    },
    {
      author: "tech_reviewer",
      snippet: "\"The new touch controls are something else. Really makes you wonder who designed this.\"",
      flag: "High Ambiguity",
    },
  ];

  return (
    <div className="bg-white rounded-[24px] p-8 flex flex-col h-full shadow-sm border border-transparent hover:border-[#E5E5EA] transition-all duration-300">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F] flex items-center gap-2">
          Sarcasm & Ambiguity Queue
          <span className="bg-[#FF9500] text-white text-[11px] font-bold px-2 py-0.5 rounded-full ml-1">
            2
          </span>
        </h2>
      </div>

      <div className="flex flex-col gap-5">
        {reviews.map((review, idx) => (
          <div key={idx} className="p-4 rounded-2xl bg-[#F5F5F7]/60 border border-[#E5E5EA]/50 group">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircleWarning size={14} className="text-[#FF9500]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF9500]">
                    {review.flag}
                  </span>
                </div>
                <p className="text-[14px] leading-relaxed text-[#1D1D1F] italic mb-3">
                  {review.snippet}
                </p>
                <div className="text-[12px] font-medium text-[#86868B]">
                  Posted by <span className="text-[#1D1D1F]">{review.author}</span>
                </div>
              </div>
              <button className="shrink-0 bg-[#0071E3] hover:bg-[#0077ED] text-white text-[13px] font-medium px-4 py-2 rounded-full transition-colors shadow-sm">
                Review
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
