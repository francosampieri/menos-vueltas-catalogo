const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'shared', 'app.js'), 'utf8');
const orderingBlock = source.match(/const OrdenEditorialCatalogo = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);

function ordering() {
  assert.ok(orderingBlock, 'shared/app.js must expose the local editorial ordering helper');
  const context = {};
  vm.runInNewContext(`${orderingBlock[0]}; api = OrdenEditorialCatalogo;`, context);
  return context.api;
}

const snacks = [
  { id: '101', nombre: 'Alfajor salado', marca: 'Zeta' },
  { id: '252', nombre: 'Pringles', marca: 'Kellogg\'s' },
  { id: '103', nombre: 'Papas', marca: 'Beta' },
  { id: '102', nombre: 'Papas', marca: 'Alfa' }
];

test('puts configured group ids first in their exact order, then keeps name and brand ordering', () => {
  const api = ordering();
  const sorted = api.sortGroups({
    channel: 'B2C',
    category: 'Snacks y Golosinas',
    subcategory: 'Snacks Salados',
    groups: snacks,
    configuration: {
      B2C: { 'Snacks y Golosinas': { 'Snacks Salados': ['103', '252'] } }
    }
  });

  assert.deepEqual(sorted.map(group => group.id), ['103', '252', '101', '102']);
});

test('keeps editorial configuration independent by channel and falls back to alphabetical when absent', () => {
  const api = ordering();
  const configuration = {
    B2C: { 'Snacks y Golosinas': { 'Snacks Salados': ['252'] } },
    B2B: { 'Snacks y Golosinas': { 'Snacks Salados': ['103'] } }
  };

  assert.deepEqual(api.sortGroups({
    channel: 'B2C', category: 'Snacks y Golosinas', subcategory: 'Snacks Salados', groups: snacks, configuration
  }).map(group => group.id), ['252', '101', '102', '103']);
  assert.deepEqual(api.sortGroups({
    channel: 'B2B', category: 'Snacks y Golosinas', subcategory: 'Snacks Salados', groups: snacks, configuration
  }).map(group => group.id), ['103', '101', '102', '252']);
  assert.deepEqual(api.sortGroups({
    channel: 'B2C', category: 'Otra', subcategory: 'Sin prioridad', groups: snacks, configuration
  }).map(group => group.id), ['101', '102', '103', '252']);
});

test('ignores duplicated, missing and unavailable editorial references without displacing remaining groups', () => {
  const api = ordering();
  const sorted = api.sortGroups({
    channel: 'B2C',
    category: 'Snacks y Golosinas',
    subcategory: 'Snacks Salados',
    groups: snacks.filter(group => group.id !== '252'),
    configuration: {
      B2C: { 'Snacks y Golosinas': { 'Snacks Salados': ['252', '103', '103', '999'] } }
    }
  });

  assert.deepEqual(sorted.map(group => group.id), ['103', '101', '102']);
});

test('ships Pringles as the sole initial Snacks Salados priority in both channels', () => {
  const api = ordering();
  assert.deepEqual(Array.from(api.getPriorityIds('B2C', 'Snacks y Golosinas', 'Snacks Salados')), ['252']);
  assert.deepEqual(Array.from(api.getPriorityIds('B2B', 'Snacks y Golosinas', 'Snacks Salados')), ['252']);
});

test('applies the shared section sorter only in normal category exploration', () => {
  assert.match(source, /const usarOrdenEditorial = !busquedaActiva && !filtroEspecial;/);
  assert.match(source, /usarOrdenEditorial \? ordenarGruposSeccion\(items, cat, sub\) : ordenarGruposAlfabeticamente\(items\)/);
});
