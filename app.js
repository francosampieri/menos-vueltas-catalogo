// ══ CONFIGURACIÓN ══
const WHATSAPP_NUM = '5491112345678'; // reemplazar con número real

// ══ ESTADO GLOBAL ══
let grupos          = {};  // id_grupo → { nombre, marca, categoria, subcategoria }
let catalogo        = {};  // id_grupo → [productos]
let carrito         = [];  // items del carrito
const rotaciones    = {};  // id_grupo → { timer, indexActual }

let filtroActivo    = 'Todos';
let filtroSubcat    = null;
let busquedaActiva  = '';

// ══ PARSEO ══
function parsePrecio(str) {
  if (!str || str.trim() === '' || str.includes('#')) return null;
  // Formato argentino: $19.680,00 → puntos=miles, coma=decimal
  const clean = str.replace(/[^0-9,.]/g, '');
  const normalizado = clean.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalizado);
  return isNaN(n) || n <= 0 ? null : n;
}

function formatPrecio(n) {
  if (n === null || n === undefined) return null;
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(l => {
    const vals = parseLine(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

function parseLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

// ══ CARGA DE DATOS ══
async function cargarDatos() {
  try {
    const data = await fetch('catalogo.json').then(r => r.json());

    data.grupos.forEach(g => {
      grupos[g['Id_Grupo']] = {
        nombre:      g['Nombre_Grupo'],
        marca:       g['Marca'],
        categoria:   g['Categoria'],
        subcategoria: g['Subcategoria']
      };
    });

    const productos = data.productos.filter(p =>
      p['Activo'] === 'ON' && p['Cat B2B'] === 'ON'
    );

    productos.forEach(p => {
      const gid = p['Id_Grupo'];
      if (!catalogo[gid]) catalogo[gid] = [];
      catalogo[gid].push(p);
    });

    renderCatalogo();
  } catch(e) {
    document.getElementById('loading').innerHTML =
      '<div style="color:#e53935;padding:20px">⚠️ Error al cargar el catálogo. Recargá la página.</div>';
    console.error(e);
  }
}

// ══ RENDER CATÁLOGO ══
function renderCatalogo() {
  document.getElementById('loading').style.display = 'none';
  construirFiltrosCategorias();
  llenarMegamenu();
  renderGrupos();
}

function construirFiltrosCategorias() {
  const cont = document.getElementById('filtros');
  // Limpiar excepto "Todos"
  cont.innerHTML = '';

  const btnTodos = document.createElement('button');
  btnTodos.className = 'filtro-btn active';
  btnTodos.dataset.cat = 'Todos';
  btnTodos.textContent = 'Todos';
  btnTodos.onclick = () => setFiltroCategoria('Todos', btnTodos);
  cont.appendChild(btnTodos);

  const cats = new Set();
  Object.values(catalogo).forEach(vars => {
    const g = grupos[vars[0]['Id_Grupo']] || {};
    const cat = g.categoria || vars[0]['Categoria'] || '';
    if (cat) cats.add(cat);
  });

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filtro-btn';
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.onclick = () => setFiltroCategoria(cat, btn);
    cont.appendChild(btn);
  });
}

function setFiltroCategoria(cat, btn) {
  filtroActivo = cat;
  filtroSubcat = null;
  // Limpiar búsqueda al navegar por categorías
  busquedaActiva = '';
  document.getElementById('buscador').value = '';
  document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderSubfiltros();
  renderGrupos();
}

function renderSubfiltros() {
  const wrap = document.getElementById('subfiltrosWrap');
  const cont = document.getElementById('subfiltros');
  cont.innerHTML = '';

  if (filtroActivo === 'Todos') {
    wrap.classList.remove('visible');
    return;
  }

  const subs = new Set();
  Object.values(catalogo).forEach(vars => {
    const g = grupos[vars[0]['Id_Grupo']] || {};
    const cat = g.categoria || vars[0]['Categoria'] || '';
    const sub = g.subcategoria || vars[0]['Subcategoria'] || '';
    if (cat === filtroActivo && sub) subs.add(sub);
  });

  if (!subs.size) {
    wrap.classList.remove('visible');
    return;
  }

  wrap.classList.add('visible');

  const btnTodos = document.createElement('button');
  btnTodos.className = 'subfiltro-btn' + (!filtroSubcat ? ' active' : '');
  btnTodos.textContent = 'Todos';
  btnTodos.onclick = () => setFiltroSubcat(null);
  cont.appendChild(btnTodos);

  subs.forEach(sub => {
    const btn = document.createElement('button');
    btn.className = 'subfiltro-btn' + (filtroSubcat === sub ? ' active' : '');
    btn.textContent = sub;
    btn.onclick = () => setFiltroSubcat(sub);
    cont.appendChild(btn);
  });
}

function setFiltroSubcat(sub) {
  filtroSubcat = sub;
  // Limpiar búsqueda al navegar por subcategorías
  busquedaActiva = '';
  document.getElementById('buscador').value = '';
  renderSubfiltros();
  renderGrupos();
}

function getGruposFiltrados() {
  return Object.entries(catalogo).filter(([gid, vars]) => {
    const g = grupos[gid] || {};
    const cat = g.categoria    || vars[0]['Categoria']    || '';
    const sub = g.subcategoria || vars[0]['Subcategoria'] || '';
    const nombre = g.nombre    || vars[0]['Producto']     || '';
    const marca  = g.marca     || vars[0]['Marca']        || '';
    const tags   = vars.map(v => v['Tags'] || '').join(' ');

    // Búsqueda siempre global — ignora filtros de categoría y subcategoría
    // Normaliza acentos para que "limon" encuentre "limón"
    if (busquedaActiva) {
      const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const q = norm(busquedaActiva);
      const texto = norm(`${nombre} ${marca} ${cat} ${sub} ${tags}`);
      return texto.includes(q);
    }

    if (filtroActivo !== 'Todos' && cat !== filtroActivo) return false;
    if (filtroSubcat && sub !== filtroSubcat) return false;
    return true;
  });
}

function renderGrupos() {
  const cont = document.getElementById('catalogo');
  cont.innerHTML = '';

  const filtrados = getGruposFiltrados();
  if (!filtrados.length) {
    cont.innerHTML = '<div class="empty-msg">No se encontraron productos 🔍</div>';
    return;
  }

  // Agrupar por cat → subcat
  const porSeccion = {};
  filtrados.forEach(([gid, vars]) => {
    const g = grupos[gid] || {};
    const cat = g.categoria    || vars[0]['Categoria']    || 'Otros';
    const sub = g.subcategoria || vars[0]['Subcategoria'] || '';
    const key = cat + '|||' + sub;
    if (!porSeccion[key]) porSeccion[key] = { cat, sub, items: [] };
    porSeccion[key].items.push([gid, vars]);
  });

  Object.values(porSeccion).forEach(({ sub, cat, items }) => {
    const titulo = document.createElement('div');
    titulo.className = 'seccion-titulo';
    titulo.textContent = sub || cat;
    cont.appendChild(titulo);

    const grid = document.createElement('div');
    grid.className = 'grid';
    items.forEach(([gid, vars]) => grid.appendChild(crearCard(gid, vars)));
    cont.appendChild(grid);
  });
}

// ══ CARD ══
function getEmoji(cat) {
  const map = {
    'Almacen': '🛒', 'Limpieza': '🧹', 'Higiene Personal': '🧴',
    'Snacks y Golosinas': '🍬', 'Desayuno y Mediatarde': '☕',
    'Hogar y Ferreteria': '🔧'
  };
  return map[cat] || '📦';
}

function buildVarianteLabel(v, vars) {
  const partes = [];
  if (v['Label_Variante']) partes.push(v['Label_Variante']);
  if (v['Label_Tamaño'])   partes.push(v['Label_Tamaño']);
  else if (vars.length === 1 && v['Tamaño'] && v['UM']) partes.push(`${v['Tamaño']} ${v['UM']}`);
  return partes.join(' · ');
}

function crearCard(gid, vars) {
  const g = grupos[gid] || {};
  const nombre = g.nombre || vars[0]['Producto'] || 'Producto';
  const marca  = g.marca  || vars[0]['Marca']    || '';
  const cat    = g.categoria || vars[0]['Categoria'] || '';

  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${gid}`;

  // ── Imagen ──
  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-img-wrap';

  const placeholder = document.createElement('div');
  placeholder.className = 'card-img-placeholder';
  placeholder.textContent = getEmoji(cat);

  const img = document.createElement('img');
  img.style.display = 'none';
  img.onload  = () => { img.style.display = 'block'; placeholder.style.display = 'none'; };
  img.onerror = () => { img.style.display = 'none';  placeholder.style.display = 'flex'; };
  imgWrap.append(placeholder, img);

  // Dots de variante
  if (vars.length > 1) {
    const dots = document.createElement('div');
    dots.className = 'variante-dots';
    dots.id = `dots-${gid}`;
    vars.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'variante-dot' + (i === 0 ? ' active' : '');
      dots.appendChild(d);
    });
    imgWrap.appendChild(dots);
  }

  // ── Badge carrito ──
  const badge = document.createElement('div');
  badge.className = 'card-en-carrito';
  badge.id = `badge-${gid}`;
  badge.textContent = 'En carrito';

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'card-body';

  const marcaEl = document.createElement('div');
  marcaEl.className = 'card-marca';
  marcaEl.textContent = marca;

  const nombreEl = document.createElement('div');
  nombreEl.className = 'card-nombre';
  nombreEl.textContent = nombre;

  const vlabelEl = document.createElement('div');
  vlabelEl.className = 'card-variante-label';
  vlabelEl.id = `vlabel-${gid}`;

  const vprecioEl = document.createElement('div');
  vprecioEl.id = `vprecio-${gid}`;

  body.append(marcaEl, nombreEl, vlabelEl, vprecioEl);

  // ── Expanded ──
  const expanded = document.createElement('div');
  expanded.className = 'card-expanded';
  expanded.id = `exp-${gid}`;

  card.append(imgWrap, badge, body, expanded);

  // Inicializar vista con variante 0
  rotaciones[gid] = { indexActual: 0, timer: null };
  actualizarVistaCerrada(gid, vars, 0, img, vlabelEl, vprecioEl);

  // Rotación automática si hay múltiples variantes
  if (vars.length > 1) iniciarRotacion(gid, vars, img, vlabelEl, vprecioEl);

  // Click para expandir
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-expanded')) return;
    toggleCard(gid, vars, card, img);
  });

  return card;
}

function actualizarVistaCerrada(gid, vars, idx, imgEl, vlabelEl, vprecioEl) {
  const v = vars[idx];
  const precio = parsePrecio(v['Precio_Venta']);

  // Label
  if (vlabelEl) vlabelEl.textContent = buildVarianteLabel(v, vars);

  // Precio
  if (vprecioEl) {
    if (precio !== null) {
      vprecioEl.textContent = formatPrecio(precio);
      vprecioEl.className = 'card-precio';
    } else {
      vprecioEl.textContent = 'Precio a confirmar';
      vprecioEl.className = 'card-precio sin-precio';
    }
  }

  // Imagen
  if (imgEl && v['Imagen'] && v['Imagen'].trim()) {
    imgEl.src = v['Imagen'].trim();
  }

  // Dots
  const dotsEl = document.getElementById(`dots-${gid}`);
  if (dotsEl) {
    dotsEl.querySelectorAll('.variante-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  }
}

function iniciarRotacion(gid, vars, imgEl, vlabelEl, vprecioEl) {
  const rot = rotaciones[gid];
  if (rot.timer) clearInterval(rot.timer);
  rot.timer = setInterval(() => {
    const card = document.getElementById(`card-${gid}`);
    if (!card || card.classList.contains('expanded')) return;
    rot.indexActual = (rot.indexActual + 1) % vars.length;
    actualizarVistaCerrada(gid, vars, rot.indexActual, imgEl, vlabelEl, vprecioEl);
  }, 3000);
}

function toggleCard(gid, vars, card, imgEl) {
  const estaExpandida = card.classList.contains('expanded');

  // Cerrar todas
  document.querySelectorAll('.card.expanded').forEach(c => {
    c.classList.remove('expanded');
    const id = c.id.replace('card-', '');
    const exp = document.getElementById(`exp-${id}`);
    if (exp) exp.innerHTML = '';
  });

  if (!estaExpandida) {
    card.classList.add('expanded');
    if (rotaciones[gid]?.timer) clearInterval(rotaciones[gid].timer);
    renderExpanded(gid, vars, imgEl);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    // Reanudar rotación
    const vlabelEl = document.getElementById(`vlabel-${gid}`);
    const vprecioEl = document.getElementById(`vprecio-${gid}`);
    if (vars.length > 1) iniciarRotacion(gid, vars, imgEl, vlabelEl, vprecioEl);
  }
}

// ══ EXPANDED ══
function renderExpanded(gid, vars, imgEl) {
  const expanded = document.getElementById(`exp-${gid}`);
  expanded.innerHTML = '';

  const variantesUnicas = [...new Set(vars.map(v => v['Label_Variante']).filter(Boolean))];
  const tamañosUnicos   = [...new Set(vars.map(v => v['Label_Tamaño']).filter(Boolean))];
  const tiposVariante   = [...new Set(vars.map(v => v['Tipo_Variante']).filter(Boolean))];

  const esUnico         = vars.length === 1;
  const soloPorVariante = variantesUnicas.length > 0 && tamañosUnicos.length === 0;
  const soloPorTamaño   = tamañosUnicos.length > 0   && variantesUnicas.length === 0;
  const tieneDoble      = variantesUnicas.length > 0  && tamañosUnicos.length > 0;

  let selVariante = null;
  let selTamaño   = null;

  function getVarianteSeleccionada() {
    if (esUnico) return vars[0];
    if (soloPorVariante) return vars.find(v => v['Label_Variante'] === selVariante) || null;
    if (soloPorTamaño)   return vars.find(v => v['Label_Tamaño']   === selTamaño)   || null;
    if (tieneDoble)      return vars.find(v => v['Label_Variante'] === selVariante && v['Label_Tamaño'] === selTamaño) || null;
    return vars[0];
  }

  function estaListo() {
    if (esUnico) return true;
    if (soloPorVariante) return !!selVariante;
    if (soloPorTamaño)   return !!selTamaño;
    if (tieneDoble)      return !!selVariante && !!selTamaño;
    return true;
  }

  function dibujar() {
    expanded.innerHTML = '';

    // Chips variante (sabor, color, etc.)
    if (!esUnico && variantesUnicas.length > 0) {
      const tit = document.createElement('div');
      tit.className = 'variantes-titulo';
      tit.textContent = tiposVariante[0] || 'Variante';
      expanded.appendChild(tit);

      const wrap = document.createElement('div');
      wrap.className = 'variantes-chips';
      variantesUnicas.forEach(val => {
        const chip = document.createElement('button');
        chip.className = 'chip' + (val === selVariante ? ' selected' : '');
        chip.textContent = val;
        chip.addEventListener('click', e => {
          e.stopPropagation();
          selVariante = val;
          if (tieneDoble) selTamaño = null; // resetear tamaño al cambiar variante
          dibujar();
        });
        wrap.appendChild(chip);
      });
      expanded.appendChild(wrap);
    }

    // Chips tamaño
    if (!esUnico && tamañosUnicos.length > 0) {
      const tit = document.createElement('div');
      tit.className = 'variantes-titulo';
      tit.textContent = 'Tamaño';
      expanded.appendChild(tit);

      const wrap = document.createElement('div');
      wrap.className = 'variantes-chips';

      // Si doble selección, solo mostrar tamaños disponibles para la variante elegida
      const tamsDisponibles = tieneDoble && selVariante
        ? [...new Set(vars.filter(v => v['Label_Variante'] === selVariante).map(v => v['Label_Tamaño']).filter(Boolean))]
        : tamañosUnicos;

      tamañosUnicos.forEach(tam => {
        const disponible = tamsDisponibles.includes(tam);
        const chip = document.createElement('button');
        chip.className = 'chip' + (tam === selTamaño ? ' selected' : '') + (!disponible ? ' disabled' : '');
        chip.textContent = tam;
        chip.addEventListener('click', e => {
          e.stopPropagation();
          if (!disponible) return;
          selTamaño = tam;
          dibujar();
        });
        wrap.appendChild(chip);
      });
      expanded.appendChild(wrap);
    }

    // Precio
    const varSel = getVarianteSeleccionada();
    const precio    = varSel ? parsePrecio(varSel['Precio_Venta']) : null;
    const precioDto = varSel ? parsePrecio(varSel['Precio_Dto'])   : null;
    const uniDto    = varSel ? (parseInt(varSel['Uni Dto']) || 0)  : 0;

    const pdiv = document.createElement('div');
    pdiv.className = 'precio-detalle';
    pdiv.innerHTML = precio !== null
      ? `<span class="precio-detalle-label">Precio unitario</span><span class="precio-detalle-valor">${formatPrecio(precio)}</span>`
      : `<span class="precio-detalle-label">Precio</span><span class="precio-detalle-valor sin-precio">A confirmar</span>`;
    expanded.appendChild(pdiv);

    // Bloque descuento
    if (uniDto > 0 && precioDto !== null) {
      const dtoDiv = document.createElement('div');
      dtoDiv.className = 'descuento-bloque';
      dtoDiv.innerHTML = `<div class="descuento-info">Comprando ${uniDto} o más: <strong>${formatPrecio(precioDto)}</strong> c/u</div>`;
      expanded.appendChild(dtoDiv);
    }

    // Actualizar imagen
    if (varSel && imgEl && varSel['Imagen']?.trim()) {
      imgEl.src = varSel['Imagen'].trim();
      imgEl.style.display = 'block';
    }

    // Cantidad + agregar
    const qtyRow = document.createElement('div');
    qtyRow.className = 'qty-row';

    let qty = 1;
    const qtyCtrl = document.createElement('div');
    qtyCtrl.className = 'qty-ctrl';

    const btnMenos = document.createElement('button');
    btnMenos.className = 'qty-btn';
    btnMenos.textContent = '−';

    const numEl = document.createElement('div');
    numEl.className = 'qty-num';
    numEl.textContent = qty;

    const btnMas = document.createElement('button');
    btnMas.className = 'qty-btn';
    btnMas.textContent = '+';

    btnMenos.addEventListener('click', e => { e.stopPropagation(); if (qty > 1) { qty--; numEl.textContent = qty; } });
    btnMas.addEventListener('click',   e => { e.stopPropagation(); qty++; numEl.textContent = qty; });
    qtyCtrl.append(btnMenos, numEl, btnMas);

    const agregarBtn = document.createElement('button');
    agregarBtn.className = 'agregar-btn';

    if (!estaListo()) {
      agregarBtn.textContent = 'Elegí una opción';
      agregarBtn.disabled = true;
    } else {
      agregarBtn.textContent = '+ Agregar al pedido';
      agregarBtn.addEventListener('click', e => {
        e.stopPropagation();
        const v = getVarianteSeleccionada();
        if (!v) return;
        agregarAlCarrito(gid, v, qty);
        agregarBtn.textContent = '✓ Agregado';
        setTimeout(() => { agregarBtn.textContent = '+ Agregar más'; }, 1500);
      });
    }

    qtyRow.append(qtyCtrl, agregarBtn);
    expanded.appendChild(qtyRow);

    // Cerrar
    const cerrarBtn = document.createElement('button');
    cerrarBtn.className = 'cerrar-card';
    cerrarBtn.textContent = '↑ Cerrar';
    cerrarBtn.addEventListener('click', e => {
      e.stopPropagation();
      const card = document.getElementById(`card-${gid}`);
      card.classList.remove('expanded');
      expanded.innerHTML = '';
      const vlabelEl  = document.getElementById(`vlabel-${gid}`);
      const vprecioEl = document.getElementById(`vprecio-${gid}`);
      if (vars.length > 1) iniciarRotacion(gid, vars, imgEl, vlabelEl, vprecioEl);
    });
    expanded.appendChild(cerrarBtn);
  }

  dibujar();
}

// ══ CARRITO ══
function precioEfectivo(item) {
  const aplica = item.uniDto > 0 && item.qty >= item.uniDto && item.precioDto !== null;
  return aplica ? item.precioDto : item.precio;
}

function agregarAlCarrito(gid, variante, qty) {
  const g      = grupos[gid] || {};
  const nombre = g.nombre    || variante['Producto'] || '';
  const marca  = g.marca     || variante['Marca']    || '';

  const partes = [];
  if (variante['Label_Variante']) partes.push(variante['Label_Variante']);
  if (variante['Label_Tamaño'])   partes.push(variante['Label_Tamaño']);
  else if (variante['Tamaño'] && variante['UM']) partes.push(`${variante['Tamaño']} ${variante['UM']}`);
  const varLabel = partes.join(' · ');

  const precio    = parsePrecio(variante['Precio_Venta']);
  const precioDto = parsePrecio(variante['Precio_Dto']);
  const uniDto    = parseInt(variante['Uni Dto']) || 0;
  const idProd    = variante['Id'];

  const existe = carrito.find(i => i.idProd === idProd);
  if (existe) {
    existe.qty += qty;
  } else {
    carrito.push({ gid, idProd, nombre, marca, varLabel, precio, precioDto, uniDto, qty });
  }

  actualizarUICarrito();

  const badge = document.getElementById(`badge-${gid}`);
  if (badge) badge.classList.add('visible');
}

function cambiarQtyCarrito(idx, delta) {
  carrito[idx].qty = Math.max(1, carrito[idx].qty + delta);
  actualizarUICarrito();
}

function eliminarDelCarrito(idx) {
  const gid = carrito[idx].gid;
  carrito.splice(idx, 1);
  if (!carrito.some(i => i.gid === gid)) {
    const badge = document.getElementById(`badge-${gid}`);
    if (badge) badge.classList.remove('visible');
  }
  actualizarUICarrito();
}

function actualizarUICarrito() {
  const total      = carrito.reduce((s, i) => s + (precioEfectivo(i) || 0) * i.qty, 0);
  const totalItems = carrito.reduce((s, i) => s + i.qty, 0);
  const hayPrecio  = carrito.some(i => i.precio !== null);

  const countEl = document.getElementById('cartCount');
  countEl.textContent = totalItems;
  countEl.classList.toggle('visible', totalItems > 0);

  const totalEl = document.getElementById('carritoTotal');
  if (hayPrecio) {
    totalEl.textContent  = formatPrecio(total);
    totalEl.className    = 'carrito-total-valor';
  } else {
    totalEl.textContent  = 'Precios a confirmar';
    totalEl.className    = 'carrito-total-valor sin-precios';
  }

  const notaEl = document.getElementById('carritoNota');
  const sinPrecio = carrito.filter(i => i.precio === null);
  notaEl.textContent = sinPrecio.length
    ? `⚠️ ${sinPrecio.length} producto(s) sin precio. El total puede variar.`
    : '';

  renderCarritoItems();
}

function renderCarritoItems() {
  const cont = document.getElementById('carritoItems');
  if (!carrito.length) {
    cont.innerHTML = '<div class="carrito-empty">Tu carrito está vacío 🛒</div>';
    return;
  }
  cont.innerHTML = '';

  carrito.forEach((item, idx) => {
    const aplica     = item.uniDto > 0 && item.qty >= item.uniDto && item.precioDto !== null;
    const pEfectivo  = precioEfectivo(item);
    const subtotal   = pEfectivo !== null ? formatPrecio(pEfectivo * item.qty) : 'S/P';

    let precioLinea = '';
    if (item.precio !== null) {
      if (aplica) {
        precioLinea = `<span style="text-decoration:line-through;color:var(--t3);font-size:0.78rem">${formatPrecio(item.precio)}</span> <strong style="color:var(--accent)">${formatPrecio(item.precioDto)}</strong> c/u`;
      } else {
        precioLinea = `${formatPrecio(item.precio)} c/u`;
      }
    } else {
      precioLinea = 'Precio a confirmar';
    }

    const div = document.createElement('div');
    div.className = 'carrito-item';
    div.innerHTML = `
      <div class="ci-info">
        <div class="ci-nombre">${item.marca} ${item.nombre}</div>
        ${item.varLabel ? `<div class="ci-variante">${item.varLabel}</div>` : ''}
        <div class="ci-precio">${precioLinea}</div>
        <div class="ci-qty-row">
          <button class="ci-qty-btn" onclick="cambiarQtyCarrito(${idx}, -1)">−</button>
          <div class="ci-qty-num">${item.qty}</div>
          <button class="ci-qty-btn" onclick="cambiarQtyCarrito(${idx}, 1)">+</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <button class="ci-eliminar" onclick="eliminarDelCarrito(${idx})">🗑️</button>
        <div class="ci-subtotal">${subtotal}</div>
      </div>
    `;
    cont.appendChild(div);
  });
}

function abrirCarrito() {
  document.getElementById('carritoOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function cerrarCarrito() {
  document.getElementById('carritoOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ══ WHATSAPP ══
function enviarWhatsApp() {
  if (!carrito.length) return;
  const total     = carrito.reduce((s, i) => s + (precioEfectivo(i) || 0) * i.qty, 0);
  const hayPrecio = carrito.some(i => i.precio !== null);

  let msg = '🛒 *PEDIDO B2B*\n';
  msg += '━━━━━━━━━━━━━━━━\n\n';

  carrito.forEach((item, i) => {
    const aplica    = item.uniDto > 0 && item.qty >= item.uniDto && item.precioDto !== null;
    const pEfectivo = precioEfectivo(item);
    msg += `*${i + 1}. ${item.marca} ${item.nombre}*\n`;
    if (item.varLabel) msg += `   Variante: ${item.varLabel}\n`;
    msg += `   Cantidad: ${item.qty} unidades\n`;
    if (item.precio !== null) {
      msg += `   Precio unit.: ${formatPrecio(aplica ? item.precioDto : item.precio)}\n`;
      msg += `   Subtotal: ${formatPrecio(pEfectivo * item.qty)}\n`;
    } else {
      msg += `   Precio: a confirmar\n`;
    }
    msg += '\n';
  });

  msg += '━━━━━━━━━━━━━━━━\n';
  if (hayPrecio) msg += `*TOTAL ESTIMADO: ${formatPrecio(total)}*\n`;
  msg += '\n_Pedido generado desde el catálogo B2B_';

  window.open(`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ══ NAVEGACIÓN ══
function mostrarLanding() {
  document.getElementById('vista-landing').classList.remove('oculta');
  document.getElementById('vista-catalogo').classList.remove('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mostrarCatalogo(cat, sub) {
  document.getElementById('vista-landing').classList.add('oculta');
  document.getElementById('vista-catalogo').classList.add('visible');
  window.scrollTo({ top: 0 });

  if (cat) {
    const btnCat = document.querySelector(`.filtro-btn[data-cat="${CSS.escape(cat)}"]`) || document.querySelector(`.filtro-btn[data-cat="${cat}"]`);
    setFiltroCategoria(cat, btnCat);
    if (sub) {
      filtroSubcat = sub;
      renderSubfiltros();
      renderGrupos();
    }
  }

  const label = sub || (cat && cat !== 'Todos' ? cat : 'Catálogo completo');
  document.getElementById('catalogo-titulo-label').textContent = label;
}

function scrollLanding(id) {
  mostrarLanding();
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// ══ MEGAMENU ══
function llenarMegamenu() {
  const grid = document.getElementById('megamenuGrid');
  grid.innerHTML = '';

  const estructura = {};
  Object.values(catalogo).forEach(vars => {
    const g   = grupos[vars[0]['Id_Grupo']] || {};
    const cat = g.categoria    || vars[0]['Categoria']    || 'Otros';
    const sub = g.subcategoria || vars[0]['Subcategoria'] || '';
    if (!estructura[cat]) estructura[cat] = new Set();
    if (sub) estructura[cat].add(sub);
  });

  Object.entries(estructura).forEach(([cat, subs]) => {
    const col = document.createElement('div');
    col.className = 'megamenu-col';

    const catEl = document.createElement('div');
    catEl.className = 'megamenu-cat';
    catEl.textContent = cat;
    col.appendChild(catEl);

    subs.forEach(sub => {
      const btn = document.createElement('button');
      btn.className = 'megamenu-sub';
      btn.textContent = sub;
      btn.addEventListener('click', () => {
        cerrarMegamenu();
        mostrarCatalogo(cat, sub);
      });
      col.appendChild(btn);
    });

    grid.appendChild(col);
  });
}

function toggleMegamenu() {
  const dropdown = document.getElementById('navDropdown');
  const isOpen = dropdown.classList.contains('open');
  if (!isOpen) {
    // Posicionar justo debajo de la navbar
    const navbar = document.querySelector('.topbar');
    const navBottom = navbar.getBoundingClientRect().bottom;
    const menu = dropdown.querySelector('.nav-megamenu');
    menu.style.top = (navBottom + 6) + 'px';
  }
  dropdown.classList.toggle('open');
}
function cerrarMegamenu() {
  document.getElementById('navDropdown').classList.remove('open');
}

// ══ FAQ ══
function toggleFaq(btn) {
  btn.parentElement.classList.toggle('open');
}

// ══ EVENTOS GLOBALES ══
document.addEventListener('click', e => {
  if (!e.target.closest('#navDropdown')) cerrarMegamenu();
});

document.getElementById('buscador').addEventListener('input', function() {
  busquedaActiva = this.value.trim();
  if (busquedaActiva) {
    mostrarCatalogo();
    document.getElementById('catalogo-titulo-label').textContent = `Resultados para "${busquedaActiva}"`;
  }
  renderGrupos();
});

// ══ INIT ══
cargarDatos();
