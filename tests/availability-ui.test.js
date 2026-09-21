const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'shared', 'app.js'), 'utf8');
const availabilityBlock = source.match(/const DisponibilidadPublica = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);

function availability() {
  assert.ok(availabilityBlock, 'shared/app.js must centralize public availability');
  const context = {};
  vm.runInNewContext(`${availabilityBlock[0]}; api = DisponibilidadPublica;`, context);
  return context.api;
}

test('uses only the explicit boolean Sin_Stock flag for public availability', () => {
  const api = availability();

  assert.equal(api.message, 'Este producto no está disponible.');
  assert.equal(api.isUnavailable({ Sin_Stock: true, Saldo: 12 }), true);
  assert.equal(api.isUnavailable({ Sin_Stock: false, Saldo: 0 }), false);
  assert.equal(api.isUnavailable({ Saldo: 0 }), false);
  assert.equal(api.isUnavailable({ Sin_Stock: 'true', Saldo: -3 }), false);
});

test('blocks a confirmation only while a current cart item is unavailable', () => {
  const api = availability();

  assert.equal(api.hasUnavailableItems([{ unavailable: false }, { unavailable: false }]), false);
  assert.equal(api.hasUnavailableItems([{ unavailable: false }, { unavailable: true }]), true);
  assert.equal(api.hasUnavailableItems([]), false);
});
