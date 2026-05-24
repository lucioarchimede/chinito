import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Receipt, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase">Total Gastos</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase">Cantidad</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{total} gastos</p>
        </div>
        {byCategory[0] && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase">Mayor Categoría</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 capitalize">{byCategory[0].category}</p>
            <p className="text-sm text-gray-500">{formatCurrency(byCategory[0].total)}</p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input type="date" value={filters.start_date} onChange={e => setFilters(p => ({ ...p, start_date: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input type="date" value={filters.end_date} onChange={e => setFilters(p => ({ ...p, end_date: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <Button icon={Plus} onClick={openCreate} className="ml-auto">Nuevo Gasto</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tabla */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Receipt size={36} className="mb-2" />
              <p>No hay gastos en este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Fecha', 'Descripción', 'Categoría', 'Monto', 'Proveedor', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenses.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(e.expense_date)}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{e.description}</div>
                        <div className="flex gap-1.5 mt-0.5">
                          {e.subcategory && <span className="text-xs text-gray-400">{e.subcategory}</span>}
                          {e.is_recurring && <Badge variant="blue">Recurrente</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={catColor(e.category)} className="capitalize">{e.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-600">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{e.supplier || '—'}</td>
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

        {/* Pie chart por categoría */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Por Categoría</h3>
          {byCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byCategory} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70}>
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {byCategory.map((cat, i) => (
                  <div key={cat.category} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize text-gray-700">{cat.category}</span>
                    </div>
                    <span className="font-medium text-gray-900">{formatCurrency(cat.total)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-gray-400 text-sm">Sin datos</p>}
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
              className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
            <label htmlFor="recurring" className="text-sm text-gray-700">Gasto recurrente (mensual)</label>
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
          <AlertTriangle size={22} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-gray-600">¿Eliminar este gasto? Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
