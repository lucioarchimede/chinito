const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Normalize a fixed cost to monthly amount
function toMonthly(amount, frequency) {
  if (frequency === 'monthly') return parseFloat(amount);
  if (frequency === 'quarterly') return parseFloat(amount) / 3;
  if (frequency === 'yearly') return parseFloat(amount) / 12;
  return parseFloat(amount);
}

// GET /api/breakeven/fixed-costs
router.get('/fixed-costs', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM fixed_costs ORDER BY category ASC, name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[breakeven/fixed-costs/GET]', err);
    res.status(500).json({ error: 'Error al obtener costos fijos' });
  }
});

// POST /api/breakeven/fixed-costs
router.post('/fixed-costs', async (req, res) => {
  try {
    const { name, amount, frequency, category, is_active, start_date, notes } = req.body;
    if (!name || !amount || !frequency) {
      return res.status(400).json({ error: 'Nombre, monto y frecuencia son requeridos' });
    }
    const result = await db.query(
      `INSERT INTO fixed_costs (name, amount, frequency, category, is_active, start_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, amount, frequency, category || 'other', is_active !== false, start_date || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[breakeven/fixed-costs/POST]', err);
    res.status(500).json({ error: 'Error al crear costo fijo' });
  }
});

// PUT /api/breakeven/fixed-costs/:id
router.put('/fixed-costs/:id', async (req, res) => {
  try {
    const { name, amount, frequency, category, is_active, start_date, notes } = req.body;
    const result = await db.query(
      `UPDATE fixed_costs SET name=$1, amount=$2, frequency=$3, category=$4,
       is_active=$5, start_date=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, amount, frequency, category || 'other', is_active !== false, start_date || null, notes || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Costo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[breakeven/fixed-costs/PUT]', err);
    res.status(500).json({ error: 'Error al actualizar costo fijo' });
  }
});

// DELETE /api/breakeven/fixed-costs/:id
router.delete('/fixed-costs/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM fixed_costs WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[breakeven/fixed-costs/DELETE]', err);
    res.status(500).json({ error: 'Error al eliminar costo fijo' });
  }
});

// GET /api/breakeven/analysis
router.get('/analysis', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const [costsRes, salesRes] = await Promise.all([
      db.query(`SELECT * FROM fixed_costs WHERE is_active = true`),
      db.query(
        `SELECT
           COALESCE(SUM(s.final_revenue), 0) as revenue,
           COALESCE(SUM(s.quantity), 0) as units,
           COALESCE(AVG(s.final_revenue), 0) as avg_ticket,
           COALESCE(SUM(s.final_revenue - s.quantity * COALESCE(p.precio_costo, 0)), 0) as gross_profit,
           COUNT(*) as orders
         FROM sales s
         LEFT JOIN products p ON s.product_id = p.id
         WHERE s.sale_date >= $1 AND s.sale_date <= $2`,
        [monthStart, today]
      ),
    ]);

    const fixedCosts = costsRes.rows;
    const monthlyFixedCosts = fixedCosts.reduce((sum, fc) => sum + toMonthly(fc.amount, fc.frequency), 0);

    const s = salesRes.rows[0];
    const currentRevenue = parseFloat(s.revenue);
    const currentUnits = parseInt(s.units);
    const currentOrders = parseInt(s.orders);
    const avgTicket = parseFloat(s.avg_ticket);
    const grossProfit = parseFloat(s.gross_profit);

    const contributionMarginPerSale = currentOrders > 0 ? grossProfit / currentOrders : 0;
    const breakEvenOrders = contributionMarginPerSale > 0
      ? Math.ceil(monthlyFixedCosts / contributionMarginPerSale)
      : null;
    const breakEvenRevenue = breakEvenOrders !== null ? breakEvenOrders * avgTicket : null;

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = Math.max(1, now.getDate());
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
    const dailyRevenue = currentRevenue / daysElapsed;
    const projectedRevenue = dailyRevenue * daysInMonth;

    const pctToBreakEven = breakEvenRevenue > 0
      ? Math.min(100, (currentRevenue / breakEvenRevenue) * 100)
      : 100;

    // Sensitivity analysis
    const sensitivity = [];
    if (breakEvenRevenue !== null) {
      for (const reduction of [5, 10, 15, 20]) {
        const newFixed = monthlyFixedCosts * (1 - reduction / 100);
        const newBE = contributionMarginPerSale > 0 ? Math.ceil(newFixed / contributionMarginPerSale) * avgTicket : null;
        sensitivity.push({ scenario: `Costos -${reduction}%`, break_even_revenue: newBE });
      }
      for (const increase of [5, 10, 15]) {
        const newMargin = contributionMarginPerSale * (1 + increase / 100);
        const newBE = newMargin > 0 ? Math.ceil(monthlyFixedCosts / newMargin) * avgTicket : null;
        sensitivity.push({ scenario: `Margen +${increase}%`, break_even_revenue: newBE });
      }
    }

    // Group by category
    const byCategory = {};
    fixedCosts.forEach(fc => {
      const cat = fc.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = 0;
      byCategory[cat] += toMonthly(fc.amount, fc.frequency);
    });

    res.json({
      period: { start: monthStart, end: monthEnd, days_elapsed: daysElapsed, days_remaining: daysRemaining, days_in_month: daysInMonth },
      fixed_costs: {
        total_monthly: monthlyFixedCosts,
        items: fixedCosts,
        by_category: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
      },
      sales: {
        current_revenue: currentRevenue,
        current_orders: currentOrders,
        current_units: currentUnits,
        avg_ticket: avgTicket,
        contribution_margin_per_order: contributionMarginPerSale,
        daily_revenue: dailyRevenue,
        projected_revenue: projectedRevenue,
      },
      break_even: {
        orders_needed: breakEvenOrders,
        revenue_needed: breakEvenRevenue,
        pct_reached: pctToBreakEven,
        will_reach: projectedRevenue >= (breakEvenRevenue || 0),
        gap: breakEvenRevenue !== null ? Math.max(0, breakEvenRevenue - currentRevenue) : 0,
      },
      sensitivity,
    });
  } catch (err) {
    console.error('[breakeven/analysis]', err);
    res.status(500).json({ error: 'Error al calcular análisis de break-even' });
  }
});

module.exports = router;
