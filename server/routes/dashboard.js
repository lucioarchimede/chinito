const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const defaultDates = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
  const end = now.toISOString().split('T')[0];
  return { start, end };
};

// GET /api/dashboard - 51 métricas completas
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const def = defaultDates();
    const start = start_date || def.start;
    const end = end_date || def.end;

    const [salesM, cogsM, expensesM, channelsM, clientsM, stockM, cashM, marketingM] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int as total_sales,
          COALESCE(SUM(gross_sales), 0) as total_gross_sales,
          COALESCE(SUM(discount), 0) as total_discounts,
          COALESCE(SUM(net_sales), 0) as total_net_sales,
          COALESCE(SUM(mp_commission + mp_tax), 0) as total_commissions,
          COALESCE(SUM(shipping_cost), 0) as total_shipping,
          COALESCE(SUM(final_revenue), 0) as total_revenue,
          COALESCE(AVG(final_revenue), 0) as avg_ticket,
          COALESCE(SUM(quantity), 0)::int as total_units_sold
        FROM sales WHERE sale_date BETWEEN $1 AND $2
      `, [start, end]),

      db.query(`
        SELECT COALESCE(SUM(s.quantity * COALESCE(p.precio_costo, 0)), 0) as total_cogs
        FROM sales s LEFT JOIN products p ON s.product_id = p.id
        WHERE s.sale_date BETWEEN $1 AND $2
      `, [start, end]),

      db.query(`
        SELECT category, COALESCE(SUM(amount), 0) as total
        FROM expenses WHERE expense_date BETWEEN $1 AND $2
        GROUP BY category
      `, [start, end]),

      db.query(`
        SELECT sale_channel, COUNT(*)::int as count, COALESCE(SUM(final_revenue), 0) as revenue
        FROM sales WHERE sale_date BETWEEN $1 AND $2 AND sale_channel IS NOT NULL
        GROUP BY sale_channel ORDER BY revenue DESC
      `, [start, end]),

      db.query(`
        SELECT
          COUNT(DISTINCT customer_email) FILTER (WHERE customer_email IS NOT NULL)::int as total_clients,
          COUNT(DISTINCT customer_email) FILTER (WHERE customer_email IS NOT NULL AND is_repeat_customer = true)::int as repeat_clients,
          COUNT(DISTINCT customer_email) FILTER (WHERE customer_email IS NOT NULL AND is_repeat_customer = false)::int as new_clients
        FROM sales WHERE sale_date BETWEEN $1 AND $2
      `, [start, end]),

      db.query(`
        SELECT
          COUNT(*)::int as total_skus,
          COALESCE(SUM(stock_actual * precio_costo), 0) as stock_value_cost,
          COALESCE(SUM(stock_actual * precio_venta), 0) as stock_value_sale,
          COUNT(*) FILTER (WHERE stock_actual <= stock_minimo)::int as low_stock_count,
          COUNT(*) FILTER (WHERE stock_actual = 0)::int as zero_stock_count
        FROM products WHERE active = true
      `),

      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type='ingreso' AND is_projected=false THEN amount ELSE 0 END), 0) as ingresos_reales,
          COALESCE(SUM(CASE WHEN type='egreso' AND is_projected=false THEN amount ELSE 0 END), 0) as egresos_reales,
          COALESCE(SUM(CASE WHEN type='ingreso' THEN amount ELSE 0 END), 0) as total_ingresos,
          COALESCE(SUM(CASE WHEN type='egreso' THEN amount ELSE 0 END), 0) as total_egresos
        FROM cash_flow WHERE flow_date BETWEEN $1 AND $2
      `, [start, end]),

      db.query(`
        SELECT
          COALESCE(SUM(spend), 0) as total_spend,
          COALESCE(SUM(revenue), 0) as marketing_revenue,
          COALESCE(SUM(conversions), 0)::int as total_conversions,
          COALESCE(SUM(impressions), 0)::int as total_impressions,
          COALESCE(SUM(clicks), 0)::int as total_clicks,
          COALESCE(AVG(NULLIF(roas, 0)), 0) as avg_roas,
          COALESCE(AVG(NULLIF(ctr, 0)), 0) as avg_ctr,
          COALESCE(AVG(NULLIF(cpc, 0)), 0) as avg_cpc
        FROM marketing_metrics WHERE metric_date BETWEEN $1 AND $2
      `, [start, end])
    ]);

    const s = salesM.rows[0];
    const cogs = parseFloat(cogsM.rows[0].total_cogs);
    const expenses = expensesM.rows;
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.total), 0);
    const revenue = parseFloat(s.total_revenue);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - totalExpenses;
    const clients = clientsM.rows[0];
    const totalClients = clients.total_clients;
    const repeatClients = clients.repeat_clients;
    const newClients = clients.new_clients;
    const stock = stockM.rows[0];
    const stockCost = parseFloat(stock.stock_value_cost);
    const cash = cashM.rows[0];
    const mkt = marketingM.rows[0];
    const mktSpend = parseFloat(mkt.total_spend);
    const mktRevenue = parseFloat(mkt.marketing_revenue);

    // Período en meses para burn rate
    const startD = new Date(start);
    const endD = new Date(end);
    const months = Math.max(1, (endD - startD) / (1000 * 60 * 60 * 24 * 30));

    const metrics = {
      period: { start, end },

      // 1. Resumen ejecutivo (7 métricas)
      executive: {
        total_revenue: revenue,
        cogs: cogs,
        gross_profit: grossProfit,
        gross_margin_pct: revenue > 0 ? (grossProfit / revenue * 100) : 0,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        net_margin_pct: revenue > 0 ? (netProfit / revenue * 100) : 0,
      },

      // 2. Ventas (12 métricas)
      sales: {
        total_sales: s.total_sales,
        total_gross_sales: parseFloat(s.total_gross_sales),
        total_discounts: parseFloat(s.total_discounts),
        total_net_sales: parseFloat(s.total_net_sales),
        total_commissions: parseFloat(s.total_commissions),
        total_shipping: parseFloat(s.total_shipping),
        total_revenue: revenue,
        total_units_sold: s.total_units_sold,
        avg_ticket: parseFloat(s.avg_ticket),
        channels: channelsM.rows,
        top_channel: channelsM.rows[0]?.sale_channel || 'N/A',
        discount_rate_pct: parseFloat(s.total_gross_sales) > 0
          ? (parseFloat(s.total_discounts) / parseFloat(s.total_gross_sales) * 100) : 0,
      },

      // 3. Inventario (8 métricas)
      inventory: {
        total_skus: stock.total_skus,
        stock_value_cost: stockCost,
        stock_value_sale: parseFloat(stock.stock_value_sale),
        potential_margin: parseFloat(stock.stock_value_sale) - stockCost,
        low_stock_count: stock.low_stock_count,
        zero_stock_count: stock.zero_stock_count,
        inventory_turnover: stockCost > 0 ? (cogs / stockCost) : 0,
        days_of_inventory: cogs > 0 ? (stockCost / (cogs / 30)) : 0,
      },

      // 4. Clientes (8 métricas)
      clients: {
        total_clients: totalClients,
        new_clients: newClients,
        repeat_clients: repeatClients,
        retention_rate_pct: totalClients > 0 ? (repeatClients / totalClients * 100) : 0,
        avg_clv: totalClients > 0 ? (revenue / totalClients) : 0,
        total_clv: revenue,
        purchase_frequency: totalClients > 0 ? (s.total_sales / totalClients) : 0,
        avg_ticket_per_client: totalClients > 0 ? (revenue / totalClients) : 0,
      },

      // 5. Cash Flow (6 métricas)
      cash_flow: {
        ingresos_reales: parseFloat(cash.ingresos_reales),
        egresos_reales: parseFloat(cash.egresos_reales),
        balance_real: parseFloat(cash.ingresos_reales) - parseFloat(cash.egresos_reales),
        total_ingresos: parseFloat(cash.total_ingresos),
        total_egresos: parseFloat(cash.total_egresos),
        burn_rate_mensual: totalExpenses / months,
      },

      // 6. Marketing (8 métricas)
      marketing: {
        total_spend: mktSpend,
        marketing_revenue: mktRevenue,
        roi_pct: mktSpend > 0 ? ((mktRevenue - mktSpend) / mktSpend * 100) : 0,
        avg_roas: parseFloat(mkt.avg_roas),
        cac: newClients > 0 ? (mktSpend / newClients) : 0,
        total_conversions: mkt.total_conversions,
        avg_ctr_pct: parseFloat(mkt.avg_ctr) * 100,
        avg_cpc: parseFloat(mkt.avg_cpc),
      },

      // 7. KPIs Financieros (2 métricas clave + desglose)
      financial_kpis: {
        roi_total_pct: (cogs + totalExpenses) > 0 ? (netProfit / (cogs + totalExpenses) * 100) : 0,
        break_even: revenue > 0 && cogs < revenue
          ? (totalExpenses / (1 - cogs / revenue)) : 0,
      },

      expenses_by_category: expenses,
    };

    res.json(metrics);
  } catch (err) {
    console.error('[dashboard]', err);
    res.status(500).json({ error: 'Error al calcular métricas del dashboard' });
  }
});

// GET /api/dashboard/chart - datos para gráfico de revenue
router.get('/chart', async (req, res) => {
  try {
    const { start_date, end_date, groupby = 'day' } = req.query;
    const def = defaultDates();
    const start = start_date || def.start;
    const end = end_date || def.end;

    const fmt = groupby === 'month' ? 'YYYY-MM' : groupby === 'week' ? 'IYYY-IW' : 'YYYY-MM-DD';
    const result = await db.query(
      `SELECT
        TO_CHAR(sale_date, '${fmt}') as period,
        COALESCE(SUM(final_revenue), 0) as revenue,
        COUNT(*)::int as sales_count
       FROM sales WHERE sale_date BETWEEN $1 AND $2
       GROUP BY period ORDER BY period`,
      [start, end]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[dashboard/chart]', err);
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/dashboard/top-products
router.get('/top-products', async (req, res) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;
    const def = defaultDates();
    const start = start_date || def.start;
    const end = end_date || def.end;

    const result = await db.query(
      `SELECT p.id, p.nombre, p.sku, p.categoria,
        COALESCE(SUM(s.quantity), 0)::int as units_sold,
        COALESCE(SUM(s.final_revenue), 0) as revenue,
        COUNT(s.id)::int as order_count
       FROM products p
       LEFT JOIN sales s ON p.id = s.product_id AND s.sale_date BETWEEN $1 AND $2
       GROUP BY p.id, p.nombre, p.sku, p.categoria
       ORDER BY revenue DESC LIMIT $3`,
      [start, end, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[dashboard/top-products]', err);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
