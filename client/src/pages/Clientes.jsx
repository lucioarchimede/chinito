import { useState, useEffect, useCallback } from 'react';
import { Users, ChevronRight, X } from 'lucide-react';
import api from '../utils/api';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatDate, monthStart, today } from '../utils/formatters';

const dateInputCls = 'text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white hover:border-slate-400 transition-colors';

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {[
            { label: 'Clientes Únicos', value: stats.total_clientes, color: 'text-slate-900' },
            { label: 'Clientes Nuevos', value: stats.clientes_nuevos, color: 'text-sky-600' },
            { label: 'Recurrentes', value: stats.clientes_recurrentes, color: 'text-indigo-600' },
            { label: 'CLV Promedio', value: formatCurrency(stats.clv_promedio), color: 'text-emerald-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2.5 mb-5 flex-wrap">
        <input type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))} className={dateInputCls} />
        <input type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))} className={dateInputCls} />
        <span className="text-sm text-slate-400">{total} cliente{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Lista */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-2.5 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Users size={32} className="mb-2.5" />
              <p className="text-sm">No hay clientes en este período</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {clients.map(c => (
                <li key={c.email}
                  onClick={() => openDetail(c.email)}
                  className={`flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${selected === c.email ? 'bg-indigo-50' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                    {(c.nombre || c.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{c.nombre || c.email}</p>
                      {c.is_repeat && <Badge variant="indigo">Recurrente</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{c.email}</p>
                    <p className="text-xs text-slate-400">{c.total_pedidos} pedido{c.total_pedidos !== 1 ? 's' : ''} · {formatDate(c.ultima_compra)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(c.total_revenue)}</p>
                    <ChevronRight size={14} className="text-slate-300 ml-auto mt-1" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detalle */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Users size={32} className="mb-2.5" />
              <p className="text-sm">Seleccioná un cliente para ver su detalle</p>
            </div>
          ) : loadingDetail ? (
            <div className="p-5 space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
              <div className="space-y-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}
              </div>
            </div>
          ) : clientDetail ? (
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{clientDetail.profile.nombre}</h3>
                  <p className="text-sm text-slate-500">{clientDetail.profile.email}</p>
                  {clientDetail.profile.telefono && <p className="text-sm text-slate-400">{clientDetail.profile.telefono}</p>}
                </div>
                <button onClick={() => { setSelected(null); setClientDetail(null); }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Pedidos', value: clientDetail.profile.total_pedidos, color: 'text-slate-900' },
                  { label: 'Revenue', value: formatCurrency(clientDetail.profile.total_revenue), color: 'text-indigo-600' },
                  { label: 'Ticket Prom.', value: formatCurrency(clientDetail.profile.ticket_promedio), color: 'text-slate-900' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className={`text-base font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Historial de compras</h4>
              <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                {clientDetail.purchases.map(p => (
                  <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{p.product_nombre || 'Producto eliminado'}</p>
                      <p className="text-xs text-slate-400">{formatDate(p.sale_date)} · {p.sale_channel} · x{p.quantity}</p>
                    </div>
                    <p className="font-semibold text-slate-900">{formatCurrency(p.final_revenue)}</p>
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
