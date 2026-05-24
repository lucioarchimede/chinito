export const formatCurrency = (value, decimals = 0) => {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatNumber = (value, decimals = 0) => {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatPercent = (value, decimals = 1) => {
  const num = parseFloat(value) || 0;
  return `${num.toFixed(decimals)}%`;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateInput = (dateStr) => {
  if (!dateStr) return '';
  return String(dateStr).split('T')[0];
};

export const today = () => new Date().toISOString().split('T')[0];

export const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 2, 1).toISOString().split('T')[0];
};

export const classNames = (...classes) => classes.filter(Boolean).join(' ');
