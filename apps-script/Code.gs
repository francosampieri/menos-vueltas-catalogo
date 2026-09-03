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

// Envio queda entre Descuento y Extras. Los accesos a Pedidos se hacen por
// encabezado: el orden soporta libros nuevos, no depende de índices rígidos y
// no borra columnas futuras que puedan existir en la hoja.
const COLS_PEDIDO = [
  'Id', 'Canal', 'Fecha_Pedido', 'Fecha_Entrega', 'Cliente_Id', 'Cliente',
  'Telefono', 'Direccion', 'Barrio', 'Estado', 'Medio_Pago', 'Subtotal',
  'Descuento', 'Envio', 'Extras', 'Desc_Extras', 'Total', 'Costo', 'Ganancia',
  'Notas', 'Actualizado'
];

const COLS_CLIENTE = [
  'Id', 'Canal', 'Nombre', 'Telefono', 'Direccion', 'Barrio', 'Mapa', 'Notas', 'Actualizado'
];
const COLS_CONTACTO = ['Numero', 'Nombre', 'Fecha', 'Origen'];
const COLS_TEXTO_CLIENTE = [3, 4, 5, 6, 7, 8];

const COLS_ITEM = [
  'Id_Pedido', 'Canal', 'Fecha_Pedido', 'Id_Producto', 'Producto', 'Cantidad',
  'Precio_Lista', 'Precio_Unitario', 'Costo_Unitario', 'Cant_Min', 'Precio_Cantidad',
  'Subtotal', 'Descuento', 'Total', 'Costo', 'Ganancia',
  'Precio_Promo', 'Precio_Promo_Cantidad', 'Porcentaje_Promo'
];

/* ══════════════ ENTRADA ══════════════ */

function doGet(e) {
  try {
    const accion = (e && e.parameter && e.parameter.accion) || 'listar';
    if (accion === 'clientes') return json({ ok: true, clientes: leerClientes() });
    return json({ ok: true, pedidos: leerPedidos() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let tomado = false;
  try {
    lock.waitLock(25000);el app
    tomado = true;
    const datos = JSON.parse(e.postData.contents);
    if (datos.accion === 'guardar') return json({ ok: true, pedido: guardarPedido(datos.pedido) });
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
  const hi = hoja(HOJA_ITEMS, COLS_ITEM);
  asegurarEncabezadosItems(hi);

  const filasP = hp.getDataRange().getValues();
  const filasI = hi.getDataRange().getValues();
  if (filasP.length < 2) return [];
  const cp = mapaEncabezados(filasP[0]);
  const itemsPorPedido = {};

  for (let i = 1; i < filasI.length; i++) {
    const f = filasI[i];
    if (!f[0]) continue;
    const id = String(f[0]);
    if (!itemsPorPedido[id]) itemsPorPedido[id] = [];
    const lista = Number(f[6]) || 0;
    const unit = Number(f[7]) || 0;
    const costo = Number(f[8]) || 0;
    const cantMin = Number(f[9]) || 0;
    const porCant = Number(f[10]) || 0;
    const cant = Number(f[5]) || 1;
    const alcanzaMin = cantMin > 0 && cant >= cantMin && porCant > 0;
    const promo = Number(f[16]) || 0;
    const promoCant = Number(f[17]) || 0;
    itemsPorPedido[id].push({
      id: String(f[3]), nombre: texto(f[4]), cant: cant, lista: lista, costo: costo,
      cantMin: cantMin, porCant: porCant,
      promo: promo || (alcanzaMin ? porCant : (unit || lista)),
      promoCant: promoCant || (alcanzaMin ? unit : 0),
      pct: porcentajePromo(f[18]), unit: unit, subtotal: Number(f[11]) || 0,
      descuento: Number(f[12]) || 0, total: Number(f[13]) || 0,
      costoTot: Number(f[14]) || 0, ganancia: Number(f[15]) || 0
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
      subtotal: numero(valorColumna(f, cp, 'Subtotal')),
      descuento: numero(valorColumna(f, cp, 'Descuento')),
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
  const hp = hoja(HOJA_PEDIDOS, COLS_PEDIDO);
  asegurarEncabezadosPedidos(hp);
  const hi = hoja(HOJA_ITEMS, COLS_ITEM);
  asegurarEncabezadosItems(hi);
  if (!p.id) p.id = proximoId(hp);

  const fila = buscarFila(hp, p.id);
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
    Barrio: p.barrio || '', Estado: p.estado || 'Nuevo', Medio_Pago: p.medioPago || 'Efectivo',
    Subtotal: valorTotal(t, 'subtotal'), Descuento: valorTotal(t, 'descuento'),
    Envio: envioParaGuardar(p.envio), Extras: numero(p.extras), Desc_Extras: p.descExtras || '',
    // Se respetan Total y Ganancia calculados/enviados por el panel.
    Total: valorTotal(t, 'total'), Costo: valorTotal(t, 'costo'), Ganancia: valorTotal(t, 'ganancia'),
    Notas: p.notas || '', Actualizado: new Date()
  };
  Object.keys(datos).forEach(function (nombre) {
    if (columnas[nombre] !== undefined) valores[columnas[nombre]] = datos[nombre];
  });
  hp.getRange(destino, 1, 1, encabezados.length).setValues([valores]);
  forzarTextoPorEncabezado(hp, destino, columnas, ['Fecha_Pedido', 'Fecha_Entrega', 'Cliente', 'Telefono', 'Direccion', 'Barrio', 'Desc_Extras', 'Notas']);

  borrarItems(hi, p.id);
  const filasItems = (p.items || []).map(function (l) {
    return [p.id, p.canal || 'b2c', p.fechaPedido || '', l.id, l.nombre || '', l.cant,
      l.lista || 0, l.unit || 0, l.costo || 0, l.cantMin || 0, l.porCant || 0,
      l.subtotal || 0, l.descuento || 0, l.total || 0, l.costoTot || 0, l.ganancia || 0,
      l.promo || 0, l.promoCant || 0, l.pct || ''];
  });
  if (filasItems.length) {
    const inicio = hi.getLastRow() + 1;
    hi.getRange(inicio, 1, filasItems.length, COLS_ITEM.length).setValues(filasItems);
    forzarTexto(hi, inicio, filasItems.length, [19]);
  }
  return p;
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
  const encabezados = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const columnas = mapaEncabezados(encabezados);
  if (columnas.Envio !== undefined) return;
  // En libros existentes insertamos la nueva columna precisamente antes de
  // Extras; no se llena ninguna celda histórica ni se altera el resto.
  if (columnas.Extras !== undefined) {
    const columnaExtras = columnas.Extras + 1;
    h.insertColumnBefore(columnaExtras);
    h.getRange(1, columnaExtras).setValue('Envio').setFontWeight('bold');
  } else {
    // Sólo cubre una hoja no estándar sin Extras: no es posible ubicarla antes
    // de esa cabecera inexistente, por eso se agrega al final sin destruir datos.
    const nueva = h.getLastColumn() + 1;
    h.getRange(1, nueva).setValue('Envio').setFontWeight('bold');
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
  const ids = hi.getRange(2, 1, ultima - 1, 1).getValues();
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
function numero(valor) { return Number(valor) || 0; }
function numeroONull(valor) { return esVacio(valor) ? null : numero(valor); }
