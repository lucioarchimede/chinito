export default function Badge({ children, variant = 'gray', className = '' }) {
  const variants = {
    gray:   'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
    green:  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    red:    'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    yellow: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    blue:   'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    purple: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    orange: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.gray} ${className}`}>
      {children}
    </span>
  );
}

export const channelColor = (channel) => {
  const map = {
    MercadoLibre: 'yellow',
    Instagram:    'purple',
    WhatsApp:     'green',
    TiendaNube:   'blue',
    Local:        'gray',
  };
  return map[channel] || 'gray';
};
