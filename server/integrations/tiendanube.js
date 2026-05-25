/**
 * TiendanubeIntegration
 * Real integration with Tiendanube REST API (OAuth 2.0).
 * Docs: https://tiendanube.github.io/api-documentation/
 */
const axios = require('axios');

const TN_API_BASE = 'https://api.tiendanube.com/v1';
const TN_AUTH_BASE = 'https://www.tiendanube.com/apps';
// Tiendanube rate limit: 40 req/min → wait 1.5 s between paginated calls
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class TiendanubeIntegration {
  constructor(storeId, accessToken) {
    this.storeId = storeId;
    this.client = axios.create({
      baseURL: `${TN_API_BASE}/${storeId}`,
      headers: {
        Authentication: `bearer ${accessToken}`,
        'User-Agent': 'EcomDash/2.0 (soporte@ecomdash.app)',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ── Static OAuth helpers ──────────────────────────────────────────────────

  /**
   * Returns the URL where the user must be redirected to authorize the app.
   */
  static getAuthURL(clientId, state) {
    return `${TN_AUTH_BASE}/${clientId}/authorize?client_id=${clientId}&state=${encodeURIComponent(state)}`;
  }

  /**
   * Exchanges an authorization code for an access token.
   * Returns { access_token, token_type, scope, user_id }
   */
  static async exchangeCodeForToken(clientId, clientSecret, code) {
    const resp = await axios.post(`${TN_AUTH_BASE}/authorize/token`, {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });
    return resp.data;
  }

  // ── Private HTTP helpers ──────────────────────────────────────────────────

  async _get(path, params = {}) {
    const resp = await this.client.get(path, { params });
    return resp.data;
  }

  async _post(path, data) {
    const resp = await this.client.post(path, data);
    return resp.data;
  }

  async _put(path, data) {
    const resp = await this.client.put(path, data);
    return resp.data;
  }

  // ── Platform data fetchers (with pagination) ──────────────────────────────

  async getProducts() {
    let all = [];
    let page = 1;
    while (true) {
      const batch = await this._get('/products', { per_page: 200, page });
      if (!Array.isArray(batch) || batch.length === 0) break;
      all = all.concat(batch);
      if (batch.length < 200) break;
      page++;
      await sleep(1500);
    }
    return all;
  }

  async getOrders(since = null) {
    let all = [];
    let page = 1;
    while (true) {
      const params = { per_page: 200, page, financial_status: 'paid' };
      if (since) params.created_at_min = since;
      const batch = await this._get('/orders', { ...params, page });
      if (!Array.isArray(batch) || batch.length === 0) break;
      all = all.concat(batch);
      if (batch.length < 200) break;
      page++;
      await sleep(1500);
    }
    return all;
  }

  // ── Webhook registration ──────────────────────────────────────────────────

  async registerWebhooks(baseUrl) {
    const events = ['order/created', 'order/updated', 'product/updated'];
    const results = [];
    for (const event of events) {
      try {
        const wh = await this._post('/webhooks', {
          event,
          url: `${baseUrl}/api/webhooks/tiendanube`,
        });
        results.push({ event, id: wh.id, ok: true });
      } catch (err) {
        results.push({ event, ok: false, error: err.message });
      }
    }
    return results;
  }

  // ── Update stock on platform ──────────────────────────────────────────────

  async updateVariantStock(variantId, quantity) {
    return this._put(`/variants/${variantId}`, { stock: quantity });
  }

  // ── Sync: Tiendanube → EcomDash DB ───────────────────────────────────────

  /**
   * Upserts products from Tiendanube into the local products table.
   * Matches on SKU. Updates price + stock if SKU exists, inserts otherwise.
   */
  async syncProducts(db) {
    const tnProducts = await this.getProducts();
    let created = 0, updated = 0, errors = 0;

    for (const tnProd of tnProducts) {
      for (const variant of tnProd.variants || []) {
        const sku = variant.sku;
        if (!sku) continue;

        try {
          const nombre =
            typeof tnProd.name === 'object'
              ? tnProd.name.es || tnProd.name.en || Object.values(tnProd.name)[0] || 'Sin nombre'
              : tnProd.name || 'Sin nombre';
          const precio_venta = parseFloat(variant.price) || 0;
          const stock_actual = parseInt(variant.stock) >= 0 ? parseInt(variant.stock) : 0;
          const categoria = tnProd.categories?.[0]?.name?.es || null;

          const existing = await db.query('SELECT id FROM products WHERE sku = $1', [sku]);
          if (existing.rows.length > 0) {
            await db.query(
              `UPDATE products SET precio_venta=$1, stock_actual=$2, updated_at=NOW() WHERE sku=$3`,
              [precio_venta, stock_actual, sku]
            );
            updated++;
          } else {
            await db.query(
              `INSERT INTO products (sku, nombre, categoria, precio_venta, precio_costo, stock_actual, stock_minimo, active)
               VALUES ($1, $2, $3, $4, 0, $5, 0, true)`,
              [sku, nombre, categoria, precio_venta, stock_actual]
            );
            created++;
          }
        } catch (err) {
          console.error(`[TN syncProducts] SKU ${sku}:`, err.message);
          errors++;
        }
      }
    }
    return { platform: 'tiendanube', type: 'products', created, updated, errors, total: tnProducts.length };
  }

  /**
   * Imports paid orders from Tiendanube as sales records.
   * Deduplicates using a ref tag in the notes column.
   * @param {object} db - pg Pool or Client
   * @param {string|null} since - ISO date string (YYYY-MM-DD) to filter orders from
   */
  async syncOrders(db, since = null) {
    const orders = await this.getOrders(since);
    let created = 0, skipped = 0, errors = 0;

    for (const order of orders) {
      const refTag = `tn_order:${order.id}`;
      try {
        // Deduplicate: check if this order was already imported
        const dup = await db.query(
          `SELECT id FROM sales WHERE notes LIKE $1 LIMIT 1`,
          [`%${refTag}%`]
        );
        if (dup.rows.length > 0) { skipped++; continue; }

        const customer = order.customer || {};
        const customerName =
          [customer.name, customer.last_name].filter(Boolean).join(' ') || null;
        const saleDate = order.created_at.split('T')[0];
        const paymentMethod =
          order.payment_details?.type === 'credit_card' ? 'Tarjeta'
          : order.payment_details?.type === 'wire_transfer' ? 'Transferencia'
          : 'Tarjeta';

        for (const item of order.products || []) {
          const sku = item.sku;
          if (!sku) continue;

          const prodRes = await db.query(
            `SELECT id FROM products WHERE sku = $1`,
            [sku]
          );
          if (!prodRes.rows.length) continue;

          const productId = prodRes.rows[0].id;
          const qty = parseInt(item.quantity) || 1;
          const unitPrice = parseFloat(item.price) || 0;
          const discount = parseFloat(item.discount || 0);
          const grossSales = qty * unitPrice;
          const netSales = grossSales - discount;
          const finalRevenue = netSales; // TiendaNube fees not itemized

          await db.query(
            `INSERT INTO sales
               (sale_date, product_id, quantity, unit_price, gross_sales, discount,
                net_sales, mp_commission, mp_tax, shipping_cost, final_revenue,
                customer_name, customer_email, customer_phone,
                is_repeat_customer, sale_channel, payment_method, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,$8,$9,$10,NULL,FALSE,'TiendaNube',$11,$12)`,
            [
              saleDate, productId, qty, unitPrice, grossSales, discount,
              netSales, finalRevenue,
              customerName, customer.email || null,
              paymentMethod,
              `Importado de TiendaNube. Orden #${order.number}. ${refTag}`,
            ]
          );

          // Record outbound stock movement
          await db.query(
            `INSERT INTO stock_movements
               (product_id, movement_type, quantity, reason, movement_date, notes)
             VALUES ($1,'salida',$2,'Venta TiendaNube',$3,$4)`,
            [productId, qty, saleDate, `Orden TiendaNube #${order.number}`]
          );

          // Update products.stock_actual
          await db.query(
            `UPDATE products SET stock_actual = GREATEST(0, stock_actual - $1) WHERE id = $2`,
            [qty, productId]
          );

          created++;
        }
      } catch (err) {
        console.error(`[TN syncOrders] Order ${order.id}:`, err.message);
        errors++;
      }
    }
    return { platform: 'tiendanube', type: 'orders', created, skipped, errors, total: orders.length };
  }

  /**
   * Pushes local stock_actual values back to Tiendanube variants.
   * Matches on SKU. Useful after manual stock adjustments in EcomDash.
   */
  async syncStockToTiendanube(db) {
    const tnProducts = await this.getProducts();
    let updated = 0, errors = 0;

    for (const tnProd of tnProducts) {
      for (const variant of tnProd.variants || []) {
        const sku = variant.sku;
        if (!sku) continue;
        try {
          const local = await db.query(
            `SELECT stock_actual FROM products WHERE sku = $1`,
            [sku]
          );
          if (!local.rows.length) continue;
          const qty = parseInt(local.rows[0].stock_actual);
          await this.updateVariantStock(variant.id, qty);
          await sleep(1500); // rate limiting
          updated++;
        } catch (err) {
          console.error(`[TN syncStock] SKU ${sku}:`, err.message);
          errors++;
        }
      }
    }
    return { platform: 'tiendanube', type: 'stock', updated, errors };
  }
}

module.exports = TiendanubeIntegration;
