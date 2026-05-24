import { useState, useEffect, useCallback } from 'react';
import { Users, ChevronRight, X } from 'lucide-react';
import api from '../utils/api';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatDate, monthStart, today } from '../utils/formatters';

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filters, setFilters] = useState({ start_date: monthStart(), end_date: today() });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = `?start_date=${filters.start_date}&end_date=${filters.end_date}&limit=100`;
      const [clRes, stRes] = await Promise.all([
        api.get(`/clients${params}`),
        api.get(`/clients/stats${params}`),
      ]);
      setClients(clRes.data.data);
      setTotal(clRes.data.total);
      setStats(stRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetail = async (email) => {
    setSelected(email);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/clients/${encodeURIComponent(email)}`);
      setClientDetail(res.data);
    } catch (err) { console.error(err); }
    finally { setLoadingDetail(false); }
  };

  return (
    <div>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Clientes Únicos', value: stats.total_clientes, color: 'text-gray-900' },
            { label: 'Clientes Nuevos', value: stats.clientes_nuevos, color: 'text-blue-600' },
            { label: 'Recurrentes', value: stats.clientes_recurrentes, color: 'text-indigo-600' },
            { label: 'CLV Promedio', value: formatCurrency(stats.clv_promedio), color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-5">
        <input type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <span className="text-sm text-gray-500">{total} cliente{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Lista */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Users size={36} className="mb-2" />
              <p>No hay clientes en este período</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {clients.map(c => (
                <li key={c.email}
                  onClick={() => openDetail(c.email)}
                  className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors ${selected === c.email ? 'bg-indigo-50' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                    {(c.nombre || c.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.nombre || c.email}</p>
                      {c.is_repeat && <Badge variant="indigo">Recurrente</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{c.email}</p>
                    <p className="text-xs text-gray-400">{c.total_pedidos} pedido{c.total_pedidos !== 1 ? 's' : ''} · última: {formatDate(c.ultima_compra)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(c.total_revenue)}</p>
                    <ChevronRight size={14} className="text-gray-300 ml-auto mt-1" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detalle */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Users size={36} className="mb-2" />
              <p className="text-sm">Seleccioná un cliente para ver su detalle</p>
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : clientDetail ? (
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{clientDetail.profile.nombre}</h3>
                  <p className="text-sm text-gray-500">{clientDetail.profile.email}</p>
                  {clientDetail.profile.telefono && <p className="text-sm text-gray-500">{clientDetail.profile.telefono}</p>}
                </div>
                <button onClick={() => { setSelected(null); setClientDetail(null); }}
                  className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Pedidos</p>
                  <p className="text-lg font-bold text-gray-900">{clientDetail.profile.total_pedidos}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Revenue</p>
                  <p className="text-lg font-bold text-indigo-600">{formatCurrency(clientDetail.profile.total_revenue)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Ticket Prom.</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(clientDetail.profile.ticket_promedio)}</p>
                </div>
              </div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Historial de compras</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                {clientDetail.purchases.map(p => (
                  <div key={p.id} className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{p.product_nombre || 'Producto eliminado'}</p>
                      <p className="text-xs text-gray-500">{formatDate(p.sale_date)} · {p.sale_channel} · x{p.quantity}</p>
                    </div>
                    <p className="font-semibold text-gray-900">{formatCurrency(p.final_revenue)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
