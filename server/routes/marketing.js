const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/marketing
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, channel, limit = 100, offset = 0 } = req.query;
    let conditions = [];
    let params = [];
    let idx = 1;

    if (start_date) { conditions.push(`metric_date >= $${idx++}`); params.push(start_date); }
    if (end_date) { conditions.push(`metric_date <= $${idx++}`); params.push(end_date); }
    if (channel) { conditions.push(`channel = $${idx++}`); params.push(channel); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT * FROM marketing_metrics ${where} ORDER BY metric_date DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    const countResult = await db.query(`SELECT COUNT(*) FROM marketing_metrics ${where}`, params);
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('[marketing/GET]', err);
    res.status(500).json({ error: 'Error al obtener métricas' });
  }
});

// GET /api/marketing/summary
router.get('/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (start_date) { where += ` AND metric_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { where += ` AND metric_date <= $${idx++}`; params.push(end_date); }

    const [totals, byChannel] = await Promise.all([
      db.query(
        `SELECT
          COALESCE(SUM(spend), 0) as total_spend,
          COALESCE(SUM(revenue), 0) as total_revenue,
          COALESCE(SUM(impressions), 0) as total_impressions,
          COALESCE(SUM(clicks), 0) as total_clicks,
          COALESCE(SUM(conversions), 0) as total_conversions,
          COALESCE(AVG(NULLIF(roas, 0)), 0) as avg_roas,
          COALESCE(AVG(NULLIF(ctr, 0)), 0) as avg_ctr,
          COALESCE(AVG(NULLIF(cpc, 0)), 0) as avg_cpc
         FROM marketing_metrics ${where}`,
        params
      ),
      db.query(
        `SELECT channel,
          COALESCE(SUM(spend), 0) as spend,
          COALESCE(SUM(revenue), 0) as revenue,
          COALESCE(SUM(conversions), 0) as conversions,
          COALESCE(AVG(NULLIF(roas, 0)), 0) as avg_roas
         FROM marketing_metrics ${where}
         GROUP BY channel ORDER BY spend DESC`,
        params
      )
    ]);
    res.json({ totals: totals.rows[0], by_channel: byChannel.rows });
  } catch (err) {
    console.error('[marketing/summary]', err);
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/marketing/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM marketing_metrics WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Métrica no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/marketing
router.post('/', async (req, res) => {
  try {
    const { metric_date, channel, impressions, clicks, ctr, cpc, conversions, conversion_rate, spend, revenue, roas, notes } = req.body;
    if (!metric_date || !channel) return res.status(400).json({ error: 'Fecha y canal son requeridos' });

    const computedCtr = clicks && impressions ? clicks / impressions : ctr || 0;
    const computedRoas = spend && revenue ? revenue / spend : roas || 0;
    const computedConvRate = clicks && conversions ? conversions / clicks : conversion_rate || 0;

    const result = await db.query(
      `INSERT INTO marketing_metrics (metric_date, channel, impressions, clicks, ctr, cpc, conversions, conversion_rate, spend, revenue, roas, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [metric_date, channel, impressions || 0, clicks || 0, computedCtr, cpc || 0,
       conversions || 0, computedConvRate, spend || 0, revenue || 0, computedRoas, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[marketing/POST]', err);
    res.status(500).json({ error: 'Error al crear métrica' });
  }
});

// PUT /api/marketing/:id
router.put('/:id', async (req, res) => {
  try {
    const { metric_date, channel, impressions, clicks, ctr, cpc, conversions, conversion_rate, spend, revenue, roas, notes } = req.body;
    const computedCtr = clicks && impressions ? clicks / impressions : ctr || 0;
    const computedRoas = spend && revenue ? revenue / spend : roas || 0;
    const computedConvRate = clicks && conversions ? conversions / clicks : conversion_rate || 0;

    const result = await db.query(
      `UPDATE marketing_metrics SET metric_date=$1, channel=$2, impressions=$3, clicks=$4, ctr=$5,
        cpc=$6, conversions=$7, conversion_rate=$8, spend=$9, revenue=$10, roas=$11, notes=$12
       WHERE id=$13 RETURNING *`,
      [metric_date, channel, impressions || 0, clicks || 0, computedCtr, cpc || 0,
       conversions || 0, computedConvRate, spend || 0, revenue || 0, computedRoas, notes || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Métrica no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar métrica' });
  }
});

// DELETE /api/marketing/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM marketing_metrics WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Métrica no encontrada' });
    res.json({ message: 'Métrica eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
