const test = require('node:test');
const assert = require('node:assert/strict');

const { policy: shipping, promotion } = require('../shared/shipping.js');
const { calculatePromotion, normalizeCode, roundToNearest50 } = promotion;

test('normalizes a promotion code before validation', () => {
  assert.equal(normalizeCode('  21julio10  '), '21JULIO10');
  assert.equal(normalizeCode(''), '');
});

test('applies a percentage discount only to products without a temporary promotion', () => {
  const result = calculatePromotion({
    percent: 10,
    items: [
      { unitPrice: 900, quantity: 3, hasProductPromotion: false },
      { unitPrice: 800, quantity: 2, hasProductPromotion: true }
    ]
  });

  assert.deepEqual(result, {
    productsTotal: 4300,
    eligibleTotal: 2700,
    discount: 250,
    discountedProductsTotal: 4050,
    lines: [
      { eligible: true, originalTotal: 2700, discount: 250, discountedTotal: 2450 },
      { eligible: false, originalTotal: 1600, discount: 0, discountedTotal: 1600 }
    ]
  });
});

test('rounds every displayed promotion price to the nearest multiple of 50, ties down', () => {
  assert.equal(roundToNearest50(6010), 6000);
  assert.equal(roundToNearest50(6040), 6050);
  assert.equal(roundToNearest50(6025), 6000);

  const result = calculatePromotion({
    percent: 10,
    items: [
      { unitPrice: 650, quantity: 1, hasProductPromotion: false },
      { unitPrice: 650, quantity: 1, hasProductPromotion: false }
    ]
  });

  assert.equal(result.eligibleTotal, 1300);
  assert.equal(result.discount, 100);
  assert.equal(result.discountedProductsTotal, 1200);
  assert.deepEqual(result.lines.map(line => line.discount), [50, 50]);
  assert.equal(result.lines.reduce((sum, line) => sum + line.discount, 0), result.discount);
  assert.ok(result.lines.every(line => line.discountedTotal % 50 === 0));
});

test('does not apply a missing or invalid percentage promotion', () => {
  const result = calculatePromotion({
    percent: 0,
    items: [{ unitPrice: 1000, quantity: 1, hasProductPromotion: false }]
  });

  assert.equal(result.discount, 0);
  assert.equal(result.discountedProductsTotal, 1000);
});

test('recalculates B2C shipping from the total after the promotion code', () => {
  const promotion = calculatePromotion({
    percent: 10,
    items: [{ unitPrice: 36000, quantity: 1, hasProductPromotion: false }]
  });
  const summary = shipping.calculateShipping({
    channel: 'B2C',
    items: [{ unitPrice: promotion.discountedProductsTotal, quantity: 1 }]
  });

  assert.equal(promotion.discountedProductsTotal, 32400);
  assert.equal(summary.shippingCost, 1500);
  assert.equal(summary.total, 33900);
});
