/* ══════════════════════════════════════════════════════
   MENOS VUELTAS — Panel de pedidos

   MODELO DE DATOS
   El catálogo sirve para BUSCAR productos. En el momento en que un
   producto entra a un pedido, sus precios y su costo se copian a la
   línea y no se vuelven a leer nunca más.

   Esto es lo que hace que el histórico sea confiable: un pedido de
   agosto tiene que seguir mostrando los precios de agosto aunque la
   lista haya cambiado tres veces desde entonces. Si se releyeran del
   catálogo, cada actualización de precios reescribiría las ganancias
   de todos los meses anteriores.

   Lo que sí se guarda congelado es la REGLA completa (precio de lista,
   de promo, por cantidad y mínimo), no solo el número final: así se
   puede seguir editando la cantidad de un pedido viejo y el descuento
   por cantidad se aplica con los valores de aquel momento.
══════════════════════════════════════════════════════ */

// ══ CONEXIÓN CON EL SHEETS ══
// Pegar acá la URL del Apps Script publicado como aplicación web (ver
// SHEETS.md). Si queda vacía, los pedidos se guardan SOLO en este navegador
// y no llegan a la planilla — el panel avisa arriba cuando pasa eso.
//
// OJO al actualizar el panel: esta línea es lo único que hay que volver a
// completar si se reemplaza el archivo entero.
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwdeAOUpuvDXhna8B4UCGnh3eyl2Uy_69qdjiCz4sthAVdsvkPwhpSlUcE5e-h8yZhDIg/exec';

// ── Contraseña del panel ──
// Guardada como hash SHA-256 para no dejarla escrita en texto plano. Es una
// traba, no seguridad real: quien mire el código puede saltearla.
// Para cambiarla, ver SHEETS.md.
const PASS_HASH  = '13e3263aa26400d509d82c644c98ccc177c947624f3405d4676d1d2a1c192670'; // menosvueltas
const SESION_KEY = 'mv_admin_sesion';
const LS_KEY     = 'mv_pedidos_v2';
// Si un guardado falla, el pedido se deja acá para no perderlo.
const BORRADOR_KEY = 'mv_borrador';
const LS_CLIENTES  = 'mv_clientes';


/* ══════════════ ESTADO ══════════════ */
let CANAL    = 'b2c';
let CATALOGO = { b2c: [], b2b: [] };
let PEDIDOS  = [];
let CLIENTES = [];
let cliEnEdicion = null;
let edicion  = null;   // copia del pedido abierto; el original no se toca
let sugerencias = [];
let sugSel   = -1;
let guardando = false;
let PROVEEDORES = [];
let RESUMEN_STOCK = [];
let MOVIMIENTOS_STOCK = [];
let MOVIMIENTOS_STOCK_VISTA = [];
let proveedorEnEdicion = null;
let movimientoPendiente = null;
let enviandoMovimiento = false;

const MODALIDADES_ABASTECIMIENTO = ['CONTRA_PEDIDO', 'CONSIGNACION', 'STOCK_PROPIO'];
const TIPOS_MOVIMIENTO_MANUAL = ['INGRESO', 'CONSUMO_PROPIO', 'ROTURA_MERMA', 'CORRECCION'];


/* ══════════════ UTILIDADES ══════════════ */

// Los precios llegan del Sheets como "$19.096,61": punto de miles y coma
// decimal. Number() no los entiende, hay que normalizarlos.
function num(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const limpio = String(v).replace(/[^0-9,\-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
}

function money(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-AR');
}

// Quita tildes/diacríticos para que el buscador no sea quisquilloso:
// "aceite" encuentra "Aceite", "yerba" encuentra "Yerba" aunque el
// catálogo lo tenga con tilde, etc.
function sinAcentos(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Normaliza cualquier cosa que venga como fecha a "aaaa-mm-dd", que es lo
// que esperan los <input type="date">. El Sheets debería mandar ya ese
// formato, pero si una celda quedó guardada como fecha nativa puede volver
// como "Sat Aug 08 2026 00:00:00 GMT-0300 (...)": sin esto, el panel partía
// ese texto por los guiones y mostraba "undefined/0300/Sat Aug...".
function fechaISO(v) {
  if (!v) return '';
  const txt = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;

  const d = new Date(txt);
  if (isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function fechaCorta(v) {
  const iso = fechaISO(v);
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function textoOperativo(valor) { return String(valor ?? '').trim(); }

// C-05: estas listas son una proyección de lectura de los snapshots que ya
// viven en los pedidos. No consultan catálogo, proveedores, saldo ni ledger,
// para no reinterpretar una compra histórica ni producir efectos operativos.
function esLineaAbastecimientoElegible(pedido, item) {
  const estado = textoOperativo(pedido && pedido.estado);
  const modalidad = textoOperativo(item && item.modalidadAbastecimiento).toUpperCase();
  const cantidad = Number(item && item.cant);
  return !['Cancelado', 'Entregado'].includes(estado) &&
    textoOperativo(pedido && pedido.canal) &&
    textoOperativo(item && item.itemId) &&
    textoOperativo(item && item.id) &&
    textoOperativo(item && item.nombre) &&
    textoOperativo(item && item.idProveedor) &&
    modalidad === 'CONTRA_PEDIDO' &&
    item && item.gestionaStock === false &&
    Number.isFinite(cantidad) && cantidad > 0;
}

function construirListasAbastecimiento(pedidos) {
  const porGrupo = new Map();

  (pedidos || []).forEach(pedido => {
    (pedido.items || []).forEach(item => {
      if (!esLineaAbastecimientoElegible(pedido, item)) return;

      const canal = textoOperativo(pedido.canal);
      const idProveedor = textoOperativo(item.idProveedor);
      const modalidadAbastecimiento = textoOperativo(item.modalidadAbastecimiento).toUpperCase();
      const claveGrupo = [canal, idProveedor, modalidadAbastecimiento].join('\u0000');
      let grupo = porGrupo.get(claveGrupo);
      if (!grupo) {
        grupo = { canal, idProveedor, modalidadAbastecimiento, productos: new Map() };
        porGrupo.set(claveGrupo, grupo);
      }

      // El nombre también integra la identidad de la línea: dos snapshots de
      // un mismo ID con etiquetas históricas distintas no se reinterpretan.
      const id = textoOperativo(item.id);
      const nombre = textoOperativo(item.nombre);
      const claveProducto = [id, nombre].join('\u0000');
      const producto = grupo.productos.get(claveProducto) || { id, nombre, cantidad: 0 };
      producto.cantidad += Number(item.cant);
      grupo.productos.set(claveProducto, producto);
    });
  });

  return [...porGrupo.values()]
    .map(grupo => ({
      canal: grupo.canal,
      idProveedor: grupo.idProveedor,
      modalidadAbastecimiento: grupo.modalidadAbastecimiento,
      productos: [...grupo.productos.values()].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id, 'es'))
    }))
    .sort((a, b) => a.canal.localeCompare(b.canal, 'es') ||
      a.idProveedor.localeCompare(b.idProveedor, 'es') ||
      a.modalidadAbastecimiento.localeCompare(b.modalidadAbastecimiento, 'es'));
}

function proyeccionListaDistrosec(listas, canal) {
  const grupo = (listas || []).find(lista =>
    lista.canal === canal &&
    textoOperativo(lista.idProveedor).toUpperCase() === 'DISTROSEC' &&
    lista.modalidadAbastecimiento === 'CONTRA_PEDIDO');
  if (!grupo) return null;
  return { ...grupo, productos: grupo.productos.map(producto => ({ ...producto })) };
}

function textoListaAbastecimiento(lista) {
  if (!lista) return '';
  return '🛒 Pedido:\n' + lista.productos
    .map(producto => `- ${producto.cantidad}x ${producto.nombre}`)
    .join('\n');
}

function construirProveedorParaGuardar(campos, idOriginal = '') {
  campos = campos || {};
  const id = textoOperativo(campos.Id_Proveedor);
  const original = textoOperativo(idOriginal);
  const nombre = textoOperativo(campos.Nombre);
  if (!id) throw new Error('El identificador del proveedor es obligatorio.');
  if (original && id !== original) throw new Error('El identificador del proveedor es inmutable.');
  if (!nombre) throw new Error('El nombre del proveedor es obligatorio.');
  if (typeof campos.Activo !== 'boolean') throw new Error('El estado Activo debe ser booleano.');
  const proveedor = {
    Id_Proveedor: id, Nombre: nombre,
    Telefono: textoOperativo(campos.Telefono), Direccion: textoOperativo(campos.Direccion),
    Notas: textoOperativo(campos.Notas), Activo: campos.Activo
  };
  return original ? { Id_Proveedor_Original: original, ...proveedor } : proveedor;
}

function construirClasificacionProducto(campos, proveedores) {
  campos = campos || {};
  const idProducto = textoOperativo(campos.Id_Producto);
  const idProveedor = textoOperativo(campos.Id_Proveedor);
  const modalidad = textoOperativo(campos.Modalidad_Abastecimiento).toUpperCase();
  if (!idProducto || !idProveedor) throw new Error('Producto y proveedor son obligatorios.');
  if (MODALIDADES_ABASTECIMIENTO.indexOf(modalidad) < 0) throw new Error('Modalidad de abastecimiento inválida.');
  if (typeof campos.Sin_Stock !== 'boolean') throw new Error('Sin_Stock debe ser booleano.');
  const proveedor = (proveedores || []).find(p => p.Id_Proveedor === idProveedor);
  if (!proveedor || !proveedor.Activo) throw new Error('El proveedor habitual debe estar activo.');
  return {
    Id_Producto: idProducto, Id_Proveedor: idProveedor,
    Modalidad_Abastecimiento: modalidad, Sin_Stock: campos.Sin_Stock
  };
}

function resumenInventarioDelCanal(resumen, productosCanal) {
  const ids = new Set((productosCanal || []).map(producto => String(producto.id || '')));
  return (resumen || []).filter(producto => ids.has(String(producto.Id_Producto || '')))
    .map(producto => ({ ...producto }));
}

function filtrarResumenStock(filas, filtro = 'gestionado') {
  const resumen = (filas || []).map(fila => ({ ...fila }));
  return filtro === 'todos'
    ? resumen
    : resumen.filter(fila => fila.Gestiona_Stock === true);
}

function construirMovimientoManual(campos, clave) {
  campos = campos || {};
  const idProducto = textoOperativo(campos.Id_Producto);
  const tipo = textoOperativo(campos.Tipo).toUpperCase();
  const claveIdempotencia = textoOperativo(clave);
  const cantidadIngresada = Number(campos.Cantidad);
  if (!idProducto) throw new Error('El producto es obligatorio.');
  if (tipo === 'VENTA') throw new Error('VENTA se registra únicamente al entregar un pedido.');
  if (TIPOS_MOVIMIENTO_MANUAL.indexOf(tipo) < 0) throw new Error('Tipo de movimiento inválido.');
  if (!claveIdempotencia || !claveIdempotencia.startsWith('MANUAL:')) throw new Error('La clave manual es inválida.');
  if (!Number.isFinite(cantidadIngresada)) throw new Error('La cantidad es obligatoria.');

  let cantidad = cantidadIngresada;
  if (tipo === 'INGRESO') {
    if (cantidad <= 0) throw new Error('El ingreso requiere una cantidad positiva.');
  } else if (tipo === 'CONSUMO_PROPIO' || tipo === 'ROTURA_MERMA') {
    if (cantidad <= 0) throw new Error('La salida requiere una magnitud positiva.');
    cantidad = -cantidad;
  } else if (cantidad === 0) {
    throw new Error('La corrección requiere una cantidad distinta de cero.');
  }

  const resultado = {
    Id_Producto: idProducto, Tipo: tipo, Cantidad: cantidad,
    Referencia: textoOperativo(campos.Referencia), Nota: textoOperativo(campos.Nota),
    Clave_Idempotencia: claveIdempotencia
  };
  if (tipo === 'INGRESO') {
    if (textoOperativo(campos.Costo_Unitario) === '') throw new Error('El ingreso requiere costo unitario.');
    const costo = Number(campos.Costo_Unitario);
    if (!Number.isFinite(costo) || costo < 0) throw new Error('El costo unitario debe ser finito y no negativo.');
    resultado.Costo_Unitario = costo;
    const { Costo_Unitario, ...conCostoOrdenado } = resultado;
    return Object.freeze({ ...conCostoOrdenado, Costo_Unitario: costo, Referencia: resultado.Referencia, Nota: resultado.Nota, Clave_Idempotencia: resultado.Clave_Idempotencia });
  }
  if (tipo === 'CORRECCION' && (!resultado.Nota || !resultado.Referencia)) {
    throw new Error('La corrección requiere nota y movimiento antecedente.');
  }
  return Object.freeze(resultado);
}

function prepararIntentoMovimientoManual(pendiente, campos, generarId) {
  if (pendiente) return pendiente;
  const clave = 'MANUAL:' + generarId();
  return Object.freeze({ clave, payload: construirMovimientoManual(campos, clave) });
}

function crearErrorRechazoConcluyente(mensaje) {
  const error = new Error(mensaje || 'error del servidor');
  error.rechazoConcluyente = true;
  return error;
}

function resolverFalloMovimientoPendiente(pendiente, error) {
  return error && error.rechazoConcluyente === true ? null : pendiente;
}

function generarIdMovimientoManual() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function toast(msg, error) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!error);
  t.classList.add('visible');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('visible'), 2800);
}


/* ══════════════ LÍNEAS DE PEDIDO ══════════════
   Una línea guarda los precios congelados del momento en que se cargó.
   Estos son los únicos números que se usan para calcular: el catálogo
   ya no interviene.                                                      */

// Convierte un producto del catálogo en una línea de pedido, copiando
// todos los precios. A partir de acá el producto puede cambiar de precio
// o darse de baja: el pedido queda intacto.
function redondearPrecioB2C(valor) {
  const importe = num(valor);
  if (typeof MenosVueltasPromotion !== 'undefined' &&
      typeof MenosVueltasPromotion.roundToNearest50 === 'function') {
    return MenosVueltasPromotion.roundToNearest50(importe);
  }
  const inferior = Math.floor(importe / 50) * 50;
  return importe - inferior <= 25 ? inferior : inferior + 50;
}

function lineaDesdeCatalogo(prod, cantidad, canal = CANAL) {
  const redondear = canal === 'b2c' ? redondearPrecioB2C : num;
  const lista = num(prod.pv);
  const promo = num(prod.pp) || lista;
  const porCant = num(prod.pd);
  const promoCant = num(prod.ppd) || porCant;

  return {
    id:       prod.id,
    nombre:   prod.n,
    cant:     cantidad || 1,
    // Precios congelados. Se guardan los cuatro para poder recalcular el
    // pedido si cambia la cantidad, con los valores del día en que se cargó.
    lista:      redondear(lista),                 // unitario sin promo
    promo:      redondear(promo),                 // unitario con promo
    cantMin:    parseInt(prod.ud, 10) || 0,       // desde cuántas unidades
    porCant:    redondear(porCant),               // por cantidad sin promo
    promoCant:  redondear(promoCant),             // por cantidad con promo
    pct:        (prod.pct || '').trim(),          // "10%", para mostrar
    costo:      num(prod.co)
  };
}

// Precio que efectivamente se cobra por unidad, según la cantidad.
// Usa solo los valores congelados de la línea.
// Los dos descuentos se combinan: la promo temporal ya viene trasladada al
// precio por cantidad desde el Sheets (precio_promo_mayorista = promoCant),
// así que comprar más siempre conviene.
function precioUnitario(l) {
  const llegaAlMinimo = l.cantMin > 0 && l.cant >= l.cantMin;

  if (llegaAlMinimo) {
    // promoCant es el precio por cantidad con la promo ya aplicada; si el
    // producto no tiene promo, el generador copió ahí el precio normal.
    const porCant = l.promoCant || l.porCant;
    if (porCant > 0) return porCant;
  }
  return l.promo || l.lista;
}

/* Las etiquetas de descuento las arma UNA sola función, que usan tanto el
   buscador de productos como la tabla de items del pedido. Antes cada uno
   armaba las suyas y se fueron separando: el buscador mostraba el porcentaje
   y la tabla la palabra "promo", y ninguno de los dos mostraba las dos
   rebajas a la vez cuando se editaba un pedido guardado.

   `pct` es la etiqueta del Sheets ("10%"). Puede faltar en pedidos guardados
   antes de que existiera esa columna, así que hay un texto de reserva. */
function etiquetaPromo(pct) {
  // El pct puede venir como "10%" (string del catálogo), como 0.1 (cuando
  // Sheets convirtió "10%" al número subyacente al guardarlo), como 10, o
  // directamente vacío. Normalizamos todo a texto con %; si no hay nada,
  // cae al texto por defecto "Promo".
  if (pct == null || pct === '' || pct === 0) return 'Promo';
  if (typeof pct === 'number') {
    if (pct < 1) pct = Math.round(pct * 100);           // 0.1 → 10
    return Math.round(pct) + '%';
  }
  const txt = String(pct).trim();
  if (!txt) return 'Promo';
  if (/^\d+(\.\d+)?$/.test(txt)) return txt + '%';      // "10" → "10%"
  return txt;                                            // ya es "10%"
}

// Recibe cualquier objeto que tenga los precios congelados (una línea de
// pedido) o un producto del catálogo ya normalizado, más si llega al mínimo.
// Devuelve los chips en el mismo orden siempre: primero la promo, después
// el descuento por cantidad.
function chipsDescuento(l, llegaAlMinimo) {
  const chips = [];
  const hayPromo = llegaAlMinimo
    ? (l.promoCant > 0 && l.porCant > 0 && l.promoCant < l.porCant)
    : (l.promo > 0 && l.lista > 0 && l.promo < l.lista);

  if (hayPromo) {
    chips.push({ texto: etiquetaPromo(l.pct), clase: 'chip-dto--promo' });
  }
  if (llegaAlMinimo && l.porCant > 0 && l.porCant < l.lista) {
    chips.push({ texto: 'x cant.', clase: '' });
  }
  return chips;
}

function chipsHTML(chips) {
  if (!chips.length) return '<span class="motivo-vacio">—</span>';
  return `<div class="motivos">${chips
    .map(c => `<span class="chip-dto ${c.clase}">${esc(c.texto)}</span>`)
    .join('')}</div>`;
}

function esPedidoAlCosto(p) {
  return p?.canal === 'b2c' && p.pedidoAlCosto === true;
}

function calcularLinea(l, alCosto) {
  const unit     = alCosto ? l.costo : precioUnitario(l);
  const subtotal = l.cant * (alCosto ? l.costo : l.lista); // al costo no tiene rebaja sobre lista
  const total    = l.cant * unit;
  const costoTot = l.cant * l.costo;

  return {
    unit, subtotal, total, costoTot,
    descuento: subtotal - total,
    ganancia:  total - costoTot,
    tieneDto:  unit < l.lista
    // De dónde viene cada rebaja lo resuelve chipsDescuento(), que es la
    // única función que decide qué etiquetas se muestran.
  };
}

// El precio efectivo de cada línea ya incorpora promoción y descuento por
// cantidad. Esa es la única base válida para la política B2C de envío.
function modoEnvioPedido(p) {
  if (['automatico', 'fijado', 'historico'].includes(p.envioModo)) return p.envioModo;
  // Los pedidos recibidos del servidor no transportan estado de interfaz.
  // Si ya tienen Id, su importe es histórico; un borrador sin Id conserva la
  // regla automática aunque haya quedado guardado en este navegador antes de
  // incorporar envioModo.
  return p.id == null ? 'automatico' : 'historico';
}

function calcularEnvioPedido(p, productosNetos) {
  if (p.canal !== 'b2c') return null;
  const modo = modoEnvioPedido(p);
  if (modo === 'fijado') return MenosVueltasAdminShipping.serializeShipping(p.envio);
  if (modo === 'historico') return MenosVueltasAdminShipping.serializeShipping(p.envio) ?? 0;

  const resumen = MenosVueltasShipping.calculateShipping({
    channel: 'B2C',
    items: [{ unitPrice: productosNetos, quantity: 1 }]
  });
  return resumen.shippingCost;
}

function tienePromoTemporalLinea(l) {
  const llegaAlMinimo = l.cantMin > 0 && l.cant >= l.cantMin && l.porCant > 0;
  const lista = llegaAlMinimo ? l.porCant : l.lista;
  const promo = llegaAlMinimo ? l.promoCant : l.promo;
  return promo > 0 && lista > 0 && promo < lista;
}

function calcularPromocionCodigo(p, lineasCalculadas) {
  const codigo = String(p.codigoPromo || '').trim();
  const porcentaje = num(p.porcentajeCodigo);
  const codigoAplicable = p.canal === 'b2c' && codigo &&
    Number.isFinite(porcentaje) && porcentaje > 0 && porcentaje <= 100;
  const items = (p.items || []).map((linea, indice) => ({
    unitPrice: lineasCalculadas[indice].total,
    quantity: 1,
    hasProductPromotion: tienePromoTemporalLinea(linea)
  }));
  const promocion = MenosVueltasPromotion.calculatePromotion({
    percent: codigoAplicable ? porcentaje : 0,
    items
  });

  return {
    ...promocion,
    codigo: codigoAplicable ? codigo : '',
    porcentaje: codigoAplicable ? porcentaje : 0,
    elegibleTotal: codigoAplicable ? promocion.eligibleTotal : 0
  };
}

function calcularPedido(p) {
  const alCosto = esPedidoAlCosto(p);
  let subtotal = 0, total = 0, costo = 0, unidades = 0;
  let dtoPromo = 0, dtoCantidad = 0;
  const lineasCalculadas = [];

  (p.items || []).forEach(l => {
    const c = calcularLinea(l, alCosto);
    lineasCalculadas.push(c);
    subtotal += c.subtotal;
    total    += c.total;
    costo    += c.costoTot;
    unidades += l.cant || 0;

    // Se separan las dos rebajas para poder mostrarlas por su nombre.
    // Primero se descuenta lo que baja por cantidad (sobre precio de lista) y
    // después la promo sobre lo que quedaba: así los dos números suman exacto.
    const llegaAlMinimo = !alCosto && l.cantMin > 0 && l.cant >= l.cantMin && l.porCant > 0;
    const base = llegaAlMinimo ? l.porCant : l.lista;
    dtoCantidad += (l.lista - base) * l.cant;
    dtoPromo    += (base - c.unit) * l.cant;
  });

  // El mismo motor que usa el carrito descuenta y redondea cada línea B2C
  // por separado. Así la tabla, el total y el envío siempre muestran el
  // mismo importe, incluso con descuentos por cantidad.
  const codigoCalculado = calcularPromocionCodigo(alCosto
    ? { ...p, codigoPromo: '', porcentajeCodigo: 0 } : p, lineasCalculadas);
  const descuentoCodigo = Math.min(total, codigoCalculado.discount);
  const productosNetos = codigoCalculado.discountedProductsTotal;
  const extras = alCosto ? 0 : Number(p.extras) || 0;
  const envio = alCosto ? 0 : calcularEnvioPedido(p, productosNetos);
  const totalFinal = MenosVueltasAdminShipping.totalWithShipping({
    productsTotal: productosNetos,
    shipping: envio,
    extras
  });

  return {
    subtotal,
    descuento: subtotal - total,
    dtoPromo,
    dtoCantidad,
    codigoPromo: codigoCalculado.codigo,
    porcentajeCodigo: codigoCalculado.porcentaje,
    descuentoCodigo,
    elegibleCodigo: codigoCalculado.eligibleTotal,
    promotionLines: codigoCalculado.lines,
    productosNetos,
    envio,
    extras,
    total: totalFinal,
    costo,
    ganancia: totalFinal - costo,
    unidades,
    margen: totalFinal ? (totalFinal - costo) / totalFinal * 100 : 0
  };
}


/* ══════════════ CAPA DE DATOS ══════════════
   Una sola puerta de entrada y salida. Cada operación toca UN pedido:
   nunca se reescribe la planilla entera, así dos personas cargando al
   mismo tiempo no se pisan el trabajo.                                  */

// Traduce los errores de red a algo accionable. "Failed to fetch" puede ser
// cinco cosas distintas y el mensaje del navegador no dice cuál.
function explicarFalloRed() {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(SHEETS_URL)) {
    return 'La URL de SHEETS_URL no tiene el formato correcto. Tiene que empezar ' +
           'con https://script.google.com/macros/s/ y terminar en /exec (no /dev).';
  }
  if (location.protocol === 'file:') {
    return 'Estás abriendo el panel como archivo local (file://). Google bloquea ' +
           'los pedidos desde ahí. Subilo a Vercel o usá un servidor local.';
  }
  return 'No se pudo contactar al Sheets. La causa más común es que la ' +
         'implementación del Apps Script no esté publicada con acceso ' +
         '"Cualquier usuario" (ver SHEETS.md, paso 3).';
}

// Todas las llamadas al Sheets pasan por acá: un solo lugar donde manejar
// tiempos de espera, respuestas que no son JSON y errores de red.
async function llamarSheets(opciones) {
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 20000);

  let r;
  try {
    r = await fetch(opciones.url, { ...opciones.init, signal: ctrl.signal });
  } catch (e) {
    // Acá caen "Failed to fetch" (CORS, permisos, sin internet) y el timeout.
    throw new Error(e.name === 'AbortError'
      ? 'El Sheets tardó demasiado en responder.'
      : explicarFalloRed());
  } finally {
    clearTimeout(corte);
  }

  const texto = await r.text();
  let d;
  try {
    d = JSON.parse(texto);
  } catch (e) {
    // Si Apps Script devuelve HTML es casi siempre su pantalla de login o de
    // error: pasa cuando la implementación no es pública.
    throw new Error('El Sheets respondió algo inesperado. Revisá que la ' +
                    'implementación tenga acceso "Cualquier usuario".');
  }
  if (!d.ok) throw crearErrorRechazoConcluyente(d.error || 'error del servidor');
  return d;
}

const API = {

  async validarCodigo(codigo, canal) {
    if (!SHEETS_URL) throw new Error('No hay conexión configurada con Sheets para validar promociones.');
    const url = `${SHEETS_URL}?accion=validarCodigo&codigo=${encodeURIComponent(codigo)}&canal=${encodeURIComponent(canal)}`;
    return llamarSheets({ url });
  },

  async listar() {
    if (SHEETS_URL) {
      const d = await llamarSheets({ url: `${SHEETS_URL}?accion=listar` });
      return d.pedidos || [];
    }
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch (e) {
      return [];
    }
  },

  // Devuelve el pedido guardado, con su Id definitivo. Para pedidos nuevos
  // el Id lo asigna el servidor: si dos personas crean uno a la vez, cada
  // una recibe un número distinto (calcularlo en el panel daría el mismo).
  async guardar(pedido) {
    if (SHEETS_URL) {
      // text/plain evita el preflight CORS que Apps Script no responde.
      const d = await llamarSheets({
        url: SHEETS_URL,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'guardar', pedido })
        }
      });
      return d.pedido;
    }

    const lista = await this.listar();
    if (!pedido.id) {
      pedido.id = lista.length ? Math.max(...lista.map(p => p.id)) + 1 : 1;
    }
    const i = lista.findIndex(p => p.id === pedido.id);
    if (i >= 0) lista[i] = pedido; else lista.push(pedido);
    localStorage.setItem(LS_KEY, JSON.stringify(lista));
    return pedido;
  },

  async eliminar(id) {
    if (SHEETS_URL) {
      await llamarSheets({
        url: SHEETS_URL,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'eliminar', id })
        }
      });
      return;
    }
    const lista = (await this.listar()).filter(p => p.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(lista));
  },

  // ── Clientes ──
  // Son compartidos entre B2C y B2B: el mismo kiosco puede comprar por los
  // dos canales y no tiene sentido cargarlo dos veces.
  async listarClientes() {
    if (SHEETS_URL) {
      const d = await llamarSheets({ url: `${SHEETS_URL}?accion=clientes` });
      return d.clientes || [];
    }
    try {
      return JSON.parse(localStorage.getItem(LS_CLIENTES) || '[]');
    } catch (e) {
      return [];
    }
  },

  async guardarCliente(cliente) {
    if (SHEETS_URL) {
      const d = await llamarSheets({
        url: SHEETS_URL,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'guardarCliente', cliente })
        }
      });
      return d.cliente;
    }
    const lista = await this.listarClientes();
    if (!cliente.id) {
      cliente.id = lista.length ? Math.max(...lista.map(c => c.id)) + 1 : 1;
    }
    const i = lista.findIndex(c => c.id === cliente.id);
    if (i >= 0) lista[i] = cliente; else lista.push(cliente);
    localStorage.setItem(LS_CLIENTES, JSON.stringify(lista));
    return cliente;
  },

  async eliminarCliente(id) {
    if (SHEETS_URL) {
      await llamarSheets({
        url: SHEETS_URL,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ accion: 'eliminarCliente', id })
        }
      });
      return;
    }
    const lista = (await this.listarClientes()).filter(c => c.id !== id);
    localStorage.setItem(LS_CLIENTES, JSON.stringify(lista));
  },

  // Inventario y proveedores son exclusivamente operativos: no tienen modo
  // local ni se copian al catálogo reducido que acompaña al panel.
  async leerOperativo(accion, parametros = {}) {
    if (!SHEETS_URL) throw new Error('La operación de inventario requiere la conexión con Apps Script.');
    const consulta = Object.entries({ accion, ...parametros })
      .filter(([, valor]) => valor !== '' && valor !== null && valor !== undefined)
      .map(([clave, valor]) => `${encodeURIComponent(clave)}=${encodeURIComponent(valor)}`).join('&');
    return llamarSheets({ url: `${SHEETS_URL}?${consulta}` });
  },

  async escribirOperativo(accion, datos) {
    if (!SHEETS_URL) throw new Error('La operación de inventario requiere la conexión con Apps Script.');
    return llamarSheets({
      url: SHEETS_URL,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion, ...datos })
      }
    });
  },

  async listarProveedores() {
    const respuesta = await this.leerOperativo('listarProveedores');
    return respuesta.proveedores || [];
  },

  async crearProveedor(proveedor) {
    const respuesta = await this.escribirOperativo('crearProveedor', { proveedor });
    return respuesta.proveedor;
  },

  async actualizarProveedor(proveedor) {
    const respuesta = await this.escribirOperativo('actualizarProveedor', { proveedor });
    return respuesta.proveedor;
  },

  async clasificarProducto(clasificacion) {
    const respuesta = await this.escribirOperativo('clasificarProducto', { clasificacion });
    return respuesta.clasificacion;
  },

  async resumenStock() {
    const respuesta = await this.leerOperativo('resumenStock');
    return respuesta.productos || [];
  },

  async registrarMovimiento(movimiento) {
    const respuesta = await this.escribirOperativo('registrarMovimiento', { movimiento });
    return respuesta.movimiento;
  },

  async listarMovimientos(filtros = {}) {
    const respuesta = await this.leerOperativo('listarMovimientos', filtros);
    return respuesta.movimientos || [];
  }
};

// Lo que viaja al servidor: el pedido más los totales ya resueltos, para
// que la planilla se lea sin fórmulas. El cálculo sigue viviendo en un
// solo lugar (acá), no duplicado en el script.
function paraGuardar(p) {
  const t = calcularPedido(p);
  const { envioModo, ...pedido } = p;
  return {
    ...pedido,
    codigoPromo: t.codigoPromo,
    porcentajeCodigo: t.porcentajeCodigo,
    descuentoCodigo: Math.round(t.descuentoCodigo),
    envio: MenosVueltasAdminShipping.serializeShipping(t.envio),
    extras: t.extras,
    descExtras: esPedidoAlCosto(p) ? '' : p.descExtras,
    totales: {
      subtotal:  Math.round(t.subtotal),
      descuento: Math.round(t.descuento),
      envio:     MenosVueltasAdminShipping.serializeShipping(t.envio),
      total:     Math.round(t.total),
      costo:     Math.round(t.costo),
      ganancia:  Math.round(t.ganancia)
    },
    items: p.items.map(l => {
      const c = calcularLinea(l, esPedidoAlCosto(p));
      return {
        ...l,
        unit:      Math.round(c.unit),
        subtotal:  Math.round(c.subtotal),
        descuento: Math.round(c.descuento),
        total:     Math.round(c.total),
        costoTot:  Math.round(c.costoTot),
        ganancia:  Math.round(c.ganancia)
      };
    })
  };
}

// El servidor completa los snapshots operativos de cada línea. Adoptar la
// respuesta evita perder Item_Id al editar luego un pedido pendiente; el modo
// de envío sigue siendo exclusivamente estado de interfaz del panel.
function incorporarPedidoGuardado(actual, guardado, enviado) {
  const respuesta = guardado || {};
  return {
    ...actual,
    ...respuesta,
    items: Array.isArray(respuesta.items) ? respuesta.items : actual.items,
    envio: enviado.envio,
    envioModo: 'historico'
  };
}

function actualizarPedidoTrasGuardado(pedidos, actual, guardado, enviado) {
  const edicionActualizada = incorporarPedidoGuardado(actual, guardado, enviado);
  const pedidosActualizados = pedidos.slice();
  const indice = pedidosActualizados.findIndex(p => p.id === edicionActualizada.id);
  if (indice >= 0) pedidosActualizados[indice] = edicionActualizada;
  else pedidosActualizados.push(edicionActualizada);
  return { edicion: edicionActualizada, pedidos: pedidosActualizados };
}


/* ══════════════ LOGIN ══════════════ */

async function sha256(txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function mostrarPanel() {
  document.getElementById('login').hidden = true;
  document.getElementById('app').hidden = false;
  arrancarPanel();
}

function salir() {
  sessionStorage.removeItem(SESION_KEY);
  location.reload();
}

async function iniciar() {
  // La sesión dura lo que la pestaña: cerrarla obliga a entrar de nuevo.
  if (sessionStorage.getItem(SESION_KEY) === PASS_HASH) { mostrarPanel(); return; }

  document.getElementById('login').hidden = false;
  document.getElementById('loginPass').focus();

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const campo = document.getElementById('loginPass');
    const hash = await sha256(campo.value);
    if (hash === PASS_HASH) {
      sessionStorage.setItem(SESION_KEY, hash);
      mostrarPanel();
    } else {
      document.getElementById('loginError').hidden = false;
      campo.value = '';
      campo.focus();
    }
  });
}

document.addEventListener('DOMContentLoaded', iniciar);

// Los cálculos se exportan sólo en Node para sus pruebas; en el navegador
// este bloque no modifica la API ni el arranque del panel.
if (typeof module === 'object' && module.exports) {
  module.exports = {
    lineaDesdeCatalogo, calcularLinea, tienePromoTemporalLinea,
    calcularPedido, modoEnvioPedido, paraGuardar, esPedidoAlCosto,
    calcularMetricas, calcularEstadisticasClientes, incorporarPedidoGuardado,
    actualizarPedidoTrasGuardado, construirProveedorParaGuardar,
    construirClasificacionProducto, resumenInventarioDelCanal, filtrarResumenStock, filaProveedor,
    construirMovimientoManual, prepararIntentoMovimientoManual,
    crearErrorRechazoConcluyente, resolverFalloMovimientoPendiente,
    productosConStockGestionado, filasHistorialOperativo,
    filtrarMovimientosHistorial, movimientosAntecedentesCorreccion,
    construirListasAbastecimiento, proyeccionListaDistrosec,
    textoListaAbastecimiento
  };
}


/* ══════════════ ARRANQUE ══════════════ */

async function arrancarPanel() {
  const luz = document.getElementById('adEstado');

  try {
    const r = await fetch('productos.json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    CATALOGO = await r.json();
    if (!CATALOGO.b2c?.length && !CATALOGO.b2b?.length) throw new Error('archivo vacío');
    luz.classList.add('ok');
    luz.title = `Catálogo cargado · ${CATALOGO.b2c.length} B2C · ${CATALOGO.b2b.length} B2B`;
  } catch (e) {
    luz.classList.add('error');
    luz.title = 'No se pudo cargar el catálogo';
    avisarCatalogoFallido(e);
  }

  // Sin URL configurada el panel funciona igual, pero los pedidos no salen
  // de esta computadora. Es un estado válido para probar, y peligroso si no
  // se nota: por eso se avisa de forma permanente, no con un toast.
  if (!SHEETS_URL) avisarModoLocal();

  try {
    // En paralelo: son dos llamadas independientes y así el panel abre antes.
    const [ped, cli] = await Promise.all([API.listar(), API.listarClientes()]);
    PEDIDOS  = ped;
    CLIENTES = cli;
  } catch (e) {
    PEDIDOS = []; CLIENTES = [];
    toast('No se pudieron leer los datos: ' + e.message, true);
  }

  verLista();
  recuperarBorrador();
}

function avisarModoLocal() {
  const luz = document.getElementById('adEstado');
  luz.classList.remove('ok');
  luz.classList.add('local');
  luz.title = 'Los pedidos se guardan solo en este navegador';

  const aviso = document.createElement('div');
  aviso.className = 'aviso-local';
  aviso.innerHTML =
    '<b>Los pedidos se guardan solo en esta computadora</b>' +
    '<p>No se están enviando a Google Sheets. Para conectarlos, pegá la URL ' +
    'del Apps Script en <code>SHEETS_URL</code>, al principio de ' +
    '<code>admin.js</code> (ver SHEETS.md).</p>';
  document.getElementById('vistaLista').prepend(aviso);
}

// La causa más común de que no aparezcan productos es abrir el index.html
// haciendo doble clic: con file:// el navegador bloquea la lectura del JSON.
// En vez de dejar el buscador mudo, se explica qué pasó.
function avisarCatalogoFallido(err) {
  const esArchivoLocal = location.protocol === 'file:';
  const detalle = esArchivoLocal
    ? 'Abriste el archivo directamente desde la carpeta. Por seguridad, el navegador no deja leer <code>productos.json</code> así. Subilo a Vercel, o levantá un servidor local con <code>python3 -m http.server</code> y entrá por <code>localhost</code>.'
    : `No se encontró <code>productos.json</code> junto a esta página (${err.message}). Verificá que el archivo esté subido en la misma carpeta que <code>index.html</code>.`;

  const aviso = document.createElement('div');
  aviso.className = 'aviso-error';
  aviso.innerHTML = `<b>No se pudo cargar el catálogo de productos</b><p>${detalle}</p>`;
  document.getElementById('vistaLista').prepend(aviso);
}


/* ══════════════ NAVEGACIÓN ══════════════ */

function irASeccion(nombre) {
  const esPedidos = nombre === 'pedidos';
  const esClientes = nombre === 'clientes';
  const esProveedores = nombre === 'proveedores';
  const esInventario = nombre === 'inventario';
  document.getElementById('navPedidos').classList.toggle('on', esPedidos);
  document.getElementById('navClientes').classList.toggle('on', esClientes);
  document.getElementById('navProveedores').classList.toggle('on', esProveedores);
  document.getElementById('navInventario').classList.toggle('on', esInventario);
  document.getElementById('vistaClientes').hidden = !esClientes;
  document.getElementById('vistaProveedores').hidden = !esProveedores;
  document.getElementById('vistaLista').hidden = !esPedidos;
  document.getElementById('vistaInventario').hidden = !esInventario;
  document.getElementById('vistaEditor').hidden = true;

  if (esPedidos) pintarLista();
  else if (esClientes) pintarClientes();
  else if (esProveedores) recargarProveedores();
  else if (esInventario) recargarInventario();
}

function setCanal(canal) {
  CANAL = canal;
  document.getElementById('canalB2C').classList.toggle('on', canal === 'b2c');
  document.getElementById('canalB2B').classList.toggle('on', canal === 'b2b');
  if (document.getElementById('navInventario').classList.contains('on')) recargarInventario();
  else if (document.getElementById('navProveedores').classList.contains('on')) pintarProveedores();
  else if (document.getElementById('navClientes').classList.contains('on')) irASeccion('clientes');
  else verLista();
}

function verLista() {
  document.getElementById('vistaLista').hidden = false;
  document.getElementById('vistaEditor').hidden = true;
  document.getElementById('vistaClientes').hidden = true;
  document.getElementById('vistaProveedores').hidden = true;
  document.getElementById('vistaInventario').hidden = true;
  document.getElementById('navPedidos').classList.add('on');
  document.getElementById('navClientes').classList.remove('on');
  document.getElementById('navProveedores').classList.remove('on');
  document.getElementById('navInventario').classList.remove('on');
  edicion = null;
  pintarLista();
}

function volverALista() { verLista(); }


/* ══════════════ INVENTARIO OPERATIVO ══════════════ */

function productosCanalActual() {
  return Array.isArray(CATALOGO[CANAL]) ? CATALOGO[CANAL] : [];
}

function productoOperativoPorId(idProducto, productos = productosCanalActual()) {
  return (productos || []).find(producto => String(producto.id) === String(idProducto));
}

function productosConStockGestionado(resumen, productos) {
  return (productos || []).filter(producto => (resumen || []).some(fila =>
    String(fila.Id_Producto) === String(producto.id) && fila.Gestiona_Stock === true));
}

function referenciaHistorialOperativa(movimiento) {
  const referencias = [];
  if (movimiento.Referencia) referencias.push(String(movimiento.Referencia));
  if (movimiento.Id_Pedido) referencias.push('Pedido ' + movimiento.Id_Pedido);
  if (movimiento.Item_Id) referencias.push('ítem ' + movimiento.Item_Id);
  return referencias.join(' · ');
}

function filasHistorialOperativo(movimientos, productos) {
  return (movimientos || []).map(movimiento => {
    const producto = productoOperativoPorId(movimiento.Id_Producto, productos);
    return {
      fecha: fechaCorta(movimiento.Fecha),
      producto: producto ? producto.n : String(movimiento.Id_Producto || '—'),
      tipo: String(movimiento.Tipo || ''),
      cantidad: Number(movimiento.Cantidad),
      costo: Object.prototype.hasOwnProperty.call(movimiento, 'Costo_Unitario')
        ? Number(movimiento.Costo_Unitario) : null,
      referencia: referenciaHistorialOperativa(movimiento),
      nota: String(movimiento.Nota || '')
    };
  });
}

function filtrarMovimientosHistorial(movimientos, filtros = {}) {
  const idProducto = textoOperativo(filtros.Id_Producto);
  const tipo = textoOperativo(filtros.Tipo).toUpperCase();
  return (movimientos || []).filter(movimiento =>
    (!idProducto || String(movimiento.Id_Producto) === idProducto) &&
    (!tipo || String(movimiento.Tipo).toUpperCase() === tipo)
  );
}

function movimientosAntecedentesCorreccion(movimientos, idProducto) {
  return filtrarMovimientosHistorial(movimientos, { Id_Producto: idProducto });
}

function opcionesProductos(productos, textoInicial) {
  return `<option value="">${esc(textoInicial)}</option>` + (productos || []).map(producto =>
    `<option value="${esc(producto.id)}">${esc(producto.n || producto.id)}</option>`
  ).join('');
}

function opcionesProveedores(proveedores, textoInicial) {
  return `<option value="">${esc(textoInicial)}</option>` + (proveedores || [])
    .filter(proveedor => proveedor.Activo === true)
    .map(proveedor => `<option value="${esc(proveedor.Id_Proveedor)}">${esc(proveedor.Nombre)} · ${esc(proveedor.Id_Proveedor)}</option>`)
    .join('');
}

function nombreProveedor(idProveedor) {
  const proveedor = PROVEEDORES.find(item => item.Id_Proveedor === idProveedor);
  if (!idProveedor) return 'Sin clasificar';
  if (!proveedor) return String(idProveedor);
  return proveedor.Nombre + (proveedor.Activo ? '' : ' (inactivo)');
}

function filaProveedor(proveedor) {
  const idCodificado = encodeURIComponent(proveedor.Id_Proveedor);
  return `<tr><td><b>${esc(proveedor.Nombre)}</b></td>` +
    `<td>${esc(proveedor.Id_Proveedor)}</td>` +
    `<td>${esc(textoOperativo(proveedor.Telefono) || '—')}</td>` +
    `<td>${proveedor.Activo ? 'Activo' : 'Inactivo'}</td>` +
    `<td class="tabla-accion"><button class="btn btn--peque" type="button" onclick="editarProveedorCodificado('${idCodificado}')">Editar</button></td></tr>`;
}

function pintarProveedores() {
  const cuerpo = document.getElementById('proveedoresTbody');
  const vacio = document.getElementById('proveedoresVacio');
  const proveedores = PROVEEDORES.slice().sort((a, b) => String(a.Nombre).localeCompare(String(b.Nombre)));
  cuerpo.innerHTML = proveedores.map(filaProveedor).join('');
  vacio.hidden = proveedores.length !== 0;
}

function editarProveedorCodificado(idCodificado) {
  editarProveedor(decodeURIComponent(idCodificado));
}

function editarProveedor(idProveedor) {
  const proveedor = PROVEEDORES.find(item => item.Id_Proveedor === idProveedor);
  if (!proveedor) return;
  proveedorEnEdicion = proveedor;
  document.getElementById('proveedorOriginal').value = proveedor.Id_Proveedor;
  document.getElementById('proveedorId').value = proveedor.Id_Proveedor;
  document.getElementById('proveedorId').readOnly = true;
  document.getElementById('proveedorNombre').value = proveedor.Nombre || '';
  document.getElementById('proveedorTelefono').value = proveedor.Telefono || '';
  document.getElementById('proveedorDireccion').value = proveedor.Direccion || '';
  document.getElementById('proveedorNotas').value = proveedor.Notas || '';
  document.getElementById('proveedorActivo').checked = proveedor.Activo === true;
  document.getElementById('proveedorGuardar').textContent = 'Guardar cambios';
  document.getElementById('modalProveedorTitulo').textContent = 'Editar proveedor';
  document.getElementById('modalProveedor').hidden = false;
  document.getElementById('proveedorNombre').focus();
}

function nuevoProveedor() {
  cancelarEdicionProveedor();
  document.getElementById('modalProveedorTitulo').textContent = 'Nuevo proveedor';
  document.getElementById('modalProveedor').hidden = false;
  document.getElementById('proveedorId').focus();
}

function cancelarEdicionProveedor() {
  proveedorEnEdicion = null;
  document.getElementById('proveedorForm').reset();
  document.getElementById('proveedorOriginal').value = '';
  document.getElementById('proveedorId').readOnly = false;
  document.getElementById('proveedorActivo').checked = true;
  document.getElementById('proveedorGuardar').textContent = 'Guardar proveedor';
}

function cerrarModalProveedor() {
  cancelarEdicionProveedor();
  document.getElementById('modalProveedor').hidden = true;
}

async function guardarProveedorDesdeForm(evento) {
  evento.preventDefault();
  const original = document.getElementById('proveedorOriginal').value;
  try {
    const proveedor = construirProveedorParaGuardar({
      Id_Proveedor: document.getElementById('proveedorId').value,
      Nombre: document.getElementById('proveedorNombre').value,
      Telefono: document.getElementById('proveedorTelefono').value,
      Direccion: document.getElementById('proveedorDireccion').value,
      Notas: document.getElementById('proveedorNotas').value,
      Activo: document.getElementById('proveedorActivo').checked
    }, original);
    if (original && proveedor.Activo === false && proveedorEnEdicion && proveedorEnEdicion.Activo === true &&
        !confirm('El proveedor quedará inactivo. Sus referencias históricas se conservarán. ¿Continuar?')) return;
    if (original) await API.actualizarProveedor(proveedor); else await API.crearProveedor(proveedor);
    cerrarModalProveedor();
    await recargarProveedores();
    toast('Proveedor guardado.');
  } catch (error) {
    toast('No se pudo guardar el proveedor: ' + error.message, true);
  }
}

function cargarClasificacionProducto() {
  const idProducto = document.getElementById('clasificacionProducto').value;
  const actual = RESUMEN_STOCK.find(fila => String(fila.Id_Producto) === String(idProducto));
  document.getElementById('clasificacionProveedor').value = actual?.Id_Proveedor || '';
  document.getElementById('clasificacionModalidad').value = actual?.Modalidad_Abastecimiento || 'CONTRA_PEDIDO';
  document.getElementById('clasificacionSinStock').checked = actual?.Sin_Stock === true;
}

function pintarSelectoresInventario() {
  const productos = productosCanalActual();
  const clasificacionProducto = document.getElementById('clasificacionProducto');
  const movimientoProducto = document.getElementById('movimientoProducto');
  const historialProducto = document.getElementById('historialProducto');
  const seleccionado = clasificacionProducto.value;
  clasificacionProducto.innerHTML = opcionesProductos(productos, '— Elegí un producto —');
  clasificacionProducto.value = seleccionado;
  clasificacionProducto.onchange = cargarClasificacionProducto;
  document.getElementById('clasificacionProveedor').innerHTML = opcionesProveedores(PROVEEDORES, '— Elegí proveedor activo —');
  movimientoProducto.innerHTML = opcionesProductos(productosConStockGestionado(RESUMEN_STOCK, productos), '— Elegí un producto gestionado —');
  movimientoProducto.onchange = actualizarCamposMovimiento;
  historialProducto.innerHTML = opcionesProductos(productos, 'Todos los productos');
  cargarClasificacionProducto();
  actualizarCamposMovimiento();
}

async function guardarClasificacionDesdeForm(evento) {
  evento.preventDefault();
  try {
    const clasificacion = construirClasificacionProducto({
      Id_Producto: document.getElementById('clasificacionProducto').value,
      Id_Proveedor: document.getElementById('clasificacionProveedor').value,
      Modalidad_Abastecimiento: document.getElementById('clasificacionModalidad').value,
      Sin_Stock: document.getElementById('clasificacionSinStock').checked
    }, PROVEEDORES);
    await API.clasificarProducto(clasificacion);
    await recargarInventario();
    toast('Clasificación guardada.');
  } catch (error) {
    toast('No se pudo guardar la clasificación: ' + error.message, true);
  }
}

function pintarStock() {
  const cuerpo = document.getElementById('stockTbody');
  const vacio = document.getElementById('stockVacio');
  const productos = productosCanalActual();
  const filtro = document.getElementById('filtroStock').value;
  const filas = filtrarResumenStock(resumenInventarioDelCanal(RESUMEN_STOCK, productos), filtro);
  cuerpo.innerHTML = filas.map(fila => {
    const producto = productoOperativoPorId(fila.Id_Producto, productos);
    return `<tr><td>${esc(producto?.n || fila.Id_Producto)}</td>` +
      `<td>${esc(nombreProveedor(fila.Id_Proveedor))}</td>` +
      `<td>${esc(fila.Modalidad_Abastecimiento || 'CONTRA_PEDIDO')}</td>` +
      `<td>${fila.Gestiona_Stock ? 'Sí' : 'No'}</td>` +
      `<td class="num">${fila.Saldo === null ? 'No aplica' : esc(fila.Saldo)}</td>` +
      `<td>${fila.Sin_Stock ? 'Sí (manual)' : 'No'}</td></tr>`;
  }).join('');
  vacio.hidden = filas.length !== 0;
}

function abrirModalClasificacion() {
  pintarSelectoresInventario();
  document.getElementById('modalClasificacion').hidden = false;
  document.getElementById('clasificacionProducto').focus();
}

function cerrarModalClasificacion() {
  document.getElementById('modalClasificacion').hidden = true;
}

function abrirModalMovimiento() {
  pintarSelectoresInventario();
  document.getElementById('modalMovimiento').hidden = false;
  document.getElementById('movimientoProducto').focus();
}

function cerrarModalMovimiento() {
  document.getElementById('modalMovimiento').hidden = true;
}

function abrirModalHistorial() {
  pintarSelectoresInventario();
  pintarHistorial();
  document.getElementById('modalHistorial').hidden = false;
  document.getElementById('historialProducto').focus();
}

function cerrarModalHistorial() {
  document.getElementById('modalHistorial').hidden = true;
}

function actualizarCamposMovimiento() {
  const tipo = document.getElementById('movimientoTipo').value;
  const producto = document.getElementById('movimientoProducto').value;
  const esIngreso = tipo === 'INGRESO';
  const esCorreccion = tipo === 'CORRECCION';
  document.getElementById('movimientoCostoCampo').hidden = !esIngreso;
  document.getElementById('movimientoCosto').required = esIngreso;
  document.getElementById('movimientoReferenciaCampo').hidden = !esCorreccion;
  document.getElementById('movimientoReferencia').required = esCorreccion;
  document.getElementById('movimientoNotaRequerida').hidden = !esCorreccion;
  document.getElementById('movimientoNota').required = esCorreccion;
  document.getElementById('movimientoCantidadLabel').textContent =
    esCorreccion ? 'Corrección (+ o -)' : esIngreso ? 'Cantidad ingresada' : 'Unidades retiradas';
  const referencias = movimientosAntecedentesCorreccion(MOVIMIENTOS_STOCK, producto);
  document.getElementById('movimientoReferencia').innerHTML = opcionesProductos(
    referencias.map(movimiento => ({ id: movimiento.Movimiento_Id, n: `${movimiento.Tipo} · ${movimiento.Movimiento_Id}` })),
    '— Elegí antecedente —'
  );
}

function camposMovimientoDesdeForm() {
  return {
    Id_Producto: document.getElementById('movimientoProducto').value,
    Tipo: document.getElementById('movimientoTipo').value,
    Cantidad: document.getElementById('movimientoCantidad').value,
    Costo_Unitario: document.getElementById('movimientoCosto').value,
    Referencia: document.getElementById('movimientoReferencia').value,
    Nota: document.getElementById('movimientoNota').value
  };
}

function mostrarEstadoMovimiento(mensaje, esError) {
  const estado = document.getElementById('movimientoEstado');
  estado.textContent = mensaje;
  estado.classList.toggle('error', !!esError);
}

async function enviarMovimientoPendiente() {
  if (!movimientoPendiente || enviandoMovimiento) return;
  enviandoMovimiento = true;
  document.getElementById('movimientoGuardar').disabled = true;
  document.getElementById('movimientoReintentar').hidden = true;
  mostrarEstadoMovimiento('Guardando movimiento…', false);
  try {
    await API.registrarMovimiento(movimientoPendiente.payload);
    movimientoPendiente = null;
    document.getElementById('movimientoForm').reset();
    mostrarEstadoMovimiento('Movimiento confirmado.', false);
    await recargarInventario();
  } catch (error) {
    movimientoPendiente = resolverFalloMovimientoPendiente(movimientoPendiente, error);
    if (movimientoPendiente) {
      mostrarEstadoMovimiento('No se confirmó el movimiento: ' + error.message, true);
      document.getElementById('movimientoReintentar').hidden = false;
    } else {
      mostrarEstadoMovimiento('El servidor rechazó el movimiento: ' + error.message +
        '. Corregí el formulario y volvé a guardarlo.', true);
    }
  } finally {
    enviandoMovimiento = false;
    document.getElementById('movimientoGuardar').disabled = false;
  }
}

async function guardarMovimientoDesdeForm(evento) {
  evento.preventDefault();
  try {
    movimientoPendiente = prepararIntentoMovimientoManual(movimientoPendiente, camposMovimientoDesdeForm(), generarIdMovimientoManual);
    await enviarMovimientoPendiente();
  } catch (error) {
    movimientoPendiente = null;
    mostrarEstadoMovimiento(error.message, true);
  }
}

async function reintentarMovimientoPendiente() {
  await enviarMovimientoPendiente();
}

function pintarHistorial() {
  const cuerpo = document.getElementById('historialTbody');
  const vacio = document.getElementById('historialVacio');
  const filas = filasHistorialOperativo(MOVIMIENTOS_STOCK_VISTA, productosCanalActual());
  cuerpo.innerHTML = filas.map(fila => `<tr><td>${esc(fila.fecha)}</td><td>${esc(fila.producto)}</td>` +
    `<td>${esc(fila.tipo)}</td><td class="num">${esc(fila.cantidad)}</td>` +
    `<td class="num">${fila.costo === null ? '—' : money(fila.costo)}</td>` +
    `<td>${esc(fila.referencia || '—')}</td><td>${esc(fila.nota || '—')}</td></tr>`).join('');
  vacio.hidden = filas.length !== 0;
}

function filtrarHistorial(evento) {
  evento.preventDefault();
  MOVIMIENTOS_STOCK_VISTA = filtrarMovimientosHistorial(MOVIMIENTOS_STOCK, {
    Id_Producto: document.getElementById('historialProducto').value,
    Tipo: document.getElementById('historialTipo').value
  });
  pintarHistorial();
}

async function recargarProveedores() {
  try {
    PROVEEDORES = await API.listarProveedores();
    pintarProveedores();
  } catch (error) {
    PROVEEDORES = [];
    pintarProveedores();
    toast('No se pudo cargar proveedores: ' + error.message, true);
  }
}

async function recargarInventario() {
  try {
    const [proveedores, resumen, movimientos] = await Promise.all([
      API.listarProveedores(), API.resumenStock(), API.listarMovimientos()
    ]);
    PROVEEDORES = proveedores;
    RESUMEN_STOCK = resumen;
    MOVIMIENTOS_STOCK = movimientos;
    MOVIMIENTOS_STOCK_VISTA = movimientos;
    pintarProveedores();
    pintarSelectoresInventario();
    pintarStock();
    pintarHistorial();
  } catch (error) {
    RESUMEN_STOCK = [];
    MOVIMIENTOS_STOCK = [];
    MOVIMIENTOS_STOCK_VISTA = [];
    pintarProveedores();
    pintarSelectoresInventario();
    pintarStock();
    pintarHistorial();
    mostrarEstadoMovimiento('No se pudo leer stock: ' + error.message, true);
    toast('No se pudo cargar stock: ' + error.message, true);
  }
}


/* ══════════════ LISTA ══════════════ */

function pintarLista() {
  const q  = (document.getElementById('q').value || '').toLowerCase().trim();
  const fe = document.getElementById('filtroEstado').value;

  const delCanal = PEDIDOS.filter(p => p.canal === CANAL);
  const ESTADOS_INACTIVOS = ['Entregado', 'Cancelado'];
  let lista = delCanal;
  if (fe === 'activos' || !fe) {
    lista = lista.filter(p => !ESTADOS_INACTIVOS.includes(p.estado));
  } else if (fe !== 'todos') {
    lista = lista.filter(p => p.estado === fe);
  }
  const qNorm = sinAcentos(q);
  lista = lista
    .filter(p => {
      if (!q) return true;
      // Si el pedido tiene un clienteId vinculado, buscamos contra el
      // nombre ACTUAL del cliente (no el congelado en el pedido), así
      // al renombrar un cliente lo seguís encontrando.
      const clienteVinculado = p.clienteId ? (CLIENTES.find(c => c.id === p.clienteId)?.nombre || '') : '';
      const texto = sinAcentos(`${p.cliente} ${clienteVinculado} ${p.id} ${p.estado}`).toLowerCase();
      return texto.includes(qNorm);
    })
    .sort((a, b) => fechaISO(b.fechaPedido).localeCompare(fechaISO(a.fechaPedido)) || b.id - a.id);

  pintarKpis(delCanal);

  const tb = document.getElementById('tbodyPedidos');
  if (!lista.length) {
    tb.innerHTML = `<tr><td colspan="8" class="vacio">${
      delCanal.length ? 'No hay pedidos que coincidan con la búsqueda.'
                      : 'Todavía no hay pedidos cargados en este canal.'}</td></tr>`;
    return;
  }

  tb.innerHTML = lista.map(p => {
    const t = calcularPedido(p);
    const claseEstado = 'estado--' + p.estado.toLowerCase().replaceAll(/\s+/g, '-');
    // Si el pedido está vinculado a una ficha de cliente, mostramos el
    // nombre ACTUAL de esa ficha (por si lo corregiste). Si no (pedido
    // viejo sin vínculo, o cliente eliminado), caemos al nombre congelado
    // que quedó guardado en el pedido.
    const clienteVinculado = p.clienteId ? CLIENTES.find(c => c.id === p.clienteId) : null;
    const nombreMostrar = clienteVinculado?.nombre || p.cliente;
    const telMostrar = clienteVinculado?.telefono || p.telefono;
    return `<tr onclick="abrirPedido(${p.id})"${p.estado === 'Cancelado' ? ' style="opacity:.6"' : ''}>
      <td><b>#${p.id}</b></td>
      <td>${fechaCorta(p.fechaPedido)}</td>
      <td>${fechaCorta(p.fechaEntrega)}</td>
      <td class="celda-cliente"><b>${esc(nombreMostrar) || '—'}</b>${esPedidoAlCosto(p) ? '<span class="pedido-al-costo-etiqueta">Al costo</span>' : ''}${telMostrar ? `<span>${esc(telMostrar)}</span>` : ''}</td>
      <td><span class="estado ${claseEstado}">${p.estado}</span></td>
      <td class="num">${t.unidades}</td>
      <td class="num"><b>${money(t.total)}</b></td>
      <td class="num"><span class="ganancia${t.ganancia < 0 ? ' ganancia--neg' : ''}">${money(t.ganancia)}</span></td>
    </tr>`;
  }).join('');
}

function pintarKpis(pedidos) {
  const { facturado, ganancia, pedidosActivos, entregados, cancelados, ticket } = calcularMetricas(pedidos);
  const margen = facturado ? ganancia / facturado * 100 : 0;

  document.getElementById('kpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-l">Pedidos activos</div>
      <div class="kpi-v">${pedidosActivos}</div>
      <div class="kpi-s">${entregados} entregados</div>
    </div>
    <div class="kpi">
      <div class="kpi-l">Facturado</div>
      <div class="kpi-v">${money(facturado)}</div>
      <div class="kpi-s">ticket ${money(ticket)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-l">Ganancia</div>
      <div class="kpi-v kpi-v--verde">${money(ganancia)}</div>
      <div class="kpi-s">${margen.toFixed(1)}% de margen</div>
    </div>
    <div class="kpi">
      <div class="kpi-l">Cancelados</div>
      <div class="kpi-v">${cancelados}</div>
      <div class="kpi-s">&nbsp;</div>
    </div>`;
}

function calcularMetricas(pedidos) {
  const comerciales = pedidos.filter(p => !esPedidoAlCosto(p));
  let facturado = 0, ganancia = 0;
  const noCancelados = comerciales.filter(p => p.estado !== 'Cancelado');
  noCancelados.forEach(p => {
    const t = calcularPedido(p);
    facturado += t.total;
    ganancia  += t.ganancia;
  });

  return {
    facturado, ganancia,
    pedidosActivos: comerciales.filter(p => ['Nuevo', 'Pedido a Distribuidora', 'Para entregar'].includes(p.estado)).length,
    entregados: comerciales.filter(p => p.estado === 'Entregado').length,
    cancelados: comerciales.filter(p => p.estado === 'Cancelado').length,
    ticket: noCancelados.length ? facturado / noCancelados.length : 0
  };
}



/* ══════════════ CLIENTES ══════════════
   Los clientes son compartidos entre B2C y B2B. Al elegir uno en un pedido
   se copian sus datos a la fila: si después se corrige la dirección del
   cliente, los pedidos viejos conservan la dirección a la que realmente se
   entregó. Es el mismo criterio que con los precios.                       */

function pintarClientes() {
  const q = sinAcentos((document.getElementById('qCli').value || '').toLowerCase().trim());

  // Cuántos pedidos hizo cada cliente y cuánto lleva gastado: es el dato
  // que dice quién vuelve, que es lo que importa medir.
  const resumen = calcularEstadisticasClientes(PEDIDOS);

  const lista = CLIENTES
    .filter(c => (c.canal || 'b2c') === CANAL)
    .filter(c => {
      if (!q) return true;
      const texto = sinAcentos(`${c.nombre} ${c.telefono} ${c.barrio} ${c.direccion} ${c.notas}`).toLowerCase();
      return texto.includes(q);
    })
    .sort((a, b) => (resumen[b.id]?.n || 0) - (resumen[a.id]?.n || 0) ||
                     a.nombre.localeCompare(b.nombre));

  const tb = document.getElementById('tbodyClientes');
  if (!lista.length) {
    const delCanal = CLIENTES.filter(c => (c.canal || 'b2c') === CANAL).length;
    tb.innerHTML = `<tr><td colspan="7" class="vacio">${
      delCanal ? 'No hay clientes que coincidan con la búsqueda.'
               : `Todavía no cargaste ningún cliente en ${CANAL.toUpperCase()}.`}</td></tr>`;
    return;
  }

  tb.innerHTML = lista.map(c => {
    const r = resumen[c.id] || { n: 0, total: 0 };
    return `<tr onclick="editarCliente(${c.id})">
      <td>
        <b>${esc(c.nombre)}</b>
        ${c.notas ? `<div class="celda-nota">${esc(c.notas)}</div>` : ''}
      </td>
      <td>${c.telefono ? `<a href="https://wa.me/${soloDigitos(c.telefono)}" target="_blank" rel="noopener" class="tel-link" onclick="event.stopPropagation()">${esc(c.telefono)}</a>` : '—'}</td>
      <td>${esc(c.barrio) || '—'}</td>
      <td class="celda-dir">${esc(c.direccion) || '—'}</td>
      <td class="num">${r.n || '—'}</td>
      <td class="num">${r.total ? money(r.total) : '—'}</td>
      <td class="num">${c.mapa
        ? `<a href="${esc(c.mapa)}" target="_blank" rel="noopener" class="icono-mapa" title="Ver ubicación" onclick="event.stopPropagation()">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
           </a>` : ''}</td>
    </tr>`;
  }).join('');
}

function calcularEstadisticasClientes(pedidos) {
  const resumen = {};
  pedidos.forEach(p => {
    if (esPedidoAlCosto(p) || !p.clienteId) return;
    const r = resumen[p.clienteId] || (resumen[p.clienteId] = { n: 0, total: 0 });
    r.n++;
    r.total += calcularPedido(p).total;
  });
  return resumen;
}

// WhatsApp necesita el número sin espacios ni guiones. Se asume Argentina
// (54 9) si el número viene sin código de país.
function soloDigitos(tel) {
  const d = String(tel).replace(/\D/g, '');
  if (d.startsWith('54')) return d;
  return '549' + d.replace(/^0/, '').replace(/^15/, '');
}

function nuevoCliente() {
  cliEnEdicion = { id: null, canal: CANAL, nombre: '', telefono: '', direccion: '', barrio: '', mapa: '', notas: '' };
  abrirModalCliente('Nuevo cliente');
}

function editarCliente(id) {
  const c = CLIENTES.find(x => x.id === id);
  if (!c) return;
  cliEnEdicion = { ...c };
  abrirModalCliente('Editar cliente');
}

function abrirModalCliente(titulo) {
  document.getElementById('modalCliTitulo').textContent = titulo;
  document.getElementById('btnBorrarCli').hidden = !cliEnEdicion.id;

  const v = (id, val) => { document.getElementById(id).value = val ?? ''; };
  v('cliCanal', cliEnEdicion.canal || 'b2c');
  v('cliNombre', cliEnEdicion.nombre);
  v('cliTel',    cliEnEdicion.telefono);
  v('cliBarrio', cliEnEdicion.barrio);
  v('cliDir',    cliEnEdicion.direccion);
  v('cliMapa',   cliEnEdicion.mapa);
  v('cliNotas',  cliEnEdicion.notas);

  // Sugerencias de barrio con los que ya se usaron: evita que el mismo
  // barrio quede escrito de tres formas distintas.
  document.getElementById('listaBarrios').innerHTML =
    [...new Set(CLIENTES.filter(c => (c.canal || 'b2c') === CANAL)
                        .map(c => c.barrio).filter(Boolean))]
      .map(b => `<option value="${esc(b)}">`).join('');

  document.getElementById('modalCliente').hidden = false;
  document.getElementById('cliNombre').focus();
}

function cerrarModalCliente() {
  document.getElementById('modalCliente').hidden = true;
  cliEnEdicion = null;
}

async function guardarCliente(e) {
  e.preventDefault();
  if (!cliEnEdicion) return;

  const g = id => document.getElementById(id).value.trim();
  Object.assign(cliEnEdicion, {
    canal:     document.getElementById('cliCanal').value,
    nombre:    g('cliNombre'),
    telefono:  g('cliTel'),
    barrio:    g('cliBarrio'),
    direccion: g('cliDir'),
    mapa:      g('cliMapa'),
    notas:     g('cliNotas')
  });

  if (!cliEnEdicion.nombre) { toast('Falta el nombre', true); return; }

  const btn = document.getElementById('btnGuardarCli');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    const guardado = await API.guardarCliente(cliEnEdicion);
    const id = guardado?.id || cliEnEdicion.id;
    cliEnEdicion.id = id;

    const i = CLIENTES.findIndex(c => c.id === id);
    if (i >= 0) CLIENTES[i] = cliEnEdicion; else CLIENTES.push(cliEnEdicion);

    toast('Cliente guardado');
    cerrarModalCliente();
    pintarClientes();
  } catch (err) {
    toast('No se pudo guardar: ' + err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

async function eliminarCliente() {
  if (!cliEnEdicion?.id) return;

  // Un cliente con pedidos no se borra: esos pedidos quedarían huérfanos.
  const conPedidos = PEDIDOS.filter(p => p.clienteId === cliEnEdicion.id).length;
  if (conPedidos) {
    alert(`No se puede eliminar: ${cliEnEdicion.nombre} tiene ${conPedidos} pedido(s) cargado(s).`);
    return;
  }
  if (!confirm(`¿Eliminar a ${cliEnEdicion.nombre}?`)) return;

  try {
    await API.eliminarCliente(cliEnEdicion.id);
    CLIENTES = CLIENTES.filter(c => c.id !== cliEnEdicion.id);
    toast('Cliente eliminado');
    cerrarModalCliente();
    pintarClientes();
  } catch (err) {
    toast('No se pudo eliminar: ' + err.message, true);
  }
}

// Al elegir un cliente en un pedido se copian sus datos a los campos, que
// quedan editables: sirven de valor por defecto, no de atadura.
// Los datos de contacto no se editan desde el pedido: se copian de la ficha
// del cliente y quedan de solo lectura. Si hay que corregir algo se hace en
// Clientes, y así el dato no queda distinto en cada pedido.
function elegirCliente() {
  const id = Number(document.getElementById('fClienteSel').value);
  const c = CLIENTES.find(x => x.id === id);

  document.getElementById('fTel').value    = c ? (c.telefono || '')  : '';
  document.getElementById('fDir').value    = c ? (c.direccion || '') : '';
  document.getElementById('fBarrio').value = c ? (c.barrio || '')    : '';
  if (edicion) edicion.mapa = c ? (c.mapa || '') : '';
  actualizarBotonMapa();
}

function actualizarBotonMapa() {
  const btn = document.getElementById('btnMapa');
  const url = edicion?.mapa;
  btn.hidden = !url;
  if (url) btn.href = url;

  // El aviso de "esto se edita en Clientes" solo tiene sentido cuando hay
  // un cliente elegido.
  const aviso = document.getElementById('avisoCliente');
  if (aviso) aviso.hidden = !Number(document.getElementById('fClienteSel').value);
}

// Abre la ficha del cliente del pedido que se está editando, para corregir
// sus datos sin perder de vista de dónde se venía.
function irAFichaCliente() {
  const id = Number(document.getElementById('fClienteSel').value);
  if (!id) return;
  irASeccion('clientes');
  editarCliente(id);
}

function llenarSelectorClientes(seleccionado) {
  const sel = document.getElementById('fClienteSel');
  const ordenados = CLIENTES
    .filter(c => (c.canal || 'b2c') === (edicion?.canal || CANAL))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  sel.innerHTML = '<option value="">— Elegir cliente —</option>' +
    ordenados.map(c => `<option value="${c.id}">${esc(c.nombre)}${c.barrio ? ` · ${esc(c.barrio)}` : ''}</option>`).join('');
  sel.value = seleccionado || '';
}

/* ══════════════ EDITOR ══════════════ */

function nuevoPedido() {
  // Sin Id: lo asigna el servidor al guardar.
  edicion = {
    id: null,
    canal: CANAL,
    fechaPedido: hoyISO(),
    fechaEntrega: '',
    clienteId: null, cliente: '', telefono: '', direccion: '', barrio: '', mapa: '',
    estado: 'Nuevo',
    medioPago: 'Efectivo',
    pedidoAlCosto: false,
    envio: null, envioModo: 'automatico',
    codigoPromo: '', porcentajeCodigo: 0, descuentoCodigo: 0,
    extras: 0, descExtras: '', notas: '',
    items: []
  };
  abrirEditor(true);
}

function abrirPedido(id) {
  const p = PEDIDOS.find(x => x.id === id);
  if (!p) return;
  // Copia profunda: si el usuario se arrepiente y vuelve, el original
  // queda intacto.
  edicion = JSON.parse(JSON.stringify(p));
  // Los pedidos guardados conservan el importe (o vacío histórico) con el
  // que fueron registrados; abrirlos nunca vuelve a aplicar una regla nueva.
  edicion.envioModo = 'historico';
  abrirEditor(false);
}

function abrirEditor(esNuevo) {
  document.getElementById('vistaLista').hidden = true;
  document.getElementById('vistaClientes').hidden = true;
  document.getElementById('vistaProveedores').hidden = true;
  document.getElementById('vistaInventario').hidden = true;
  document.getElementById('vistaEditor').hidden = false;
  document.getElementById('btnEliminar').hidden = esNuevo;

  document.getElementById('edTitulo').textContent =
    esNuevo ? `Nuevo pedido · ${edicion.canal.toUpperCase()}`
            : `Pedido #${edicion.id} · ${edicion.canal.toUpperCase()}`;

  const v = (id, val) => { document.getElementById(id).value = val ?? ''; };
  v('fPedido', fechaISO(edicion.fechaPedido));
  v('fEntrega', fechaISO(edicion.fechaEntrega));
  v('fEstadoPedido', edicion.estado);
  llenarSelectorClientes(edicion.clienteId);
  v('fTel', edicion.telefono);
  v('fDir', edicion.direccion);
  v('fBarrio', edicion.barrio);
  actualizarBotonMapa();
  v('fMedioPago', edicion.medioPago);
  document.getElementById('fPedidoAlCosto').checked = esPedidoAlCosto(edicion);
  v('fEnvio', edicion.envio);
  v('fCodigoPromo', edicion.codigoPromo || '');
  v('fExtras', edicion.extras || 0);
  v('fDescExtras', edicion.descExtras);
  v('fNotas', edicion.notas);

  document.getElementById('buscarProd').value = '';
  document.getElementById('sugerencias').innerHTML = '';
  sugerencias = []; sugSel = -1;

  pintarItems();
}

function leerCampos() {
  const g = id => document.getElementById(id).value;
  const cli = CLIENTES.find(c => c.id === Number(g('fClienteSel')));
  Object.assign(edicion, {
    fechaPedido:  fechaISO(g('fPedido')),
    fechaEntrega: fechaISO(g('fEntrega')),
    estado:       g('fEstadoPedido'),
    clienteId:    Number(g('fClienteSel')) || null,
    // Los datos del cliente se copian al pedido: si mañana se corrige la
    // ficha, los pedidos viejos conservan a quién y adónde se entregó.
    cliente:      cli?.nombre    || '',
    telefono:     cli?.telefono  || '',
    direccion:    cli?.direccion || '',
    barrio:       cli?.barrio    || '',
    mapa:         cli?.mapa      || '',
    medioPago:    g('fMedioPago'),
    pedidoAlCosto: edicion.canal === 'b2c' && document.getElementById('fPedidoAlCosto').checked,
    envio:        MenosVueltasAdminShipping.serializeShipping(g('fEnvio')),
    extras:       Number(g('fExtras')) || 0,
    descExtras:   g('fDescExtras').trim(),
    notas:        g('fNotas').trim()
  });
}


/* ══════════════ BUSCADOR DE PRODUCTOS ══════════════ */

function buscarProducto() {
  const q = document.getElementById('buscarProd').value.trim().toLowerCase();
  sugSel = -1;
  const cont = document.getElementById('sugerencias');

  if (q.length < 2) { cont.innerHTML = ''; sugerencias = []; return; }

  // Se buscan todas las palabras sueltas, en cualquier orden: así
  // "aceite natura" encuentra "Aceite Girasol NATURA 3000 cc".
  // Ambos lados se normalizan sin tildes para que "yerba" encuentre
  // "Yerba", "jugo" encuentre "Jugo" aunque en el catálogo tenga tilde.
  const palabras = sinAcentos(q).split(/\s+/);
  sugerencias = CATALOGO[edicion.canal]
    .filter(p => {
      const texto = sinAcentos(`${p.n} ${p.m}`).toLowerCase();
      return palabras.every(w => texto.includes(w));
    })
    .slice(0, 8);

  if (!sugerencias.length) {
    cont.innerHTML = `<div class="sug-item"><span class="sug-nombre" style="color:var(--t3)">Sin resultados</span></div>`;
    return;
  }

  const precioSugerido = valor => edicion.canal === 'b2c'
    ? money(redondearPrecioB2C(valor))
    : esc(valor);

  cont.innerHTML = sugerencias.map((p, i) => `
    <div class="sug-item" onclick="agregarProducto('${p.id}')" onmouseenter="sugSel=${i};marcarSugerencia()">
      <span class="sug-nombre">${esc(p.n)}</span>
      ${parseInt(p.ud, 10) > 0 ? `<span class="sug-dto">${p.ud}+ → ${precioSugerido(p.pd)}</span>` : ''}
      ${p.pct ? `<span class="sug-promo">${esc(etiquetaPromo(p.pct))}</span>` : ''}
      <span class="sug-precio">${precioSugerido(p.pp || p.pv)}</span>
    </div>`).join('');
}

function marcarSugerencia() {
  [...document.getElementById('sugerencias').children]
    .forEach((el, i) => el.classList.toggle('sel', i === sugSel));
}

function navegarSugerencias(e) {
  if (!sugerencias.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); sugSel = Math.min(sugSel + 1, sugerencias.length - 1); marcarSugerencia(); }
  if (e.key === 'ArrowUp')   { e.preventDefault(); sugSel = Math.max(sugSel - 1, 0); marcarSugerencia(); }
  if (e.key === 'Enter')     { e.preventDefault(); agregarProducto(sugerencias[Math.max(0, sugSel)].id); }
  if (e.key === 'Escape')    { document.getElementById('sugerencias').innerHTML = ''; sugerencias = []; }
}

function agregarProducto(id) {
  const prod = CATALOGO[edicion.canal].find(p => p.id === id);
  if (!prod) return;

  // Si ya está en el pedido, suma una unidad en vez de duplicar la fila.
  const existente = edicion.items.find(l => l.id === id);
  if (existente) existente.cant++;
  else edicion.items.push(lineaDesdeCatalogo(prod, 1, edicion.canal));

  const input = document.getElementById('buscarProd');
  input.value = '';
  document.getElementById('sugerencias').innerHTML = '';
  sugerencias = []; sugSel = -1;
  input.focus();

  pintarItems();
}

function cambiarCantidad(i, valor) {
  edicion.items[i].cant = Math.max(1, parseInt(valor, 10) || 1);
  pintarItems();
}

function quitarItem(i) {
  edicion.items.splice(i, 1);
  pintarItems();
}


/* ══════════════ RENDER DEL EDITOR ══════════════ */

function pintarItems() {
  const unidades = edicion.items.reduce((s, l) => s + (l.cant || 0), 0);
  const pedido = calcularPedido(edicion);
  document.getElementById('chipItems').textContent =
    `${unidades} ${unidades === 1 ? 'item' : 'items'}`;
  document.getElementById('sinItems').hidden = edicion.items.length > 0;

  document.getElementById('tbodyItems').innerHTML = edicion.items.map((l, i) => {
    const alCosto = esPedidoAlCosto(edicion);
    const c = calcularLinea(l, alCosto);
    const codigo = pedido.promotionLines[i] || {
      discount: 0,
      discountedTotal: c.total
    };
    const descuento = c.descuento + codigo.discount;
    const ganancia = codigo.discountedTotal - c.costoTot;
    const chips = alCosto ? [] : chipsDescuento(l, l.cantMin > 0 && l.cant >= l.cantMin);
    if (codigo.discount > 0) {
      chips.push({ texto: `Código ${pedido.porcentajeCodigo}%`, clase: 'chip-dto--codigo' });
    }
    const total = codigo.discount > 0
      ? `<span class="item-total-con-codigo"><s>${money(c.total)}</s><b>${money(codigo.discountedTotal)}</b></span>`
      : `<b>${money(codigo.discountedTotal)}</b>`;
    return `<tr>
      <td>
        <div class="item-nombre">${esc(l.nombre)}</div>
        <div class="item-meta">Costo ${money(l.costo)}${l.cantMin ? ` · desde ${l.cantMin} un. ${money(l.porCant)}` : ''}</div>
      </td>
      <td class="num">
        <input type="number" min="1" value="${l.cant}"
               oninput="cambiarCantidad(${i}, this.value)"
               onfocus="this.select()">
      </td>
      <td class="num">${money(c.unit)}</td>
      <td class="num">${money(c.subtotal)}</td>
      <td class="num">${descuento ? '−' + money(descuento) : '—'}</td>
      <td>${chipsHTML(chips)}</td>
      <td class="num">${total}</td>
      <td class="num"><span class="ganancia${ganancia < 0 ? ' ganancia--neg' : ''}">${money(ganancia)}</span></td>
      <td>
        <button class="quitar" onclick="quitarItem(${i})" aria-label="Quitar producto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4h6v3"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');

  // El resumen también lee Extras del formulario; lo recalculamos desde el
  // estado actual para no conservar un total anterior a la última edición.
  recalcular();
}

function cambiarPedidoAlCosto(activado) {
  if (!edicion || edicion.canal !== 'b2c') return;
  edicion.pedidoAlCosto = activado;
  if (activado) {
    edicion.codigoPromo = '';
    edicion.porcentajeCodigo = 0;
    edicion.descuentoCodigo = 0;
    edicion.extras = 0;
    edicion.descExtras = '';
    edicion.envio = 0;
    document.getElementById('fCodigoPromo').value = '';
    document.getElementById('fExtras').value = 0;
    document.getElementById('fDescExtras').value = '';
  }
  pintarItems();
}

function editarEnvioManual() {
  if (!edicion || edicion.canal !== 'b2c') return;
  edicion.envioModo = 'fijado';
  edicion.envio = MenosVueltasAdminShipping.serializeShipping(document.getElementById('fEnvio').value);
  recalcular();
}

function restablecerEnvioRegla() {
  if (!edicion || edicion.canal !== 'b2c') return;
  edicion.envioModo = 'automatico';
  recalcular();
}

function actualizarCampoCodigoPromo(t) {
  const input = document.getElementById('fCodigoPromo');
  const validar = document.getElementById('btnValidarCodigoPromo');
  const quitar = document.getElementById('btnQuitarCodigoPromo');
  const aviso = document.getElementById('avisoCodigoPromo');
  if (!input || !validar || !quitar || !aviso) return;

  const esB2C = edicion.canal === 'b2c';
  const alCosto = esPedidoAlCosto(edicion);
  input.disabled = !esB2C || alCosto;
  validar.hidden = !esB2C || alCosto;
  quitar.hidden = !esB2C || alCosto || !edicion.codigoPromo;
  if (!esB2C) {
    input.value = '';
    input.placeholder = 'No aplica a B2B';
    aviso.textContent = 'Los códigos promocionales se gestionan sólo para B2C.';
    return;
  }

  if (alCosto) {
    input.value = '';
    input.placeholder = 'No aplica a pedidos al costo';
    aviso.textContent = 'Los pedidos al costo no aplican códigos ni promociones.';
    return;
  }

  input.placeholder = '';
  input.value = edicion.codigoPromo || input.value;
  aviso.textContent = edicion.codigoPromo
    ? `${t.porcentajeCodigo}% aplicado sobre ${money(t.elegibleCodigo)} de productos elegibles. Confirmar primera compra manualmente.`
    : 'Validalo contra Sheets antes de guardar el pedido.';
}

function normalizarCodigoPromo(valor) {
  return String(valor || '').trim().toUpperCase();
}

async function validarCodigoPromoEditor() {
  if (!edicion || edicion.canal !== 'b2c') return;
  const input = document.getElementById('fCodigoPromo');
  const boton = document.getElementById('btnValidarCodigoPromo');
  const codigo = normalizarCodigoPromo(input.value);
  if (!codigo) { toast('Ingresá un código promocional.', true); return; }

  boton.disabled = true;
  try {
    const respuesta = await API.validarCodigo(codigo, 'b2c');
    const promocion = respuesta.promocion;
    edicion.codigoPromo = normalizarCodigoPromo(promocion.codigo);
    edicion.porcentajeCodigo = Number(promocion.porcentaje);
    edicion.descuentoCodigo = 0;
    pintarItems();
    toast(`Código ${edicion.codigoPromo} validado.`);
  } catch (error) {
    toast(error.message || 'No se pudo validar el código.', true);
  } finally {
    boton.disabled = false;
  }
}

function quitarCodigoPromoEditor() {
  if (!edicion) return;
  edicion.codigoPromo = '';
  edicion.porcentajeCodigo = 0;
  edicion.descuentoCodigo = 0;
  document.getElementById('fCodigoPromo').value = '';
  pintarItems();
  toast('Código promocional quitado.');
}

function actualizarCampoEnvio(envio) {
  const input = document.getElementById('fEnvio');
  const boton = document.getElementById('btnRestablecerEnvio');
  const aviso = document.getElementById('avisoEnvio');
  const esB2C = edicion.canal === 'b2c';

  const alCosto = esPedidoAlCosto(edicion);
  input.disabled = !esB2C || alCosto;
  const modo = modoEnvioPedido(edicion);
  boton.hidden = !esB2C || alCosto || modo !== 'fijado';
  if (!esB2C) {
    input.value = '';
    input.placeholder = 'No aplica a B2B';
    aviso.textContent = 'B2B no tiene una política de envío definida.';
    return;
  }

  if (alCosto) {
    input.value = 0;
    aviso.textContent = 'Los pedidos al costo no cobran envío.';
    return;
  }

  input.placeholder = 'A confirmar';
  input.value = envio == null ? '' : envio;
  if (modo === 'historico') {
    aviso.textContent = edicion.envio == null
      ? 'Pedido histórico sin envío registrado; se contabiliza como $0.'
      : 'Importe histórico guardado para este pedido.';
  } else if (modo === 'fijado') {
    aviso.textContent = envio == null
      ? 'Envío a confirmar. Este valor queda fijado para este pedido.'
      : 'Valor manual fijado para este pedido.';
  } else {
    aviso.textContent = envio === 0
      ? 'Envío gratis por superar $35.000 netos en productos.'
      : 'Regla B2C automática: $1.500 dentro de la cobertura vigente.';
  }
}

function recalcular(totales) {
  if (!edicion) return;
  const alCosto = esPedidoAlCosto(edicion);
  edicion.extras = alCosto ? 0 : Number(document.getElementById('fExtras').value) || 0;
  actualizarCamposPedidoAlCosto(alCosto);
  const t = totales || calcularPedido(edicion);
  if (modoEnvioPedido(edicion) === 'automatico' && edicion.canal === 'b2c') edicion.envio = t.envio;
  actualizarCampoEnvio(t.envio);

  document.getElementById('rSub').textContent = money(t.subtotal);

  const filaPromo = document.getElementById('rPromoFila');
  filaPromo.hidden = !t.dtoPromo;
  document.getElementById('rPromo').textContent = '−' + money(t.dtoPromo);

  const filaCant = document.getElementById('rDtoFila');
  filaCant.hidden = !t.dtoCantidad;
  document.getElementById('rDto').textContent = '−' + money(t.dtoCantidad);

  const filaCodigo = document.getElementById('rCodigoPromoFila');
  filaCodigo.hidden = !t.descuentoCodigo;
  document.getElementById('rCodigoPromo').textContent = '−' + money(t.descuentoCodigo);
  document.getElementById('rCodigoPromoLabel').textContent =
    t.codigoPromo ? `Código ${t.codigoPromo} (${t.porcentajeCodigo}%)` : 'Código promocional';
  actualizarCampoCodigoPromo(t);
  // Envío se muestra como campo editable para no mezclarlo con Extras.
  document.getElementById('rTot').textContent = money(t.total);
  document.getElementById('rCos').textContent = money(t.costo);
  document.getElementById('rGan').textContent = money(t.ganancia);
  document.getElementById('rMar').textContent = t.total ? t.margen.toFixed(1) + '%' : '—';
  document.getElementById('rGanBox').classList.toggle('neg', t.ganancia < 0);
}

function actualizarCamposPedidoAlCosto(alCosto) {
  const caja = document.getElementById('fPedidoAlCostoBox');
  const check = document.getElementById('fPedidoAlCosto');
  const extras = document.getElementById('fExtras');
  const descExtras = document.getElementById('fDescExtras');
  const esB2C = edicion.canal === 'b2c';
  caja.hidden = !esB2C;
  check.checked = alCosto;
  extras.disabled = alCosto;
  descExtras.disabled = alCosto;
  if (alCosto) {
    extras.value = 0;
    descExtras.value = '';
  }
}


/* ══════════════ ACCIONES ══════════════ */

async function guardarPedido() {
  if (guardando) return;
  leerCampos();

  if (!edicion.items.length) { toast('Agregá al menos un producto', true); return; }
  if (!edicion.clienteId)    { toast('Elegí un cliente', true); return; }

  guardando = true;
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    const pedidoParaGuardar = paraGuardar(edicion);
    const guardado = await API.guardar(pedidoParaGuardar);
    // El servidor devuelve el Id definitivo y los snapshots de cada línea.
    const actualizados = actualizarPedidoTrasGuardado(PEDIDOS, edicion, guardado, pedidoParaGuardar);
    edicion = actualizados.edicion;
    PEDIDOS = actualizados.pedidos;
    const id = edicion.id;

    localStorage.removeItem(BORRADOR_KEY);
    toast(`Pedido #${id} guardado`);
    verLista();
  } catch (e) {
    // Si el guardado falla NO se pierde el trabajo: el pedido queda en el
    // navegador y se ofrece recuperarlo al volver a entrar.
    localStorage.setItem(BORRADOR_KEY, JSON.stringify(edicion));
    mostrarErrorGuardado(e.message);
  } finally {
    guardando = false;
    btn.disabled = false;
    btn.textContent = 'Guardar pedido';
  }
}

async function eliminarPedido() {
  if (!edicion || !edicion.id) return;
  if (!confirm(`¿Eliminar el pedido #${edicion.id}? No se puede deshacer.`)) return;

  try {
    await API.eliminar(edicion.id);
    PEDIDOS = PEDIDOS.filter(p => p.id !== edicion.id);
    toast(`Pedido #${edicion.id} eliminado`);
    verLista();
  } catch (e) {
    toast('No se pudo eliminar: ' + e.message, true);
  }
}

// El toast dura tres segundos y se va: para un fallo de guardado hace falta
// algo que se quede en pantalla y explique cómo resolverlo.
function mostrarErrorGuardado(motivo) {
  document.getElementById('errorGuardadoTxt').textContent = motivo;
  document.getElementById('errorGuardado').hidden = false;
  document.getElementById('errorGuardado').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cerrarErrorGuardado() {
  document.getElementById('errorGuardado').hidden = true;
}

// Al abrir el panel, si quedó un pedido sin guardar de la vez anterior se
// ofrece retomarlo en vez de dejarlo perdido en el navegador.
function recuperarBorrador() {
  let b;
  try {
    b = JSON.parse(localStorage.getItem(BORRADOR_KEY) || 'null');
  } catch (e) { return; }
  if (!b || !b.items?.length) return;

  const quien = b.cliente ? ` de ${b.cliente}` : '';
  if (confirm(`Quedó un pedido sin guardar${quien} con ${b.items.length} producto(s). ¿Querés retomarlo?`)) {
    // Se cambia el canal a mano en vez de llamar a setCanal(): esa función
    // vuelve a la lista y limpia la edición, borrando lo que se recuperó.
    CANAL = b.canal || CANAL;
    document.getElementById('canalB2C').classList.toggle('on', CANAL === 'b2c');
    document.getElementById('canalB2B').classList.toggle('on', CANAL === 'b2b');
    edicion = b;
    abrirEditor(!b.id);
  } else {
    localStorage.removeItem(BORRADOR_KEY);
  }
}


/* ══════════════ LISTAS DE ABASTECIMIENTO ══════════════ */
let listasAbastecimientoActuales = [];

function abrirListasAbastecimiento() {
  // La vista se recalcula desde los snapshots activos al abrirse: no conserva
  // selecciones ni realiza lecturas de stock, catálogo o movimientos.
  listasAbastecimientoActuales = construirListasAbastecimiento(PEDIDOS);
  const contenedor = document.getElementById('distWorklists');
  if (!listasAbastecimientoActuales.length) {
    contenedor.innerHTML = '<p class="vacio">No hay líneas activas contra pedido con snapshot completo.</p>';
  } else {
    contenedor.innerHTML = listasAbastecimientoActuales.map((lista, indice) => `
      <section class="dist-seccion" data-worklist="${indice}">
        <h3 class="dist-subtit">${esc(lista.idProveedor)} · ${esc(lista.canal.toUpperCase())} · ${esc(lista.modalidadAbastecimiento)}</h3>
        <div class="tabla-wrap">
          <table class="tabla">
            <thead><tr><th>Producto</th><th class="num">Cantidad</th></tr></thead>
            <tbody>${lista.productos.map(producto => `<tr><td>${esc(producto.nombre)}</td><td class="num">${producto.cantidad}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="modal-acciones">
          <button type="button" class="btn btn--pri" onclick="copiarListaAbastecimiento(${indice})">Copiar lista</button>
        </div>
      </section>`).join('');
  }
  document.getElementById('modalDistribuidora').hidden = false;
}

function cerrarModalDistribuidora() {
  document.getElementById('modalDistribuidora').hidden = true;
}

async function copiarListaAbastecimiento(indice) {
  const lista = listasAbastecimientoActuales[indice];
  if (!lista) return;
  // Distrosec conserva el formato de copia histórico, pero siempre como
  // proyección de su grupo y su canal, nunca como una ruta agregada aparte.
  const paraCopiar = textoOperativo(lista.idProveedor).toUpperCase() === 'DISTROSEC'
    ? proyeccionListaDistrosec(listasAbastecimientoActuales, lista.canal)
    : lista;
  const texto = textoListaAbastecimiento(paraCopiar);

  try {
    await navigator.clipboard.writeText(texto);
    toast('Lista copiada al portapapeles, lista para pegar en WhatsApp.');
  } catch (e) {
    // Fallback si el navegador no deja copiar
    prompt('Copia la lista seleccionando todo el texto:', texto);
  }
}



/* ══════════════ IMPORTAR DESDE WHATSAPP ══════════════ */

// Estado de la importación mientras está abierto el modal
let waParse = null; // { items: [{nombreOriginal, cant, variante, precioMsg?, matchId, score}], totalMsg }

function abrirImportarWA() {
  if (!edicion) {
    toast('Primero abrí o creá un pedido.', true);
    return;
  }
  document.getElementById('waTexto').value = '';
  document.getElementById('waPasoResultados').hidden = true;
  document.getElementById('waTexto').focus();
  document.getElementById('modalImportarWA').hidden = false;
}

function cerrarImportarWA() {
  document.getElementById('modalImportarWA').hidden = true;
  waParse = null;
}

function limpiarImportarWA() {
  document.getElementById('waPasoResultados').hidden = true;
  document.getElementById('waTexto').value = '';
  document.getElementById('waTexto').focus();
}

/**
 * Limpia el formato que WhatsApp agrega al copiar un mensaje con el botón
 * "Copiar" del celu o de la compu. El markdown que WhatsApp usa es:
 *   *negrita*   _itálica_   ~tachado~   `monoespacio`   ```bloque```
 * Cuando el mensaje tiene esos estilos, al copiarlo vienen los asteriscos/
 * guiones bajos/tiles/backticks pegados alrededor de las palabras. Si no
 * los sacamos, la regex de líneas numeradas no reconoce "1. *Producto*" ni
 * "*Cantidad:* 2" y el match contra el catálogo se rompe.
 *
 * También limpia otros artefactos del portapapeles: espacios no separables,
 * zero-width, prefijos de cita (>) que WhatsApp agrega al reenviar, BOM, etc.
 */
function limpiarMarkdownWA(texto) {
  if (!texto) return '';
  let t = String(texto);

  // Normalizar saltos de línea (Windows/CRLF → LF) y quitar BOM/zero-width.
  t = t.replace(/\r\n?/g, '\n')
       .replace(/^\uFEFF/, '')
       // zero-width space/joiner/non-joiner/BOM left-to-right/right-to-left marks
       .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
       // Espacio no separable (nbsp) → espacio normal
       .replace(/\u00A0/g, ' ');

  // Quitar prefijos de cita de WhatsApp "> " al comienzo de cada línea
  // (aparecen al copiar mensajes reenviados o con respuesta). Acepta
  // cualquier espacio después del > (incluido el nbsp \u00A0 que a veces
  // pone WhatsApp Web).
  t = t.split('\n').map(ln => ln.replace(/^>[\s\u00A0]?/, '')).join('\n');

  // Desenvolver markdown de WhatsApp. Los marcadores van "pegados" al texto
  // (no puede haber espacio entre el * y la primera letra), así que la regex
  // no se come asteriscos sueltos en medio de una oración. Se hace en varias
  // pasadas para capturar los casos anidados (ej. "*1.* *Nombre*") y los
  // marcadores triples de ```código``` que también llegan a veces.
  const limpiar = (re) => {
    let antes;
    do {
      antes = t;
      t = t.replace(re, '$1');
    } while (t !== antes);
  };
  // ```bloque``` monoespacio (triple backtick)
  limpiar(/```([^`\n]+)```/g);
  // `mono`
  limpiar(/`([^`\n]+)`/g);
  // **negrita** (WA usa uno solo, pero por las dudas también el doble)
  limpiar(/\*\*([^*\n]+)\*\*/g);
  // *negrita* — no acepta espacios inmediatos al * para no borrar asteriscos
  // que estén separados del texto ("hola * cómo andas").
  limpiar(/\*([^*\n]+?)\*/g);
  // _itálica_
  limpiar(/_([^_\n]+?)_/g);
  // ~tachado~
  limpiar(/~([^~\n]+?)~/g);

  // Colapsar espacios múltiples y limpiar cada línea.
  t = t.split('\n').map(ln => ln.replace(/[ \t]+/g, ' ').trim()).join('\n');

  return t;
}

/**
 * Extrae items numerados del mensaje de WhatsApp con regex.
 * Soporta mensajes crudos (con formato de WhatsApp) porque primero pasa por
 * limpiarMarkdownWA(), que quita asteriscos/guiones/backticks de negrita,
 * itálica, tachado y monoespacio.
 *
 * Formato esperado (luego de limpiar):
 *    1. MARCA Producto
 *       Variante: X
 *       Cantidad: N unidades
 *       ... (opcional Precio unit./Subtotal/otros)
 */
function parsearMensajeWAPorLineas(texto) {
  const limpio = limpiarMarkdownWA(texto);
  const lineas = limpio.split('\n').map(l => l.trimEnd());
  const items = [];
  // Buscar líneas que empiecen con número seguido de punto (1., 2., etc.)
  // Tolerante a un punto/círculo/guion inicial que a veces agrega WA al copiar
  // listas con viñetas (●, •, -, etc.), y a paréntesis "1)" en vez de "1.".
  const headerRe = /^(?:[•●\-]\s*)?(\d+)\s*[\.\)]\s+(.+)$/;
  let actual = null;
  for (const ln0 of lineas) {
    const ln = ln0.trim();
    if (!ln) continue;
    const m = ln.match(headerRe);
    if (m) {
      if (actual) items.push(actual);
      actual = {
        nro: parseInt(m[1], 10),
        nombre: m[2].trim(),
        variante: '',
        cant: 1
      };
      continue;
    }
    if (!actual) continue;
    // Labels aceptados: "Variante:", "Presentación:", "Tamaño:", "Formato:"
    // (a veces el generador de la app varía un poco). El two-point del
    // regex acepta dos puntos con o sin espacio, y el texto puede estar en
    // mayúscula o minúscula.
    const v = ln.match(/^(?:variante|presentaci[oó]n|tama[nñ]o|formato|sabor|modelo)\s*:?\s*(.+)$/i);
    if (v) { actual.variante = v[1].trim(); continue; }
    const c = ln.match(/^cant(?:idad)?\s*:?\s*(\d+)\s*(?:unid(?:ad)?es?|u\.?|x)?\s*$/i);
    if (c) { actual.cant = parseInt(c[1], 10) || 1; continue; }
    // Si es otra línea tipo "Precio unit.", "Subtotal:", "Total:", la ignoramos
    // (cae acá y no modifica el item).
  }
  if (actual) items.push(actual);

  // Parsear el total del mensaje: buscamos una línea que ARRANQUE con "TOTAL"
  // (o "Total") para no confundirla con "Subtotal". El dos puntos y el signo $
  // son opcionales. Trabajamos sobre el texto ya limpio de markdown.
  let totalMsg = null;
  const totalMatch = limpio.match(/(?:^|\n)\s*total\s*:?\s*\$?\s*([\d\.,]+)/i);
  if (totalMatch) totalMsg = num(totalMatch[1]);

  const tieneEnvioMsg = /(?:^|\n)\s*env[ií]o\s*:/i.test(limpio);
  const envioMsg = tieneEnvioMsg
    ? MenosVueltasAdminShipping.parseShippingFromMessage(limpio)
    : null;

  const codigoMatch = limpio.match(/(?:^|\n)\s*c[oó]digo promocional\s*:\s*([^\n(]+?)(?:\s*\(\s*([\d.,]+)\s*%\s*\))?\s*(?:\n|$)/i);
  const codigoPromo = codigoMatch ? normalizarCodigoPromo(codigoMatch[1]) : '';
  const porcentajeCodigo = codigoMatch && codigoMatch[2] ? num(codigoMatch[2]) : 0;

  return { items, totalMsg, envioMsg, tieneEnvioMsg, codigoPromo, porcentajeCodigo };
}

/**
 * Normaliza un string para matchear: minúsculas, sin tildes, sin unidades de tamaño
 * para que la comparación sea más robusta.
 */
function normalizarBusqueda(s) {
  return sinAcentos(String(s || '').toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Trigram similarity: robusto para comparar nombres aun con palabras invertidas
function trigramas(s) {
  const t = new Set();
  const pad = '  ' + s + '  ';
  for (let i = 0; i < pad.length - 2; i++) t.add(pad.slice(i, i+3));
  return t;
}
function similitud(a, b) {
  const ta = trigramas(a), tb = trigramas(b);
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size + tb.size - inter, 1);
}

/**
 * Busca el producto del catálogo que mejor matchea con el nombre+variante
 * del mensaje. Devuelve { id, score } donde score está entre 0 y 1.
 */
function buscarMejorMatch(nombre, variante) {
  const catalogo = CATALOGO[edicion.canal] || [];
  const buscar = normalizarBusqueda(nombre + ' ' + (variante || ''));
  if (!buscar) return { id: null, score: 0 };

  // Separar palabras de búsqueda para el primer filtro (rápido)
  const palabras = buscar.split(/\s+/).filter(p => p.length > 1);

  let mejor = { id: null, score: 0 };
  for (const p of catalogo) {
    const nomCat = normalizarBusqueda(p.n + ' ' + (p.m || ''));
    // Filtrado rápido: tiene que contener al menos la mitad de las palabras
    const presentes = palabras.filter(w => nomCat.includes(w)).length;
    if (presentes < Math.ceil(palabras.length * 0.5)) continue;
    const score = similitud(buscar, nomCat);
    if (score > mejor.score) mejor = { id: p.id, score };
  }
  return mejor;
}

function parsearPedidoWA() {
  const texto = document.getElementById('waTexto').value.trim();
  if (!texto) { toast('Pegá el mensaje del pedido antes.', true); return; }

  const { items, totalMsg, envioMsg, tieneEnvioMsg, codigoPromo, porcentajeCodigo } = parsearMensajeWAPorLineas(texto);

  if (!items.length) {
    toast('No se detectaron productos numerados en el mensaje. Asegurate de pegar el texto tal cual llega.', true);
    return;
  }

  // Matchear cada item contra el catálogo
  const resultados = [];
  for (const it of items) {
    const match = buscarMejorMatch(it.nombre, it.variante);
    resultados.push({
      nombreOriginal: it.nombre + (it.variante ? ' · ' + it.variante : ''),
      cant: it.cant,
      variante: it.variante,
      matchId: match.score >= 0.3 ? match.id : null,
      score: match.score
    });
  }

  waParse = { items: resultados, totalMsg, envioMsg, tieneEnvioMsg, codigoPromo, porcentajeCodigo };
  renderizarPreviewWA();
}

function renderizarPreviewWA() {
  const lista = document.getElementById('waLista');
  const catalogo = CATALOGO[edicion.canal] || [];
  const opcionesPorId = {};
  for (const p of catalogo) opcionesPorId[p.id] = p;

  let okCount = 0, warnCount = 0, failCount = 0;

  let html = '';
  waParse.items.forEach((it, i) => {
    const estado = it.matchId ? (it.score >= 0.5 ? 'ok' : 'warn') : 'fail';
    if (estado === 'ok') okCount++;
    else if (estado === 'warn') warnCount++;
    else failCount++;

    html += `<div class="wa-row ${estado}">
      <div class="wa-cant">×${it.cant}</div>
      <div class="wa-nombre">
        ${esc(it.nombreOriginal)}
        <small>Linea ${i+1} del mensaje</small>
      </div>
      <div class="wa-match">
        <span class="wa-badge ${estado}">${
          estado === 'ok' ? `Match ${Math.round(it.score*100)}%`
          : estado === 'warn' ? `Revisar ${Math.round(it.score*100)}%`
          : 'Sin match'
        }</span>
        <select onchange="waCambiarMatch(${i}, this.value)">
          <option value="">— Elegí un producto —</option>
          ${catalogo.map(p =>
            `<option value="${esc(p.id)}"${p.id === it.matchId ? ' selected' : ''}>${esc(p.n)}</option>`
          ).join('')}
        </select>
      </div>
    </div>`;
  });

  lista.innerHTML = html;

  // Leyenda con contadores
  let leyenda = [];
  if (okCount) leyenda.push(`<b style="color:#497b4a">${okCount} match${okCount===1?'':'es'} seguro${okCount===1?'':'s'}</b>`);
  if (warnCount) leyenda.push(`<b style="color:#c18c1f">${warnCount} para revisar</b>`);
  if (failCount) leyenda.push(`<b style="color:#c66">${failCount} sin match</b>`);
  document.getElementById('waLeyenda').innerHTML =
    `Se detectaron <b>${waParse.items.length}</b> productos. ` + leyenda.join(' · ') +
    `. Corregí los que hagan falta desde el desplegable.`;

  // Comparación de total
  const comp = document.getElementById('waComparacion');
  const filaDiff = document.getElementById('waFilaDiff');
  const btnConfirmar = document.getElementById('btnConfirmarWA');

  // Calcular el neto efectivo con lo matcheado. Se reutiliza calcularLinea()
  // para que promo y descuento por cantidad coincidan con el editor.
  let productosCalc = 0;
  const itemsParaEnvio = [];
  for (const it of waParse.items) {
    const p = it.matchId ? opcionesPorId[it.matchId] : null;
    if (!p) continue;
    const linea = lineaDesdeCatalogo(p, it.cant, edicion.canal);
    const calculada = calcularLinea(linea);
    productosCalc += calculada.total;
    itemsParaEnvio.push({ unitPrice: calculada.unit, quantity: it.cant });
  }

  const reglaEnvio = edicion.canal === 'b2c'
    ? MenosVueltasShipping.calculateShipping({ channel: 'B2C', items: itemsParaEnvio }).shippingCost
    : null;
  const envioParaComparar = waParse.tieneEnvioMsg ? waParse.envioMsg : reglaEnvio;
  const calc = envioParaComparar == null ? null :
    MenosVueltasAdminShipping.totalWithShipping({ productsTotal: productosCalc, shipping: envioParaComparar });
  const textoEnvio = valor => valor == null ? 'A confirmar' : valor === 0 ? 'GRATIS' : money(valor);

  document.getElementById('waEnvioMsg').textContent = waParse.tieneEnvioMsg ? textoEnvio(waParse.envioMsg) : '—';
  document.getElementById('waEnvioCalc').textContent = reglaEnvio == null ? 'No aplica' : textoEnvio(reglaEnvio);
  document.getElementById('waTotalMsg').textContent =
    waParse.totalMsg != null ? money(waParse.totalMsg) : '—';
  document.getElementById('waTotalCalc').textContent =
    calc != null && productosCalc > 0 ? money(calc) : 'A confirmar';

  if (waParse.totalMsg != null && calc != null && productosCalc > 0) {
    comp.hidden = false;
    filaDiff.hidden = false;
    const diff = calc - waParse.totalMsg;
    const diffPct = waParse.totalMsg > 0 ? (diff / waParse.totalMsg * 100) : 0;
    const el = document.getElementById('waDiff');
    const lbl = document.getElementById('waDiffLabel');
    if (Math.abs(diffPct) < 2) {
      el.textContent = '✓ Coincide';
      filaDiff.className = 'wa-fila wa-fila--diff ok';
    } else {
      const signo = diff >= 0 ? '+' : '';
      el.textContent = `${signo}${money(diff)} (${signo}${diffPct.toFixed(1)}%)`;
      filaDiff.className = 'wa-fila wa-fila--diff warn';
      lbl.textContent = 'Diferencia (revisar si hay descuentos/envio/cambios de precio)';
    }
  } else {
    comp.hidden = (waParse.totalMsg == null && productosCalc === 0 && !waParse.tieneEnvioMsg);
    filaDiff.hidden = true;
  }

  btnConfirmar.disabled = failCount > 0;
  btnConfirmar.title = failCount > 0 ? 'Hay productos sin matchear, elegilos del desplegable.' : '';

  document.getElementById('waPasoResultados').hidden = false;
}

function waCambiarMatch(i, nuevoId) {
  if (!waParse) return;
  const catalogo = CATALOGO[edicion.canal] || [];
  if (!nuevoId) {
    waParse.items[i].matchId = null;
    waParse.items[i].score = 0;
  } else {
    const prod = catalogo.find(p => p.id === nuevoId);
    if (!prod) return;
    // Recalcular score con el nuevo nombre para que la badge sea representativa
    const buscar = normalizarBusqueda(waParse.items[i].nombreOriginal);
    const nomCat = normalizarBusqueda(prod.n + ' ' + (prod.m || ''));
    waParse.items[i].matchId = nuevoId;
    waParse.items[i].score = similitud(buscar, nomCat);
  }
  renderizarPreviewWA();
}

async function confirmarImportarWA() {
  if (!waParse) return;
  const catalogo = CATALOGO[edicion.canal] || [];
  let agregados = 0, salteados = 0;

  for (const it of waParse.items) {
    const prod = catalogo.find(p => p.id === it.matchId);
    if (!prod) { salteados++; continue; }

    // Si ya existe en el pedido, sumar la cantidad (igual que agregarProducto)
    const existente = edicion.items.find(l => l.id === prod.id);
    if (existente) {
      existente.cant += it.cant;
    } else {
      edicion.items.push(lineaDesdeCatalogo(prod, it.cant, edicion.canal));
    }
    agregados++;
  }

  // El mensaje es una evidencia histórica: si informa envío, se fija para
  // este pedido en vez de reemplazarlo al cambiar productos o precios.
  if (edicion.canal === 'b2c' && waParse.tieneEnvioMsg) {
    edicion.envio = waParse.envioMsg;
    edicion.envioModo = 'fijado';
  }

  let avisoCodigo = '';
  if (edicion.canal === 'b2c' && waParse.codigoPromo) {
    try {
      const respuesta = await API.validarCodigo(waParse.codigoPromo, 'b2c');
      edicion.codigoPromo = normalizarCodigoPromo(respuesta.promocion.codigo);
      edicion.porcentajeCodigo = Number(respuesta.promocion.porcentaje);
      edicion.descuentoCodigo = 0;
    } catch (error) {
      edicion.codigoPromo = '';
      edicion.porcentajeCodigo = 0;
      edicion.descuentoCodigo = 0;
      avisoCodigo = ' El código promocional no está activo: revisalo antes de confirmarlo.';
    }
  }

  pintarItems();
  cerrarImportarWA();

  let msg = `Se agregaron ${agregados} productos al pedido.`;
  if (salteados) msg += ` (${salteados} salteados por falta de match)`;
  msg += avisoCodigo;
  toast(msg);
}
