import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Receipt, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatDate, formatDateInput, today, monthStart } from '../utils/formatters';

const EMPTY = {
  expense_date: today(), category: '', subcategory: '', description: '', amount: '',
  is_recurring: false, payment_method: '', supplier: '', invoice_number: '', notes: ''
};
const CATEGORIES = [
  { value: 'marketing', label: 'Marketing' },
  { value: 'operativos', label: 'Operativos' },
  { value: 'personal', label: 'Personal' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'otros', label: 'Otros' },
];
const COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'];
const catColor = (c) => ({ marketing:'purple', operativos:'blue', personal:'orange', impuestos:'red', otros:'gray' }[c] || 'gray');
const dateInputCls = 'text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white hover:border-slate-400 transition-colors';

export default function Gastos() {
  const [expenses, setExpenses] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ start_date: monthStart(), end_date: today(), category: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.set('start_date', filters.start_date);
      if (filters.end_date) params.set('end_date', filters.end_date);
      if (filters.category) params.set('category', filters.category);
      params.set('limit', '200');
      const [expRes, catRes] = await Promise.all([
        api.get(`/expenses?${params}`),
        api.get(`/expenses/by-category?${params}`),
      ]);
      setExpenses(expRes.data.data);
      setTotal(expRes.data.total);
      setTotalAmount(expRes.data.total_amount);
      setByCategory(catRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModalOpen(true); };
  const openEdit = (e) => {
    setForm({
      expense_date: formatDateInput(e.expense_date), category: e.category || '',
      subcategory: e.subcategory || '', description: e.description, amount: e.amount,
      is_recurring: e.is_recurring || false, payment_method: e.payment_method || '',
      supplier: e.supplier || '', invoice_number: e.invoice_number || '', notes: e.notes || ''
    });
    setEditId(e.id); setModalOpen(true);
  };

  const handleSave = async (ev) => {
    ev.preventDefault(); setSaving(true);
    try {
      if (editId) await api.put(`/expenses/${editId}`, form);
      else await api.post('/expenses', form);
      setModalOpen(false); fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/expenses/${deleteId}`); setDeleteId(null); fetchData(); }
    catch { alert('Error al eliminar'); }
  };

  const ff = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Gastos</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Cantidad</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{total} gastos</p>
        </div>
        {byCategory[0] && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Mayor Categoría</p>
            <p className="text-xl font-bold text-slate-900 mt-1 capitalize">{byCategory[0].category}</p>
            <p className="text-sm text-slate-400">{formatCurrency(byCategory[0].total)}</p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <input type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))} className={dateInputCls} />
        <input type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))} className={dateInputCls} />
        <select value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))} className={dateInputCls}>
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <Button icon={Plus} onClick={openCreate} className="ml-auto">Nuevo Gasto</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tabla */}
        <div className="lg:col-span-2">
          {loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : expenses.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card flex flex-col items-center justify-center h-48 text-slate-400">
              <Receipt size={32} className="mb-2.5" />
              <p className="text-sm">No hay gastos en este período</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Fecha', 'Descripción', 'Categoría', 'Monto', 'Proveedor', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {expenses.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(e.expense_date)}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">{e.description}</div>
                          <div className="flex gap-1.5 mt-0.5">
                            {e.subcategory && <span className="text-xs text-slate-400">{e.subcategory}</span>}
                            {e.is_recurring && <Badge variant="blue">Recurrente</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={catColor(e.category)} className="capitalize">{e.category}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-red-600">{formatCurrency(e.amount)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{e.supplier || '—'}</td>
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
                {expenses.map(e => (
                  <div key={e.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900">{e.description}</p>
                          <Badge variant={catColor(e.category)} className="capitalize">{e.category}</Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(e.expense_date)}{e.supplier && ` · ${e.supplier}`}</p>
                        <p className="text-sm font-semibold text-red-600 mt-1">{formatCurrency(e.amount)}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(e)} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-indigo-50 transition-colors"><Edit2 size={15} /></button>
                        <button onClick={() => setDeleteId(e.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Por Categoría</h3>
          {byCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={65} innerRadius={28}>
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }}
                    formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {byCategory.map((cat, i) => (
                  <div key={cat.category} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize text-slate-700">{cat.category}</span>
                    </div>
                    <span className="font-medium text-slate-900">{formatCurrency(cat.total)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-slate-400 text-sm">Sin datos</p>}
        </div>
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Gasto' : 'Nuevo Gasto'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha *" type="date" value={form.expense_date} onChange={ff('expense_date')} required />
            <Select label="Categoría *" value={form.category} onChange={ff('category')} required>
              <option value="">Seleccionar...</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Descripción *" value={form.description} onChange={ff('description')} required />
            <Input label="Monto ($) *" type="number" step="0.01" value={form.amount} onChange={ff('amount')} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Subcategoría" value={form.subcategory} onChange={ff('subcategory')} />
            <Input label="Proveedor" value={form.supplier} onChange={ff('supplier')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="N° Factura" value={form.invoice_number} onChange={ff('invoice_number')} />
            <Select label="Forma de Pago" value={form.payment_method} onChange={ff('payment_method')}>
              <option value="">Sin definir</option>
              {['Efectivo', 'Transferencia', 'Tarjeta', 'Débito automático'].map(m => <option key={m}>{m}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="recurring" checked={form.is_recurring}
              onChange={e => setForm(p => ({ ...p, is_recurring: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
            <label htmlFor="recurring" className="text-sm text-slate-700">Gasto recurrente (mensual)</label>
          </div>
          <Input label="Notas" value={form.notes} onChange={ff('notes')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Gasto" size="sm">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600">¿Eliminar este gasto? Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
