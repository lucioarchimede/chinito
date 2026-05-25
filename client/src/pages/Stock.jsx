import { useState, useEffect, useCallback } from 'react';
import { Plus, Layers, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { TableSkeleton } from '../components/ui/Skeleton';
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
    { id: 'levels', label: 'Niveles' },
    { id: 'movements', label: 'Movimientos' },
    { id: 'alerts', label: `Alertas${alerts.length > 0 ? ` (${alerts.length})` : ''}` },
  ];

  const stockValue = levels.reduce((s, p) => s + parseFloat(p.valor_stock_costo || 0), 0);

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total SKUs</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-1">{levels.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor Stock</p>
          <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{formatCurrency(stockValue)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Bajo Mínimo</p>
          <p className={`text-xl font-bold mt-1 ${alerts.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {alerts.length} prod.
          </p>
        </div>
      </div>

      {/* Tabs + acción */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-card">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors touch-manipulation ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <Button icon={Plus} onClick={() => setModalOpen(true)}>Registrar Movimiento</Button>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : tab === 'levels' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  {['SKU', 'Producto', 'Categoría', 'Stock', 'Mínimo', 'Valor Costo', 'Valor Venta', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {levels.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">{p.sku}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{p.nombre}</td>
                    <td className="px-4 py-3">{p.categoria && <Badge variant="blue">{p.categoria}</Badge>}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: p.stock_actual <= p.stock_minimo ? '#ef4444' : '#10b981' }}>
                      {p.stock_actual}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">{p.stock_minimo}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{formatCurrency(p.valor_stock_costo)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{formatCurrency(p.valor_stock_venta)}</td>
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
          {/* Mobile */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {levels.map(p => (
              <div key={p.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.nombre}</p>
                      {p.stock_actual === 0 ? <Badge variant="red">Sin stock</Badge>
                        : p.bajo_minimo ? <Badge variant="yellow">Bajo</Badge>
                        : <Badge variant="green">OK</Badge>}
                    </div>
                    <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">{p.sku}</p>
                    <div className="flex gap-3 mt-1.5 text-sm">
                      <span className={`font-semibold ${p.stock_actual <= p.stock_minimo ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>Stock: {p.stock_actual}</span>
                      <span className="text-slate-400 dark:text-slate-500">Mín: {p.stock_minimo}</span>
                      <span className="text-slate-600 dark:text-slate-400">{formatCurrency(p.valor_stock_costo)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'movements' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  {['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Motivo', 'Notas'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatDate(m.movement_date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{m.product_nombre || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.movement_type === 'entrada' ? 'green' : m.movement_type === 'salida' ? 'red' : 'yellow'}>
                        {m.movement_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: m.movement_type === 'entrada' ? '#10b981' : '#ef4444' }}>
                      {m.movement_type === 'entrada' ? '+' : m.movement_type === 'salida' ? '-' : '~'}{m.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{m.reason || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {movements.map(m => (
              <div key={m.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{m.product_nombre || '—'}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(m.movement_date)}{m.reason && ` · ${m.reason}`}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant={m.movement_type === 'entrada' ? 'green' : m.movement_type === 'salida' ? 'red' : 'yellow'}>
                      {m.movement_type === 'entrada' ? '+' : '-'}{m.quantity}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-8 text-center">
              <p className="text-emerald-700 dark:text-emerald-300 font-medium text-sm">¡Sin alertas! Todos los productos tienen stock suficiente.</p>
            </div>
          ) : alerts.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-800 shadow-card p-4 flex items-center gap-4">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{p.nombre}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">SKU: {p.sku} · {p.categoria}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{p.stock_actual}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">mín: {p.stock_minimo}</p>
                <p className="text-xs text-red-500 dark:text-red-400 font-medium">Falta: {p.deficit}</p>
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
