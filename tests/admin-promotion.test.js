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
    envioModo: 'automatico', extras: 0, items: [quantityDiscount, temporaryPromotion]
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
    envioModo: 'automatico', extras: 0, items: [line]
  });

  assert.equal(line.lista, 6010);
  assert.equal(result.descuentoCodigo, 0);
  assert.equal(result.productosNetos, 6010);
  assert.equal(result.envio, null);
  assert.deepEqual(result.promotionLines.map(linea => linea.discountedTotal), [6010]);
});

function lineaEnvio(total, costo = 0) {
  return {
    id: 'envio-test', nombre: 'Producto de prueba', cant: 1,
    lista: total, promo: total, cantMin: 0, porCant: 0, promoCant: 0,
    pct: '', costo
  };
}

test('keeps persisted B2C shipping, including free and historical blank values', () => {
  const bajoUmbral = lineaEnvio(20000, 5000);

  const gratisGuardado = admin.calcularPedido({
    canal: 'b2c', envioModo: 'historico', envio: 0, extras: 0, items: [bajoUmbral]
  });
  const sinEnvioHistorico = admin.calcularPedido({
    canal: 'b2c', envioModo: 'historico', envio: null, extras: 0, items: [bajoUmbral]
  });
  const envioCobradoGuardado = admin.calcularPedido({
    canal: 'b2c', envioModo: 'historico', envio: 1500, extras: 0, items: [lineaEnvio(40000, 5000)]
  });

  assert.equal(gratisGuardado.envio, 0);
  assert.equal(gratisGuardado.ganancia, 15000);
  assert.equal(sinEnvioHistorico.envio, 0);
  assert.equal(sinEnvioHistorico.total, 20000);
  assert.equal(envioCobradoGuardado.envio, 1500);
  assert.equal(envioCobradoGuardado.total, 41500);
});

test('applies B2C shipping only while a draft is automatic, including after a code', () => {
  const bajoUmbral = admin.calcularPedido({
    canal: 'b2c', envioModo: 'automatico', extras: 0, items: [lineaEnvio(34900)]
  });
  const desdeUmbral = admin.calcularPedido({
    canal: 'b2c', envioModo: 'automatico', extras: 0, items: [lineaEnvio(35000)]
  });
  const cuponBajaUmbral = admin.calcularPedido({
    canal: 'b2c', envioModo: 'automatico', codigoPromo: 'MENOS10', porcentajeCodigo: 10,
    extras: 0, items: [lineaEnvio(38000)]
  });
  const fijadoResisteCupon = admin.calcularPedido({
    canal: 'b2c', envioModo: 'fijado', envio: 0, codigoPromo: 'MENOS10', porcentajeCodigo: 10,
    extras: 0, items: [lineaEnvio(38000)]
  });

  assert.equal(bajoUmbral.envio, 1500);
  assert.equal(desdeUmbral.envio, 0);
  assert.equal(cuponBajaUmbral.productosNetos, 34200);
  assert.equal(cuponBajaUmbral.envio, 1500);
  assert.equal(fijadoResisteCupon.envio, 0);
});

test('keeps B2B without shipping and excludes editor-only shipping mode from the payload', () => {
  const b2b = admin.calcularPedido({
    canal: 'b2b', envioModo: 'historico', envio: 1500, extras: 0, items: [lineaEnvio(20000)]
  });
  const guardado = admin.paraGuardar({
    id: 99, canal: 'b2c', envioModo: 'fijado', envio: 1500, extras: 0, items: [lineaEnvio(20000)]
  });
  const restablecido = admin.calcularPedido({
    canal: 'b2c', envioModo: 'automatico', envio: 0, extras: 0, items: [lineaEnvio(20000)]
  });

  assert.equal(b2b.envio, null);
  assert.equal(b2b.total, 20000);
  assert.equal(guardado.envio, 1500);
  assert.equal('envioModo' in guardado, false);
  assert.equal(restablecido.envio, 1500);
});

test('prices an internal B2C order at frozen cost and ignores every commercial adjustment', () => {
  const line = {
    id: 'interno', nombre: 'Producto interno', cant: 3,
    lista: 6000, promo: 5000, cantMin: 2, porCant: 5500, promoCant: 4500,
    pct: '10%', costo: 3200
  };
  const result = admin.calcularPedido({
    canal: 'b2c', pedidoAlCosto: true, envioModo: 'fijado', envio: 1500,
    codigoPromo: 'CODIGO10', porcentajeCodigo: 10, extras: 900, items: [line]
  });
  const saved = admin.paraGuardar({
    canal: 'b2c', pedidoAlCosto: true, envioModo: 'automatico', envio: null,
    codigoPromo: 'CODIGO10', porcentajeCodigo: 10, extras: 900, items: [line]
  });

  assert.equal(result.subtotal, 9600);
  assert.equal(result.descuento, 0);
  assert.equal(result.descuentoCodigo, 0);
  assert.equal(result.envio, 0);
  assert.equal(result.extras, 0);
  assert.equal(result.total, 9600);
  assert.equal(result.costo, 9600);
  assert.equal(result.ganancia, 0);
  assert.equal(saved.codigoPromo, '');
  assert.equal(saved.porcentajeCodigo, 0);
  assert.equal(saved.extras, 0);
  assert.equal(saved.items[0].unit, 3200);
  assert.equal(saved.items[0].ganancia, 0);
});

test('excludes internal orders from every commercial aggregate while keeping them operational', () => {
  const commercial = {
    canal: 'b2c', estado: 'Nuevo', clienteId: 7, extras: 0,
    items: [lineaEnvio(20000, 5000)]
  };
  const internal = {
    canal: 'b2c', pedidoAlCosto: true, estado: 'Para entregar', clienteId: 7,
    extras: 0, items: [lineaEnvio(9000, 4000)]
  };
  const metrics = admin.calcularMetricas([commercial, internal]);
  const clientes = admin.calcularEstadisticasClientes([commercial, internal]);

  assert.deepEqual(metrics, {
    facturado: 21500, ganancia: 16500, pedidosActivos: 1,
    entregados: 0, cancelados: 0, ticket: 21500
  });
  assert.deepEqual(clientes[7], { n: 1, total: 21500 });
  assert.equal(admin.esPedidoAlCosto(internal), true);
  assert.equal(admin.esPedidoAlCosto({ canal: 'b2b', pedidoAlCosto: true }), false);
});
