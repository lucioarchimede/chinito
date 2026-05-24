import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, ShoppingCart, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge, { channelColor } from '../components/ui/Badge';
import { formatCurrency, formatDate, formatDateInput, today, monthStart } from '../utils/formatters';

const EMPTY = {
  sale_date: today(), product_id: '', quantity: '', unit_price: '', discount: '0',
  mp_commission: '0', mp_tax: '0', shipping_cost: '0',
  customer_name: '', customer_email: '', customer_phone: '',
  is_repeat_customer: false, sale_channel: '', payment_method: '', notes: ''
};

const CHANNELS = ['MercadoLibre', 'Instagram', 'WhatsApp', 'TiendaNube', 'Local', 'Otro'];
const PAYMENTS = ['MercadoPago', 'Transferencia', 'Efectivo', 'Tarjeta', 'Otro'];

export default function Ventas() {
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ start_date: monthStart(), end_date: today(), channel: '' });
  const [summary, setSummary] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.set('start_date', filters.start_date);
      if (filters.end_date) params.set('end_date', filters.end_date);
      if (filters.channel) params.set('channel', filters.channel);
      params.set('limit', '200');
      const [salesRes, summaryRes, prodsRes] = await Promise.all([
        api.get(`/sales?${params}`),
        api.get(`/sales/summary?${params}`),
        api.get('/products?limit=200'),
      ]);
      setSales(salesRes.data.data);
      setTotal(salesRes.data.total);
      setSummary(summaryRes.data);
      setProducts(prodsRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModalOpen(true); };
  const openEdit = (s) => {
    setForm({
      sale_date: formatDateInput(s.sale_date), product_id: s.product_id || '',
      quantity: s.quantity, unit_price: s.unit_price, discount: s.discount || '0',
      mp_commission: s.mp_commission || '0', mp_tax: s.mp_tax || '0',
      shipping_cost: s.shipping_cost || '0', customer_name: s.customer_name || '',
      customer_email: s.customer_email || '', customer_phone: s.customer_phone || '',
      is_repeat_customer: s.is_repeat_customer || false,
      sale_channel: s.sale_channel || '', payment_method: s.payment_method || '',
      notes: s.notes || ''
    });
    setEditId(s.id); setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) await api.put(`/sales/${editId}`, form);
      else await api.post('/sales', form);
      setModalOpen(false); fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await api.delete(`/sales/${deleteId}`); setDeleteId(null); fetchData(); }
    catch (err) { alert('Error al eliminar'); }
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const grossSales = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0);
  const netSales = grossSales - (parseFloat(form.discount) || 0);
  const finalRevenue = netSales - (parseFloat(form.mp_commission) || 0) - (parseFloat(form.mp_tax) || 0) - (parseFloat(form.shipping_cost) || 0);

  return (
    <div>
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Ventas', value: summary.total_sales },
            { label: 'Revenue', value: formatCurrency(summary.total_revenue) },
            { label: 'Ticket Prom.', value: formatCurrency(summary.avg_ticket) },
            { label: 'Unidades', value: summary.total_units },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase">{label}</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

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
        <Button icon={Plus} onClick={openCreate} className="ml-auto">Nueva Venta</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <ShoppingCart size={36} className="mb-2" />
            <p>No hay ventas en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Fecha', 'Producto', 'Cliente', 'Canal', 'Cantidad', 'Revenue', 'Pago', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(s.sale_date)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{s.product_nombre || '—'}</div>
                      {s.product_sku && <div className="text-xs text-gray-400">{s.product_sku}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{s.customer_name || '—'}</div>
                      {s.is_repeat_customer && <Badge variant="indigo" className="mt-0.5">Recurrente</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      {s.sale_channel && <Badge variant={channelColor(s.sale_channel)}>{s.sale_channel}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{s.quantity}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(s.final_revenue)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.payment_method || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-indigo-600"><Edit2 size={15} /></button>
                        <button onClick={() => setDeleteId(s.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Venta' : 'Nueva Venta'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fecha *" type="date" value={form.sale_date} onChange={f('sale_date')} required />
            <Select label="Producto" value={form.product_id} onChange={f('product_id')}>
              <option value="">Sin producto</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Cantidad *" type="number" value={form.quantity} onChange={f('quantity')} required min="1" />
            <Input label="Precio Unitario *" type="number" step="0.01" value={form.unit_price} onChange={f('unit_price')} required />
            <Input label="Descuento ($)" type="number" step="0.01" value={form.discount} onChange={f('discount')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Comisión MP ($)" type="number" step="0.01" value={form.mp_commission} onChange={f('mp_commission')} />
            <Input label="Impuesto MP ($)" type="number" step="0.01" value={form.mp_tax} onChange={f('mp_tax')} />
            <Input label="Envío ($)" type="number" step="0.01" value={form.shipping_cost} onChange={f('shipping_cost')} />
          </div>
          {grossSales > 0 && (
            <div className="bg-indigo-50 rounded-lg p-3 text-sm grid grid-cols-3 gap-2">
              <div><span className="text-gray-500">Venta Bruta:</span><br /><strong>{formatCurrency(grossSales)}</strong></div>
              <div><span className="text-gray-500">Venta Neta:</span><br /><strong>{formatCurrency(netSales)}</strong></div>
              <div><span className="text-gray-500">Revenue Final:</span><br /><strong className="text-indigo-700">{formatCurrency(finalRevenue)}</strong></div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <Input label="Nombre Cliente" value={form.customer_name} onChange={f('customer_name')} />
            <Input label="Email Cliente" type="email" value={form.customer_email} onChange={f('customer_email')} />
            <Input label="Teléfono" value={form.customer_phone} onChange={f('customer_phone')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Canal" value={form.sale_channel} onChange={f('sale_channel')}>
              <option value="">Sin canal</option>
              {CHANNELS.map(c => <option key={c}>{c}</option>)}
            </Select>
            <Select label="Forma de Pago" value={form.payment_method} onChange={f('payment_method')}>
              <option value="">Sin definir</option>
              {PAYMENTS.map(p => <option key={p}>{p}</option>)}
            </Select>
            <div className="flex items-center mt-5">
              <input type="checkbox" id="repeat" checked={form.is_repeat_customer}
                onChange={e => setForm(p => ({ ...p, is_repeat_customer: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
              <label htmlFor="repeat" className="ml-2 text-sm text-gray-700">Cliente recurrente</label>
            </div>
          </div>
          <Input label="Notas" value={form.notes} onChange={f('notes')} placeholder="Observaciones..." />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Venta" size="sm">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle size={22} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-gray-600">¿Eliminar esta venta? Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
