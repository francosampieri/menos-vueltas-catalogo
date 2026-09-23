/**
 * MENOS VUELTAS — Almacenamiento de pedidos, items, clientes y contactos.
 *
 * Reemplazá completamente el contenido de Code.gs por este archivo y volvé a
 * publicar el deployment existente. No modifica pedidos históricos: al primer
 * uso agrega solamente el encabezado "Envio" antes de "Extras" si falta.
 */

const HOJA_PEDIDOS = 'Pedidos';
const HOJA_ITEMS = 'Items';
const HOJA_CLIENTES = 'Clientes';
const HOJA_CONTACTOS = 'Contactos';
const HOJA_CODIGOS_PROMO = 'Codigos_Promo';
const HOJA_PROVEEDORES = 'Proveedores';
const HOJA_MOVIMIENTOS_STOCK = 'Movimientos_Stock';
const HOJA_PRODUCTOS = '⬛Productos';
const PROPIEDAD_PLANILLA_CATALOGO = 'CATALOG_SPREADSHEET_ID';

const COLS_PROVEEDOR = ['Id_Proveedor', 'Nombre', 'Telefono', 'Direccion', 'Activo', 'Notas'];
const COLS_MOVIMIENTO = [
  'Movimiento_Id', 'Fecha', 'Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario',
  'Referencia', 'Nota', 'Id_Pedido', 'Item_Id', 'Clave_Idempotencia', 'Modalidad_Abastecimiento'
];
const MODALIDADES_ABASTECIMIENTO = ['CONTRA_PEDIDO', 'CONSIGNACION', 'STOCK_PROPIO'];
const TIPOS_MOVIMIENTO = ['INGRESO', 'VENTA', 'CONSUMO_PROPIO', 'ROTURA_MERMA', 'CORRECCION'];

// Envio queda entre Descuento y Extras. Los accesos a Pedidos se hacen por
// encabezado: el orden soporta libros nuevos, no depende de índices rígidos y
// no borra columnas futuras que puedan existir en la hoja.
const COLS_PEDIDO = [
  'Id', 'Canal', 'Fecha_Pedido', 'Fecha_Entrega', 'Cliente_Id', 'Cliente',
  'Telefono', 'Direccion', 'Barrio', 'Estado', 'Medio_Pago', 'Subtotal',
  'Descuento', 'Codigo_Promo', 'Porcentaje_Codigo', 'Descuento_Codigo', 'Envio',
  'Extras', 'Desc_Extras', 'Total', 'Costo', 'Ganancia',
  'Notas', 'Pedido_Al_Costo', 'Actualizado'
];

const COLS_CLIENTE = [
  'Id', 'Canal', 'Nombre', 'Telefono', 'Direccion', 'Barrio', 'Mapa', 'Notas', 'Actualizado'
];
const COLS_CONTACTO = ['Numero', 'Nombre', 'Fecha', 'Origen'];
const COLS_CODIGO_PROMO = ['Codigo', 'Canal', 'Porcentaje', 'Activo', 'Fecha_Inicio', 'Fecha_Fin'];
const COLS_TEXTO_CLIENTE = [3, 4, 5, 6, 7, 8];

const COLS_ITEM = [
  'Id_Pedido', 'Canal', 'Fecha_Pedido', 'Id_Producto', 'Producto', 'Cantidad',
  'Precio_Lista', 'Precio_Unitario', 'Costo_Unitario', 'Cant_Min', 'Precio_Cantidad',
  'Subtotal', 'Descuento', 'Total', 'Costo', 'Ganancia',
  'Precio_Promo', 'Precio_Promo_Cantidad', 'Porcentaje_Promo',
  'Item_Id', 'Id_Proveedor', 'Modalidad_Abastecimiento', 'Gestiona_Stock'
];

/* ══════════════ ENTRADA ══════════════ */

function doGet(e) {
  try {
    const accion = (e && e.parameter && e.parameter.accion) || 'listar';
    if (accion === 'clientes') return json({ ok: true, clientes: leerClientes() });
    if (accion === 'listarProveedores') return json({ ok: true, proveedores: listarProveedores() });
    if (accion === 'resumenStock') return json({ ok: true, productos: resumenStock() });
    if (accion === 'valorizacionStock') return json({ ok: true, productos: valorizacionStock() });
    if (accion === 'listarMovimientos') return json({ ok: true, movimientos: listarMovimientos(e.parameter) });
    if (accion === 'validarCodigo') {
      const codigo = e && e.parameter ? e.parameter.codigo : '';
      const canal = e && e.parameter ? e.parameter.canal : '';
      const promocion = validarCodigoPromocional(codigo, canal);
      if (!promocion) return json({ ok: false, error: 'Código promocional inválido, inactivo o vencido.' });
      return json({ ok: true, promocion: promocion });
    }
    return json({ ok: true, pedidos: leerPedidos() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let tomado = false;
  try {
    lock.waitLock(25000);
    tomado = true;
    const datos = JSON.parse(e.postData.contents);
    if (datos.accion === 'guardar') return json({ ok: true, pedido: guardarPedidoSinLock(datos.pedido) });
    if (datos.accion === 'eliminar') {
      eliminarPedido(Number(datos.id));
      return json({ ok: true });
    }
    if (datos.accion === 'guardarCliente') return json({ ok: true, cliente: guardarCliente(datos.cliente) });
    if (datos.accion === 'eliminarCliente') {
      eliminarCliente(Number(datos.id));
      return json({ ok: true });
    }
    if (datos.accion === 'guardarContacto') {
      guardarContacto(datos.contacto);
      return json({ ok: true });
    }
    if (datos.accion === 'crearProveedor') return json({ ok: true, proveedor: crearProveedorSinLock(datos.proveedor) });
    if (datos.accion === 'actualizarProveedor') return json({ ok: true, proveedor: actualizarProveedorSinLock(datos.proveedor) });
    if (datos.accion === 'clasificarProducto') return json({ ok: true, clasificacion: clasificarProductoSinLock(datos.clasificacion) });
    if (datos.accion === 'registrarMovimiento') return json({ ok: true, movimiento: registrarMovimientoSinLock(datos.movimiento) });
    return json({ ok: false, error: 'Acción desconocida: ' + datos.accion });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    if (tomado) lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ══════════════ LECTURA ══════════════ */

function leerPedidos() {
  const hp = hoja(HOJA_PEDIDOS, COLS_PEDIDO);
  asegurarEncabezadosPedidos(hp);
  // La configuración de campañas se prepara junto con la operación para que
  // el responsable pueda cargar códigos antes de que alguien los ingrese web.
  hoja(HOJA_CODIGOS_PROMO, COLS_CODIGO_PROMO);
  const hi = hoja(HOJA_ITEMS, COLS_ITEM);
  asegurarEncabezadosItems(hi);

  const filasP = hp.getDataRange().getValues();
  const filasI = hi.getDataRange().getValues();
  if (filasP.length < 2) return [];
  const cp = mapaEncabezados(filasP[0]);
  const ci = mapaEncabezados(filasI[0]);
  const itemsPorPedido = {};

  for (let i = 1; i < filasI.length; i++) {
    const f = filasI[i];
    const idPedido = valorColumna(f, ci, 'Id_Pedido');
    if (!idPedido) continue;
    const id = String(idPedido);
    if (!itemsPorPedido[id]) itemsPorPedido[id] = [];
    const lista = numero(valorColumna(f, ci, 'Precio_Lista'));
    const unit = numero(valorColumna(f, ci, 'Precio_Unitario'));
    const costo = numero(valorColumna(f, ci, 'Costo_Unitario'));
    const cantMin = numero(valorColumna(f, ci, 'Cant_Min'));
    const porCant = numero(valorColumna(f, ci, 'Precio_Cantidad'));
    const cant = numero(valorColumna(f, ci, 'Cantidad')) || 1;
    const alcanzaMin = cantMin > 0 && cant >= cantMin && porCant > 0;
    const promo = numero(valorColumna(f, ci, 'Precio_Promo'));
    const promoCant = numero(valorColumna(f, ci, 'Precio_Promo_Cantidad'));
    itemsPorPedido[id].push({
      id: texto(valorColumna(f, ci, 'Id_Producto')), nombre: texto(valorColumna(f, ci, 'Producto')), cant: cant, lista: lista, costo: costo,
      cantMin: cantMin, porCant: porCant,
      promo: promo || (alcanzaMin ? porCant : (unit || lista)),
      promoCant: promoCant || (alcanzaMin ? unit : 0),
      pct: porcentajePromo(valorColumna(f, ci, 'Porcentaje_Promo')), unit: unit,
      subtotal: numero(valorColumna(f, ci, 'Subtotal')),
      descuento: numero(valorColumna(f, ci, 'Descuento')),
      total: numero(valorColumna(f, ci, 'Total')),
      costoTot: numero(valorColumna(f, ci, 'Costo')),
      ganancia: numero(valorColumna(f, ci, 'Ganancia')),
      itemId: textoSimple(valorColumna(f, ci, 'Item_Id')),
      idProveedor: textoSimple(valorColumna(f, ci, 'Id_Proveedor')),
      modalidadAbastecimiento: textoSimple(valorColumna(f, ci, 'Modalidad_Abastecimiento')),
      gestionaStock: booleano(valorColumna(f, ci, 'Gestiona_Stock'))
    });
  }

  const pedidos = [];
  for (let i = 1; i < filasP.length; i++) {
    const f = filasP[i];
    const id = valorColumna(f, cp, 'Id');
    if (!id) continue;
    const envioRaw = valorColumna(f, cp, 'Envio');
    pedidos.push({
      id: Number(id), canal: texto(valorColumna(f, cp, 'Canal')) || 'b2c',
      fechaPedido: fecha(valorColumna(f, cp, 'Fecha_Pedido')),
      fechaEntrega: fecha(valorColumna(f, cp, 'Fecha_Entrega')),
      clienteId: numeroONull(valorColumna(f, cp, 'Cliente_Id')),
      cliente: texto(valorColumna(f, cp, 'Cliente')),
      telefono: texto(valorColumna(f, cp, 'Telefono')),
      direccion: texto(valorColumna(f, cp, 'Direccion')),
      barrio: texto(valorColumna(f, cp, 'Barrio')),
      estado: texto(valorColumna(f, cp, 'Estado')) || 'Nuevo',
      medioPago: texto(valorColumna(f, cp, 'Medio_Pago')) || 'Efectivo',
      pedidoAlCosto: booleano(valorColumna(f, cp, 'Pedido_Al_Costo')) &&
        (texto(valorColumna(f, cp, 'Canal')) || 'b2c') === 'b2c',
      subtotal: numero(valorColumna(f, cp, 'Subtotal')),
      descuento: numero(valorColumna(f, cp, 'Descuento')),
      codigoPromo: texto(valorColumna(f, cp, 'Codigo_Promo')),
      porcentajeCodigo: numero(valorColumna(f, cp, 'Porcentaje_Codigo')),
      descuentoCodigo: numero(valorColumna(f, cp, 'Descuento_Codigo')),
      // Vacío conserva el significado de pedido histórico sin dato de envío.
      envio: esVacio(envioRaw) ? null : numero(envioRaw),
      extras: numero(valorColumna(f, cp, 'Extras')),
      descExtras: texto(valorColumna(f, cp, 'Desc_Extras')),
      total: numero(valorColumna(f, cp, 'Total')),
      costo: numero(valorColumna(f, cp, 'Costo')),
      ganancia: numero(valorColumna(f, cp, 'Ganancia')),
      notas: texto(valorColumna(f, cp, 'Notas')),
      items: itemsPorPedido[String(id)] || []
    });
  }
  return pedidos;
}

function porcentajePromo(raw) {
  if (esVacio(raw) || raw instanceof Date) return '';
  if (typeof raw === 'number') return (raw < 1 ? Math.round(raw * 100) : Math.round(raw)) + '%';
  const textoPct = String(raw).trim();
  return /^\d+(\.\d+)?$/.test(textoPct) ? textoPct + '%' : textoPct;
}

/* ══════════════ CÓDIGOS PROMOCIONALES ══════════════ */

// Devuelve únicamente la regla del código consultado. Nunca expone el listado
// completo de campañas a la web pública.
function validarCodigoPromocional(codigo, canal) {
  const codigoNormalizado = normalizarCodigo(codigo);
  const canalNormalizado = String(canal || '').trim().toUpperCase();
  if (!codigoNormalizado || canalNormalizado !== 'B2C') return null;

  const h = hoja(HOJA_CODIGOS_PROMO, COLS_CODIGO_PROMO);
  const filas = h.getDataRange().getValues();
  if (filas.length < 2) return null;
  const columnas = mapaEncabezados(filas[0]);
  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    if (normalizarCodigo(valorColumna(fila, columnas, 'Codigo')) !== codigoNormalizado) continue;
    if (String(valorColumna(fila, columnas, 'Canal') || '').trim().toUpperCase() !== canalNormalizado) continue;
    if (!codigoActivo(valorColumna(fila, columnas, 'Activo'))) continue;

    const inicio = fechaIso(valorColumna(fila, columnas, 'Fecha_Inicio'));
    const fin = fechaIso(valorColumna(fila, columnas, 'Fecha_Fin'));
    if ((inicio && hoy < inicio) || (fin && hoy > fin)) continue;

    const porcentaje = porcentajeCodigo(valorColumna(fila, columnas, 'Porcentaje'));
    if (!porcentaje) continue;
    return { codigo: codigoNormalizado, porcentaje: porcentaje };
  }
  return null;
}

function normalizarCodigo(valor) {
  return String(valor || '').trim().toUpperCase();
}

function codigoActivo(valor) {
  const normalizado = String(valor === true ? 'TRUE' : valor || '').trim().toUpperCase();
  return ['ON', 'SI', 'SÍ', 'TRUE', 'ACTIVO', '1'].indexOf(normalizado) >= 0;
}

function porcentajeCodigo(valor) {
  if (esVacio(valor)) return 0;
  let numeroPct;
  if (typeof valor === 'number') {
    numeroPct = valor < 1 ? valor * 100 : valor;
  } else {
    const textoPct = String(valor).trim().replace('%', '').replace(',', '.');
    numeroPct = Number(textoPct);
  }
  return isFinite(numeroPct) && numeroPct > 0 && numeroPct <= 100 ? numeroPct : 0;
}

function fechaIso(valor) {
  if (esVacio(valor)) return '';
  if (valor instanceof Date) return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const textoFecha = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(textoFecha)) return textoFecha;
  const fechaParseada = new Date(textoFecha);
  return isNaN(fechaParseada.getTime())
    ? ''
    : Utilities.formatDate(fechaParseada, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function fecha(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const txt = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
  const d = new Date(txt);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function texto(v) {
  if (esVacio(v)) return '';
  if (v instanceof Date) {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return v.getDate() + ' de ' + meses[v.getMonth()];
  }
  return String(v);
}

/* ══════════════ ESCRITURA ══════════════ */

function guardarPedido(p) {
  return ejecutarConLockEscritura(function () { return guardarPedidoSinLock(p); });
}

function guardarPedidoSinLock(p) {
  p = p || {};
  const hp = hoja(HOJA_PEDIDOS, COLS_PEDIDO);
  asegurarEncabezadosPedidos(hp);
  const hi = hoja(HOJA_ITEMS, COLS_ITEM);
  asegurarEncabezadosItems(hi);
  if (!p.id) p.id = proximoId(hp);

  const fila = buscarFila(hp, p.id);
  const estadoAnterior = fila > 0
    ? textoSimple(valorColumna(hp.getRange(fila, 1, 1, hp.getLastColumn()).getValues()[0], mapaEncabezados(hp.getRange(1, 1, 1, hp.getLastColumn()).getValues()[0]), 'Estado')) || 'Nuevo'
    : 'Nuevo';
  const estadoNuevo = textoSimple(p.estado) || 'Nuevo';
  if (estadoAnterior === 'Entregado') throw new Error('Un pedido Entregado no admite cambios directos.');
  if (fila < 0 && estadoNuevo === 'Entregado') {
    throw new Error('Un pedido debe guardarse pendiente antes de pasar a Entregado.');
  }
  const itemsExistentes = leerItemsExistentes(hi, p.id);
  if (itemsExistentes.hayHistoricos) {
    throw new Error('Los ítems históricos sin snapshot no se pueden re-guardar automáticamente.');
  }
  const itemsParaGuardar = prepararItemsParaGuardar(p, itemsExistentes.porId);
  protegerRecuperacionParcialSinLock(p.id, itemsParaGuardar, itemsExistentes.porId);
  const esTransicionAEntregado = estadoAnterior !== 'Entregado' && estadoNuevo === 'Entregado';
  if (esTransicionAEntregado) aplicarVentasDePedidoSinLock(p.id, itemsParaGuardar);

  const destino = fila > 0 ? fila : hp.getLastRow() + 1;
  const encabezados = hp.getRange(1, 1, 1, hp.getLastColumn()).getValues()[0];
  const columnas = mapaEncabezados(encabezados);
  // Al actualizar se parte de la fila existente: por lo tanto las columnas
  // desconocidas/futuras de Pedidos sobreviven intactas.
  const valores = fila > 0
    ? hp.getRange(destino, 1, 1, encabezados.length).getValues()[0]
    : Array(encabezados.length).fill('');
  const t = p.totales || {};
  const datos = {
    Id: p.id, Canal: p.canal || 'b2c', Fecha_Pedido: p.fechaPedido || '',
    Fecha_Entrega: p.fechaEntrega || '', Cliente_Id: p.clienteId || '',
    Cliente: p.cliente || '', Telefono: p.telefono || '', Direccion: p.direccion || '',
    Barrio: p.barrio || '', Estado: estadoNuevo, Medio_Pago: p.medioPago || 'Efectivo',
    Subtotal: valorTotal(t, 'subtotal'), Descuento: valorTotal(t, 'descuento'),
    Codigo_Promo: p.codigoPromo || '', Porcentaje_Codigo: numero(p.porcentajeCodigo),
    Descuento_Codigo: numero(p.descuentoCodigo),
    Envio: envioParaGuardar(p.envio), Extras: numero(p.extras), Desc_Extras: p.descExtras || '',
    // Se respetan Total y Ganancia calculados/enviados por el panel.
    Total: valorTotal(t, 'total'), Costo: valorTotal(t, 'costo'), Ganancia: valorTotal(t, 'ganancia'),
    Notas: p.notas || '',
    Pedido_Al_Costo: (p.canal || 'b2c') === 'b2c' && booleano(p.pedidoAlCosto),
    Actualizado: new Date()
  };
  Object.keys(datos).forEach(function (nombre) {
    if (columnas[nombre] !== undefined) valores[columnas[nombre]] = datos[nombre];
  });
  hp.getRange(destino, 1, 1, encabezados.length).setValues([valores]);
  forzarTextoPorEncabezado(hp, destino, columnas, ['Fecha_Pedido', 'Fecha_Entrega', 'Cliente', 'Telefono', 'Direccion', 'Barrio', 'Codigo_Promo', 'Desc_Extras', 'Notas']);

  borrarItems(hi, p.id);
  const encabezadosItems = hi.getRange(1, 1, 1, hi.getLastColumn()).getValues()[0];
  const columnasItems = mapaEncabezados(encabezadosItems);
  const filasItems = itemsParaGuardar.map(function (item) {
    return construirFilaItem(p, item, encabezadosItems, columnasItems);
  });
  if (filasItems.length) {
    const inicio = hi.getLastRow() + 1;
    hi.getRange(inicio, 1, filasItems.length, encabezadosItems.length).setValues(filasItems);
    forzarTextoPorEncabezado(hi, inicio, columnasItems, ['Porcentaje_Promo', 'Item_Id', 'Id_Proveedor', 'Modalidad_Abastecimiento']);
  }
  p.estado = estadoNuevo;
  p.items = itemsParaGuardar.map(function (item) { return item.linea; });
  return p;
}

function leerItemsExistentes(hi, idPedido) {
  const filas = hi.getDataRange().getValues();
  const columnas = mapaEncabezados(filas[0]);
  const porId = {};
  let hayHistoricos = false;
  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    if (textoSimple(valorColumna(fila, columnas, 'Id_Pedido')) !== textoSimple(idPedido)) continue;
    const itemId = textoSimple(valorColumna(fila, columnas, 'Item_Id'));
    if (!itemId) {
      hayHistoricos = true;
      continue;
    }
    if (porId[itemId]) throw new Error('Item_Id duplicado en Items.');
    porId[itemId] = {
      fila: fila.slice(),
      Item_Id: itemId,
      Id_Producto: textoSimple(valorColumna(fila, columnas, 'Id_Producto')),
      Cantidad: valorColumna(fila, columnas, 'Cantidad'),
      Id_Proveedor: valorColumna(fila, columnas, 'Id_Proveedor'),
      Modalidad_Abastecimiento: valorColumna(fila, columnas, 'Modalidad_Abastecimiento'),
      Gestiona_Stock: valorColumna(fila, columnas, 'Gestiona_Stock')
    };
  }
  return { porId: porId, hayHistoricos: hayHistoricos };
}

function prepararItemsParaGuardar(p, existentesPorId) {
  const recibidos = {};
  return (p.items || []).map(function (linea) {
    linea = linea || {};
    const itemIdRecibido = textoSimple(linea.itemId || linea.Item_Id);
    let snapshot;
    if (itemIdRecibido && existentesPorId[itemIdRecibido]) {
      if (recibidos[itemIdRecibido]) throw new Error('Item_Id repetido en el pedido.');
      recibidos[itemIdRecibido] = true;
      snapshot = existentesPorId[itemIdRecibido];
    } else {
      snapshot = crearSnapshotDeItem(linea);
    }
    linea.itemId = snapshot.Item_Id;
    linea.idProveedor = textoSimple(snapshot.Id_Proveedor);
    linea.modalidadAbastecimiento = textoSimple(snapshot.Modalidad_Abastecimiento);
    linea.gestionaStock = booleano(snapshot.Gestiona_Stock);
    return { linea: linea, snapshot: snapshot };
  });
}

function crearSnapshotDeItem(linea) {
  const producto = obtenerProductoClasificado(linea.id);
  return {
    Item_Id: 'ITEM-' + Utilities.getUuid(),
    Id_Proveedor: producto.Id_Proveedor,
    Modalidad_Abastecimiento: producto.Modalidad_Abastecimiento,
    Gestiona_Stock: producto.Gestiona_Stock
  };
}

function construirFilaItem(p, item, encabezados, columnas) {
  const valores = item.snapshot.fila ? item.snapshot.fila.slice() : Array(encabezados.length).fill('');
  const l = item.linea;
  const datos = {
    Id_Pedido: p.id, Canal: p.canal || 'b2c', Fecha_Pedido: p.fechaPedido || '',
    Id_Producto: l.id, Producto: l.nombre || '', Cantidad: l.cant,
    Precio_Lista: l.lista || 0, Precio_Unitario: l.unit || 0, Costo_Unitario: l.costo || 0,
    Cant_Min: l.cantMin || 0, Precio_Cantidad: l.porCant || 0, Subtotal: l.subtotal || 0,
    Descuento: l.descuento || 0, Total: l.total || 0, Costo: l.costoTot || 0,
    Ganancia: l.ganancia || 0, Precio_Promo: l.promo || 0,
    Precio_Promo_Cantidad: l.promoCant || 0, Porcentaje_Promo: l.pct || '',
    Item_Id: item.snapshot.Item_Id, Id_Proveedor: item.snapshot.Id_Proveedor,
    Modalidad_Abastecimiento: item.snapshot.Modalidad_Abastecimiento,
    Gestiona_Stock: item.snapshot.Gestiona_Stock
  };
  escribirObjetoEnFila(valores, columnas, datos);
  return valores;
}

function aplicarVentasDePedidoSinLock(idPedido, itemsParaGuardar) {
  itemsParaGuardar.forEach(function (item) {
    if (!booleano(item.snapshot.Gestiona_Stock)) return;
    const cantidad = numeroFinitoEstricto(item.linea.cant, 'Cantidad del ítem');
    if (cantidad <= 0) throw new Error('Cantidad del ítem debe ser positiva para Entregado.');
    registrarVentaInternaSinLock({
      Id_Producto: item.linea.id,
      Cantidad: -cantidad,
      Id_Pedido: idPedido,
      Item_Id: item.snapshot.Item_Id,
      Gestiona_Stock_Snapshot: true
    });
  });
}

function protegerRecuperacionParcialSinLock(idPedido, itemsParaGuardar, existentesPorId) {
  const ventas = ventasAsentadasDePedidoSinLock(idPedido);
  if (!ventas.length) return;

  const existentesIds = Object.keys(existentesPorId);
  const candidatosPorId = {};
  if (itemsParaGuardar.length !== existentesIds.length) {
    throw new Error('La recuperación parcial exige reintentar el mismo pedido pendiente.');
  }
  itemsParaGuardar.forEach(function (item) {
    const itemId = textoSimple(item.snapshot.Item_Id);
    const existente = existentesPorId[itemId];
    if (!itemId || !existente || candidatosPorId[itemId]) {
      throw new Error('La recuperación parcial exige reintentar el mismo pedido pendiente.');
    }
    if (textoSimple(item.linea.id) !== existente.Id_Producto ||
        numeroFinitoEstricto(item.linea.cant, 'Cantidad del ítem') !==
          numeroFinitoEstricto(existente.Cantidad, 'Cantidad existente del ítem')) {
      throw new Error('La recuperación parcial exige reintentar el mismo pedido pendiente.');
    }
    candidatosPorId[itemId] = item;
  });
  existentesIds.forEach(function (itemId) {
    if (!candidatosPorId[itemId]) {
      throw new Error('La recuperación parcial exige reintentar el mismo pedido pendiente.');
    }
  });
  ventas.forEach(function (venta) {
    const existente = existentesPorId[venta.Item_Id];
    if (!existente || venta.Id_Producto !== existente.Id_Producto ||
        venta.Cantidad !== -numeroFinitoEstricto(existente.Cantidad, 'Cantidad existente del ítem')) {
      throw new Error('La recuperación parcial exige reintentar el mismo pedido pendiente.');
    }
  });
}

function ventasAsentadasDePedidoSinLock(idPedido) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_MOVIMIENTOS_STOCK);
  if (!h || h.getLastRow() < 2) return [];
  const filas = h.getDataRange().getValues();
  const columnas = columnasMovimientos(filas[0]);
  const pedido = textoSimple(idPedido);
  return validarFilasMovimientos(filas, columnas, false).lista.filter(function (movimiento) {
    return movimiento.Tipo === 'VENTA' && movimiento.Id_Pedido === pedido &&
      movimiento.Clave_Idempotencia === 'VENTA:' + pedido + ':' + movimiento.Item_Id;
  });
}

function envioParaGuardar(valor) {
  // null, undefined y cadena vacía mantienen vacío el campo histórico.
  return esVacio(valor) ? '' : numero(valor);
}

function valorTotal(t, nombre) {
  return Object.prototype.hasOwnProperty.call(t, nombre) ? numero(t[nombre]) : 0;
}

function eliminarPedido(id) {
  const hp = hoja(HOJA_PEDIDOS, COLS_PEDIDO);
  asegurarEncabezadosPedidos(hp);
  const hi = hoja(HOJA_ITEMS, COLS_ITEM);
  const fila = buscarFila(hp, id);
  if (fila > 0) {
    const encabezados = hp.getRange(1, 1, 1, hp.getLastColumn()).getValues()[0];
    const pedido = hp.getRange(fila, 1, 1, hp.getLastColumn()).getValues()[0];
    if (textoSimple(valorColumna(pedido, mapaEncabezados(encabezados), 'Estado')) === 'Entregado') {
      throw new Error('Un pedido Entregado no se puede eliminar.');
    }
  }
  if (fila > 0) hp.deleteRow(fila);
  borrarItems(hi, id);
}

/* ══════════════ CONTACTOS NOVEDADES ══════════════ */

function guardarContacto(c) {
  const h = hoja(HOJA_CONTACTOS, COLS_CONTACTO);
  const ultima = h.getLastRow();
  if (ultima > 1) {
    const existentes = h.getRange(2, 1, ultima - 1, 1).getValues().flat().map(String);
    if (existentes.includes(String(c.numero))) return;
  }
  h.appendRow([String(c.numero || ''), texto(c.nombre), new Date(c.fecha || new Date()), texto(c.origen) || 'web']);
  h.getRange(h.getLastRow(), 1, 1, 2).setNumberFormat('@');
}

/* ══════════════ CLIENTES ══════════════ */

function leerClientes() {
  const h = hoja(HOJA_CLIENTES, COLS_CLIENTE);
  const filas = h.getDataRange().getValues();
  if (filas.length < 2) return [];
  return filas.slice(1).filter(function (f) { return f[0]; }).map(function (f) {
    return { id: Number(f[0]), canal: texto(f[1]) || 'b2c', nombre: texto(f[2]),
      telefono: texto(f[3]), direccion: texto(f[4]), barrio: texto(f[5]),
      mapa: texto(f[6]), notas: texto(f[7]) };
  });
}

function guardarCliente(c) {
  const h = hoja(HOJA_CLIENTES, COLS_CLIENTE);
  if (!c.id) c.id = proximoId(h);
  const fila = [c.id, c.canal || 'b2c', c.nombre || '', c.telefono || '', c.direccion || '',
    c.barrio || '', c.mapa || '', c.notas || '', new Date()];
  const n = buscarFila(h, c.id);
  const destino = n > 0 ? n : h.getLastRow() + 1;
  forzarTexto(h, destino, COLS_TEXTO_CLIENTE);
  h.getRange(destino, 1, 1, COLS_CLIENTE.length).setValues([fila]);
  return c;
}

function eliminarCliente(id) {
  const h = hoja(HOJA_CLIENTES, COLS_CLIENTE);
  const n = buscarFila(h, id);
  if (n > 0) h.deleteRow(n);
}

/* ══════════════ ABASTECIMIENTO E INVENTARIO (C-02) ══════════════ */

// Estas acciones están orientadas al admin sobre el deployment existente. El
// nivel de protección deliberadamente no cambia en C-02 y no debe confundirse
// con autenticación fuerte ni con una garantía de confidencialidad.
function listarProveedores() {
  const h = hojaExistente(HOJA_PROVEEDORES);
  const filas = h.getDataRange().getValues();
  const columnas = validarEncabezados(filas[0], COLS_PROVEEDOR, HOJA_PROVEEDORES);
  const vistos = {};
  return filas.slice(1).filter(function (fila) {
    return !esVacio(valorColumna(fila, columnas, 'Id_Proveedor'));
  }).map(function (fila) {
    const id = textoSimple(valorColumna(fila, columnas, 'Id_Proveedor'));
    if (vistos[id]) throw new Error('Id_Proveedor duplicado en Proveedores.');
    vistos[id] = true;
    const activoProveedor = normalizarActivoProveedor(valorColumna(fila, columnas, 'Activo'));
    const nombre = textoSimple(valorColumna(fila, columnas, 'Nombre'));
    if (!nombre) throw new Error('Nombre vacío en Proveedores.');
    return {
      Id_Proveedor: id,
      Nombre: nombre,
      Telefono: textoSimple(valorColumna(fila, columnas, 'Telefono')),
      Direccion: textoSimple(valorColumna(fila, columnas, 'Direccion')),
      Activo: activoProveedor,
      Notas: textoSimple(valorColumna(fila, columnas, 'Notas'))
    };
  });
}

function normalizarActivoProveedor(valor) {
  if (typeof valor === 'boolean') return valor;
  const texto = textoSimple(valor).toUpperCase();
  if (texto === 'SI' || texto === 'SÍ' || texto === 'TRUE') return true;
  if (texto === 'NO' || texto === 'FALSE') return false;
  throw new Error('Activo debe ser booleano en Proveedores.');
}

function validarProveedorPayload(proveedor, requiereOriginal) {
  proveedor = proveedor || {};
  const original = textoSimple(proveedor.Id_Proveedor_Original);
  const id = textoSimple(proveedor.Id_Proveedor || original);
  if (requiereOriginal && !original) throw new Error('Id_Proveedor_Original es obligatorio.');
  if (!id) throw new Error('Id_Proveedor es obligatorio.');
  if (requiereOriginal && id !== original) throw new Error('Id_Proveedor es inmutable.');
  const nombre = textoSimple(proveedor.Nombre);
  if (!nombre) throw new Error('Nombre es obligatorio.');
  if (typeof proveedor.Activo !== 'boolean') throw new Error('Activo debe ser booleano.');
  return {
    Id_Proveedor: id, Nombre: nombre,
    Telefono: textoSimple(proveedor.Telefono), Direccion: textoSimple(proveedor.Direccion),
    Activo: proveedor.Activo, Notas: textoSimple(proveedor.Notas)
  };
}

function crearProveedor(proveedor) {
  return ejecutarConLockEscritura(function () { return crearProveedorSinLock(proveedor); });
}

function crearProveedorSinLock(proveedor) {
  const datos = validarProveedorPayload(proveedor, false);
  const h = hojaExistente(HOJA_PROVEEDORES);
  const filas = h.getDataRange().getValues();
  const columnas = validarEncabezados(filas[0], COLS_PROVEEDOR, HOJA_PROVEEDORES);
  validarIdsUnicos(filas, columnas, 'Id_Proveedor', HOJA_PROVEEDORES);
  if (buscarFilaPorTexto(filas, columnas, 'Id_Proveedor', datos.Id_Proveedor) >= 0) {
    throw new Error('Ya existe el Id_Proveedor.');
  }
  const fila = Array(filas[0].length).fill('');
  escribirObjetoEnFila(fila, columnas, datos);
  h.appendRow(fila);
  return datos;
}

function actualizarProveedor(proveedor) {
  return ejecutarConLockEscritura(function () { return actualizarProveedorSinLock(proveedor); });
}

function actualizarProveedorSinLock(proveedor) {
  const datos = validarProveedorPayload(proveedor, true);
  const h = hojaExistente(HOJA_PROVEEDORES);
  const filas = h.getDataRange().getValues();
  const columnas = validarEncabezados(filas[0], COLS_PROVEEDOR, HOJA_PROVEEDORES);
  validarIdsUnicos(filas, columnas, 'Id_Proveedor', HOJA_PROVEEDORES);
  const indice = buscarFilaPorTexto(filas, columnas, 'Id_Proveedor', datos.Id_Proveedor);
  if (indice < 1) throw new Error('No existe el proveedor solicitado.');
  const fila = filas[indice].slice();
  escribirObjetoEnFila(fila, columnas, datos);
  h.getRange(indice + 1, 1, 1, fila.length).setValues([fila]);
  return datos;
}

function clasificarProducto(clasificacion) {
  return ejecutarConLockEscritura(function () { return clasificarProductoSinLock(clasificacion); });
}

function clasificarProductoSinLock(clasificacion) {
  clasificacion = clasificacion || {};
  const idProducto = textoSimple(clasificacion.Id_Producto);
  const idProveedor = textoSimple(clasificacion.Id_Proveedor);
  const modalidad = textoSimple(clasificacion.Modalidad_Abastecimiento).toUpperCase();
  if (!idProducto) throw new Error('Id_Producto es obligatorio.');
  if (!idProveedor) throw new Error('Id_Proveedor es obligatorio.');
  if (MODALIDADES_ABASTECIMIENTO.indexOf(modalidad) < 0) throw new Error('Modalidad_Abastecimiento inválida.');
  if (typeof clasificacion.Sin_Stock !== 'boolean') throw new Error('Sin_Stock debe ser booleano.');
  const proveedor = listarProveedores().filter(function (p) { return p.Id_Proveedor === idProveedor; })[0];
  if (!proveedor || !proveedor.Activo) throw new Error('El proveedor debe existir y estar activo.');

  const h = hojaProductosCatalogo();
  let encabezados = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const previos = mapaEncabezados(encabezados);
  // C-01 debe haber liberado Id_Proveedor preservando el código legacy bajo
  // Codigo_Proveedor. La evidencia archivada acredita el valor anterior; este
  // guard comprueba únicamente el estado materializado antes de escribir.
  if (previos.Codigo_Proveedor === undefined) {
    throw new Error('Precondición C-01 incumplida: falta Codigo_Proveedor.');
  }
  const filasPrevias = h.getDataRange().getValues();
  const indicePrevio = buscarFilaPorTexto(filasPrevias, previos, 'Id', idProducto);
  if (indicePrevio < 1) throw new Error('No existe el producto solicitado.');
  const nuevos = ['Id_Proveedor', 'Modalidad_Abastecimiento', 'Sin_Stock'];
  const faltantes = nuevos.filter(function (nombre) { return previos[nombre] === undefined; });
  if (faltantes.length) {
    const inicio = h.getLastColumn() + 1;
    h.getRange(1, inicio, 1, faltantes.length).setValues([faltantes]);
    h.getRange(1, inicio, 1, faltantes.length).setFontWeight('bold');
    encabezados = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  }
  const columnas = validarEncabezados(encabezados, ['Id', 'Codigo_Proveedor'].concat(nuevos), HOJA_PRODUCTOS);
  const filas = h.getDataRange().getValues();
  const indice = buscarFilaPorTexto(filas, columnas, 'Id', idProducto);
  const fila = filas[indice].slice();
  const datos = { Id_Proveedor: idProveedor, Modalidad_Abastecimiento: modalidad, Sin_Stock: clasificacion.Sin_Stock };
  escribirObjetoEnFila(fila, columnas, datos);
  h.getRange(indice + 1, 1, 1, encabezados.length).setValues([fila]);
  return { Id_Producto: idProducto, Id_Proveedor: idProveedor, Modalidad_Abastecimiento: modalidad, Sin_Stock: clasificacion.Sin_Stock };
}

function registrarMovimiento(movimiento) {
  return ejecutarConLockEscritura(function () { return registrarMovimientoSinLock(movimiento); });
}

function registrarMovimientoSinLock(movimiento) {
  return agregarMovimientoValidado(movimiento, false);
}

function registrarVentaInterna(movimiento) {
  return ejecutarConLockEscritura(function () { return registrarVentaInternaSinLock(movimiento); });
}

function registrarVentaInternaSinLock(movimiento) {
  return agregarMovimientoValidado(movimiento, true, booleano(movimiento && movimiento.Gestiona_Stock_Snapshot));
}

function ejecutarConLockEscritura(escritura) {
  const lock = LockService.getScriptLock();
  let tomado = false;
  try {
    lock.waitLock(25000);
    tomado = true;
    return escritura();
  } finally {
    if (tomado) lock.releaseLock();
  }
}

function agregarMovimientoValidado(movimiento, ventaInterna, gestionaStockSnapshot) {
  movimiento = movimiento || {};
  const producto = obtenerProductoClasificado(movimiento.Id_Producto);
  if (!producto.Gestiona_Stock && !(ventaInterna && gestionaStockSnapshot)) {
    throw new Error('El producto no gestiona stock.');
  }
  const tipo = ventaInterna ? 'VENTA' : textoSimple(movimiento.Tipo).toUpperCase();
  if (!ventaInterna && tipo === 'VENTA') throw new Error('VENTA está reservada al escritor interno.');
  if (TIPOS_MOVIMIENTO.indexOf(tipo) < 0) throw new Error('Tipo de movimiento inválido.');
  const cantidad = numeroFinitoEstricto(movimiento.Cantidad, 'Cantidad');
  if (tipo === 'INGRESO' && cantidad <= 0) throw new Error('INGRESO requiere cantidad positiva.');
  if ((tipo === 'VENTA' || tipo === 'CONSUMO_PROPIO' || tipo === 'ROTURA_MERMA') && cantidad >= 0) {
    throw new Error(tipo + ' requiere cantidad negativa.');
  }
  if (tipo === 'CORRECCION' && cantidad === 0) throw new Error('CORRECCION requiere cantidad distinta de cero.');
  let costo = '';
  let modalidadIngreso = '';
  if (tipo === 'INGRESO') {
    costo = numeroFinitoEstricto(movimiento.Costo_Unitario, 'Costo_Unitario');
    if (costo < 0) throw new Error('Costo_Unitario no puede ser negativo.');
    modalidadIngreso = producto.Modalidad_Abastecimiento;
    const modalidadSolicitada = textoSimple(movimiento.Modalidad_Abastecimiento).toUpperCase();
    if (modalidadSolicitada && modalidadSolicitada !== modalidadIngreso) {
      throw new Error('Modalidad_Abastecimiento no coincide con la clasificación vigente del producto.');
    }
    if (['STOCK_PROPIO', 'CONSIGNACION'].indexOf(modalidadIngreso) < 0) {
      throw new Error('INGRESO requiere un producto actualmente clasificado como STOCK_PROPIO o CONSIGNACION.');
    }
  } else if (!esVacio(movimiento.Costo_Unitario)) {
    throw new Error('Costo_Unitario sólo corresponde a INGRESO.');
  } else if (!esVacio(movimiento.Modalidad_Abastecimiento)) {
    throw new Error('Modalidad_Abastecimiento sólo corresponde a INGRESO.');
  }
  const referencia = textoSimple(movimiento.Referencia);
  const nota = textoSimple(movimiento.Nota);
  if (tipo === 'CORRECCION' && (!nota || !referencia)) throw new Error('CORRECCION requiere Nota y Referencia.');
  const idPedido = textoSimple(movimiento.Id_Pedido);
  const itemId = textoSimple(movimiento.Item_Id);
  let clave = textoSimple(movimiento.Clave_Idempotencia);
  if (ventaInterna) {
    if (!idPedido || !itemId) throw new Error('VENTA requiere Id_Pedido e Item_Id.');
    const esperada = 'VENTA:' + idPedido + ':' + itemId;
    if (clave && clave !== esperada) throw new Error('Clave de idempotencia inválida.');
    clave = esperada;
  } else {
    if (clave.indexOf('VENTA:') === 0) throw new Error('El namespace VENTA: está reservado al escritor interno.');
    if (idPedido || itemId) throw new Error('Id_Pedido e Item_Id están reservados al escritor interno de VENTA.');
  }

  const hExistente = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_MOVIMIENTOS_STOCK);
  let existentes = { lista: [], porId: {}, porClave: {} };
  if (hExistente) {
    const filas = hExistente.getDataRange().getValues();
    const columnas = columnasMovimientos(filas[0]);
    existentes = validarFilasMovimientos(filas, columnas, false);
  }
  if (tipo === 'CORRECCION') {
    const antecedente = existentes.porId[referencia];
    if (!antecedente || antecedente.Id_Producto !== producto.Id_Producto) {
      throw new Error('Referencia de CORRECCION inexistente o de otro producto.');
    }
  }
  if (clave && existentes.porClave[clave]) {
    const anterior = existentes.porClave[clave];
    const candidato = {
      Id_Producto: producto.Id_Producto, Tipo: tipo, Cantidad: cantidad,
      Costo_Unitario: costo, Modalidad_Abastecimiento: modalidadIngreso, Referencia: referencia, Nota: nota,
      Id_Pedido: idPedido, Item_Id: itemId, Clave_Idempotencia: clave
    };
    if (contenidoMovimientoIgual(anterior, candidato)) {
      return anterior;
    }
    throw new Error('Colisión incompatible de idempotencia.');
  }
  const registro = {
    Movimiento_Id: Utilities.getUuid(), Fecha: new Date(), Id_Producto: producto.Id_Producto,
    Tipo: tipo, Cantidad: cantidad, Costo_Unitario: costo, Modalidad_Abastecimiento: modalidadIngreso, Referencia: referencia,
    Nota: nota, Id_Pedido: idPedido, Item_Id: itemId, Clave_Idempotencia: clave
  };
  validarMovimientoNuevoParaValorizacion(registro);
  if (tipo === 'CORRECCION' && cantidad > 0) {
    const antecedente = existentes.porId[referencia];
    if (!antecedente || antecedente.Cantidad >= 0) throw new Error('La corrección positiva debe referir una salida negativa previa.');
    proyectarValorizacionLedger(existentes.lista.concat([registro]));
  }
  const h = hExistente || hojaMovimientos();
  asegurarColumnaMovimiento(h, 'Modalidad_Abastecimiento');
  const encabezados = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const columnas = columnasMovimientos(encabezados);
  const fila = Array(encabezados.length).fill('');
  escribirObjetoEnFila(fila, columnas, registro);
  h.appendRow(fila);
  return registro;
}

function contenidoMovimientoIgual(anterior, candidato) {
  return ['Id_Producto', 'Tipo', 'Cantidad', 'Costo_Unitario', 'Modalidad_Abastecimiento', 'Referencia', 'Nota',
    'Id_Pedido', 'Item_Id', 'Clave_Idempotencia'].every(function (campo) {
    return anterior[campo] === candidato[campo];
  });
}

function resumenStock() {
  const productos = listarProductosClasificados();
  const h = hojaMovimientosExistente();
  const filas = h.getDataRange().getValues();
  const columnas = columnasMovimientos(filas[0]);
  const ledger = validarFilasMovimientos(filas, columnas, true).lista;
  const saldos = {};
  ledger.forEach(function (movimiento) {
    saldos[movimiento.Id_Producto] = (saldos[movimiento.Id_Producto] || 0) + movimiento.Cantidad;
  });
  return productos.map(function (producto) {
    return {
      Id_Producto: producto.Id_Producto,
      Id_Proveedor: producto.Id_Proveedor,
      Modalidad_Abastecimiento: producto.Modalidad_Abastecimiento,
      Gestiona_Stock: producto.Gestiona_Stock,
      Sin_Stock: producto.Sin_Stock,
      Saldo: producto.Gestiona_Stock ? (saldos[producto.Id_Producto] || 0) : null
    };
  });
}

// Lectura privada y pura: las tandas, asignaciones y faltantes existen sólo
// durante esta reconstrucción. El orden de la lista es el orden append-only
// de la hoja, nunca la fecha visible del movimiento.
function valorizacionStock() {
  const productos = listarProductosClasificados();
  const h = hojaMovimientosExistente();
  const filas = h.getDataRange().getValues();
  const ledger = validarFilasMovimientos(filas, columnasMovimientos(filas[0]), true, true).lista;
  const proyeccion = proyectarValorizacionLedger(ledger);
  const porProducto = {};
  productos.forEach(function (producto) { porProducto[producto.Id_Producto] = producto; });
  const ids = {};
  productos.forEach(function (producto) { ids[producto.Id_Producto] = true; });
  Object.keys(proyeccion.productos).forEach(function (id) { ids[id] = true; });
  return Object.keys(ids).map(function (id) {
    const estado = proyeccion.productos[id] || crearEstadoValorizacion(id);
    const producto = porProducto[id] || {};
    return {
      Id_Producto: id,
      Id_Proveedor: producto.Id_Proveedor || '',
      Modalidad_Abastecimiento: producto.Modalidad_Abastecimiento || 'CONTRA_PEDIDO',
      Gestiona_Stock: producto.Gestiona_Stock === true || estado.tandas.some(function (t) { return t.Remanente > 0; }),
      Sin_Stock: producto.Sin_Stock === true,
      Saldo: estado.saldo,
      Capital_Stock_Propio: estado.valores.stockPropio,
      Valor_Consignacion: estado.valores.consignacion,
      Valor_Fisico_Conocido: estado.valores.totalConocido,
      Capital_Total_Completo: estado.estadoCapitalCompleto,
      Tramo_No_Valorizable: estado.tandas.some(function (t) { return !t.Valorizable && t.Remanente > 0; }),
      Faltante_Pendiente_Costo: estado.pendientes.reduce(function (total, pendiente) { return total + pendiente.Cantidad; }, 0),
      Tandas: estado.tandas,
      Asignaciones: estado.asignaciones,
      Coberturas: estado.coberturas,
      Correcciones: estado.correcciones,
      Faltantes: estado.faltantes
    };
  });
}

function crearEstadoValorizacion(idProducto) {
  return { Id_Producto: idProducto, saldo: 0, tandas: [], abiertas: [], pendientes: [], faltantes: [],
    salidas: {}, asignaciones: [], coberturas: [], correcciones: [], valores: { stockPropio: 0, consignacion: 0, totalConocido: 0 }, estadoCapitalCompleto: true };
}

function proyectarValorizacionLedger(ledger) {
  const productos = {};
  const porMovimiento = {};
  (ledger || []).forEach(function (movimiento, orden) {
    const id = textoSimple(movimiento.Id_Producto);
    if (!id) throw new Error('Id_Producto de movimiento obligatorio.');
    const estado = productos[id] || (productos[id] = crearEstadoValorizacion(id));
    const cantidad = numeroFinitoEstricto(movimiento.Cantidad, 'Cantidad');
    const tipo = textoSimple(movimiento.Tipo).toUpperCase();
    if (!textoSimple(movimiento.Movimiento_Id) || porMovimiento[movimiento.Movimiento_Id]) throw new Error('Movimiento_Id vacío o duplicado.');
    if (tipo === 'INGRESO') {
      if (cantidad <= 0) throw new Error('INGRESO malformado.');
      const modalidad = textoSimple(movimiento.Modalidad_Abastecimiento).toUpperCase();
      const faltaCosto = esVacio(movimiento.Costo_Unitario);
      const historicoNoValorizable = !modalidad && faltaCosto;
      if (!historicoNoValorizable && ['STOCK_PROPIO', 'CONSIGNACION'].indexOf(modalidad) < 0) throw new Error('Modalidad_Abastecimiento inválida.');
      const valorizable = !historicoNoValorizable;
      let costo = null;
      if (valorizable) { costo = numeroFinitoEstricto(movimiento.Costo_Unitario, 'Costo_Unitario'); if (costo < 0) throw new Error('Costo_Unitario inválido.'); }
      const tanda = { Movimiento_Id: movimiento.Movimiento_Id, Id_Producto: id, Orden_Ledger: orden, Cantidad_Original: cantidad,
        Remanente: 0, Costo_Unitario: costo, Modalidad_Abastecimiento: modalidad, Valorizable: valorizable, Asignaciones: [], Coberturas: [] };
      estado.tandas.push(tanda);
      let disponible = cantidad;
      while (disponible > 0 && estado.pendientes.length) {
        const pendiente = estado.pendientes[0];
        const usado = Math.min(disponible, pendiente.Cantidad);
        pendiente.Cantidad -= usado;
        const cobertura = { Salida_Movimiento_Id: pendiente.Salida_Movimiento_Id, Tanda_Movimiento_Id: tanda.Movimiento_Id,
          Cantidad: usado, Costo_Unitario: costo, Activa: true, Orden_Ledger: orden, Revertido: 0 };
        estado.coberturas.push(cobertura); tanda.Coberturas.push(cobertura); pendiente.Coberturas.push(cobertura);
        disponible -= usado;
        if (pendiente.Cantidad === 0) estado.pendientes.shift();
      }
      tanda.Remanente = disponible;
      if (disponible > 0) estado.abiertas.push(tanda);
      estado.saldo += cantidad;
    } else if (cantidad < 0) {
      if (['VENTA', 'CONSUMO_PROPIO', 'ROTURA_MERMA', 'CORRECCION'].indexOf(tipo) < 0) throw new Error('Salida de stock malformada.');
      const salida = { Movimiento_Id: movimiento.Movimiento_Id, Id_Producto: id, Cantidad_Original: -cantidad, Pendiente_Original: 0,
        Asignaciones: [], Coberturas: [], Revertido: 0, Orden_Ledger: orden, Tipo: tipo };
      let requerido = -cantidad;
      while (requerido > 0 && estado.abiertas.length) {
        const tanda = estado.abiertas[0]; const usado = Math.min(requerido, tanda.Remanente);
        const asignacion = { Salida_Movimiento_Id: salida.Movimiento_Id, Tanda_Movimiento_Id: tanda.Movimiento_Id,
          Cantidad: usado, Costo_Unitario: tanda.Costo_Unitario, Valorizable: tanda.Valorizable, Orden_Ledger: orden, Revertido: 0 };
        tanda.Remanente -= usado; tanda.Asignaciones.push(asignacion); salida.Asignaciones.push(asignacion); estado.asignaciones.push(asignacion);
        requerido -= usado;
        if (tanda.Remanente === 0) estado.abiertas.shift();
      }
      if (requerido > 0) {
        const pendiente = { Salida_Movimiento_Id: salida.Movimiento_Id, Cantidad: requerido, Cantidad_Original: requerido, Orden_Ledger: orden, Coberturas: [] };
        estado.pendientes.push(pendiente); estado.faltantes.push(pendiente); salida.Pendiente_Original = requerido;
      }
      estado.salidas[salida.Movimiento_Id] = salida; estado.saldo += cantidad;
    } else if (tipo === 'CORRECCION') {
      const antecedente = porMovimiento[movimiento.Referencia];
      if (!antecedente || antecedente.Id_Producto !== id || antecedente.Cantidad >= 0 || !estado.salidas[movimiento.Referencia]) throw new Error('Referencia de corrección positiva inválida.');
      const salida = estado.salidas[movimiento.Referencia];
      const maximo = salida.Cantidad_Original - salida.Revertido;
      if (cantidad > maximo) throw new Error('Cantidad de corrección excede el saldo reversible.');
      let restante = cantidad;
      // Primero el faltante aún abierto, luego coberturas de faltantes y por último las capas FIFO originales.
      estado.pendientes.forEach(function (pendiente) {
        if (restante <= 0 || pendiente.Salida_Movimiento_Id !== salida.Movimiento_Id) return;
        const usado = Math.min(restante, pendiente.Cantidad); pendiente.Cantidad -= usado; restante -= usado;
      });
      estado.pendientes = estado.pendientes.filter(function (pendiente) { return pendiente.Cantidad > 0; });
      salida.Coberturas.concat(estado.coberturas.filter(function (c) { return c.Salida_Movimiento_Id === salida.Movimiento_Id; })).forEach(function (cobertura) {
        if (restante <= 0 || !cobertura.Activa) return;
        const disponible = cobertura.Cantidad - cobertura.Revertido; const usado = Math.min(restante, disponible);
        if (!usado) return; cobertura.Revertido += usado; if (cobertura.Revertido === cobertura.Cantidad) cobertura.Activa = false;
        reabrirTanda(estado, cobertura.Tanda_Movimiento_Id, usado); restante -= usado;
      });
      salida.Asignaciones.forEach(function (asignacion) {
        if (restante <= 0) return;
        const disponible = asignacion.Cantidad - asignacion.Revertido; const usado = Math.min(restante, disponible);
        if (!usado) return; asignacion.Revertido += usado; reabrirTanda(estado, asignacion.Tanda_Movimiento_Id, usado); restante -= usado;
      });
      if (restante !== 0) throw new Error('No se pudo reconstruir la corrección de forma íntegra.');
      salida.Revertido += cantidad; estado.correcciones.push({ Movimiento_Id: movimiento.Movimiento_Id, Referencia: movimiento.Referencia, Cantidad: cantidad, Orden_Ledger: orden }); estado.saldo += cantidad;
    } else { throw new Error('Movimiento de stock inválido.'); }
    porMovimiento[movimiento.Movimiento_Id] = movimiento;
  });
  Object.keys(productos).forEach(function (id) {
    const estado = productos[id];
    estado.tandas.forEach(function (tanda) {
      if (!tanda.Valorizable && tanda.Remanente > 0) estado.estadoCapitalCompleto = false;
      if (tanda.Valorizable && tanda.Remanente > 0) {
        const valor = tanda.Remanente * tanda.Costo_Unitario;
        if (tanda.Modalidad_Abastecimiento === 'STOCK_PROPIO') estado.valores.stockPropio += valor;
        if (tanda.Modalidad_Abastecimiento === 'CONSIGNACION') estado.valores.consignacion += valor;
      }
    });
    estado.valores.totalConocido = estado.valores.stockPropio + estado.valores.consignacion;
  });
  return { productos: productos };
}

function reabrirTanda(estado, movimientoId, cantidad) {
  const tanda = estado.tandas.filter(function (item) { return item.Movimiento_Id === movimientoId; })[0];
  if (!tanda) throw new Error('Tanda de origen inexistente.');
  tanda.Remanente += cantidad;
  if (estado.abiertas.indexOf(tanda) < 0) estado.abiertas.push(tanda);
  estado.abiertas.sort(function (a, b) { return a.Orden_Ledger - b.Orden_Ledger; });
}

// Esta lectura no inicializa el libro ni resuelve referencias contra pedidos,
// clientes, contactos, proveedores o Finanzas. El historial de inventario
// conserva sólo la evidencia operativa inmutable que ya vive en el ledger.
function listarMovimientos(filtros) {
  filtros = filtros || {};
  const idProducto = textoSimple(filtros.Id_Producto);
  const tipo = textoSimple(filtros.Tipo).toUpperCase();
  if (tipo && TIPOS_MOVIMIENTO.indexOf(tipo) < 0) throw new Error('Tipo de movimiento inválido.');

  const h = hojaMovimientosExistente();
  const filas = h.getDataRange().getValues();
  const columnas = columnasMovimientos(filas[0]);
  return validarFilasMovimientos(filas, columnas, false).lista
    .filter(function (movimiento) {
      return (!idProducto || movimiento.Id_Producto === idProducto) && (!tipo || movimiento.Tipo === tipo);
    })
    .sort(function (a, b) { return new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime(); })
    .map(proyectarMovimientoHistorial);
}

function proyectarMovimientoHistorial(movimiento) {
  const resultado = {
    Movimiento_Id: movimiento.Movimiento_Id,
    Fecha: movimiento.Fecha,
    Id_Producto: movimiento.Id_Producto,
    Tipo: movimiento.Tipo,
    Cantidad: movimiento.Cantidad,
    Nota: movimiento.Nota,
    Referencia: movimiento.Referencia
  };
  if (movimiento.Tipo === 'INGRESO') resultado.Costo_Unitario = movimiento.Costo_Unitario;
  if (movimiento.Id_Pedido) resultado.Id_Pedido = movimiento.Id_Pedido;
  if (movimiento.Item_Id) resultado.Item_Id = movimiento.Item_Id;
  return resultado;
}

function validarFilasMovimientos(filas, columnas, validarProductos, permitirHistoricoReclasificado) {
  const lista = [];
  const porId = {};
  const porClave = {};
  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    if (fila.every(esVacio)) continue;
    const movimiento = {};
    COLS_MOVIMIENTO.forEach(function (nombre) { movimiento[nombre] = columnas[nombre] === undefined ? '' : valorColumna(fila, columnas, nombre); });
    movimiento.Movimiento_Id = textoSimple(movimiento.Movimiento_Id);
    movimiento.Id_Producto = textoSimple(movimiento.Id_Producto);
    movimiento.Tipo = textoSimple(movimiento.Tipo).toUpperCase();
    movimiento.Cantidad = numeroFinitoEstricto(movimiento.Cantidad, 'Cantidad');
    movimiento.Referencia = textoSimple(movimiento.Referencia);
    movimiento.Nota = textoSimple(movimiento.Nota);
    movimiento.Id_Pedido = textoSimple(movimiento.Id_Pedido);
    movimiento.Item_Id = textoSimple(movimiento.Item_Id);
    movimiento.Clave_Idempotencia = textoSimple(movimiento.Clave_Idempotencia);
    movimiento.Modalidad_Abastecimiento = textoSimple(movimiento.Modalidad_Abastecimiento).toUpperCase();
    if (!movimiento.Movimiento_Id || porId[movimiento.Movimiento_Id]) throw new Error('Movimiento_Id vacío o duplicado.');
    if (esVacio(movimiento.Fecha)) throw new Error('Fecha de movimiento obligatoria.');
    if (!movimiento.Id_Producto) throw new Error('Id_Producto de movimiento obligatorio.');
    if (TIPOS_MOVIMIENTO.indexOf(movimiento.Tipo) < 0) throw new Error('Tipo de movimiento inválido.');
    if (movimiento.Tipo === 'INGRESO') {
      if (movimiento.Cantidad <= 0) throw new Error('INGRESO malformado.');
      const historicoNoValorizable = !movimiento.Modalidad_Abastecimiento && esVacio(movimiento.Costo_Unitario);
      if (!historicoNoValorizable) {
        if (['STOCK_PROPIO', 'CONSIGNACION'].indexOf(movimiento.Modalidad_Abastecimiento) < 0) throw new Error('Modalidad_Abastecimiento inválida.');
        const costo = numeroFinitoEstricto(movimiento.Costo_Unitario, 'Costo_Unitario');
        if (costo < 0) throw new Error('Costo_Unitario inválido.');
        movimiento.Costo_Unitario = costo;
      } else {
        movimiento.Costo_Unitario = '';
      }
    } else if (movimiento.Tipo === 'CORRECCION') {
      if (!movimiento.Cantidad || !movimiento.Nota || !movimiento.Referencia ||
          !porId[movimiento.Referencia] || porId[movimiento.Referencia].Id_Producto !== movimiento.Id_Producto) {
        throw new Error('CORRECCION malformada o con antecedente inválido.');
      }
    } else if (movimiento.Cantidad >= 0) {
      throw new Error('Salida de stock malformada.');
    }
    if (movimiento.Tipo === 'VENTA') {
      const esperada = 'VENTA:' + movimiento.Id_Pedido + ':' + movimiento.Item_Id;
      if (!movimiento.Id_Pedido || !movimiento.Item_Id || movimiento.Clave_Idempotencia !== esperada) {
        throw new Error('VENTA con idempotencia inválida.');
      }
    }
    if (movimiento.Clave_Idempotencia) {
      if (porClave[movimiento.Clave_Idempotencia]) throw new Error('Clave_Idempotencia duplicada.');
      porClave[movimiento.Clave_Idempotencia] = movimiento;
    }
    // Una VENTA ya asentada puede corresponder a un snapshot histórico de
    // C-03 aunque el catálogo se haya reclasificado después. Las demás
    // salidas conservan la validación de clasificación vigente de C-02.
    if (validarProductos) {
      const producto = obtenerProductoClasificado(movimiento.Id_Producto);
      if (!permitirHistoricoReclasificado && movimiento.Tipo !== 'VENTA' && !producto.Gestiona_Stock) {
        throw new Error('Movimiento para producto sin stock gestionado.');
      }
    }
    porId[movimiento.Movimiento_Id] = movimiento;
    lista.push(movimiento);
  }
  return { lista: lista, porId: porId, porClave: porClave };
}

function listarProductosClasificados() {
  const h = hojaProductosCatalogo();
  const filas = h.getDataRange().getValues();
  const columnas = validarEncabezados(filas[0], ['Id', 'Codigo_Proveedor'], HOJA_PRODUCTOS);
  return filas.slice(1).filter(function (fila) {
    return !esVacio(valorColumna(fila, columnas, 'Id'));
  }).map(function (fila) {
    const modalidadRaw = textoSimple(valorColumna(fila, columnas, 'Modalidad_Abastecimiento')).toUpperCase();
    const modalidad = modalidadRaw || 'CONTRA_PEDIDO';
    if (MODALIDADES_ABASTECIMIENTO.indexOf(modalidad) < 0) throw new Error('Modalidad_Abastecimiento inválida en Productos.');
    const sinStockRaw = valorColumna(fila, columnas, 'Sin_Stock');
    if (!esVacio(sinStockRaw) && typeof sinStockRaw !== 'boolean') throw new Error('Sin_Stock inválido en Productos.');
    return {
      Id_Producto: textoSimple(valorColumna(fila, columnas, 'Id')),
      Id_Proveedor: textoSimple(valorColumna(fila, columnas, 'Id_Proveedor')),
      Modalidad_Abastecimiento: modalidad,
      Gestiona_Stock: modalidad === 'CONSIGNACION' || modalidad === 'STOCK_PROPIO',
      Sin_Stock: esVacio(sinStockRaw) ? false : sinStockRaw
    };
  });
}

function obtenerProductoClasificado(idProducto) {
  const id = textoSimple(idProducto);
  const producto = listarProductosClasificados().filter(function (p) { return p.Id_Producto === id; })[0];
  if (!producto) throw new Error('No existe el producto solicitado.');
  return producto;
}

function hojaProductosCatalogo() {
  const id = PropertiesService.getScriptProperties().getProperty(PROPIEDAD_PLANILLA_CATALOGO);
  if (!id) throw new Error('Falta configurar la planilla de catálogo.');
  const h = SpreadsheetApp.openById(id).getSheetByName(HOJA_PRODUCTOS);
  if (!h) throw new Error('No existe la hoja ' + HOJA_PRODUCTOS + ' en la planilla de catálogo.');
  return h;
}

function hojaMovimientos() {
  return hoja(HOJA_MOVIMIENTOS_STOCK, COLS_MOVIMIENTO);
}

function columnasMovimientos(encabezados) {
  // La nueva columna se busca por nombre. Su ausencia sólo identifica filas
  // históricas: nunca se reordena ni se completa el libro al leerlo.
  return validarEncabezados(encabezados, COLS_MOVIMIENTO.filter(function (nombre) {
    return nombre !== 'Modalidad_Abastecimiento';
  }), HOJA_MOVIMIENTOS_STOCK);
}

function asegurarColumnaMovimiento(h, nombre) {
  const encabezados = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  if (mapaEncabezados(encabezados)[nombre] !== undefined) return;
  const columna = h.getLastColumn() + 1;
  h.getRange(1, columna, 1, 1).setValues([[nombre]]);
  h.getRange(1, columna, 1, 1).setFontWeight('bold');
}

function validarMovimientoNuevoParaValorizacion(movimiento) {
  if (textoSimple(movimiento && movimiento.Tipo).toUpperCase() !== 'INGRESO') return;
  const modalidad = textoSimple(movimiento.Modalidad_Abastecimiento).toUpperCase();
  if (['STOCK_PROPIO', 'CONSIGNACION'].indexOf(modalidad) < 0) throw new Error('Modalidad_Abastecimiento de INGRESO inválida.');
  const costo = numeroFinitoEstricto(movimiento.Costo_Unitario, 'Costo_Unitario');
  if (costo < 0) throw new Error('Costo_Unitario inválido.');
}

function hojaMovimientosExistente() {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_MOVIMIENTOS_STOCK);
  if (!h) throw new Error('No existe la hoja requerida: ' + HOJA_MOVIMIENTOS_STOCK + '.');
  return h;
}

function hojaExistente(nombre) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h) throw new Error('No existe la hoja requerida: ' + nombre);
  return h;
}

function validarEncabezados(encabezados, requeridos, nombreHoja) {
  const columnas = mapaEncabezados(encabezados || []);
  requeridos.forEach(function (nombre) {
    if (columnas[nombre] === undefined) throw new Error('Falta el encabezado ' + nombre + ' en ' + nombreHoja + '.');
  });
  return columnas;
}

function validarIdsUnicos(filas, columnas, campo, nombreHoja) {
  const vistos = {};
  filas.slice(1).forEach(function (fila) {
    const id = textoSimple(valorColumna(fila, columnas, campo));
    if (!id) return;
    if (vistos[id]) throw new Error(campo + ' duplicado en ' + nombreHoja + '.');
    vistos[id] = true;
  });
}

function buscarFilaPorTexto(filas, columnas, campo, valor) {
  for (let i = 1; i < filas.length; i++) {
    if (textoSimple(valorColumna(filas[i], columnas, campo)) === textoSimple(valor)) return i;
  }
  return -1;
}

function escribirObjetoEnFila(fila, columnas, objeto) {
  Object.keys(objeto).forEach(function (nombre) {
    if (columnas[nombre] !== undefined) fila[columnas[nombre]] = objeto[nombre];
  });
}

function textoSimple(valor) {
  return esVacio(valor) ? '' : String(valor).trim();
}

function numeroFinitoEstricto(valor, campo) {
  if (esVacio(valor) || typeof valor === 'boolean') throw new Error(campo + ' debe ser numérico.');
  const n = Number(valor);
  if (!isFinite(n)) throw new Error(campo + ' debe ser finito.');
  return n;
}

/* ══════════════ AYUDANTES DE HOJAS ══════════════ */

function hoja(nombre, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(nombre);
  if (!h) h = ss.insertSheet(nombre);
  if (!h.getRange(1, 1).getValue()) {
    h.getRange(1, 1, 1, cols.length).setValues([cols]);
    h.getRange(1, 1, 1, cols.length).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

function asegurarEncabezadosPedidos(h) {
  let encabezados = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  let columnas = mapaEncabezados(encabezados);

  if (columnas.Envio === undefined) {
    // En libros existentes insertamos Envio antes de Extras; no se llena
    // ninguna celda histórica ni se altera el resto de los valores.
    if (columnas.Extras !== undefined) {
      const columnaExtras = columnas.Extras + 1;
      h.insertColumnBefore(columnaExtras);
      h.getRange(1, columnaExtras).setValue('Envio').setFontWeight('bold');
    } else {
      const nueva = h.getLastColumn() + 1;
      h.getRange(1, nueva).setValue('Envio').setFontWeight('bold');
    }
    encabezados = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
    columnas = mapaEncabezados(encabezados);
  }

  const camposCodigo = ['Codigo_Promo', 'Porcentaje_Codigo', 'Descuento_Codigo'];
  const faltantes = camposCodigo.filter(function (nombre) { return columnas[nombre] === undefined; });
  if (faltantes.length) {
    // Los campos de promoción quedan antes de Envio. Las filas existentes se
    // desplazan completas y mantienen sus totales históricos sin backfill.
    const destino = columnas.Envio === undefined ? h.getLastColumn() + 1 : columnas.Envio + 1;
    h.insertColumnsBefore(destino, faltantes.length);
    h.getRange(1, destino, 1, faltantes.length).setValues([faltantes]);
    h.getRange(1, destino, 1, faltantes.length).setFontWeight('bold');
    encabezados = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
    columnas = mapaEncabezados(encabezados);
  }

  if (columnas.Pedido_Al_Costo === undefined) {
    const columnaActualizado = columnas.Actualizado === undefined ? h.getLastColumn() + 1 : columnas.Actualizado + 1;
    h.insertColumnBefore(columnaActualizado);
    h.getRange(1, columnaActualizado).setValue('Pedido_Al_Costo').setFontWeight('bold');
  }
}

function asegurarEncabezadosItems(h) {
  const encabezados = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const existentes = mapaEncabezados(encabezados);
  const faltantes = COLS_ITEM.filter(function (nombre) { return existentes[nombre] === undefined; });
  if (!faltantes.length) return;
  const inicio = h.getLastColumn() + 1;
  h.getRange(1, inicio, 1, faltantes.length).setValues([faltantes]);
  h.getRange(1, inicio, 1, faltantes.length).setFontWeight('bold');
}

function mapaEncabezados(encabezados) {
  const mapa = {};
  encabezados.forEach(function (nombre, indice) {
    const clave = String(nombre || '').trim();
    if (clave && mapa[clave] === undefined) mapa[clave] = indice;
  });
  return mapa;
}

function valorColumna(fila, columnas, nombre) {
  return columnas[nombre] === undefined ? '' : fila[columnas[nombre]];
}

function proximoId(h) {
  const ultima = h.getLastRow();
  if (ultima < 2) return 1;
  const col = indiceColumna(h, 'Id');
  const ids = h.getRange(2, col, ultima - 1, 1).getValues().map(function (f) { return numero(f[0]); });
  return Math.max(0, ...ids) + 1;
}

function buscarFila(h, id) {
  const ultima = h.getLastRow();
  if (ultima < 2) return -1;
  const col = indiceColumna(h, 'Id');
  const ids = h.getRange(2, col, ultima - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (Number(ids[i][0]) === Number(id)) return i + 2;
  return -1;
}

function indiceColumna(h, nombre) {
  const mapa = mapaEncabezados(h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0]);
  if (mapa[nombre] === undefined) throw new Error('Falta el encabezado requerido: ' + nombre);
  return mapa[nombre] + 1;
}

function borrarItems(hi, idPedido) {
  const ultima = hi.getLastRow();
  if (ultima < 2) return;
  const columnaIdPedido = indiceColumna(hi, 'Id_Pedido');
  const ids = hi.getRange(2, columnaIdPedido, ultima - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (Number(ids[i][0]) === Number(idPedido)) hi.deleteRow(i + 2);
}

function forzarTexto(h, fila, cantFilas, columnas) {
  if (!columnas) { columnas = cantFilas; cantFilas = 1; }
  columnas.forEach(function (col) { h.getRange(fila, col, cantFilas, 1).setNumberFormat('@'); });
}

function forzarTextoPorEncabezado(h, fila, columnas, nombres) {
  nombres.forEach(function (nombre) {
    if (columnas[nombre] !== undefined) h.getRange(fila, columnas[nombre] + 1).setNumberFormat('@');
  });
}

function esVacio(valor) { return valor === null || valor === undefined || valor === ''; }
function booleano(valor) { return valor === true || String(valor || '').trim().toUpperCase() === 'TRUE'; }
function numero(valor) { return Number(valor) || 0; }
function numeroONull(valor) { return esVacio(valor) ? null : numero(valor); }
