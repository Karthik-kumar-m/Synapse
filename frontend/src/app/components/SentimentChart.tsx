import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, AlertCircle } from "lucide-react";

export function SentimentChart() {
  const data = useMemo(() => {
    const arr = [];
    let base = 85;
    for (let i = 1; i <= 30; i++) {
      let score = base + (Math.random() * 6 - 3);
      if (i === 18) score = 42; // Anomaly
      arr.push({ day: i, score });
      base = score > 70 ? base + (Math.random() * 4 - 1.5) : base + (Math.random() * 10 + 5);
      if (base > 98) base = 95;
    }
    return arr;
  }, []);

  const anomalyPoint = data.find((d) => d.day === 18);

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.day === 18) {
      return (
        <svg x={cx - 10} y={cy - 10} width={20} height={20} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" fill="#FF9500" stroke="white" strokeWidth="2.5" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="px-8 md:px-12 w-full mt-8">
      <div className="bg-white rounded-[24px] p-8 h-[400px] flex flex-col shadow-sm border border-transparent hover:border-[#E5E5EA] transition-all duration-300">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">
              Feature Sentiment Trends
            </h2>
            <p className="text-[13px] text-[#86868B] mt-1">Last 30 days average</p>
          </div>
          
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0071E3]" />
              <span className="text-[13px] text-[#86868B]">Positive</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF9500]" />
              <span className="text-[13px] text-[#86868B]">Anomaly</span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
              <defs key="defs">
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0071E3" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                key="xaxis"
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#86868B", fontSize: 11 }} 
                tickMargin={12}
                minTickGap={20}
              />
              <YAxis 
                key="yaxis"
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#86868B", fontSize: 11 }} 
                domain={[0, 100]}
              />
              <Tooltip 
                key="tooltip"
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                  color: '#1D1D1F',
                  fontWeight: 500,
                  fontSize: '13px',
                }}
                itemStyle={{ color: '#0071E3' }}
              />
              <Area 
                key="area"
                type="monotone" 
                dataKey="score" 
                stroke="#0071E3" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#colorScore)" 
                activeDot={{ r: 6, fill: "#0071E3", stroke: "white", strokeWidth: 2 }}
                dot={<CustomDot />}
              />
            </AreaChart>
          </ResponsiveContainer>
          
          {/* Anomaly Annotation (Absolute position to match rough position of day 18) */}
          <div className="absolute top-[45%] left-[58%] transform -translate-x-1/2 -translate-y-1/2 hidden md:flex flex-col items-center">
             <div className="bg-[#FF9500]/10 text-[#FF9500] text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 mt-14 ml-8">
               <AlertCircle size={12} />
               <span>Anomaly Detected</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
