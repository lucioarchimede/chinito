const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/goals/current - meta del período actual con progreso
router.get('/current', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const goalRes = await db.query(
      `SELECT * FROM goals WHERE period_start <= $1 AND period_end >= $1 ORDER BY created_at DESC LIMIT 1`,
      [today]
    );
    if (!goalRes.rows.length) return res.json(null);
    const goal = goalRes.rows[0];

    const start = goal.period_start.toISOString ? goal.period_start.toISOString().split('T')[0] : String(goal.period_start).split('T')[0];
    const end = goal.period_end.toISOString ? goal.period_end.toISOString().split('T')[0] : String(goal.period_end).split('T')[0];

    const [revenueRes, ordersRes, clientsRes] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(final_revenue),0) as revenue FROM sales WHERE sale_date >= $1 AND sale_date <= $2`, [start, end]),
      db.query(`SELECT COUNT(*) as orders FROM sales WHERE sale_date >= $1 AND sale_date <= $2`, [start, end]),
      db.query(`SELECT COUNT(DISTINCT customer_email) as new_clients FROM sales WHERE sale_date >= $1 AND sale_date <= $2 AND customer_email IS NOT NULL AND is_repeat_customer = false`, [start, end]),
    ]);

    const actualRevenue = parseFloat(revenueRes.rows[0].revenue);
    const actualOrders = parseInt(ordersRes.rows[0].orders);
    const actualNewClients = parseInt(clientsRes.rows[0].new_clients);

    const now = new Date();
    const periodEnd = new Date(end);
    const periodStart = new Date(start);
    const totalDays = Math.ceil((periodEnd - periodStart) / 86400000) + 1;
    const daysElapsed = Math.max(1, Math.ceil((now - periodStart) / 86400000));
    const daysRemaining = Math.max(0, Math.ceil((periodEnd - now) / 86400000));

    const dailyRate = daysElapsed > 0 ? actualRevenue / daysElapsed : 0;
    const projectedRevenue = dailyRate * totalDays;

    res.json({
      goal,
      progress: {
        actual_revenue: actualRevenue,
        actual_orders: actualOrders,
        actual_new_clients: actualNewClients,
        revenue_pct: goal.target_revenue > 0 ? Math.min(100, (actualRevenue / parseFloat(goal.target_revenue)) * 100) : 0,
        orders_pct: goal.target_orders > 0 ? Math.min(100, (actualOrders / goal.target_orders) * 100) : null,
        clients_pct: goal.target_new_customers > 0 ? Math.min(100, (actualNewClients / goal.target_new_customers) * 100) : null,
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
        total_days: totalDays,
        projected_revenue: projectedRevenue,
        will_reach: projectedRevenue >= parseFloat(goal.target_revenue),
      }
    });
  } catch (err) {
    console.error('[goals/current]', err);
    res.status(500).json({ error: 'Error al obtener meta actual' });
  }
});

// GET /api/goals - listar metas con progreso histórico
router.get('/', async (req, res) => {
  try {
    const goalsRes = await db.query(`SELECT * FROM goals ORDER BY period_start DESC`);
    const goals = await Promise.all(goalsRes.rows.map(async (goal) => {
      const start = String(goal.period_start).split('T')[0];
      const end = String(goal.period_end).split('T')[0];
      const revenueRes = await db.query(
        `SELECT COALESCE(SUM(final_revenue),0) as revenue, COUNT(*) as orders FROM sales WHERE sale_date >= $1 AND sale_date <= $2`,
        [start, end]
      );
      const actual_revenue = parseFloat(revenueRes.rows[0].revenue);
      const actual_orders = parseInt(revenueRes.rows[0].orders);
      const revenue_pct = goal.target_revenue > 0 ? (actual_revenue / parseFloat(goal.target_revenue)) * 100 : 0;
      return { ...goal, actual_revenue, actual_orders, revenue_pct, achieved: revenue_pct >= 100 };
    }));
    res.json(goals);
  } catch (err) {
    console.error('[goals/GET]', err);
    res.status(500).json({ error: 'Error al obtener metas' });
  }
});

// GET /api/goals/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM goals WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Meta no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[goals/GET/:id]', err);
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/goals
router.post('/', async (req, res) => {
  try {
    const { period_type, period_start, period_end, target_revenue, target_orders, target_new_customers, target_margin_percentage, notes } = req.body;
    if (!period_type || !period_start || !period_end || !target_revenue) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const result = await db.query(
      `INSERT INTO goals (period_type, period_start, period_end, target_revenue, target_orders, target_new_customers, target_margin_percentage, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [period_type, period_start, period_end, target_revenue, target_orders || null, target_new_customers || null, target_margin_percentage || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[goals/POST]', err);
    res.status(500).json({ error: 'Error al crear meta' });
  }
});

// PUT /api/goals/:id
router.put('/:id', async (req, res) => {
  try {
    const { period_type, period_start, period_end, target_revenue, target_orders, target_new_customers, target_margin_percentage, notes } = req.body;
    const result = await db.query(
      `UPDATE goals SET period_type=$1, period_start=$2, period_end=$3, target_revenue=$4,
       target_orders=$5, target_new_customers=$6, target_margin_percentage=$7, notes=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [period_type, period_start, period_end, target_revenue, target_orders || null, target_new_customers || null, target_margin_percentage || null, notes || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Meta no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[goals/PUT]', err);
    res.status(500).json({ error: 'Error al actualizar meta' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM goals WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[goals/DELETE]', err);
    res.status(500).json({ error: 'Error al eliminar meta' });
  }
});

module.exports = router;
