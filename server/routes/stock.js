const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/stock/levels
router.get('/levels', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, sku, nombre, categoria, stock_actual, stock_minimo, precio_costo, precio_venta,
        (stock_actual <= stock_minimo) as bajo_minimo,
        (stock_actual * precio_costo) as valor_stock_costo,
        (stock_actual * precio_venta) as valor_stock_venta
       FROM products WHERE active = true ORDER BY bajo_minimo DESC, nombre ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[stock/levels]', err);
    res.status(500).json({ error: 'Error al obtener niveles de stock' });
  }
});

// GET /api/stock/alerts
router.get('/alerts', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, sku, nombre, categoria, stock_actual, stock_minimo,
        (stock_minimo - stock_actual) as deficit
       FROM products
       WHERE stock_actual <= stock_minimo AND active = true
       ORDER BY deficit DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/stock
router.get('/', async (req, res) => {
  try {
    const { product_id, movement_type, start_date, end_date, limit = 100, offset = 0 } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (product_id) { conditions.push(`sm.product_id = $${idx++}`); params.push(product_id); }
    if (movement_type) { conditions.push(`sm.movement_type = $${idx++}`); params.push(movement_type); }
    if (start_date) { conditions.push(`sm.movement_date >= $${idx++}`); params.push(start_date); }
    if (end_date) { conditions.push(`sm.movement_date <= $${idx++}`); params.push(end_date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT sm.*, p.nombre as product_nombre, p.sku as product_sku
       FROM stock_movements sm
       LEFT JOIN products p ON sm.product_id = p.id
       ${where}
       ORDER BY sm.movement_date DESC, sm.id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    const countResult = await db.query(`SELECT COUNT(*) FROM stock_movements sm ${where}`, params);
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('[stock/GET]', err);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

// POST /api/stock
router.post('/', async (req, res) => {
  try {
    const { product_id, movement_type, quantity, reason, reference_id, notes, movement_date } = req.body;

    if (!product_id || !movement_type || !quantity || !movement_date) {
      return res.status(400).json({ error: 'Producto, tipo, cantidad y fecha son requeridos' });
    }
    if (!['entrada', 'salida', 'ajuste'].includes(movement_type)) {
      return res.status(400).json({ error: 'Tipo de movimiento inválido' });
    }

    const result = await db.query(
      `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, reference_id, notes, movement_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [product_id, movement_type, quantity, reason || null, reference_id || null, notes || null, movement_date]
    );

    const delta = movement_type === 'entrada' ? quantity : movement_type === 'salida' ? -quantity : quantity;
    await db.query(
      `UPDATE products SET stock_actual = stock_actual + $1, updated_at = NOW() WHERE id = $2`,
      [delta, product_id]
    );

    const product = await db.query('SELECT nombre, sku, stock_actual FROM products WHERE id = $1', [product_id]);
    res.status(201).json({ ...result.rows[0], product: product.rows[0] });
  } catch (err) {
    console.error('[stock/POST]', err);
    res.status(500).json({ error: 'Error al crear movimiento' });
  }
});

// PUT /api/stock/:id
router.put('/:id', async (req, res) => {
  try {
    const { movement_type, quantity, reason, notes, movement_date } = req.body;
    const result = await db.query(
      `UPDATE stock_movements SET movement_type=$1, quantity=$2, reason=$3, notes=$4, movement_date=$5
       WHERE id=$6 RETURNING *`,
      [movement_type, quantity, reason || null, notes || null, movement_date, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar movimiento' });
  }
});

// DELETE /api/stock/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM stock_movements WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json({ message: 'Movimiento eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar movimiento' });
  }
});

module.exports = router;
