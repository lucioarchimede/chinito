const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/cash-flow
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, type, is_projected, limit = 100, offset = 0 } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (start_date) { conditions.push(`flow_date >= $${idx++}`); params.push(start_date); }
    if (end_date) { conditions.push(`flow_date <= $${idx++}`); params.push(end_date); }
    if (type) { conditions.push(`type = $${idx++}`); params.push(type); }
    if (is_projected !== undefined) { conditions.push(`is_projected = $${idx++}`); params.push(is_projected === 'true'); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT * FROM cash_flow ${where} ORDER BY flow_date DESC, id DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    const countResult = await db.query(`SELECT COUNT(*) FROM cash_flow ${where}`, params);
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('[cash_flow/GET]', err);
    res.status(500).json({ error: 'Error al obtener cash flow' });
  }
});

// GET /api/cash-flow/summary
router.get('/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (start_date) { where += ` AND flow_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { where += ` AND flow_date <= $${idx++}`; params.push(end_date); }

    const [summary, monthly] = await Promise.all([
      db.query(
        `SELECT
          COALESCE(SUM(CASE WHEN type='ingreso' THEN amount ELSE 0 END), 0) as total_ingresos,
          COALESCE(SUM(CASE WHEN type='egreso' THEN amount ELSE 0 END), 0) as total_egresos,
          COALESCE(SUM(CASE WHEN type='ingreso' AND is_projected=false THEN amount ELSE 0 END), 0) as ingresos_reales,
          COALESCE(SUM(CASE WHEN type='egreso' AND is_projected=false THEN amount ELSE 0 END), 0) as egresos_reales
         FROM cash_flow ${where}`,
        params
      ),
      db.query(
        `SELECT
          TO_CHAR(flow_date, 'YYYY-MM') as mes,
          COALESCE(SUM(CASE WHEN type='ingreso' THEN amount ELSE 0 END), 0) as ingresos,
          COALESCE(SUM(CASE WHEN type='egreso' THEN amount ELSE 0 END), 0) as egresos
         FROM cash_flow ${where}
         GROUP BY mes ORDER BY mes`,
        params
      )
    ]);

    const s = summary.rows[0];
    res.json({
      ...s,
      balance_real: parseFloat(s.ingresos_reales) - parseFloat(s.egresos_reales),
      balance_total: parseFloat(s.total_ingresos) - parseFloat(s.total_egresos),
      monthly: monthly.rows
    });
  } catch (err) {
    console.error('[cash_flow/summary]', err);
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/cash-flow/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM cash_flow WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/cash-flow
router.post('/', async (req, res) => {
  try {
    const { flow_date, category, type, amount, description, is_projected, actual_date, notes } = req.body;
    if (!flow_date || !type || amount === undefined) {
      return res.status(400).json({ error: 'Fecha, tipo y monto son requeridos' });
    }
    const result = await db.query(
      `INSERT INTO cash_flow (flow_date, category, type, amount, description, is_projected, actual_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [flow_date, category || null, type, amount, description || null, is_projected || false, actual_date || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[cash_flow/POST]', err);
    res.status(500).json({ error: 'Error al crear entrada' });
  }
});

// PUT /api/cash-flow/:id
router.put('/:id', async (req, res) => {
  try {
    const { flow_date, category, type, amount, description, is_projected, actual_date, notes } = req.body;
    const result = await db.query(
      `UPDATE cash_flow SET flow_date=$1, category=$2, type=$3, amount=$4, description=$5, is_projected=$6, actual_date=$7, notes=$8
       WHERE id=$9 RETURNING *`,
      [flow_date, category || null, type, amount, description || null, is_projected || false, actual_date || null, notes || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar entrada' });
  }
});

// DELETE /api/cash-flow/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM cash_flow WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entrada no encontrada' });
    res.json({ message: 'Entrada eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
