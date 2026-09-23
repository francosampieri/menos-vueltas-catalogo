const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

class Range {
  constructor(sheet, row, col, rows = 1, cols = 1) { Object.assign(this, { sheet, row, col, rows, cols }); }
  getValues() {
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => this.sheet.cell(this.row + r, this.col + c)));
  }
  getValue() { return this.getValues()[0][0]; }
  setValues(values) {
    values.forEach((line, r) => line.forEach((value, c) => this.sheet.setCell(this.row + r, this.col + c, value)));
    return this;
  }
  setValue(value) { return this.setValues([[value]]); }
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
}

class Sheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows.map(row => [...row]); }
  cell(row, col) { return this.rows[row - 1]?.[col - 1] ?? ''; }
  setCell(row, col, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < col) this.rows[row - 1].push('');
    this.rows[row - 1][col - 1] = value;
  }
  getRange(row, col, rows = 1, cols = 1) { return new Range(this, row, col, rows, cols); }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getLastRow() { return this.rows.reduce((last, row, i) => row.some(value => value !== '') ? i + 1 : last, 0); }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  appendRow(row) { this.rows.push([...row]); }
  insertSheet() { throw new Error('not supported'); }
  setFrozenRows() {}
  deleteRow(row) { this.rows.splice(row - 1, 1); }
  insertColumnBefore(col) { this.rows.forEach(row => row.splice(col - 1, 0, '')); }
  insertColumnsBefore(col, count) { this.rows.forEach(row => row.splice(col - 1, 0, ...Array(count).fill(''))); }
  insertColumnsAfter(col, count) { this.rows.forEach(row => row.splice(col, 0, ...Array(count).fill(''))); }
}

class Book {
  constructor(entries = {}) {
    this.sheets = Object.fromEntries(Object.entries(entries).map(([name, rows]) => [name, new Sheet(name, rows)]));
    this.insertSheetCalls = 0;
  }
  getSheetByName(name) { return this.sheets[name] || null; }
  insertSheet(name) { this.insertSheetCalls++; return (this.sheets[name] = new Sheet(name)); }
}

function makeContext({ providers, products, movements, orders, items, productSheetName = '⬛Productos' } = {}) {
  const operational = new Book({
    Clientes: [['Id', 'Canal', 'Nombre', 'Telefono', 'Direccion', 'Barrio', 'Mapa', 'Notas', 'Actualizado']],
    Proveedores: providers || [
      ['Id_Proveedor', 'Nombre', 'Telefono', 'Direccion', 'Activo', 'Notas'],
      ['PRV-A', 'Proveedor sintético', '', '', true, '']
    ],
    ...(orders ? { Pedidos: orders } : {}),
    ...(items ? { Items: items } : {}),
    ...(movements ? { Movimientos_Stock: movements } : {})
  });
  const catalog = new Book({ [productSheetName]: products || [
    ['Id', 'Codigo_Proveedor', 'Producto', 'Id_Proveedor', 'Modalidad_Abastecimiento', 'Sin_Stock', 'Columna_Futura'],
    ['P-1', 'LEGACY-1', 'Producto sintético', 'PRV-A', 'STOCK_PROPIO', false, 'preservar'],
    ['P-2', 'LEGACY-2', 'Producto histórico', '', '', '', 'preservar']
  ] });
  let lockDepth = 0;
  let lockAcquisitions = 0;
  let maxLockDepth = 0;
  const context = {
    console,
    Date,
    JSON,
    Math,
    isFinite,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'CATALOG_SPREADSHEET_ID' ? 'configured' : null }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => operational,
      openById: id => { assert.equal(id, 'configured'); return catalog; }
    },
    LockService: { getScriptLock: () => ({
      waitLock() { lockDepth++; lockAcquisitions++; maxLockDepth = Math.max(maxLockDepth, lockDepth); },
      releaseLock() { lockDepth--; }
    }) },
    Utilities: {
      getUuid: (() => { let n = 0; return () => `MOV-${++n}`; })(),
      formatDate: value => new Date(value).toISOString().slice(0, 10)
    },
    Session: { getScriptTimeZone: () => 'UTC' },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: text => ({ text, setMimeType() { return this; } })
    }
  };
  vm.createContext(context);
  vm.runInContext(CODE, context);
  return {
    context, operational, catalog,
    lockDepth: () => lockDepth,
    lockAcquisitions: () => lockAcquisitions,
    maxLockDepth: () => maxLockDepth
  };
}

function parseResponse(response) { return JSON.parse(response.text); }
function post(context, payload) { return parseResponse(context.doPost({ postData: { contents: JSON.stringify(payload) } })); }
function get(context, parameters) { return parseResponse(context.doGet({ parameter: parameters })); }

test('providers are listed privately and create/update preserve PK and unknown columns', () => {
  const { context, operational, lockDepth } = makeContext({ providers: [
    ['Id_Proveedor', 'Nombre', 'Telefono', 'Direccion', 'Activo', 'Notas', 'Futuro'],
    ['PRV-A', 'Proveedor sintético', 'tel-sintético', 'dir-sintética', true, 'nota sintética', 'preservar']
  ] });
  const listed = get(context, { accion: 'listarProveedores' });
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.proveedores[0], {
    Id_Proveedor: 'PRV-A', Nombre: 'Proveedor sintético', Telefono: 'tel-sintético',
    Direccion: 'dir-sintética', Activo: true, Notas: 'nota sintética'
  });

  assert.equal(post(context, { accion: 'crearProveedor', proveedor: {
    Id_Proveedor: 'PRV-B', Nombre: 'Segundo sintético', Activo: false
  }}).ok, true);
  assert.equal(post(context, { accion: 'actualizarProveedor', proveedor: {
    Id_Proveedor_Original: 'PRV-A', Id_Proveedor: 'PRV-A', Nombre: 'Actualizado', Activo: false
  }}).ok, true);
  assert.equal(operational.getSheetByName('Proveedores').rows[1][6], 'preservar');
  assert.equal(lockDepth(), 0);
});

test('provider listing normalizes approved legacy text flags without weakening write validation', () => {
  const { context } = makeContext({ providers: [
    ['Id_Proveedor', 'Nombre', 'Telefono', 'Direccion', 'Activo', 'Notas'],
    ['PRV-A', 'Proveedor A', '', '', 'SI', ''],
    ['PRV-B', 'Proveedor B', '', '', 'NO', '']
  ] });
  const listed = get(context, { accion: 'listarProveedores' });
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.proveedores.map((p) => p.Activo), [true, false]);
  assert.equal(post(context, { accion: 'crearProveedor', proveedor: {
    Id_Proveedor: 'PRV-C', Nombre: 'Proveedor C', Activo: 'SI'
  }}).ok, false);
});

test('provider writes reject duplicates, missing targets, PK mutation and invalid booleans atomically', () => {
  const { context, operational } = makeContext();
  const before = JSON.stringify(operational.getSheetByName('Proveedores').rows);
  for (const payload of [
    { accion: 'crearProveedor', proveedor: { Id_Proveedor: 'PRV-A', Nombre: 'Duplicado', Activo: true } },
    { accion: 'crearProveedor', proveedor: { Id_Proveedor: 'PRV-B', Nombre: 'Inválido', Activo: 'sí' } },
    { accion: 'actualizarProveedor', proveedor: { Id_Proveedor_Original: 'NO-EXISTE', Nombre: 'X', Activo: true } },
    { accion: 'actualizarProveedor', proveedor: { Id_Proveedor_Original: 'PRV-A', Id_Proveedor: 'OTRO', Nombre: 'X', Activo: true } }
  ]) assert.equal(post(context, payload).ok, false);
  assert.equal(JSON.stringify(operational.getSheetByName('Proveedores').rows), before);
});

test('duplicate provider rows fail closed', () => {
  const { context } = makeContext({ providers: [
    ['Id_Proveedor', 'Nombre', 'Telefono', 'Direccion', 'Activo', 'Notas'],
    ['PRV-A', 'Uno', '', '', true, ''], ['PRV-A', 'Dos', '', '', true, '']
  ] });
  assert.equal(get(context, { accion: 'listarProveedores' }).ok, false);
});

test('provider listing fails closed for an empty required name', () => {
  const { context } = makeContext({ providers: [
    ['Id_Proveedor', 'Nombre', 'Telefono', 'Direccion', 'Activo', 'Notas'],
    ['PRV-A', '', '', '', true, '']
  ] });
  assert.equal(get(context, { accion: 'listarProveedores' }).ok, false);
});

test('product classification validates C-01, provider, modality and boolean without backfill', () => {
  const { context, catalog } = makeContext();
  assert.equal(post(context, { accion: 'clasificarProducto', clasificacion: {
    Id_Producto: 'P-2', Id_Proveedor: 'PRV-A', Modalidad_Abastecimiento: 'CONSIGNACION', Sin_Stock: true
  }}).ok, true);
  assert.deepEqual(catalog.getSheetByName('⬛Productos').rows[2],
    ['P-2', 'LEGACY-2', 'Producto histórico', 'PRV-A', 'CONSIGNACION', true, 'preservar']);

  for (const clasificacion of [
    { Id_Producto: 'P-1', Id_Proveedor: 'NO', Modalidad_Abastecimiento: 'STOCK_PROPIO', Sin_Stock: false },
    { Id_Producto: 'P-1', Id_Proveedor: 'PRV-A', Modalidad_Abastecimiento: 'OTRA', Sin_Stock: false },
    { Id_Producto: 'P-1', Id_Proveedor: 'PRV-A', Modalidad_Abastecimiento: 'STOCK_PROPIO', Sin_Stock: 'false' }
  ]) assert.equal(post(context, { accion: 'clasificarProducto', clasificacion }).ok, false);
  assert.equal(post(context, { accion: 'crearProveedor', proveedor: {
    Id_Proveedor: 'PRV-INACTIVO', Nombre: 'Inactivo sintético', Activo: false
  }}).ok, true);
  assert.equal(post(context, { accion: 'clasificarProducto', clasificacion: {
    Id_Producto: 'P-1', Id_Proveedor: 'PRV-INACTIVO', Modalidad_Abastecimiento: 'STOCK_PROPIO', Sin_Stock: false
  }}).ok, false);
});

test('catalog access uses the exact live product tab title', () => {
  const { context, catalog } = makeContext({ productSheetName: '⬛Productos' });
  assert.equal(post(context, { accion: 'clasificarProducto', clasificacion: {
    Id_Producto: 'P-2', Id_Proveedor: 'PRV-A',
    Modalidad_Abastecimiento: 'CONSIGNACION', Sin_Stock: false
  }}).ok, true);
  assert.equal(catalog.getSheetByName('Productos'), null);
  assert.equal(catalog.getSheetByName('⬛Productos').rows[2][3], 'PRV-A');
});

test('classification fails closed before adding columns when Codigo_Proveedor is absent', () => {
  const { context, catalog } = makeContext({ products: [['Id', 'Producto'], ['P-1', 'Sintético']] });
  assert.equal(post(context, { accion: 'clasificarProducto', clasificacion: {
    Id_Producto: 'P-1', Id_Proveedor: 'PRV-A', Modalidad_Abastecimiento: 'STOCK_PROPIO', Sin_Stock: false
  }}).ok, false);
  assert.deepEqual(catalog.getSheetByName('⬛Productos').rows[0], ['Id', 'Producto']);
});

test('missing product rejects classification before adding supply columns', () => {
  const { context, catalog } = makeContext({ products: [
    ['Id', 'Codigo_Proveedor', 'Producto'], ['P-1', 'LEGACY-1', 'Sintético']
  ] });
  assert.equal(post(context, { accion: 'clasificarProducto', clasificacion: {
    Id_Producto: 'NO-EXISTE', Id_Proveedor: 'PRV-A', Modalidad_Abastecimiento: 'STOCK_PROPIO', Sin_Stock: false
  }}).ok, false);
  assert.deepEqual(catalog.getSheetByName('⬛Productos').rows[0], ['Id', 'Codigo_Proveedor', 'Producto']);
});

test('manual movement writer creates immutable signed movements and rejects invalid payloads atomically', () => {
  const { context, operational } = makeContext();
  const ingreso = post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 10, Costo_Unitario: 4, Modalidad_Abastecimiento: 'STOCK_PROPIO', Referencia: 'COMPRA-SINTETICA'
  }});
  assert.equal(ingreso.ok, true);
  assert.match(ingreso.movimiento.Movimiento_Id, /^MOV-/);
  const sheet = operational.getSheetByName('Movimientos_Stock');
  assert.deepEqual(sheet.rows[0], ['Movimiento_Id', 'Fecha', 'Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario', 'Referencia', 'Nota', 'Id_Pedido', 'Item_Id', 'Clave_Idempotencia', 'Modalidad_Abastecimiento']);
  assert.equal(post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'CONSUMO_PROPIO', Cantidad: -2
  }}).ok, true);
  assert.equal(post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'ROTURA_MERMA', Cantidad: -1
  }}).ok, true);
  const before = sheet.rows.length;
  const invalid = [
    { Id_Producto: 'P-1', Tipo: 'VENTA', Cantidad: -1 },
    { Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: -1, Costo_Unitario: 2 },
    { Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: -1 },
    { Id_Producto: 'P-2', Tipo: 'CONSUMO_PROPIO', Cantidad: -1 },
    { Id_Producto: 'NO', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 1 },
    { Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 0, Nota: 'x', Referencia: ingreso.movimiento.Movimiento_Id },
    { Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: -1, Nota: '', Referencia: ingreso.movimiento.Movimiento_Id },
    { Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: -1, Nota: 'x', Referencia: 'NO' }
  ];
  for (const movimiento of invalid) assert.equal(post(context, { accion: 'registrarMovimiento', movimiento }).ok, false);
  assert.equal(sheet.rows.length, before);

  const correction = post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: -1, Nota: 'Ajuste sintético', Referencia: ingreso.movimiento.Movimiento_Id
  }});
  assert.equal(correction.ok, true);
  assert.equal(sheet.rows.find(row => row[0] === ingreso.movimiento.Movimiento_Id)[4], 10);
  assert.equal(post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 1, Nota: 'Ajuste positivo', Referencia: correction.movimiento.Movimiento_Id
  }}).ok, true);
  assert.throws(() => context.registrarMovimiento({
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: Infinity, Costo_Unitario: 1, Modalidad_Abastecimiento: 'STOCK_PROPIO'
  }), /finito/);
});

test('corrections reject cross-product antecedents', () => {
  const { context } = makeContext({ products: [
    ['Id', 'Codigo_Proveedor', 'Producto', 'Id_Proveedor', 'Modalidad_Abastecimiento', 'Sin_Stock'],
    ['P-1', 'L1', 'Uno', 'PRV-A', 'STOCK_PROPIO', false],
    ['P-3', 'L3', 'Tres', 'PRV-A', 'CONSIGNACION', false]
  ] });
  const prior = post(context, { accion: 'registrarMovimiento', movimiento: { Id_Producto: 'P-3', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 1, Modalidad_Abastecimiento: 'CONSIGNACION' } });
  assert.equal(post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 1, Nota: 'x', Referencia: prior.movimiento.Movimiento_Id
  }}).ok, false);
});

test('first invalid correction leaves the ledger sheet completely absent', () => {
  const { context, operational } = makeContext();
  assert.equal(operational.getSheetByName('Movimientos_Stock'), null);
  const result = post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 1,
    Nota: 'Corrección sintética', Referencia: 'MOV-INEXISTENTE'
  }});
  assert.equal(result.ok, false);
  assert.equal(operational.getSheetByName('Movimientos_Stock'), null);
});

test('manual idempotency rejects the reserved sale namespace and compares the full canonical payload', () => {
  const { context, operational } = makeContext();
  const reserved = post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 1,
    Clave_Idempotencia: 'VENTA:RESERVADA:ITEM-1'
  }});
  assert.equal(reserved.ok, false);
  assert.equal(operational.getSheetByName('Movimientos_Stock'), null);

  const base = {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 2, Costo_Unitario: 4, Modalidad_Abastecimiento: 'STOCK_PROPIO',
    Referencia: 'COMPRA-SINTETICA', Nota: 'Ingreso sintético',
    Clave_Idempotencia: 'MANUAL:INGRESO:1'
  };
  const first = post(context, { accion: 'registrarMovimiento', movimiento: base });
  const retry = post(context, { accion: 'registrarMovimiento', movimiento: base });
  assert.equal(retry.ok, true);
  assert.equal(retry.movimiento.Movimiento_Id, first.movimiento.Movimiento_Id);
  assert.equal(operational.getSheetByName('Movimientos_Stock').rows.length, 2);
  for (const incompatible of [
    { ...base, Costo_Unitario: 5 },
    { ...base, Referencia: 'OTRA-REFERENCIA' },
    { ...base, Nota: 'Otra nota' },
    { ...base, Id_Pedido: 'PED-NO-PERMITIDO' },
    { ...base, Item_Id: 'ITEM-NO-PERMITIDO' }
  ]) assert.equal(post(context, { accion: 'registrarMovimiento', movimiento: incompatible }).ok, false);
  assert.equal(operational.getSheetByName('Movimientos_Stock').rows.length, 2);
});

test('internal sale writer is idempotent and rejects incompatible collisions', () => {
  const { context, operational } = makeContext();
  const sale = { Id_Producto: 'P-1', Cantidad: -2, Id_Pedido: '42', Item_Id: 'ITEM-2' };
  const first = context.registrarVentaInterna(sale);
  const retry = context.registrarVentaInterna(sale);
  assert.equal(retry.Movimiento_Id, first.Movimiento_Id);
  assert.equal(operational.getSheetByName('Movimientos_Stock').rows.length, 2);
  for (const incompatible of [
    { ...sale, Cantidad: -3 }, { ...sale, Id_Producto: 'P-2' },
    { ...sale, Id_Pedido: '43', Clave_Idempotencia: 'VENTA:42:ITEM-2' },
    { ...sale, Item_Id: 'ITEM-3', Clave_Idempotencia: 'VENTA:42:ITEM-2' },
    { ...sale, Costo_Unitario: 3 },
    { ...sale, Referencia: 'referencia distinta' },
    { ...sale, Nota: 'contenido distinto' }
  ]) assert.throws(() => context.registrarVentaInterna(incompatible));
});

test('separate ingress requests each acquire the lock and receive unique IDs', () => {
  const { context, lockDepth, lockAcquisitions } = makeContext();
  const payload = { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 1, Modalidad_Abastecimiento: 'STOCK_PROPIO'
  }};
  const first = post(context, payload);
  const second = post(context, payload);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.movimiento.Movimiento_Id, second.movimiento.Movimiento_Id);
  assert.equal(lockAcquisitions(), 2);
  assert.equal(lockDepth(), 0);
});

test('stock summary is algebraic, isolated, nullable for unmanaged products and preserves Sin_Stock', () => {
  const { context } = makeContext({ products: [
    ['Id', 'Codigo_Proveedor', 'Producto', 'Id_Proveedor', 'Modalidad_Abastecimiento', 'Sin_Stock'],
    ['P-1', 'L1', 'Uno', 'PRV-A', 'STOCK_PROPIO', false],
    ['P-2', 'L2', 'Dos', '', '', ''],
    ['P-3', 'L3', 'Tres', 'PRV-A', 'CONSIGNACION', false]
  ] });
  const movements = [
    ['INGRESO', 10, 1], ['CONSUMO_PROPIO', -1], ['ROTURA_MERMA', -2]
  ];
  for (const [Tipo, Cantidad, Costo_Unitario] of movements) {
    assert.equal(post(context, { accion: 'registrarMovimiento', movimiento: { Id_Producto: 'P-1', Tipo, Cantidad, Costo_Unitario, ...(Tipo === 'INGRESO' ? { Modalidad_Abastecimiento: 'STOCK_PROPIO' } : {}) } }).ok, true);
  }
  const prior = post(context, { accion: 'registrarMovimiento', movimiento: { Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 1, Modalidad_Abastecimiento: 'STOCK_PROPIO' } }).movimiento;
  assert.equal(post(context, { accion: 'registrarMovimiento', movimiento: { Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: -3, Nota: 'x', Referencia: prior.Movimiento_Id } }).ok, true);
  const result = get(context, { accion: 'resumenStock' });
  assert.equal(result.ok, true);
  const byId = Object.fromEntries(result.productos.map(product => [product.Id_Producto, product]));
  assert.equal(byId['P-1'].Saldo, 5);
  assert.equal(byId['P-1'].Sin_Stock, false);
  assert.equal(byId['P-2'].Gestiona_Stock, false);
  assert.equal(byId['P-2'].Saldo, null);
  assert.equal(byId['P-3'].Saldo, 0);
});

test('stock summary fails closed with no partial balances for malformed ledger rows', () => {
  const headers = ['Movimiento_Id', 'Fecha', 'Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario', 'Referencia', 'Nota', 'Id_Pedido', 'Item_Id', 'Clave_Idempotencia', 'Modalidad_Abastecimiento'];
  const badRows = [
    ['', new Date(), 'P-1', 'INGRESO', 1, 1, '', '', '', '', ''],
    ['MOV-X', new Date(), 'P-1', 'VENTA', 1, '', '', '', '1', 'I', 'VENTA:1:I'],
    ['MOV-X', new Date(), 'P-1', 'CORRECCION', 1, '', 'NO', 'x', '', '', '']
  ];
  for (const row of badRows) {
    const { context } = makeContext({ movements: [headers, row] });
    const result = get(context, { accion: 'resumenStock' });
    assert.equal(result.ok, false);
    assert.equal('productos' in result, false);
  }
});

test('stock summary GET fails closed without creating a missing ledger', () => {
  const { context, operational } = makeContext();
  assert.equal(operational.getSheetByName('Movimientos_Stock'), null);
  const result = get(context, { accion: 'resumenStock' });
  assert.equal(result.ok, false);
  assert.match(result.error, /Movimientos_Stock/);
  assert.equal('productos' in result, false);
  assert.equal(operational.getSheetByName('Movimientos_Stock'), null);
  assert.equal(operational.insertSheetCalls, 0);
});

test('C-04 lists the private ledger newest first with only operational identifiers', () => {
  const headers = ['Movimiento_Id', 'Fecha', 'Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario', 'Referencia', 'Nota', 'Id_Pedido', 'Item_Id', 'Clave_Idempotencia', 'Modalidad_Abastecimiento'];
  const { context } = makeContext({ movements: [
    headers,
    ['MOV-1', new Date('2026-01-10T09:00:00Z'), 'P-1', 'INGRESO', 8, 12, 'COMPRA-1', '', '', '', 'MANUAL:UNO', 'STOCK_PROPIO'],
    ['MOV-2', new Date('2026-01-11T09:00:00Z'), 'P-1', 'VENTA', -2, '', '', '', 'PEDIDO-1', 'ITEM-1', 'VENTA:PEDIDO-1:ITEM-1', ''],
    ['MOV-3', new Date('2026-01-12T09:00:00Z'), 'P-1', 'CONSUMO_PROPIO', -1, '', '', 'Uso interno', '', '', 'MANUAL:DOS', '']
  ] });
  // El historial no puede resolver nada fuera del libro mayor, aun cuando
  // esas lecturas privadas existan en el mismo proyecto.
  context.leerPedidos = () => { throw new Error('No debe leer pedidos.'); };
  context.leerClientes = () => { throw new Error('No debe leer clientes.'); };
  context.listarProveedores = () => { throw new Error('No debe leer proveedores.'); };

  const result = get(context, { accion: 'listarMovimientos' });

  assert.equal(result.ok, true);
  assert.deepEqual(result.movimientos.map(m => m.Movimiento_Id), ['MOV-3', 'MOV-2', 'MOV-1']);
  const camposOperativos = new Set([
    'Movimiento_Id', 'Fecha', 'Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario',
    'Nota', 'Referencia', 'Id_Pedido', 'Item_Id'
  ]);
  for (const movimiento of result.movimientos) {
    assert.ok(Object.keys(movimiento).every(campo => camposOperativos.has(campo)));
    assert.equal('Cliente' in movimiento, false);
    assert.equal('Telefono' in movimiento, false);
    assert.equal('Direccion' in movimiento, false);
    assert.equal('Notas_Proveedor' in movimiento, false);
  }
  assert.deepEqual(result.movimientos[1], {
    Movimiento_Id: 'MOV-2', Fecha: '2026-01-11T09:00:00.000Z',
    Id_Producto: 'P-1', Tipo: 'VENTA', Cantidad: -2,
    Nota: '', Referencia: '', Id_Pedido: 'PEDIDO-1', Item_Id: 'ITEM-1'
  });
  assert.equal('Costo_Unitario' in result.movimientos[1], false);
});

test('C-04 filters private history without creating or partially returning a ledger', () => {
  const headers = ['Movimiento_Id', 'Fecha', 'Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario', 'Referencia', 'Nota', 'Id_Pedido', 'Item_Id', 'Clave_Idempotencia', 'Modalidad_Abastecimiento'];
  const { context, operational } = makeContext({ movements: [
    headers,
    ['MOV-1', new Date('2026-01-10T09:00:00Z'), 'P-1', 'INGRESO', 2, 3, '', '', '', '', 'MANUAL:UNO', 'STOCK_PROPIO'],
    ['MOV-2', new Date('2026-01-11T09:00:00Z'), 'P-1', 'ROTURA_MERMA', -1, '', '', '', '', '', 'MANUAL:DOS', ''],
    ['MOV-3', new Date('2026-01-12T09:00:00Z'), 'P-2', 'CONSUMO_PROPIO', -1, '', '', '', '', '', 'MANUAL:TRES', '']
  ] });

  assert.deepEqual(get(context, { accion: 'listarMovimientos', Id_Producto: 'P-1' }).movimientos.map(m => m.Movimiento_Id), ['MOV-2', 'MOV-1']);
  assert.deepEqual(get(context, { accion: 'listarMovimientos', Tipo: 'ROTURA_MERMA' }).movimientos.map(m => m.Movimiento_Id), ['MOV-2']);
  assert.deepEqual(get(context, { accion: 'listarMovimientos', Tipo: 'VENTA' }).movimientos, []);
  assert.equal(operational.insertSheetCalls, 0);

  const { context: sinLibro, operational: sinLibroOperativo } = makeContext();
  const fallido = get(sinLibro, { accion: 'listarMovimientos' });
  assert.equal(fallido.ok, false);
  assert.equal('movimientos' in fallido, false);
  assert.equal(sinLibroOperativo.getSheetByName('Movimientos_Stock'), null);
  assert.equal(sinLibroOperativo.insertSheetCalls, 0);
});

test('serialized first writes initialize the ledger exactly once', () => {
  const { context, operational, lockAcquisitions, maxLockDepth } = makeContext();
  const payload = { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 1, Modalidad_Abastecimiento: 'STOCK_PROPIO'
  }};
  const first = post(context, payload);
  const second = post(context, payload);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(operational.insertSheetCalls, 1);
  assert.equal(operational.getSheetByName('Movimientos_Stock').rows.length, 3);
  assert.equal(lockAcquisitions(), 2);
  assert.equal(maxLockDepth(), 1);
});

test('stock summary exposes negative balances without mutating availability', () => {
  const { context } = makeContext();
  assert.equal(post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'ROTURA_MERMA', Cantidad: -2
  }}).ok, true);
  const result = get(context, { accion: 'resumenStock' });
  const product = result.productos.find(row => row.Id_Producto === 'P-1');
  assert.equal(product.Saldo, -2);
  assert.equal(product.Sin_Stock, false);
});

function productosMixtos() {
  return [
    ['Id', 'Codigo_Proveedor', 'Producto', 'Id_Proveedor', 'Modalidad_Abastecimiento', 'Sin_Stock'],
    ['P-1', 'SKU-REPETIDO', 'Producto de stock propio', 'PRV-A', 'STOCK_PROPIO', false],
    ['P-2', 'SKU-REPETIDO', 'Producto en consignación', 'PRV-A', 'CONSIGNACION', false],
    ['P-3', 'SKU-OTRO', 'Producto contra pedido', 'PRV-A', 'CONTRA_PEDIDO', false]
  ];
}

function linea(id, cant) { return { id, nombre: `Producto ${id}`, cant, unit: 10, total: cant * 10 }; }

test('C-03 snapshots preserve Item_Id and classification across catalog changes, repeated SKU, quantity changes and reordering', () => {
  const { context } = makeContext({ products: productosMixtos() });
  const initial = post(context, { accion: 'guardar', pedido: {
    canal: 'b2c', estado: 'Nuevo', items: [linea('P-1', 1), linea('P-1', 2), linea('P-3', 1)]
  }});
  assert.equal(initial.ok, true);
  const original = initial.pedido;
  const originalIds = original.items.map(item => item.itemId);
  assert.equal(new Set(originalIds).size, 3);
  assert.ok(originalIds.every(Boolean));
  assert.deepEqual(original.items.map(item => item.modalidadAbastecimiento), ['STOCK_PROPIO', 'STOCK_PROPIO', 'CONTRA_PEDIDO']);
  assert.deepEqual(original.items.map(item => item.gestionaStock), [true, true, false]);

  assert.equal(post(context, { accion: 'clasificarProducto', clasificacion: {
    Id_Producto: 'P-1', Id_Proveedor: 'PRV-A', Modalidad_Abastecimiento: 'CONTRA_PEDIDO', Sin_Stock: false
  }}).ok, true);

  const edited = post(context, { accion: 'guardar', pedido: {
    ...original,
    items: [
      { ...original.items[1], cant: 7 },
      { ...original.items[0] },
      { ...original.items[2] },
      linea('P-1', 3)
    ]
  }});
  assert.equal(edited.ok, true);
  assert.deepEqual(edited.pedido.items.slice(0, 3).map(item => item.itemId), [originalIds[1], originalIds[0], originalIds[2]]);
  assert.deepEqual(edited.pedido.items.slice(0, 3).map(item => item.modalidadAbastecimiento), ['STOCK_PROPIO', 'STOCK_PROPIO', 'CONTRA_PEDIDO']);
  assert.equal(edited.pedido.items[0].cant, 7);
  assert.notEqual(edited.pedido.items[3].itemId, originalIds[0]);
  assert.equal(edited.pedido.items[3].modalidadAbastecimiento, 'CONTRA_PEDIDO');
  assert.equal(edited.pedido.items[3].gestionaStock, false);

  const delivered = post(context, { accion: 'guardar', pedido: { ...edited.pedido, estado: 'Entregado' } });
  assert.equal(delivered.ok, true);
  const ledger = context.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Movimientos_Stock');
  const headers = ledger.rows[0];
  const postedItemIds = ledger.rows.slice(1).map(row => row[headers.indexOf('Item_Id')]).sort();
  assert.deepEqual(postedItemIds, [originalIds[0], originalIds[1]].sort());
  assert.equal(context.resumenStock().find(product => product.Id_Producto === 'P-1').Saldo, null);
});

test('C-03 posts only managed snapshots when an order transitions to Entregado, then blocks direct edits while corrections remain append-only', () => {
  const { context, operational, lockAcquisitions, maxLockDepth } = makeContext({ products: productosMixtos() });
  const pending = post(context, { accion: 'guardar', pedido: {
    canal: 'b2c', estado: 'Nuevo', medioPago: 'Transferencia', items: [linea('P-1', 2), linea('P-2', 3), linea('P-3', 4)]
  }}).pedido;
  const cancelled = post(context, { accion: 'guardar', pedido: { ...pending, estado: 'Cancelado', medioPago: 'Efectivo' } });
  assert.equal(cancelled.ok, true);
  assert.equal(operational.getSheetByName('Movimientos_Stock'), null);

  const locksBeforeDelivery = lockAcquisitions();
  const delivered = post(context, { accion: 'guardar', pedido: { ...cancelled.pedido, estado: 'Entregado', medioPago: 'Transferencia' } });
  assert.equal(delivered.ok, true);
  assert.equal(lockAcquisitions(), locksBeforeDelivery + 1);
  assert.equal(maxLockDepth(), 1);
  const ledger = operational.getSheetByName('Movimientos_Stock');
  const rows = ledger.rows.slice(1);
  assert.equal(rows.length, 2);
  const headers = ledger.rows[0];
  const movements = rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
  assert.deepEqual(movements.map(m => m.Clave_Idempotencia).sort(), [
    `VENTA:${pending.id}:${pending.items[0].itemId}`,
    `VENTA:${pending.id}:${pending.items[1].itemId}`
  ].sort());
  assert.deepEqual(movements.map(m => m.Cantidad).sort((a, b) => a - b), [-3, -2]);
  assert.equal(movements.some(m => m.Item_Id === pending.items[2].itemId), false);

  const ventaOriginal = JSON.stringify(rows[0]);
  const blocked = post(context, { accion: 'guardar', pedido: {
    ...delivered.pedido, estado: 'Cancelado', items: [{ ...delivered.pedido.items[0], cant: 99 }]
  }});
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /Entregado/);
  assert.equal(JSON.stringify(ledger.rows[1]), ventaOriginal);

  const correction = post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 2, Nota: 'Ajuste trazable', Referencia: movements.find(m => m.Id_Producto === 'P-1').Movimiento_Id
  }});
  assert.equal(correction.ok, true);
  assert.equal(JSON.stringify(ledger.rows[1]), ventaOriginal);
  assert.equal(ledger.rows.length, 4);
});

test('C-03 leaves a partially applied mixed delivery recoverable and retries only the missing idempotent sale', () => {
  const { context, operational } = makeContext({ products: productosMixtos() });
  const pending = post(context, { accion: 'guardar', pedido: {
    canal: 'b2c', estado: 'Nuevo', items: [linea('P-1', 1), linea('P-2', 2), linea('P-3', 3)]
  }}).pedido;
  const writer = context.registrarVentaInternaSinLock;
  context.registrarVentaInternaSinLock = movimiento => {
    if (movimiento.Id_Producto === 'P-2') throw new Error('Fallo simulado después de la primera venta.');
    return writer(movimiento);
  };
  const failed = post(context, { accion: 'guardar', pedido: { ...pending, estado: 'Entregado' } });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /Fallo simulado/);
  assert.equal(context.leerPedidos().find(order => order.id === pending.id).estado, 'Nuevo');
  const ledger = operational.getSheetByName('Movimientos_Stock');
  assert.equal(ledger.rows.length, 2);
  const firstSale = JSON.stringify(ledger.rows[1]);

  context.registrarVentaInternaSinLock = writer;
  const retried = post(context, { accion: 'guardar', pedido: { ...pending, estado: 'Entregado' } });
  assert.equal(retried.ok, true);
  assert.equal(ledger.rows.length, 3);
  assert.equal(JSON.stringify(ledger.rows[1]), firstSale);
  assert.equal(context.leerPedidos().find(order => order.id === pending.id).estado, 'Entregado');
});

test('C-03 rejects removing a line after a partial delivery sale without changing the order, items or ledger', () => {
  const { context, operational } = makeContext({ products: productosMixtos() });
  const pending = post(context, { accion: 'guardar', pedido: {
    canal: 'b2c', estado: 'Nuevo', items: [linea('P-1', 1), linea('P-2', 2), linea('P-3', 3)]
  }}).pedido;
  const writer = context.registrarVentaInternaSinLock;
  context.registrarVentaInternaSinLock = movimiento => {
    if (movimiento.Id_Producto === 'P-2') throw new Error('Fallo simulado después de la primera venta.');
    return writer(movimiento);
  };
  assert.equal(post(context, { accion: 'guardar', pedido: { ...pending, estado: 'Entregado' } }).ok, false);
  context.registrarVentaInternaSinLock = writer;

  const before = {
    pedidos: JSON.stringify(operational.getSheetByName('Pedidos').rows),
    items: JSON.stringify(operational.getSheetByName('Items').rows),
    ledger: JSON.stringify(operational.getSheetByName('Movimientos_Stock').rows)
  };
  const rejected = post(context, { accion: 'guardar', pedido: {
    ...pending, estado: 'Entregado', items: [pending.items[1], pending.items[2]]
  }});

  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /recuperación parcial/);
  assert.equal(JSON.stringify(operational.getSheetByName('Pedidos').rows), before.pedidos);
  assert.equal(JSON.stringify(operational.getSheetByName('Items').rows), before.items);
  assert.equal(JSON.stringify(operational.getSheetByName('Movimientos_Stock').rows), before.ledger);
});

test('C-03 rejects changing the quantity or product of a sold line during partial delivery recovery', () => {
  const { context, operational } = makeContext({ products: productosMixtos() });
  const pending = post(context, { accion: 'guardar', pedido: {
    canal: 'b2c', estado: 'Nuevo', items: [linea('P-1', 1), linea('P-2', 2), linea('P-3', 3)]
  }}).pedido;
  const writer = context.registrarVentaInternaSinLock;
  context.registrarVentaInternaSinLock = movimiento => {
    if (movimiento.Id_Producto === 'P-2') throw new Error('Fallo simulado después de la primera venta.');
    return writer(movimiento);
  };
  assert.equal(post(context, { accion: 'guardar', pedido: { ...pending, estado: 'Entregado' } }).ok, false);
  context.registrarVentaInternaSinLock = writer;

  const before = {
    pedidos: JSON.stringify(operational.getSheetByName('Pedidos').rows),
    items: JSON.stringify(operational.getSheetByName('Items').rows),
    ledger: JSON.stringify(operational.getSheetByName('Movimientos_Stock').rows)
  };
  const retries = [
    { ...pending, estado: 'Entregado', items: [{ ...pending.items[0], cant: 9 }, pending.items[1], pending.items[2]] },
    { ...pending, estado: 'Entregado', items: [{ ...pending.items[0], id: 'P-2' }, pending.items[1], pending.items[2]] }
  ];

  retries.forEach(retry => {
    const rejected = post(context, { accion: 'guardar', pedido: retry });
    assert.equal(rejected.ok, false);
    assert.match(rejected.error, /recuperación parcial/);
    assert.equal(JSON.stringify(operational.getSheetByName('Pedidos').rows), before.pedidos);
    assert.equal(JSON.stringify(operational.getSheetByName('Items').rows), before.items);
    assert.equal(JSON.stringify(operational.getSheetByName('Movimientos_Stock').rows), before.ledger);
  });
});

test('C-03 keeps historical items without snapshots readable without backfill or retrospective sales', () => {
  const items = [
    ['Id_Pedido', 'Canal', 'Fecha_Pedido', 'Id_Producto', 'Producto', 'Cantidad', 'Precio_Lista', 'Precio_Unitario', 'Costo_Unitario', 'Cant_Min', 'Precio_Cantidad', 'Subtotal', 'Descuento', 'Total', 'Costo', 'Ganancia', 'Precio_Promo', 'Precio_Promo_Cantidad', 'Porcentaje_Promo'],
    [77, 'b2c', '', 'P-1', 'Histórico sintético', 1, 10, 10, 1, 0, 0, 10, 0, 10, 1, 9, 0, 0, '']
  ];
  const orders = [['Id', 'Estado'], [77, 'Nuevo']];
  const { context, operational } = makeContext({ products: productosMixtos(), orders, items });
  const read = context.leerPedidos();
  assert.equal(read.length, 1);
  assert.equal(read[0].items[0].itemId, '');
  assert.equal(operational.getSheetByName('Movimientos_Stock'), null);
  const headers = operational.getSheetByName('Items').rows[0];
  const row = operational.getSheetByName('Items').rows[1];
  for (const field of ['Item_Id', 'Id_Proveedor', 'Modalidad_Abastecimiento', 'Gestiona_Stock']) {
    assert.equal(row[headers.indexOf(field)] ?? '', '');
  }
  const delivery = post(context, { accion: 'guardar', pedido: { ...read[0], estado: 'Entregado' } });
  assert.equal(delivery.ok, false);
  assert.match(delivery.error, /históricos/);
  assert.equal(operational.getSheetByName('Movimientos_Stock'), null);
});

test('new routes preserve JSON envelopes and rejected writes are atomic', () => {
  const { context, operational } = makeContext();
  const providersBefore = JSON.stringify(operational.getSheetByName('Proveedores').rows);
  const success = get(context, { accion: 'listarProveedores' });
  const failure = post(context, { accion: 'crearProveedor', proveedor: {
    Id_Proveedor: 'PRV-X', Nombre: '', Activo: true
  }});
  assert.equal(success.ok, true);
  assert.ok(Array.isArray(success.proveedores));
  assert.equal(failure.ok, false);
  assert.match(failure.error, /Nombre/);
  assert.equal(JSON.stringify(operational.getSheetByName('Proveedores').rows), providersBefore);

  const legacy = get(context, { accion: 'clientes' });
  assert.deepEqual(legacy, { ok: true, clientes: [] });
});

test('public writers lock exactly once while already-locked primitives never reacquire', () => {
  const { context, lockAcquisitions, maxLockDepth } = makeContext();
  context.crearProveedor({ Id_Proveedor: 'PRV-DIRECTO', Nombre: 'Directo sintético', Activo: true });
  assert.equal(lockAcquisitions(), 1);
  context.actualizarProveedor({
    Id_Proveedor_Original: 'PRV-DIRECTO', Id_Proveedor: 'PRV-DIRECTO',
    Nombre: 'Directo actualizado', Activo: true
  });
  assert.equal(lockAcquisitions(), 2);
  context.clasificarProducto({
    Id_Producto: 'P-2', Id_Proveedor: 'PRV-A',
    Modalidad_Abastecimiento: 'CONSIGNACION', Sin_Stock: false
  });
  assert.equal(lockAcquisitions(), 3);
  context.registrarMovimiento({
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 1, Modalidad_Abastecimiento: 'STOCK_PROPIO'
  });
  assert.equal(lockAcquisitions(), 4);
  context.registrarVentaInterna({
    Id_Producto: 'P-1', Cantidad: -1, Id_Pedido: 'DIRECTO', Item_Id: 'ITEM-1'
  });
  assert.equal(lockAcquisitions(), 5);
  assert.equal(post(context, { accion: 'crearProveedor', proveedor: {
    Id_Proveedor: 'PRV-POST', Nombre: 'Post sintético', Activo: true
  }}).ok, true);
  assert.equal(lockAcquisitions(), 6);

  const lock = context.LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const sale = context.registrarVentaInternaSinLock({
      Id_Producto: 'P-1', Cantidad: -1, Id_Pedido: 'LOCKED', Item_Id: 'ITEM-1'
    });
    assert.equal(sale.Clave_Idempotencia, 'VENTA:LOCKED:ITEM-1');
  } finally {
    lock.releaseLock();
  }
  assert.equal(lockAcquisitions(), 7);
  assert.equal(maxLockDepth(), 1);
});

test('C-08 projects FIFO layers in append-only order and keeps a zero remainder ingress in history', () => {
  const { context } = makeContext();
  const projection = context.proyectarValorizacionLedger([
    { Movimiento_Id: 'I-1', Fecha: '2030-02-02', Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 2, Costo_Unitario: 10, Modalidad_Abastecimiento: 'STOCK_PROPIO' },
    { Movimiento_Id: 'I-2', Fecha: '2030-01-01', Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 3, Costo_Unitario: 20, Modalidad_Abastecimiento: 'CONSIGNACION' },
    { Movimiento_Id: 'S-1', Fecha: '2030-03-01', Id_Producto: 'P-1', Tipo: 'VENTA', Cantidad: -4, Id_Pedido: '1', Item_Id: '1', Clave_Idempotencia: 'VENTA:1:1' },
    { Movimiento_Id: 'S-2', Fecha: '2030-03-02', Id_Producto: 'P-2', Tipo: 'VENTA', Cantidad: -2, Id_Pedido: '2', Item_Id: '2', Clave_Idempotencia: 'VENTA:2:2' },
    { Movimiento_Id: 'I-3', Fecha: '2030-03-03', Id_Producto: 'P-2', Tipo: 'INGRESO', Cantidad: 2, Costo_Unitario: 7, Modalidad_Abastecimiento: 'STOCK_PROPIO' }
  ]);
  const p1 = projection.productos['P-1'];
  const p2 = projection.productos['P-2'];
  assert.deepEqual(JSON.parse(JSON.stringify(p1.tandas.map(t => [t.Movimiento_Id, t.Remanente]))), [['I-1', 0], ['I-2', 1]]);
  assert.equal(p1.valores.consignacion, 20);
  assert.equal(p1.valores.stockPropio, 0);
  assert.equal(p2.tandas.find(t => t.Movimiento_Id === 'I-3').Remanente, 0);
  assert.equal(p2.coberturas[0].Salida_Movimiento_Id, 'S-2');
});

test('C-08 marks historical incomplete layers and rejects invalid new ingresses and invalid reversals', () => {
  const { context } = makeContext();
  const projection = context.proyectarValorizacionLedger([
    { Movimiento_Id: 'H-1', Fecha: '2030-01-01', Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 2, Costo_Unitario: '', Modalidad_Abastecimiento: '' },
    { Movimiento_Id: 'I-1', Fecha: '2030-01-02', Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 5, Modalidad_Abastecimiento: 'STOCK_PROPIO' }
  ]);
  assert.equal(projection.productos['P-1'].estadoCapitalCompleto, false);
  assert.equal(projection.productos['P-1'].valores.totalConocido, 5);
  assert.throws(() => context.validarMovimientoNuevoParaValorizacion({ Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 5, Modalidad_Abastecimiento: '' }), /Modalidad/);
  assert.throws(() => context.proyectarValorizacionLedger([
    { Movimiento_Id: 'S-1', Fecha: '2030-01-01', Id_Producto: 'P-1', Tipo: 'VENTA', Cantidad: -1, Id_Pedido: '1', Item_Id: '1', Clave_Idempotencia: 'VENTA:1:1' },
    { Movimiento_Id: 'C-1', Fecha: '2030-01-02', Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 2, Referencia: 'S-1', Nota: 'invalida' }
  ]), /reversible/);
});

test('C-08 reverses a covered shortage before original FIFO layers and rejects exhausted references', () => {
  const { context } = makeContext();
  const projection = context.proyectarValorizacionLedger([
    { Movimiento_Id: 'I-1', Fecha: '2030-01-01', Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 2, Costo_Unitario: 10, Modalidad_Abastecimiento: 'STOCK_PROPIO' },
    { Movimiento_Id: 'S-1', Fecha: '2030-01-02', Id_Producto: 'P-1', Tipo: 'VENTA', Cantidad: -4, Id_Pedido: '1', Item_Id: '1', Clave_Idempotencia: 'VENTA:1:1' },
    { Movimiento_Id: 'I-2', Fecha: '2030-01-03', Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 2, Costo_Unitario: 20, Modalidad_Abastecimiento: 'CONSIGNACION' },
    { Movimiento_Id: 'C-1', Fecha: '2030-01-04', Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 3, Referencia: 'S-1', Nota: 'reversión parcial' },
    { Movimiento_Id: 'C-2', Fecha: '2030-01-05', Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 1, Referencia: 'S-1', Nota: 'reversión final' }
  ]);
  const p1 = projection.productos['P-1'];
  assert.equal(p1.tandas.find(t => t.Movimiento_Id === 'I-1').Remanente, 2);
  assert.equal(p1.tandas.find(t => t.Movimiento_Id === 'I-2').Remanente, 2);
  assert.equal(p1.valores.stockPropio, 20);
  assert.equal(p1.valores.consignacion, 40);
  assert.throws(() => context.proyectarValorizacionLedger([
    { Movimiento_Id: 'S-1', Fecha: '2030-01-01', Id_Producto: 'P-1', Tipo: 'VENTA', Cantidad: -1, Id_Pedido: '1', Item_Id: '1', Clave_Idempotencia: 'VENTA:1:1' },
    { Movimiento_Id: 'C-1', Fecha: '2030-01-02', Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 1, Referencia: 'S-1', Nota: 'ok' },
    { Movimiento_Id: 'C-2', Fecha: '2030-01-03', Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: 1, Referencia: 'S-1', Nota: 'doble' }
  ]), /reversible/);
});

test('C-08 writes the private ingress modality only for new ingresses and keeps legacy rows unmodified', () => {
  const { context, operational } = makeContext({ movements: [
    ['Movimiento_Id', 'Fecha', 'Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario', 'Referencia', 'Nota', 'Id_Pedido', 'Item_Id', 'Clave_Idempotencia'],
    ['H-1', new Date('2030-01-01T00:00:00Z'), 'P-1', 'INGRESO', 1, '', '', '', '', '', 'HIST']
  ] });
  const before = JSON.stringify(operational.getSheetByName('Movimientos_Stock').rows[1]);
  const ok = post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 3
  }});
  assert.equal(ok.ok, true);
  assert.equal(ok.movimiento.Modalidad_Abastecimiento, 'STOCK_PROPIO');
  const sheet = operational.getSheetByName('Movimientos_Stock');
  assert.equal(JSON.stringify(sheet.rows[1].slice(0, 11)), before);
  assert.equal(sheet.rows[0].includes('Modalidad_Abastecimiento'), true);
});

test('C-08 exposes valuation as a read-only private query and fails closed on malformed ledger data', () => {
  const headers = ['Movimiento_Id', 'Fecha', 'Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario', 'Referencia', 'Nota', 'Id_Pedido', 'Item_Id', 'Clave_Idempotencia', 'Modalidad_Abastecimiento'];
  const valid = makeContext({ movements: [headers, ['I-1', new Date('2030-01-01T00:00:00Z'), 'P-1', 'INGRESO', 2, 4, '', '', '', '', 'M-1', 'STOCK_PROPIO']] });
  const before = JSON.stringify(valid.operational.getSheetByName('Movimientos_Stock').rows);
  const read = get(valid.context, { accion: 'valorizacionStock' });
  assert.equal(read.ok, true);
  assert.equal(read.productos.find(producto => producto.Id_Producto === 'P-1').Capital_Stock_Propio, 8);
  assert.equal(JSON.stringify(valid.operational.getSheetByName('Movimientos_Stock').rows), before);
  assert.equal(valid.operational.insertSheetCalls, 0);

  const invalid = makeContext({ movements: [headers, ['I-1', new Date('2030-01-01T00:00:00Z'), 'P-1', 'INGRESO', 2, 4, '', '', '', '', 'M-1', 'OTRA']] });
  const rejected = get(invalid.context, { accion: 'valorizacionStock' });
  assert.equal(rejected.ok, false);
  assert.equal('productos' in rejected, false);
  assert.equal(invalid.operational.insertSheetCalls, 0);
});

test('C-08 derives ingress modality from current classification, rejects a mismatched client value and reads historical layers after reclassification', () => {
  const { context, operational } = makeContext();
  const ingreso = post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 2, Costo_Unitario: 8
  }});
  assert.equal(ingreso.ok, true);
  assert.equal(ingreso.movimiento.Modalidad_Abastecimiento, 'STOCK_PROPIO');
  const before = operational.getSheetByName('Movimientos_Stock').rows.length;
  assert.equal(post(context, { accion: 'registrarMovimiento', movimiento: {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 1, Costo_Unitario: 8, Modalidad_Abastecimiento: 'CONSIGNACION'
  }}).ok, false);
  assert.equal(operational.getSheetByName('Movimientos_Stock').rows.length, before);
  assert.equal(post(context, { accion: 'clasificarProducto', clasificacion: {
    Id_Producto: 'P-1', Id_Proveedor: 'PRV-A', Modalidad_Abastecimiento: 'CONTRA_PEDIDO', Sin_Stock: false
  }}).ok, true);
  const valuacion = get(context, { accion: 'valorizacionStock' });
  assert.equal(valuacion.ok, true);
  const fila = valuacion.productos.find(producto => producto.Id_Producto === 'P-1');
  assert.equal(fila.Modalidad_Abastecimiento, 'CONTRA_PEDIDO');
  assert.equal(fila.Capital_Stock_Propio, 16);
  assert.equal(fila.Gestiona_Stock, true);
});

test('C-08 accepts as non-valued history only when both modality and cost are absent', () => {
  const headers = ['Movimiento_Id', 'Fecha', 'Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario', 'Referencia', 'Nota', 'Id_Pedido', 'Item_Id', 'Clave_Idempotencia', 'Modalidad_Abastecimiento'];
  const compatible = makeContext({ movements: [headers, ['H-1', new Date('2030-01-01T00:00:00Z'), 'P-1', 'INGRESO', 1, '', '', '', '', '', 'H-1', '']] });
  assert.equal(get(compatible.context, { accion: 'valorizacionStock' }).ok, true);
  for (const [costo, modalidad] of [['no-numérico', ''], ['', 'STOCK_PROPIO'], [4, '']]) {
    const contexto = makeContext({ movements: [headers, ['H-1', new Date('2030-01-01T00:00:00Z'), 'P-1', 'INGRESO', 1, costo, '', '', '', '', 'H-1', modalidad]] });
    const respuesta = get(contexto.context, { accion: 'valorizacionStock' });
    assert.equal(respuesta.ok, false);
    assert.equal('productos' in respuesta, false);
  }
});
