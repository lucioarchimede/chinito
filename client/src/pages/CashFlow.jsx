import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatDate, formatDateInput, today, monthStart } from '../utils/formatters';

const EMPTY = { flow_date: today(), category: '', type: 'ingreso', amount: '', description: '', is_projected: false, notes: '' };

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-green-500" />
              <p className="text-xs text-gray-500 uppercase">Ingresos Reales</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.ingresos_reales)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={16} className="text-red-500" />
              <p className="text-xs text-gray-500 uppercase">Egresos Reales</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.egresos_reales)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase mb-1">Balance Real</p>
            <p className={`text-2xl font-bold ${parseFloat(summary.balance_real) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.balance_real)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase mb-1">Balance c/Proyectado</p>
            <p className={`text-2xl font-bold ${parseFloat(summary.balance_total) >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
              {formatCurrency(summary.balance_total)}
            </p>
          </div>
        </div>
      )}

      {/* Gráfico mensual */}
      {summary?.monthly?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Ingresos vs Egresos por Mes</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary.monthly} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4,4,0,0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filtros + acción */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>
        <Button icon={Plus} onClick={openCreate} className="ml-auto">Nueva Entrada</Button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <TrendingUp size={36} className="mb-2" />
            <p>No hay entradas en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map(e => (
                  <tr key={e.id} className={`hover:bg-gray-50 ${e.is_projected ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(e.flow_date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{e.category || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={e.type === 'ingreso' ? 'green' : 'red'}>{e.type}</Badge>
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold ${e.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      {e.type === 'ingreso' ? '+' : '-'}{formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {e.is_projected ? <Badge variant="yellow">Proyectado</Badge> : <Badge variant="gray">Real</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(e)} className="text-gray-400 hover:text-indigo-600"><Edit2 size={15} /></button>
                        <button onClick={() => setDeleteId(e.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
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
              className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
            <label htmlFor="projected" className="text-sm text-gray-700">Es un valor proyectado/estimado</label>
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
          <AlertTriangle size={22} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-gray-600">¿Eliminar esta entrada de cash flow?</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
