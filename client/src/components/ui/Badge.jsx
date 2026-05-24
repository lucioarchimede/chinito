export default function Badge({ children, variant = 'gray', className = '' }) {
  const variants = {
    gray:   'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-100 text-indigo-700',
    green:  'bg-emerald-100 text-emerald-700',
    red:    'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-700',
    blue:   'bg-sky-100 text-sky-700',
    purple: 'bg-violet-100 text-violet-700',
    orange: 'bg-orange-100 text-orange-700',
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
