export default function Card({ children, className = '', padding = true }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-card ${padding ? 'p-5 sm:p-6' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function KpiCard({ title, value, subtitle, icon: Icon, color = 'indigo', trend }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-emerald-50 text-emerald-600',
    red:    'bg-red-50 text-red-600',
    yellow: 'bg-amber-50 text-amber-600',
    blue:   'bg-sky-50 text-sky-600',
    purple: 'bg-violet-50 text-violet-600',
    orange: 'bg-orange-50 text-orange-600',
    gray:   'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4 sm:p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{title}</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 truncate leading-tight">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400 truncate">{subtitle}</p>}
          {trend !== undefined && (
            <p className={`mt-1.5 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs anterior
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${colors[color] || colors.indigo}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}
