import { useState } from 'react';
import { Download, BarChart2, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../utils/api';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { formatCurrency, formatPercent, formatDate, monthStart, today } from '../utils/formatters';

const REPORTS = [
  { id: 'sales', label: 'Ventas', description: 'Detalle completo de todas las ventas del período' },
  { id: 'expenses', label: 'Gastos', description: 'Detalle de todos los gastos del período' },
  { id: 'products', label: 'Productos', description: 'Inventario completo con métricas de ventas' },
];

export default function Reportes() {
  const [reportType, setReportType] = useState('sales');
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Comparación de períodos
  const [p1Start, setP1Start] = useState('');
  const [p1End, setP1End] = useState('');
  const [p2Start, setP2Start] = useState('');
  const [p2End, setP2End] = useState('');
  const [comparison, setComparison] = useState(null);
  const [loadingComp, setLoadingComp] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const params = `?start_date=${startDate}&end_date=${endDate}`;
      const res = await api.get(`/reports/${reportType}${params}`);
      setData(res.data.data);
      setGenerated(true);
    } catch (err) {
      alert('Error al generar reporte');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    try {
      const params = `?start_date=${startDate}&end_date=${endDate}&format=csv`;
      const res = await api.get(`/reports/${reportType}${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al exportar');
    }
  };

  const generateComparison = async () => {
    if (!p1Start || !p1End || !p2Start || !p2End) return alert('Completá los cuatro campos de fecha');
    setLoadingComp(true);
    try {
      const params = `?period1_start=${p1Start}&period1_end=${p1End}&period2_start=${p2Start}&period2_end=${p2End}`;
      const res = await api.get(`/reports/comparison${params}`);
      setComparison(res.data);
    } catch (err) {
      alert('Error al generar comparación');
    } finally {
      setLoadingComp(false);
    }
  };

  const reportDef = REPORTS.find(r => r.id === reportType);

  const renderTable = () => {
    if (!data.length) return null;
    if (reportType === 'sales') {
      return (
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Fecha', 'Producto', 'SKU', 'Cantidad', 'Precio', 'Descuento', 'Revenue', 'Cliente', 'Canal'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.slice(0, 100).map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-600">{formatDate(row.sale_date)}</td>
                <td className="px-3 py-2 text-xs font-medium text-gray-900">{row.producto || '—'}</td>
                <td className="px-3 py-2 text-xs font-mono text-gray-500">{row.sku || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{row.quantity}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(row.unit_price)}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(row.discount)}</td>
                <td className="px-3 py-2 text-xs font-semibold text-gray-900">{formatCurrency(row.final_revenue)}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{row.customer_name || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{row.sale_channel || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (reportType === 'expenses') {
      return (
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['Fecha', 'Descripción', 'Categoría', 'Subcategoría', 'Monto', 'Proveedor', 'Recurrente'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.slice(0, 100).map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-600">{formatDate(row.expense_date)}</td>
                <td className="px-3 py-2 text-xs font-medium text-gray-900">{row.description}</td>
                <td className="px-3 py-2 text-xs text-gray-600 capitalize">{row.category}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{row.subcategory || '—'}</td>
                <td className="px-3 py-2 text-xs font-semibold text-red-600">{formatCurrency(row.amount)}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{row.supplier || '—'}</td>
                <td className="px-3 py-2 text-xs">{row.is_recurring ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (reportType === 'products') {
      return (
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {['SKU', 'Nombre', 'Categoría', 'Costo', 'Venta', 'Margen', 'Stock', 'Vendido', 'Revenue'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.slice(0, 100).map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs font-mono text-gray-500">{row.sku}</td>
                <td className="px-3 py-2 text-xs font-medium text-gray-900">{row.nombre}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{row.categoria || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(row.precio_costo)}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(row.precio_venta)}</td>
                <td className="px-3 py-2 text-xs font-semibold text-green-600">{formatPercent(row.margen_pct)}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{row.stock_actual}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{row.total_vendido}</td>
                <td className="px-3 py-2 text-xs font-semibold text-indigo-600">{formatCurrency(row.revenue_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Generador de reporte */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Generar Reporte</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Tipo de reporte" value={reportType} onChange={e => { setReportType(e.target.value); setGenerated(false); setData([]); }}>
            {REPORTS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </Select>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <Button icon={RefreshCw} onClick={generateReport} disabled={loading}>
            {loading ? 'Generando...' : 'Generar'}
          </Button>
          {generated && (
            <Button icon={Download} variant="success" onClick={downloadCSV}>
              Exportar CSV
            </Button>
          )}
        </div>
        {reportDef && (
          <p className="text-xs text-gray-400 mt-2">{reportDef.description}</p>
        )}
      </div>

      {/* Tabla de resultados */}
      {generated && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {data.length} registros {data.length === 100 ? '(mostrando primeros 100)' : ''}
            </p>
          </div>
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <BarChart2 size={28} className="mb-2" />
              <p className="text-sm">Sin datos en este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">{renderTable()}</div>
          )}
        </div>
      )}

      {/* Comparación de períodos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Comparar Períodos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Período 1</p>
            <div className="flex gap-2">
              <input type="date" value={p1Start} onChange={e => setP1Start(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="date" value={p1End} onChange={e => setP1End(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Período 2</p>
            <div className="flex gap-2">
              <input type="date" value={p2Start} onChange={e => setP2Start(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="date" value={p2End} onChange={e => setP2End(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
        <Button onClick={generateComparison} disabled={loadingComp} icon={BarChart2}>
          {loadingComp ? 'Calculando...' : 'Comparar'}
        </Button>

        {comparison && (
          <div className="mt-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Revenue', p1: formatCurrency(comparison.period1.total_revenue), p2: formatCurrency(comparison.period2.total_revenue), change: comparison.comparison.revenue_change_pct },
                { label: 'Ventas', p1: comparison.period1.total_sales, p2: comparison.period2.total_sales, change: comparison.comparison.sales_change_pct },
                { label: 'Ticket Prom.', p1: formatCurrency(comparison.period1.avg_ticket), p2: formatCurrency(comparison.period2.avg_ticket), change: comparison.comparison.ticket_change_pct },
                { label: 'Clientes', p1: comparison.period1.unique_clients, p2: comparison.period2.unique_clients, change: comparison.comparison.clients_change_pct },
              ].map(({ label, p1, p2, change }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 uppercase mb-2">{label}</p>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">P1:</span><strong>{p1}</strong>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">P2:</span><strong>{p2}</strong>
                  </div>
                  {change !== null && (
                    <p className={`text-xs font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { periodo: `P1 (${comparison.period1.start})`, revenue: parseFloat(comparison.period1.total_revenue) },
                { periodo: `P2 (${comparison.period2.start})`, revenue: parseFloat(comparison.period2.total_revenue) },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
