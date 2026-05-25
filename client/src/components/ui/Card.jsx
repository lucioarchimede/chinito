export default function Card({ children, className = '', padding = true }) {
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card ${padding ? 'p-5 sm:p-6' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function KpiCard({ title, value, subtitle, icon: Icon, color = 'indigo', trend }) {
  const colors = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    green:  'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    red:    'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    yellow: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    blue:   'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
    purple: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    gray:   'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  };
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4 sm:p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{title}</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 truncate leading-tight">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>}
          {trend !== undefined && (
            <p className={`mt-1.5 text-xs font-medium ${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
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
