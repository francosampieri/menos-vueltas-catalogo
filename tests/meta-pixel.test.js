const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function pixel({ channel = 'B2C', enabled = true, pixelId = '123456789012345', href = 'https://example.test/', referrer = '' } = {}) {
  const calls = [], scripts = [];
  const window = { CANAL: channel, META_PIXEL_B2C: { enabled, pixelId } };
  const document = { referrer, createElement: () => ({}), head: { appendChild: s => scripts.push(s) } };
  const context = vm.createContext({ window, document, location: { href }, URL });
  const source = read('shared/meta-pixel.js');
  vm.runInContext(source, context);
  return {
    api: window.MVMetaPixel, calls, scripts, window, context,
    reloadModule: () => vm.runInContext(source, context),
    load: () => {
      window.fbq.callMethod = (...args) => calls.push(JSON.parse(JSON.stringify(args)));
      window.fbq.queue.splice(0).forEach(args => window.fbq.callMethod(...args));
      scripts[0].onload();
    }
  };
}

test('authorized B2C loads once and emits one PageView per document', () => {
  const p = pixel();
  assert.equal(p.scripts.length, 0);
  p.api.setConsent(true);
  p.api.init();
  p.reloadModule();
  assert.equal(p.scripts.length, 1);
  assert.equal(p.scripts[0].async, true);
  p.load();
  p.api.init();
  assert.equal(p.calls.filter(c => c[0] === 'init').length, 1);
  assert.deepEqual(p.calls.filter(c => c[0] === 'trackSingle'), [['trackSingle', '123456789012345', 'PageView']]);
  const fresh = pixel(); fresh.api.setConsent(true); fresh.load();
  assert.equal(fresh.calls.filter(c => c[2] === 'PageView').length, 1);
});

test('B2B, admin, disabled, invalid ID and missing consent never load Meta', () => {
  for (const options of [{ channel: 'B2B' }, { channel: 'ADMIN' }, { channel: undefined, enabled: false }, { enabled: false }, { pixelId: '' }, { pixelId: 'invalid' }]) {
    const p = pixel(options); p.api.setConsent(true); p.api.addToCart('21', 2); p.api.whatsAppOrderClick();
    assert.equal(p.scripts.length, 0); assert.equal(p.calls.length, 0);
  }
  const p = pixel(); p.api.addToCart('21', 2); p.api.whatsAppOrderClick();
  assert.equal(p.scripts.length, 0);
});

test('late consent ignores earlier actions; slow SDK retains only authorized actions', () => {
  const p = pixel();
  p.api.addToCart('21', 1); p.api.whatsAppOrderClick();
  p.api.setConsent(true);
  p.api.addToCart('22', 3); p.api.whatsAppOrderClick();
  assert.equal(p.calls.length, 0);
  p.load();
  assert.deepEqual(p.calls.filter(c => c[0].startsWith('track')), [
    ['trackSingle', '123456789012345', 'PageView'],
    ['trackSingle', '123456789012345', 'AddToCart', { content_ids: ['22'], content_type: 'product', contents: [{ id: '22', quantity: 3 }] }],
    ['trackSingleCustom', '123456789012345', 'WhatsAppOrderClick', { channel: 'B2C' }]
  ]);
});

test('revocation discards pending events and regrant never replays them', () => {
  for (const loaded of [false, true]) {
    const p = pixel(); p.api.setConsent(true);
    if (loaded) p.load();
    p.api.addToCart('21', 2); p.api.setConsent(false);
    const count = p.calls.length;
    p.api.addToCart('22', 3); p.api.whatsAppOrderClick();
    if (!loaded) p.load();
    assert.equal(p.calls.filter(c => c[2] === 'AddToCart').length, loaded ? 1 : 0);
    assert.equal(p.calls.filter(c => c[2] === 'WhatsAppOrderClick').length, 0);
    if (loaded) assert.equal(p.calls.length, count);
    p.api.setConsent(true); p.api.addToCart('23', 4);
    assert.equal(p.calls.filter(c => c[2] === 'PageView').length, 1);
    assert.equal(p.calls.filter(c => c[2] === 'AddToCart').length, loaded ? 2 : 1);
    assert.ok(p.calls.some(c => c[0] === 'consent' && c[1] === 'revoke'));
  }
});

test('variant IDs and valid quantities only; deliberate repeats count separately', () => {
  const p = pixel(); p.api.setConsent(true); p.load();
  for (const qty of [0, -1, NaN, Infinity, 1.5, '2']) p.api.addToCart('21', qty);
  for (const id of ['', undefined, 'private-text']) p.api.addToCart(id, 1);
  p.api.addToCart(21, 2); p.api.addToCart('21', 1);
  const events = p.calls.filter(c => c[2] === 'AddToCart');
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(c => c[3].contents), [[{ id: '21', quantity: 2 }], [{ id: '21', quantity: 1 }]]);
});

test('unsafe document/referrer URLs do not reach the SDK; cleaned QR can initialize later', () => {
  for (const options of [
    { href: 'https://example.test/?email=synthetic%40example.invalid' },
    { href: 'https://example.test/#P21X2:CPRUEBA' },
    { referrer: 'https://example.test/?message=synthetic' },
    { href: 'https://example.test/admin/' }
  ]) { const p = pixel(options); p.api.setConsent(true); assert.equal(p.scripts.length, 0); }
  const p = pixel({ href: 'https://example.test/#P21X2' }); p.api.setConsent(true);
  p.context.location.href = 'https://example.test/'; p.api.init(); p.load();
  assert.equal(p.calls.filter(c => c[2] === 'PageView').length, 1);
  const ad = pixel({ href: 'https://example.test/?fbclid=FAKE_AD_CLICK' }); ad.api.setConsent(true); ad.load();
  assert.equal(ad.calls.filter(c => c[2] === 'PageView').length, 1);
});

test('SDK load or transport failure stays contained and never retries events', () => {
  const blocked = pixel(); blocked.api.setConsent(true); blocked.api.addToCart('21', 1);
  blocked.scripts[0].onerror();
  assert.doesNotThrow(() => { blocked.api.init(); blocked.api.whatsAppOrderClick(); });
  assert.equal(blocked.scripts.length, 1);
  const p = pixel(); p.api.setConsent(true); p.load();
  p.window.fbq.callMethod = () => { throw Error('blocked'); };
  assert.doesNotThrow(() => { p.api.addToCart('21', 1); p.api.whatsAppOrderClick(); p.api.setConsent(false); });
});

function configuredPage(options = {}) {
  const html = read('b2c/index.html');
  const config = { window: {} };
  vm.runInNewContext(html.match(/window\.META_PIXEL_B2C\s*=\s*\{[^}]+\}/)[0], config);
  const p = pixel({ ...config.window.META_PIXEL_B2C, ...options });
  const startup = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(source => source.includes('MVMetaPixel'));
  assert.ok(startup, 'B2C must start tracking from its HTML without a visitor action');
  p.start = () => vm.runInContext(startup, p.context);
  p.start();
  return p;
}

test('B2C HTML automatically starts its Pixel once, with no noscript bypass', () => {
  const html = read('b2c/index.html');
  const config = { window: {} };
  vm.runInNewContext(html.match(/window\.META_PIXEL_B2C\s*=\s*\{[^}]+\}/)[0], config);
  assert.equal(config.window.META_PIXEL_B2C.enabled, true);
  assert.match(config.window.META_PIXEL_B2C.pixelId, /^\d{5,30}$/);
  const p = configuredPage();
  p.start(); p.api.init();
  assert.equal(p.scripts.length, 1);
  p.load();
  assert.deepEqual(p.calls.filter(c => c[0].startsWith('track')), [
    ['trackSingle', config.window.META_PIXEL_B2C.pixelId, 'PageView']
  ]);
  assert.match(html, /src="meta-pixel.js"/);
  for (const file of ['b2b/index.html', 'admin/index.html']) assert.doesNotMatch(read(file), /meta-pixel|fbq|fbevents/);
  assert.doesNotMatch(html, /facebook\.com\/tr/);
});

test('automatic startup respects the off switch and channel, and tolerates a missing module', () => {
  for (const options of [{ enabled: false }, { channel: 'B2B' }, { channel: 'ADMIN' }]) {
    const p = configuredPage(options);
    p.api.addToCart('21', 1); p.api.whatsAppOrderClick();
    assert.equal(p.scripts.length, 0);
    assert.equal(p.calls.length, 0);
  }
  const p = configuredPage({ enabled: false });
  p.window.META_PIXEL_B2C.enabled = true;
  p.window.MVMetaPixel = undefined;
  assert.doesNotThrow(p.start);
});

const app = read('shared/app.js');
function commerce(p, mobile = false) {
  const actions = {}, effects = { opens: 0, selectors: 0, qr: 0, saved: 0, manual: 0 };
  const control = key => ({ addEventListener: (_, fn) => { actions[key] = fn; } });
  const overlay = {
    querySelector: key => control(key), querySelectorAll: () => [],
    addEventListener: () => {}, classList: { add: () => {} }
  };
  Object.assign(p.context, {
    CANAL: p.window.CANAL, carrito: [], grupos: {}, catalogo: {},
    MQ_MOBILE: { matches: mobile }, WHATSAPP_NUM: '',
    productoNoDisponible: v => v.Sin_Stock === true,
    preciosDe: () => ({ lista: 100, promo: 100 }), preciosCantidadDe: () => ({ lista: null, promo: null }),
    tienePromo: () => false, porcentajeComoTexto: () => '',
    actualizarUICarrito: () => {}, guardarCarritoSesion: () => effects.saved++,
    registrarPrimerAgregadoManual: () => effects.manual++, actualizarBadgesCarritoGrupo: () => {},
    itemNoDisponible: () => false, carritoTieneProductosNoDisponibles: () => p.context.carrito.some(i => i.blocked),
    construirMensajePedido: () => 'synthetic order',
    cerrarModalEnvio: () => {}, actualizarHistorialUiActual: () => {}, bloquearScrollFondo: () => {},
    dibujarQrPedido: () => effects.qr++, crearEntradaHistorialUi: () => {},
    escCerrarEnvio: () => {}, requestAnimationFrame: () => {}, enfocarCapaActiva: () => {},
    document: {
      referrer: '',
      getElementById: () => null, createElement: () => overlay,
      body: { appendChild: () => effects.selectors++ }, addEventListener: () => {}
    }
  });
  p.window.open = () => { effects.opens++; return null; }; // También simula popup bloqueado.
  const names = ['registrarEventoMetaB2C', 'agregarAlCarrito', 'cambiarQtyCarrito', 'cambiarQtyCarritoInput', 'reconstruirCarritoDesdeReferencias', 'restaurarCarritoDesdeSesion', 'restaurarPedidoDesdeHash', 'referenciasCatalogoPorId', 'enviarWhatsApp', 'abrirWhatsAppConPedido', 'abrirModalEnvio'];
  for (const name of names) {
    const fn = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
    if (fn) vm.runInContext(fn[0], p.context);
  }
  return { actions, effects, run: expression => vm.runInContext(expression, p.context) };
}

test('actual cart flow records successful manual additions, never restore, QR, quantity edits or rejection', () => {
  const p = pixel(); p.api.setConsent(true); p.load(); const c = commerce(p);
  c.run("agregarAlCarrito('group-9', {Id:'21'}, 2)");
  c.run("agregarAlCarrito('group-9', {Id:'21'}, 1)");
  assert.equal(p.calls.filter(c => c[2] === 'AddToCart').length, 2);
  assert.equal(c.run('carrito[0].qty'), 3);
  assert.equal(c.run("agregarAlCarrito('group-9', {Id:'22', Sin_Stock:true}, 1)"), false);
  c.run("agregarAlCarrito('group-9', {Id:'21'}, 0)");
  c.run('cambiarQtyCarrito(0, 1)');
  c.run('cambiarQtyCarritoInput(0, "7", true)');
  assert.equal(c.run('carrito[0].qty'), 7);
  c.run("catalogo = {'group-9': [{Id:'21'}]}; reconstruirCarritoDesdeReferencias([{productId:'21', quantity:5}])");
  assert.equal(c.run('carrito[0].qty'), 5);
  assert.equal(p.calls.filter(c => c[2] === 'AddToCart').length, 2);
  assert.equal(c.effects.manual, 3); // Conserva comportamiento previo incluso para qty=0.
});

test('mobile counts one custom event per valid attempt; empty and blocked carts never open', () => {
  const p = pixel(); p.api.setConsent(true); p.load(); const c = commerce(p, true);
  c.run('enviarWhatsApp(); abrirWhatsAppConPedido()');
  assert.equal(c.effects.opens, 0);
  c.run("carrito = [{idProd:'21', qty:1, blocked:true}]; enviarWhatsApp(); abrirWhatsAppConPedido()");
  assert.equal(c.effects.opens, 0);
  c.run("carrito = [{idProd:'21', qty:1}]; enviarWhatsApp(); enviarWhatsApp()");
  assert.equal(c.effects.opens, 2);
  assert.equal(p.calls.filter(c => c[2] === 'WhatsAppOrderClick').length, 2);
});

test('desktop selector, cancel and QR do not count; its web action counts once', () => {
  const p = pixel(); p.api.setConsent(true); p.load(); const c = commerce(p);
  c.run("carrito = [{idProd:'21', qty:1}]; enviarWhatsApp()");
  assert.equal(c.effects.selectors, 1);
  c.actions['[data-accion="qr"]']();
  c.actions['.env-close']();
  assert.equal(c.effects.qr, 1);
  assert.equal(p.calls.filter(c => c[2] === 'WhatsAppOrderClick').length, 0);
  c.actions['[data-accion="web"]']();
  assert.equal(c.effects.opens, 1);
  assert.equal(p.calls.filter(c => c[2] === 'WhatsAppOrderClick').length, 1);
});

test('missing or throwing tracking never interferes with cart or WhatsApp, including B2B', () => {
  for (const channel of ['B2C', 'B2B']) for (const broken of [false, true]) {
    const p = pixel({ channel }); const c = commerce(p, true);
    p.window.MVMetaPixel = broken ? new Proxy({}, { get() { throw Error('blocked'); } }) : undefined;
    assert.equal(c.run("agregarAlCarrito('group-9', {Id:'21'}, 2)"), true);
    assert.doesNotThrow(() => c.run('enviarWhatsApp()'));
    assert.equal(c.effects.opens, 1); assert.equal(c.effects.saved, 1);
  }
});

test('preexisting pixels are not reused and never receive this module events', () => {
  for (const key of ['fbq', '_fbq']) {
    const p = pixel(); let unrelated = 0;
    p.window[key] = () => unrelated++;
    p.api.setConsent(true); p.api.addToCart('21', 1); p.api.whatsAppOrderClick();
    assert.equal(unrelated, 0); assert.equal(p.scripts.length, 0);
  }
});

test('commercial hooks send only the three contracted events and exact public payloads', () => {
  const p = pixel(); p.api.setConsent(true); p.load(); const c = commerce(p, true);
  c.run("agregarAlCarrito('group-9', {Id:'21', Precio_Costo:99, privateNote:'synthetic-private'}, 2); enviarWhatsApp()");
  assert.deepEqual(p.calls.filter(c => c[0].startsWith('track')), [
    ['trackSingle', '123456789012345', 'PageView'],
    ['trackSingle', '123456789012345', 'AddToCart', { content_ids: ['21'], content_type: 'product', contents: [{ id: '21', quantity: 2 }] }],
    ['trackSingleCustom', '123456789012345', 'WhatsAppOrderClick', { channel: 'B2C' }]
  ]);
  assert.deepEqual(p.calls.find(c => c[0] === 'init'), ['init', '123456789012345']);
  assert.deepEqual(p.calls.find(c => c[0] === 'set'), ['set', 'autoConfig', false, '123456789012345']);
});

test('actual session and QR restoration replace quantities without emitting AddToCart or WhatsApp', () => {
  for (const qr of [false, true]) {
    const p = pixel(); p.api.setConsent(true); p.load(); const c = commerce(p);
    Object.assign(p.context, {
      PEDIDO_HASH_PREFIJO: 'P', codigoPromocional: null,
      leerCarritoSesion: () => ({ items: [{ productId: '21', quantity: 4 }] }),
      limpiarCarritoSesion: () => {}, mostrarCatalogo: () => {}, abrirCarrito: () => {},
      history: { state: {}, replaceState: () => { p.context.location.hash = ''; } }
    });
    Object.assign(p.context.location, { hash: '#P21X3', pathname: '/', search: '' });
    c.run("catalogo = {'group-9': [{Id:'21'}]}; carrito = [{idProd:'99', qty:1}]");
    assert.equal(c.run(qr ? 'restaurarPedidoDesdeHash()' : 'restaurarCarritoDesdeSesion()'), true);
    assert.equal(c.run('carrito.length'), 1);
    assert.equal(c.run('carrito[0].qty'), qr ? 3 : 4);
    assert.equal(p.calls.filter(c => c[2] === 'AddToCart' || c[2] === 'WhatsAppOrderClick').length, 0);
    assert.equal(c.effects.opens, 0);
    assert.equal(c.effects.manual, 0);
  }
});

test('automatic HTML startup measures the actual desktop and mobile flows while the SDK loads', () => {
  for (const mobile of [false, true]) {
    const p = configuredPage();
    const c = commerce(p, mobile);
    c.run("agregarAlCarrito('group-9', {Id:'21'}, 2); enviarWhatsApp()");
    if (!mobile) {
      c.actions['[data-accion="qr"]']();
      assert.equal(p.calls.length, 0);
      c.actions['[data-accion="web"]']();
    }
    assert.equal(c.effects.opens, 1);
    p.load();
    p.start(); p.api.init();
    assert.deepEqual(p.calls.filter(call => call[0].startsWith('track')).map(call => call[2]),
      ['PageView', 'AddToCart', 'WhatsAppOrderClick']);
    c.run('abrirWhatsAppConPedido()');
    assert.equal(p.calls.filter(call => call[2] === 'WhatsAppOrderClick').length, 2);
    p.api.setConsent(false);
    c.run('enviarWhatsApp()');
    assert.equal(p.calls.filter(call => call[2] === 'WhatsAppOrderClick').length, 2);
  }
});
