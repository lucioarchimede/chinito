import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Megaphone, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatPercent, formatNumber, formatDate, formatDateInput, today, monthStart } from '../utils/formatters';
import { useChartTheme } from '../context/ThemeContext';

const EMPTY = {
  metric_date: today(), channel: '', impressions: '', clicks: '',
  conversions: '', spend: '', revenue: '', cpc: '', notes: ''
};
const CHANNELS = ['Instagram', 'Google Ads', 'Facebook', 'TikTok', 'Email', 'Influencers', 'Otro'];
const dateInputCls = 'text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors text-slate-900 dark:text-slate-100 min-h-[42px]';

export default function Marketing() {
  const [metrics, setMetrics] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ start_date: monthStart(), end_date: today(), channel: '' });
  const chart = useChartTheme();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.set('start_date', filters.start_date);
      if (filters.end_date) params.set('end_date', filters.end_date);
      if (filters.channel) params.set('channel', filters.channel);
      params.set('limit', '200');
      const [mRes, sRes] = await Promise.all([
        api.get(`/marketing?${params}`),
        api.get(`/marketing/summary?${params}`),
      ]);
      setMetrics(mRes.data.data);
      setSummary(sRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModalOpen(true); };
  const openEdit = (m) => {
    setForm({
      metric_date: formatDateInput(m.metric_date), channel: m.channel,
      impressions: m.impressions, clicks: m.clicks, conversions: m.conversions,
      spend: m.spend, revenue: m.revenue, cpc: m.cpc, notes: m.notes || ''
    });
    setEditId(m.id); setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) await api.put(`/marketing/${editId}`, form);
      else await api.post('/marketing', form);
      setModalOpen(false); fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/marketing/${deleteId}`); setDeleteId(null); fetchData(); }
    catch { alert('Error al eliminar'); }
  };

  const ff = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const roasColor = (roas) => parseFloat(roas) >= 3 ? '#10b981' : parseFloat(roas) >= 1 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      {/* Stats */}
      {summary?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {[
            { label: 'Gasto Total', value: formatCurrency(summary.totals.total_spend), color: 'text-red-600 dark:text-red-400' },
            { label: 'Revenue Generado', value: formatCurrency(summary.totals.total_revenue), color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'ROAS Promedio', value: `${formatNumber(summary.totals.avg_roas, 2)}x`, color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Conversiones', value: formatNumber(summary.totals.total_conversions), color: 'text-slate-900 dark:text-slate-50' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {summary?.by_channel?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Gasto vs Revenue por Canal</h3>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={summary.by_channel} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="channel" tick={chart.tick} />
                <YAxis tick={chart.tick} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={chart.tooltipStyle} formatter={(v) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: chart.tick.fill }} />
                <Bar dataKey="spend" name="Gasto" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">ROAS por Canal</h3>
            <div className="space-y-3.5">
              {summary.by_channel.map(ch => (
                <div key={ch.channel}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{ch.channel}</span>
                    <span className="font-semibold" style={{ color: roasColor(ch.avg_roas) }}>
                      {formatNumber(ch.avg_roas, 2)}x ROAS
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, parseFloat(ch.avg_roas) / 10 * 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Gasto: {formatCurrency(ch.spend)} · {ch.conversions} conv.</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <input type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))} className={dateInputCls} />
        <input type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))} className={dateInputCls} />
        <select value={filters.channel} onChange={e => setFilters(p => ({ ...p, channel: e.target.value }))} className={dateInputCls}>
          <option value="">Todos los canales</option>
          {CHANNELS.map(c => <option key={c}>{c}</option>)}
        </select>
        <Button icon={Plus} onClick={openCreate} className="ml-auto">Nueva Métrica</Button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : metrics.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card flex flex-col items-center justify-center h-48 text-slate-400">
          <Megaphone size={32} className="mb-2.5" />
          <p className="text-sm">No hay métricas en este período</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  {['Fecha', 'Canal', 'Impresiones', 'Clics', 'CTR', 'Conv.', 'Gasto', 'Revenue', 'ROAS', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {metrics.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatDate(m.metric_date)}</td>
                    <td className="px-4 py-3"><Badge variant="purple">{m.channel}</Badge></td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{formatNumber(m.impressions)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{formatNumber(m.clicks)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{formatPercent(parseFloat(m.ctr) * 100, 2)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{formatNumber(m.conversions)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{formatCurrency(m.spend)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(m.revenue)}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: roasColor(m.roas) }}>
                      {formatNumber(m.roas, 2)}x
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(m)} className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(m.id)} className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {metrics.map(m => (
              <div key={m.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="purple">{m.channel}</Badge>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(m.metric_date)}</span>
                    </div>
                    <div className="flex gap-3 mt-1.5 flex-wrap text-sm">
                      <span className="text-red-600 dark:text-red-400">Gasto: {formatCurrency(m.spend)}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">Revenue: {formatCurrency(m.revenue)}</span>
                      <span className="font-semibold" style={{ color: roasColor(m.roas) }}>ROAS: {formatNumber(m.roas, 2)}x</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(m)} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"><Edit2 size={15} /></button>
                    <button onClick={() => setDeleteId(m.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Métrica' : 'Nueva Métrica'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha *" type="date" value={form.metric_date} onChange={ff('metric_date')} required />
            <Select label="Canal *" value={form.channel} onChange={ff('channel')} required>
              <option value="">Seleccionar canal...</option>
              {CHANNELS.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Impresiones" type="number" value={form.impressions} onChange={ff('impressions')} />
            <Input label="Clics" type="number" value={form.clicks} onChange={ff('clicks')} />
            <Input label="Conversiones" type="number" value={form.conversions} onChange={ff('conversions')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Gasto ($)" type="number" step="0.01" value={form.spend} onChange={ff('spend')} />
            <Input label="Revenue ($)" type="number" step="0.01" value={form.revenue} onChange={ff('revenue')} />
            <Input label="CPC ($)" type="number" step="0.01" value={form.cpc} onChange={ff('cpc')} />
          </div>
          {(parseFloat(form.spend) > 0 && parseFloat(form.revenue) >= 0) && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3 text-sm">
              <span className="text-slate-500 dark:text-slate-400">ROAS calculado: </span>
              <strong className="text-indigo-700 dark:text-indigo-300">{formatNumber(parseFloat(form.revenue) / parseFloat(form.spend), 2)}x</strong>
            </div>
          )}
          <Input label="Notas" value={form.notes} onChange={ff('notes')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Métrica" size="sm">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-300">¿Eliminar esta métrica de marketing?</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
