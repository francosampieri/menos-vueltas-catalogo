const test = require('node:test');
const assert = require('node:assert/strict');

// admin.js sólo registra el arranque del navegador al cargarse. Para probar
// sus cálculos puros en Node, alcanza con una versión inerte de document.
global.document = { addEventListener() {} };

const { policy: shipping, admin: adminShipping, promotion } = require('../shared/shipping.js');
global.MenosVueltasShipping = shipping;
global.MenosVueltasAdminShipping = adminShipping;
global.MenosVueltasPromotion = promotion;

const admin = require('../admin/admin.js');

test('B2C rounds catalog prices and applies the code discount line by line', () => {
  const quantityDiscount = admin.lineaDesdeCatalogo({
    id: 'regular', n: 'Producto regular', pv: '6.025', pp: '6.025',
    ud: '2', pd: '6.040', ppd: '6.040', co: '3.000'
  }, 2, 'b2c');
  const temporaryPromotion = admin.lineaDesdeCatalogo({
    id: 'temporal', n: 'Producto temporal', pv: '6.010', pp: '5.500',
    ud: '', pd: '', ppd: '', pct: '10%', co: '3.000'
  }, 1, 'b2c');

  const result = admin.calcularPedido({
    canal: 'b2c', codigoPromo: '21JULIO10', porcentajeCodigo: 10,
    envioManual: false, extras: 0, items: [quantityDiscount, temporaryPromotion]
  });

  assert.equal(quantityDiscount.lista, 6000);
  assert.equal(quantityDiscount.porCant, 6050);
  assert.equal(temporaryPromotion.lista, 6000);
  assert.equal(result.descuentoCodigo, 1200);
  assert.equal(result.elegibleCodigo, 12100);
  assert.equal(result.productosNetos, 16400);
  assert.equal(result.envio, 1500);
  assert.deepEqual(result.promotionLines.map(line => line.discountedTotal), [10900, 5500]);
  assert.deepEqual(result.promotionLines.map(line => line.discount), [1200, 0]);
});

test('B2B preserves frozen values and does not apply a B2C promotion code', () => {
  const line = admin.lineaDesdeCatalogo({
    id: 'b2b', n: 'Producto B2B', pv: '6.010', pp: '6.010',
    ud: '', pd: '', ppd: '', co: '3.000'
  }, 1, 'b2b');
  const result = admin.calcularPedido({
    canal: 'b2b', codigoPromo: '21JULIO10', porcentajeCodigo: 10,
    envioManual: false, extras: 0, items: [line]
  });

  assert.equal(line.lista, 6010);
  assert.equal(result.descuentoCodigo, 0);
  assert.equal(result.productosNetos, 6010);
  assert.equal(result.envio, null);
  assert.deepEqual(result.promotionLines.map(linea => linea.discountedTotal), [6010]);
});
