import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { date: 'Mar 18', battery: 85, camera: 78, performance: 82, design: 90 },
  { date: 'Mar 21', battery: 87, camera: 80, performance: 84, design: 88 },
  { date: 'Mar 24', battery: 86, camera: 82, performance: 85, design: 91 },
  { date: 'Mar 27', battery: 88, camera: 81, performance: 83, design: 89 },
  { date: 'Mar 30', battery: 90, camera: 79, performance: 86, design: 92 },
  { date: 'Apr 02', battery: 89, camera: 77, performance: 87, design: 90 },
  { date: 'Apr 05', battery: 91, camera: 84, performance: 88, design: 93 },
  { date: 'Apr 08', battery: 87, camera: 85, performance: 89, design: 91 },
  { date: 'Apr 11', battery: 85, camera: 83, performance: 65, design: 89 }, // Anomaly
  { date: 'Apr 14', battery: 88, camera: 86, performance: 90, design: 92 },
  { date: 'Apr 17', battery: 92, camera: 87, performance: 91, design: 94 },
];

export function FeatureSentimentChart() {
  return (
    <div className="p-8 rounded-xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 shadow-lg">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl text-slate-50 font-semibold">Customer Sentiment Journey</h3>
        <div className="flex items-center gap-5 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-400 shadow-sm"></div>
            <span className="text-slate-400">Battery</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-400 shadow-sm"></div>
            <span className="text-slate-400">Camera</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400 shadow-sm"></div>
            <span className="text-slate-400">Performance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-pink-400 shadow-sm"></div>
            <span className="text-slate-400">Design</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data}>
          <defs key="defs">
            <linearGradient id="gradientBattery" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#818CF8" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#818CF8" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradientCamera" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#A78BFA" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#A78BFA" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradientPerformance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradientDesign" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F472B6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#F472B6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid key="grid" strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
          <XAxis
            key="xaxis"
            dataKey="date"
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
          />
          <YAxis
            key="yaxis"
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip
            key="tooltip"
            contentStyle={{
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '12px',
              padding: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
            labelStyle={{ color: '#f1f5f9', marginBottom: '8px', fontWeight: '500' }}
            itemStyle={{ color: '#cbd5e1', fontSize: '13px' }}
          />
          <Area
            key="area-battery"
            type="monotone"
            dataKey="battery"
            stroke="#818CF8"
            strokeWidth={2.5}
            fill="url(#gradientBattery)"
          />
          <Area
            key="area-camera"
            type="monotone"
            dataKey="camera"
            stroke="#A78BFA"
            strokeWidth={2.5}
            fill="url(#gradientCamera)"
          />
          <Area
            key="area-performance"
            type="monotone"
            dataKey="performance"
            stroke="#60A5FA"
            strokeWidth={2.5}
            fill="url(#gradientPerformance)"
          />
          <Area
            key="area-design"
            type="monotone"
            dataKey="design"
            stroke="#F472B6"
            strokeWidth={2.5}
            fill="url(#gradientDesign)"
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Anomaly Indicator */}
      <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-coral-500/10 border border-orange-400/30">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-orange-400 mt-1.5 shadow-sm shadow-orange-400/50"></div>
          <div>
            <p className="text-sm text-orange-300 font-medium">Sentiment Drop Detected</p>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
              Performance ratings dropped significantly on April 11th. This appears linked to complaints about a recent software update affecting device speed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}