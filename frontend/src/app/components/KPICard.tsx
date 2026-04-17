import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  trend: number;
  icon: LucideIcon;
}

export function KPICard({ title, value, trend, icon: Icon }: KPICardProps) {
  const isPositive = trend > 0;

  return (
    <div className="group relative p-6 rounded-xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300">
      {/* Icon */}
      <div className="absolute top-6 right-6 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
        <Icon className="w-6 h-6 text-indigo-300" strokeWidth={1.5} />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3">
        <span className="text-sm text-slate-400">{title}</span>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-semibold text-slate-50 tracking-tight">{value}</span>
          <div className={`flex items-center gap-1 text-xs pb-1.5 font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} /> : <TrendingDown className="w-3.5 h-3.5" strokeWidth={2} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}