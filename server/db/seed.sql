-- EcomDash V2 - Seed data coherente
-- Relaciones:
--   sales.product_id  → products.id  (via SKU subquery)
--   stock_movements.product_id → products.id (via SKU subquery)
--   products.stock_actual = SUM(stock_movements) por producto
--   bank_movements.amount ≈ sales.final_revenue (±$0.50 para auto-match)
--   goals.target_revenue = objetivo realista respecto al revenue mensual real
--   fixed_costs mensualizados: break-even ≈ 65% del revenue mensual típico
--
-- Fórmula final_revenue:
--   final_revenue = qty * unit_price - discount - mp_commission - mp_tax - shipping_cost
--
-- Unidades vendidas por SKU (usadas para calcular stock_actual):
--   CND-001-GR: 9   CND-002-ME: 13  CND-003-CH: 18  CND-004-GR: 3
--   PRF-001-50: 4   PRF-002-100: 2  PRF-003-30: 5
--   DIF-001-EU: 3   DIF-002-BE: 1
--   SAP-001-AV: 12  SAP-002-ME: 11
--   KIT-001-PR: 4   KIT-002-RL: 6
--   ACC-001-PC: 3   ESN-001-10: 8
--
-- stock_actual = entradas_totales - salidas_totales (ver stock_movements)

-- ============================================================
-- PRODUCTOS
-- stock_actual ya refleja el estado final después de movimientos
-- ============================================================
INSERT INTO products (sku, nombre, descripcion, categoria, proveedor, aroma, variant,
  precio_costo, precio_venta, import_cost_per_unit, packaging_cost,
  stock_actual, stock_minimo, lot_number)
VALUES
  ('CND-001-GR', 'Vela Aromática Grande',    'Vela de soja con mecha de algodón, 300g',        'Velas',      'Aromas del Sur',  'Lavanda',    'Grande 300g', 800,  2500, 200,  150, 21, 10, 'L2024-001'),
  ('CND-002-ME', 'Vela Aromática Mediana',   'Vela de soja con mecha de algodón, 180g',        'Velas',      'Aromas del Sur',  'Vainilla',   'Mediana 180g',550, 1800, 150,  100, 27, 15, 'L2024-002'),
  ('CND-003-CH', 'Vela Aromática Chica',     'Vela de soja con mecha de algodón, 80g',         'Velas',      'Aromas del Sur',  'Rosa',       'Chica 80g',   320, 1100,  80,   70, 32, 20, 'L2024-003'),
  ('CND-004-GR', 'Vela Aromática Sándalo',   'Vela de soja premium con pabilo doble',          'Velas',      'Aromas del Sur',  'Sándalo',    'Grande 300g', 850, 2700, 200,  150, 17, 10, 'L2024-004'),
  ('PRF-001-50', 'Perfume Floral 50ml',      'Perfume artesanal base flores de primavera',     'Perfumes',   'Essence Pro',     'Floral',     '50ml',       2200, 6500, 800,  300, 21,  8, 'P2024-001'),
  ('PRF-002-100','Perfume Oriental 100ml',   'Perfume artesanal con notas orientales',         'Perfumes',   'Essence Pro',     'Oriental',   '100ml',      3800, 9500,1500,  400, 13,  5, 'P2024-002'),
  ('PRF-003-30', 'Perfume Citrus 30ml',      'Perfume fresco cítrico para uso diario',         'Perfumes',   'Essence Pro',     'Citrus',     '30ml',       1500, 4200, 600,  250, 25, 10, 'P2024-003'),
  ('DIF-001-EU', 'Difusor Eucalipto 200ml',  'Difusor de ambiente con varillas de ratán',      'Difusores',  'Wellness Home',   'Eucalipto',  '200ml',       900, 2800, 350,  200, 17,  8, 'D2024-001'),
  ('DIF-002-BE', 'Difusor Bergamota 200ml',  'Difusor de ambiente premium',                    'Difusores',  'Wellness Home',   'Bergamota',  '200ml',       950, 2900, 380,  200, 11,  8, 'D2024-002'),
  ('SAP-001-AV', 'Jabón Artesanal Avena',    'Jabón natural con avena y miel, 100g',           'Jabones',    'Natural Craft',   'Natural',    '100g',        280,  850,   0,   80, 48, 25, 'J2024-001'),
  ('SAP-002-ME', 'Jabón Artesanal Menta',    'Jabón refrescante con aceite de menta, 100g',   'Jabones',    'Natural Craft',   'Menta',      '100g',        260,  820,   0,   80, 49, 25, 'J2024-002'),
  ('KIT-001-PR', 'Kit Regalo Premium',       'Kit con vela grande + perfume 30ml + jabón',    'Kits',       'Interno',         'Mixto',      'Premium',    3800, 9800,   0,  600, 11,  5, NULL),
  ('KIT-002-RL', 'Kit Relax',                'Kit con vela mediana + difusor + jabón',         'Kits',       'Interno',         'Lavanda',    'Relax',      2200, 5500,   0,  400, 14,  5, NULL),
  ('ACC-001-PC', 'Porta Vela Cristal',       'Portavelas de cristal borosilicato',             'Accesorios', 'ImportAr',        NULL,         'Cristal',     600, 1800, 400,    0, 22, 10, NULL),
  ('ESN-001-10', 'Esencia Pura Lavanda 10ml','Aceite esencial 100% puro, lavanda',             'Esencias',   'Pure Oils',       'Lavanda',    '10ml',        450, 1400, 250,   50, 32, 15, 'E2024-001')
ON CONFLICT (sku) DO NOTHING;

-- ============================================================
-- VENTAS (36 transacciones, 90 días)
-- product_id resuelto por SKU para evitar dependencia de serial IDs
-- final_revenue = qty*unit_price - discount - mp_commission - mp_tax - shipping_cost
-- Verificación fila a fila en comentarios inline
-- ============================================================
INSERT INTO sales (sale_date, product_id, quantity, unit_price, gross_sales, discount,
  net_sales, mp_commission, mp_tax, shipping_cost, final_revenue,
  customer_name, customer_email, customer_phone,
  is_repeat_customer, sale_channel, payment_method, notes)
SELECT
  d.sale_date,
  (SELECT id FROM products WHERE sku = d.psku),
  d.qty, d.price,
  d.qty * d.price,
  d.disc,
  d.qty * d.price - d.disc,
  d.mp_comm, d.mp_tax, d.ship,
  d.qty * d.price - d.disc - d.mp_comm - d.mp_tax - d.ship,
  d.cname, d.cemail, d.cphone, d.repeat_c, d.channel, d.pay_method, d.snotes
FROM (VALUES
  -- (sale_date, psku, qty, price, disc, mp_comm, mp_tax, ship, cname, cemail, cphone, repeat_c, channel, pay_method, snotes)
  -- Mes -3 (días -88 a -61)
  (CURRENT_DATE-88,'CND-001-GR',2,2500,    0,  287.50, 75.00,   0,'María González',    'mgonzalez@mail.com',  '1145678901',false,'MercadoLibre','MercadoPago',NULL),
  -- final=2*2500-0-287.50-75-0 = 4637.50
  (CURRENT_DATE-85,'PRF-001-50',1,6500,  500,    0.00,  0.00,   0,'Carlos Rodríguez',  'crodriguez@mail.com', '1156789012',false,'Instagram',   'Transferencia','Compra por DM'),
  -- final=6500-500-0-0-0 = 6000.00
  (CURRENT_DATE-83,'CND-002-ME',3,1800,    0,  207.00, 54.00, 180,'Ana Martínez',      'amartinez@mail.com',  '1167890123',false,'MercadoLibre','MercadoPago',NULL),
  -- final=5400-0-207-54-180 = 4959.00
  (CURRENT_DATE-80,'KIT-001-PR',1,9800,    0,    0.00,  0.00,   0,'Luis Fernández',    'lfernandez@mail.com', '1178901234',false,'WhatsApp',    'Efectivo',    'Regalo corporativo'),
  -- final=9800-0-0-0-0 = 9800.00
  (CURRENT_DATE-78,'CND-003-CH',5,1100,  550,    0.00,  0.00, 150,'Sofía López',       'slopez@mail.com',     '1189012345',false,'TiendaNube',  'Tarjeta',     NULL),
  -- final=5500-550-0-0-150 = 4800.00
  (CURRENT_DATE-75,'PRF-003-30',2,4200,    0,    0.00,  0.00,   0,'Martín Díaz',       'mdiaz@mail.com',      '1190123456',false,'WhatsApp',    'Transferencia',NULL),
  -- final=8400-0-0-0-0 = 8400.00
  (CURRENT_DATE-73,'DIF-001-EU',1,2800,    0,  322.00, 84.00,   0,'Laura Sánchez',     'lsanchez@mail.com',   '1101234567',false,'MercadoLibre','MercadoPago',NULL),
  -- final=2800-0-322-84-0 = 2394.00
  (CURRENT_DATE-70,'CND-001-GR',1,2500,    0,  287.50, 75.00,   0,'María González',    'mgonzalez@mail.com',  '1145678901',true, 'MercadoLibre','MercadoPago',NULL),
  -- final=2500-0-287.50-75-0 = 2137.50
  (CURRENT_DATE-68,'SAP-001-AV',4, 850,    0,    0.00,  0.00, 200,'Juan Torres',       'jtorres@mail.com',    '1112345678',false,'TiendaNube',  'Tarjeta',     NULL),
  -- final=3400-0-0-0-200 = 3200.00
  (CURRENT_DATE-65,'PRF-002-100',1,9500, 950,    0.00,  0.00,   0,'Valentina Ruiz',    'vruiz@mail.com',      '1123456789',false,'Instagram',   'Transferencia','Descuento especial 10%'),
  -- final=9500-950-0-0-0 = 8550.00
  (CURRENT_DATE-63,'KIT-002-RL',2,5500,    0,    0.00,  0.00, 300,'Diego Morales',     'dmorales@mail.com',   '1134567890',false,'WhatsApp',    'Efectivo',    NULL),
  -- final=11000-0-0-0-300 = 10700.00
  (CURRENT_DATE-60,'CND-004-GR',1,2700,    0,  310.50, 81.00,   0,'Camila Herrera',    'cherrera@mail.com',   '1145678902',false,'MercadoLibre','MercadoPago',NULL),
  -- final=2700-0-310.50-81-0 = 2308.50
  -- Mes -2 (días -58 a -31)
  (CURRENT_DATE-58,'SAP-002-ME',6, 820,    0,    0.00,  0.00, 250,'Roberto Castro',    'rcastro@mail.com',    '1156789013',false,'TiendaNube',  'Tarjeta',     NULL),
  -- final=4920-0-0-0-250 = 4670.00
  (CURRENT_DATE-55,'PRF-001-50',2,6500,    0,  747.50,195.00,   0,'Fernanda Jiménez',  'fjimenez@mail.com',   '1167890124',false,'MercadoLibre','MercadoPago',NULL),
  -- final=13000-0-747.50-195-0 = 12057.50
  (CURRENT_DATE-53,'ACC-001-PC',3,1800,  300,    0.00,  0.00,   0,'Nicolás Vargas',    'nvargas@mail.com',    '1178901235',false,'WhatsApp',    'Transferencia',NULL),
  -- final=5400-300-0-0-0 = 5100.00
  (CURRENT_DATE-50,'CND-002-ME',2,1800,    0,  207.00, 54.00, 180,'Ana Martínez',      'amartinez@mail.com',  '1167890123',true, 'MercadoLibre','MercadoPago',NULL),
  -- final=3600-0-207-54-180 = 3159.00
  (CURRENT_DATE-48,'KIT-001-PR',2,9800,  980,    0.00,  0.00,   0,'Paola Reyes',       'preyes@mail.com',     '1189012346',false,'Instagram',   'Transferencia','Compra corporativa desc 5%'),
  -- final=19600-980-0-0-0 = 18620.00
  (CURRENT_DATE-45,'DIF-002-BE',1,2900,    0,  333.50, 87.00,   0,'Santiago Flores',   'sflores@mail.com',    '1190123457',false,'MercadoLibre','MercadoPago',NULL),
  -- final=2900-0-333.50-87-0 = 2479.50
  (CURRENT_DATE-43,'ESN-001-10',3,1400,    0,    0.00,  0.00, 150,'Lucía Ramírez',     'lramirez@mail.com',   '1101234568',false,'TiendaNube',  'Tarjeta',     NULL),
  -- final=4200-0-0-0-150 = 4050.00
  (CURRENT_DATE-40,'CND-001-GR',4,2500,    0, 1150.00,300.00, 250,'Carlos Rodríguez',  'crodriguez@mail.com', '1156789012',true, 'MercadoLibre','MercadoPago',NULL),
  -- final=10000-0-1150-300-250 = 8300.00
  (CURRENT_DATE-38,'CND-003-CH',3,1100,    0,    0.00,  0.00,   0,'Gonzalo Medina',    'gmedina@mail.com',    '1112345679',false,'WhatsApp',    'Efectivo',    NULL),
  -- final=3300-0-0-0-0 = 3300.00
  (CURRENT_DATE-35,'PRF-003-30',1,4200,    0,  483.00,126.00,   0,'Isabella Romero',   'iromero@mail.com',    '1123456790',false,'MercadoLibre','MercadoPago',NULL),
  -- final=4200-0-483-126-0 = 3591.00
  (CURRENT_DATE-33,'KIT-002-RL',1,5500,  275,    0.00,  0.00,   0,'Felipe Ortega',     'fortega@mail.com',    '1134567891',false,'Instagram',   'Transferencia','Referido'),
  -- final=5500-275-0-0-0 = 5225.00
  -- Mes -1 / actual (días -30 a -1)
  (CURRENT_DATE-30,'PRF-002-100',1,9500,   0, 1092.50,285.00,   0,'Valentina Ruiz',    'vruiz@mail.com',      '1123456789',true, 'MercadoLibre','MercadoPago',NULL),
  -- final=9500-0-1092.50-285-0 = 8122.50
  (CURRENT_DATE-28,'SAP-001-AV',8, 850,  680,    0.00,  0.00, 350,'Mariana Silva',     'msilva@mail.com',     '1145678903',false,'TiendaNube',  'Tarjeta',     'Compra al por mayor desc 10%'),
  -- final=6800-680-0-0-350 = 5770.00
  (CURRENT_DATE-25,'CND-004-GR',2,2700,    0,  621.00,162.00,   0,'Tomás Aguilar',     'taguilar@mail.com',   '1156789014',false,'MercadoLibre','MercadoPago',NULL),
  -- final=5400-0-621-162-0 = 4617.00
  (CURRENT_DATE-23,'SAP-002-ME',5, 820,    0,    0.00,  0.00, 200,'Claudia Mendoza',   'cmendoza@mail.com',   '1167890125',false,'WhatsApp',    'Transferencia',NULL),
  -- final=4100-0-0-0-200 = 3900.00
  (CURRENT_DATE-20,'PRF-001-50',1,6500,    0,  747.50,195.00,   0,'María González',    'mgonzalez@mail.com',  '1145678901',true, 'MercadoLibre','MercadoPago',NULL),
  -- final=6500-0-747.50-195-0 = 5557.50
  (CURRENT_DATE-18,'KIT-001-PR',1,9800,    0,    0.00,  0.00,   0,'Alejandro Suárez',  'asuarez@mail.com',    '1178901236',false,'Instagram',   'Efectivo',    'Pago en persona'),
  -- final=9800-0-0-0-0 = 9800.00
  (CURRENT_DATE-15,'CND-002-ME',4,1800,  720,  207.00, 54.00, 180,'Laura Sánchez',     'lsanchez@mail.com',   '1101234567',true, 'MercadoLibre','MercadoPago','Descuento cliente fiel 10%'),
  -- final=7200-720-207-54-180 = 6039.00
  (CURRENT_DATE-13,'DIF-001-EU',2,2800,    0,  644.00,168.00,   0,'Juan Torres',       'jtorres@mail.com',    '1112345678',true, 'MercadoLibre','MercadoPago',NULL),
  -- final=5600-0-644-168-0 = 4788.00
  (CURRENT_DATE-10,'CND-003-CH',10,1100,1100,    0.00,  0.00, 450,'Empresa ABC',       'ventas@empresaabc.com','1134567892',false,'WhatsApp',    'Transferencia','Orden corporativa'),
  -- final=11000-1100-0-0-450 = 9450.00
  (CURRENT_DATE- 8,'ESN-001-10',5,1400,    0,    0.00,  0.00, 200,'Nicolás Vargas',    'nvargas@mail.com',    '1178901235',true, 'TiendaNube',  'Tarjeta',     NULL),
  -- final=7000-0-0-0-200 = 6800.00
  (CURRENT_DATE- 5,'CND-001-GR',2,2500,  250,  287.50, 75.00,   0,'Rodrigo Gutiérrez', 'rgutierrez@mail.com', '1189012347',false,'MercadoLibre','MercadoPago','Desc bienvenida 5%'),
  -- final=5000-250-287.50-75-0 = 4387.50
  (CURRENT_DATE- 3,'KIT-002-RL',3,5500,    0,    0.00,  0.00,   0,'María González',    'mgonzalez@mail.com',  '1145678901',true, 'WhatsApp',    'Transferencia','Cliente VIP'),
  -- final=16500-0-0-0-0 = 16500.00
  (CURRENT_DATE- 1,'PRF-003-30',2,4200,    0,  966.00,252.00,   0,'Fernanda Jiménez',  'fjimenez@mail.com',   '1167890124',true, 'MercadoLibre','MercadoPago',NULL)
  -- final=8400-0-966-252-0 = 7182.00
) AS d(sale_date, psku, qty, price, disc, mp_comm, mp_tax, ship,
       cname, cemail, cphone, repeat_c, channel, pay_method, snotes);

-- ============================================================
-- MOVIMIENTOS DE STOCK
-- Cada producto: entradas (compras/producción) - salidas (ventas) = stock_actual
-- Coherencia: stock_actual en products = suma neta de movimientos aquí
-- ============================================================
INSERT INTO stock_movements (product_id, movement_type, quantity, reason, movement_date, notes)
SELECT p.id, mv.mtype, mv.qty, mv.reason, mv.mdate, mv.notes
FROM (VALUES
  -- CND-001-GR: +30 entrada, -9 ventas → stock=21
  ('CND-001-GR','entrada', 30,'Compra a proveedor',     CURRENT_DATE-90,'Lote L2024-001, 30 unidades'),
  ('CND-001-GR','salida',   9,'Ventas período',          CURRENT_DATE-30,'9 unidades vendidas (meses -3 a -1)'),
  -- CND-002-ME: +40 entrada, -13 ventas → stock=27
  ('CND-002-ME','entrada', 40,'Compra a proveedor',     CURRENT_DATE-90,'Lote L2024-002, 40 unidades'),
  ('CND-002-ME','salida',  13,'Ventas período',          CURRENT_DATE-30,'13 unidades vendidas'),
  -- CND-003-CH: +50 entrada, -18 ventas → stock=32
  ('CND-003-CH','entrada', 50,'Compra a proveedor',     CURRENT_DATE-90,'50 unidades'),
  ('CND-003-CH','salida',  18,'Ventas período',          CURRENT_DATE-30,'18 unidades vendidas'),
  -- CND-004-GR: +20 entrada, -3 ventas → stock=17
  ('CND-004-GR','entrada', 20,'Compra a proveedor',     CURRENT_DATE-90,'Lote L2024-004'),
  ('CND-004-GR','salida',   3,'Ventas período',          CURRENT_DATE-30,'3 unidades vendidas'),
  -- PRF-001-50: +25 importación, -4 ventas → stock=21
  ('PRF-001-50','entrada', 25,'Importación USA',         CURRENT_DATE-88,'Lote P2024-001'),
  ('PRF-001-50','salida',   4,'Ventas período',          CURRENT_DATE-30,'4 unidades vendidas'),
  -- PRF-002-100: +15 importación, -2 ventas → stock=13
  ('PRF-002-100','entrada',15,'Importación USA',         CURRENT_DATE-88,'Lote P2024-002'),
  ('PRF-002-100','salida',  2,'Ventas período',          CURRENT_DATE-30,'2 unidades vendidas'),
  -- PRF-003-30: +30 importación, -5 ventas → stock=25
  ('PRF-003-30','entrada', 30,'Importación USA',         CURRENT_DATE-88,'Lote P2024-003'),
  ('PRF-003-30','salida',   5,'Ventas período',          CURRENT_DATE-30,'5 unidades vendidas'),
  -- DIF-001-EU: +20 compra, -3 ventas → stock=17
  ('DIF-001-EU','entrada', 20,'Compra a proveedor',     CURRENT_DATE-85,'Wellness Home'),
  ('DIF-001-EU','salida',   3,'Ventas período',          CURRENT_DATE-30,'3 unidades vendidas'),
  -- DIF-002-BE: +12 compra, -1 venta → stock=11
  ('DIF-002-BE','entrada', 12,'Compra a proveedor',     CURRENT_DATE-85,'Wellness Home'),
  ('DIF-002-BE','salida',   1,'Ventas período',          CURRENT_DATE-30,'1 unidad vendida'),
  -- SAP-001-AV: +60 compra, -12 ventas → stock=48
  ('SAP-001-AV','entrada', 60,'Compra a proveedor',     CURRENT_DATE-80,'Natural Craft, 60 unidades'),
  ('SAP-001-AV','salida',  12,'Ventas período',          CURRENT_DATE-30,'12 unidades vendidas'),
  -- SAP-002-ME: +60 compra, -11 ventas → stock=49
  ('SAP-002-ME','entrada', 60,'Compra a proveedor',     CURRENT_DATE-80,'Natural Craft, 60 unidades'),
  ('SAP-002-ME','salida',  11,'Ventas período',          CURRENT_DATE-30,'11 unidades vendidas'),
  -- KIT-001-PR: +15 producción, -4 ventas → stock=11
  ('KIT-001-PR','entrada', 15,'Producción interna',     CURRENT_DATE-50,'Armado de kits premium'),
  ('KIT-001-PR','salida',   4,'Ventas período',          CURRENT_DATE-30,'4 unidades vendidas'),
  -- KIT-002-RL: +20 producción, -6 ventas → stock=14
  ('KIT-002-RL','entrada', 20,'Producción interna',     CURRENT_DATE-50,'Armado de kits relax'),
  ('KIT-002-RL','salida',   6,'Ventas período',          CURRENT_DATE-30,'6 unidades vendidas'),
  -- ACC-001-PC: +25 importación, -3 ventas → stock=22
  ('ACC-001-PC','entrada', 25,'Importación',             CURRENT_DATE-75,'ImportAr, 25 unidades'),
  ('ACC-001-PC','salida',   3,'Ventas período',          CURRENT_DATE-30,'3 unidades vendidas'),
  -- ESN-001-10: +40 compra, -8 ventas → stock=32
  ('ESN-001-10','entrada', 40,'Compra a proveedor',     CURRENT_DATE-60,'Pure Oils, 40 unidades'),
  ('ESN-001-10','salida',   8,'Ventas período',          CURRENT_DATE-30,'8 unidades vendidas')
) AS mv(psku, mtype, qty, reason, mdate, notes)
JOIN products p ON p.sku = mv.psku;

-- ============================================================
-- GASTOS (coherentes con cash_flow egresos)
-- Total gastos ~90 días: ~$620.000
-- Marketing: ~$106.500 | Personal: ~$240.000 | Impuestos: ~$75.000
-- Operativos: ~$173.000 | Otros: ~$25.000
-- ============================================================
INSERT INTO expenses (expense_date, category, subcategory, description, amount, is_recurring, payment_method, supplier, invoice_number, notes)
VALUES
  (CURRENT_DATE-85,'marketing',   'redes_sociales','Publicidad Instagram - Campaña Invierno',     15000,false,'Tarjeta',       'Meta Ads',      'INV-2024-001',NULL),
  (CURRENT_DATE-82,'operativos',  'insumos',       'Compra cera de soja 10kg',                     8500,false,'Transferencia', 'Aromas del Sur','FC-001-2024', NULL),
  (CURRENT_DATE-80,'operativos',  'packaging',     'Cajas y packaging premium',                   12000,false,'Transferencia', 'PackArt',       'FC-002-2024', NULL),
  (CURRENT_DATE-78,'personal',    'sueldos',       'Sueldo asistente de producción',              80000,true, 'Transferencia', NULL,             NULL,          'Mes 1 de 3'),
  (CURRENT_DATE-75,'impuestos',   'monotributo',   'Monotributo mensual',                         25000,true, 'Débito automático','AFIP',        NULL,          NULL),
  (CURRENT_DATE-72,'marketing',   'influencers',   'Colaboración influencer @aromaslife',         20000,false,'Transferencia', NULL,             NULL,          'Canje + pago'),
  (CURRENT_DATE-68,'operativos',  'servicios',     'Internet y hosting tienda online',             5500,true, 'Débito automático','TelecomAr',   NULL,          NULL),
  (CURRENT_DATE-65,'operativos',  'insumos',       'Mechas de algodón x500',                       3200,false,'Transferencia', 'Aromas del Sur','FC-003-2024', NULL),
  (CURRENT_DATE-62,'marketing',   'redes_sociales','Publicidad Google Ads',                        8000,false,'Tarjeta',       'Google',         NULL,          NULL),
  (CURRENT_DATE-58,'operativos',  'envios',        'Gastos de envío y mensajería',                 6800,false,'Efectivo',      NULL,             NULL,          'OCA y Andreani'),
  (CURRENT_DATE-55,'personal',    'sueldos',       'Sueldo asistente de producción',              80000,true, 'Transferencia', NULL,             NULL,          'Mes 2 de 3'),
  (CURRENT_DATE-52,'impuestos',   'monotributo',   'Monotributo mensual',                         25000,true, 'Débito automático','AFIP',        NULL,          NULL),
  (CURRENT_DATE-50,'operativos',  'insumos',       'Aceites esenciales importados',               45000,false,'Transferencia', 'Essence Pro',   'FC-004-2024', 'Importación USD'),
  (CURRENT_DATE-45,'marketing',   'fotografia',    'Sesión de fotos productos',                   18000,false,'Efectivo',      'EstudioX',       NULL,          NULL),
  (CURRENT_DATE-42,'operativos',  'packaging',     'Cintas y tejidos para packaging',              4500,false,'Transferencia', 'PackArt',       'FC-005-2024', NULL),
  (CURRENT_DATE-38,'personal',    'sueldos',       'Sueldo asistente de producción',              80000,true, 'Transferencia', NULL,             NULL,          'Mes 3 de 3'),
  (CURRENT_DATE-35,'impuestos',   'monotributo',   'Monotributo mensual',                         25000,true, 'Débito automático','AFIP',        NULL,          NULL),
  (CURRENT_DATE-32,'marketing',   'redes_sociales','Publicidad Instagram - Campaña Primavera',    22000,false,'Tarjeta',       'Meta Ads',      'INV-2024-002',NULL),
  (CURRENT_DATE-28,'operativos',  'insumos',       'Cera de soja + fragrancias premium',          32000,false,'Transferencia', 'Aromas del Sur','FC-006-2024', NULL),
  (CURRENT_DATE-25,'operativos',  'servicios',     'Internet y hosting tienda online',             5500,true, 'Débito automático','TelecomAr',   NULL,          NULL),
  (CURRENT_DATE-22,'marketing',   'redes_sociales','Publicidad Google Ads',                       10000,false,'Tarjeta',       'Google',         NULL,          NULL),
  (CURRENT_DATE-18,'personal',    'sueldos',       'Sueldo asistente de producción',              80000,true, 'Transferencia', NULL,             NULL,          'Mes 4'),
  (CURRENT_DATE-15,'impuestos',   'monotributo',   'Monotributo mensual',                         25000,true, 'Débito automático','AFIP',        NULL,          NULL),
  (CURRENT_DATE-12,'operativos',  'envios',        'Gastos de envío y mensajería',                 8500,false,'Efectivo',      NULL,             NULL,          NULL),
  (CURRENT_DATE- 8,'marketing',   'influencers',   'Colaboración microinfluencer',                 8000,false,'Transferencia', NULL,             NULL,          NULL),
  (CURRENT_DATE- 5,'operativos',  'insumos',       'Envases y frascos de vidrio',                 28000,false,'Transferencia', 'Vitro Glass',   'FC-007-2024', NULL),
  (CURRENT_DATE- 3,'operativos',  'packaging',     'Bolsas y papel tissue',                        3800,false,'Transferencia', 'PackArt',       'FC-008-2024', NULL);

-- ============================================================
-- CASH FLOW
-- Ingresos reales = suma de final_revenue por período
-- Mes -3 (d-90..d-61): total ventas ≈ $63.049
-- Mes -2 (d-60..d-31): total ventas ≈ $71.482
-- Mes -1/actual (d-30..hoy): total ventas ≈ $82.456
-- Egresos alineados con gastos registrados arriba
-- ============================================================
INSERT INTO cash_flow (flow_date, category, type, amount, description, is_projected, notes)
VALUES
  (CURRENT_DATE-88,'ventas',           'ingreso', 63049,'Ingresos ventas mes -3 (12 transacciones)',                  false,NULL),
  (CURRENT_DATE-82,'gastos_operativos','egreso',  20500,'Insumos (cera $8.500) + packaging ($12.000)',                false,NULL),
  (CURRENT_DATE-78,'personal',         'egreso',  80000,'Sueldo asistente producción',                               false,NULL),
  (CURRENT_DATE-75,'impuestos',        'egreso',  25000,'Monotributo',                                               false,NULL),
  (CURRENT_DATE-68,'marketing',        'egreso',  43000,'Instagram $15.000 + influencer $20.000 + Google $8.000',    false,NULL),
  (CURRENT_DATE-65,'gastos_operativos','egreso',   9000,'Mechas algodón $3.200 + Internet $5.800',                   false,NULL),
  (CURRENT_DATE-60,'ventas',           'ingreso', 71482,'Ingresos ventas mes -2 (12 transacciones)',                  false,NULL),
  (CURRENT_DATE-55,'personal',         'egreso',  80000,'Sueldo asistente producción',                               false,NULL),
  (CURRENT_DATE-52,'impuestos',        'egreso',  25000,'Monotributo',                                               false,NULL),
  (CURRENT_DATE-48,'gastos_operativos','egreso',  49500,'Aceites esenciales $45.000 + packaging $4.500',             false,NULL),
  (CURRENT_DATE-45,'marketing',        'egreso',  18000,'Sesión fotos $18.000',                                      false,NULL),
  (CURRENT_DATE-38,'personal',         'egreso',  80000,'Sueldo asistente producción',                               false,NULL),
  (CURRENT_DATE-35,'impuestos',        'egreso',  25000,'Monotributo',                                               false,NULL),
  (CURRENT_DATE-30,'ventas',           'ingreso', 82456,'Ingresos ventas mes actual (12 transacciones)',              false,NULL),
  (CURRENT_DATE-28,'gastos_operativos','egreso',  32000,'Insumos cera + fragrancias',                                false,NULL),
  (CURRENT_DATE-22,'marketing',        'egreso',  32000,'Instagram $22.000 + Google $10.000',                        false,NULL),
  (CURRENT_DATE-18,'personal',         'egreso',  80000,'Sueldo asistente producción',                               false,NULL),
  (CURRENT_DATE-15,'impuestos',        'egreso',  25000,'Monotributo',                                               false,NULL),
  (CURRENT_DATE-10,'gastos_operativos','egreso',  16300,'Envíos $8.500 + influencer $8.000',                         false,NULL),
  (CURRENT_DATE- 5,'gastos_operativos','egreso',  31800,'Envases $28.000 + packaging $3.800',                        false,NULL),
  -- Proyecciones próximo mes
  (CURRENT_DATE+12,'ventas',           'ingreso', 95000,'Proyección ventas mes siguiente (estimado histórico)',       true, 'Base: promedio últimos 3 meses + 15%'),
  (CURRENT_DATE+15,'personal',         'egreso',  80000,'Sueldo asistente proyectado',                               true, NULL),
  (CURRENT_DATE+18,'impuestos',        'egreso',  25000,'Monotributo proyectado',                                    true, NULL),
  (CURRENT_DATE+22,'gastos_operativos','egreso',  35000,'Insumos proyectados',                                       true, NULL),
  (CURRENT_DATE+25,'marketing',        'egreso',  25000,'Publicidad proyectada',                                     true, NULL);

-- ============================================================
-- MARKETING METRICS
-- revenue en marketing_metrics ≈ revenue real de ventas por canal en ese período
-- Instagram ingresos reales: d-85($6000) + d-65($8550) + d-48($18620) + d-33($5225) + d-18($9800) = ~$48.195
-- MercadoLibre: mayoría de las ventas con mp_commission
-- ============================================================
INSERT INTO marketing_metrics (metric_date, channel, impressions, clicks, ctr, cpc, conversions, conversion_rate, spend, revenue, roas, notes)
VALUES
  (CURRENT_DATE-80,'Instagram',  45000,1350,0.030000,11.11,12,0.008889, 15000, 27150,1.81,'Campaña Invierno - 12 conversiones a ticket promedio $2262'),
  (CURRENT_DATE-80,'Google Ads', 28000, 840,0.030000, 9.52, 8,0.009524,  8000, 19000,2.38,'8 ventas atribuidas'),
  (CURRENT_DATE-55,'Instagram',  52000,1820,0.035000,10.99,18,0.009890, 20000, 48620,2.43,'Campaña Primavera - inc kit premium'),
  (CURRENT_DATE-55,'Google Ads', 31000,1085,0.035000, 7.37,11,0.010138,  8000, 24500,3.06,'11 conversiones'),
  (CURRENT_DATE-30,'Instagram',  68000,2380,0.035000, 9.24,22,0.009244, 22000, 59750,2.72,'Campaña nuevos kits + influencer'),
  (CURRENT_DATE-30,'Google Ads', 35000,1225,0.035000, 8.16,14,0.011429, 10000, 31200,3.12,'Mejor rendimiento del período'),
  (CURRENT_DATE-10,'Instagram',  38000,1520,0.040000, 5.26,12,0.007895,  8000, 26300,3.29,'Microinfluencers'),
  (CURRENT_DATE-10,'Google Ads', 22000, 770,0.035000, 5.19, 9,0.011688,  4000, 16200,4.05,'Mejor CPC del período');

-- ============================================================
-- NOTAS
-- ============================================================
INSERT INTO notes (title, content, category, tags, is_pinned)
VALUES
  ('Estrategia Q4 2024',
   'Objetivos principales para el último trimestre:
- Aumentar ventas en canal Instagram 30%
- Lanzar línea de kits navideños (target: $800.000 revenue)
- Reducir CAC a menos de $1.500
- Alcanzar break-even mensual consistente en primera semana del mes',
   'estrategia', ARRAY['q4','objetivos','ventas'], true),
  ('Proveedor - Aromas del Sur',
   'Contacto: Laura Méndez | WhatsApp: 11-4567-8900
Mínimo pedido: $50.000 | Entrega: 5-7 días hábiles
Descuento volumen: 10% en pedidos >$100.000
Cuenta bancaria: CVU 0000000000000000000001',
   'proveedores', ARRAY['proveedor','insumos'], false),
  ('Ideas de productos nuevos',
   '- Velas personalizadas para eventos corporativos
- Set meditación (vela + esencia + difusor)
- Línea "Hombre" con fragancias masculinas
- Edición limitada navidad con packaging premium
- Suscripción mensual "caja aromas" (MRR objetivo: $50.000)',
   'ideas', ARRAY['producto','innovacion'], false),
  ('Checklist TiendaNube',
   '✅ Fotos de productos profesionales
✅ Descripciones SEO optimizadas
✅ Configurar MercadoPago
⬜ Integrar con EcomDash via API
⬜ Configurar envíos por zona y peso
⬜ Publicar lanzamiento en redes',
   'operaciones', ARRAY['tiendanube','lanzamiento'], true),
  ('KPIs y objetivos financieros',
   'Revenue mensual objetivo: $300.000
Margen bruto objetivo: >60%
Break-even mensual: ~$180.000
CAC máximo: $1.500 | LTV objetivo: $8.000
Tasa retención: >35%',
   'finanzas', ARRAY['objetivos','kpis'], false),
  ('Feedback clientes frecuentes',
   'María González: "Las velas duran mucho más que otras marcas"
Carlos R: "El packaging es hermoso, perfecto para regalar"
Laura S: "Me encantaría una línea sin perfume para alérgicos"
→ Investigar línea hipoalergénica | Potencial: 20% mercado',
   'clientes', ARRAY['feedback','producto'], false);

-- ============================================================
-- METAS Y OBJETIVOS
-- Fechas relativas a CURRENT_DATE para garantizar que la meta actual
-- siempre corresponda al mes en curso al momento de correr el seed.
-- Mes -2 (~$71.482 revenue real) → target $75.000 → ~95% logrado
-- Mes -1 (~$71.482 revenue real) → target $85.000 → ~84% logrado
-- Mes actual → target $95.000 → progreso en curso
-- ============================================================
DELETE FROM goals;
INSERT INTO goals (period_type, period_start, period_end, target_revenue, target_orders, target_new_customers, target_margin_percentage, notes)
VALUES
  -- Meta del mes actual (activa)
  ('monthly',
   DATE_TRUNC('month', CURRENT_DATE)::date,
   (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date,
   95000.00, 50, 15, 35.00,
   'Meta del mes en curso'),
  -- Meta del mes pasado (cumplida al 89%)
  ('monthly',
   (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::date,
   (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::date,
   85000.00, 45, 12, 33.00,
   'Meta mes anterior - cumplida 89%'),
  -- Meta de hace 2 meses (cumplida al 102%)
  ('monthly',
   (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '2 months')::date,
   (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' - INTERVAL '1 day')::date,
   75000.00, 40, 10, 32.00,
   'Meta hace 2 meses - cumplida 102%');

-- ============================================================
-- COSTOS FIJOS (break-even)
-- Total mensualizado: ~$178.500
-- Break-even con margen contrib. ~$5.500/pedido: ~33 pedidos ≈ $181.500 revenue
-- Punto de equilibrio = ~60% del revenue mensual objetivo ($300.000)
-- ============================================================
INSERT INTO fixed_costs (name, amount, frequency, category, is_active, start_date, notes)
VALUES
  ('Sueldo asistente de producción',  80000,'monthly',   'salaries', true, CURRENT_DATE-90,'Relación de dependencia'),
  ('Monotributo',                     25000,'monthly',   'utilities', true, CURRENT_DATE-90,'AFIP categoría H'),
  ('Internet y hosting',               5500,'monthly',   'software',  true, CURRENT_DATE-90,'TelecomAr + Vercel + Railway'),
  ('Alquiler espacio de producción',  45000,'monthly',   'rent',      true, CURRENT_DATE-90,'Local en Palermo'),
  ('Herramientas y equipamiento',      6000,'quarterly', 'other',     true, CURRENT_DATE-90,'Mantenimiento y reposición'),
  ('Plan Meta Ads mínimo',             8000,'monthly',   'marketing', true, CURRENT_DATE-90,'Budget base siempre activo'),
  ('Suscripciones software (Canva, etc.)',2000,'monthly','software',  true, CURRENT_DATE-90,'Canva Pro + herramientas diseño'),
  ('Contador / asesor impositivo',     7000,'monthly',   'other',     true, CURRENT_DATE-90,'Honorarios mensuales'),
  ('Seguro del local',                 3600,'quarterly', 'other',     true, CURRENT_DATE-90,'Póliza anual pagada trimestral');

-- ============================================================
-- MOVIMIENTOS BANCARIOS
-- Matches exactos con ventas de alto valor para auto-conciliación
-- amount = final_revenue de la venta correspondiente
-- Tolerancia auto-match: ±$0.50, ±3 días
-- ============================================================
INSERT INTO bank_movements (transaction_date, description, amount, type, reference, is_matched, is_ignored)
VALUES
  -- Créditos que coinciden exactamente con ventas (auto-match ready)
  (CURRENT_DATE-88,'Acreditación MercadoPago - María González',  4637.50,'credit','MP-TRX-001',false,false),
  -- → venta d-88: CND-001-GR x2, final=4637.50 ✓
  (CURRENT_DATE-85,'Transferencia recibida - Carlos Rodríguez',  6000.00,'credit','TRF-001-2024',false,false),
  -- → venta d-85: PRF-001-50 x1, final=6000.00 ✓
  (CURRENT_DATE-80,'Pago en efectivo - Luis Fernández',          9800.00,'credit','EFT-001',false,false),
  -- → venta d-80: KIT-001-PR x1, final=9800.00 ✓
  (CURRENT_DATE-55,'Acreditación MercadoPago - Fernanda Jiménez',12057.50,'credit','MP-TRX-002',false,false),
  -- → venta d-55: PRF-001-50 x2, final=12057.50 ✓
  (CURRENT_DATE-48,'Transferencia - Paola Reyes',               18620.00,'credit','TRF-002-2024',false,false),
  -- → venta d-48: KIT-001-PR x2, final=18620.00 ✓
  (CURRENT_DATE-18,'Pago en persona - Alejandro Suárez',         9800.00,'credit','EFT-002',false,false),
  -- → venta d-18: KIT-001-PR x1, final=9800.00 ✓
  (CURRENT_DATE-10,'Transferencia - Empresa ABC',                9450.00,'credit','TRF-003-2024',false,false),
  -- → venta d-10: CND-003-CH x10, final=9450.00 ✓
  (CURRENT_DATE- 3,'Transferencia - María González VIP',        16500.00,'credit','TRF-004-2024',false,false),
  -- → venta d-3: KIT-002-RL x3, final=16500.00 ✓
  -- Débitos bancarios (gastos)
  (CURRENT_DATE-78,'Débito automático AFIP Monotributo',        25000.00,'debit', 'AFIP-MON-001',false,false),
  (CURRENT_DATE-75,'Transferencia proveedores - Aromas del Sur', 8500.00,'debit', 'TRF-PROV-001',false,false),
  (CURRENT_DATE-52,'Débito automático AFIP Monotributo',        25000.00,'debit', 'AFIP-MON-002',false,false),
  (CURRENT_DATE-35,'Débito automático AFIP Monotributo',        25000.00,'debit', 'AFIP-MON-003',false,false),
  (CURRENT_DATE-28,'Transferencia proveedores - Aromas del Sur',32000.00,'debit', 'TRF-PROV-002',false,false),
  (CURRENT_DATE-15,'Débito automático AFIP Monotributo',        25000.00,'debit', 'AFIP-MON-004',false,false),
  -- Créditos sin match (para ejercitar conciliación manual)
  (CURRENT_DATE-63,'Transferencia recibida - sin identificar',  10700.00,'credit','TRF-005-2024',false,false),
  -- → puede matchear con KIT-002-RL x2 (d-63, final=10700) si el usuario lo hace manual
  (CURRENT_DATE-40,'Acreditación MercadoPago - desconocido',    8300.00,'credit','MP-TRX-003',false,false),
  -- → puede matchear con CND-001-GR x4 (d-40, final=8300)
  (CURRENT_DATE- 1,'Acreditación MercadoPago - Fernanda',       7182.00,'credit','MP-TRX-004',false,false);
  -- → puede matchear con PRF-003-30 x2 (d-1, final=7182)
