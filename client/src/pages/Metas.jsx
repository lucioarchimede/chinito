import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Plus, Edit2, Trash2, CheckCircle, XCircle, Calendar } from 'lucide-react';
import api from '../utils/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatNumber, formatPercent, formatDate } from '../utils/formatters';

const PERIOD_LABELS = { monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual' };

function ProgressBar({ pct, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-500',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
    yellow: 'bg-amber-500',
  };
  const bar = pct >= 100 ? colors.green : pct >= 70 ? colors.indigo : pct >= 40 ? colors.yellow : colors.red;
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all duration-700 ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function GoalForm({ initial, onSave, onCancel, saving }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState(initial || {
    period_type: 'monthly', period_start: today, period_end: '',
    target_revenue: '', target_orders: '', target_new_customers: '', target_margin_percentage: '', notes: ''
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Select label="Tipo de período" value={form.period_type} onChange={e => set('period_type', e.target.value)}>
          <option value="monthly">Mensual</option>
          <option value="quarterly">Trimestral</option>
          <option value="yearly">Anual</option>
        </Select>
        <Input label="Inicio" type="date" value={form.period_start} onChange={e => set('period_start', e.target.value)} required />
        <Input label="Fin" type="date" value={form.period_end} onChange={e => set('period_end', e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Revenue objetivo ($)" type="number" step="0.01" min="0" value={form.target_revenue}
          onChange={e => set('target_revenue', e.target.value)} required />
        <Input label="Pedidos objetivo" type="number" min="0" value={form.target_orders}
          onChange={e => set('target_orders', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Clientes nuevos objetivo" type="number" min="0" value={form.target_new_customers}
          onChange={e => set('target_new_customers', e.target.value)} />
        <Input label="Margen objetivo (%)" type="number" step="0.1" min="0" max="100" value={form.target_margin_percentage}
          onChange={e => set('target_margin_percentage', e.target.value)} />
      </div>
      <Input label="Notas (opcional)" value={form.notes} onChange={e => set('notes', e.target.value)} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar meta'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}

function computeCurrentProgress(goal) {
  const today = new Date();
  const periodStart = new Date(goal.period_start);
  const periodEnd = new Date(goal.period_end);
  const totalDays = Math.ceil((periodEnd - periodStart) / 86400000) + 1;
  const daysElapsed = Math.max(1, Math.ceil((today - periodStart) / 86400000));
  const daysRemaining = Math.max(0, Math.ceil((periodEnd - today) / 86400000));
  const dailyRate = goal.actual_revenue / daysElapsed;
  const projectedRevenue = dailyRate * totalDays;
  const targetRevenue = parseFloat(goal.target_revenue);
  return {
    actual_revenue: goal.actual_revenue,
    actual_orders: goal.actual_orders,
    actual_new_clients: 0,
    revenue_pct: targetRevenue > 0 ? Math.min(100, (goal.actual_revenue / targetRevenue) * 100) : 0,
    orders_pct: goal.target_orders > 0 ? Math.min(100, (goal.actual_orders / goal.target_orders) * 100) : null,
    clients_pct: null,
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    total_days: totalDays,
    projected_revenue: projectedRevenue,
    will_reach: projectedRevenue >= targetRevenue,
  };
}

export default function Metas() {
  const [current, setCurrent] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/goals');
      const allGoals = res.data;
      setGoals(allGoals);

      const todayStr = new Date().toISOString().split('T')[0];
      const active = allGoals.find(g => g.period_start <= todayStr && g.period_end >= todayStr);
      if (active) {
        setCurrent({ goal: active, progress: computeCurrentProgress(active) });
      } else {
        setCurrent(null);
      }
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
        await api.put(`/goals/${editing.id}`, form);
      } else {
        await api.post('/goals', form);
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
    if (!confirm('¿Eliminar esta meta?')) return;
    try {
      await api.delete(`/goals/${id}`);
      fetchData();
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  const openEdit = (goal) => {
    setEditing(goal);
    setModalOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus size={15} /> Nueva Meta
        </Button>
      </div>

      {/* Meta actual */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-6">
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ) : current ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Meta del Período Actual</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {formatDate(current.goal.period_start)} – {formatDate(current.goal.period_end)}
                <span className="mx-2">·</span>
                <Badge variant="indigo">{PERIOD_LABELS[current.goal.period_type]}</Badge>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {current.progress.will_reach
                ? <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-medium"><CheckCircle size={15} /> En camino</span>
                : <span className="flex items-center gap-1 text-red-500 dark:text-red-400 text-sm font-medium"><XCircle size={15} /> En riesgo</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            {/* Revenue */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Revenue</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-50">{formatCurrency(current.progress.actual_revenue)}</p>
              <p className="text-xs text-slate-400 mt-0.5">de {formatCurrency(current.goal.target_revenue)}</p>
              <ProgressBar pct={current.progress.revenue_pct} />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{current.progress.revenue_pct.toFixed(1)}% alcanzado</p>
            </div>

            {/* Pedidos */}
            {current.goal.target_orders && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Pedidos</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-50">{formatNumber(current.progress.actual_orders)}</p>
                <p className="text-xs text-slate-400 mt-0.5">de {formatNumber(current.goal.target_orders)}</p>
                <ProgressBar pct={current.progress.orders_pct || 0} />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{(current.progress.orders_pct || 0).toFixed(1)}% alcanzado</p>
              </div>
            )}

            {/* Clientes nuevos */}
            {current.goal.target_new_customers && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Clientes Nuevos</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-50">{formatNumber(current.progress.actual_new_clients)}</p>
                <p className="text-xs text-slate-400 mt-0.5">de {formatNumber(current.goal.target_new_customers)}</p>
                <ProgressBar pct={current.progress.clients_pct || 0} />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{(current.progress.clients_pct || 0).toFixed(1)}% alcanzado</p>
              </div>
            )}
          </div>

          {/* Proyección */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400">Días transcurridos</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{current.progress.days_elapsed} / {current.progress.total_days}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Días restantes</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{current.progress.days_remaining}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Revenue proyectado</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{formatCurrency(current.progress.projected_revenue)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Vs objetivo</p>
              <p className={`text-sm font-semibold mt-0.5 ${current.progress.will_reach ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {current.progress.projected_revenue >= parseFloat(current.goal.target_revenue)
                  ? `+${formatCurrency(current.progress.projected_revenue - parseFloat(current.goal.target_revenue))}`
                  : `-${formatCurrency(parseFloat(current.goal.target_revenue) - current.progress.projected_revenue)}`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-dashed border-slate-300 dark:border-slate-700 shadow-card p-10 text-center">
          <Target size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">No hay una meta activa para el período actual</p>
          <Button onClick={openNew} className="mx-auto">
            <Plus size={14} className="mr-1.5" /> Crear primera meta
          </Button>
        </div>
      )}

      {/* Historial de metas */}
      {goals.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Historial de Metas</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {goals.map(goal => (
              <div key={goal.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={goal.achieved ? 'green' : 'gray'} className="text-xs">
                      {goal.achieved ? 'Lograda' : 'No lograda'}
                    </Badge>
                    <Badge variant="indigo" className="text-xs">{PERIOD_LABELS[goal.period_type]}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(goal.period_start)} – {formatDate(goal.period_end)}
                  </p>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatCurrency(goal.actual_revenue)} / {formatCurrency(goal.target_revenue)}
                    </span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {goal.revenue_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1.5 max-w-xs">
                    <ProgressBar pct={goal.revenue_pct} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(goal)}
                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors touch-manipulation">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(goal.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors touch-manipulation">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }}
        title={editing ? 'Editar Meta' : 'Nueva Meta'} size="lg">
        <GoalForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(null); }}
          saving={saving}
        />
      </Modal>
    </div>
  );
}
