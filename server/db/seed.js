require('dotenv').config({ path: require('path').join(__dirname, '../../server/.env') });
require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const pool = require('./index');
 
async function seed() {
  const client = await pool.connect();
  try {
    console.log('1/4 Corriendo schema base...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schema);

    console.log('2/4 Corriendo migración de funcionalidades avanzadas...');
    const advanced = fs.readFileSync(path.join(__dirname, 'migrations/add-advanced-features.sql'), 'utf-8');
    await client.query(advanced);

    console.log('3/4 Creando usuarios...');
    const adminHash = await bcrypt.hash('admin123', 10);
    const socioHash = await bcrypt.hash('socio123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, name, role) VALUES
        ('admin@ecomdash.com', $1, 'Administrador', 'admin'),
        ('socio@ecomdash.com', $2, 'Socio', 'socio')
      ON CONFLICT (email) DO NOTHING
    `, [adminHash, socioHash]);

    console.log('4/4 Insertando datos de ejemplo...');
    const seedSQL = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
    await client.query(seedSQL);

    console.log('✅ Base de datos inicializada correctamente.');
    console.log('   admin@ecomdash.com / admin123');
    console.log('   socio@ecomdash.com / socio123');
    console.log('\n   Para verificar coherencia: node server/db/validate-coherence.js');
  } catch (err) {
    console.error('❌ Error en seed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
