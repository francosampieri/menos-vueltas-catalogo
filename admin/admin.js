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
function lineaDesdeCatalogo(prod, cantidad) {
  return {
    id:       prod.id,
    nombre:   prod.n,
    cant:     cantidad || 1,
    // Precios congelados. Se guardan los cuatro para poder recalcular el
    // pedido si cambia la cantidad, con los valores del día en que se cargó.
    lista:      num(prod.pv),                     // unitario sin promo
    promo:      num(prod.pp) || num(prod.pv),     // unitario con promo
    cantMin:    parseInt(prod.ud, 10) || 0,       // desde cuántas unidades
    porCant:    num(prod.pd),                     // por cantidad sin promo
    promoCant:  num(prod.ppd) || num(prod.pd),    // por cantidad con promo
    pct:        (prod.pct || '').trim(),          // "10%", para mostrar
    costo:      num(prod.co)
  };
}

// Precio que efectivamente se cobra por unidad, según la cantidad.
// Usa solo los valores congelados de la línea.
// Los dos descuentos se combinan: la promo temporal ya viene trasladada al
// precio por cantidad desde el Sheets (precio_promo_mayorista = ppd), así
// que al llegar al mínimo de unidades se cobra ese precio; si no, el de
// promo unitaria. Esta es exactamente la MISMA lógica que usa al agregar
// un producto nuevo: no puede haber diferencia entre crear y editar.
function precioUnitario(l) {
  const llegaAlMinimo = l.cantMin > 0 && l.cant >= l.cantMin;

  if (llegaAlMinimo) {
    // Caso normal: ppd (promoCant) existe y es el precio correcto con los
    // dos descuentos combinados.
    if (l.promoCant > 0) return l.promoCant;
    // DEFENSA: si por alguna razón la línea vino sin promoCant (pedido
    // viejo guardado antes que existiera ese campo, o dato que volvió
    // incompleto desde Sheets), pero SÍ tiene porCant y promo, estimamos
    // el ppd con la misma proporción del descuento unitario. Es mejor
    // eso que caer silenciosamente a porCant y cobrar de más.
    if (l.porCant > 0 && l.promo > 0 && l.lista > 0 && l.promo < l.lista) {
      const ratio = l.promo / l.lista;
      return Math.round(l.porCant * ratio * 100) / 100;
    }
    // Último recurso: precio por cantidad sin promo.
    if (l.porCant > 0) return l.porCant;
  }
  return l.promo > 0 ? l.promo : l.lista;
}

/* Las etiquetas de descuento las arma UNA sola función, que usan tanto el
   buscador de productos como la tabla de items del pedido. Antes cada uno
   armaba las suyas y se fueron separando: el buscador mostraba el porcentaje
   y la tabla la palabra "promo", y ninguno de los dos mostraba las dos
   rebajas a la vez cuando se editaba un pedido guardado.

   `pct` es la etiqueta del Sheets ("10%"). Puede faltar en pedidos guardados
   antes de que existiera esa columna, así que hay un texto de reserva. */
function etiquetaPromo(pct) {
  return (pct || '').trim() || 'Promo';
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

function calcularLinea(l) {
  const unit     = precioUnitario(l);
  const subtotal = l.cant * l.lista;   // siempre a precio de lista
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

function calcularPedido(p) {
  let subtotal = 0, total = 0, costo = 0, unidades = 0;
  let dtoPromo = 0, dtoCantidad = 0;

  (p.items || []).forEach(l => {
    const c = calcularLinea(l);
    subtotal += c.subtotal;
    total    += c.total;
    costo    += c.costoTot;
    unidades += l.cant || 0;

    // Se separan las dos rebajas para poder mostrarlas por su nombre.
    // Primero se descuenta lo que baja por cantidad (sobre precio de lista) y
    // después la promo sobre lo que quedaba: así los dos números suman exacto.
    const llegaAlMinimo = l.cantMin > 0 && l.cant >= l.cantMin && l.porCant > 0;
    const base = llegaAlMinimo ? l.porCant : l.lista;
    dtoCantidad += (l.lista - base) * l.cant;
    dtoPromo    += (base - c.unit) * l.cant;
  });

  const extras = Number(p.extras) || 0;
  const totalFinal = total + extras;

  return {
    subtotal,
    descuento: subtotal - total,
    dtoPromo,
    dtoCantidad,
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
  if (!d.ok) throw new Error(d.error || 'error del servidor');
  return d;
}

const API = {

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
  }
};

// Lo que viaja al servidor: el pedido más los totales ya resueltos, para
// que la planilla se lea sin fórmulas. El cálculo sigue viviendo en un
// solo lugar (acá), no duplicado en el script.
function paraGuardar(p) {
  const t = calcularPedido(p);
  return {
    ...p,
    totales: {
      subtotal:  Math.round(t.subtotal),
      descuento: Math.round(t.descuento),
      total:     Math.round(t.total),
      costo:     Math.round(t.costo),
      ganancia:  Math.round(t.ganancia)
    },
    items: p.items.map(l => {
      const c = calcularLinea(l);
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
  document.getElementById('navPedidos').classList.toggle('on', esPedidos);
  document.getElementById('navClientes').classList.toggle('on', !esPedidos);
  // El canal aplica a las dos secciones: los clientes B2C y B2B se manejan
  // por separado, no tienen nada que ver entre sí.

  document.getElementById('vistaClientes').hidden = esPedidos;
  document.getElementById('vistaLista').hidden = !esPedidos;
  document.getElementById('vistaEditor').hidden = true;

  if (esPedidos) pintarLista(); else pintarClientes();
}

function setCanal(canal) {
  CANAL = canal;
  document.getElementById('canalB2C').classList.toggle('on', canal === 'b2c');
  document.getElementById('canalB2B').classList.toggle('on', canal === 'b2b');
  // Se vuelve a la lista de la sección en la que se esté: cambiar de canal
  // no debería sacarte de Clientes.
  const enClientes = !document.getElementById('navClientes').classList.contains('on');
  if (enClientes) verLista(); else irASeccion('clientes');
}

function verLista() {
  document.getElementById('vistaLista').hidden = false;
  document.getElementById('vistaEditor').hidden = true;
  document.getElementById('vistaClientes').hidden = true;
  document.getElementById('navPedidos').classList.add('on');
  document.getElementById('navClientes').classList.remove('on');
  edicion = null;
  pintarLista();
}

function volverALista() { verLista(); }


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
      <td class="celda-cliente"><b>${esc(nombreMostrar) || '—'}</b>${telMostrar ? `<span>${esc(telMostrar)}</span>` : ''}</td>
      <td><span class="estado ${claseEstado}">${p.estado}</span></td>
      <td class="num">${t.unidades}</td>
      <td class="num"><b>${money(t.total)}</b></td>
      <td class="num"><span class="ganancia${t.ganancia < 0 ? ' ganancia--neg' : ''}">${money(t.ganancia)}</span></td>
    </tr>`;
  }).join('');
}

function pintarKpis(pedidos) {
  // El estado avanza en un solo sentido: Nuevo → Pedido a Distribuidora → Para entregar → Entregado.
  // Cancelados no se tienen en cuenta para facturado/ganancia.
  let facturado = 0, ganancia = 0;
  const pedidosActivos = pedidos.filter(p => p.estado !== 'Cancelado');
  pedidosActivos.forEach(p => {
    const t = calcularPedido(p);
    facturado += t.total;
    ganancia  += t.ganancia;
  });

  const pendientes = pedidos.filter(p => ['Nuevo', 'Pedido a Distribuidora', 'Para entregar'].includes(p.estado)).length;
  const margen = facturado ? ganancia / facturado * 100 : 0;
  const ticket = pedidosActivos.length ? facturado / pedidosActivos.length : 0;

  document.getElementById('kpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-l">Pedidos activos</div>
      <div class="kpi-v">${pendientes}</div>
      <div class="kpi-s">${pedidos.filter(p => p.estado === 'Entregado').length} entregados</div>
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
      <div class="kpi-v">${pedidos.filter(p => p.estado === 'Cancelado').length}</div>
      <div class="kpi-s">&nbsp;</div>
    </div>`;
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
  const resumen = {};
  PEDIDOS.forEach(p => {
    if (!p.clienteId) return;
    const r = resumen[p.clienteId] || (resumen[p.clienteId] = { n: 0, total: 0 });
    r.n++;
    r.total += calcularPedido(p).total;
  });

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

  // DEFENSA: pedidos creados antes de que el panel guardara el campo
  // promoCant (precio_promo_mayorista = precio x cantidad + promo
  // combinados) pueden haber quedado con esa clave en 0 aunque el
  // cálculo estuviera bien al momento de guardar. Si una línea tiene
  // un precio unitario ya calculado en la cantidad que alcanza el
  // mínimo, rellenamos promoCant con ese valor para que al recalcular
  // siga dando el mismo número correcto y no "salte" al precio equivocado.
  (edicion.items || []).forEach(l => {
    if (!l.cantMin || l.cant < l.cantMin) return;
    if (l.promoCant > 0) return;
    // Si la línea ya tiene un unit guardado (vino del Sheets con
    // totales calculados), tomamos ese como el precio correcto.
    if (l.unit && l.unit > 0) {
      l.promoCant = l.unit;
    }
  });

  abrirEditor(false);
}

function abrirEditor(esNuevo) {
  document.getElementById('vistaLista').hidden = true;
  document.getElementById('vistaClientes').hidden = true;
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

  cont.innerHTML = sugerencias.map((p, i) => `
    <div class="sug-item" onclick="agregarProducto('${p.id}')" onmouseenter="sugSel=${i};marcarSugerencia()">
      <span class="sug-nombre">${esc(p.n)}</span>
      ${parseInt(p.ud, 10) > 0 ? `<span class="sug-dto">${p.ud}+ → ${esc(p.pd)}</span>` : ''}
      ${p.pct ? `<span class="sug-promo">${esc(etiquetaPromo(p.pct))}</span>` : ''}
      <span class="sug-precio">${esc(p.pp || p.pv)}</span>
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
  else edicion.items.push(lineaDesdeCatalogo(prod, 1));

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
  document.getElementById('chipItems').textContent =
    `${unidades} ${unidades === 1 ? 'item' : 'items'}`;
  document.getElementById('sinItems').hidden = edicion.items.length > 0;

  document.getElementById('tbodyItems').innerHTML = edicion.items.map((l, i) => {
    const c = calcularLinea(l);
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
      <td class="num">${c.descuento ? '−' + money(c.descuento) : '—'}</td>
      <td>${chipsHTML(chipsDescuento(l, l.cantMin > 0 && l.cant >= l.cantMin))}</td>
      <td class="num"><b>${money(c.total)}</b></td>
      <td class="num"><span class="ganancia${c.ganancia < 0 ? ' ganancia--neg' : ''}">${money(c.ganancia)}</span></td>
      <td>
        <button class="quitar" onclick="quitarItem(${i})" aria-label="Quitar producto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4h6v3"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');

  recalcular();
}

function recalcular() {
  if (!edicion) return;
  edicion.extras = Number(document.getElementById('fExtras').value) || 0;
  const t = calcularPedido(edicion);

  document.getElementById('rSub').textContent = money(t.subtotal);

  const filaPromo = document.getElementById('rPromoFila');
  filaPromo.hidden = !t.dtoPromo;
  document.getElementById('rPromo').textContent = '−' + money(t.dtoPromo);

  const filaCant = document.getElementById('rDtoFila');
  filaCant.hidden = !t.dtoCantidad;
  document.getElementById('rDto').textContent = '−' + money(t.dtoCantidad);
  document.getElementById('rTot').textContent = money(t.total);
  document.getElementById('rCos').textContent = money(t.costo);
  document.getElementById('rGan').textContent = money(t.ganancia);
  document.getElementById('rMar').textContent = t.total ? t.margen.toFixed(1) + '%' : '—';
  document.getElementById('rGanBox').classList.toggle('neg', t.ganancia < 0);
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
    const guardado = await API.guardar(paraGuardar(edicion));
    // El servidor devuelve el pedido con su Id definitivo.
    const id = guardado?.id || edicion.id;
    edicion.id = id;

    const i = PEDIDOS.findIndex(p => p.id === id);
    if (i >= 0) PEDIDOS[i] = edicion; else PEDIDOS.push(edicion);

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


/* ══════════════ LISTA PARA DISTRIBUIDORA ══════════════ */
let pedidosSeleccionadosDist = new Set();

function abrirListaDistribuidora() {
  // Solo se pueden agregar pedidos activos (no cancelados ni ya entregados)
  const pedidosDisponibles = PEDIDOS
    .filter(p => p.canal === CANAL && !['Cancelado', 'Entregado'].includes(p.estado))
    .sort((a, b) => fechaISO(b.fechaPedido).localeCompare(fechaISO(a.fechaPedido)) || b.id - a.id);

  const contenedor = document.getElementById('distListaPedidos');
  if (!pedidosDisponibles.length) {
    contenedor.innerHTML = '<p class="vacio" style="padding: 16px">No hay pedidos activos para incluir.</p>';
  } else {
    contenedor.innerHTML = pedidosDisponibles.map(p => {
      const t = calcularPedido(p);
      return `<label class="dist-pedido-check" data-id="${p.id}">
        <input type="checkbox" onchange="togglePedidoDist(${p.id}, this.checked)">
        <div style="flex:1; min-width:0">
          <div class="dist-pedido-cliente">#${p.id} · ${esc(p.cliente) || 'Sin cliente'}</div>
          <div class="dist-pedido-meta">${fechaCorta(p.fechaPedido)} · ${t.unidades} unidades · ${money(t.total)}</div>
        </div>
      </label>`;
    }).join('');
  }

  pedidosSeleccionadosDist = new Set();
  actualizarListaDist();
  document.getElementById('modalDistribuidora').hidden = false;
}

function cerrarModalDistribuidora() {
  document.getElementById('modalDistribuidora').hidden = true;
}

function togglePedidoDist(id, checked) {
  const card = document.querySelector(`.dist-pedido-check[data-id="${id}"]`);
  if (checked) {
    pedidosSeleccionadosDist.add(id);
    card.classList.add('seleccionado');
  } else {
    pedidosSeleccionadosDist.delete(id);
    card.classList.remove('seleccionado');
  }
  actualizarListaDist();
}

function actualizarListaDist() {
  const tbody = document.getElementById('distTbodyProductos');
  const sinProductos = document.getElementById('distSinProductos');
  const resumen = document.getElementById('distResumen');
  const btnCopiar = document.getElementById('btnCopiarDist');

  const pedidosElegidos = [...pedidosSeleccionadosDist].map(id => PEDIDOS.find(p => p.id === id)).filter(Boolean);

  if (!pedidosElegidos.length) {
    tbody.innerHTML = '';
    sinProductos.hidden = false;
    resumen.hidden = true;
    btnCopiar.disabled = true;
    return;
  }

  sinProductos.hidden = true;
  resumen.hidden = false;
  btnCopiar.disabled = false;

  // Agrupar productos por id, sumar cantidades
  const productosAgrupados = {};
  let totalUnidades = 0, totalCosto = 0, totalVenta = 0;

  pedidosElegidos.forEach(p => {
    const t = calcularPedido(p);
    totalVenta += t.total;
    p.items.forEach(item => {
      totalUnidades += item.cant;
      totalCosto += item.cant * item.costo;
      if (!productosAgrupados[item.id]) {
        productosAgrupados[item.id] = {
          nombre: item.nombre,
          cantidad: 0,
          costoUnit: item.costo
        };
      }
      productosAgrupados[item.id].cantidad += item.cant;
    });
  });

  // Ordenar productos por nombre alfabeticamente
  const listaOrdenada = Object.values(productosAgrupados).sort((a,b) => a.nombre.localeCompare(b.nombre));

  tbody.innerHTML = listaOrdenada.map(prod => `
    <tr>
      <td>${esc(prod.nombre)}</td>
      <td class="num">${prod.cantidad}</td>
      <td class="num">${money(prod.costoUnit)}</td>
      <td class="num">${money(prod.cantidad * prod.costoUnit)}</td>
    </tr>
  `).join('');

  document.getElementById('distCantPedidos').textContent = pedidosElegidos.length;
  document.getElementById('distCantUnidades').textContent = totalUnidades;
  document.getElementById('distTotalCosto').textContent = money(totalCosto);
  document.getElementById('distTotalVenta').textContent = money(totalVenta);
  const ganancia = totalVenta - totalCosto;
  const elGanancia = document.getElementById('distGanancia');
  elGanancia.textContent = money(ganancia);
  elGanancia.parentElement.classList.toggle('neg', ganancia < 0);
}

async function copiarListaDistribuidora() {
  const pedidosElegidos = [...pedidosSeleccionadosDist].map(id => PEDIDOS.find(p => p.id === id)).filter(Boolean);
  const productosAgrupados = {};
  pedidosElegidos.forEach(p => {
    p.items.forEach(item => {
      if (!productosAgrupados[item.nombre]) productosAgrupados[item.nombre] = 0;
      productosAgrupados[item.nombre] += item.cant;
    });
  });

  const lineas = Object.entries(productosAgrupados)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .map(([nombre, cant]) => `- ${cant}x ${nombre}`);

  const texto = `🛒 Pedido (${pedidosElegidos.length} pedidos):\n` + lineas.join('\n');

  try {
    await navigator.clipboard.writeText(texto);
    toast('Lista copiada al portapapeles, lista para pegar en WhatsApp!');
  } catch (e) {
    // Fallback si el navegador no deja copiar
    prompt('Copia la lista seleccionando todo el texto:', texto);
  }
}

