/* ══════════════════════════════════════════════════════
   MENOS VUELTAS — Panel de pedidos

   Reemplaza las fórmulas de la hoja DetallePedidos. Toda la
   lógica de qué precio corresponde vive en precioEfectivo(),
   una sola vez, en vez de repetida en cada celda.

   Los productos y precios se siguen manejando desde el
   Sheets maestro: este panel los lee de catalogo.json (el
   mismo que usa la web) y nunca los modifica.
══════════════════════════════════════════════════════ */

// ── Conexión con el Sheets de pedidos ──
// Pegar acá la URL del Apps Script publicado como aplicación web.
// Mientras esté vacío, el panel guarda en el navegador: sirve para
// probarlo sin conectar nada.
const SHEETS_URL = '';

// Clave del guardado local. Cambiarla descarta los pedidos guardados.
const LS_KEY = 'mv_pedidos_v1';

const ESTADOS = ['Nuevo', 'Preparando', 'Entregado', 'Cancelado'];


/* ══════════════ ESTADO ══════════════ */
let CANAL    = 'b2c';
let CATALOGO = { b2c: [], b2b: [] };
let PEDIDOS  = [];
let edicion  = null;   // copia del pedido que se está editando
let sugerencias = [];
let sugSel   = -1;


/* ══════════════ UTILIDADES ══════════════ */

// Los precios llegan del Sheets como "$19.096,61": punto de miles y
// coma decimal. Number() no los entiende, hay que normalizarlos.
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
  t._timer = setTimeout(() => t.classList.remove('visible'), 2600);
}


/* ══════════════ LA REGLA DE PRECIOS ══════════════
   Esto es lo que antes era una fórmula anidada en cada fila de
   DetallePedidos. Si algún día cambia la política de descuentos,
   se toca únicamente acá.                                        */

function precioEfectivo(prod, cantidad) {
  // El precio base es el de promo si hay una cargada en el Sheets; si la
  // columna está vacía, el generador copia ahí el precio de lista, así que
  // esto funciona igual con o sin campaña activa.
  const base   = num(prod.pp) || num(prod.pv);
  const conDto = num(prod.pd);
  const minimo = parseInt(prod.ud, 10) || 0;

  // El descuento por cantidad solo se aplica si realmente conviene: si hay
  // una promo más agresiva que el precio mayorista, gana la promo.
  if (minimo > 0 && cantidad >= minimo && conDto > 0) return Math.min(conDto, base);
  return base;
}

// Cálculo de una línea del pedido. Mantiene la misma definición que
// la planilla: el subtotal siempre va a precio de lista y el descuento
// por cantidad se ve como una resta, no como un precio distinto.
function calcularLinea(item) {
  const cant  = item.cant || 0;
  const venta = num(item.prod.pv);      // precio de lista, sin promo
  const costo = num(item.prod.co);
  const efec  = precioEfectivo(item.prod, cant);

  const subtotal = cant * venta;
  const total    = cant * efec;
  const costoTot = cant * costo;

  return {
    venta, costo, efectivo: efec,
    subtotal, total, costoTot,
    descuento: subtotal - total,
    ganancia:  total - costoTot,
    tieneDto:  efec < venta
  };
}

function calcularPedido(pedido) {
  let subtotal = 0, total = 0, costo = 0, unidades = 0;

  pedido.items.forEach(item => {
    const l = calcularLinea(item);
    subtotal += l.subtotal;
    total    += l.total;
    costo    += l.costoTot;
    unidades += item.cant || 0;
  });

  const extras = Number(pedido.extras) || 0;

  return {
    subtotal,
    descuento: subtotal - total,
    extras,
    total: total + extras,
    costo,
    ganancia: total + extras - costo,
    unidades,
    margen: (total + extras) ? (total + extras - costo) / (total + extras) * 100 : 0
  };
}


/* ══════════════ CARGA INICIAL ══════════════ */

async function iniciar() {
  const luz = document.getElementById('adEstado');
  try {
    CATALOGO = await fetch('productos.json').then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
    luz.classList.add('ok');
    luz.title = `Catálogo cargado · ${CATALOGO.b2c.length} B2C · ${CATALOGO.b2b.length} B2B`;
  } catch (e) {
    luz.classList.add('error');
    luz.title = 'No se pudo cargar el catálogo';
    toast('No se pudo cargar el catálogo de productos', true);
  }

  PEDIDOS = await cargarPedidos();
  verLista();
}

document.addEventListener('DOMContentLoaded', iniciar);


/* ══════════════ PERSISTENCIA ══════════════
   Una sola puerta de entrada y salida. Hoy escribe en el navegador;
   cuando SHEETS_URL tenga valor, escribe en la planilla. El resto del
   panel no se entera de la diferencia.                              */

async function cargarPedidos() {
  if (SHEETS_URL) {
    try {
      const r = await fetch(`${SHEETS_URL}?accion=listar`);
      const data = await r.json();
      return (data.pedidos || []).map(hidratar);
    } catch (e) {
      toast('No se pudo leer los pedidos del Sheets', true);
      return [];
    }
  }
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]').map(hidratar);
  } catch (e) {
    return [];
  }
}

// El Sheets guarda solo id y cantidad de cada producto; los datos del
// producto se vuelven a buscar en el catálogo. Así un cambio de precio
// no queda congelado en pedidos viejos.
function hidratar(p) {
  const cat = CATALOGO[p.canal] || [];
  p.items = (p.items || []).map(it => {
    const prod = it.prod || cat.find(x => x.id === String(it.id));
    return prod ? { prod, cant: it.cant } : null;
  }).filter(Boolean);
  return p;
}

// Para guardar solo viaja lo mínimo: el catálogo es la fuente de verdad.
function deshidratar(p) {
  return { ...p, items: p.items.map(it => ({ id: it.prod.id, cant: it.cant })) };
}

async function persistir() {
  const datos = PEDIDOS.map(deshidratar);

  if (SHEETS_URL) {
    // text/plain evita el preflight CORS que Apps Script no responde.
    await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion: 'guardar', pedidos: datos })
    });
    return;
  }
  localStorage.setItem(LS_KEY, JSON.stringify(datos));
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

function volverALista() {
  verLista();
}


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
    tb.innerHTML = `<tr><td colspan="8" class="vacio">${
      delCanal.length ? 'No hay pedidos que coincidan con la búsqueda.'
                      : 'Todavía no hay pedidos cargados en este canal.'}</td></tr>`;
    return;
  }

  tb.innerHTML = lista.map(p => {
    const t = calcularPedido(p);
    return `<tr onclick="abrirPedido(${p.id})">
      <td><b>#${p.id}</b></td>
      <td>${fechaCorta(p.fechaPedido)}</td>
      <td>${fechaCorta(p.fechaEntrega)}</td>
      <td class="celda-cliente"><b>${esc(p.cliente) || '—'}</b>${p.telefono ? `<span>${esc(p.telefono)}</span>` : ''}</td>
      <td><span class="estado estado--${p.estado.toLowerCase()}">${p.estado}</span></td>
      <td class="num">${t.unidades}</td>
      <td class="num"><b>${money(t.total)}</b></td>
      <td class="num"><span class="ganancia${t.ganancia < 0 ? ' ganancia--neg' : ''}">${money(t.ganancia)}</span></td>
    </tr>`;
  }).join('');
}

function pintarKpis(pedidos) {
  // Los cancelados no cuentan para facturación ni ganancia.
  const validos = pedidos.filter(p => p.estado !== 'Cancelado');
  let facturado = 0, ganancia = 0;
  validos.forEach(p => {
    const t = calcularPedido(p);
    facturado += t.total;
    ganancia  += t.ganancia;
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
      <div class="kpi-s">sin cancelados</div>
    </div>
    <div class="kpi">
      <div class="kpi-l">Ganancia</div>
      <div class="kpi-v kpi-v--verde">${money(ganancia)}</div>
      <div class="kpi-s">${margen.toFixed(1)}% de margen</div>
    </div>
    <div class="kpi">
      <div class="kpi-l">Ticket promedio</div>
      <div class="kpi-v">${money(ticket)}</div>
      <div class="kpi-s">por pedido</div>
    </div>`;
}


/* ══════════════ EDITOR ══════════════ */

function nuevoPedido() {
  edicion = {
    id: PEDIDOS.length ? Math.max(...PEDIDOS.map(p => p.id)) + 1 : 1,
    canal: CANAL,
    fechaPedido: hoyISO(),
    fechaEntrega: '',
    cliente: '', telefono: '', direccion: '',
    estado: 'Nuevo', pago: 'Pendiente',
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
  edicion = { ...p, items: p.items.map(it => ({ ...it })) };
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
  v('fCliente', edicion.cliente);
  v('fTel', edicion.telefono);
  v('fDir', edicion.direccion);
  v('fPago', edicion.pago);
  v('fExtras', edicion.extras || 0);
  v('fDescExtras', edicion.descExtras);
  v('fNotas', edicion.notas);

  // Autocompletado de clientes con los que ya pidieron antes.
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
    cliente:      g('fCliente').trim(),
    telefono:     g('fTel').trim(),
    direccion:    g('fDir').trim(),
    pago:         g('fPago'),
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
  const existente = edicion.items.find(it => it.prod.id === id);
  if (existente) existente.cant++;
  else edicion.items.push({ prod, cant: 1 });

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
  const unidades = edicion.items.reduce((s, it) => s + (it.cant || 0), 0);
  document.getElementById('chipItems').textContent =
    `${unidades} ${unidades === 1 ? 'item' : 'items'}`;
  document.getElementById('sinItems').hidden = edicion.items.length > 0;

  document.getElementById('tbodyItems').innerHTML = edicion.items.map((it, i) => {
    const l = calcularLinea(it);
    const minimo = parseInt(it.prod.ud, 10) || 0;
    return `<tr>
      <td>
        <div class="item-nombre">${esc(it.prod.n)}</div>
        <div class="item-meta">Costo ${money(l.costo)}${minimo ? ` · desde ${minimo} un. ${esc(it.prod.pd)}` : ''}</div>
      </td>
      <td class="num">
        <input type="number" min="1" value="${it.cant}"
               oninput="cambiarCantidad(${i}, this.value)"
               onfocus="this.select()">
      </td>
      <td class="num">${money(l.efectivo)}${l.tieneDto ? '<span class="chip-dto">dto</span>' : ''}</td>
      <td class="num">${money(l.subtotal)}</td>
      <td class="num">${l.descuento ? '−' + money(l.descuento) : '—'}</td>
      <td class="num"><b>${money(l.total)}</b></td>
      <td class="num"><span class="ganancia${l.ganancia < 0 ? ' ganancia--neg' : ''}">${money(l.ganancia)}</span></td>
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
  leerCampos();

  if (!edicion.items.length) { toast('Agregá al menos un producto', true); return; }
  if (!edicion.cliente)      { toast('Falta el nombre del cliente', true); return; }

  const i = PEDIDOS.findIndex(p => p.id === edicion.id);
  if (i >= 0) PEDIDOS[i] = edicion;
  else PEDIDOS.push(edicion);

  try {
    await persistir();
    toast(`Pedido #${edicion.id} guardado`);
    verLista();
  } catch (e) {
    toast('No se pudo guardar. Revisá la conexión.', true);
  }
}

async function eliminarPedido() {
  if (!edicion) return;
  if (!confirm(`¿Eliminar el pedido #${edicion.id}? No se puede deshacer.`)) return;

  PEDIDOS = PEDIDOS.filter(p => p.id !== edicion.id);
  try {
    await persistir();
    toast(`Pedido #${edicion.id} eliminado`);
    verLista();
  } catch (e) {
    toast('No se pudo eliminar. Revisá la conexión.', true);
  }
}

// Texto plano para mandarle el detalle al cliente. Sin emojis ni
// caracteres raros: WhatsApp Desktop los muestra mal.
function copiarParaWhatsApp() {
  leerCampos();
  const t = calcularPedido(edicion);

  let msg = `*PEDIDO #${edicion.id}*\n`;
  if (edicion.cliente) msg += `Cliente: ${edicion.cliente}\n`;
  if (edicion.fechaEntrega) msg += `Entrega: ${fechaCorta(edicion.fechaEntrega)}\n`;
  msg += '--------------------------------\n';

  edicion.items.forEach((it, i) => {
    const l = calcularLinea(it);
    msg += `${i + 1}. ${it.prod.n}\n   ${it.cant} un. x ${money(l.efectivo)} = ${money(l.total)}\n`;
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
