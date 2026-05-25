import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Plus, Edit2, Trash2, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import api from '../utils/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { useChartTheme } from '../context/ThemeContext';

const FREQ_LABELS = { monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual' };
const CAT_LABELS = {
  rent: 'Alquiler', salaries: 'Sueldos', utilities: 'Servicios',
  software: 'Software', marketing: 'Marketing', other: 'Otros'
};

function CostForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || {
    name: '', amount: '', frequency: 'monthly', category: 'other', is_active: true, start_date: '', notes: ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <Input label="Nombre del costo" value={form.name} onChange={e => set('name', e.target.value)} required />
      <div className="grid grid-cols-3 gap-4">
        <Input label="Monto ($)" type="number" step="0.01" min="0" value={form.amount}
          onChange={e => set('amount', e.target.value)} required />
        <Select label="Frecuencia" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
          <option value="monthly">Mensual</option>
          <option value="quarterly">Trimestral</option>
          <option value="yearly">Anual</option>
        </Select>
        <Select label="Categoría" value={form.category} onChange={e => set('category', e.target.value)}>
          {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="is_active" checked={form.is_active}
          onChange={e => set('is_active', e.target.checked)}
          className="rounded border-slate-300 dark:border-slate-600 text-indigo-600" />
        <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-slate-300">Activo</label>
      </div>
      <Input label="Notas (opcional)" value={form.notes} onChange={e => set('notes', e.target.value)} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar costo'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}

function ProgressArc({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 100 ? '#10b981' : clamped >= 70 ? '#6366f1' : clamped >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center">
      <svg width={120} height={64} viewBox="0 0 120 64">
        <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="currentColor" strokeWidth={10}
          className="text-slate-100 dark:text-slate-800" strokeLinecap="round" />
        <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke={color} strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * 157} 157`} />
      </svg>
      <span className="absolute bottom-0 text-base font-bold text-slate-900 dark:text-slate-50"
        style={{ color }}>{clamped.toFixed(0)}%</span>
    </div>
  );
}

export default function BreakEven() {
  const [analysis, setAnalysis] = useState(null);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('analysis');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const chart = useChartTheme();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analysisRes, costsRes] = await Promise.all([
        api.get('/breakeven/analysis'),
        api.get('/breakeven/fixed-costs'),
      ]);
      setAnalysis(analysisRes.data);
      setCosts(costsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/breakeven/fixed-costs/${editing.id}`, form);
      } else {
        await api.post('/breakeven/fixed-costs', form);
      }
      setModalOpen(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este costo?')) return;
    try {
      await api.delete(`/breakeven/fixed-costs/${id}`);
      fetchData();
    } catch { alert('Error al eliminar'); }
  };

  const tabs = [
    { id: 'analysis', label: 'Análisis' },
    { id: 'costs', label: 'Costos Fijos' },
    { id: 'sensitivity', label: 'Sensibilidad' },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-card">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors touch-manipulation ${tab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
      ) : (
        <>
          {tab === 'analysis' && analysis && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5 flex flex-col items-center">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Progreso Break-Even</p>
                  <ProgressArc pct={analysis.break_even.pct_reached} />
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    {formatCurrency(analysis.sales.current_revenue)} / {analysis.break_even.revenue_needed ? formatCurrency(analysis.break_even.revenue_needed) : '—'}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">Revenue Break-Even</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-1">
                    {analysis.break_even.revenue_needed ? formatCurrency(analysis.break_even.revenue_needed) : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-400">{analysis.break_even.orders_needed} pedidos necesarios</p>
                  <div className="mt-3 flex items-center gap-2">
                    {analysis.break_even.will_reach
                      ? <><CheckCircle size={14} className="text-emerald-500" /><span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Se alcanzará este mes</span></>
                      : <><XCircle size={14} className="text-red-500" /><span className="text-xs text-red-500 dark:text-red-400 font-medium">Faltan {formatCurrency(analysis.break_even.gap)}</span></>}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">Costos Fijos Mensuales</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-1">{formatCurrency(analysis.fixed_costs.total_monthly)}</p>
                  <p className="text-xs text-slate-400">{costs.filter(c => c.is_active).length} costos activos</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                    Margen por pedido: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(analysis.sales.contribution_margin_per_order)}</span>
                  </p>
                </div>
              </div>

              {/* Sales stats */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Performance del Mes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Revenue actual', value: formatCurrency(analysis.sales.current_revenue) },
                    { label: 'Revenue proyectado', value: formatCurrency(analysis.sales.projected_revenue) },
                    { label: 'Ticket promedio', value: formatCurrency(analysis.sales.avg_ticket) },
                    { label: 'Días restantes', value: `${analysis.period.days_remaining} días` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-50 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Costs by category chart */}
              {analysis.fixed_costs.by_category.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Costos Fijos por Categoría</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analysis.fixed_costs.by_category} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                      <XAxis dataKey="category" tick={chart.tick} tickFormatter={v => CAT_LABELS[v] || v} />
                      <YAxis tick={chart.tick} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={chart.tooltipStyle}
                        formatter={(v, n, p) => [formatCurrency(v), CAT_LABELS[p.payload.category] || p.payload.category]} />
                      <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {tab === 'costs' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="flex items-center gap-2">
                  <Plus size={15} /> Agregar Costo
                </Button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Nombre</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 hidden sm:table-cell">Categoría</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Monto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 hidden sm:table-cell">Frecuencia</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Mens. eq.</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Estado</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {costs.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">No hay costos fijos registrados</td></tr>
                    ) : costs.map(cost => {
                      const monthly = cost.frequency === 'monthly' ? cost.amount
                        : cost.frequency === 'quarterly' ? cost.amount / 3 : cost.amount / 12;
                      return (
                        <tr key={cost.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{cost.name}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{CAT_LABELS[cost.category] || cost.category}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">{formatCurrency(cost.amount)}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell">{FREQ_LABELS[cost.frequency]}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 text-xs">{formatCurrency(monthly)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={cost.is_active ? 'green' : 'gray'} className="text-xs">
                              {cost.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => { setEditing(cost); setModalOpen(true); }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors touch-manipulation">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDelete(cost.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors touch-manipulation">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {costs.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Total mensual (activos)</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-slate-900 dark:text-slate-50">
                          {formatCurrency(costs.filter(c => c.is_active).reduce((s, c) => {
                            const m = c.frequency === 'monthly' ? c.amount : c.frequency === 'quarterly' ? c.amount / 3 : c.amount / 12;
                            return s + parseFloat(m);
                          }, 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {tab === 'sensitivity' && analysis && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Análisis de Sensibilidad</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Cómo cambiaría el break-even en distintos escenarios</p>
              {analysis.sensitivity.length === 0 ? (
                <p className="text-slate-400 text-sm">Agrega costos fijos para ver el análisis</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Escenario</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Break-Even Revenue</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400">vs. Actual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                        <td className="py-2.5 px-3 font-semibold text-indigo-700 dark:text-indigo-300">Situación actual</td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-700 dark:text-indigo-300">
                          {analysis.break_even.revenue_needed ? formatCurrency(analysis.break_even.revenue_needed) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-indigo-400">—</td>
                      </tr>
                      {analysis.sensitivity.map((row, i) => {
                        const current = analysis.break_even.revenue_needed;
                        const diff = current && row.break_even_revenue ? row.break_even_revenue - current : null;
                        return (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{row.scenario}</td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                              {row.break_even_revenue ? formatCurrency(row.break_even_revenue) : '—'}
                            </td>
                            <td className={`py-2.5 px-3 text-right text-xs font-medium ${diff !== null ? (diff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') : 'text-slate-400'}`}>
                              {diff !== null ? (diff < 0 ? `${formatCurrency(diff)}` : `+${formatCurrency(diff)}`) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Editar Costo Fijo' : 'Nuevo Costo Fijo'}>
        <CostForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(null); }}
          saving={saving}
        />
      </Modal>
    </div>
  );
}
