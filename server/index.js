require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS not allowed for: ' + origin));
  },
  credentials: true,
}));

// Webhook routes use express.raw() internally — mount BEFORE express.json()
// so their body parser middleware takes effect first for those paths.
app.use('/api/webhooks', require('./routes/webhooks'));

app.use(express.json());
app.use(express.text({ type: 'text/plain', limit: '5mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/cash-flow', require('./routes/cash_flow'));
app.use('/api/marketing', require('./routes/marketing'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/breakeven', require('./routes/breakeven'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/reconciliation', require('./routes/reconciliation'));

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`));
