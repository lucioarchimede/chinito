const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/clients
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, limit = 50, offset = 0 } = req.query;
    let where = 'WHERE customer_email IS NOT NULL';
    const params = [];
    let idx = 1;
    if (start_date) { where += ` AND sale_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { where += ` AND sale_date <= $${idx++}`; params.push(end_date); }

    const result = await db.query(
      `SELECT
        customer_email as email,
        MAX(customer_name) as nombre,
        MAX(customer_phone) as telefono,
        COUNT(*) as total_pedidos,
        COALESCE(SUM(final_revenue), 0) as total_revenue,
        COALESCE(AVG(final_revenue), 0) as ticket_promedio,
        MAX(sale_date) as ultima_compra,
        MIN(sale_date) as primera_compra,
        BOOL_OR(is_repeat_customer) as is_repeat,
        MAX(sale_channel) as canal_preferido
       FROM sales ${where}
       GROUP BY customer_email
       ORDER BY total_revenue DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    const countResult = await db.query(
      `SELECT COUNT(DISTINCT customer_email) FROM sales ${where}`,
      params
    );
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('[clients/GET]', err);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// GET /api/clients/stats
router.get('/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = 'WHERE customer_email IS NOT NULL';
    const params = [];
    let idx = 1;
    if (start_date) { where += ` AND sale_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { where += ` AND sale_date <= $${idx++}`; params.push(end_date); }

    const result = await db.query(
      `SELECT
        COUNT(DISTINCT customer_email) as total_clientes,
        COUNT(DISTINCT customer_email) FILTER (WHERE is_repeat_customer = true) as clientes_recurrentes,
        COUNT(DISTINCT customer_email) FILTER (WHERE is_repeat_customer = false) as clientes_nuevos,
        COALESCE(AVG(sub.revenue_por_cliente), 0) as clv_promedio,
        COALESCE(SUM(sub.revenue_por_cliente), 0) as clv_total
       FROM sales s
       JOIN (
         SELECT customer_email, SUM(final_revenue) as revenue_por_cliente
         FROM sales ${where} GROUP BY customer_email
       ) sub ON s.customer_email = sub.customer_email
       ${where}`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[clients/stats]', err);
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/clients/:email
router.get('/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const [profile, purchases] = await Promise.all([
      db.query(
        `SELECT customer_email as email, MAX(customer_name) as nombre, MAX(customer_phone) as telefono,
          COUNT(*) as total_pedidos, COALESCE(SUM(final_revenue), 0) as total_revenue,
          COALESCE(AVG(final_revenue), 0) as ticket_promedio,
          MAX(sale_date) as ultima_compra, MIN(sale_date) as primera_compra
         FROM sales WHERE customer_email = $1 GROUP BY customer_email`,
        [email]
      ),
      db.query(
        `SELECT s.*, p.nombre as product_nombre, p.sku
         FROM sales s LEFT JOIN products p ON s.product_id = p.id
         WHERE s.customer_email = $1 ORDER BY s.sale_date DESC`,
        [email]
      )
    ]);
    if (profile.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ profile: profile.rows[0], purchases: purchases.rows });
  } catch (err) {
    console.error('[clients/email]', err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

module.exports = router;
