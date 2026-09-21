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

test('adopts server-returned Item_Id snapshots so a pending order can be saved again without remapping lines', () => {
  const draft = {
    id: 44, canal: 'b2c', estado: 'Nuevo', envioModo: 'fijado', envio: 1500,
    items: [{ id: 'P-1', nombre: 'Producto sintético', cant: 2, unit: 10 }]
  };
  const sent = { ...draft, envioModo: undefined, envio: 1500, items: [...draft.items] };
  const server = {
    ...sent,
    items: [{
      ...sent.items[0], itemId: 'ITEM-44-1', idProveedor: 'PRV-A',
      modalidadAbastecimiento: 'STOCK_PROPIO', gestionaStock: true
    }]
  };

  const adopted = admin.incorporarPedidoGuardado(draft, server, sent);
  assert.equal(adopted.envioModo, 'historico');
  assert.deepEqual(adopted.items, server.items);
  assert.equal(adopted.items[0].itemId, 'ITEM-44-1');
  assert.equal(adopted.items[0].modalidadAbastecimiento, 'STOCK_PROPIO');
});

test('keeps server Item_Id snapshots in edicion and PEDIDOS for the second pending save', () => {
  const draft = {
    id: 45, canal: 'b2c', estado: 'Nuevo', envioModo: 'fijado', envio: 1500,
    items: [{ id: 'P-1', nombre: 'Producto sintético', cant: 2, unit: 10 }]
  };
  const sent = admin.paraGuardar(draft);
  const server = {
    ...sent,
    items: [{
      ...sent.items[0], itemId: 'ITEM-45-1', idProveedor: 'PRV-A',
      modalidadAbastecimiento: 'STOCK_PROPIO', gestionaStock: true
    }]
  };

  const actualizados = admin.actualizarPedidoTrasGuardado([draft], draft, server, sent);
  actualizados.edicion.items[0].cant = 3;
  const segundoEnvio = admin.paraGuardar(actualizados.edicion);
  const snapshotEsperado = {
    itemId: 'ITEM-45-1', idProveedor: 'PRV-A',
    modalidadAbastecimiento: 'STOCK_PROPIO', gestionaStock: true
  };

  assert.deepEqual(
    actualizados.edicion.items.map(({ itemId, idProveedor, modalidadAbastecimiento, gestionaStock }) =>
      ({ itemId, idProveedor, modalidadAbastecimiento, gestionaStock })),
    [snapshotEsperado]
  );
  assert.deepEqual(
    actualizados.pedidos[0].items.map(({ itemId, idProveedor, modalidadAbastecimiento, gestionaStock }) =>
      ({ itemId, idProveedor, modalidadAbastecimiento, gestionaStock })),
    [snapshotEsperado]
  );
  assert.deepEqual(
    segundoEnvio.items.map(({ itemId, idProveedor, modalidadAbastecimiento, gestionaStock }) =>
      ({ itemId, idProveedor, modalidadAbastecimiento, gestionaStock })),
    [snapshotEsperado]
  );
  assert.equal(segundoEnvio.items[0].cant, 3);
});

test('adds a newly saved pending order with distinct server snapshots for repeated SKU lines', () => {
  const draft = {
    canal: 'b2c', estado: 'Nuevo', envioModo: 'automatico', envio: 1500,
    items: [
      { id: 'P-1', nombre: 'Producto sintético', cant: 1, unit: 10 },
      { id: 'P-1', nombre: 'Producto sintético', cant: 2, unit: 10 }
    ]
  };
  const sent = admin.paraGuardar(draft);
  const server = {
    ...sent,
    id: 46,
    items: [
      { ...sent.items[0], itemId: 'ITEM-46-1', idProveedor: 'PRV-A', modalidadAbastecimiento: 'STOCK_PROPIO', gestionaStock: true },
      { ...sent.items[1], itemId: 'ITEM-46-2', idProveedor: 'PRV-B', modalidadAbastecimiento: 'CONSIGNACION', gestionaStock: true }
    ]
  };

  const actualizados = admin.actualizarPedidoTrasGuardado([], draft, server, sent);
  const segundoEnvio = admin.paraGuardar(actualizados.edicion);

  assert.equal(actualizados.pedidos.length, 1);
  assert.equal(actualizados.pedidos[0].id, 46);
  assert.deepEqual(
    segundoEnvio.items.map(({ itemId, idProveedor, modalidadAbastecimiento, gestionaStock }) =>
      ({ itemId, idProveedor, modalidadAbastecimiento, gestionaStock })),
    [
      { itemId: 'ITEM-46-1', idProveedor: 'PRV-A', modalidadAbastecimiento: 'STOCK_PROPIO', gestionaStock: true },
      { itemId: 'ITEM-46-2', idProveedor: 'PRV-B', modalidadAbastecimiento: 'CONSIGNACION', gestionaStock: true }
    ]
  );
});

test('C-04 builds private supplier and classification payloads without mutating identifiers', () => {
  const nuevo = admin.construirProveedorParaGuardar({
    Id_Proveedor: 'PRV-OPERATIVO', Nombre: 'Proveedor operativo',
    Telefono: '', Direccion: '', Notas: '', Activo: true
  });
  assert.deepEqual(nuevo, {
    Id_Proveedor: 'PRV-OPERATIVO', Nombre: 'Proveedor operativo',
    Telefono: '', Direccion: '', Notas: '', Activo: true
  });
  assert.deepEqual(admin.construirProveedorParaGuardar({
    Id_Proveedor: 'PRV-OPERATIVO', Nombre: 'Actualizado', Activo: false
  }, 'PRV-OPERATIVO'), {
    Id_Proveedor_Original: 'PRV-OPERATIVO', Id_Proveedor: 'PRV-OPERATIVO',
    Nombre: 'Actualizado', Telefono: '', Direccion: '', Notas: '', Activo: false
  });
  assert.throws(() => admin.construirProveedorParaGuardar({
    Id_Proveedor: 'OTRO', Nombre: 'Actualizado', Activo: true
  }, 'PRV-OPERATIVO'), /inmutable/);

  const clasificacion = admin.construirClasificacionProducto({
    Id_Producto: 'P-1', Id_Proveedor: 'PRV-OPERATIVO',
    Modalidad_Abastecimiento: 'CONSIGNACION', Sin_Stock: false
  }, [{ Id_Proveedor: 'PRV-OPERATIVO', Activo: true }]);
  assert.deepEqual(clasificacion, {
    Id_Producto: 'P-1', Id_Proveedor: 'PRV-OPERATIVO',
    Modalidad_Abastecimiento: 'CONSIGNACION', Sin_Stock: false
  });
  assert.throws(() => admin.construirClasificacionProducto({
    Id_Producto: 'P-1', Id_Proveedor: 'PRV-OPERATIVO',
    Modalidad_Abastecimiento: 'OTRA', Sin_Stock: false
  }, [{ Id_Proveedor: 'PRV-OPERATIVO', Activo: true }]), /Modalidad/);
  assert.throws(() => admin.construirClasificacionProducto({
    Id_Producto: 'P-1', Id_Proveedor: 'PRV-OPERATIVO',
    Modalidad_Abastecimiento: 'STOCK_PROPIO', Sin_Stock: true
  }, [{ Id_Proveedor: 'PRV-OPERATIVO', Activo: false }]), /activo/);
});

test('C-04 keeps physical balance separate from manual availability and channel context', () => {
  const resumen = admin.resumenInventarioDelCanal([
    { Id_Producto: 'P-1', Saldo: 0, Sin_Stock: false, Gestiona_Stock: true },
    { Id_Producto: 'P-2', Saldo: null, Sin_Stock: false, Gestiona_Stock: false },
    { Id_Producto: 'P-3', Saldo: -2, Sin_Stock: true, Gestiona_Stock: true }
  ], [{ id: 'P-1' }, { id: 'P-2' }]);
  assert.deepEqual(resumen, [
    { Id_Producto: 'P-1', Saldo: 0, Sin_Stock: false, Gestiona_Stock: true },
    { Id_Producto: 'P-2', Saldo: null, Sin_Stock: false, Gestiona_Stock: false }
  ]);
  assert.equal(resumen[0].Sin_Stock, false);
  assert.equal(resumen[1].Saldo, null);
});

test('C-04 freezes a manual movement intent and reserves sales for delivered orders', () => {
  const ingreso = admin.construirMovimientoManual({
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: '3', Costo_Unitario: '4', Nota: 'Ingreso'
  }, 'MANUAL:uno');
  assert.deepEqual(ingreso, {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: 3, Costo_Unitario: 4,
    Referencia: '', Nota: 'Ingreso', Clave_Idempotencia: 'MANUAL:uno'
  });
  assert.equal(admin.construirMovimientoManual({
    Id_Producto: 'P-1', Tipo: 'CONSUMO_PROPIO', Cantidad: '2', Nota: ''
  }, 'MANUAL:dos').Cantidad, -2);
  assert.equal(admin.construirMovimientoManual({
    Id_Producto: 'P-1', Tipo: 'ROTURA_MERMA', Cantidad: '1', Nota: ''
  }, 'MANUAL:tres').Cantidad, -1);
  assert.equal(admin.construirMovimientoManual({
    Id_Producto: 'P-1', Tipo: 'CORRECCION', Cantidad: '-2', Nota: 'Ajuste', Referencia: 'MOV-1'
  }, 'MANUAL:cuatro').Cantidad, -2);
  assert.throws(() => admin.construirMovimientoManual({
    Id_Producto: 'P-1', Tipo: 'VENTA', Cantidad: '1'
  }, 'MANUAL:venta'), /VENTA/);

  const primero = admin.prepararIntentoMovimientoManual(null, {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: '3', Costo_Unitario: '4', Nota: ''
  }, () => 'uno');
  const reintento = admin.prepararIntentoMovimientoManual(primero, {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: '99', Costo_Unitario: '99', Nota: 'Cambiado'
  }, () => 'dos');
  const nuevaIntencion = admin.prepararIntentoMovimientoManual(null, {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: '3', Costo_Unitario: '4', Nota: ''
  }, () => 'tres');
  assert.strictEqual(reintento, primero);
  assert.equal(primero.payload.Clave_Idempotencia, 'MANUAL:uno');
  assert.equal(primero.payload.Cantidad, 3);
  assert.equal(nuevaIntencion.payload.Clave_Idempotencia, 'MANUAL:tres');
  assert.ok(Object.isFrozen(primero.payload));
});

test('C-04 releases a manual intent after an explicit Apps Script rejection', () => {
  const pendiente = admin.prepararIntentoMovimientoManual(null, {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: '3', Costo_Unitario: '4', Nota: ''
  }, () => 'original');
  const rechazo = admin.crearErrorRechazoConcluyente('El saldo no permite el movimiento.');

  assert.equal(rechazo.rechazoConcluyente, true);
  assert.equal(admin.resolverFalloMovimientoPendiente(pendiente, rechazo), null);

  const corregido = admin.prepararIntentoMovimientoManual(
    admin.resolverFalloMovimientoPendiente(pendiente, rechazo),
    { Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: '2', Costo_Unitario: '4', Nota: 'Corregido' },
    () => 'corregido'
  );
  assert.equal(corregido.payload.Clave_Idempotencia, 'MANUAL:corregido');
  assert.equal(corregido.payload.Cantidad, 2);
});

test('C-04 retains the exact manual payload and key after an uncertain failure', () => {
  const pendiente = admin.prepararIntentoMovimientoManual(null, {
    Id_Producto: 'P-1', Tipo: 'INGRESO', Cantidad: '3', Costo_Unitario: '4', Nota: ''
  }, () => 'original');

  const trasTimeout = admin.resolverFalloMovimientoPendiente(
    pendiente, new Error('El Sheets tardó demasiado en responder.')
  );
  const sinRespuesta = admin.resolverFalloMovimientoPendiente(
    pendiente, new Error('El Sheets respondió algo inesperado.')
  );

  assert.strictEqual(trasTimeout, pendiente);
  assert.strictEqual(sinRespuesta, pendiente);
  assert.equal(sinRespuesta.payload.Clave_Idempotencia, 'MANUAL:original');
  assert.equal(sinRespuesta.payload.Cantidad, 3);
});

test('C-04 filters only the history view and retains the full ledger for a correction antecedent', () => {
  const ledgerCompleto = [
    { Movimiento_Id: 'MOV-1', Id_Producto: 'P-1', Tipo: 'INGRESO' },
    { Movimiento_Id: 'MOV-2', Id_Producto: 'P-2', Tipo: 'CONSUMO_PROPIO' }
  ];
  const vistaFiltrada = admin.filtrarMovimientosHistorial(ledgerCompleto, { Id_Producto: 'P-1' });

  assert.deepEqual(vistaFiltrada.map(movimiento => movimiento.Movimiento_Id), ['MOV-1']);
  assert.deepEqual(ledgerCompleto.map(movimiento => movimiento.Movimiento_Id), ['MOV-1', 'MOV-2']);
  assert.deepEqual(
    admin.movimientosAntecedentesCorreccion(ledgerCompleto, 'P-2').map(movimiento => movimiento.Movimiento_Id),
    ['MOV-2']
  );
});

test('C-04 prepares inventory rows and history without client or supplier contact fields', () => {
  const productos = [{ id: 'P-1', n: 'Producto uno' }, { id: 'P-2', n: 'Producto dos' }];
  const resumen = [
    { Id_Producto: 'P-1', Gestiona_Stock: true, Saldo: 0, Sin_Stock: false },
    { Id_Producto: 'P-2', Gestiona_Stock: false, Saldo: null, Sin_Stock: false }
  ];
  assert.deepEqual(admin.productosConStockGestionado(resumen, productos), [{ id: 'P-1', n: 'Producto uno' }]);

  const filas = admin.filasHistorialOperativo([{
    Fecha: '2026-09-20T10:00:00.000Z', Id_Producto: 'P-1', Tipo: 'VENTA', Cantidad: -2,
    Nota: '', Referencia: '', Id_Pedido: 'PEDIDO-1', Item_Id: 'ITEM-1',
    Cliente: 'No debe mostrarse', Telefono: 'No debe mostrarse', Direccion: 'No debe mostrarse',
    Telefono_Proveedor: 'No debe mostrarse', Notas_Proveedor: 'No debe mostrarse'
  }], productos);
  assert.deepEqual(filas, [{
    fecha: '20/09/2026', producto: 'Producto uno', tipo: 'VENTA', cantidad: -2,
    costo: null, referencia: 'Pedido PEDIDO-1 · ítem ITEM-1', nota: ''
  }]);
  assert.equal(JSON.stringify(filas).includes('No debe mostrarse'), false);
});
