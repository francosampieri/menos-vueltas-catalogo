const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { policy, promotion, admin: adminShipping } = require('../shared/shipping.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'shared/app.js'), 'utf8');
function cart(channel = 'B2C', valid = true, code = '21JULIO10') {
  const context = {
    CANAL: channel, codigoPromocional: null,
    carrito: [{ idProd: 'SYNTHETIC', nombre: 'Producto de prueba', marca: '', qty: 1,
      precio: 10000, precioLista: 10000, uniDto: 0, precioDto: null }],
    window: { MenosVueltasShipping: policy, MenosVueltasPromotion: promotion },
    document: { getElementById: () => null }, SHEETS_URL_PUBLICA: 'https://example.invalid',
    fetch: async () => ({ json: async () => valid
      ? { ok: true, promocion: { codigo: code, porcentaje: 10 } }
      : { ok: false, error: 'Código inválido' } }),
    actualizarEstadoCodigoPromocional() {}, actualizarUICarrito() {}, guardarCarritoSesion() {},
    formatPrecio: value => `$${value}`, porcentajeDescuentoLinea: () => '10%',
    carritoTieneProductosNoDisponibles: () => false
  };
  vm.createContext(context);
  for (const name of ['precioEfectivo', 'resumenPedidoActual', 'codigoNormalizado',
    'aplicarCodigoPromocional', 'quitarCodigoPromocional', 'construirMensajePedido', 'codificarPedido']) {
    const block = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
    assert.ok(block, name);
    vm.runInContext(block[0], context);
  }
  return context;
}

test('validated 21JULIO10 discounts products and frees shipping in cart and WhatsApp', async () => {
  const c = cart();
  await c.aplicarCodigoPromocional('21julio10');
  const summary = c.resumenPedidoActual();
  assert.equal(summary.codeDiscount, 1000);
  assert.equal(summary.shippingCost, 0);
  assert.equal(summary.total, 9000);
  assert.equal(summary.progress, 100);
  assert.match(c.construirMensajePedido(), /Envío: GRATIS/);
  assert.match(c.construirMensajePedido(), /Código promocional: 21JULIO10 \(10%\)/);
  assert.equal(c.codificarPedido(), 'SYNTHETICX1:C21JULIO10');
});

test('removing or rejecting the code restores paid shipping', async () => {
  const c = cart();
  await c.aplicarCodigoPromocional('21JULIO10');
  c.quitarCodigoPromocional();
  assert.equal(c.resumenPedidoActual().shippingCost, 1500);
  assert.equal(c.resumenPedidoActual().total, 11500);
  const rejected = cart('B2C', false);
  await rejected.aplicarCodigoPromocional('21JULIO10');
  assert.equal(rejected.resumenPedidoActual().shippingCost, 1500);
  assert.equal(rejected.codigoPromocional, null);
});

test('validated 10OFF gives 10% plus free shipping in cart, WhatsApp and QR; removal and rejection restore shipping', async () => {
  const c = cart('B2C', true, '10OFF');
  await c.aplicarCodigoPromocional(' 10off ');
  assert.equal(c.resumenPedidoActual().codeDiscount, 1000);
  assert.equal(c.resumenPedidoActual().shippingCost, 0);
  assert.equal(c.resumenPedidoActual().total, 9000);
  assert.match(c.construirMensajePedido(), /Envío: GRATIS/);
  assert.match(c.construirMensajePedido(), /Código promocional: 10OFF \(10%\)/);
  assert.equal(c.codificarPedido(), 'SYNTHETICX1:C10OFF');
  c.quitarCodigoPromocional();
  assert.equal(c.resumenPedidoActual().shippingCost, 1500);
  assert.equal(c.resumenPedidoActual().total, 11500);
  await c.aplicarCodigoPromocional('10OFF');
  c.fetch = async () => ({ json: async () => ({ ok: false, error: 'Código inactivo' }) });
  await c.aplicarCodigoPromocional('10OFF');
  assert.equal(c.codigoPromocional, null);
  assert.equal(c.resumenPedidoActual().shippingCost, 1500);
  assert.equal(c.resumenPedidoActual().total, 11500);
  assert.equal(c.resumenPedidoActual().total, 11500);
  const rejected = cart('B2C', false, '10OFF');
  await rejected.aplicarCodigoPromocional('10OFF');
  assert.equal(rejected.codigoPromocional, null);
  assert.equal(rejected.resumenPedidoActual().shippingCost, 1500);
});

test('other codes, invalid percentages and B2B never receive code-based free shipping', () => {
  for (const validatedPromotion of [null, { code: 'OTHER10', percent: 10 },
    { code: '21JULIO10', percent: 0 }, { code: '21JULIO10', percent: 101 }]) {
    assert.equal(policy.calculateShipping({ channel: 'B2C', validatedPromotion,
      items: [{ unitPrice: 9000, quantity: 1 }] }).shippingCost, 1500);
  }
  assert.equal(policy.calculateShipping({ channel: 'B2B',
    validatedPromotion: { code: '21JULIO10', percent: 10 },
    items: [{ unitPrice: 9000, quantity: 1 }] }).status, 'not-applicable');
  assert.equal(policy.calculateShipping({ channel: 'B2C',
    validatedPromotion: { code: '21JULIO10', percent: 10 },
    items: [{ unitPrice: null, quantity: 1 }] }).status, 'confirm');
});

global.document = { addEventListener() {} };
global.MenosVueltasShipping = policy;
global.MenosVueltasAdminShipping = adminShipping;
global.MenosVueltasPromotion = promotion;
const admin = require('../admin/admin.js');

test('admin automatic draft applies free shipping and removal restores charge; history stays frozen', () => {
  const draft = { canal: 'b2c', codigoPromo: '21JULIO10', porcentajeCodigo: 10,
    envioModo: 'automatico', items: [{ id: 'SYNTHETIC', nombre: 'Producto de prueba',
      cant: 1, lista: 10000, promo: 10000, cantMin: 0, porCant: 0, promoCant: 0, costo: 5000 }] };
  assert.equal(admin.calcularPedido(draft).envio, 0);
  assert.equal(admin.calcularPedido(draft).total, 9000);
  assert.equal(admin.calcularPedido({ ...draft, codigoPromo: '', porcentajeCodigo: 0 }).envio, 1500);
  assert.equal(admin.calcularPedido({ ...draft, envioModo: 'historico', envio: 1500 }).envio, 1500);
  assert.equal(admin.calcularPedido({ ...draft, envioModo: 'fijado', envio: 800 }).envio, 800);
  assert.equal(admin.paraGuardar(draft).envio, 0);
});

test('new WhatsApp imports keep campaign shipping automatic so removing the code restores its cost', async () => {
  const adminSource = fs.readFileSync(path.join(__dirname, '..', 'admin/admin.js'), 'utf8');
  for (const code of ['21JULIO10', '10OFF']) for (const id of [undefined, 123]) {
    const context = {
      edicion: { id, canal: 'b2c', items: [] }, CATALOGO: { b2c: [] },
      waParse: { items: [], tieneEnvioMsg: true, envioMsg: 0, codigoPromo: code },
      API: { validarCodigo: async () => ({ promocion: { codigo: code, porcentaje: 10 } }) },
      MenosVueltasPromotion: promotion, normalizarCodigoPromo: promotion.normalizeCode,
      pintarItems() {}, cerrarImportarWA() {}, toast() {}
    };
    vm.runInNewContext(adminSource.match(/async function confirmarImportarWA\([^]*?\n\}/)[0], context);
    await context.confirmarImportarWA();
    assert.equal(context.edicion.envioModo, id == null ? 'automatico' : 'fijado');
  }
});

test('10OFF admin automatic orders get the benefit while invalid codes and B2B remain excluded', () => {
  const draft = { canal: 'b2c', codigoPromo: '10OFF', porcentajeCodigo: 10,
    envioModo: 'automatico', items: [{ id: 'SYNTHETIC', nombre: 'Producto de prueba',
      cant: 1, lista: 20000, promo: 20000, cantMin: 0, porCant: 0, promoCant: 0, costo: 5000 }] };
  assert.equal(admin.calcularPedido(draft).descuentoCodigo, 2000);
  assert.equal(admin.calcularPedido(draft).envio, 0);
  assert.equal(admin.calcularPedido(draft).total, 18000);
  assert.equal(admin.paraGuardar(draft).envio, 0);
  for (const invalid of [{ codigoPromo: '', porcentajeCodigo: 0 },
    { porcentajeCodigo: 0 }, { porcentajeCodigo: 101 }, { codigoPromo: 'OTHER10' }]) {
    assert.equal(admin.calcularPedido({ ...draft, ...invalid }).envio, 1500);
  }
  assert.equal(admin.calcularPedido({ ...draft, canal: 'b2b' }).envio, null);
  assert.equal(admin.calcularPedido({ ...draft, canal: 'b2b' }).total, 20000);
  assert.equal(admin.calcularPedido({ ...draft, envioModo: 'historico', envio: 1500 }).envio, 1500);
  assert.equal(admin.calcularPedido({ ...draft, envioModo: 'fijado', envio: 800 }).envio, 800);
});

test('shipping benefit also covers only temporarily promoted products without discounting them again', async () => {
  for (const code of ['21JULIO10', '10OFF']) {
    const c = cart('B2C', true, code);
    c.carrito[0].precio = 5500;
    c.carrito[0].tienePromoProducto = true;
    await c.aplicarCodigoPromocional(code);
    assert.equal(c.resumenPedidoActual().codeDiscount, 0);
    assert.equal(c.resumenPedidoActual().shippingCost, 0);
    assert.equal(c.resumenPedidoActual().total, 5500);
    assert.ok(c.construirMensajePedido().includes(`Código promocional: ${code}`));
  }
});
