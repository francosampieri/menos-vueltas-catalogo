/*
 * Regla y utilidades de envío compartidas.
 *
 * APIs de navegador:
 * - MenosVueltasShipping.calculateShipping({ channel, items })
 * - MenosVueltasAdminShipping.parseShippingFromMessage(text)
 * - MenosVueltasAdminShipping.serializeShipping(value)
 * - MenosVueltasAdminShipping.totalWithShipping({ productsTotal, shipping, extras })
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MenosVueltasShipping = api.policy;
  root.MenosVueltasAdminShipping = api.admin;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const B2C_SHIPPING_COST = 1500;
  const B2C_FREE_SHIPPING_THRESHOLD = 35000;

  function calculateShipping({ channel, items = [] } = {}) {
    const hasMissingPrice = items.some(item =>
      !item || !Number.isFinite(item.unitPrice) || item.unitPrice < 0
    );

    if (hasMissingPrice) {
      return {
        productsTotal: null,
        shippingCost: null,
        total: null,
        amountRemaining: null,
        progress: 0,
        status: 'confirm'
      };
    }

    const productsTotal = items.reduce((total, item) => {
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 0;
      return total + item.unitPrice * quantity;
    }, 0);

    if (channel !== 'B2C') {
      return {
        productsTotal,
        shippingCost: 0,
        total: productsTotal,
        amountRemaining: 0,
        progress: 0,
        status: 'not-applicable'
      };
    }

    if (!items.length) {
      return {
        productsTotal: 0,
        shippingCost: 0,
        total: 0,
        amountRemaining: B2C_FREE_SHIPPING_THRESHOLD,
        progress: 0,
        status: 'paid'
      };
    }

    const isFree = productsTotal >= B2C_FREE_SHIPPING_THRESHOLD;
    const shippingCost = isFree ? 0 : B2C_SHIPPING_COST;
    const amountRemaining = isFree ? 0 : B2C_FREE_SHIPPING_THRESHOLD - productsTotal;

    return {
      productsTotal,
      shippingCost,
      total: productsTotal + shippingCost,
      amountRemaining,
      progress: Math.min(100, Math.round((productsTotal / B2C_FREE_SHIPPING_THRESHOLD) * 100)),
      status: isFree ? 'free' : 'paid'
    };
  }

  function parseNumber(value) {
    const normalized = String(value || '')
      .replace(/[^0-9,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseShippingFromMessage(text) {
    const match = String(text || '').match(/(?:^|\n)\s*env[ií]o\s*:\s*(.+?)\s*(?:\n|$)/i);
    if (!match) return null;
    const value = match[1].trim();
    if (/^(gratis|a\s+confirmar)$/i.test(value)) return /^gratis$/i.test(value) ? 0 : null;
    return parseNumber(value);
  }

  function serializeShipping(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  function totalWithShipping({ productsTotal = 0, shipping = null, extras = 0 } = {}) {
    return Number(productsTotal || 0) + Number(shipping || 0) + Number(extras || 0);
  }

  const policy = Object.freeze({
    B2C_SHIPPING_COST,
    B2C_FREE_SHIPPING_THRESHOLD,
    calculateShipping
  });
  const admin = Object.freeze({ parseShippingFromMessage, serializeShipping, totalWithShipping });

  return Object.freeze({ policy, admin });
});
