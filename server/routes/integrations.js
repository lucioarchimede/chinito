/**
 * integrations.js
 * Handles OAuth flows (Tiendanube & Shopify), real sync, config and logs.
 *
 * Route layout:
 *  PUBLIC (no auth — OAuth callbacks from external platforms):
 *    GET /api/integrations/tiendanube/callback
 *    GET /api/integrations/shopify/callback
 *
 *  AUTHENTICATED (JWT required):
 *    GET  /api/integrations                     - list all
 *    GET  /api/integrations/tiendanube/auth     - start TN OAuth → returns { authUrl }
 *    GET  /api/integrations/shopify/auth        - start Shopify OAuth → returns { authUrl }
 *    GET  /api/integrations/:platform           - single integration status
 *    PUT  /api/integrations/:platform/disconnect
 *    PUT  /api/integrations/:platform/config
 *    POST /api/integrations/:platform/sync      - real sync (type in body)
 *    GET  /api/integrations/:platform/logs
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');
const { encrypt, decrypt } = require('../integrations/crypto');
const TiendanubeIntegration = require('../integrations/tiendanube');
const ShopifyIntegration = require('../integrations/shopify');

const router = express.Router();

// ── In-memory OAuth state store (TTL: 5 min) ─────────────────────────────────
const oauthStates = new Map();

function generateState(data) {
  const state = crypto.randomBytes(32).toString('hex');
  // Prune expired entries on each write
  const now = Date.now();
  for (const [k, v] of oauthStates) {
    if (v.expiresAt < now) oauthStates.delete(k);
  }
  oauthStates.set(state, { ...data, expiresAt: now + 5 * 60 * 1000 });
  return state;
}

function consumeState(state) {
  const data = oauthStates.get(state);
  if (!data || data.expiresAt < Date.now()) {
    oauthStates.delete(state);
    return null;
  }
  oauthStates.delete(state); // one-time use
  return data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function getIntegrationWithCreds(platform) {
  const res = await db.query(
    `SELECT * FROM integrations WHERE platform = $1`,
    [platform]
  );
  return res.rows[0] || null;
}

async function logSync(integrationId, syncType, status, recordsSynced = 0, errorMessage = null) {
  return db.query(
    `INSERT INTO sync_logs (integration_id, sync_type, status, records_synced, error_message, completed_at)
     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
    [integrationId, syncType, status, recordsSynced, errorMessage]
  );
}

async function markSyncing(integrationId) {
  return db.query(
    `UPDATE integrations SET sync_status='syncing', updated_at=NOW() WHERE id=$1`,
    [integrationId]
  );
}

async function markSyncDone(integrationId, status, errorMsg = null) {
  return db.query(
    `UPDATE integrations SET sync_status=$1, last_sync=NOW(), sync_error=$2, updated_at=NOW() WHERE id=$3`,
    [status, errorMsg, integrationId]
  );
}

function buildTiendanube(integration) {
  const creds = integration.credentials;
  if (!creds?.access_token_enc || !creds?.store_id) return null;
  const token = decrypt(creds.access_token_enc);
  return new TiendanubeIntegration(creds.store_id, token);
}

function buildShopify(integration) {
  const creds = integration.credentials;
  if (!creds?.access_token_enc || !creds?.shop) return null;
  const token = decrypt(creds.access_token_enc);
  return new ShopifyIntegration(creds.shop, token);
}

// ── PUBLIC: OAuth callbacks (NO auth middleware) ───────────────────────────────

// GET /api/integrations/tiendanube/callback
router.get('/tiendanube/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/integraciones?error=missing_params`);
  }

  const stateData = consumeState(state);
  if (!stateData) {
    return res.redirect(`${FRONTEND_URL}/integraciones?error=invalid_state`);
  }

  const clientId = process.env.TIENDANUBE_CLIENT_ID;
  const clientSecret = process.env.TIENDANUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.redirect(`${FRONTEND_URL}/integraciones?error=not_configured`);
  }

  try {
    const tokenData = await TiendanubeIntegration.exchangeCodeForToken(clientId, clientSecret, code);
    const { access_token, user_id } = tokenData;

    await db.query(
      `UPDATE integrations
         SET is_active=true,
             credentials=$1::jsonb,
             sync_status='idle',
             sync_error=null,
             updated_at=NOW()
       WHERE platform='tiendanube'`,
      [JSON.stringify({
        access_token_enc: encrypt(access_token),
        store_id: String(user_id),
      })]
    );

    res.redirect(`${FRONTEND_URL}/integraciones?connected=tiendanube`);
  } catch (err) {
    console.error('[TN OAuth callback]', err.message);
    res.redirect(`${FRONTEND_URL}/integraciones?error=oauth_failed&platform=tiendanube`);
  }
});

// GET /api/integrations/shopify/callback
router.get('/shopify/callback', async (req, res) => {
  const { code, state, shop, hmac } = req.query;
  if (!code || !state || !shop) {
    return res.redirect(`${FRONTEND_URL}/integraciones?error=missing_params`);
  }

  const stateData = consumeState(state);
  if (!stateData) {
    return res.redirect(`${FRONTEND_URL}/integraciones?error=invalid_state`);
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.redirect(`${FRONTEND_URL}/integraciones?error=not_configured`);
  }

  // Verify HMAC to ensure the callback is from Shopify
  if (hmac && !ShopifyIntegration.verifyHmac(req.query, apiSecret)) {
    return res.redirect(`${FRONTEND_URL}/integraciones?error=hmac_invalid`);
  }

  try {
    const tokenData = await ShopifyIntegration.exchangeCodeForToken(shop, apiKey, apiSecret, code);
    const { access_token } = tokenData;

    await db.query(
      `UPDATE integrations
         SET is_active=true,
             credentials=$1::jsonb,
             sync_status='idle',
             sync_error=null,
             updated_at=NOW()
       WHERE platform='shopify'`,
      [JSON.stringify({
        access_token_enc: encrypt(access_token),
        shop,
      })]
    );

    res.redirect(`${FRONTEND_URL}/integraciones?connected=shopify`);
  } catch (err) {
    console.error('[Shopify OAuth callback]', err.message);
    res.redirect(`${FRONTEND_URL}/integraciones?error=oauth_failed&platform=shopify`);
  }
});

// ── AUTHENTICATED routes (all below require JWT) ──────────────────────────────
router.use(auth);

// GET /api/integrations
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, platform, is_active, last_sync, sync_status, sync_error, config, created_at, updated_at
         FROM integrations ORDER BY platform`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[integrations/GET]', err);
    res.status(500).json({ error: 'Error al obtener integraciones' });
  }
});

// GET /api/integrations/tiendanube/auth  → Start Tiendanube OAuth
router.get('/tiendanube/auth', (req, res) => {
  const clientId = process.env.TIENDANUBE_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: 'TIENDANUBE_CLIENT_ID no está configurado en el servidor' });
  }
  const state = generateState({ userId: req.user.id, platform: 'tiendanube' });
  const authUrl = TiendanubeIntegration.getAuthURL(clientId, state);
  res.json({ authUrl });
});

// GET /api/integrations/shopify/auth?shop=mystore.myshopify.com  → Start Shopify OAuth
router.get('/shopify/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Se requiere el parámetro "shop" (ej: mi-tienda.myshopify.com)' });

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'SHOPIFY_API_KEY no está configurado en el servidor' });
  }

  const redirectUri = process.env.SHOPIFY_REDIRECT_URI || 'http://localhost:3001/api/integrations/shopify/callback';
  const state = generateState({ userId: req.user.id, platform: 'shopify', shop });
  const authUrl = ShopifyIntegration.getAuthURL(shop, apiKey, redirectUri, state);
  res.json({ authUrl });
});

// GET /api/integrations/:platform
router.get('/:platform', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, platform, is_active, last_sync, sync_status, sync_error, config, created_at, updated_at
         FROM integrations WHERE platform = $1`,
      [req.params.platform]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Integración no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[integrations/GET/:platform]', err);
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/integrations/:platform/disconnect
router.put('/:platform/disconnect', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE integrations
         SET is_active=false, credentials=null, sync_status='idle', sync_error=null, updated_at=NOW()
       WHERE platform=$1
       RETURNING id, platform, is_active, sync_status, updated_at`,
      [req.params.platform]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Plataforma no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[integrations/disconnect]', err);
    res.status(500).json({ error: 'Error al desconectar' });
  }
});

// PUT /api/integrations/:platform/config
router.put('/:platform/config', async (req, res) => {
  try {
    const { config } = req.body;
    const result = await db.query(
      `UPDATE integrations SET config=$1::jsonb, updated_at=NOW()
       WHERE platform=$2
       RETURNING id, platform, is_active, config, updated_at`,
      [JSON.stringify(config), req.params.platform]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Plataforma no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[integrations/config]', err);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

// POST /api/integrations/:platform/sync
// Body: { sync_type: 'products' | 'orders' | 'stock' | 'full' }
router.post('/:platform/sync', async (req, res) => {
  const { platform } = req.params;
  const { sync_type = 'full' } = req.body;

  const integration = await getIntegrationWithCreds(platform);
  if (!integration) return res.status(404).json({ error: 'Plataforma no encontrada' });
  if (!integration.is_active) return res.status(400).json({ error: 'La integración no está activa. Conectar primero.' });

  // Create a log entry immediately so the UI can track it
  const logRes = await db.query(
    `INSERT INTO sync_logs (integration_id, sync_type, status, records_synced)
     VALUES ($1, $2, 'started', 0) RETURNING id`,
    [integration.id, sync_type]
  );
  const logId = logRes.rows[0].id;
  await markSyncing(integration.id);

  // Respond immediately; sync runs in background
  res.json({ message: 'Sincronización iniciada', log_id: logId, sync_type });

  // Async sync execution
  setImmediate(async () => {
    let totalRecords = 0;
    let errorMsg = null;

    try {
      const since = integration.last_sync
        ? new Date(integration.last_sync).toISOString()
        : null;

      if (platform === 'tiendanube') {
        const tn = buildTiendanube(integration);
        if (!tn) throw new Error('Credenciales de TiendaNube inválidas o incompletas');

        if (sync_type === 'products' || sync_type === 'full') {
          const r = await tn.syncProducts(db);
          totalRecords += r.created + r.updated;
        }
        if (sync_type === 'orders' || sync_type === 'full') {
          const r = await tn.syncOrders(db, since);
          totalRecords += r.created;
        }
        if (sync_type === 'stock') {
          const r = await tn.syncStockToTiendanube(db);
          totalRecords += r.updated;
        }

      } else if (platform === 'shopify') {
        const sh = buildShopify(integration);
        if (!sh) throw new Error('Credenciales de Shopify inválidas o incompletas');

        if (sync_type === 'products' || sync_type === 'full') {
          const r = await sh.syncProducts(db);
          totalRecords += r.created + r.updated;
        }
        if (sync_type === 'orders' || sync_type === 'full') {
          const r = await sh.syncOrders(db, since);
          totalRecords += r.created;
        }
        if (sync_type === 'stock') {
          const r = await sh.syncStockToShopify(db);
          totalRecords += r.updated;
        }

      } else {
        throw new Error(`Sincronización real no implementada para ${platform}`);
      }

      await db.query(
        `UPDATE sync_logs SET status='success', records_synced=$1, completed_at=NOW() WHERE id=$2`,
        [totalRecords, logId]
      );
      await markSyncDone(integration.id, 'success');

    } catch (err) {
      errorMsg = err.message;
      console.error(`[integrations/sync] ${platform}:`, err.message);
      await db.query(
        `UPDATE sync_logs SET status='error', error_message=$1, completed_at=NOW() WHERE id=$2`,
        [errorMsg, logId]
      );
      await markSyncDone(integration.id, 'error', errorMsg);
    }
  });
});

// POST /api/integrations/:platform/register-webhooks
router.post('/:platform/register-webhooks', async (req, res) => {
  const { platform } = req.params;
  const baseUrl = req.body.base_url || process.env.BACKEND_URL || 'http://localhost:3001';

  const integration = await getIntegrationWithCreds(platform);
  if (!integration) return res.status(404).json({ error: 'Plataforma no encontrada' });
  if (!integration.is_active) return res.status(400).json({ error: 'Integración no activa' });

  try {
    let results;
    if (platform === 'tiendanube') {
      const tn = buildTiendanube(integration);
      if (!tn) throw new Error('Credenciales inválidas');
      results = await tn.registerWebhooks(baseUrl);
    } else if (platform === 'shopify') {
      const sh = buildShopify(integration);
      if (!sh) throw new Error('Credenciales inválidas');
      results = await sh.registerWebhooks(baseUrl);
    } else {
      return res.status(400).json({ error: `Webhooks no implementados para ${platform}` });
    }
    res.json({ platform, webhooks: results });
  } catch (err) {
    console.error('[register-webhooks]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/:platform/logs
router.get('/:platform/logs', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const result = await db.query(
      `SELECT sl.* FROM sync_logs sl
         JOIN integrations i ON sl.integration_id = i.id
        WHERE i.platform = $1
        ORDER BY sl.created_at DESC LIMIT $2`,
      [req.params.platform, parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[integrations/logs]', err);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
});

module.exports = router;
