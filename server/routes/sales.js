const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const computeSaleFields = (data) => {
  const quantity = parseInt(data.quantity) || 0;
  const unit_price = parseFloat(data.unit_price) || 0;
  const discount = parseFloat(data.discount) || 0;
  const mp_commission = parseFloat(data.mp_commission) || 0;
  const mp_tax = parseFloat(data.mp_tax) || 0;
  const shipping_cost = parseFloat(data.shipping_cost) || 0;
  const gross_sales = quantity * unit_price;
  const net_sales = gross_sales - discount;
  const final_revenue = net_sales - mp_commission - mp_tax - shipping_cost;
  return { quantity, unit_price, discount, mp_commission, mp_tax, shipping_cost, gross_sales, net_sales, final_revenue };
};

// GET /api/sales
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, channel, payment_method, limit = 100, offset = 0 } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (start_date) { conditions.push(`s.sale_date >= $${idx++}`); params.push(start_date); }
    if (end_date) { conditions.push(`s.sale_date <= $${idx++}`); params.push(end_date); }
    if (channel) { conditions.push(`s.sale_channel = $${idx++}`); params.push(channel); }
    if (payment_method) { conditions.push(`s.payment_method = $${idx++}`); params.push(payment_method); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT s.*, p.nombre as product_nombre, p.sku as product_sku
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       ${where}
       ORDER BY s.sale_date DESC, s.id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    const countResult = await db.query(`SELECT COUNT(*) FROM sales s ${where}`, params);
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('[sales/GET]', err);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// GET /api/sales/summary
router.get('/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const params = [];
    let idx = 1;
    let where = 'WHERE 1=1';
    if (start_date) { where += ` AND sale_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { where += ` AND sale_date <= $${idx++}`; params.push(end_date); }

    const result = await db.query(
      `SELECT
        COUNT(*) as total_sales,
        COALESCE(SUM(final_revenue), 0) as total_revenue,
        COALESCE(AVG(final_revenue), 0) as avg_ticket,
        COALESCE(SUM(discount), 0) as total_discounts,
        COALESCE(SUM(quantity), 0) as total_units
       FROM sales ${where}`,
      params
    );
    const channelResult = await db.query(
      `SELECT sale_channel, COUNT(*) as count, COALESCE(SUM(final_revenue), 0) as revenue
       FROM sales ${where} AND sale_channel IS NOT NULL
       GROUP BY sale_channel ORDER BY revenue DESC`,
      params
    );
    res.json({ ...result.rows[0], channels: channelResult.rows });
  } catch (err) {
    console.error('[sales/summary]', err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// GET /api/sales/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, p.nombre as product_nombre, p.sku as product_sku
       FROM sales s LEFT JOIN products p ON s.product_id = p.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener venta' });
  }
});

// POST /api/sales
router.post('/', async (req, res) => {
  try {
    const { sale_date, product_id, customer_name, customer_email, customer_phone,
            is_repeat_customer, sale_channel, payment_method, notes } = req.body;

    if (!sale_date || !req.body.quantity || !req.body.unit_price) {
      return res.status(400).json({ error: 'Fecha, cantidad y precio son requeridos' });
    }

    const f = computeSaleFields(req.body);

    const result = await db.query(
      `INSERT INTO sales (sale_date, product_id, quantity, unit_price, gross_sales, discount, net_sales,
        mp_commission, mp_tax, shipping_cost, final_revenue, customer_name, customer_email, customer_phone,
        is_repeat_customer, sale_channel, payment_method, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [sale_date, product_id || null, f.quantity, f.unit_price, f.gross_sales, f.discount, f.net_sales,
       f.mp_commission, f.mp_tax, f.shipping_cost, f.final_revenue, customer_name || null,
       customer_email || null, customer_phone || null, is_repeat_customer || false,
       sale_channel || null, payment_method || null, notes || null]
    );

    if (product_id && f.quantity > 0) {
      await db.query(
        `UPDATE products SET stock_actual = stock_actual - $1, updated_at = NOW() WHERE id = $2`,
        [f.quantity, product_id]
      );
      await db.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, reference_id, movement_date)
         VALUES ($1, 'salida', $2, 'Venta', $3, $4)`,
        [product_id, f.quantity, result.rows[0].id, sale_date]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[sales/POST]', err);
    res.status(500).json({ error: 'Error al crear venta' });
  }
});

// PUT /api/sales/:id
router.put('/:id', async (req, res) => {
  try {
    const { sale_date, product_id, customer_name, customer_email, customer_phone,
            is_repeat_customer, sale_channel, payment_method, notes } = req.body;

    const f = computeSaleFields(req.body);

    const result = await db.query(
      `UPDATE sales SET sale_date=$1, product_id=$2, quantity=$3, unit_price=$4, gross_sales=$5,
        discount=$6, net_sales=$7, mp_commission=$8, mp_tax=$9, shipping_cost=$10, final_revenue=$11,
        customer_name=$12, customer_email=$13, customer_phone=$14, is_repeat_customer=$15,
        sale_channel=$16, payment_method=$17, notes=$18
       WHERE id=$19 RETURNING *`,
      [sale_date, product_id || null, f.quantity, f.unit_price, f.gross_sales, f.discount, f.net_sales,
       f.mp_commission, f.mp_tax, f.shipping_cost, f.final_revenue, customer_name || null,
       customer_email || null, customer_phone || null, is_repeat_customer || false,
       sale_channel || null, payment_method || null, notes || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[sales/PUT]', err);
    res.status(500).json({ error: 'Error al actualizar venta' });
  }
});

// DELETE /api/sales/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM sales WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json({ message: 'Venta eliminada' });
  } catch (err) {
    console.error('[sales/DELETE]', err);
    res.status(500).json({ error: 'Error al eliminar venta' });
  }
});

module.exports = router;
