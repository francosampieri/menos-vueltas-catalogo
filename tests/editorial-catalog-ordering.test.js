const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'shared', 'app.js'), 'utf8');
<<<<<<< Updated upstream
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
=======
const editorialBlock = source.match(/const OrdenEditorialCatalogo = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);

function editorialCatalog() {
  assert.ok(editorialBlock, 'shared/app.js must expose the local editorial catalog ordering');
  const context = {};
  vm.runInNewContext(`${editorialBlock[0]}; api = OrdenEditorialCatalogo;`, context);
  return context.api;
}

const prioridadesEsperadas = {
  'Almacén': {
    Conservas: ['41', '42'],
    Especias: ['62', '43', '44', '45'],
    'Salsas y Aderezos': ['271', '98', '102', '101', '97', '100', '99']
  },
  'Desayuno y Mediatarde': {
    'Café': ['285', '286', '118', '119', '120'],
    Cereales: ['122', '124', '123'],
    'Yerba Mate': ['173', '171']
  },
  'Snacks y Golosinas': {
    'Snacks Salados': ['252', '279', '253']
  }
};

test('defines the requested editorial priorities independently for B2C and B2B', () => {
  const api = editorialCatalog();

  assert.deepEqual(JSON.parse(JSON.stringify(api.prioridades.B2C)), prioridadesEsperadas);
  assert.deepEqual(JSON.parse(JSON.stringify(api.prioridades.B2B)), prioridadesEsperadas);
});

test('places editorial groups first and keeps every remaining group alphabetical by name then brand', () => {
  const api = editorialCatalog();
  const groups = [
    { id: '999', nombre: 'Papas Fritas', marca: 'ZZZ' },
    { id: '253', nombre: 'Papas Fritas', marca: 'GOOD SHOW' },
    { id: '279', nombre: 'Cintitas', marca: 'TOSTEX' },
    { id: '252', nombre: 'Pringles', marca: 'PRINGLES' },
    { id: '998', nombre: 'Papas Fritas', marca: 'AAA' }
  ];

  assert.deepEqual(
    Array.from(api.ordenar(groups, 'B2C', 'Snacks y Golosinas', 'Snacks Salados', group => group.id, group => group), group => group.id),
    ['252', '279', '253', '998', '999']
  );
});

test('freezes only the current aderezos prefix and leaves Parmesan sauces as fallback groups', () => {
  const api = editorialCatalog();
  const parmesanIds = ['103', '104', '105', '106', '107', '108'];
  const priorityIds = api.prioridades.B2C['Almacén']['Salsas y Aderezos'];
  const groups = [
    { id: '103', nombre: 'Chimichurri Tradicional', marca: 'PARMESANA' },
    { id: '271', nombre: 'Barbacoa', marca: 'NATURA' },
    { id: '99', nombre: 'Salsa Golf', marca: 'NATURA' },
    { id: '104', nombre: 'Salsa Criolla', marca: 'PARMESANA' }
  ];

  assert.ok(parmesanIds.every(id => !priorityIds.includes(id)));
  assert.deepEqual(
    Array.from(api.ordenar(groups, 'B2B', 'Almacén', 'Salsas y Aderezos', group => group.id, group => group), group => group.id),
    ['271', '99', '103', '104']
  );
>>>>>>> Stashed changes
});
