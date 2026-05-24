import { useState, useEffect, useCallback } from 'react';
import { Plus, Layers, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatDate, today } from '../utils/formatters';

const EMPTY = { product_id: '', movement_type: 'entrada', quantity: '', reason: '', notes: '', movement_date: today() };

export default function Stock() {
  const [levels, setLevels] = useState([]);
  const [movements, setMovements] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('levels');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [lvl, mv, al, pr] = await Promise.all([
        api.get('/stock/levels'),
        api.get('/stock?limit=100'),
        api.get('/stock/alerts'),
        api.get('/products?limit=200'),
      ]);
      setLevels(lvl.data);
      setMovements(mv.data.data);
      setAlerts(al.data);
      setProducts(pr.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/stock', form);
      setModalOpen(false);
      setForm(EMPTY);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || 'Error al crear movimiento'); }
    finally { setSaving(false); }
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const tabs = [
    { id: 'levels', label: 'Niveles de Stock' },
    { id: 'movements', label: 'Movimientos' },
    { id: 'alerts', label: `Alertas ${alerts.length > 0 ? `(${alerts.length})` : ''}` },
  ];

  return (
    <div>
      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase">Total SKUs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{levels.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase">Valor Stock (costo)</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            {formatCurrency(levels.reduce((s, p) => s + parseFloat(p.valor_stock_costo || 0), 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase">Bajo Mínimo</p>
          <p className={`text-2xl font-bold mt-1 ${alerts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {alerts.length} producto{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tabs + acción */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <Button icon={Plus} onClick={() => setModalOpen(true)}>Registrar Movimiento</Button>
      </div>

      {/* Contenido según tab */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : tab === 'levels' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['SKU', 'Producto', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Valor Costo', 'Valor Venta', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {levels.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.sku}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.nombre}</td>
                    <td className="px-4 py-3">{p.categoria && <Badge variant="blue">{p.categoria}</Badge>}</td>
                    <td className="px-4 py-3 text-sm font-semibold"
                      style={{ color: p.stock_actual <= p.stock_minimo ? '#dc2626' : '#16a34a' }}>
                      {p.stock_actual}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.stock_minimo}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(p.valor_stock_costo)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(p.valor_stock_venta)}</td>
                    <td className="px-4 py-3">
                      {p.stock_actual === 0 ? <Badge variant="red">Sin stock</Badge>
                        : p.bajo_minimo ? <Badge variant="yellow">Bajo mínimo</Badge>
                        : <Badge variant="green">OK</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'movements' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Notas'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(m.movement_date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.product_nombre || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.movement_type === 'entrada' ? 'green' : m.movement_type === 'salida' ? 'red' : 'yellow'}>
                        {m.movement_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium"
                      style={{ color: m.movement_type === 'entrada' ? '#16a34a' : '#dc2626' }}>
                      {m.movement_type === 'entrada' ? '+' : m.movement_type === 'salida' ? '-' : '~'}{m.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.reason || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <p className="text-green-700 font-medium">¡Sin alertas! Todos los productos tienen stock suficiente.</p>
            </div>
          ) : alerts.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-red-200 shadow-sm p-4 flex items-center gap-4">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{p.nombre}</p>
                <p className="text-sm text-gray-500">SKU: {p.sku} · Categoría: {p.categoria}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-red-600">{p.stock_actual}</p>
                <p className="text-xs text-gray-500">mínimo: {p.stock_minimo}</p>
                <p className="text-xs text-red-500 font-medium">Falta: {p.deficit}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setForm(EMPTY); }} title="Registrar Movimiento de Stock" size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Select label="Producto *" value={form.product_id} onChange={f('product_id')} required>
            <option value="">Seleccionar producto...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock_actual})</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo *" value={form.movement_type} onChange={f('movement_type')}>
              <option value="entrada">Entrada (+)</option>
              <option value="salida">Salida (-)</option>
              <option value="ajuste">Ajuste</option>
            </Select>
            <Input label="Cantidad *" type="number" value={form.quantity} onChange={f('quantity')} required min="1" />
          </div>
          <Input label="Fecha *" type="date" value={form.movement_date} onChange={f('movement_date')} required />
          <Input label="Motivo" value={form.reason} onChange={f('reason')} placeholder="Compra, venta, ajuste de inventario..." />
          <Input label="Notas" value={form.notes} onChange={f('notes')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
