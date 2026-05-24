const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { q, categoria, proveedor, active, limit = 100, offset = 0 } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (q) {
      conditions.push(`(nombre ILIKE $${idx} OR sku ILIKE $${idx} OR descripcion ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }
    if (categoria) { conditions.push(`categoria = $${idx++}`); params.push(categoria); }
    if (proveedor) { conditions.push(`proveedor ILIKE $${idx++}`); params.push(`%${proveedor}%`); }
    if (active !== undefined) { conditions.push(`active = $${idx++}`); params.push(active === 'true'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT *,
        CASE WHEN precio_venta > 0 THEN ROUND(((precio_venta - precio_costo) / precio_venta * 100)::numeric, 2) ELSE 0 END as margen
       FROM products ${where}
       ORDER BY nombre ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    const countResult = await db.query(`SELECT COUNT(*) FROM products ${where}`, params);
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('[products/GET]', err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT categoria FROM products WHERE categoria IS NOT NULL ORDER BY categoria');
    res.json(result.rows.map(r => r.categoria));
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT *,
        CASE WHEN precio_venta > 0 THEN ROUND(((precio_venta - precio_costo) / precio_venta * 100)::numeric, 2) ELSE 0 END as margen
       FROM products WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[products/GET/:id]', err);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const {
      sku, nombre, descripcion, categoria, proveedor, aroma, variant,
      precio_costo, precio_venta, import_cost_per_unit, packaging_cost,
      stock_actual, stock_minimo, lot_number, expiry_date
    } = req.body;

    if (!sku || !nombre) return res.status(400).json({ error: 'SKU y nombre son requeridos' });

    const result = await db.query(
      `INSERT INTO products (sku, nombre, descripcion, categoria, proveedor, aroma, variant,
        precio_costo, precio_venta, import_cost_per_unit, packaging_cost,
        stock_actual, stock_minimo, lot_number, expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [sku, nombre, descripcion || null, categoria || null, proveedor || null, aroma || null, variant || null,
       precio_costo || 0, precio_venta || 0, import_cost_per_unit || 0, packaging_cost || 0,
       stock_actual || 0, stock_minimo || 0, lot_number || null, expiry_date || null]
    );

    if (stock_actual > 0) {
      await db.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, movement_date)
         VALUES ($1, 'entrada', $2, 'Stock inicial', CURRENT_DATE)`,
        [result.rows[0].id, stock_actual]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El SKU ya existe' });
    console.error('[products/POST]', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      sku, nombre, descripcion, categoria, proveedor, aroma, variant,
      precio_costo, precio_venta, import_cost_per_unit, packaging_cost,
      stock_actual, stock_minimo, lot_number, expiry_date, active
    } = req.body;

    const result = await db.query(
      `UPDATE products SET
        sku=$1, nombre=$2, descripcion=$3, categoria=$4, proveedor=$5, aroma=$6, variant=$7,
        precio_costo=$8, precio_venta=$9, import_cost_per_unit=$10, packaging_cost=$11,
        stock_actual=$12, stock_minimo=$13, lot_number=$14, expiry_date=$15, active=$16,
        updated_at=NOW()
       WHERE id=$17 RETURNING *`,
      [sku, nombre, descripcion || null, categoria || null, proveedor || null, aroma || null, variant || null,
       precio_costo || 0, precio_venta || 0, import_cost_per_unit || 0, packaging_cost || 0,
       stock_actual || 0, stock_minimo || 0, lot_number || null, expiry_date || null,
       active !== undefined ? active : true, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El SKU ya existe' });
    console.error('[products/PUT]', err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error('[products/DELETE]', err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
