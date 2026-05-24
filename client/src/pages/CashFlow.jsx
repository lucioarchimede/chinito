import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatDate, formatDateInput, today, monthStart } from '../utils/formatters';

const EMPTY = { flow_date: today(), category: '', type: 'ingreso', amount: '', description: '', is_projected: false, notes: '' };
const dateInputCls = 'text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white hover:border-slate-400 transition-colors';

export default function CashFlow() {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ start_date: monthStart(), end_date: today(), type: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.set('start_date', filters.start_date);
      if (filters.end_date) params.set('end_date', filters.end_date);
      if (filters.type) params.set('type', filters.type);
      params.set('limit', '200');
      const [entRes, sumRes] = await Promise.all([
        api.get(`/cash-flow?${params}`),
        api.get(`/cash-flow/summary?${params}`),
      ]);
      setEntries(entRes.data.data);
      setSummary(sumRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModalOpen(true); };
  const openEdit = (e) => {
    setForm({
      flow_date: formatDateInput(e.flow_date), category: e.category || '',
      type: e.type, amount: e.amount, description: e.description || '',
      is_projected: e.is_projected || false, notes: e.notes || ''
    });
    setEditId(e.id); setModalOpen(true);
  };

  const handleSave = async (ev) => {
    ev.preventDefault(); setSaving(true);
    try {
      if (editId) await api.put(`/cash-flow/${editId}`, form);
      else await api.post('/cash-flow', form);
      setModalOpen(false); fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/cash-flow/${deleteId}`); setDeleteId(null); fetchData(); }
    catch { alert('Error al eliminar'); }
  };

  const ff = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={14} className="text-emerald-500" />
              <p className="text-xs text-slate-500 uppercase tracking-wide">Ingresos Reales</p>
            </div>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.ingresos_reales)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown size={14} className="text-red-500" />
              <p className="text-xs text-slate-500 uppercase tracking-wide">Egresos Reales</p>
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary.egresos_reales)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Balance Real</p>
            <p className={`text-xl font-bold ${parseFloat(summary.balance_real) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(summary.balance_real)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Balance c/Proyectado</p>
            <p className={`text-xl font-bold ${parseFloat(summary.balance_total) >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
              {formatCurrency(summary.balance_total)}
            </p>
          </div>
        </div>
      )}

      {/* Gráfico mensual */}
      {summary?.monthly?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Ingresos vs Egresos por Mes</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary.monthly} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }}
                formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <input type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))} className={dateInputCls} />
        <input type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))} className={dateInputCls} />
        <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))} className={dateInputCls}>
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>
        <Button icon={Plus} onClick={openCreate} className="ml-auto">Nueva Entrada</Button>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card flex flex-col items-center justify-center h-48 text-slate-400">
          <TrendingUp size={32} className="mb-2.5" />
          <p className="text-sm">No hay entradas en este período</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map(e => (
                  <tr key={e.id} className={`hover:bg-slate-50 transition-colors group ${e.is_projected ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(e.flow_date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{e.category || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={e.type === 'ingreso' ? 'green' : 'red'}>{e.type}</Badge>
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold ${e.type === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {e.type === 'ingreso' ? '+' : '-'}{formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {e.is_projected ? <Badge variant="yellow">Proyectado</Badge> : <Badge variant="gray">Real</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(e)} className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50 transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(e.id)} className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y divide-slate-100">
            {entries.map(e => (
              <div key={e.id} className={`px-4 py-3.5 ${e.is_projected ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900">{e.description || '—'}</p>
                      <Badge variant={e.type === 'ingreso' ? 'green' : 'red'}>{e.type}</Badge>
                      {e.is_projected && <Badge variant="yellow">Proyectado</Badge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(e.flow_date)}{e.category && ` · ${e.category}`}</p>
                    <p className={`text-sm font-semibold mt-1 ${e.type === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {e.type === 'ingreso' ? '+' : '-'}{formatCurrency(e.amount)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(e)} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded transition-colors"><Edit2 size={15} /></button>
                    <button onClick={() => setDeleteId(e.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded transition-colors"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Entrada' : 'Nueva Entrada'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha *" type="date" value={form.flow_date} onChange={ff('flow_date')} required />
            <Select label="Tipo *" value={form.type} onChange={ff('type')} required>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </Select>
          </div>
          <Input label="Descripción" value={form.description} onChange={ff('description')} placeholder="Descripción del movimiento" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Monto ($) *" type="number" step="0.01" value={form.amount} onChange={ff('amount')} required />
            <Input label="Categoría" value={form.category} onChange={ff('category')} placeholder="ventas, gastos, personal..." />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="projected" checked={form.is_projected}
              onChange={e => setForm(p => ({ ...p, is_projected: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            <label htmlFor="projected" className="text-sm text-slate-700">Es un valor proyectado/estimado</label>
          </div>
          <Input label="Notas" value={form.notes} onChange={ff('notes')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Entrada" size="sm">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">¿Eliminar esta entrada de cash flow?</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
