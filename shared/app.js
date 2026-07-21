// ══ CONFIGURACIÓN ══
const WHATSAPP_NUM = '5492617716916'; // reemplazar con número real

// CANAL lo define cada página (B2C o B2B) con <script>window.CANAL='B2C'</script>
// ANTES de cargar este archivo. Fallback a B2C por seguridad si no se definió.
const CANAL = (typeof window !== 'undefined' && window.CANAL) ? window.CANAL : 'B2C';

// ══ ESTADO GLOBAL ══
let grupos          = {};  // id_grupo → { nombre, marca, categoria, subcategoria }
let catalogo        = {};  // id_grupo → [productos]
let carrito         = [];  // items del carrito
const rotaciones    = {};  // id_grupo → { timer, indexActual }

// Productos destacados en la landing (solo B2B, sección "Los más pedidos").
// Poné acá los Id_Grupo de los productos que querés mostrar, en el orden
// en que querés que aparezcan. El Id_Grupo se ve en la columna "Id_Grupo"
// de la hoja de Productos.
const PRODUCTOS_DESTACADOS = [
  '1', '196', '220', '8', '241', '41', '267', '74', '253', '133', '145', '147', '152', '156', '184', '200'
];

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
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

    // Lookup de precios según el canal de esta página (B2C o B2B)
    const tablaPrecios = CANAL === 'B2B' ? data.precios_b2b : data.precios_b2c;
    const preciosPorId = {};
    (tablaPrecios || []).forEach(p => { preciosPorId[p['Id']] = p; });

    const productos = data.productos.filter(p =>
      p['Activo'] === 'ON' && p[`Cat ${CANAL}`] === 'ON'
    );

    // Mergear precio/descuento en cada producto antes de usarlo en el resto de la app
    productos.forEach(p => {
      const precio = preciosPorId[p['Id']];
      p['Precio_Venta'] = precio ? precio['Precio_Venta'] : '';
      p['Uni Dto']      = precio ? precio['Uni Dto']      : '';
      p['Dto']          = precio ? precio['Dto']          : '';
      p['Precio_Dto']   = precio ? precio['Precio_Dto']   : '';
    });

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
  renderDestacados();
}

// Sección "Los más pedidos" de la landing (solo existe en B2B; en B2C el
// contenedor no está en el HTML y esta función no hace nada).
function renderDestacados() {
  const cont = document.getElementById('destacados-grid');
  if (!cont) return;

  cont.innerHTML = '';
  const seccion = document.getElementById('destacados');

  const items = PRODUCTOS_DESTACADOS
    .map(gid => [gid, catalogo[gid]])
    .filter(([, vars]) => vars && vars.length);

  // Si no hay ningún destacado activo/cargado, ocultamos la sección entera
  // en vez de mostrarla vacía.
  if (!items.length) {
    if (seccion) seccion.style.display = 'none';
    return;
  }
  if (seccion) seccion.style.display = '';

  items.forEach(([gid, vars]) => cont.appendChild(crearCardDestacada(gid, vars)));
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
  // Limpiar todos los timers de rotación antes de reconstruir el grid,
  // así no quedan intervalos "fantasma" corriendo sobre cards viejas
  Object.values(rotaciones).forEach(r => { if (r.timer) clearInterval(r.timer); });

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
    // Ordenar alfabéticamente por nombre de producto: así los productos
    // "parecidos" (mismo tipo, distinta marca — ej. "Obleas 9 de Oro" y
    // "Obleas Bauducco") quedan agrupados uno al lado del otro, en vez de
    // depender del Id_Grupo (que no tiene relación con el orden visual).
    items.sort(([gidA, varsA], [gidB, varsB]) => {
      const nombreA = (grupos[gidA]?.nombre || varsA[0]['Producto'] || '');
      const nombreB = (grupos[gidB]?.nombre || varsB[0]['Producto'] || '');
      const cmpNombre = nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
      if (cmpNombre !== 0) return cmpNombre;
      // Mismo nombre genérico (ej. "Obleas"): desempatar por marca para
      // que el orden entre variantes de distinta marca sea prolijo.
      const marcaA = (grupos[gidA]?.marca || varsA[0]['Marca'] || '');
      const marcaB = (grupos[gidB]?.marca || varsB[0]['Marca'] || '');
      return marcaA.localeCompare(marcaB, 'es', { sensitivity: 'base' });
    });

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
  // Si el tamaño no varía entre variantes (no hay Label_Tamaño), igual hay
  // que mostrarlo: el usuario necesita saber qué tamaño está comprando,
  // tenga o no el producto variantes de otro tipo (color, sabor, etc.).
  else if (v['Tamaño'] && v['UM']) partes.push(`${v['Tamaño']} ${v['UM']}`);
  return partes.join(' · ');
}

// Card "destacada": versión liviana y estática (sin rotación de variantes
// ni expandido propio) para usar en la sección "Los más pedidos" de la
// landing, evitando así tener ids duplicados con la card real que vive en
// el catálogo. Al tocarla, lleva directo al catálogo con ese producto
// buscado.
function crearCardDestacada(gid, vars) {
  const g = grupos[gid] || {};
  const nombre = g.nombre || vars[0]['Producto'] || 'Producto';
  const marca  = g.marca  || vars[0]['Marca']    || '';
  const cat    = g.categoria || vars[0]['Categoria'] || '';
  const v = vars[0];

  const precio    = parsePrecio(v['Precio_Venta']);
  const precioDto = parsePrecio(v['Precio_Dto']);
  const uniDto    = parseInt(v['Uni Dto']) || 0;
  const hayDto    = uniDto > 0 && precioDto !== null;

  const card = document.createElement('div');
  card.className = 'card card-destacada';
  card.addEventListener('click', () => irAProducto(nombre));

  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-img-wrap';
  const placeholder = document.createElement('div');
  placeholder.className = 'card-img-placeholder';
  placeholder.textContent = getEmoji(cat);
  imgWrap.appendChild(placeholder);

  const url = v['Imagen'] && v['Imagen'].trim() ? v['Imagen'].trim() : null;
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = nombre;
    img.onload = () => { placeholder.style.display = 'none'; };
    img.onerror = () => { img.remove(); };
    imgWrap.appendChild(img);
  }

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
  vlabelEl.textContent = buildVarianteLabel(v, vars);

  const vprecioEl = document.createElement('div');
  if (precio !== null) {
    vprecioEl.textContent = formatPrecio(precio);
    vprecioEl.className = 'card-precio';
  } else {
    vprecioEl.textContent = 'Precio a confirmar';
    vprecioEl.className = 'card-precio sin-precio';
  }

  body.append(marcaEl, nombreEl, vlabelEl, vprecioEl);

  if (hayDto) {
    const vprecioDtoEl = document.createElement('div');
    vprecioDtoEl.className = 'card-precio-dto';
    vprecioDtoEl.innerHTML = `<strong>${formatPrecio(precioDto)}</strong> ${uniDto} o más`;
    body.appendChild(vprecioDtoEl);
  }

  card.append(imgWrap, body);
  return card;
}

// Lleva al catálogo con el producto ya buscado, para que el kiosquero vea
// la card real (con todas sus variantes) y pueda agregarla al pedido.
function irAProducto(nombre) {
  mostrarCatalogo();
  const input = document.getElementById('buscador');
  if (input) input.value = nombre;
  busquedaActiva = nombre;
  const label = document.getElementById('catalogo-titulo-label');
  if (label) label.textContent = `Resultados para "${nombre}"`;
  renderGrupos();
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

  const vprecioDtoEl = document.createElement('div');
  vprecioDtoEl.className = 'card-precio-dto';
  vprecioDtoEl.id = `vprecio-dto-${gid}`;
  vprecioDtoEl.style.display = 'none';

  body.append(marcaEl, nombreEl, vlabelEl, vprecioEl, vprecioDtoEl);

  // ── Expanded ──
  const expanded = document.createElement('div');
  expanded.className = 'card-expanded';
  expanded.id = `exp-${gid}`;

  card.append(imgWrap, badge, body, expanded);

  // Inicializar vista con variante 0
  if (rotaciones[gid]?.timer) clearInterval(rotaciones[gid].timer);
  rotaciones[gid] = { indexActual: 0, timer: null };
  actualizarVistaCerrada(gid, vars, 0, img, vlabelEl, vprecioEl, vprecioDtoEl, false);

  // Rotación automática si hay múltiples variantes
  if (vars.length > 1) iniciarRotacion(gid, vars, img, vlabelEl, vprecioEl, vprecioDtoEl);

  // Click para expandir
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-expanded')) return;
    toggleCard(gid, vars, card, img);
  });

  return card;
}

function actualizarVistaCerrada(gid, vars, idx, imgEl, vlabelEl, vprecioEl, vprecioDtoEl, animar = true) {
  const v = vars[idx];
  const precio    = parsePrecio(v['Precio_Venta']);
  const precioDto = parsePrecio(v['Precio_Dto']);
  const uniDto    = parseInt(v['Uni Dto']) || 0;
  const hayDto    = uniDto > 0 && precioDto !== null;

  const aplicarCambios = (entrando) => {
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

    // Precio con descuento por cantidad (debajo del precio normal).
    // Solo el precio resalta (ver CSS); el resto del texto queda en gris.
    if (vprecioDtoEl) {
      if (hayDto) {
        vprecioDtoEl.innerHTML = `<strong>${formatPrecio(precioDto)} c/u</strong> ${uniDto} o más`;
        vprecioDtoEl.style.display = 'block';
      } else {
        vprecioDtoEl.style.display = 'none';
      }
    }

    // Imagen + placeholder + dots sincronizados
    if (imgEl) {
      const placeholder = imgEl.previousElementSibling;
      const url = v['Imagen'] && v['Imagen'].trim() ? v['Imagen'].trim() : null;

      const finalizar = () => {
        actualizarDots(gid, idx);
        if (entrando) entrando();
      };

      if (url) {
        imgEl.onload = () => {
          imgEl.style.display = 'block';
          if (placeholder) placeholder.style.display = 'none';
          finalizar();
        };
        imgEl.onerror = () => {
          imgEl.style.display = 'none';
          if (placeholder) placeholder.style.display = 'flex';
          finalizar();
        };
        // Si la imagen ya está cacheada, onload no se dispara — forzar
        if (imgEl.src === url && imgEl.complete) {
          imgEl.style.display = 'block';
          if (placeholder) placeholder.style.display = 'none';
          finalizar();
        } else {
          imgEl.src = url;
        }
      } else {
        imgEl.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
        finalizar();
      }
    }

    if (vlabelEl)  vlabelEl.style.opacity  = '1';
    if (vprecioEl) vprecioEl.style.opacity = '1';
    if (vprecioDtoEl) vprecioDtoEl.style.opacity = '1';
  };

  if (!animar || !imgEl) {
    aplicarCambios();
    return;
  }

  // Deslizamiento: sale hacia la izquierda, cambia contenido, entra desde la derecha
  imgEl.style.transition = 'opacity 280ms ease, transform 280ms ease';
  imgEl.style.opacity = '0';
  imgEl.style.transform = 'translateX(-14px)';
  if (vlabelEl)  vlabelEl.style.opacity  = '0';
  if (vprecioEl) vprecioEl.style.opacity = '0';
  if (vprecioDtoEl) vprecioDtoEl.style.opacity = '0';

  setTimeout(() => {
    aplicarCambios(() => {
      imgEl.style.transform = 'translateX(14px)';
      requestAnimationFrame(() => {
        imgEl.style.opacity = '1';
        imgEl.style.transform = 'translateX(0)';
      });
    });
  }, 280);
}

function actualizarDots(gid, idx) {
  const dotsEl = document.getElementById(`dots-${gid}`);
  if (dotsEl) {
    dotsEl.querySelectorAll('.variante-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  }
}

function iniciarRotacion(gid, vars, imgEl, vlabelEl, vprecioEl, vprecioDtoEl) {
  const rot = rotaciones[gid];
  if (rot.timer) clearInterval(rot.timer);
  rot.timer = setInterval(() => {
    const card = document.getElementById(`card-${gid}`);
    if (!card || card.classList.contains('expanded')) return;
    rot.indexActual = (rot.indexActual + 1) % vars.length;
    actualizarVistaCerrada(gid, vars, rot.indexActual, imgEl, vlabelEl, vprecioEl, vprecioDtoEl);
  }, 3000);
}

// Sincroniza el índice de rotación de una card con la variante que haya
// quedado visible (elegida manualmente o no) y reanuda su rotación
// automática. Se usa siempre que una card se cierra, sea por su propio
// botón/click o porque se abrió otra card distinta.
function sincronizarYReanudarRotacion(gid) {
  const vars = catalogo[gid];
  if (!vars || !vars.length) return;
  const imgEl = document.querySelector(`#card-${gid} .card-img-wrap img`);
  const vlabelEl = document.getElementById(`vlabel-${gid}`);
  const vprecioEl = document.getElementById(`vprecio-${gid}`);
  const vprecioDtoEl = document.getElementById(`vprecio-dto-${gid}`);

  if (rotaciones[gid] && vlabelEl) {
    const idxActual = vars.findIndex(v => buildVarianteLabel(v, vars) === vlabelEl.textContent);
    rotaciones[gid].indexActual = idxActual >= 0 ? idxActual : 0;
  }
  if (imgEl) {
    imgEl.onload = null;
    imgEl.onerror = null;
  }
  if (vars.length > 1) iniciarRotacion(gid, vars, imgEl, vlabelEl, vprecioEl, vprecioDtoEl);
}

function toggleCard(gid, vars, card, imgEl) {
  const estaExpandida = card.classList.contains('expanded');

  // Cerrar todas
  document.querySelectorAll('.card.expanded').forEach(c => {
    c.classList.remove('expanded');
    const id = c.id.replace('card-', '');
    const exp = document.getElementById(`exp-${id}`);
    if (exp) exp.innerHTML = '';
    // Reanudar rotación de cualquier otra card que se esté cerrando acá
    // (por ejemplo, al abrir una card distinta mientras esta quedó expandida)
    if (id !== gid) sincronizarYReanudarRotacion(id);
  });

  if (!estaExpandida) {
    card.classList.add('expanded');
    if (rotaciones[gid]?.timer) clearInterval(rotaciones[gid].timer);
    renderExpanded(gid, vars, imgEl);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    // Reanudar rotación, retomando desde la variante que quedó seleccionada
    // manualmente (si la hay) en vez de un índice viejo.
    sincronizarYReanudarRotacion(gid);
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
  let esPrimeraDibujada = true;

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
          if (tieneDoble) {
            // Mantener el tamaño actual si sigue disponible para esta variante;
            // si no, seleccionar automáticamente el primero disponible.
            const tamsDisponibles = [...new Set(
              vars.filter(v => v['Label_Variante'] === selVariante)
                  .map(v => v['Label_Tamaño'])
                  .filter(Boolean)
            )];
            if (!tamsDisponibles.includes(selTamaño)) {
              selTamaño = tamsDisponibles[0] || null;
            }
          }
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

    // Sincronizar la parte de arriba de la card (label, precio e imagen) con
    // la variante elegida, usando la misma animación de deslizamiento que la
    // rotación automática (excepto en el primer render, que no debe animar).
    if (varSel) {
      const vlabelEl  = document.getElementById(`vlabel-${gid}`);
      const vprecioEl = document.getElementById(`vprecio-${gid}`);
      const vprecioDtoEl = document.getElementById(`vprecio-dto-${gid}`);
      const idxSel = vars.indexOf(varSel);
      actualizarVistaCerrada(gid, vars, idxSel >= 0 ? idxSel : 0, imgEl, vlabelEl, vprecioEl, vprecioDtoEl, !esPrimeraDibujada);
    }
    esPrimeraDibujada = false;

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
      dtoDiv.innerHTML = `<div class="descuento-info"><span class="dto-cantidad">Comprando ${uniDto} o más</span><strong>${formatPrecio(precioDto)} c/u</strong></div>`;
      expanded.appendChild(dtoDiv);
    }

    // (La imagen ya se actualiza junto con label y precio arriba, con animación)

    function resaltarOpciones() {
      const unselectedChips = expanded.querySelectorAll('.chip:not(.selected)');
      unselectedChips.forEach(chip => {
        chip.classList.remove('option-alert');
        void chip.offsetWidth;
        chip.classList.add('option-alert');
        setTimeout(() => chip.classList.remove('option-alert'), 1000);
      });

      const titulos = expanded.querySelectorAll('.variantes-titulo');
      titulos.forEach(t => {
        t.classList.remove('option-alert');
        void t.offsetWidth;
        t.classList.add('option-alert');
        setTimeout(() => t.classList.remove('option-alert'), 1000);
      });
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

    const numWrap = document.createElement('div');
    numWrap.className = 'qty-num-wrap';
    numWrap.title = 'Tocá para escribir la cantidad';

    const numEl = document.createElement('input');
    numEl.type = 'number';
    numEl.min = '1';
    numEl.inputMode = 'numeric';
    numEl.pattern = '[0-9]*';
    numEl.className = 'qty-num';
    numEl.value = qty;

    const editIconWrap = document.createElement('span');
    editIconWrap.className = 'qty-edit-icon-wrap';
    editIconWrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="qty-edit-icon"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/></svg>`;

    numWrap.append(numEl, editIconWrap);

    const btnMas = document.createElement('button');
    btnMas.className = 'qty-btn';
    btnMas.textContent = '+';

    btnMenos.addEventListener('click', e => {
      e.stopPropagation();
      if (!estaListo()) {
        resaltarOpciones();
        return;
      }
      if (qty > 1) { qty--; numEl.value = qty; }
    });

    btnMas.addEventListener('click', e => {
      e.stopPropagation();
      if (!estaListo()) {
        resaltarOpciones();
        return;
      }
      qty++;
      numEl.value = qty;
    });

    numWrap.addEventListener('click', e => {
      e.stopPropagation();
      if (!estaListo()) {
        resaltarOpciones();
        return;
      }
      numEl.focus();
    });
    numEl.addEventListener('click', e => {
      e.stopPropagation();
      if (!estaListo()) {
        numEl.blur();
        resaltarOpciones();
      }
    });
    numEl.addEventListener('focus', e => {
      e.stopPropagation();
      if (!estaListo()) {
        numEl.blur();
        resaltarOpciones();
        return;
      }
      numEl.select();
    });
    numEl.addEventListener('input', e => {
      e.stopPropagation();
      const val = parseInt(numEl.value, 10);
      if (!isNaN(val) && val >= 1) {
        qty = val;
      }
    });
    numEl.addEventListener('blur', e => {
      e.stopPropagation();
      const val = parseInt(numEl.value, 10);
      if (isNaN(val) || val < 1) {
        qty = 1;
      } else {
        qty = val;
      }
      numEl.value = qty;
    });
    numEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        numEl.blur();
      }
    });

    qtyCtrl.append(btnMenos, numWrap, btnMas);

    const agregarBtn = document.createElement('button');
    agregarBtn.className = 'agregar-btn';

    if (!estaListo()) {
      agregarBtn.innerHTML = '<span class="agregar-btn-icon">+</span><span class="agregar-btn-text">Elegí una opción</span>';
      agregarBtn.classList.add('btn-disabled');
      numEl.readOnly = true;
      qtyCtrl.classList.add('disabled');
      qtyCtrl.addEventListener('click', e => {
        e.stopPropagation();
        resaltarOpciones();
      });
      agregarBtn.addEventListener('click', e => {
        e.stopPropagation();
        resaltarOpciones();
      });
    } else {
      agregarBtn.innerHTML = '<span class="agregar-btn-icon">+</span><span class="agregar-btn-text">Agregar al pedido</span>';
      agregarBtn.addEventListener('click', e => {
        e.stopPropagation();
        const v = getVarianteSeleccionada();
        if (!v) return;
        const valActual = parseInt(numEl.value, 10);
        const finalQty = (!isNaN(valActual) && valActual >= 1) ? valActual : qty;
        agregarAlCarrito(gid, v, finalQty);
        agregarBtn.innerHTML = '<span class="agregar-btn-icon">✓</span><span class="agregar-btn-text">Agregado</span>';
        setTimeout(() => {
          agregarBtn.innerHTML = '<span class="agregar-btn-icon">+</span><span class="agregar-btn-text">Agregar más</span>';
        }, 1500);
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
      sincronizarYReanudarRotacion(gid);
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
  const imagen    = variante['Imagen']?.trim() || '';

  const existe = carrito.find(i => i.idProd === idProd);
  if (existe) {
    existe.qty += qty;
  } else {
    carrito.push({ gid, idProd, nombre, marca, varLabel, precio, precioDto, uniDto, qty, imagen });
  }

  actualizarUICarrito();

  const badge = document.getElementById(`badge-${gid}`);
  if (badge) badge.classList.add('visible');
}

function cambiarQtyCarrito(idx, delta) {
  carrito[idx].qty = Math.max(1, carrito[idx].qty + delta);
  actualizarUICarrito();
}

function cambiarQtyCarritoInput(idx, valStr, isFinal) {
  let n = parseInt(valStr, 10);
  if (!isNaN(n) && n >= 1) {
    carrito[idx].qty = n;
    actualizarUICarrito(false);

    const item = carrito[idx];
    const cont = document.getElementById('carritoItems');
    if (cont && cont.children[idx]) {
      const itemEl = cont.children[idx];
      const aplica = item.uniDto > 0 && item.qty >= item.uniDto && item.precioDto !== null;
      const pEfectivo = precioEfectivo(item);
      const subtotal = pEfectivo !== null ? formatPrecio(pEfectivo * item.qty) : 'S/P';

      let precioLinea = '';
      if (item.precio !== null) {
        if (aplica) {
          precioLinea = `<span style="text-decoration:line-through;color:var(--t3);font-size:0.78rem">${formatPrecio(item.precio)}</span> <strong style="color:var(--accent-2)">${formatPrecio(item.precioDto)}</strong> c/u`;
        } else {
          precioLinea = `${formatPrecio(item.precio)} c/u`;
        }
      } else {
        precioLinea = 'Precio a confirmar';
      }

      const precioEl = itemEl.querySelector('.ci-precio');
      if (precioEl) precioEl.innerHTML = precioLinea;

      const subtotalEl = itemEl.querySelector('.ci-subtotal');
      if (subtotalEl) subtotalEl.textContent = subtotal;
    }
  }

  if (isFinal) {
    if (isNaN(n) || n < 1) {
      carrito[idx].qty = 1;
    }
    actualizarUICarrito(true);
  }
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

function actualizarUICarrito(rerenderItems = true) {
  const total      = carrito.reduce((s, i) => s + (precioEfectivo(i) || 0) * i.qty, 0);
  const totalItems = carrito.reduce((s, i) => s + i.qty, 0);
  const hayPrecio  = carrito.some(i => i.precio !== null);

  const countEl = document.getElementById('cartCount');
  if (countEl) {
    countEl.textContent = totalItems;
    countEl.classList.toggle('visible', totalItems > 0);
  }

  const floatCountEl = document.getElementById('cartFloatingCount');
  if (floatCountEl) {
    floatCountEl.textContent = totalItems;
    floatCountEl.classList.toggle('visible', totalItems > 0);
  }

  const totalEl = document.getElementById('carritoTotal');
  if (totalEl) {
    if (hayPrecio) {
      totalEl.textContent  = formatPrecio(total);
      totalEl.className    = 'carrito-total-valor';
    } else {
      totalEl.textContent  = 'Precios a confirmar';
      totalEl.className    = 'carrito-total-valor sin-precios';
    }
  }

  const notaEl = document.getElementById('carritoNota');
  if (notaEl) {
    const sinPrecio = carrito.filter(i => i.precio === null);
    notaEl.textContent = sinPrecio.length
      ? `⚠️ ${sinPrecio.length} producto(s) sin precio. El total puede variar.`
      : '';
  }

  if (rerenderItems) {
    renderCarritoItems();
  }
}

// ══ SCROLL BOTÓN FLOTANTE CARRITO ══
window.addEventListener('scroll', () => {
  const floatBtn = document.getElementById('cartFloatingBtn');
  if (floatBtn) {
    if (window.scrollY > 100) {
      floatBtn.classList.add('visible');
    } else {
      floatBtn.classList.remove('visible');
    }
  }
}, { passive: true });

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
        precioLinea = `<span style="text-decoration:line-through;color:var(--t3);font-size:0.78rem">${formatPrecio(item.precio)}</span> <strong style="color:var(--accent-2)">${formatPrecio(item.precioDto)}</strong> c/u`;
      } else {
        precioLinea = `${formatPrecio(item.precio)} c/u`;
      }
    } else {
      precioLinea = 'Precio a confirmar';
    }

    const div = document.createElement('div');
    div.className = 'carrito-item';
    const imgHtml = item.imagen
      ? `<img src="${item.imagen}" alt="" class="ci-img" onerror="this.remove(); this.parentElement.querySelector('.ci-img-placeholder')?.classList.remove('hidden')">`
      : '';
    div.innerHTML = `
      <div class="ci-thumb">
        ${imgHtml}
        <div class="ci-img-placeholder${item.imagen ? ' hidden' : ''}">📦</div>
      </div>
      <div class="ci-info">
        <div class="ci-nombre">${item.marca} ${item.nombre}</div>
        ${item.varLabel ? `<div class="ci-variante">${item.varLabel}</div>` : ''}
        <div class="ci-precio">${precioLinea}</div>
        <div class="ci-qty-row">
          <button class="ci-qty-btn" onclick="cambiarQtyCarrito(${idx}, -1)">−</button>
          <div class="ci-qty-wrap" title="Tocá para escribir la cantidad">
            <input type="number" min="1" inputmode="numeric" pattern="[0-9]*" class="ci-qty-num" value="${item.qty}"
              onfocus="this.select()"
              oninput="cambiarQtyCarritoInput(${idx}, this.value, false)"
              onchange="cambiarQtyCarritoInput(${idx}, this.value, true)"
              onblur="cambiarQtyCarritoInput(${idx}, this.value, true)"
              onkeydown="if(event.key==='Enter') this.blur()">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ci-qty-edit-icon"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/></svg>
          </div>
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

  let msg = '🛒 *PEDIDO*\n';
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
  if (hayPrecio) msg += `*TOTAL: ${formatPrecio(total)}*\n`;

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

    const catEl = document.createElement('button');
    catEl.className = 'megamenu-cat';
    catEl.textContent = cat;
    catEl.addEventListener('click', () => {
      cerrarMegamenu();
      mostrarCatalogo(cat);
    });
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
  const item = btn.parentElement;
  const isOpen = item.classList.contains('open');
  // Cerrar todos los demás
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
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

// En pantallas chicas el placeholder completo no se alcanza a leer,
// así que se usa una versión corta.
(function ajustarPlaceholderBuscador() {
  const input = document.getElementById('buscador');
  const mq = window.matchMedia('(max-width: 600px)');
  const actualizar = () => {
    input.placeholder = mq.matches ? 'Buscar producto' : 'Buscar en el catálogo…';
  };
  actualizar();
  mq.addEventListener('change', actualizar);
})();

// ══ INIT ══
cargarDatos();

// ══ SCROLL REVEAL ══
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(el => {
      if (el.isIntersecting) {
        el.target.classList.add('visible');
        observer.unobserve(el.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

function addRevealClasses() {
  // Títulos de sección
  document.querySelectorAll('.seccion-h2-center, .sobre-title, .sobre-label').forEach(el => {
    el.classList.add('reveal');
  });

  // Pasos
  document.querySelectorAll('.paso').forEach((el, i) => {
    el.classList.add('reveal', `reveal-delay-${i + 1}`);
  });

  // Pilares de beneficios
  document.querySelectorAll('.beneficio').forEach((el, i) => {
    el.classList.add('reveal', `reveal-delay-${i + 1}`);
  });

  // Categorías
  document.querySelectorAll('.categoria-card').forEach((el, i) => {
    el.classList.add('reveal', `reveal-delay-${i + 1}`);
  });

  // FAQ items
  document.querySelectorAll('.faq-item').forEach((el, i) => {
    el.classList.add('reveal', `reveal-delay-${Math.min(i + 1, 3)}`);
  });

  // Sección vueltas SVG
  const vueltas = document.querySelector('.vueltas-svg-wrap');
  if (vueltas) vueltas.classList.add('reveal');

  // CTA final
  const cta = document.querySelector('.cta-final-inner');
  if (cta) cta.classList.add('reveal');

  initReveal();
}

// Iniciar reveal al cargar la página
document.addEventListener('DOMContentLoaded', addRevealClasses);

// ══ DESTACADOS: flechas del scroll horizontal ══
document.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('destacados-grid');
  const prev  = document.getElementById('destacadosPrev');
  const next  = document.getElementById('destacadosNext');
  if (!track || !prev || !next) return;

  const paso = () => Math.round(track.clientWidth * 0.8);
  prev.addEventListener('click', () => track.scrollBy({ left: -paso(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: paso(), behavior: 'smooth' }));

  const actualizarFlechas = () => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft >= maxScroll - 4;
  };
  track.addEventListener('scroll', actualizarFlechas);
  // Recalcular cuando cambian las cards (ej. al cargar el catálogo)
  new MutationObserver(actualizarFlechas).observe(track, { childList: true });
  window.addEventListener('resize', actualizarFlechas);
  actualizarFlechas();
});

