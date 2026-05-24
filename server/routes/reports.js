const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const toCSV = (rows, columns) => {
  if (!rows.length) return columns.join(',') + '\n';
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = columns.join(',');
  const data = rows.map(row => columns.map(c => escape(row[c])).join(','));
  return [header, ...data].join('\n');
};

const sendCSV = (res, filename, data) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + data); // BOM for Excel compatibility
};

// GET /api/reports/sales
router.get('/sales', async (req, res) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (start_date) { where += ` AND s.sale_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { where += ` AND s.sale_date <= $${idx++}`; params.push(end_date); }

    const result = await db.query(
      `SELECT s.id, s.sale_date, p.sku, p.nombre as producto, s.quantity, s.unit_price,
        s.gross_sales, s.discount, s.net_sales, s.mp_commission, s.mp_tax, s.shipping_cost,
        s.final_revenue, s.customer_name, s.customer_email, s.customer_phone,
        s.is_repeat_customer, s.sale_channel, s.payment_method, s.notes
       FROM sales s LEFT JOIN products p ON s.product_id = p.id
       ${where} ORDER BY s.sale_date DESC`,
      params
    );

    if (format === 'csv') {
      const cols = ['id','sale_date','sku','producto','quantity','unit_price','gross_sales',
        'discount','net_sales','mp_commission','mp_tax','shipping_cost','final_revenue',
        'customer_name','customer_email','customer_phone','is_repeat_customer',
        'sale_channel','payment_method','notes'];
      return sendCSV(res, `ventas_${start_date||'all'}_${end_date||'all'}.csv`, toCSV(result.rows, cols));
    }
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[reports/sales]', err);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

// GET /api/reports/expenses
router.get('/expenses', async (req, res) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (start_date) { where += ` AND expense_date >= $${idx++}`; params.push(start_date); }
    if (end_date) { where += ` AND expense_date <= $${idx++}`; params.push(end_date); }

    const result = await db.query(
      `SELECT id, expense_date, category, subcategory, description, amount, is_recurring,
        payment_method, supplier, invoice_number, notes
       FROM expenses ${where} ORDER BY expense_date DESC`,
      params
    );

    if (format === 'csv') {
      const cols = ['id','expense_date','category','subcategory','description','amount',
        'is_recurring','payment_method','supplier','invoice_number','notes'];
      return sendCSV(res, `gastos_${start_date||'all'}_${end_date||'all'}.csv`, toCSV(result.rows, cols));
    }
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[reports/expenses]', err);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

// GET /api/reports/products
router.get('/products', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const result = await db.query(
      `SELECT p.*,
        CASE WHEN precio_venta > 0 THEN ROUND(((precio_venta - precio_costo) / precio_venta * 100)::numeric, 2) ELSE 0 END as margen_pct,
        COALESCE(SUM(s.quantity), 0)::int as total_vendido,
        COALESCE(SUM(s.final_revenue), 0) as revenue_total
       FROM products p
       LEFT JOIN sales s ON p.id = s.product_id
       GROUP BY p.id ORDER BY revenue_total DESC`
    );

    if (format === 'csv') {
      const cols = ['id','sku','nombre','categoria','proveedor','precio_costo','precio_venta',
        'margen_pct','stock_actual','stock_minimo','total_vendido','revenue_total'];
      return sendCSV(res, 'productos.csv', toCSV(result.rows, cols));
    }
    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('[reports/products]', err);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
});

// GET /api/reports/comparison - comparar dos períodos
router.get('/comparison', async (req, res) => {
  try {
    const { period1_start, period1_end, period2_start, period2_end } = req.query;
    if (!period1_start || !period1_end || !period2_start || !period2_end) {
      return res.status(400).json({ error: 'Se requieren dos períodos completos' });
    }

    const metricSQL = (start, end) => db.query(
      `SELECT
        COUNT(*)::int as total_sales,
        COALESCE(SUM(final_revenue), 0) as total_revenue,
        COALESCE(AVG(final_revenue), 0) as avg_ticket,
        COUNT(DISTINCT customer_email) FILTER (WHERE customer_email IS NOT NULL)::int as unique_clients
       FROM sales WHERE sale_date BETWEEN $1 AND $2`,
      [start, end]
    );

    const [p1, p2] = await Promise.all([metricSQL(period1_start, period1_end), metricSQL(period2_start, period2_end)]);

    const calc = (a, b) => b > 0 ? ((a - b) / b * 100) : null;
    const r1 = p1.rows[0];
    const r2 = p2.rows[0];

    res.json({
      period1: { start: period1_start, end: period1_end, ...r1 },
      period2: { start: period2_start, end: period2_end, ...r2 },
      comparison: {
        revenue_change_pct: calc(parseFloat(r1.total_revenue), parseFloat(r2.total_revenue)),
        sales_change_pct: calc(r1.total_sales, r2.total_sales),
        ticket_change_pct: calc(parseFloat(r1.avg_ticket), parseFloat(r2.avg_ticket)),
        clients_change_pct: calc(r1.unique_clients, r2.unique_clients),
      }
    });
  } catch (err) {
    console.error('[reports/comparison]', err);
    res.status(500).json({ error: 'Error al generar comparación' });
  }
});

module.exports = router;
