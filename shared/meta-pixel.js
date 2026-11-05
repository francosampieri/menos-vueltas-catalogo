// B2C únicamente. No carga Meta hasta contar con configuración y consentimiento.
// La autorización no se persiste aquí: la aporta el mecanismo acordado del sitio.
(function () {
  'use strict';
  if (window.MVMetaPixel) return;

  let consent = false;
  let scriptRequested = false;
  let ready = false;
  let failed = false;
  let initialized = false;
  let pageView = false;
  let pixelId = '';
  let pending = [];

  // El SDK lee URL/referrer por su cuenta. No modificar la navegación para
  // medir: ante contexto no seguro, no cargar/enviar. El QR limpia su hash
  // mediante el flujo existente antes de volver a llamar init().
  function safeUrl(raw, isReferrer) {
    if (!raw) return !!isReferrer;
    try {
      const url = new URL(raw);
      const publicPaths = ['/', '/index.html', '/b2c/', '/b2c/index.html'];
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) return false;
      if (!publicPaths.includes(url.pathname)) return false;
      for (const [key, value] of url.searchParams) {
        if (key !== 'fbclid' || !/^[A-Za-z0-9_-]{1,500}$/.test(value)) return false;
      }
      return true;
    } catch (_) { return false; }
  }

  function eligible() {
    const config = window.META_PIXEL_B2C || {};
    return window.CANAL === 'B2C' && config.enabled === true && consent && !failed &&
      typeof config.pixelId === 'string' && /^\d{5,30}$/.test(config.pixelId) &&
      (!pixelId || pixelId === config.pixelId) &&
      safeUrl(location.href, false) && safeUrl(document.referrer, true);
  }

  function command() {
    try { window.fbq.apply(window, arguments); } catch (_) { /* Comprar no depende de Meta. */ }
  }

  function flush() {
    if (!ready || !eligible()) return;
    if (!initialized) {
      // Desactivar configuración automática antes de init. Sin user data ni
      // coincidencias avanzadas. Revisar también ajustes en Events Manager.
      command('set', 'autoConfig', false, pixelId);
      command('consent', 'grant');
      command('init', pixelId);
      initialized = true;
    }
    const events = pending;
    pending = [];
    events.forEach(args => command.apply(null, args));
  }

  function init() {
    if (!eligible()) return;
    if (!scriptRequested) {
      // Una instalación preexistente debe auditarse; no reutilizarla ni
      // disparar eventos a otros píxeles por accidente.
      if (window.fbq || window._fbq) { failed = true; return; }
      pixelId = window.META_PIXEL_B2C.pixelId;
      scriptRequested = true;
      const fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      window.fbq = window._fbq = fbq;
      try {
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://connect.facebook.net/en_US/fbevents.js';
        script.referrerPolicy = 'no-referrer';
        script.onload = function () { ready = true; flush(); };
        script.onerror = function () { failed = true; pending = []; };
        document.head.appendChild(script);
      } catch (_) { failed = true; pending = []; }
    }
    if (!eligible()) return;
    if (!pageView) {
      pageView = true;
      pending.push(['trackSingle', pixelId, 'PageView']);
    }
    flush();
  }

  function emit(custom, name, data) {
    if (!eligible()) return;
    init();
    if (!eligible()) return;
    pending.push([custom ? 'trackSingleCustom' : 'trackSingle', pixelId, name, data]);
    flush();
  }

  window.MVMetaPixel = Object.freeze({
    init,
    setConsent: function (allowed) {
      consent = allowed === true;
      if (!consent) {
        if (pending.some(args => args[2] === 'PageView')) pageView = false;
        pending = [];
        if (scriptRequested) command('consent', 'revoke');
        return;
      }
      if (initialized) command('consent', 'grant');
      init();
    },
    addToCart: function (id, quantity) {
      if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(quantity) || quantity <= 0) return;
      const productId = String(id);
      emit(false, 'AddToCart', {
        content_ids: [productId], content_type: 'product',
        contents: [{ id: productId, quantity }]
      });
    },
    whatsAppOrderClick: function () { emit(true, 'WhatsAppOrderClick', { channel: 'B2C' }); }
  });
  init();
})();
