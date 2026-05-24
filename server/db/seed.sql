-- EcomDash V2 - Seed data (sin usuarios, esos se insertan via seed.js)

-- Productos (negocio de velas, perfumes y aromas)
INSERT INTO products (sku, nombre, descripcion, categoria, proveedor, aroma, variant, precio_costo, precio_venta, import_cost_per_unit, packaging_cost, stock_actual, stock_minimo, lot_number)
VALUES
  ('CND-001-GR', 'Vela Aromática Grande', 'Vela de soja con mecha de algodón, 300g', 'Velas', 'Aromas del Sur', 'Lavanda', 'Grande 300g', 800, 2500, 200, 150, 45, 10, 'L2024-001'),
  ('CND-002-ME', 'Vela Aromática Mediana', 'Vela de soja con mecha de algodón, 180g', 'Velas', 'Aromas del Sur', 'Vainilla', 'Mediana 180g', 550, 1800, 150, 100, 62, 15, 'L2024-002'),
  ('CND-003-CH', 'Vela Aromática Chica', 'Vela de soja con mecha de algodón, 80g', 'Velas', 'Aromas del Sur', 'Rosa', 'Chica 80g', 320, 1100, 80, 70, 88, 20, 'L2024-003'),
  ('CND-004-GR', 'Vela Aromática Grande', 'Vela de soja premium con pabilo doble', 'Velas', 'Aromas del Sur', 'Sándalo', 'Grande 300g', 850, 2700, 200, 150, 28, 10, 'L2024-004'),
  ('PRF-001-50', 'Perfume Floral 50ml', 'Perfume artesanal base flores de primavera', 'Perfumes', 'Essence Pro', 'Floral', '50ml', 2200, 6500, 800, 300, 35, 8, 'P2024-001'),
  ('PRF-002-100', 'Perfume Oriental 100ml', 'Perfume artesanal con notas orientales', 'Perfumes', 'Essence Pro', 'Oriental', '100ml', 3800, 9500, 1500, 400, 22, 5, 'P2024-002'),
  ('PRF-003-30', 'Perfume Citrus 30ml', 'Perfume fresco cítrico para uso diario', 'Perfumes', 'Essence Pro', 'Citrus', '30ml', 1500, 4200, 600, 250, 41, 10, 'P2024-003'),
  ('DIF-001-EU', 'Difusor Eucalipto 200ml', 'Difusor de ambiente con varillas de ratán', 'Difusores', 'Wellness Home', 'Eucalipto', '200ml', 900, 2800, 350, 200, 30, 8, 'D2024-001'),
  ('DIF-002-BE', 'Difusor Bergamota 200ml', 'Difusor de ambiente premium', 'Difusores', 'Wellness Home', 'Bergamota', '200ml', 950, 2900, 380, 200, 18, 8, 'D2024-002'),
  ('SAP-001-AV', 'Jabón Artesanal Avena', 'Jabón natural con avena y miel, 100g', 'Jabones', 'Natural Craft', 'Natural', '100g', 280, 850, 0, 80, 75, 25, 'J2024-001'),
  ('SAP-002-ME', 'Jabón Artesanal Menta', 'Jabón refrescante con aceite de menta, 100g', 'Jabones', 'Natural Craft', 'Menta', '100g', 260, 820, 0, 80, 95, 25, 'J2024-002'),
  ('KIT-001-PR', 'Kit Regalo Premium', 'Kit con vela grande + perfume 30ml + jabón', 'Kits', 'Interno', 'Mixto', 'Premium', 3800, 9800, 0, 600, 15, 5, NULL),
  ('KIT-002-RL', 'Kit Relax', 'Kit con vela mediana + difusor + jabón', 'Kits', 'Interno', 'Lavanda', 'Relax', 2200, 5500, 0, 400, 20, 5, NULL),
  ('ACC-001-PC', 'Porta Vela Cristal', 'Portavelas de cristal borosilicato', 'Accesorios', 'ImportAr', NULL, 'Cristal', 600, 1800, 400, 0, 40, 10, NULL),
  ('ESN-001-10', 'Esencia Pura 10ml', 'Aceite esencial 100% puro, lavanda', 'Esencias', 'Pure Oils', 'Lavanda', '10ml', 450, 1400, 250, 50, 55, 15, 'E2024-001')
ON CONFLICT (sku) DO NOTHING;

-- Ventas (últimos 3 meses)
INSERT INTO sales (sale_date, product_id, quantity, unit_price, gross_sales, discount, net_sales, mp_commission, mp_tax, shipping_cost, final_revenue, customer_name, customer_email, customer_phone, is_repeat_customer, sale_channel, payment_method, notes)
SELECT
  d.sale_date, d.product_id, d.qty, d.price,
  d.qty * d.price,
  d.disc,
  d.qty * d.price - d.disc,
  d.mp_comm,
  d.mp_tax,
  d.ship,
  d.qty * d.price - d.disc - d.mp_comm - d.mp_tax - d.ship,
  d.cname, d.cemail, d.cphone, d.repeat_c, d.channel, d.pay_method, d.snotes
FROM (VALUES
  (CURRENT_DATE - 88, 1, 2, 2500, 0, 287.5, 75, 0, 'María González', 'mgonzalez@mail.com', '1145678901', false, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 85, 5, 1, 6500, 500, 0, 0, 0, 'Carlos Rodríguez', 'crodriguez@mail.com', '1156789012', false, 'Instagram', 'Transferencia', 'Compra por DM'),
  (CURRENT_DATE - 83, 2, 3, 1800, 0, 207, 54, 180, 'Ana Martínez', 'amartinez@mail.com', '1167890123', false, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 80, 12, 1, 9800, 0, 0, 0, 0, 'Luis Fernández', 'lfernandez@mail.com', '1178901234', false, 'WhatsApp', 'Efectivo', 'Regalo corporativo'),
  (CURRENT_DATE - 78, 3, 5, 1100, 550, 0, 0, 150, 'Sofía López', 'slopez@mail.com', '1189012345', false, 'TiendaNube', 'Tarjeta', NULL),
  (CURRENT_DATE - 75, 7, 2, 4200, 0, 0, 0, 0, 'Martín Díaz', 'mdiaz@mail.com', '1190123456', false, 'WhatsApp', 'Transferencia', NULL),
  (CURRENT_DATE - 73, 8, 1, 2800, 0, 322, 84, 0, 'Laura Sánchez', 'lsanchez@mail.com', '1101234567', false, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 70, 1, 1, 2500, 0, 287.5, 75, 0, 'María González', 'mgonzalez@mail.com', '1145678901', true, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 68, 10, 4, 850, 0, 0, 0, 200, 'Juan Torres', 'jtorres@mail.com', '1112345678', false, 'TiendaNube', 'Tarjeta', NULL),
  (CURRENT_DATE - 65, 6, 1, 9500, 950, 0, 0, 0, 'Valentina Ruiz', 'vruiz@mail.com', '1123456789', false, 'Instagram', 'Transferencia', 'Descuento especial 10%'),
  (CURRENT_DATE - 63, 13, 2, 5500, 0, 0, 0, 300, 'Diego Morales', 'dmorales@mail.com', '1134567890', false, 'WhatsApp', 'Efectivo', NULL),
  (CURRENT_DATE - 60, 4, 1, 2700, 0, 310.5, 81, 0, 'Camila Herrera', 'cherrera@mail.com', '1145678902', false, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 58, 11, 6, 820, 0, 0, 0, 250, 'Roberto Castro', 'rcastro@mail.com', '1156789013', false, 'TiendaNube', 'Tarjeta', NULL),
  (CURRENT_DATE - 55, 5, 2, 6500, 0, 747.5, 195, 0, 'Fernanda Jiménez', 'fjimenez@mail.com', '1167890124', false, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 53, 14, 3, 1800, 300, 0, 0, 0, 'Nicolás Vargas', 'nvargas@mail.com', '1178901235', false, 'WhatsApp', 'Transferencia', NULL),
  (CURRENT_DATE - 50, 2, 2, 1800, 0, 207, 54, 180, 'Ana Martínez', 'amartinez@mail.com', '1167890123', true, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 48, 12, 2, 9800, 980, 0, 0, 0, 'Paola Reyes', 'preyes@mail.com', '1189012346', false, 'Instagram', 'Transferencia', 'Compra corporativa, desc 5%'),
  (CURRENT_DATE - 45, 9, 1, 2900, 0, 333.5, 87, 0, 'Santiago Flores', 'sflores@mail.com', '1190123457', false, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 43, 15, 3, 1400, 0, 0, 0, 150, 'Lucía Ramírez', 'lramirez@mail.com', '1101234568', false, 'TiendaNube', 'Tarjeta', NULL),
  (CURRENT_DATE - 40, 1, 4, 2500, 0, 1150, 300, 250, 'Carlos Rodríguez', 'crodriguez@mail.com', '1156789012', true, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 38, 3, 3, 1100, 0, 0, 0, 0, 'Gonzalo Medina', 'gmedina@mail.com', '1112345679', false, 'WhatsApp', 'Efectivo', NULL),
  (CURRENT_DATE - 35, 7, 1, 4200, 0, 483, 126, 0, 'Isabella Romero', 'iromero@mail.com', '1123456790', false, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 33, 13, 1, 5500, 275, 0, 0, 0, 'Felipe Ortega', 'fortega@mail.com', '1134567891', false, 'Instagram', 'Transferencia', 'Referido'),
  (CURRENT_DATE - 30, 6, 1, 9500, 0, 1092.5, 285, 0, 'Valentina Ruiz', 'vruiz@mail.com', '1123456789', true, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 28, 10, 8, 850, 680, 0, 0, 350, 'Mariana Silva', 'msilva@mail.com', '1145678903', false, 'TiendaNube', 'Tarjeta', 'Compra al por mayor, desc 10%'),
  (CURRENT_DATE - 25, 4, 2, 2700, 0, 621, 162, 0, 'Tomás Aguilar', 'taguilar@mail.com', '1156789014', false, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 23, 11, 5, 820, 0, 0, 0, 200, 'Claudia Mendoza', 'cmendoza@mail.com', '1167890125', false, 'WhatsApp', 'Transferencia', NULL),
  (CURRENT_DATE - 20, 5, 1, 6500, 0, 747.5, 195, 0, 'María González', 'mgonzalez@mail.com', '1145678901', true, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 18, 12, 1, 9800, 0, 0, 0, 0, 'Alejandro Suárez', 'asuarez@mail.com', '1178901236', false, 'Instagram', 'Efectivo', 'Pago en persona'),
  (CURRENT_DATE - 15, 2, 4, 1800, 720, 207, 54, 180, 'Laura Sánchez', 'lsanchez@mail.com', '1101234567', true, 'MercadoLibre', 'MercadoPago', 'Descuento cliente fiel 10%'),
  (CURRENT_DATE - 13, 8, 2, 2800, 0, 644, 168, 0, 'Juan Torres', 'jtorres@mail.com', '1112345678', true, 'MercadoLibre', 'MercadoPago', NULL),
  (CURRENT_DATE - 10, 3, 10, 1100, 1100, 0, 0, 450, 'Empresa ABC', 'ventas@empresaabc.com', '1134567892', false, 'WhatsApp', 'Transferencia', 'Orden corporativa'),
  (CURRENT_DATE - 8, 15, 5, 1400, 0, 0, 0, 200, 'Nicolás Vargas', 'nvargas@mail.com', '1178901235', true, 'TiendaNube', 'Tarjeta', NULL),
  (CURRENT_DATE - 5, 1, 2, 2500, 250, 287.5, 75, 0, 'Rodrigo Gutiérrez', 'rgutierrez@mail.com', '1189012347', false, 'MercadoLibre', 'MercadoPago', 'Desc bienvenida 5%'),
  (CURRENT_DATE - 3, 13, 3, 5500, 0, 0, 0, 0, 'María González', 'mgonzalez@mail.com', '1145678901', true, 'WhatsApp', 'Transferencia', 'Cliente VIP'),
  (CURRENT_DATE - 1, 7, 2, 4200, 0, 966, 252, 0, 'Fernanda Jiménez', 'fjimenez@mail.com', '1167890124', true, 'MercadoLibre', 'MercadoPago', NULL)
) AS d(sale_date, product_id, qty, price, disc, mp_comm, mp_tax, ship, cname, cemail, cphone, repeat_c, channel, pay_method, snotes);

-- Gastos
INSERT INTO expenses (expense_date, category, subcategory, description, amount, is_recurring, payment_method, supplier, invoice_number, notes)
VALUES
  (CURRENT_DATE - 85, 'marketing', 'redes_sociales', 'Publicidad Instagram - Campaña Invierno', 15000, false, 'Tarjeta', 'Meta Ads', 'INV-2024-001', NULL),
  (CURRENT_DATE - 82, 'operativos', 'insumos', 'Compra cera de soja 10kg', 8500, false, 'Transferencia', 'Aromas del Sur', 'FC-001-2024', NULL),
  (CURRENT_DATE - 80, 'operativos', 'packaging', 'Cajas y packaging premium', 12000, false, 'Transferencia', 'PackArt', 'FC-002-2024', NULL),
  (CURRENT_DATE - 78, 'personal', 'sueldos', 'Sueldo asistente de producción', 80000, true, 'Transferencia', NULL, NULL, 'Mensual'),
  (CURRENT_DATE - 75, 'impuestos', 'monotributo', 'Monotributo mensual', 25000, true, 'Débito automático', 'AFIP', NULL, NULL),
  (CURRENT_DATE - 72, 'marketing', 'influencers', 'Colaboración influencer @aromaslife', 20000, false, 'Transferencia', NULL, NULL, 'Canje + pago'),
  (CURRENT_DATE - 68, 'operativos', 'servicios', 'Internet y hosting tienda online', 5500, true, 'Débito automático', 'TelecomAr', NULL, NULL),
  (CURRENT_DATE - 65, 'operativos', 'insumos', 'Mechas de algodón x500', 3200, false, 'Transferencia', 'Aromas del Sur', 'FC-003-2024', NULL),
  (CURRENT_DATE - 62, 'marketing', 'redes_sociales', 'Publicidad Google Ads', 8000, false, 'Tarjeta', 'Google', NULL, NULL),
  (CURRENT_DATE - 58, 'operativos', 'envios', 'Gastos de envío y mensajería', 6800, false, 'Efectivo', NULL, NULL, 'Retiros OCA y Andreani'),
  (CURRENT_DATE - 55, 'personal', 'sueldos', 'Sueldo asistente de producción', 80000, true, 'Transferencia', NULL, NULL, 'Mensual'),
  (CURRENT_DATE - 52, 'impuestos', 'monotributo', 'Monotributo mensual', 25000, true, 'Débito automático', 'AFIP', NULL, NULL),
  (CURRENT_DATE - 50, 'operativos', 'insumos', 'Aceites esenciales importados', 45000, false, 'Transferencia', 'Essence Pro', 'FC-004-2024', 'USD compra a $980'),
  (CURRENT_DATE - 45, 'marketing', 'fotografia', 'Sesión de fotos productos', 18000, false, 'Efectivo', 'EstudioX', NULL, NULL),
  (CURRENT_DATE - 42, 'operativos', 'packaging', 'Cintas y tejidos para packaging', 4500, false, 'Transferencia', 'PackArt', 'FC-005-2024', NULL),
  (CURRENT_DATE - 38, 'personal', 'sueldos', 'Sueldo asistente de producción', 80000, true, 'Transferencia', NULL, NULL, 'Mensual'),
  (CURRENT_DATE - 35, 'impuestos', 'monotributo', 'Monotributo mensual', 25000, true, 'Débito automático', 'AFIP', NULL, NULL),
  (CURRENT_DATE - 32, 'marketing', 'redes_sociales', 'Publicidad Instagram - Campaña Primavera', 22000, false, 'Tarjeta', 'Meta Ads', 'INV-2024-002', NULL),
  (CURRENT_DATE - 28, 'operativos', 'insumos', 'Cera de soja + fragrancias premium', 32000, false, 'Transferencia', 'Aromas del Sur', 'FC-006-2024', NULL),
  (CURRENT_DATE - 25, 'operativos', 'servicios', 'Internet y hosting tienda online', 5500, true, 'Débito automático', 'TelecomAr', NULL, NULL),
  (CURRENT_DATE - 22, 'marketing', 'redes_sociales', 'Publicidad Google Ads', 10000, false, 'Tarjeta', 'Google', NULL, NULL),
  (CURRENT_DATE - 18, 'personal', 'sueldos', 'Sueldo asistente de producción', 80000, true, 'Transferencia', NULL, NULL, 'Mensual'),
  (CURRENT_DATE - 15, 'impuestos', 'monotributo', 'Monotributo mensual', 25000, true, 'Débito automático', 'AFIP', NULL, NULL),
  (CURRENT_DATE - 12, 'operativos', 'envios', 'Gastos de envío y mensajería', 8500, false, 'Efectivo', NULL, NULL, NULL),
  (CURRENT_DATE - 8, 'marketing', 'influencers', 'Colaboración microinfluencer', 8000, false, 'Transferencia', NULL, NULL, NULL),
  (CURRENT_DATE - 5, 'operativos', 'insumos', 'Envases y frascos de vidrio', 28000, false, 'Transferencia', 'Vitro Glass', 'FC-007-2024', NULL),
  (CURRENT_DATE - 3, 'operativos', 'packaging', 'Bolsas y papel tissue', 3800, false, 'Transferencia', 'PackArt', 'FC-008-2024', NULL);

-- Stock movements
INSERT INTO stock_movements (product_id, movement_type, quantity, reason, movement_date, notes)
VALUES
  (1, 'entrada', 50, 'Compra a proveedor', CURRENT_DATE - 90, 'Lote L2024-001'),
  (2, 'entrada', 80, 'Compra a proveedor', CURRENT_DATE - 90, 'Lote L2024-002'),
  (3, 'entrada', 100, 'Compra a proveedor', CURRENT_DATE - 90, NULL),
  (5, 'entrada', 40, 'Importación', CURRENT_DATE - 85, 'Importación USA'),
  (6, 'entrada', 25, 'Importación', CURRENT_DATE - 85, NULL),
  (10, 'entrada', 100, 'Compra a proveedor', CURRENT_DATE - 80, NULL),
  (11, 'entrada', 120, 'Compra a proveedor', CURRENT_DATE - 80, NULL),
  (1, 'salida', 15, 'Ventas período', CURRENT_DATE - 60, NULL),
  (2, 'salida', 18, 'Ventas período', CURRENT_DATE - 60, NULL),
  (5, 'salida', 5, 'Ventas período', CURRENT_DATE - 55, NULL),
  (12, 'entrada', 20, 'Producción interna', CURRENT_DATE - 50, 'Armado de kits'),
  (13, 'entrada', 25, 'Producción interna', CURRENT_DATE - 50, NULL),
  (1, 'salida', 8, 'Ventas período', CURRENT_DATE - 30, NULL),
  (3, 'ajuste', -2, 'Ajuste inventario', CURRENT_DATE - 20, 'Productos dañados'),
  (15, 'entrada', 60, 'Compra a proveedor', CURRENT_DATE - 15, NULL);

-- Cash flow
INSERT INTO cash_flow (flow_date, category, type, amount, description, is_projected, notes)
VALUES
  (CURRENT_DATE - 90, 'ventas', 'ingreso', 85000, 'Ingresos ventas - semana 1', false, NULL),
  (CURRENT_DATE - 82, 'gastos_operativos', 'egreso', 21000, 'Insumos y packaging', false, NULL),
  (CURRENT_DATE - 78, 'personal', 'egreso', 80000, 'Sueldos', false, NULL),
  (CURRENT_DATE - 75, 'impuestos', 'egreso', 25000, 'Monotributo', false, NULL),
  (CURRENT_DATE - 70, 'ventas', 'ingreso', 92000, 'Ingresos ventas - semana 3', false, NULL),
  (CURRENT_DATE - 65, 'marketing', 'egreso', 35000, 'Publicidad y marketing', false, NULL),
  (CURRENT_DATE - 60, 'ventas', 'ingreso', 78000, 'Ingresos ventas - semana 5', false, NULL),
  (CURRENT_DATE - 55, 'personal', 'egreso', 80000, 'Sueldos', false, NULL),
  (CURRENT_DATE - 52, 'impuestos', 'egreso', 25000, 'Monotributo', false, NULL),
  (CURRENT_DATE - 45, 'ventas', 'ingreso', 115000, 'Ingresos ventas - semana 7', false, NULL),
  (CURRENT_DATE - 40, 'gastos_operativos', 'egreso', 45000, 'Compra insumos premium', false, NULL),
  (CURRENT_DATE - 30, 'ventas', 'ingreso', 130000, 'Ingresos ventas - semana 9', false, NULL),
  (CURRENT_DATE - 25, 'personal', 'egreso', 80000, 'Sueldos', false, NULL),
  (CURRENT_DATE - 22, 'impuestos', 'egreso', 25000, 'Monotributo', false, NULL),
  (CURRENT_DATE - 15, 'marketing', 'egreso', 40000, 'Campaña publicidad', false, NULL),
  (CURRENT_DATE - 10, 'ventas', 'ingreso', 95000, 'Ingresos ventas recientes', false, NULL),
  (CURRENT_DATE + 10, 'ventas', 'ingreso', 120000, 'Proyección ventas próximo período', true, 'Estimado basado en histórico'),
  (CURRENT_DATE + 15, 'personal', 'egreso', 80000, 'Sueldos próximo mes', true, NULL),
  (CURRENT_DATE + 20, 'impuestos', 'egreso', 25000, 'Monotributo próximo mes', true, NULL),
  (CURRENT_DATE + 25, 'gastos_operativos', 'egreso', 30000, 'Insumos proyectados', true, NULL);

-- Marketing metrics
INSERT INTO marketing_metrics (metric_date, channel, impressions, clicks, ctr, cpc, conversions, conversion_rate, spend, revenue, roas, notes)
VALUES
  (CURRENT_DATE - 80, 'Instagram', 45000, 1350, 0.03, 11.11, 45, 0.033, 15000, 62500, 4.17, 'Campaña Invierno'),
  (CURRENT_DATE - 80, 'Google Ads', 28000, 840, 0.03, 9.52, 28, 0.033, 8000, 32000, 4.0, NULL),
  (CURRENT_DATE - 55, 'Instagram', 52000, 1820, 0.035, 10.99, 52, 0.029, 20000, 78000, 3.9, 'Campaña Primavera'),
  (CURRENT_DATE - 55, 'Google Ads', 31000, 1085, 0.035, 7.37, 38, 0.035, 8000, 42000, 5.25, NULL),
  (CURRENT_DATE - 30, 'Instagram', 68000, 2380, 0.035, 9.24, 68, 0.029, 22000, 102000, 4.64, 'Campaña nuevos kits'),
  (CURRENT_DATE - 30, 'Google Ads', 35000, 1225, 0.035, 8.16, 42, 0.034, 10000, 52000, 5.2, NULL),
  (CURRENT_DATE - 10, 'Instagram', 38000, 1520, 0.04, 5.26, 38, 0.025, 8000, 44000, 5.5, 'Microinfluencers'),
  (CURRENT_DATE - 10, 'Google Ads', 22000, 770, 0.035, 5.19, 28, 0.036, 4000, 28000, 7.0, NULL);

-- Notas
INSERT INTO notes (title, content, category, tags, is_pinned)
VALUES
  ('Estrategia Q4 2024', 'Objetivos principales para el último trimestre:
- Aumentar ventas en canal Instagram 30%
- Lanzar línea de kits navideños
- Meta: $800.000 en revenue
- Reducir CAC a menos de $1500', 'estrategia', ARRAY['q4', 'objetivos', 'ventas'], true),
  ('Proveedor - Aromas del Sur', 'Contacto: Laura Méndez
WhatsApp: 11-4567-8900
Mínimo pedido: $50.000
Tiempo de entrega: 5-7 días hábiles
Descuento por volumen: 10% en pedidos > $100.000', 'proveedores', ARRAY['proveedor', 'insumos'], false),
  ('Ideas de productos nuevos', '- Velas personalizadas para eventos
- Set meditación (vela + esencia + difusor)
- Línea "Hombre" con fragancias masculinas
- Edición limitada navidad
- Suscripción mensual "caja aromas"', 'ideas', ARRAY['producto', 'innovacion'], false),
  ('Checklist lanzamiento TiendaNube', '✅ Fotos de productos
✅ Descripciones SEO
✅ Configurar medios de pago
⬜ Integrar con MercadoPago
⬜ Configurar envíos por zona
⬜ Publicar en redes el lanzamiento', 'operaciones', ARRAY['tiendanube', 'lanzamiento'], true),
  ('Métricas objetivos 2024', 'Revenue mensual objetivo: $300.000
Margen bruto objetivo: >60%
CAC máximo: $1.500
LTV objetivo: $8.000
Tasa retención: >35%', 'finanzas', ARRAY['objetivos', 'kpis'], false),
  ('Feedback clientes frecuentes', 'María González: "Las velas duran mucho más que otras marcas, excelente calidad"
Carlos R: "El packaging es hermoso, perfecto para regalar"
Laura S: "Me encantaría una línea de velas sin perfume para alérgicos"
→ Investigar línea hipoalergénica', 'clientes', ARRAY['feedback', 'producto'], false);
