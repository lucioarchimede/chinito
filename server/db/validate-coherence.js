/**
 * validate-coherence.js
 * Verifica la coherencia de los datos del seed contra las reglas de negocio.
 * Uso: node server/db/validate-coherence.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config();
const pool = require('./index');

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️ ';

let failures = 0;
let warnings = 0;

function log(icon, label, detail = '') {
  console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ''}`);
  if (icon === FAIL) failures++;
  if (icon === WARN) warnings++;
}

async function check(label, query, params, validator) {
  const res = await pool.query(query, params);
  return validator(res.rows, label);
}

async function run() {
  console.log('\n🔍 EcomDash V2 — Validación de coherencia de datos\n');
  const client = await pool.connect();

  try {
    // ── 1. PRODUCTOS ──────────────────────────────────────────────────────────
    console.log('📦 PRODUCTOS');

    const products = await client.query(`SELECT id, sku, nombre, stock_actual, stock_minimo, precio_costo, precio_venta FROM products`);
    log(PASS, `${products.rows.length} productos encontrados`);

    products.rows.forEach(p => {
      if (parseFloat(p.precio_venta) <= parseFloat(p.precio_costo)) {
        log(WARN, `Precio venta ≤ costo en ${p.sku}`, `costo=${p.precio_costo} venta=${p.precio_venta}`);
      }
      if (p.stock_actual < 0) {
        log(FAIL, `Stock negativo en ${p.sku}`, `stock=${p.stock_actual}`);
      }
    });
    if (failures === 0 && warnings === 0) log(PASS, 'Todos los precios y stocks válidos');

    // ── 2. STOCK COHERENCIA ──────────────────────────────────────────────────
    console.log('\n📊 COHERENCIA STOCK');

    const stockCheck = await client.query(`
      SELECT p.sku, p.nombre, p.stock_actual,
        COALESCE(SUM(
          CASE sm.movement_type
            WHEN 'entrada' THEN sm.quantity
            WHEN 'salida'  THEN -sm.quantity
            WHEN 'ajuste'  THEN sm.quantity
          END
        ), 0)::int AS computed_stock
      FROM products p
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      GROUP BY p.id, p.sku, p.nombre, p.stock_actual
      ORDER BY p.sku
    `);

    let stockOk = true;
    stockCheck.rows.forEach(r => {
      if (r.stock_actual !== r.computed_stock) {
        log(FAIL, `Stock inconsistente: ${r.sku}`,
          `en BD=${r.stock_actual}, calculado desde movimientos=${r.computed_stock}`);
        stockOk = false;
      }
    });
    if (stockOk) log(PASS, 'stock_actual coincide con movimientos para todos los productos');

    // ── 3. VENTAS ─────────────────────────────────────────────────────────────
    console.log('\n🛒 VENTAS');

    const sales = await client.query(`
      SELECT id, sale_date, product_id, quantity, unit_price, discount,
        mp_commission, mp_tax, shipping_cost, final_revenue
      FROM sales ORDER BY sale_date
    `);
    log(PASS, `${sales.rows.length} ventas encontradas`);

    let salesCoherent = true;
    sales.rows.forEach(s => {
      const expected = parseFloat(s.quantity) * parseFloat(s.unit_price)
        - parseFloat(s.discount)
        - parseFloat(s.mp_commission)
        - parseFloat(s.mp_tax)
        - parseFloat(s.shipping_cost);
      const actual = parseFloat(s.final_revenue);
      if (Math.abs(expected - actual) > 0.02) {
        log(FAIL, `final_revenue incorrecto en venta ID=${s.id} (${s.sale_date})`,
          `esperado=${expected.toFixed(2)}, real=${actual.toFixed(2)}`);
        salesCoherent = false;
      }
      if (actual < 0) {
        log(FAIL, `final_revenue negativo en venta ID=${s.id}`, `valor=${actual}`);
        salesCoherent = false;
      }
    });
    if (salesCoherent) log(PASS, 'Fórmula final_revenue correcta en todas las ventas');

    const orphanSales = await client.query(`SELECT id FROM sales WHERE product_id IS NULL`);
    if (orphanSales.rows.length > 0) {
      log(WARN, `${orphanSales.rows.length} ventas sin product_id (producto eliminado)`,
        `IDs: ${orphanSales.rows.map(r => r.id).join(', ')}`);
    } else {
      log(PASS, 'Todas las ventas tienen product_id válido');
    }

    const negativeRevenue = await client.query(`SELECT COUNT(*) AS n FROM sales WHERE final_revenue < 0`);
    if (parseInt(negativeRevenue.rows[0].n) > 0) {
      log(FAIL, `${negativeRevenue.rows[0].n} ventas con final_revenue negativo`);
    } else {
      log(PASS, 'Sin ventas con revenue negativo');
    }

    // ── 4. GASTOS ─────────────────────────────────────────────────────────────
    console.log('\n💸 GASTOS');

    const expenses = await client.query(`SELECT COUNT(*) AS n, SUM(amount) AS total FROM expenses`);
    const expRow = expenses.rows[0];
    log(PASS, `${expRow.n} gastos, total $${parseFloat(expRow.total).toLocaleString('es-AR')}`);

    const negExpenses = await client.query(`SELECT COUNT(*) AS n FROM expenses WHERE amount < 0`);
    if (parseInt(negExpenses.rows[0].n) > 0) {
      log(FAIL, 'Gastos con monto negativo detectados');
    } else {
      log(PASS, 'Todos los montos de gastos son positivos');
    }

    // ── 5. METAS ──────────────────────────────────────────────────────────────
    console.log('\n🎯 METAS');

    const goals = await client.query(`SELECT * FROM goals ORDER BY period_start`);
    log(PASS, `${goals.rows.length} metas encontradas`);

    // Verificar solapamiento de períodos
    for (let i = 0; i < goals.rows.length - 1; i++) {
      const a = goals.rows[i];
      const b = goals.rows[i + 1];
      if (a.period_end >= b.period_start) {
        log(WARN, 'Metas con períodos solapados',
          `"${a.period_start}→${a.period_end}" solapa con "${b.period_start}→${b.period_end}"`);
      }
    }

    // Meta activa hoy
    const today = new Date().toISOString().split('T')[0];
    const activeGoals = goals.rows.filter(g => g.period_start <= today && g.period_end >= today);
    if (activeGoals.length === 0) {
      log(WARN, 'No hay meta activa para el día de hoy');
    } else if (activeGoals.length > 1) {
      log(WARN, `${activeGoals.length} metas activas simultáneamente para hoy`);
    } else {
      log(PASS, `Meta activa: ${activeGoals[0].period_start} → ${activeGoals[0].period_end}`,
        `target=$${parseFloat(activeGoals[0].target_revenue).toLocaleString('es-AR')}`);
    }

    // ── 6. COSTOS FIJOS ───────────────────────────────────────────────────────
    console.log('\n🏛️  COSTOS FIJOS');

    const fixedCosts = await client.query(`SELECT * FROM fixed_costs WHERE is_active = true`);
    const monthlyTotal = fixedCosts.rows.reduce((sum, fc) => {
      const m = fc.frequency === 'monthly' ? parseFloat(fc.amount)
        : fc.frequency === 'quarterly' ? parseFloat(fc.amount) / 3
        : parseFloat(fc.amount) / 12;
      return sum + m;
    }, 0);
    log(PASS, `${fixedCosts.rows.length} costos fijos activos, total mensual: $${monthlyTotal.toLocaleString('es-AR')}`);

    if (monthlyTotal <= 0) {
      log(FAIL, 'Total de costos fijos mensualizados es cero o negativo');
    }

    // Verificar que break-even es razonable respecto al revenue mensual
    const monthRevenue = await client.query(`
      SELECT COALESCE(AVG(monthly_rev), 0) AS avg_monthly
      FROM (
        SELECT DATE_TRUNC('month', sale_date) AS month, SUM(final_revenue) AS monthly_rev
        FROM sales GROUP BY 1
      ) t
    `);
    const avgMonthly = parseFloat(monthRevenue.rows[0].avg_monthly);
    const beRatio = avgMonthly > 0 ? (monthlyTotal / avgMonthly) * 100 : 0;
    if (beRatio > 95) {
      log(WARN, `Break-even muy alto: costos fijos = ${beRatio.toFixed(0)}% del revenue mensual promedio`,
        `Avg revenue/mes: $${avgMonthly.toFixed(0)}`);
    } else {
      log(PASS, `Break-even razonable: costos fijos = ${beRatio.toFixed(0)}% del revenue mensual`,
        `Avg revenue/mes: $${avgMonthly.toFixed(0)}`);
    }

    // ── 7. CONCILIACIÓN BANCARIA ──────────────────────────────────────────────
    console.log('\n🏦 CONCILIACIÓN BANCARIA');

    const bankStats = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE type='credit') AS credits,
        COUNT(*) FILTER (WHERE type='debit') AS debits,
        COUNT(*) FILTER (WHERE is_matched) AS matched,
        COUNT(*) FILTER (WHERE NOT is_matched AND NOT is_ignored) AS pending
      FROM bank_movements
    `);
    const bs = bankStats.rows[0];
    log(PASS, `${bs.total} movimientos: ${bs.credits} créditos, ${bs.debits} débitos`);
    log(PASS, `${bs.matched} ya conciliados, ${bs.pending} pendientes`);

    // Verificar que matched_sale_id apunta a ventas válidas
    const badMatches = await client.query(`
      SELECT bm.id FROM bank_movements bm
      WHERE bm.matched_sale_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.id = bm.matched_sale_id)
    `);
    if (badMatches.rows.length > 0) {
      log(FAIL, `${badMatches.rows.length} bank_movements con matched_sale_id inválido`);
    } else {
      log(PASS, 'Todos los matched_sale_id apuntan a ventas válidas (o son null)');
    }

    // Verificar créditos pendientes que podrían auto-matchear
    const autoMatchable = await client.query(`
      SELECT bm.id, bm.amount, bm.transaction_date, s.id AS sale_id, s.final_revenue, s.sale_date
      FROM bank_movements bm
      JOIN sales s ON ABS(s.final_revenue - bm.amount) <= 0.50
        AND ABS(s.sale_date - bm.transaction_date) <= 3
      WHERE bm.type = 'credit' AND NOT bm.is_matched AND NOT bm.is_ignored
        AND s.id NOT IN (SELECT matched_sale_id FROM bank_movements WHERE matched_sale_id IS NOT NULL)
      LIMIT 10
    `);
    if (autoMatchable.rows.length > 0) {
      log(PASS, `${autoMatchable.rows.length} movimientos bancarios listos para auto-conciliación`);
    } else {
      log(WARN, 'No se encontraron pares auto-conciliables (verificar tolerancias)');
    }

    // ── 8. INTEGRACIONES ──────────────────────────────────────────────────────
    console.log('\n🔌 INTEGRACIONES');

    const integrations = await client.query(`SELECT platform, is_active, sync_status FROM integrations`);
    if (integrations.rows.length === 3) {
      log(PASS, 'Las 3 plataformas (tiendanube, shopify, mercadolibre) están registradas');
    } else {
      log(WARN, `Se esperaban 3 integraciones, hay ${integrations.rows.length}`);
    }

    // ── 9. CASH FLOW COHERENCIA ───────────────────────────────────────────────
    console.log('\n💰 CASH FLOW');

    const cfStats = await client.query(`
      SELECT
        SUM(amount) FILTER (WHERE type='ingreso' AND NOT is_projected) AS real_ingresos,
        SUM(amount) FILTER (WHERE type='egreso'  AND NOT is_projected) AS real_egresos
      FROM cash_flow
    `);
    const cf = cfStats.rows[0];
    const balance = parseFloat(cf.real_ingresos) - parseFloat(cf.real_egresos);
    log(PASS, `Ingresos reales: $${parseFloat(cf.real_ingresos).toLocaleString('es-AR')}`);
    log(PASS, `Egresos reales:  $${parseFloat(cf.real_egresos).toLocaleString('es-AR')}`);
    if (balance >= 0) {
      log(PASS, `Balance real positivo: $${balance.toLocaleString('es-AR')}`);
    } else {
      log(WARN, `Balance real negativo: $${balance.toLocaleString('es-AR')}`);
    }

    // Coherencia: ingresos cash_flow vs revenue ventas reales
    const salesRevTotal = await client.query(`SELECT COALESCE(SUM(final_revenue),0) AS total FROM sales`);
    const salesTotal = parseFloat(salesRevTotal.rows[0].total);
    const cfIngresos = parseFloat(cf.real_ingresos);
    const revDiff = Math.abs(salesTotal - cfIngresos);
    const revDiffPct = salesTotal > 0 ? (revDiff / salesTotal) * 100 : 100;
    if (revDiffPct > 20) {
      log(WARN, `Ingresos cash_flow difieren >20% del revenue real de ventas`,
        `Cash flow: $${cfIngresos.toFixed(0)}, Ventas: $${salesTotal.toFixed(0)}, diff: ${revDiffPct.toFixed(1)}%`);
    } else {
      log(PASS, `Ingresos cash_flow consistentes con revenue de ventas`,
        `diff: ${revDiffPct.toFixed(1)}%`);
    }

    // ── 10. MARKETING COHERENCIA ──────────────────────────────────────────────
    console.log('\n📣 MARKETING');

    const mkt = await client.query(`SELECT COUNT(*) AS n, SUM(spend) AS total_spend, SUM(revenue) AS attributed FROM marketing_metrics`);
    const mktRow = mkt.rows[0];
    log(PASS, `${mktRow.n} registros de marketing`);
    log(PASS, `Gasto total: $${parseFloat(mktRow.total_spend).toLocaleString('es-AR')} | Revenue atribuido: $${parseFloat(mktRow.attributed).toLocaleString('es-AR')}`);

    const badRoas = await client.query(`
      SELECT id, channel, spend, revenue, roas FROM marketing_metrics
      WHERE ABS(revenue / NULLIF(spend, 0) - roas) > 0.1
    `);
    if (badRoas.rows.length > 0) {
      badRoas.rows.forEach(r => {
        log(WARN, `ROAS incoherente en marketing ID=${r.id} (${r.channel})`,
          `roas declarado=${r.roas}, calculado=${(r.revenue/r.spend).toFixed(2)}`);
      });
    } else {
      log(PASS, 'ROAS consistente con spend/revenue en todos los registros');
    }

    // ── RESUMEN ───────────────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(55));
    console.log(`📋 RESUMEN: ${failures === 0 && warnings === 0 ? '✅ Datos 100% coherentes' : ''}`);
    console.log(`   Errores:    ${failures}`);
    console.log(`   Advertencias: ${warnings}`);
    if (failures > 0) {
      console.log('\n   ⚠️  Corregir los errores antes de usar en producción.');
      process.exitCode = 1;
    } else if (warnings > 0) {
      console.log('\n   ℹ️  Revisar advertencias — pueden ser esperadas.');
    } else {
      console.log('\n   🎉 Todos los chequeos pasaron. Datos listos para usar.');
    }
    console.log('');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Error ejecutando validación:', err.message);
  process.exit(1);
});
