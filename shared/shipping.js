/*
 * Regla y utilidades de envío compartidas.
 *
 * APIs de navegador:
 * - MenosVueltasShipping.calculateShipping({ channel, items })
 * - MenosVueltasAdminShipping.parseShippingFromMessage(text)
 * - MenosVueltasAdminShipping.serializeShipping(value)
 * - MenosVueltasAdminShipping.totalWithShipping({ productsTotal, shipping, extras })
 * - MenosVueltasPromotion.normalizeCode(value)
 * - MenosVueltasPromotion.calculatePromotion({ percent, items })
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MenosVueltasShipping = api.policy;
  root.MenosVueltasAdminShipping = api.admin;
  root.MenosVueltasPromotion = api.promotion;
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

  function normalizeCode(value) {
    return String(value || '').trim().toUpperCase();
  }

  // B2C comunica importes en múltiplos de $50. En el punto medio se elige
  // el valor inferior para que 6025 resulte 6000, no 6050.
  function roundToNearest50(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    const lower = Math.floor(amount / 50) * 50;
    return amount - lower <= 25 ? lower : lower + 50;
  }

  function validAmount(value) {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function validQuantity(value) {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function calculatePromotion({ percent, items = [] } = {}) {
    const safePercent = Number.isFinite(percent) && percent > 0 && percent <= 100
      ? percent
      : 0;
    const lines = items.map((item, index) => {
      const lineTotal = validAmount(item && item.unitPrice) * validQuantity(item && item.quantity);
      return {
        index,
        eligible: Boolean(item) && !item.hasProductPromotion,
        originalTotal: lineTotal,
        discount: 0,
        discountedTotal: lineTotal
      };
    });
    const productsTotal = lines.reduce((sum, line) => sum + line.originalTotal, 0);
    const eligibleTotal = lines.reduce((sum, line) => sum + (line.eligible ? line.originalTotal : 0), 0);

    lines.forEach(line => {
      if (!safePercent || !line.eligible) return;
      line.discountedTotal = roundToNearest50(line.originalTotal * (100 - safePercent) / 100);
      line.discount = line.originalTotal - line.discountedTotal;
    });
    const discount = lines.reduce((sum, line) => sum + line.discount, 0);
    const discountedProductsTotal = lines.reduce((sum, line) => sum + line.discountedTotal, 0);
    return {
      productsTotal,
      eligibleTotal,
      discount,
      discountedProductsTotal,
      lines: lines.map(({ index, ...line }) => line)
    };
  }

  const policy = Object.freeze({
    B2C_SHIPPING_COST,
    B2C_FREE_SHIPPING_THRESHOLD,
    calculateShipping
  });
  const admin = Object.freeze({ parseShippingFromMessage, serializeShipping, totalWithShipping });
  const promotion = Object.freeze({ normalizeCode, roundToNearest50, calculatePromotion });

  return Object.freeze({ policy, admin, promotion });
});
