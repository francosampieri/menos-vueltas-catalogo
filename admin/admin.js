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

// ── Conexión con el Sheets de pedidos ──
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwdeAOUpuvDXhna8B4UCGnh3eyl2Uy_69qdjiCz4sthAVdsvkPwhpSlUcE5e-h8yZhDIg/exec';

// ── Contraseña del panel ──
// Guardada como hash SHA-256 para no dejarla escrita en texto plano. Es una
// traba, no seguridad real: quien mire el código puede saltearla.
// Para cambiarla, ver SHEETS.md.
const PASS_HASH  = '13e3263aa26400d509d82c644c98ccc177c947624f3405d4676d1d2a1c192670'; // menosvueltas
const SESION_KEY = 'mv_admin_sesion';
const LS_KEY     = 'mv_pedidos_v2';


/* ══════════════ ESTADO ══════════════ */
let CANAL    = 'b2c';
let CATALOGO = { b2c: [], b2b: [] };
let PEDIDOS  = [];
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

function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function fechaCorta(iso) {
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
    // Precios congelados
    lista:    num(prod.pv),
    promo:    num(prod.pp) || num(prod.pv),
    cantMin:  parseInt(prod.ud, 10) || 0,
    porCant:  num(prod.pd),
    costo:    num(prod.co)
  };
}

// Precio que efectivamente se cobra por unidad, según la cantidad.
// Usa solo los valores congelados de la línea.
function precioUnitario(l) {
  const base = l.promo || l.lista;
  if (l.cantMin > 0 && l.cant >= l.cantMin && l.porCant > 0) {
    // Si hay una promo más agresiva que el precio por cantidad, gana la promo.
    return Math.min(l.porCant, base);
  }
  return base;
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
  };
}

function calcularPedido(p) {
  let subtotal = 0, total = 0, costo = 0, unidades = 0;

  (p.items || []).forEach(l => {
    const c = calcularLinea(l);
    subtotal += c.subtotal;
    total    += c.total;
    costo    += c.costoTot;
    unidades += l.cant || 0;
  });

  const extras = Number(p.extras) || 0;
  const totalFinal = total + extras;

  return {
    subtotal,
    descuento: subtotal - total,
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

const API = {

  async listar() {
    if (SHEETS_URL) {
      const r = await fetch(`${SHEETS_URL}?accion=listar`);
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'error al listar');
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
      const r = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'guardar', pedido })
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'error al guardar');
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
      const r = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'eliminar', id })
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'error al eliminar');
      return;
    }
    const lista = (await this.listar()).filter(p => p.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(lista));
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

  try {
    PEDIDOS = await API.listar();
  } catch (e) {
    PEDIDOS = [];
    toast('No se pudieron leer los pedidos', true);
  }

  verLista();
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

function setCanal(canal) {
  CANAL = canal;
  document.getElementById('canalB2C').classList.toggle('on', canal === 'b2c');
  document.getElementById('canalB2B').classList.toggle('on', canal === 'b2b');
  verLista();
}

function verLista() {
  document.getElementById('vistaLista').hidden = false;
  document.getElementById('vistaEditor').hidden = true;
  document.getElementById('tabLista').classList.add('on');
  document.getElementById('tabNuevo').classList.remove('on');
  edicion = null;
  pintarLista();
}

function volverALista() { verLista(); }


/* ══════════════ LISTA ══════════════ */

function pintarLista() {
  const q  = (document.getElementById('q').value || '').toLowerCase().trim();
  const fe = document.getElementById('filtroEstado').value;

  const delCanal = PEDIDOS.filter(p => p.canal === CANAL);
  const lista = delCanal
    .filter(p => !fe || p.estado === fe)
    .filter(p => !q || `${p.cliente} ${p.id} ${p.estado}`.toLowerCase().includes(q))
    .sort((a, b) => (b.fechaPedido || '').localeCompare(a.fechaPedido || '') || b.id - a.id);

  pintarKpis(delCanal);

  const tb = document.getElementById('tbodyPedidos');
  if (!lista.length) {
    tb.innerHTML = `<tr><td colspan="9" class="vacio">${
      delCanal.length ? 'No hay pedidos que coincidan con la búsqueda.'
                      : 'Todavía no hay pedidos cargados en este canal.'}</td></tr>`;
    return;
  }

  tb.innerHTML = lista.map(p => {
    const t = calcularPedido(p);
    const cobrado = p.cobro === 'Cobrado';
    return `<tr onclick="abrirPedido(${p.id})">
      <td><b>#${p.id}</b></td>
      <td>${fechaCorta(p.fechaPedido)}</td>
      <td>${fechaCorta(p.fechaEntrega)}</td>
      <td class="celda-cliente"><b>${esc(p.cliente) || '—'}</b>${p.telefono ? `<span>${esc(p.telefono)}</span>` : ''}</td>
      <td><span class="estado estado--${p.estado.toLowerCase()}">${p.estado}</span></td>
      <td><span class="cobro ${cobrado ? 'cobro--si' : 'cobro--no'}">${cobrado ? 'Cobrado' : 'Pendiente'}</span></td>
      <td class="num">${t.unidades}</td>
      <td class="num"><b>${money(t.total)}</b></td>
      <td class="num"><span class="ganancia${t.ganancia < 0 ? ' ganancia--neg' : ''}">${money(t.ganancia)}</span></td>
    </tr>`;
  }).join('');
}

function pintarKpis(pedidos) {
  // Los cancelados no cuentan para facturación ni ganancia.
  const validos = pedidos.filter(p => p.estado !== 'Cancelado');

  let facturado = 0, ganancia = 0, porCobrar = 0;
  validos.forEach(p => {
    const t = calcularPedido(p);
    facturado += t.total;
    ganancia  += t.ganancia;
    if (p.cobro !== 'Cobrado') porCobrar += t.total;
  });

  const pendientes = pedidos.filter(p => p.estado === 'Nuevo' || p.estado === 'Preparando').length;
  const margen = facturado ? ganancia / facturado * 100 : 0;
  const ticket = validos.length ? facturado / validos.length : 0;

  document.getElementById('kpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-l">Pedidos</div>
      <div class="kpi-v">${pedidos.length}</div>
      <div class="kpi-s">${pendientes} sin entregar</div>
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
      <div class="kpi-l">Por cobrar</div>
      <div class="kpi-v${porCobrar ? ' kpi-v--alerta' : ''}">${money(porCobrar)}</div>
      <div class="kpi-s">${porCobrar ? 'plata en la calle' : 'todo cobrado'}</div>
    </div>`;
}


/* ══════════════ EDITOR ══════════════ */

function nuevoPedido() {
  // Sin Id: lo asigna el servidor al guardar.
  edicion = {
    id: null,
    canal: CANAL,
    fechaPedido: hoyISO(),
    fechaEntrega: '',
    cliente: '', telefono: '', direccion: '',
    estado: 'Nuevo',
    cobro: 'Pendiente',
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
  abrirEditor(false);
}

function abrirEditor(esNuevo) {
  document.getElementById('vistaLista').hidden = true;
  document.getElementById('vistaEditor').hidden = false;
  document.getElementById('tabLista').classList.remove('on');
  document.getElementById('tabNuevo').classList.toggle('on', esNuevo);
  document.getElementById('btnEliminar').hidden = esNuevo;

  document.getElementById('edTitulo').textContent =
    esNuevo ? `Nuevo pedido · ${edicion.canal.toUpperCase()}`
            : `Pedido #${edicion.id} · ${edicion.canal.toUpperCase()}`;

  const v = (id, val) => { document.getElementById(id).value = val ?? ''; };
  v('fPedido', edicion.fechaPedido);
  v('fEntrega', edicion.fechaEntrega);
  v('fEstadoPedido', edicion.estado);
  v('fCobro', edicion.cobro);
  v('fCliente', edicion.cliente);
  v('fTel', edicion.telefono);
  v('fDir', edicion.direccion);
  v('fMedioPago', edicion.medioPago);
  v('fExtras', edicion.extras || 0);
  v('fDescExtras', edicion.descExtras);
  v('fNotas', edicion.notas);

  // Autocompletado con los clientes que ya pidieron antes. Es lo mínimo
  // hasta que exista una hoja de clientes de verdad.
  document.getElementById('listaClientes').innerHTML =
    [...new Set(PEDIDOS.map(p => p.cliente).filter(Boolean))]
      .map(c => `<option value="${esc(c)}">`).join('');

  document.getElementById('buscarProd').value = '';
  document.getElementById('sugerencias').innerHTML = '';
  sugerencias = []; sugSel = -1;

  pintarItems();
}

function leerCampos() {
  const g = id => document.getElementById(id).value;
  Object.assign(edicion, {
    fechaPedido:  g('fPedido'),
    fechaEntrega: g('fEntrega'),
    estado:       g('fEstadoPedido'),
    cobro:        g('fCobro'),
    cliente:      g('fCliente').trim(),
    telefono:     g('fTel').trim(),
    direccion:    g('fDir').trim(),
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
  const palabras = q.split(/\s+/);
  sugerencias = CATALOGO[edicion.canal]
    .filter(p => {
      const texto = `${p.n} ${p.m}`.toLowerCase();
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
      <span class="sug-precio">${esc(p.pv)}</span>
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
      <td class="num">${money(c.unit)}${c.tieneDto ? '<span class="chip-dto">dto</span>' : ''}</td>
      <td class="num">${money(c.subtotal)}</td>
      <td class="num">${c.descuento ? '−' + money(c.descuento) : '—'}</td>
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
  document.getElementById('rDto').textContent = t.descuento ? '−' + money(t.descuento) : '$0';
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
  if (!edicion.cliente)      { toast('Falta el nombre del cliente', true); return; }

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

    toast(`Pedido #${id} guardado`);
    verLista();
  } catch (e) {
    toast('No se pudo guardar: ' + e.message, true);
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

// Texto plano para mandarle el detalle al cliente. Sin emojis ni
// caracteres raros: WhatsApp Desktop los muestra mal.
function copiarParaWhatsApp() {
  leerCampos();
  const t = calcularPedido(edicion);

  let msg = edicion.id ? `*PEDIDO #${edicion.id}*\n` : '*PEDIDO*\n';
  if (edicion.cliente) msg += `Cliente: ${edicion.cliente}\n`;
  if (edicion.fechaEntrega) msg += `Entrega: ${fechaCorta(edicion.fechaEntrega)}\n`;
  msg += '--------------------------------\n';

  edicion.items.forEach((l, i) => {
    const c = calcularLinea(l);
    msg += `${i + 1}. ${l.nombre}\n   ${l.cant} un. x ${money(c.unit)} = ${money(c.total)}\n`;
  });

  msg += '--------------------------------\n';
  msg += `Subtotal: ${money(t.subtotal)}\n`;
  if (t.descuento) msg += `Descuentos: -${money(t.descuento)}\n`;
  if (t.extras)    msg += `${edicion.descExtras || 'Extras'}: ${money(t.extras)}\n`;
  msg += `\n*TOTAL: ${money(t.total)}*`;

  navigator.clipboard.writeText(msg)
    .then(() => toast('Pedido copiado'))
    .catch(() => toast('El navegador bloqueó el portapapeles', true));
}
