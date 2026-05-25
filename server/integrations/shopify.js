/**
 * ShopifyIntegration
 * Real integration with Shopify Admin REST API (OAuth 2.0).
 * Docs: https://shopify.dev/docs/api/admin-rest
 * API version: 2024-01
 */
const axios = require('axios');
const crypto = require('crypto');

const API_VERSION = '2024-01';
const SHOPIFY_SCOPES = 'read_products,write_products,read_orders,read_inventory,write_inventory';
// Shopify bucket: 40 calls burst, 2/s steady → 500 ms between paginated calls
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ShopifyIntegration {
  constructor(shop, accessToken) {
    // shop = "mystore.myshopify.com"
    this.shop = shop;
    this.client = axios.create({
      baseURL: `https://${shop}/admin/api/${API_VERSION}`,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ── Static OAuth helpers ──────────────────────────────────────────────────

  /**
   * Returns the Shopify OAuth authorization URL.
   */
  static getAuthURL(shop, apiKey, redirectUri, state) {
    const params = new URLSearchParams({
      client_id: apiKey,
      scope: SHOPIFY_SCOPES,
      redirect_uri: redirectUri,
      state,
    });
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for an access token.
   * Returns { access_token, scope }
   */
  static async exchangeCodeForToken(shop, apiKey, apiSecret, code) {
    const resp = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      { client_id: apiKey, client_secret: apiSecret, code }
    );
    return resp.data;
  }

  /**
   * Verifies the HMAC signature on an OAuth callback query string.
   * Removes hmac from the params, sorts remaining, computes HMAC-SHA256.
   */
  static verifyHmac(query, apiSecret) {
    const { hmac, signature, ...rest } = query; // eslint-disable-line no-unused-vars
    const message = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join('&');
    const expected = crypto
      .createHmac('sha256', apiSecret)
      .update(message)
      .digest('hex');
    // timingSafeEqual requires equal-length buffers
    try {
      return crypto.timingSafeEqual(
        Buffer.from(hmac, 'hex'),
        Buffer.from(expected, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Verifies a Shopify webhook request.
   * rawBody must be the raw Buffer/string of the request body.
   * hmacHeader comes from X-Shopify-Hmac-Sha256.
   */
  static verifyWebhook(rawBody, hmacHeader, apiSecret) {
    const computed = crypto
      .createHmac('sha256', apiSecret)
      .update(rawBody, 'utf8')
      .digest('base64');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(hmacHeader)
      );
    } catch {
      return false;
    }
  }

  // ── Private HTTP helpers ──────────────────────────────────────────────────

  async _get(path, params = {}) {
    const resp = await this.client.get(path, { params });
    return { data: resp.data, headers: resp.headers };
  }

  async _post(path, data) {
    const resp = await this.client.post(path, data);
    return resp.data;
  }

  async _put(path, data) {
    const resp = await this.client.put(path, data);
    return resp.data;
  }

  // ── Cursor-based pagination helper ────────────────────────────────────────

  _nextPageInfo(linkHeader) {
    if (!linkHeader) return null;
    const match = linkHeader.match(/page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    return match ? match[1] : null;
  }

  // ── Platform data fetchers ────────────────────────────────────────────────

  async getProducts() {
    let all = [];
    let pageInfo = null;
    while (true) {
      const params = { limit: 250 };
      if (pageInfo) params.page_info = pageInfo;
      const { data, headers } = await this._get('/products.json', params);
      const batch = data.products || [];
      all = all.concat(batch);
      pageInfo = this._nextPageInfo(headers.link);
      if (!pageInfo || batch.length === 0) break;
      await sleep(500);
    }
    return all;
  }

  async getOrders(since = null) {
    let all = [];
    let pageInfo = null;
    while (true) {
      const params = { limit: 250, status: 'any', financial_status: 'paid' };
      if (since && !pageInfo) params.created_at_min = since;
      if (pageInfo) params.page_info = pageInfo;
      const { data, headers } = await this._get('/orders.json', params);
      const batch = data.orders || [];
      all = all.concat(batch);
      pageInfo = this._nextPageInfo(headers.link);
      if (!pageInfo || batch.length === 0) break;
      await sleep(500);
    }
    return all;
  }

  async getLocations() {
    const { data } = await this._get('/locations.json');
    return data.locations || [];
  }

  // ── Webhook registration ──────────────────────────────────────────────────

  async registerWebhooks(baseUrl) {
    const topics = ['orders/create', 'orders/updated', 'products/update'];
    const results = [];
    for (const topic of topics) {
      try {
        const resp = await this._post('/webhooks.json', {
          webhook: {
            topic,
            address: `${baseUrl}/api/webhooks/shopify`,
            format: 'json',
          },
        });
        results.push({ topic, id: resp.webhook?.id, ok: true });
      } catch (err) {
        results.push({ topic, ok: false, error: err.message });
      }
    }
    return results;
  }

  // ── Update inventory on platform ──────────────────────────────────────────

  async setInventoryLevel(inventoryItemId, locationId, quantity) {
    return this._post('/inventory_levels/set.json', {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available: quantity,
    });
  }

  // ── Sync: Shopify → EcomDash DB ───────────────────────────────────────────

  /**
   * Upserts products from Shopify into the local products table.
   * Matches on variant SKU.
   */
  async syncProducts(db) {
    const shopifyProducts = await this.getProducts();
    let created = 0, updated = 0, errors = 0;

    for (const prod of shopifyProducts) {
      for (const variant of prod.variants || []) {
        const sku = variant.sku;
        if (!sku) continue;

        try {
          const precio_venta = parseFloat(variant.price) || 0;
          const stock_actual = parseInt(variant.inventory_quantity) >= 0
            ? parseInt(variant.inventory_quantity)
            : 0;
          const nombre = prod.title || 'Sin nombre';
          const categoria = prod.product_type || null;

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
          console.error(`[Shopify syncProducts] SKU ${sku}:`, err.message);
          errors++;
        }
      }
    }
    return { platform: 'shopify', type: 'products', created, updated, errors, total: shopifyProducts.length };
  }

  /**
   * Imports paid orders from Shopify as sales records.
   * Deduplicates using a ref tag in the notes column.
   */
  async syncOrders(db, since = null) {
    const orders = await this.getOrders(since);
    let created = 0, skipped = 0, errors = 0;

    for (const order of orders) {
      const refTag = `shopify_order:${order.id}`;
      try {
        const dup = await db.query(
          `SELECT id FROM sales WHERE notes LIKE $1 LIMIT 1`,
          [`%${refTag}%`]
        );
        if (dup.rows.length > 0) { skipped++; continue; }

        const customer = order.customer || {};
        const customerName =
          [customer.first_name, customer.last_name].filter(Boolean).join(' ') || null;
        const saleDate = order.created_at.split('T')[0];

        for (const item of order.line_items || []) {
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
          const discount = parseFloat(item.total_discount || 0);
          const grossSales = qty * unitPrice;
          const netSales = grossSales - discount;
          const finalRevenue = netSales;

          await db.query(
            `INSERT INTO sales
               (sale_date, product_id, quantity, unit_price, gross_sales, discount,
                net_sales, mp_commission, mp_tax, shipping_cost, final_revenue,
                customer_name, customer_email, customer_phone,
                is_repeat_customer, sale_channel, payment_method, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,$8,$9,$10,NULL,FALSE,'Shopify','Tarjeta',$11)`,
            [
              saleDate, productId, qty, unitPrice, grossSales, discount,
              netSales, finalRevenue,
              customerName, customer.email || null,
              `Importado de Shopify. Orden #${order.order_number}. ${refTag}`,
            ]
          );

          await db.query(
            `INSERT INTO stock_movements
               (product_id, movement_type, quantity, reason, movement_date, notes)
             VALUES ($1,'salida',$2,'Venta Shopify',$3,$4)`,
            [productId, qty, saleDate, `Orden Shopify #${order.order_number}`]
          );

          await db.query(
            `UPDATE products SET stock_actual = GREATEST(0, stock_actual - $1) WHERE id = $2`,
            [qty, productId]
          );

          created++;
        }
      } catch (err) {
        console.error(`[Shopify syncOrders] Order ${order.id}:`, err.message);
        errors++;
      }
    }
    return { platform: 'shopify', type: 'orders', created, skipped, errors, total: orders.length };
  }

  /**
   * Pushes local stock back to Shopify inventory levels.
   * Uses the first available location.
   */
  async syncStockToShopify(db) {
    const locations = await this.getLocations();
    if (!locations.length) throw new Error('No se encontraron locations en Shopify');
    const locationId = locations[0].id;

    const products = await this.getProducts();
    let updated = 0, errors = 0;

    for (const prod of products) {
      for (const variant of prod.variants || []) {
        const sku = variant.sku;
        if (!sku || !variant.inventory_item_id) continue;
        try {
          const local = await db.query(
            `SELECT stock_actual FROM products WHERE sku = $1`,
            [sku]
          );
          if (!local.rows.length) continue;
          await this.setInventoryLevel(
            variant.inventory_item_id,
            locationId,
            parseInt(local.rows[0].stock_actual)
          );
          await sleep(500);
          updated++;
        } catch (err) {
          console.error(`[Shopify syncStock] SKU ${sku}:`, err.message);
          errors++;
        }
      }
    }
    return { platform: 'shopify', type: 'stock', updated, errors };
  }
}

module.exports = ShopifyIntegration;
