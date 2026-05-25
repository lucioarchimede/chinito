# Configuración de Integraciones — EcomDash V2

## Requisitos

```bash
cd server && npm install axios
```

Agregar variables en `server/.env` (copiar desde `.env.example`):

```bash
cp server/.env.example server/.env
```

---

## 1. Tiendanube

### Crear la app en Tiendanube Partners

1. Ir a [partners.tiendanube.com](https://partners.tiendanube.com) → Crear cuenta de partner
2. Crear nueva aplicación → Tipo: **Aplicación privada** (para tu propio uso) o **Pública**
3. En "OAuth redirect URIs" agregar:
   - Desarrollo: `http://localhost:3001/api/integrations/tiendanube/callback`
   - Producción: `https://tu-backend.railway.app/api/integrations/tiendanube/callback`
4. Permisos (scopes) requeridos:
   - `read_products`, `write_products`
   - `read_orders`
   - `write_stock`
5. Copiar **Client ID** y **Client Secret**

### Variables de entorno

```env
TIENDANUBE_CLIENT_ID=tu_client_id
TIENDANUBE_CLIENT_SECRET=tu_client_secret
```

### Flujo de conexión

1. En EcomDash ir a **Integraciones** → botón **Conectar con Tienda Nube**
2. Serás redirigido a TiendaNube para autorizar
3. Tras autorizar, volvés automáticamente a `/integraciones` con la integración activa
4. Hacer clic en **Sincronizar** → **Sincronización completa**

### Webhooks (opcional — sync en tiempo real)

Una vez conectado, registrar webhooks desde el panel de Integraciones → botón **Registrar webhooks** (o vía API):

```bash
curl -X POST http://localhost:3001/api/integrations/tiendanube/register-webhooks \
  -H "Authorization: Bearer TU_JWT" \
  -H "Content-Type: application/json" \
  -d '{"base_url": "https://tu-backend.railway.app"}'
```

Eventos registrados: `order/created`, `order/updated`, `product/updated`

---

## 2. Shopify

### Crear la app en Shopify Partners

1. Ir a [partners.shopify.com](https://partners.shopify.com) → Crear cuenta
2. **Apps** → **Create app** → **Create app manually**
3. En la app creada, ir a **Configuration** → **URLs**:
   - App URL: `https://tu-backend.railway.app`
   - Allowed redirection URL: `http://localhost:3001/api/integrations/shopify/callback`
     (y también la URL de producción)
4. En **API access** → **Admin API access scopes**:
   - `read_products`, `write_products`
   - `read_orders`
   - `read_inventory`, `write_inventory`
5. Copiar **API key** y **API secret key**

### Variables de entorno

```env
SHOPIFY_API_KEY=tu_api_key
SHOPIFY_API_SECRET=tu_api_secret
SHOPIFY_REDIRECT_URI=http://localhost:3001/api/integrations/shopify/callback
```

### Flujo de conexión

1. En EcomDash ir a **Integraciones** → botón **Conectar con Shopify**
2. Ingresar el dominio de la tienda (ej: `mi-tienda.myshopify.com`)
3. Serás redirigido a Shopify para autorizar
4. Tras autorizar, volvés automáticamente con la integración activa

### Webhooks (opcional)

```bash
curl -X POST http://localhost:3001/api/integrations/shopify/register-webhooks \
  -H "Authorization: Bearer TU_JWT" \
  -H "Content-Type: application/json" \
  -d '{"base_url": "https://tu-backend.railway.app"}'
```

Tópicos registrados: `orders/create`, `orders/updated`, `products/update`

---

## 3. Producción (Railway + Vercel)

### Variables en Railway (backend)

En el panel de Railway → Variables:

| Variable | Valor |
|---|---|
| `TIENDANUBE_CLIENT_ID` | tu client id |
| `TIENDANUBE_CLIENT_SECRET` | tu client secret |
| `SHOPIFY_API_KEY` | tu api key |
| `SHOPIFY_API_SECRET` | tu api secret |
| `SHOPIFY_REDIRECT_URI` | `https://TU-APP.railway.app/api/integrations/shopify/callback` |
| `ENCRYPTION_KEY` | string aleatorio 32+ chars |
| `FRONTEND_URL` | `https://TU-APP.vercel.app` |
| `BACKEND_URL` | `https://TU-APP.railway.app` |

### Actualizar redirect URIs

En los paneles de Tiendanube Partners y Shopify Partners, agregar la URL de producción del backend como redirect URI permitida.

---

## Lógica de sincronización

### Productos (plataforma → EcomDash)
- Busca cada variante por **SKU**
- Si existe: actualiza `precio_venta` y `stock_actual`
- Si no existe: crea el producto

### Pedidos (plataforma → EcomDash)
- Solo importa pedidos con `financial_status = paid`
- Deduplica por `ref tag` en el campo `notes` de cada venta
- Crea una venta en `sales` y un movimiento de stock en `stock_movements`

### Stock (EcomDash → plataforma)
- Sync type `stock`: envía `stock_actual` local hacia la plataforma
- Útil tras ajustes manuales de inventario en EcomDash

### Rate limiting
- Tiendanube: 40 req/min → 1.5 s entre llamadas paginadas
- Shopify: 2 req/s steady → 500 ms entre llamadas paginadas

---

## Seguridad

- Los tokens de acceso se **encriptan con AES-256-CBC** antes de guardarse en la DB
- Los estados OAuth son de **un solo uso** y expiran en 5 minutos
- Los webhooks de Shopify se validan con **HMAC-SHA256** usando `SHOPIFY_API_SECRET`
- Los webhooks de Tiendanube no tienen firma — se acepta cualquier request al endpoint

---

## Troubleshooting

| Error | Causa | Solución |
|---|---|---|
| `TIENDANUBE_CLIENT_ID no está configurado` | Variable de entorno vacía | Completar en `.env` |
| `invalid_state` al volver del OAuth | El state expiró (>5 min) o fue reutilizado | Volver a hacer clic en Conectar |
| `hmac_invalid` (Shopify) | `SHOPIFY_API_SECRET` incorrecto | Verificar la variable |
| `Credenciales inválidas o incompletas` al sincronizar | La integración está activa pero sin token (raro) | Desconectar y reconectar |
| `oauth_failed` | Error al intercambiar el code por el token | Verificar Client ID/Secret y redirect URI |
