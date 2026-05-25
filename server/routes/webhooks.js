/**
 * webhooks.js
 * Receives real-time events from Tiendanube and Shopify.
 *
 * IMPORTANT: These routes use express.raw() so the raw body is available
 * for HMAC verification (Shopify). Register them in server/index.js
 * BEFORE express.json() middleware using:
 *   app.use('/api/webhooks', require('./routes/webhooks'));
 *
 * Shopify webhook verification: HMAC-SHA256 of raw body with API secret.
 * Tiendanube: no official HMAC; we accept and log all requests from the platform.
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const ShopifyIntegration = require('../integrations/shopify');

const router = express.Router();

// Use raw body parser so we can verify Shopify HMAC
router.use(express.raw({ type: ['application/json', 'text/plain'], limit: '2mb' }));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getIntegration(platform) {
  const res = await db.query(`SELECT * FROM integrations WHERE platform = $1`, [platform]);
  return res.rows[0] || null;
}

function parseBody(rawBody) {
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    return null;
  }
}

async function upsertProductFromWebhook(platform, sku, nombre, precioVenta, stockActual) {
  const existing = await db.query(`SELECT id FROM products WHERE sku = $1`, [sku]);
  if (existing.rows.length > 0) {
    await db.query(
      `UPDATE products SET precio_venta=$1, stock_actual=$2, updated_at=NOW() WHERE sku=$3`,
      [precioVenta, stockActual, sku]
    );
  } else {
    await db.query(
      `INSERT INTO products (sku, nombre, precio_venta, precio_costo, stock_actual, stock_minimo, active)
       VALUES ($1, $2, $3, 0, $4, 0, true)`,
      [sku, nombre, precioVenta, stockActual]
    );
  }
}

async function insertSaleFromWebhook(platform, refTag, saleDate, productId, qty, unitPrice, discount, customerName, customerEmail, paymentMethod) {
  const dup = await db.query(`SELECT id FROM sales WHERE notes LIKE $1 LIMIT 1`, [`%${refTag}%`]);
  if (dup.rows.length > 0) return false; // already imported

  const grossSales = qty * unitPrice;
  const netSales = grossSales - discount;
  const finalRevenue = netSales;

  await db.query(
    `INSERT INTO sales
       (sale_date, product_id, quantity, unit_price, gross_sales, discount,
        net_sales, mp_commission, mp_tax, shipping_cost, final_revenue,
        customer_name, customer_email, customer_phone,
        is_repeat_customer, sale_channel, payment_method, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,$8,$9,$10,NULL,FALSE,$11,$12,$13)`,
    [
      saleDate, productId, qty, unitPrice, grossSales, discount,
      netSales, finalRevenue,
      customerName, customerEmail,
      platform === 'tiendanube' ? 'TiendaNube' : 'Shopify',
      paymentMethod,
      `Webhook ${platform}. ${refTag}`,
    ]
  );

  await db.query(
    `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, movement_date, notes)
     VALUES ($1,'salida',$2,'Venta vía webhook',$3,$4)`,
    [productId, qty, saleDate, `Webhook ${platform}`]
  );

  await db.query(
    `UPDATE products SET stock_actual = GREATEST(0, stock_actual - $1) WHERE id = $2`,
    [qty, productId]
  );

  return true;
}

// ── POST /api/webhooks/tiendanube ─────────────────────────────────────────────
router.post('/tiendanube', async (req, res) => {
  // Acknowledge quickly (Tiendanube expects 200 within seconds)
  res.sendStatus(200);

  const event = req.headers['x-tiendanube-topic'] || req.headers['x-nuvemshop-topic'] || 'unknown';
  const body = parseBody(req.body);
  if (!body) return;

  const integration = await getIntegration('tiendanube').catch(() => null);
  if (!integration || !integration.is_active) return;

  console.log(`[webhook/tiendanube] Event: ${event}`);

  try {
    if (event === 'order/created' || event === 'order/updated') {
      const order = body;
      if (order.financial_status !== 'paid') return;

      const refTag = `tn_order:${order.id}`;
      const customer = order.customer || {};
      const customerName = [customer.name, customer.last_name].filter(Boolean).join(' ') || null;
      const saleDate = (order.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0];

      for (const item of order.products || []) {
        const sku = item.sku;
        if (!sku) continue;
        const prodRes = await db.query(`SELECT id FROM products WHERE sku = $1`, [sku]);
        if (!prodRes.rows.length) continue;
        const productId = prodRes.rows[0].id;
        const qty = parseInt(item.quantity) || 1;
        const unitPrice = parseFloat(item.price) || 0;
        const discount = parseFloat(item.discount || 0);
        const paymentMethod = order.payment_details?.type === 'wire_transfer' ? 'Transferencia' : 'Tarjeta';

        await insertSaleFromWebhook(
          'tiendanube', refTag, saleDate, productId, qty, unitPrice, discount,
          customerName, customer.email || null, paymentMethod
        );
      }

    } else if (event === 'product/updated' || event === 'product/created') {
      const prod = body;
      const nombre = typeof prod.name === 'object'
        ? (prod.name?.es || prod.name?.en || 'Sin nombre')
        : (prod.name || 'Sin nombre');

      for (const variant of prod.variants || []) {
        const sku = variant.sku;
        if (!sku) continue;
        await upsertProductFromWebhook(
          'tiendanube', sku, nombre,
          parseFloat(variant.price) || 0,
          parseInt(variant.stock) >= 0 ? parseInt(variant.stock) : 0
        );
      }
    }
  } catch (err) {
    console.error('[webhook/tiendanube] Processing error:', err.message);
  }
});

// ── POST /api/webhooks/shopify ────────────────────────────────────────────────
router.post('/shopify', async (req, res) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const topic = req.headers['x-shopify-topic'] || 'unknown';
  const rawBody = req.body; // Buffer from express.raw()

  // Verify HMAC before doing anything
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (apiSecret && hmacHeader) {
    const valid = ShopifyIntegration.verifyWebhook(rawBody, hmacHeader, apiSecret);
    if (!valid) {
      console.warn('[webhook/shopify] Invalid HMAC — rejecting request');
      return res.sendStatus(401);
    }
  }

  // Acknowledge quickly
  res.sendStatus(200);

  const body = parseBody(rawBody);
  if (!body) return;

  const integration = await getIntegration('shopify').catch(() => null);
  if (!integration || !integration.is_active) return;

  console.log(`[webhook/shopify] Topic: ${topic}`);

  try {
    if (topic === 'orders/create' || topic === 'orders/updated') {
      const order = body;
      if (order.financial_status !== 'paid') return;

      const refTag = `shopify_order:${order.id}`;
      const customer = order.customer || {};
      const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || null;
      const saleDate = (order.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0];

      for (const item of order.line_items || []) {
        const sku = item.sku;
        if (!sku) continue;
        const prodRes = await db.query(`SELECT id FROM products WHERE sku = $1`, [sku]);
        if (!prodRes.rows.length) continue;
        const productId = prodRes.rows[0].id;
        const qty = parseInt(item.quantity) || 1;
        const unitPrice = parseFloat(item.price) || 0;
        const discount = parseFloat(item.total_discount || 0);

        await insertSaleFromWebhook(
          'shopify', refTag, saleDate, productId, qty, unitPrice, discount,
          customerName, customer.email || null, 'Tarjeta'
        );
      }

    } else if (topic === 'products/update' || topic === 'products/create') {
      const prod = body;
      const nombre = prod.title || 'Sin nombre';

      for (const variant of prod.variants || []) {
        const sku = variant.sku;
        if (!sku) continue;
        await upsertProductFromWebhook(
          'shopify', sku, nombre,
          parseFloat(variant.price) || 0,
          parseInt(variant.inventory_quantity) >= 0 ? parseInt(variant.inventory_quantity) : 0
        );
      }
    }
  } catch (err) {
    console.error('[webhook/shopify] Processing error:', err.message);
  }
});

module.exports = router;
