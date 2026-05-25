import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, Users,
  Package, Megaphone, BarChart2, AlertTriangle, RefreshCw, Target, CheckCircle, XCircle
} from 'lucide-react';
import api from '../utils/api';
import { KpiCard } from '../components/ui/Card';
import { KpiSkeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatPercent, formatNumber, monthStart, today } from '../utils/formatters';
import { useChartTheme } from '../context/ThemeContext';

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const SectionTitle = ({ children }) => (
  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 mt-7 flex items-center gap-2.5">
    <span className="w-1 h-4 bg-indigo-600 rounded-full inline-block" />
    {children}
  </h2>
);

const DateInput = ({ label, value, onChange }) => (
  <div className="flex items-center gap-1.5">
    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">{label}</label>
    <input type="date" value={value} onChange={e => onChange(e.target.value)}
      className="text-sm border-0 focus:outline-none bg-transparent text-slate-700 dark:text-slate-300 min-w-0" />
  </div>
);

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [currentGoal, setCurrentGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = `?start_date=${startDate}&end_date=${endDate}`;
      const [metricsRes, chartRes, topRes, goalRes] = await Promise.all([
        api.get(`/dashboard${params}`),
        api.get(`/dashboard/chart${params}&groupby=day`),
        api.get(`/dashboard/top-products${params}&limit=8`),
        api.get('/goals/current').catch(() => ({ data: null })),
      ]);
      setMetrics(metricsRes.data);
      setChartData(chartRes.data);
      setTopProducts(topRes.data);
      setCurrentGoal(goalRes.data);
    } catch (err) {
      setError('Error al cargar métricas del dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">{error}</p>
          <button onClick={fetchData} className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline flex items-center gap-1.5 mx-auto">
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-card flex-wrap">
          <DateInput label="Desde" value={startDate} onChange={setStartDate} />
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
          <DateInput label="Hasta" value={endDate} onChange={setEndDate} />
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-2 rounded-xl font-medium transition-colors touch-manipulation">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="space-y-6">
          <KpiSkeleton count={4} />
          <KpiSkeleton count={4} />
        </div>
      ) : metrics ? <DashboardContent
          metrics={metrics}
          chartData={chartData}
          topProducts={topProducts}
          currentGoal={currentGoal}
        /> : null}
    </div>
  );
}

function GoalWidget({ goal }) {
  if (!goal) return null;
  const { progress, goal: g } = goal;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4 mb-4 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <Target size={15} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Meta del Período</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(g.target_revenue)}</p>
        </div>
      </div>
      <div className="flex-1 min-w-32">
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span>{formatCurrency(progress.actual_revenue)}</span>
          <span>{progress.revenue_pct.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all duration-700 ${progress.revenue_pct >= 100 ? 'bg-emerald-500' : progress.revenue_pct >= 70 ? 'bg-indigo-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(100, progress.revenue_pct)}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {progress.will_reach
          ? <><CheckCircle size={13} className="text-emerald-500" /><span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">En camino</span></>
          : <><XCircle size={13} className="text-red-500" /><span className="text-xs font-medium text-red-500 dark:text-red-400">En riesgo</span></>}
      </div>
      <a href="/metas" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap">Ver detalles →</a>
    </div>
  );
}

function DashboardContent({ metrics, chartData, topProducts, currentGoal }) {
  const { executive, sales, inventory, clients, cash_flow, marketing, financial_kpis, expenses_by_category } = metrics;
  const chart = useChartTheme();

  return (
    <div>
      <GoalWidget goal={currentGoal} />

      {/* === RESUMEN EJECUTIVO === */}
      <SectionTitle>Resumen Ejecutivo</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Revenue Total" value={formatCurrency(executive.total_revenue)}
          icon={DollarSign} color="indigo" />
        <KpiCard title="Ganancia Bruta" value={formatCurrency(executive.gross_profit)}
          subtitle={`Margen ${formatPercent(executive.gross_margin_pct)}`} icon={TrendingUp} color="green" />
        <KpiCard title="Ganancia Neta" value={formatCurrency(executive.net_profit)}
          subtitle={`Margen ${formatPercent(executive.net_margin_pct)}`}
          icon={executive.net_profit >= 0 ? TrendingUp : TrendingDown}
          color={executive.net_profit >= 0 ? 'green' : 'red'} />
        <KpiCard title="Gastos Totales" value={formatCurrency(executive.total_expenses)}
          subtitle={`COGS: ${formatCurrency(executive.cogs)}`} icon={TrendingDown} color="red" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Revenue por día</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={chart.gradientOpacity} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="period" tick={chart.tick} tickLine={false} />
                <YAxis tick={chart.tick} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={chart.tooltipStyle}
                  formatter={(v) => [formatCurrency(v), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5}
                  fill="url(#gradRevenue)" fillOpacity={1}
                  dot={false} activeDot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">Sin datos en este período</div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Revenue por Canal</h3>
          {sales.channels.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sales.channels} dataKey="revenue" nameKey="sale_channel"
                  cx="50%" cy="50%" outerRadius={70} innerRadius={30}
                  label={({ sale_channel, percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {sales.channels.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chart.tooltipStyle}
                  formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">Sin datos</div>
          )}
        </div>
      </div>

      {/* === VENTAS === */}
      <SectionTitle>Ventas</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Total Ventas" value={formatNumber(sales.total_sales)}
          subtitle={`${formatNumber(sales.total_units_sold)} unidades`} icon={ShoppingCart} color="blue" />
        <KpiCard title="Ticket Promedio" value={formatCurrency(sales.avg_ticket)} icon={DollarSign} color="indigo" />
        <KpiCard title="Descuentos" value={formatCurrency(sales.total_discounts)}
          subtitle={`${formatPercent(sales.discount_rate_pct)} de ventas brutas`} icon={TrendingDown} color="yellow" />
        <KpiCard title="Comisiones" value={formatCurrency(sales.total_commissions)}
          subtitle="MP + impuestos" icon={TrendingDown} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Top Productos por Revenue</h3>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProducts.slice(0, 6)} layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={chart.tick} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nombre" tick={{ ...chart.tick, fill: chart.tick.fill }} width={110}
                  tickFormatter={v => v.length > 15 ? v.slice(0, 15) + '…' : v} />
                <Tooltip contentStyle={chart.tooltipStyle}
                  formatter={(v) => [formatCurrency(v), 'Revenue']} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">Sin datos</div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Canales de Venta</h3>
          <div className="space-y-3.5">
            {sales.channels.map((ch, i) => (
              <div key={ch.sale_channel} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{ch.sale_channel}</span>
                    <span className="text-slate-400 ml-2 text-xs">{ch.count} ventas</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{
                      width: `${sales.total_revenue > 0 ? (ch.revenue / sales.total_revenue * 100) : 0}%`,
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length]
                    }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(ch.revenue)}</p>
                </div>
              </div>
            ))}
            {!sales.channels.length && <p className="text-slate-400 text-sm">Sin datos de canales</p>}
          </div>
        </div>
      </div>

      {/* === INVENTARIO === */}
      <SectionTitle>Inventario</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Total SKUs" value={formatNumber(inventory.total_skus)} icon={Package} color="blue" />
        <KpiCard title="Valor Stock (costo)" value={formatCurrency(inventory.stock_value_cost)} icon={DollarSign} color="indigo" />
        <KpiCard title="Valor Stock (venta)" value={formatCurrency(inventory.stock_value_sale)}
          subtitle={`Margen potencial: ${formatCurrency(inventory.potential_margin)}`} icon={TrendingUp} color="green" />
        <KpiCard title="Bajo Mínimo" value={formatNumber(inventory.low_stock_count)}
          subtitle={`${inventory.zero_stock_count} sin stock`}
          icon={AlertTriangle} color={inventory.low_stock_count > 0 ? 'red' : 'green'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3">
        <KpiCard title="Rotación Inventario" value={`${formatNumber(inventory.inventory_turnover, 2)}x`}
          subtitle="veces en el período" icon={RefreshCw} color="purple" />
        <KpiCard title="Días de Inventario" value={`${formatNumber(inventory.days_of_inventory, 0)} días`}
          icon={Package} color="gray" />
        <KpiCard title="Margen Potencial" value={formatCurrency(inventory.potential_margin)}
          subtitle="Venta - Costo de stock" icon={TrendingUp} color="green" />
        <KpiCard title="Sin Stock" value={`${formatNumber(inventory.zero_stock_count)} SKUs`}
          icon={AlertTriangle} color={inventory.zero_stock_count > 0 ? 'red' : 'green'} />
      </div>

      {/* === CLIENTES === */}
      <SectionTitle>Clientes</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Clientes Únicos" value={formatNumber(clients.total_clients)} icon={Users} color="blue" />
        <KpiCard title="Clientes Nuevos" value={formatNumber(clients.new_clients)} icon={Users} color="green" />
        <KpiCard title="Recurrentes" value={formatNumber(clients.repeat_clients)}
          subtitle={`Retención: ${formatPercent(clients.retention_rate_pct)}`} icon={RefreshCw} color="indigo" />
        <KpiCard title="CLV Promedio" value={formatCurrency(clients.avg_clv)} icon={DollarSign} color="purple" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3">
        <KpiCard title="Tasa de Retención" value={formatPercent(clients.retention_rate_pct)} icon={TrendingUp} color="indigo" />
        <KpiCard title="CLV Total" value={formatCurrency(clients.total_clv)} icon={DollarSign} color="green" />
        <KpiCard title="Frecuencia de Compra" value={`${formatNumber(clients.purchase_frequency, 1)} pedidos`}
          subtitle="por cliente" icon={ShoppingCart} color="blue" />
        <KpiCard title="Ticket / Cliente" value={formatCurrency(clients.avg_ticket_per_client)} icon={DollarSign} color="yellow" />
      </div>

      {/* === CASH FLOW === */}
      <SectionTitle>Cash Flow</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard title="Ingresos Reales" value={formatCurrency(cash_flow.ingresos_reales)} icon={TrendingUp} color="green" />
        <KpiCard title="Egresos Reales" value={formatCurrency(cash_flow.egresos_reales)} icon={TrendingDown} color="red" />
        <KpiCard title="Balance Real" value={formatCurrency(cash_flow.balance_real)}
          icon={cash_flow.balance_real >= 0 ? TrendingUp : TrendingDown}
          color={cash_flow.balance_real >= 0 ? 'green' : 'red'} />
        <KpiCard title="Burn Rate Mensual" value={formatCurrency(cash_flow.burn_rate_mensual)}
          subtitle="Gastos promedio/mes" icon={TrendingDown} color="orange" />
        <KpiCard title="Total Ingresos (c/proyectado)" value={formatCurrency(cash_flow.total_ingresos)} icon={TrendingUp} color="blue" />
        <KpiCard title="Balance Total" value={formatCurrency(cash_flow.total_ingresos - cash_flow.total_egresos)}
          icon={BarChart2} color={cash_flow.total_ingresos >= cash_flow.total_egresos ? 'green' : 'red'} />
      </div>

      {/* === MARKETING === */}
      <SectionTitle>Marketing</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard title="Gasto Marketing" value={formatCurrency(marketing.total_spend)} icon={Megaphone} color="purple" />
        <KpiCard title="Revenue Generado" value={formatCurrency(marketing.marketing_revenue)} icon={TrendingUp} color="green" />
        <KpiCard title="ROAS Promedio" value={`${formatNumber(marketing.avg_roas, 2)}x`} icon={TrendingUp} color="indigo" />
        <KpiCard title="ROI Marketing" value={formatPercent(marketing.roi_pct)}
          icon={marketing.roi_pct >= 0 ? TrendingUp : TrendingDown}
          color={marketing.roi_pct >= 0 ? 'green' : 'red'} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3">
        <KpiCard title="CAC" value={formatCurrency(marketing.cac)} subtitle="Costo adquisición cliente" icon={Users} color="orange" />
        <KpiCard title="Conversiones" value={formatNumber(marketing.total_conversions)} icon={ShoppingCart} color="blue" />
        <KpiCard title="CTR Promedio" value={formatPercent(marketing.avg_ctr_pct, 2)} icon={BarChart2} color="indigo" />
        <KpiCard title="CPC Promedio" value={formatCurrency(marketing.avg_cpc)} icon={DollarSign} color="yellow" />
      </div>

      {/* === KPIs FINANCIEROS === */}
      <SectionTitle>KPIs Financieros</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard title="ROI Total" value={formatPercent(financial_kpis.roi_total_pct, 1)}
          subtitle="Sobre costo total + gastos"
          icon={financial_kpis.roi_total_pct >= 0 ? TrendingUp : TrendingDown}
          color={financial_kpis.roi_total_pct >= 0 ? 'green' : 'red'} />
        <KpiCard title="Punto de Equilibrio" value={formatCurrency(financial_kpis.break_even)}
          subtitle="Revenue mínimo para cubrir gastos" icon={BarChart2} color="gray" />
        <KpiCard title="Margen Neto" value={formatPercent(executive.net_margin_pct)}
          subtitle={formatCurrency(executive.net_profit)} icon={DollarSign}
          color={executive.net_margin_pct >= 0 ? 'green' : 'red'} />
      </div>

      {/* Gastos por categoría */}
      {expenses_by_category.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Gastos por Categoría</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={expenses_by_category} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="category" tick={chart.tick} />
                <YAxis tick={chart.tick} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={chart.tooltipStyle}
                  formatter={(v) => [formatCurrency(v), 'Gasto']} />
                <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Distribución de Gastos</h3>
            <div className="space-y-3.5">
              {expenses_by_category.map((cat) => {
                const pct = executive.total_expenses > 0 ? (cat.total / executive.total_expenses * 100) : 0;
                return (
                  <div key={cat.category}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{cat.category.replace('_', ' ')}</span>
                      <span className="text-slate-400 text-xs">{formatCurrency(cat.total)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-red-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
