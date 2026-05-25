import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { TableSkeleton, Skeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatPercent, formatDate } from '../utils/formatters';
import { useChartTheme } from '../context/ThemeContext';

function RentabilidadTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('gross_profit');
  const chart = useChartTheme();

  useEffect(() => {
    setLoading(true);
    api.get('/products/profitability').then(res => {
      setData(res.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const sorted = [...data].sort((a, b) => parseFloat(b[sort]) - parseFloat(a[sort]));
  const top10 = sorted.slice(0, 10);

  if (loading) return <div className="space-y-4"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  return (
    <div className="space-y-5">
      {/* Top 10 chart */}
      {top10.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Top 10 Productos por {sort === 'gross_profit' ? 'Ganancia Bruta' : sort === 'revenue' ? 'Revenue' : 'Margen %'}</h3>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="gross_profit">Ganancia bruta</option>
              <option value="revenue">Revenue</option>
              <option value="margin_pct">Margen %</option>
              <option value="units_sold">Unidades vendidas</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={chart.tick}
                tickFormatter={v => sort === 'margin_pct' ? `${v.toFixed(0)}%` : `$${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="nombre" tick={{ ...chart.tick }} width={120}
                tickFormatter={v => v.length > 16 ? v.slice(0, 16) + '…' : v} />
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <Tooltip contentStyle={chart.tooltipStyle}
                formatter={(v) => [sort === 'margin_pct' ? `${parseFloat(v).toFixed(1)}%` : formatCurrency(v), '']} />
              <Bar dataKey={sort} fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Producto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Unidades</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Revenue</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">COGS</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Ganancia bruta</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin datos de ventas en el período</td></tr>
              ) : sorted.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{p.nombre}</p>
                    <p className="text-xs text-slate-400 font-mono">{p.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{p.units_sold}</td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(p.revenue)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">{formatCurrency(p.cogs)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(p.gross_profit)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${parseFloat(p.margin_pct) >= 50 ? 'text-emerald-600 dark:text-emerald-400' : parseFloat(p.margin_pct) >= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                      {parseFloat(p.margin_pct).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const EMPTY = {
  sku: '', nombre: '', descripcion: '', categoria: '', proveedor: '', aroma: '', variant: '',
  precio_costo: '', precio_venta: '', import_cost_per_unit: '', packaging_cost: '',
  stock_actual: '', stock_minimo: '', lot_number: '', expiry_date: ''
};
const CATEGORIAS = ['Velas', 'Perfumes', 'Difusores', 'Jabones', 'Kits', 'Accesorios', 'Esencias', 'Otro'];

export default function Productos() {
  const [mainTab, setMainTab] = useState('productos');
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ q: '', categoria: '', proveedor: '' });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.categoria) params.set('categoria', filters.categoria);
      if (filters.proveedor) params.set('proveedor', filters.proveedor);
      const res = await api.get(`/products?${params}`);
      setProducts(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModalOpen(true); };
  const openEdit = (p) => {
    setForm({
      sku: p.sku, nombre: p.nombre, descripcion: p.descripcion || '', categoria: p.categoria || '',
      proveedor: p.proveedor || '', aroma: p.aroma || '', variant: p.variant || '',
      precio_costo: p.precio_costo, precio_venta: p.precio_venta,
      import_cost_per_unit: p.import_cost_per_unit || '', packaging_cost: p.packaging_cost || '',
      stock_actual: p.stock_actual, stock_minimo: p.stock_minimo,
      lot_number: p.lot_number || '', expiry_date: p.expiry_date ? p.expiry_date.split('T')[0] : ''
    });
    setEditId(p.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) await api.put(`/products/${editId}`, form);
      else await api.post('/products', form);
      setModalOpen(false);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/products/${deleteId}`);
      setDeleteId(null);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));
  const margen = parseFloat(form.precio_venta) > 0
    ? ((parseFloat(form.precio_venta) - parseFloat(form.precio_costo)) / parseFloat(form.precio_venta) * 100)
    : 0;

  const stockBadge = (p) => {
    if (p.stock_actual === 0) return <Badge variant="red">Sin stock</Badge>;
    if (p.stock_actual <= p.stock_minimo) return <Badge variant="yellow">Stock bajo</Badge>;
    return <Badge variant="green">OK</Badge>;
  };

  return (
    <div>
      {/* Main tabs */}
      <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-card mb-5 w-fit">
        {[
          { id: 'productos', label: 'Productos', icon: Package },
          { id: 'rentabilidad', label: 'Rentabilidad', icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setMainTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors touch-manipulation ${mainTab === id ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {mainTab === 'rentabilidad' && <RentabilidadTab />}

      {mainTab === 'productos' && <>
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="flex-1 min-w-40 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Buscar por nombre, SKU..."
            value={filters.q}
            onChange={e => setFilters(p => ({ ...p, q: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 min-h-[42px]"
          />
        </div>
        <select value={filters.categoria} onChange={e => setFilters(p => ({ ...p, categoria: e.target.value }))}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 transition-colors text-slate-900 dark:text-slate-100 min-h-[42px]">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
        <Button icon={Plus} onClick={openCreate}>Nuevo Producto</Button>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{total} producto{total !== 1 ? 's' : ''}</p>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : products.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card flex flex-col items-center justify-center h-48 text-slate-400">
          <Package size={32} className="mb-2.5" />
          <p className="text-sm">No hay productos</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  {['SKU', 'Nombre', 'Categoría', 'Costo', 'Venta', 'Margen', 'Stock', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400">{p.sku}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.nombre}</div>
                      {p.aroma && <div className="text-xs text-slate-400 dark:text-slate-500">{p.aroma}{p.variant && ` · ${p.variant}`}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {p.categoria && <Badge variant="blue">{p.categoria}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatCurrency(p.precio_costo)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{formatCurrency(p.precio_venta)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={parseFloat(p.margen) >= 50 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-600 dark:text-slate-400'}>
                        {formatPercent(p.margen)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={p.stock_actual <= p.stock_minimo ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-700 dark:text-slate-300'}>
                        {p.stock_actual}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600"> / {p.stock_minimo}</span>
                    </td>
                    <td className="px-4 py-3">{stockBadge(p)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeleteId(p.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {products.map(p => (
              <div key={p.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.nombre}</p>
                      {stockBadge(p)}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{p.sku}{p.aroma && ` · ${p.aroma}`}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(p.precio_venta)}</span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{formatPercent(p.margen)} margen</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Stock: {p.stock_actual}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => setDeleteId(p.id)} className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      </>}

      {/* Modal crear/editar */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Producto' : 'Nuevo Producto'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU *" value={form.sku} onChange={f('sku')} required placeholder="CND-001" />
            <Input label="Nombre *" value={form.nombre} onChange={f('nombre')} required placeholder="Vela Lavanda Grande" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Categoría" value={form.categoria} onChange={f('categoria')}>
              <option value="">Sin categoría</option>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </Select>
            <Input label="Proveedor" value={form.proveedor} onChange={f('proveedor')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Aroma" value={form.aroma} onChange={f('aroma')} placeholder="Lavanda" />
            <Input label="Variante" value={form.variant} onChange={f('variant')} placeholder="Grande 300g" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label="Precio Costo ($)" type="number" step="0.01" value={form.precio_costo} onChange={f('precio_costo')} />
            </div>
            <div>
              <Input label="Precio Venta ($)" type="number" step="0.01" value={form.precio_venta} onChange={f('precio_venta')} />
              {parseFloat(form.precio_venta) > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Margen: {margen.toFixed(1)}%</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Costo Importación/u" type="number" step="0.01" value={form.import_cost_per_unit} onChange={f('import_cost_per_unit')} />
            <Input label="Costo Packaging" type="number" step="0.01" value={form.packaging_cost} onChange={f('packaging_cost')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Stock Actual" type="number" value={form.stock_actual} onChange={f('stock_actual')} />
            <Input label="Stock Mínimo" type="number" value={form.stock_minimo} onChange={f('stock_minimo')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="N° de Lote" value={form.lot_number} onChange={f('lot_number')} />
            <Input label="Fecha Vencimiento" type="date" value={form.expiry_date} onChange={f('expiry_date')} />
          </div>
          <Input label="Descripción" value={form.descripcion} onChange={f('descripcion')} placeholder="Descripción del producto" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} type="button">Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Producto" size="sm">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-600 dark:text-slate-300">¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
