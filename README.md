# EcomDash V2

Dashboard de ecommerce con Node.js + Express + PostgreSQL + React 18 + Vite.

## Stack

- **Backend**: Node.js + Express → Railway
- **Base de datos**: PostgreSQL → Railway
- **Frontend**: React 18 + Vite + Tailwind CSS → Vercel
- **Auth**: JWT + bcrypt

---

## Setup local

### 1. Instalar dependencias

```bash
npm run install:all
```

### 2. Configurar variables de entorno

```bash
cp .env.example server/.env
# Edita server/.env con tu DATABASE_URL y JWT_SECRET

cp .env.example client/.env.local
# Edita client/.env.local con VITE_API_URL=http://localhost:3001/api
```

### 3. Crear base de datos PostgreSQL local

```bash
createdb ecomdash
```

### 4. Correr el schema y seed

```bash
npm run db:schema
npm run db:seed
```

Esto crea las tablas e inserta:
- Usuario admin: `admin@ecomdash.com` / `admin123`
- Usuario socio: `socio@ecomdash.com` / `socio123`
- 15 productos de ejemplo
- ~80 ventas de los últimos 3 meses
- Gastos, stock, cash flow, marketing y notas de ejemplo

### 5. Correr en desarrollo

```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:client
```

Frontend: http://localhost:5173  
Backend API: http://localhost:3001

---

## Deployment

### Backend + DB en Railway

1. Crear nuevo proyecto en [Railway](https://railway.app)
2. Agregar servicio PostgreSQL
3. Agregar servicio desde GitHub (apuntar a `/server`)
4. Configurar variables de entorno:
   ```
   DATABASE_URL=<from Railway PostgreSQL>
   JWT_SECRET=<strong random string>
   FRONTEND_URL=https://your-app.vercel.app
   NODE_ENV=production
   PORT=3001
   ```
5. Railway auto-detecta el `npm start` del `server/package.json`
6. Una vez deployado, correr el seed:
   ```bash
   # Desde Railway CLI o en el shell del servicio:
   node db/seed.js
   ```

### Frontend en Vercel

1. Importar repo en [Vercel](https://vercel.com)
2. **Root Directory**: `client`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. Agregar variable de entorno:
   ```
   VITE_API_URL=https://your-backend.railway.app/api
   ```
6. El `vercel.json` en la raíz maneja el routing de React Router

---

## Estructura del proyecto

```
ecomdash-v2/
├── server/
│   ├── index.js              # Entry point Express
│   ├── db/
│   │   ├── index.js          # Pool PostgreSQL
│   │   ├── schema.sql        # Tablas y índices
│   │   ├── seed.sql          # Datos de ejemplo (sin usuarios)
│   │   └── seed.js           # Script completo (schema + usuarios + data)
│   ├── middleware/
│   │   └── auth.js           # Verificación JWT
│   └── routes/
│       ├── auth.js           # Login, register, me
│       ├── products.js       # CRUD productos
│       ├── sales.js          # CRUD ventas
│       ├── expenses.js       # CRUD gastos
│       ├── stock.js          # Movimientos de stock
│       ├── clients.js        # Analytics de clientes
│       ├── cash_flow.js      # Cash flow
│       ├── marketing.js      # Métricas de marketing
│       ├── notes.js          # Notas de negocio
│       ├── dashboard.js      # 51 métricas del dashboard
│       └── reports.js        # Reportes exportables
└── client/
    └── src/
        ├── pages/            # 12 páginas completas
        ├── components/       # UI reutilizable + Layout
        ├── context/          # AuthContext
        └── utils/            # api.js + formatters.js
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Registro |
| GET | /api/auth/me | Usuario actual |
| GET/POST | /api/products | Listar/crear productos |
| GET/PUT/DELETE | /api/products/:id | Leer/editar/eliminar producto |
| GET/POST | /api/sales | Listar/crear ventas |
| GET/POST | /api/expenses | Listar/crear gastos |
| GET/POST | /api/stock | Movimientos de stock |
| GET | /api/stock/levels | Niveles actuales de stock |
| GET | /api/stock/alerts | Productos bajo mínimo |
| GET | /api/clients | Lista de clientes |
| GET | /api/clients/stats | Estadísticas CLV, retención |
| GET/POST | /api/cash-flow | Cash flow |
| GET/POST | /api/marketing | Métricas de marketing |
| GET/POST | /api/notes | Notas |
| GET | /api/dashboard | 51 métricas (con ?start_date=&end_date=) |
| GET | /api/dashboard/chart | Datos del gráfico de revenue |
| GET | /api/dashboard/top-products | Top productos |
| GET | /api/reports/sales | Reporte de ventas (CSV) |
| GET | /api/reports/expenses | Reporte de gastos (CSV) |
| GET | /api/reports/products | Reporte de productos (CSV) |
