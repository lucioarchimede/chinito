require('dotenv').config({ path: require('path').join(__dirname, '../../server/.env') });
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./index');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🚀 Corriendo migración de funcionalidades avanzadas...');
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations/add-advanced-features.sql'),
      'utf-8'
    );
    await client.query(sql);
    console.log('✅ Migración completada exitosamente.');
    console.log('   Tablas creadas: goals, fixed_costs, integrations, sync_logs, bank_movements');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
