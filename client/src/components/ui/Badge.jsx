export default function Badge({ children, variant = 'gray', className = '' }) {
  const variants = {
    gray: 'bg-gray-100 text-gray-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
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
    Instagram: 'purple',
    WhatsApp: 'green',
    TiendaNube: 'blue',
    Local: 'gray',
  };
  return map[channel] || 'gray';
};
