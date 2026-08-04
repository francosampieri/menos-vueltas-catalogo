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

// Onboarding del catálogo: se muestra una sola vez por carga de página
// (si el usuario recarga o vuelve a entrar al sitio, se vuelve a mostrar).
let onbMostrado     = false;

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
    // El build de Vercel copia app.js, styles.css, logo.svg y catalogo.json
    // desde shared/ hacia la raíz de b2b/ y b2c/ (ver vercel.json), así que
    // en producción catalogo.json queda junto a este script — ruta plana.
    const data = await fetch('catalogo.json').then(r => r.json());

    // Blindaje ante cambios de nombre en la primera columna de la hoja
    // "Productos": si el encabezado del Sheets deja de llamarse "Id" (pasó
    // con una columna llamada "f"), el cruce con la tabla de precios se
    // rompía y TODOS los productos quedaban sin precio. Acá se normaliza.
    const ALIAS_ID = ['Id', 'f', 'ID', 'id'];
    const normalizarId = fila => {
      if (fila['Id'] !== undefined && fila['Id'] !== '') return fila;
      const alias = ALIAS_ID.find(k => fila[k] !== undefined && fila[k] !== '');
      if (alias) fila['Id'] = fila[alias];
      return fila;
    };
    (data.productos   || []).forEach(normalizarId);
    (data.precios_b2c || []).forEach(normalizarId);
    (data.precios_b2b || []).forEach(normalizarId);

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
    let sinPrecio = 0;
    productos.forEach(p => {
      const precio = preciosPorId[p['Id']];
      if (!precio) sinPrecio++;
      p['Precio_Venta'] = precio ? precio['Precio_Venta'] : '';
      p['Uni Dto']      = precio ? precio['Uni Dto']      : '';
      p['Dto']          = precio ? precio['Dto']          : '';
      p['Precio_Dto']   = precio ? precio['Precio_Dto']   : '';
    });

    // Si prácticamente ningún producto encontró precio, casi seguro cambió
    // un encabezado en el Sheets: se avisa en consola para detectarlo rápido.
    if (productos.length && sinPrecio / productos.length > 0.5) {
      console.warn(`[Menos Vueltas] ${sinPrecio}/${productos.length} productos sin precio. ` +
        'Revisá que las hojas "Productos" y "Precios" tengan la columna Id con el mismo nombre.');
    }

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

const MQ_MOBILE = window.matchMedia('(max-width: 600px)');

// Categorías desplegadas en el sidebar (se abren solas al elegirlas)
const catsAbiertas = new Set();

// ══ RENDER CATÁLOGO ══
function renderCatalogo() {
  document.getElementById('loading').style.display = 'none';
  construirFiltrosCategorias();
  construirSidebar();
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

  // El sidebar refleja qué categoría/subcategoría está activa
  construirSidebar();
  actualizarEncabezadoCatalogo(filtrados.length);

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

    // El título "clásico" (línea gris con la subcategoría) solo se usa en la
    // grilla; los rieles de mobile tienen su propio encabezado. Y si el
    // usuario ya está dentro de esa subcategoría, el título repetiría lo
    // que dice el encabezado grande: se omite.
    const tituloRedundante = filtroSubcat && !busquedaActiva;
    if (!usarRieles() && !tituloRedundante) {
      const titulo = document.createElement('div');
      titulo.className = 'seccion-titulo';
      titulo.textContent = sub || cat;
      cont.appendChild(titulo);
    }

    // ── Mobile: riel horizontal por subcategoría ──
    // Con 500+ productos, la grilla vertical obliga a un scroll infinito.
    // En mobile cada subcategoría se convierte en un carrusel horizontal con
    // todos sus productos: se recorre la sección que interesa deslizando y
    // se pasa a la siguiente scrolleando hacia abajo.
    if (usarRieles()) {
      const sec = document.createElement('section');
      sec.className = 'riel-sec';

      // ── Encabezado ──
      // Marca de color + nombre grande de la subcategoría, con la categoría
      // madre como "breadcrumb" chiquito arriba y el conteo a la derecha.
      const head = document.createElement('div');
      head.className = 'riel-head';
      head.innerHTML = `
        <span class="riel-head-marca" aria-hidden="true"></span>
        <div class="riel-head-txt">
          <span class="riel-head-cat"></span>
          <h3 class="riel-head-titulo"></h3>
        </div>
        <span class="riel-head-cuenta"></span>`;
      head.querySelector('.riel-head-cat').textContent = cat;
      head.querySelector('.riel-head-titulo').textContent = sub || cat;
      head.querySelector('.riel-head-cuenta').textContent =
        items.length === 1 ? '1 producto' : `${items.length} productos`;
      sec.appendChild(head);

      // ── Riel + indicadores de desplazamiento ──
      const wrap = document.createElement('div');
      wrap.className = 'riel-wrap';

      const riel = document.createElement('div');
      riel.className = 'riel';
      items.forEach(([gid, vars]) => riel.appendChild(crearCard(gid, vars)));

      // Chevrons laterales: son solo una señal visual de que hay más
      // productos para ese lado. A propósito NO son botones (no se pueden
      // tocar): la forma de moverse es deslizando.
      const mkFlecha = (dir) => {
        const f = document.createElement('span');
        f.className = 'riel-flecha riel-flecha-' + (dir > 0 ? 'der' : 'izq');
        f.setAttribute('aria-hidden', 'true');
        f.innerHTML = dir > 0
          ? '<svg viewBox="0 0 20 20" fill="none"><path d="M8 4l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : '<svg viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        return f;
      };
      const flechaIzq = mkFlecha(-1);
      const flecha = mkFlecha(1);

      wrap.append(riel, flechaIzq, flecha);
      sec.appendChild(wrap);
      cont.appendChild(sec);

      conectarIndicadoresRiel(wrap, riel);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid';
    items.forEach(([gid, vars]) => grid.appendChild(crearCard(gid, vars)));
    cont.appendChild(grid);
  });
}

// ¿Corresponde mostrar el catálogo como rieles horizontales?
// Solo en mobile, mientras se está "explorando": si hay una búsqueda activa
// o el usuario ya entró a una subcategoría puntual, se muestra la grilla
// completa de siempre.
function usarRieles() {
  return MQ_MOBILE.matches && !busquedaActiva && !filtroSubcat;
}

// Mantiene sincronizados los indicadores de un riel: sombra/flecha a la
// derecha mientras queden productos por ver, sombra a la izquierda cuando
// ya se desplazó.
function conectarIndicadoresRiel(wrap, riel) {
  const actualizar = () => {
    const max = riel.scrollWidth - riel.clientWidth;
    if (max <= 4) {
      wrap.classList.remove('hay-mas', 'hay-antes');
      return;
    }
    const x = riel.scrollLeft;
    wrap.classList.toggle('hay-mas', x < max - 4);
    wrap.classList.toggle('hay-antes', x > 4);
  };

  riel.addEventListener('scroll', () => {
    if (riel._rafPend) return;
    riel._rafPend = true;
    requestAnimationFrame(() => { riel._rafPend = false; actualizar(); });
  }, { passive: true });

  // El scrollWidth recién es correcto cuando cargaron las imágenes.
  // Además se fuerza el arranque en 0: si el navegador aplica el snap antes
  // de tiempo, el riel puede quedar corrido unos píxeles y mostrar la sombra
  // y la flecha izquierda sin que el usuario haya deslizado nada.
  riel.scrollLeft = 0;
  requestAnimationFrame(() => { riel.scrollLeft = 0; actualizar(); });
  setTimeout(actualizar, 600);
  setTimeout(actualizar, 1800);
  window.addEventListener('resize', actualizar);
}

// Al girar el teléfono o cambiar de breakpoint hay que rearmar el catálogo
// (rieles ⇄ grilla).
MQ_MOBILE.addEventListener('change', () => {
  if (document.getElementById('catalogo')?.childElementCount) renderGrupos();
});

// ══════════════════════════════════════════════════════
//  SIDEBAR DE CATEGORÍAS (escritorio)
//  En pantalla ancha la navegación deja de ser una fila de chips y pasa a
//  una columna fija: categorías + subcategorías siempre visibles, con el
//  conteo de productos de cada una. En mobile el sidebar se oculta por CSS.
// ══════════════════════════════════════════════════════
// Iconos de categoría: los mismos que usa la sección "Categorías
// principales" de la landing, para que la navegación hable un solo idioma
// visual. Se guardan solo los <path> internos; el <svg> lo arma getIconoCat.
const ICONOS_CAT = {
  'Almacen': '<path d="M3 9l1-5h16l1 5"/><path d="M4 9h16v10a1 1 0 01-1 1H5a1 1 0 01-1-1V9z"/><line x1="9" y1="13" x2="15" y2="13"/>',
  'Desayuno y Mediatarde': '<g transform="translate(1,2)"><path d="M3 8h14v6a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><path d="M17 9h2a2 2 0 012 2v1a2 2 0 01-2 2h-2"/><line x1="6" y1="2" x2="6" y2="5"/><line x1="10" y1="2" x2="10" y2="5"/><line x1="14" y1="2" x2="14" y2="5"/></g>',
  'Higiene Personal': '<path d="M4 12h16a1 1 0 011 1v3a4 4 0 01-4 4H7a4 4 0 01-4-4v-3a1 1 0 011-1z"/><path d="M6 12V5a2 2 0 012-2h3v2.25"/><path d="M4 21l1-1.5"/><path d="M20 21l-1-1.5"/>',
  'Hogar y Ferreteria': '<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"/><path d="M9 21v-6h6v6"/>',
  'Limpieza': '<path d="M4 12a2 2 0 012-2h4a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7"/><path d="M6 10V6a1 1 0 011-1h2a1 1 0 011 1v4"/><path d="M15 7h.01"/><path d="M18 9h.01"/><path d="M18 5h.01"/><path d="M21 3h.01"/><path d="M21 7h.01"/><path d="M21 11h.01"/><path d="M10 7h1"/>',
  'Snacks y Golosinas': '<path d="M7.05 11.293l4.243-4.243a2 2 0 012.828 0l2.829 2.83a2 2 0 010 2.828l-4.243 4.243a2 2 0 01-2.828 0l-2.829-2.831a2 2 0 010-2.828"/><path d="M16.243 9.172l3.086-.772a1.5 1.5 0 00.697-2.516l-2.216-2.217a1.5 1.5 0 00-2.44.47l-1.248 2.913"/><path d="M9.172 16.243l-.772 3.086a1.5 1.5 0 01-2.516.697l-2.217-2.216a1.5 1.5 0 01.47-2.44l2.913-1.248"/>',
  // Genérico (bolsa) para "Todo el catálogo" y cualquier categoría nueva
  '_default': '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>'
};

// Normaliza acentos para que "Almacén" encuentre la clave "Almacen".
function getIconoCat(cat) {
  const sinAcentos = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clave = Object.keys(ICONOS_CAT).find(k =>
    sinAcentos(k).toLowerCase() === sinAcentos(cat || '').toLowerCase());
  const paths = ICONOS_CAT[clave] || ICONOS_CAT['_default'];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function contarPorCategoria() {
  const porCat = {}, porSub = {};
  Object.entries(catalogo).forEach(([gid, vars]) => {
    const g = grupos[gid] || {};
    const cat = g.categoria    || vars[0]['Categoria']    || 'Otros';
    const sub = g.subcategoria || vars[0]['Subcategoria'] || '';
    porCat[cat] = (porCat[cat] || 0) + 1;
    const k = cat + '|||' + sub;
    porSub[k] = (porSub[k] || 0) + 1;
  });
  return { porCat, porSub };
}

function construirSidebar() {
  const nav = document.getElementById('catNav');
  if (!nav) return;
  nav.innerHTML = '';

  const { porCat, porSub } = contarPorCategoria();
  const total = Object.keys(catalogo).length;

  // "Todo el catálogo"
  const btnTodos = document.createElement('button');
  btnTodos.className = 'cat-nav-btn' + (filtroActivo === 'Todos' && !busquedaActiva ? ' active' : '');
  btnTodos.innerHTML = `<span class="cat-nav-icono">${getIconoCat('_default')}</span>
    <span class="cat-nav-txt">Todo el catálogo</span>
    <span class="cat-nav-num">${total}</span>`;
  btnTodos.onclick = () => {
    catsAbiertas.clear();
    setFiltroCategoria('Todos', document.querySelector('.filtro-btn[data-cat="Todos"]'));
  };
  nav.appendChild(btnTodos);

  Object.keys(porCat).forEach(cat => {
    const abierta = catsAbiertas.has(cat);

    const btn = document.createElement('button');
    btn.className = 'cat-nav-btn' + (filtroActivo === cat && !filtroSubcat ? ' active' : '')
                                  + (filtroActivo === cat ? ' en-rama' : '');
    btn.innerHTML = `<span class="cat-nav-icono">${getIconoCat(cat)}</span>
      <span class="cat-nav-txt">${cat}</span>
      <span class="cat-nav-num">${porCat[cat]}</span>
      <span class="cat-nav-chevron${abierta ? ' abierto' : ''}">
        <svg viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>`;
    btn.onclick = () => {
      // Elegir la categoría siempre la despliega; volver a tocarla la pliega.
      if (filtroActivo === cat && !filtroSubcat && abierta) {
        catsAbiertas.delete(cat);
        construirSidebar();
        return;
      }
      catsAbiertas.clear();
      catsAbiertas.add(cat);
      setFiltroCategoria(cat, document.querySelector(`.filtro-btn[data-cat="${CSS.escape(cat)}"]`));
    };
    nav.appendChild(btn);

    const subs = Object.keys(porSub)
      .filter(k => k.startsWith(cat + '|||'))
      .map(k => k.split('|||')[1])
      .filter(Boolean);

    if (!subs.length) return;

    const grupo = document.createElement('div');
    grupo.className = 'cat-nav-subs' + (abierta ? ' abierto' : '');
    subs.forEach(sub => {
      const s = document.createElement('button');
      s.className = 'cat-nav-sub' + (filtroActivo === cat && filtroSubcat === sub ? ' active' : '');
      s.innerHTML = `<span class="cat-nav-txt">${sub}</span>
        <span class="cat-nav-num">${porSub[cat + '|||' + sub]}</span>`;
      s.onclick = () => {
        catsAbiertas.clear();
        catsAbiertas.add(cat);
        filtroActivo = cat;
        busquedaActiva = '';
        const input = document.getElementById('buscador');
        if (input) input.value = '';
        document.querySelectorAll('.filtro-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
        setFiltroSubcat(filtroSubcat === sub ? null : sub);
      };
      grupo.appendChild(s);
    });
    nav.appendChild(grupo);
  });
}

// Encabezado de la grilla: breadcrumb, título y cantidad de resultados.
function actualizarEncabezadoCatalogo(cantidad) {
  const crumb  = document.getElementById('catalogoCrumb');
  const h1     = document.getElementById('catalogoH1');
  const cuenta = document.getElementById('catalogoCuenta');
  if (!h1) return;

  let titulo, ruta;
  if (busquedaActiva) {
    titulo = `Resultados para “${busquedaActiva}”`;
    ruta = ['Catálogo', 'Búsqueda'];
  } else if (filtroSubcat) {
    titulo = filtroSubcat;
    ruta = ['Catálogo', filtroActivo, filtroSubcat];
  } else if (filtroActivo && filtroActivo !== 'Todos') {
    titulo = filtroActivo;
    ruta = ['Catálogo', filtroActivo];
  } else {
    titulo = 'Catálogo completo';
    ruta = ['Catálogo'];
  }

  h1.textContent = titulo;
  cuenta.textContent = cantidad === 1 ? '1 producto' : `${cantidad} productos`;

  crumb.innerHTML = '';
  ruta.forEach((paso, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'catalogo-crumb-sep';
      sep.textContent = '›';
      crumb.appendChild(sep);
    }
    const esUltimo = i === ruta.length - 1;
    const el = document.createElement(esUltimo ? 'span' : 'button');
    el.className = 'catalogo-crumb-paso' + (esUltimo ? ' actual' : '');
    el.textContent = paso;
    if (!esUltimo) {
      const destino = i === 0 ? 'Todos' : paso;
      el.onclick = () => {
        catsAbiertas.clear();
        if (destino !== 'Todos') catsAbiertas.add(destino);
        setFiltroCategoria(destino, document.querySelector(`.filtro-btn[data-cat="${CSS.escape(destino)}"]`));
      };
    }
    crumb.appendChild(el);
  });
}

// ══ CARD ══
function getEmoji(cat) {
  const map = {
    'Almacen': '🥫', 'Almacén': '🥫', 'Limpieza': '🧽', 'Higiene Personal': '🧴',
    'Snacks y Golosinas': '🍬', 'Desayuno y Mediatarde': '☕',
    'Hogar y Ferreteria': '🔧', 'Hogar y Ferretería': '🔧'
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

  card.append(imgWrap, badge, body);

  // Inicializar vista con variante 0
  if (rotaciones[gid]?.timer) clearInterval(rotaciones[gid].timer);
  rotaciones[gid] = { indexActual: 0, timer: null };
  actualizarVistaCerrada(gid, vars, 0, img, vlabelEl, vprecioEl, vprecioDtoEl, false);

  // Rotación automática si hay múltiples variantes
  if (vars.length > 1) iniciarRotacion(gid, vars, img, vlabelEl, vprecioEl, vprecioDtoEl);

  // Click: abre el detalle en una ventana centrada (modal). Antes la card
  // se expandía en el lugar, lo que en mobile descolocaba todo el catálogo.
  card.addEventListener('click', () => abrirModalProducto(gid, vars));

  return card;
}

// Refresca la parte "de arriba" de una card (o del modal): label de
// variante, precio, precio con descuento, imagen y dots.
// Los elementos se pasan por parámetro para que sirva tanto para la card
// del catálogo como para el modal de producto.
function actualizarVistaCerrada(gid, vars, idx, imgEl, vlabelEl, vprecioEl, vprecioDtoEl, animar = true, dotsEl = null) {
  const v = vars[idx];
  const precio    = parsePrecio(v['Precio_Venta']);
  const precioDto = parsePrecio(v['Precio_Dto']);
  const uniDto    = parseInt(v['Uni Dto']) || 0;
  const hayDto    = uniDto > 0 && precioDto !== null;

  const aplicarCambios = (entrando) => {
    // Label
    if (vlabelEl) vlabelEl.textContent = buildVarianteLabel(v, vars);

    // Precio. La clase base se recuerda la primera vez, así el mismo código
    // sirve para .card-precio (catálogo) y .pm-precio (modal).
    if (vprecioEl) {
      if (!vprecioEl.dataset.claseBase) {
        vprecioEl.dataset.claseBase = vprecioEl.className || 'card-precio';
      }
      const base = vprecioEl.dataset.claseBase;
      if (precio !== null) {
        vprecioEl.textContent = formatPrecio(precio);
        vprecioEl.className = base;
      } else {
        vprecioEl.textContent = 'Precio a confirmar';
        vprecioEl.className = base + ' sin-precio';
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
        actualizarDots(gid, idx, dotsEl);
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

function actualizarDots(gid, idx, dotsEl) {
  dotsEl = dotsEl || document.getElementById(`dots-${gid}`);
  if (dotsEl) {
    dotsEl.querySelectorAll('.variante-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  }
}

function iniciarRotacion(gid, vars, imgEl, vlabelEl, vprecioEl, vprecioDtoEl) {
  const rot = rotaciones[gid];
  if (!rot) return;
  if (rot.timer) clearInterval(rot.timer);
  rot.timer = setInterval(() => {
    const card = document.getElementById(`card-${gid}`);
    // Mientras el producto esté abierto en el modal, la card no rota.
    if (!card || document.getElementById('productoModal')) return;
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

// ══════════════════════════════════════════════════════
//  MODAL DE PRODUCTO
//  Tocar una card abre el detalle en una ventana centrada con el fondo
//  desenfocado, en vez de expandir la card dentro del catálogo (que en
//  mobile desacomodaba el riel y dejaba al usuario perdido).
// ══════════════════════════════════════════════════════
function abrirModalProducto(gid, vars) {
  cerrarModalProducto(true);

  const g = grupos[gid] || {};
  const nombre = g.nombre || vars[0]['Producto'] || 'Producto';
  const marca  = g.marca  || vars[0]['Marca']    || '';
  const cat    = g.categoria || vars[0]['Categoria'] || '';

  const overlay = document.createElement('div');
  overlay.className = 'pm-overlay';
  overlay.id = 'productoModal';
  overlay.dataset.gid = gid;

  // Estructura en dos columnas: en desktop la foto va a la izquierda y toda
  // la información a la derecha (modal apaisado que entra sin scroll); en
  // mobile las columnas se apilan.
  overlay.innerHTML = `
    <div class="pm-panel" role="dialog" aria-modal="true" aria-label="${nombre}">
      <button class="pm-close" aria-label="Cerrar">
        <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      <div class="pm-media">
        <div class="pm-img">
          <div class="pm-img-placeholder"></div>
          <img alt="" style="display:none">
        </div>
        <button class="pm-nav pm-nav-prev" aria-label="Opción anterior">
          <svg viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="pm-nav pm-nav-next" aria-label="Opción siguiente">
          <svg viewBox="0 0 20 20" fill="none"><path d="M8 4l6 6-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="pm-dots"></div>
      </div>
      <div class="pm-col">
        <div class="pm-info">
          <div class="pm-marca"></div>
          <h3 class="pm-nombre"></h3>
          <div class="pm-variante"></div>
          <div class="pm-precio-wrap">
            <div class="pm-precio"></div>
            <div class="pm-precio-dto" style="display:none"></div>
          </div>
        </div>
        <div class="pm-detalle card-expanded pm-detalle-visible"></div>
      </div>
    </div>`;

  const panel   = overlay.querySelector('.pm-panel');
  const media   = overlay.querySelector('.pm-media');
  const imgEl   = overlay.querySelector('.pm-img img');
  const dotsEl  = overlay.querySelector('.pm-dots');
  const detalle = overlay.querySelector('.pm-detalle');

  overlay.querySelector('.pm-img-placeholder').textContent = getEmoji(cat);
  overlay.querySelector('.pm-marca').textContent  = marca;
  overlay.querySelector('.pm-nombre').textContent = nombre;

  if (vars.length > 1) {
    vars.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'variante-dot' + (i === 0 ? ' active' : '');
      dotsEl.appendChild(d);
    });
  } else {
    panel.classList.add('sin-variantes');
  }

  document.body.appendChild(overlay);
  bloquearScrollFondo(true);

  const api = renderDetalleProducto(gid, vars, {
    cont: detalle,
    imgEl,
    vlabelEl:     overlay.querySelector('.pm-variante'),
    vprecioEl:    overlay.querySelector('.pm-precio'),
    vprecioDtoEl: overlay.querySelector('.pm-precio-dto'),
    dotsEl
  });

  // Cambio de variante: flechas al costado de la foto (desktop y mobile) y
  // deslizando sobre la imagen (mobile).
  if (vars.length > 1 && api && api.irAVariante) {
    overlay.querySelector('.pm-nav-prev').addEventListener('click', e => { e.stopPropagation(); api.irAVariante(-1); });
    overlay.querySelector('.pm-nav-next').addEventListener('click', e => { e.stopPropagation(); api.irAVariante(1); });
    attachSwipeModal(media, api.irAVariante);
  }

  // Cerrar: la X, tocar fuera del panel o Escape.
  overlay.querySelector('.pm-close').addEventListener('click', () => cerrarModalProducto());
  overlay.addEventListener('click', e => { if (e.target === overlay) cerrarModalProducto(); });
  panel.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('keydown', escCerrarModal);

  requestAnimationFrame(() => overlay.classList.add('visible'));
}

// Deslizar horizontalmente sobre la foto del modal para pasar de una
// variante a otra. No interfiere con el scroll vertical del panel.
function attachSwipeModal(zona, irAVariante) {
  let x0 = 0, y0 = 0, activo = false, decidido = false, horizontal = false;
  const UMBRAL = 34;

  zona.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    activo = true; decidido = false; horizontal = false;
  }, { passive: true });

  zona.addEventListener('touchmove', e => {
    if (!activo) return;
    const dx = e.touches[0].clientX - x0;
    const dy = e.touches[0].clientY - y0;
    if (!decidido && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      decidido = true;
      horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (horizontal) e.preventDefault();
  }, { passive: false });

  zona.addEventListener('touchend', e => {
    if (!activo) return;
    activo = false;
    if (!horizontal) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) < UMBRAL) return;
    irAVariante(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// Bloquea el scroll de la página de fondo mientras hay un modal abierto,
// conservando la posición (en iOS no alcanza con overflow:hidden).
let scrollGuardado = 0;
function bloquearScrollFondo(activar) {
  if (activar) {
    scrollGuardado = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${scrollGuardado}px`;
    document.body.classList.add('modal-abierto');
  } else {
    document.body.classList.remove('modal-abierto');
    document.body.style.top = '';
    // Restaurar la posición. Se hace en el frame siguiente porque, al sacar
    // el position:fixed, el documento todavía no recuperó su altura y el
    // scrollTo quedaría recortado.
    // 'instant' evita que el scroll-behavior:smooth global anime la vuelta
    // (se vería como un salto raro al cerrar el modal).
    const y = scrollGuardado;
    window.scrollTo({ top: y, behavior: 'instant' });
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
  }
}

function escCerrarModal(e) {
  if (e.key === 'Escape') cerrarModalProducto();
}

function cerrarModalProducto(inmediato = false) {
  const overlay = document.getElementById('productoModal');
  if (!overlay) return;
  document.removeEventListener('keydown', escCerrarModal);
  bloquearScrollFondo(false);

  const gid = overlay.dataset.gid;
  const quitar = () => {
    overlay.remove();
    // La card del catálogo quedó con la variante que rotaba antes: se
    // reanuda su rotación normalmente.
    if (gid) sincronizarYReanudarRotacion(gid);
  };

  if (inmediato) { overlay.remove(); return; }
  overlay.classList.remove('visible');
  setTimeout(quitar, 200);
}

// ══ DETALLE DE PRODUCTO (contenido del modal) ══
// refs = { cont, imgEl, vlabelEl, vprecioEl, vprecioDtoEl, dotsEl }
function renderDetalleProducto(gid, vars, refs) {
  const expanded = refs.cont;
  const imgEl = refs.imgEl;
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
    // Encabezado del modal (foto, variante y precio). Si todavía no se
    // eligió opción, se muestra la primera a modo de vista previa: si no,
    // el modal abriría sin foto ni precio y parecería roto.
    const idxSel = varSel ? vars.indexOf(varSel) : 0;
    actualizarVistaCerrada(gid, vars, idxSel >= 0 ? idxSel : 0, imgEl,
      refs.vlabelEl, refs.vprecioEl, refs.vprecioDtoEl, !esPrimeraDibujada, refs.dotsEl);
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

  }

  dibujar();

  // API para el modal: permite pasar a la variante siguiente/anterior desde
  // las flechas laterales o deslizando sobre la foto, manteniendo los chips
  // sincronizados con lo que se ve.
  return {
    irAVariante(dir) {
      if (vars.length < 2) return;
      const actual = getVarianteSeleccionada() || vars[0];
      const idx = vars.indexOf(actual);
      const nueva = vars[((idx >= 0 ? idx : 0) + dir + vars.length) % vars.length];
      selVariante = nueva['Label_Variante'] || null;
      selTamaño   = nueva['Label_Tamaño']   || null;
      dibujar();
    }
  };
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
  if (cat) { catsAbiertas.clear(); if (cat !== 'Todos') catsAbiertas.add(cat); }
  construirSidebar();

  mostrarOnboardingToast();
}

// Franja de onboarding: avisa una sola vez por carga de página que las
// cards se pueden tocar para ver variantes y precio por cantidad. Solo
// se cierra con el botón "Entendido" — no sola ni al tocar un producto,
// para asegurarnos de que se lea. Si el usuario recarga o vuelve a entrar
// más tarde, se vuelve a mostrar (no se guarda en localStorage a propósito).
function mostrarOnboardingToast() {
  if (onbMostrado) return;
  if (document.getElementById('onbToast')) return;
  onbMostrado = true;

  const toast = document.createElement('div');
  toast.id = 'onbToast';
  toast.className = 'onb-toast';
  toast.innerHTML = `
    <span class="onb-toast-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>
    </span>
    <span class="onb-toast-text">Tocá cualquier producto para ver sus variantes y precios por cantidad.</span>
    <button class="onb-toast-close">Entendido</button>
  `;
  document.body.appendChild(toast);

  toast.querySelector('.onb-toast-close').addEventListener('click', () => {
    document.getElementById('onbToast')?.remove();
  });
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

// ══════════════════════════════════════════════════════
//  DEMO "CÓMO HACER UN PEDIDO"
//  Un mockup (notebook en escritorio, teléfono en mobile) reproduce el paso
//  activo. Avanza solo cada 11 s y también se puede elegir a mano.
//  La secuencia arranca recién cuando la sección entra en pantalla, para que
//  nadie se pierda el principio, y se pausa al salir.
// ══════════════════════════════════════════════════════
// La duración la define el CSS (--demo-dur), que cambia según el
// dispositivo: en mobile la secuencia es más corta porque no hay puntero
// que se traslade entre un toque y otro.
function duracionPaso() {
  const zona = document.querySelector('.demo-pasos');
  if (!zona) return 9000;
  const v = getComputedStyle(zona).getPropertyValue('--demo-dur').trim();
  const n = parseFloat(v);
  if (!n) return 9000;
  return v.endsWith('ms') ? n : n * 1000;
}
let pasoActual = 1;
let pasoTimer = null;
let pasoEnPantalla = false;
let demoArrancada = false;

function irAPaso(n) {
  const items = document.querySelectorAll('.paso-item');
  if (!items.length) return;

  pasoActual = n;

  items.forEach(b => {
    const activo = Number(b.dataset.paso) === n;
    b.classList.toggle('activo', activo);
    b.setAttribute('aria-current', activo ? 'step' : 'false');
  });

  // Las dos maquetas (notebook y teléfono) se sincronizan a la vez: solo
  // una está visible según el ancho, pero así no hay que preguntar cuál.
  document.querySelectorAll('.mk-pant').forEach(p => {
    p.classList.toggle('activa', Number(p.dataset.paso) === n);
  });

  // Si el usuario elige un paso a mano antes de que la demo arranque sola,
  // se destraban las animaciones igual.
  if (!demoArrancada) arrancarDemo();
  reiniciarAnimaciones();
  programarPasoSiguiente();
}

// Fuerza a que todas las animaciones del paso activo empiecen desde cero.
// Sin esto, al cambiar de paso el nuevo mockup entra "a mitad de camino",
// porque las animaciones CSS comparten el reloj del documento.
function reiniciarAnimaciones() {
  const zona = document.querySelector('.demo-pasos');
  if (!zona) return;
  const objetivos = zona.querySelectorAll('.mk-pant.activa *, .paso-item.activo .paso-anillo-fill');
  objetivos.forEach(el => {
    el.style.animation = 'none';
  });
  void zona.offsetWidth;                       // fuerza un reflow
  objetivos.forEach(el => { el.style.animation = ''; });
}

function arrancarDemo() {
  demoArrancada = true;
  document.querySelector('.demo-pasos')?.classList.add('demo-lista');
}

function programarPasoSiguiente() {
  clearTimeout(pasoTimer);
  if (!pasoEnPantalla) return;
  pasoTimer = setTimeout(() => irAPaso(pasoActual % 3 + 1), duracionPaso());
}

function initDemoPasos() {
  const seccion = document.getElementById('como-comprar');
  if (!seccion || !document.querySelector('.paso-item')) return;

  // Estado inicial sin animar: el paso 1 queda "congelado" en su primer
  // fotograma hasta que la sección se ve.
  document.querySelectorAll('.mk-pant').forEach(p => {
    p.classList.toggle('activa', Number(p.dataset.paso) === 1);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        pasoEnPantalla = e.isIntersecting;
        if (!pasoEnPantalla) { clearTimeout(pasoTimer); return; }
        // Primera vez que se ve: recién ahí empieza todo, desde el paso 1.
        if (!demoArrancada) {
          arrancarDemo();
          irAPaso(1);
        } else {
          programarPasoSiguiente();
        }
      });
    }, { threshold: 0.35 }).observe(seccion);
  } else {
    pasoEnPantalla = true;
    arrancarDemo();
    irAPaso(1);
  }
}

document.addEventListener('DOMContentLoaded', initDemoPasos);

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

  // Pasos (lista de la demo animada)
  document.querySelectorAll('.paso-item').forEach((el, i) => {
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

