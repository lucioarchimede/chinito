const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// Parse CSV content (text/plain body) into rows
function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

// GET /api/reconciliation/summary
router.get('/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE NOT is_matched AND NOT is_ignored) as pending,
        COUNT(*) FILTER (WHERE is_matched) as matched,
        COUNT(*) FILTER (WHERE is_ignored) as ignored,
        COUNT(*) as total,
        COALESCE(SUM(amount) FILTER (WHERE type='credit' AND is_matched), 0) as matched_credits,
        COALESCE(SUM(amount) FILTER (WHERE type='credit' AND NOT is_matched AND NOT is_ignored), 0) as pending_credits
      FROM bank_movements
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[reconciliation/summary]', err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// GET /api/reconciliation/pending
router.get('/pending', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = await db.query(
      `SELECT * FROM bank_movements WHERE NOT is_matched AND NOT is_ignored
       ORDER BY transaction_date DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[reconciliation/pending]', err);
    res.status(500).json({ error: 'Error al obtener movimientos pendientes' });
  }
});

// GET /api/reconciliation/reconciled
router.get('/reconciled', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = await db.query(
      `SELECT bm.*, s.sale_date, s.customer_name, s.final_revenue as sale_revenue
       FROM bank_movements bm
       LEFT JOIN sales s ON bm.matched_sale_id = s.id
       WHERE bm.is_matched = true
       ORDER BY bm.transaction_date DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[reconciliation/reconciled]', err);
    res.status(500).json({ error: 'Error al obtener movimientos reconciliados' });
  }
});

// GET /api/reconciliation/movements
router.get('/movements', async (req, res) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    let where = '';
    if (status === 'pending') where = 'WHERE NOT is_matched AND NOT is_ignored';
    else if (status === 'matched') where = 'WHERE is_matched = true';
    else if (status === 'ignored') where = 'WHERE is_ignored = true';

    const result = await db.query(
      `SELECT bm.*, s.customer_name, s.final_revenue as sale_revenue
       FROM bank_movements bm LEFT JOIN sales s ON bm.matched_sale_id = s.id
       ${where} ORDER BY bm.transaction_date DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countRes = await db.query(`SELECT COUNT(*) FROM bank_movements ${where}`);
    res.json({ data: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error('[reconciliation/movements]', err);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

// POST /api/reconciliation/import - CSV text in body
router.post('/import', async (req, res) => {
  try {
    const text = typeof req.body === 'string' ? req.body : req.body.csv;
    if (!text) return res.status(400).json({ error: 'Se requiere contenido CSV' });

    const rows = parseCSV(text);
    if (!rows.length) return res.status(400).json({ error: 'CSV vacío o inválido' });

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const dateRaw = row.fecha || row.date || row.transaction_date || '';
      const descRaw = row.descripcion || row.description || row.detalle || '';
      const amountRaw = row.monto || row.amount || row.importe || '';
      const typeRaw = (row.tipo || row.type || '').toLowerCase();
      const refRaw = row.referencia || row.reference || row.ref || '';

      if (!dateRaw || !amountRaw) { skipped++; continue; }

      const amount = Math.abs(parseFloat(amountRaw.replace(/[^0-9.\-]/g, '')));
      if (isNaN(amount)) { skipped++; continue; }

      const type = typeRaw === 'debito' || typeRaw === 'debit' || parseFloat(amountRaw) < 0
        ? 'debit' : 'credit';

      try {
        await db.query(
          `INSERT INTO bank_movements (transaction_date, description, amount, type, reference)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT DO NOTHING`,
          [dateRaw, descRaw || null, amount, type, refRaw || null]
        );
        imported++;
      } catch { skipped++; }
    }

    res.json({ imported, skipped, total: rows.length });
  } catch (err) {
    console.error('[reconciliation/import]', err);
    res.status(500).json({ error: 'Error al importar CSV' });
  }
});

// POST /api/reconciliation/match - manually match movement to sale
router.post('/match', async (req, res) => {
  try {
    const { movement_id, sale_id } = req.body;
    if (!movement_id || !sale_id) return res.status(400).json({ error: 'movement_id y sale_id requeridos' });

    const result = await db.query(
      `UPDATE bank_movements SET matched_sale_id=$1, is_matched=true WHERE id=$2 RETURNING *`,
      [sale_id, movement_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[reconciliation/match]', err);
    res.status(500).json({ error: 'Error al conciliar' });
  }
});

// POST /api/reconciliation/auto-match
router.post('/auto-match', async (req, res) => {
  try {
    const { tolerance_days = 3, tolerance_amount = 0.50 } = req.body;

    const pendingRes = await db.query(
      `SELECT * FROM bank_movements WHERE NOT is_matched AND NOT is_ignored AND type='credit'`
    );

    let matched = 0;
    for (const movement of pendingRes.rows) {
      const date = movement.transaction_date;
      const amount = parseFloat(movement.amount);

      const saleRes = await db.query(
        `SELECT id FROM sales
         WHERE ABS(final_revenue - $1) <= $2
         AND sale_date BETWEEN ($3::date - $4 * INTERVAL '1 day') AND ($3::date + $4 * INTERVAL '1 day')
         AND id NOT IN (SELECT matched_sale_id FROM bank_movements WHERE matched_sale_id IS NOT NULL)
         ORDER BY ABS(final_revenue - $1) ASC, ABS(sale_date - $3::date) ASC
         LIMIT 1`,
        [amount, tolerance_amount, date, tolerance_days]
      );

      if (saleRes.rows.length) {
        await db.query(
          `UPDATE bank_movements SET matched_sale_id=$1, is_matched=true WHERE id=$2`,
          [saleRes.rows[0].id, movement.id]
        );
        matched++;
      }
    }

    res.json({ matched, total_pending: pendingRes.rows.length });
  } catch (err) {
    console.error('[reconciliation/auto-match]', err);
    res.status(500).json({ error: 'Error en auto-conciliación' });
  }
});

// PUT /api/reconciliation/:id/ignore
router.put('/:id/ignore', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE bank_movements SET is_ignored=true WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[reconciliation/ignore]', err);
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/reconciliation/:id/unmatch
router.put('/:id/unmatch', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE bank_movements SET matched_sale_id=null, is_matched=false, is_ignored=false WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[reconciliation/unmatch]', err);
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/reconciliation/sales-search - search sales for manual matching
router.get('/sales-search', async (req, res) => {
  try {
    const { q, amount, date } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (amount) {
      conditions.push(`ABS(final_revenue - $${idx}) <= 1`);
      params.push(parseFloat(amount)); idx++;
    }
    if (date) {
      conditions.push(`sale_date BETWEEN ($${idx}::date - INTERVAL '5 days') AND ($${idx}::date + INTERVAL '5 days')`);
      params.push(date); idx++;
    }
    if (q) {
      conditions.push(`(customer_name ILIKE $${idx} OR customer_email ILIKE $${idx})`);
      params.push(`%${q}%`); idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT id, sale_date, customer_name, final_revenue, sale_channel FROM sales ${where} ORDER BY sale_date DESC LIMIT 20`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[reconciliation/sales-search]', err);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
