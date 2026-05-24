import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { formatCurrency, formatPercent, formatDate } from '../utils/formatters';

const EMPTY = {
  sku: '', nombre: '', descripcion: '', categoria: '', proveedor: '', aroma: '', variant: '',
  precio_costo: '', precio_venta: '', import_cost_per_unit: '', packaging_cost: '',
  stock_actual: '', stock_minimo: '', lot_number: '', expiry_date: ''
};

const CATEGORIAS = ['Velas', 'Perfumes', 'Difusores', 'Jabones', 'Kits', 'Accesorios', 'Esencias', 'Otro'];

export default function Productos() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ q: '', categoria: '', proveedor: '' });
  const [error, setError] = useState('');

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
      setError('Error al cargar productos');
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
      if (editId) {
        await api.put(`/products/${editId}`, form);
      } else {
        await api.post('/products', form);
      }
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

  return (
    <div>
      {/* Barra de filtros y acciones */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex-1 min-w-48 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar por nombre, SKU..."
            value={filters.q}
            onChange={e => setFilters(p => ({ ...p, q: e.target.value }))}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={filters.categoria} onChange={e => setFilters(p => ({ ...p, categoria: e.target.value }))}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
        <Button icon={Plus} onClick={openCreate}>Nuevo Producto</Button>
      </div>

      <p className="text-xs text-gray-500 mb-3">{total} producto{total !== 1 ? 's' : ''}</p>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Package size={36} className="mb-2" />
            <p>No hay productos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  {['SKU', 'Nombre', 'Categoría', 'Costo', 'Venta', 'Margen', 'Stock', 'Estado'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.sku}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{p.nombre}</div>
                      {p.aroma && <div className="text-xs text-gray-500">{p.aroma} {p.variant && `· ${p.variant}`}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {p.categoria && <Badge variant="blue">{p.categoria}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(p.precio_costo)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(p.precio_venta)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={parseFloat(p.margen) >= 50 ? 'text-green-600 font-medium' : 'text-gray-600'}>
                        {formatPercent(p.margen)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={p.stock_actual <= p.stock_minimo ? 'text-red-600 font-medium' : 'text-gray-700'}>
                        {p.stock_actual}
                      </span>
                      <span className="text-gray-400"> / {p.stock_minimo}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.stock_actual === 0 ? (
                        <Badge variant="red">Sin stock</Badge>
                      ) : p.stock_actual <= p.stock_minimo ? (
                        <Badge variant="yellow">Stock bajo</Badge>
                      ) : (
                        <Badge variant="green">OK</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-indigo-600 transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => setDeleteId(p.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={15} />
                        </button>
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
                <p className="text-xs text-green-600 mt-1">Margen: {margen.toFixed(1)}%</p>
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

      {/* Modal eliminar */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Producto" size="sm">
        <div className="flex items-start gap-3 mb-5">
          <AlertTriangle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600">¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
