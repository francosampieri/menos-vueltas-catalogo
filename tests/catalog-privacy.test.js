const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const expectedPublicFields = {
  productos: [
    'Id', 'Activo', 'Cat B2C', 'Cat B2B', 'Producto', 'Marca', 'Tamaño', 'UM',
    'Categoria', 'Subcategoria', 'Tags', 'Id_Grupo', 'Tipo_Variante',
    'Label_Variante', 'Label_Tamaño', 'Imagen', 'Tipo', 'Sin_Stock'
  ],
  grupos: ['Id_Grupo', 'Nombre_Grupo', 'Marca', 'Categoria', 'Subcategoria'],
  precios_b2c: [
    'Id', 'Producto', 'Estado', 'Categoría', 'Subcategoria', 'Tipo',
    'Precio_Venta', 'Uni Dto', 'Dto', 'Precio_Mayorista', 'promo',
    'Precio_Promo', 'Precio_Promo_Mayorista'
  ],
  precios_b2b: [
    'Id', 'Producto', 'Estado', 'Categoría', 'Subcategoria', 'Tipo',
    'Precio_Venta', 'Uni Dto', 'Dto', 'Precio_Mayorista', 'promo',
    'Precio_Promo', 'Precio_Promo_Mayorista'
  ]
};

function filterFixture(payload) {
  const code = [
    'import json,sys',
    `sys.path.insert(0, ${JSON.stringify(root)})`,
    'from scripts.catalog_privacy import filtrar_catalogo_publico',
    'print(json.dumps(filtrar_catalogo_publico(json.loads(sys.stdin.read()))))'
  ].join(';');
  return JSON.parse(execFileSync('python', ['-c', code], {
    cwd: root,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
  }));
}

test('public catalog keeps consumer fields and drops private and unknown columns', () => {
  const fixture = {
    productos: [{
      Id: 'P-1', Activo: 'ON', 'Cat B2C': 'ON', 'Cat B2B': 'OFF',
      Producto: 'Producto sintético', Marca: 'Marca', Tamaño: '1', UM: 'u',
      Categoria: 'Prueba', Subcategoria: 'Caso', Tags: 'tag', Id_Grupo: 'G-1',
      Tipo_Variante: 'simple', Label_Variante: '', Label_Tamaño: '', Imagen: '', Tipo: 'unidad',
      Id_Proveedor: 'PRV-X', Codigo_Proveedor: 'LEGACY-X', Modalidad_Abastecimiento: 'STOCK_PROPIO',
      Sin_Stock: 'TRUE', Saldo: '0', Precio_Costo: '1', Movimientos_Stock: 'interno', Secreto_Futuro: 'no-publicar'
    }],
    grupos: [{ Id_Grupo: 'G-1', Nombre_Grupo: 'Grupo', Marca: 'Marca', Categoria: 'Prueba', Subcategoria: 'Caso', Privado: 'x' }],
    precios_b2c: [{
      Id: 'P-1', Producto: 'Producto sintético', Estado: 'ON', 'Categoría': 'Prueba',
      Subcategoria: 'Caso', Tipo: 'unidad', Precio_Venta: '10', 'Uni Dto': '2', Dto: '1',
      Precio_Mayorista: '9', promo: '10%', Precio_Promo: '9', Precio_Promo_Mayorista: '8',
      Sin_Stock: 'FALSE', Precio_Costo: '1', Id_proveedor: 'LEGACY-X', Markup: '9', Ganancia_Bruta: '8', Strat: 'x', Extra: 'x'
    }],
    precios_b2b: [{ Id: 'P-1', Producto: 'Producto sintético', Precio_Venta: '8', Sin_Stock: 'TRUE', Precio_Costo: '1', Id_proveedor: 'LEGACY-X', Extra: 'x' }]
  };

  const filtered = filterFixture(fixture);
  assert.deepEqual(Object.keys(filtered.productos[0]), expectedPublicFields.productos);
  assert.deepEqual(Object.keys(filtered.grupos[0]), expectedPublicFields.grupos);
  for (const key of ['precios_b2c', 'precios_b2b']) {
    assert.equal('Sin_Stock' in filtered[key][0], false);
    assert.equal('Precio_Costo' in filtered[key][0], false);
    assert.equal('Id_proveedor' in filtered[key][0], false);
    assert.equal('Extra' in filtered[key][0], false);
  }
  assert.equal('Saldo' in filtered.productos[0], false);
  assert.equal('Movimientos_Stock' in filtered.productos[0], false);
  assert.equal(filtered.precios_b2c[0].Precio_Venta, '10');
  assert.equal(filtered.precios_b2b[0].Precio_Venta, '8');
  assert.equal(filtered.productos[0].Sin_Stock, true);
});

test('public availability is boolean and missing or false source values materialize as false', () => {
  const filtered = filterFixture({
    productos: [
      { Id: 'P-SIN-CAMPO' },
      { Id: 'P-FALSE', Sin_Stock: 'false' },
      { Id: 'P-BOOLEANO', Sin_Stock: true }
    ]
  });

  assert.deepEqual(filtered.productos.map(producto => producto.Sin_Stock), [false, false, true]);
  for (const producto of filtered.productos) {
    assert.equal(typeof producto.Sin_Stock, 'boolean');
  }
});

test('public sites do not call C-02 administrative actions', () => {
  const source = ['b2c', 'b2b', 'shared'].flatMap(dir =>
    fs.readdirSync(path.join(root, dir), { recursive: true })
      .filter(file => /\.(?:html|js)$/i.test(file))
      .map(file => fs.readFileSync(path.join(root, dir, file), 'utf8'))
  ).join('\n');
  for (const action of ['listarProveedores', 'crearProveedor', 'actualizarProveedor', 'clasificarProducto', 'registrarMovimiento', 'resumenStock', 'listarMovimientos']) {
    assert.equal(source.includes(action), false, action);
  }
});

test('checked-in public catalog is already sanitized by the production allowlist', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'shared', 'catalogo.json'), 'utf8'));
  for (const [table, fields] of Object.entries(expectedPublicFields)) {
    assert.ok(catalog[table].length > 0, table);
    for (const row of catalog[table]) assert.deepEqual(Object.keys(row), fields, table);
  }
  for (const producto of catalog.productos) {
    assert.equal(typeof producto.Sin_Stock, 'boolean');
  }
});

test('admin reduced catalog retains cost but excludes provider and movement data', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'admin', 'productos.json'), 'utf8'));
  const row = [...catalog.b2c, ...catalog.b2b][0];
  assert.ok(row && Object.hasOwn(row, 'co'));
  for (const prohibited of ['Id_Proveedor', 'Id_proveedor', 'Sin_Stock', 'Telefono', 'Direccion', 'Notas', 'Movimientos_Stock']) {
    assert.equal(JSON.stringify(catalog).includes(prohibited), false, prohibited);
  }
});
