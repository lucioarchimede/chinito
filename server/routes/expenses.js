const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, category, supplier, limit = 100, offset = 0 } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (start_date) { conditions.push(`expense_date >= $${idx++}`); params.push(start_date); }
    if (end_date) { conditions.push(`expense_date <= $${idx++}`); params.push(end_date); }
    if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
    if (supplier) { conditions.push(`supplier ILIKE $${idx++}`); params.push(`%${supplier}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT * FROM expenses ${where} ORDER BY expense_date DESC, id DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    const countResult = await db.query(`SELECT COUNT(*), COALESCE(SUM(amount), 0) as total FROM expenses ${where}`, params);
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count), total_amount: parseFloat(countResult.rows[0].total) });
  } catch (err) {
    console.error('[expenses/GET]', err);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// GET /api/expenses/by-category
router.get('/by-category', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (start_date) { where += ` AND expense_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { where += ` AND expense_date <= $${idx++}`; params.push(end_date); }

    const result = await db.query(
      `SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses ${where} GROUP BY category ORDER BY total DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/expenses/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener gasto' });
  }
});

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    const { expense_date, category, subcategory, description, amount, is_recurring, payment_method, supplier, invoice_number, notes } = req.body;
    if (!expense_date || !category || !description || amount === undefined) {
      return res.status(400).json({ error: 'Fecha, categoría, descripción y monto son requeridos' });
    }
    const result = await db.query(
      `INSERT INTO expenses (expense_date, category, subcategory, description, amount, is_recurring, payment_method, supplier, invoice_number, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [expense_date, category, subcategory || null, description, amount, is_recurring || false,
       payment_method || null, supplier || null, invoice_number || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[expenses/POST]', err);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', async (req, res) => {
  try {
    const { expense_date, category, subcategory, description, amount, is_recurring, payment_method, supplier, invoice_number, notes } = req.body;
    const result = await db.query(
      `UPDATE expenses SET expense_date=$1, category=$2, subcategory=$3, description=$4, amount=$5,
        is_recurring=$6, payment_method=$7, supplier=$8, invoice_number=$9, notes=$10
       WHERE id=$11 RETURNING *`,
      [expense_date, category, subcategory || null, description, amount, is_recurring || false,
       payment_method || null, supplier || null, invoice_number || null, notes || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[expenses/PUT]', err);
    res.status(500).json({ error: 'Error al actualizar gasto' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json({ message: 'Gasto eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
