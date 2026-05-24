import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Megaphone, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatPercent, formatNumber, formatDate, formatDateInput, today, monthStart } from '../utils/formatters';

const EMPTY = {
  metric_date: today(), channel: '', impressions: '', clicks: '',
  conversions: '', spend: '', revenue: '', cpc: '', notes: ''
};
const CHANNELS = ['Instagram', 'Google Ads', 'Facebook', 'TikTok', 'Email', 'Influencers', 'Otro'];

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

  return (
    <div>
      {/* Stats */}
      {summary?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Gasto Total', value: formatCurrency(summary.totals.total_spend), color: 'text-red-600' },
            { label: 'Revenue Generado', value: formatCurrency(summary.totals.total_revenue), color: 'text-green-600' },
            { label: 'ROAS Promedio', value: `${formatNumber(summary.totals.avg_roas, 2)}x`, color: 'text-indigo-600' },
            { label: 'Conversiones', value: formatNumber(summary.totals.total_conversions), color: 'text-gray-900' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gráfico por canal */}
      {summary?.by_channel?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Gasto vs Revenue por Canal</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summary.by_channel} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="spend" name="Gasto" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">ROAS por Canal</h3>
            <div className="space-y-3">
              {summary.by_channel.map(ch => (
                <div key={ch.channel}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{ch.channel}</span>
                    <span className={`font-semibold ${parseFloat(ch.avg_roas) >= 3 ? 'text-green-600' : parseFloat(ch.avg_roas) >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {formatNumber(ch.avg_roas, 2)}x ROAS
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(100, parseFloat(ch.avg_roas) / 10 * 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Gasto: {formatCurrency(ch.spend)} · {ch.conversions} conv.</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={filters.channel} onChange={e => setFilters(p => ({ ...p, channel: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="">Todos los canales</option>
          {CHANNELS.map(c => <option key={c}>{c}</option>)}
        </select>
        <Button icon={Plus} onClick={openCreate} className="ml-auto">Nueva Métrica</Button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : metrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Megaphone size={36} className="mb-2" />
            <p>No hay métricas en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Fecha', 'Canal', 'Impresiones', 'Clics', 'CTR', 'Conversiones', 'Gasto', 'Revenue', 'ROAS', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {metrics.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(m.metric_date)}</td>
                    <td className="px-4 py-3"><Badge variant="purple">{m.channel}</Badge></td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatNumber(m.impressions)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatNumber(m.clicks)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatPercent(parseFloat(m.ctr) * 100, 2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatNumber(m.conversions)}</td>
                    <td className="px-4 py-3 text-sm text-red-600">{formatCurrency(m.spend)}</td>
                    <td className="px-4 py-3 text-sm text-green-600">{formatCurrency(m.revenue)}</td>
                    <td className="px-4 py-3 text-sm font-semibold"
                      style={{ color: parseFloat(m.roas) >= 3 ? '#16a34a' : parseFloat(m.roas) >= 1 ? '#d97706' : '#dc2626' }}>
                      {formatNumber(m.roas, 2)}x
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(m)} className="text-gray-400 hover:text-indigo-600"><Edit2 size={15} /></button>
                        <button onClick={() => setDeleteId(m.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
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
            <div className="bg-indigo-50 rounded-lg p-3 text-sm">
              <span className="text-gray-500">ROAS calculado: </span>
              <strong className="text-indigo-700">{formatNumber(parseFloat(form.revenue) / parseFloat(form.spend), 2)}x</strong>
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
          <AlertTriangle size={22} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-gray-600">¿Eliminar esta métrica de marketing?</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
