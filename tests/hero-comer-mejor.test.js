const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const landing = fs.readFileSync(path.join(root, 'b2c', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'shared', 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'shared', 'styles.css'), 'utf8');

const NUEVOS_ESPERADOS = [
  '546', '547', '548', '549', '550', '551', '552', '553',
  '554', '555', '556', '557', '558', '559', '560', '561'
];
const NUEVOS_B2B_ANTERIORES = [
  '532', '484', '541', '523', '515', '533', '534', '535', '536', '537',
  '538', '539', '540', '542', '543', '544', '545', '514', '516', '517',
  '518', '519', '520', '521', '522', '524', '525', '526', '527', '528',
  '529', '530', '531', '512', '513', '307', '308', '311', '312', '313'
];
const SELECCION_COMER_MEJOR_ESPERADA = [
  '293', '288', '289', '287', '294', '295', '296', '290',
  '280', '291', '292', '272'
];

function idsEnLista(source, declaration) {
  const match = source.match(new RegExp(`const ${declaration} = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${declaration} must be declared as an explicit list`);
  return [...match[1].matchAll(/'(\d+)'/g)].map(([, id]) => id);
}

function gruposEventoComerMejor(source) {
  const match = source.match(/'campana-nuevos-habitos': Object\.freeze\(\{[\s\S]*?groupIds:\s*\[([\s\S]*?)\]/);
  assert.ok(match, 'the Comer mejor event must define explicit group ids');
  return [...match[1].matchAll(/'(\d+)'/g)].map(([, id]) => id);
}

test('ships the comer-mejor campaign in the first B2C multihero slide', () => {
  assert.match(landing, /multihero-slide--actual[\s\S]*?hero-comer-mejor/);
  assert.match(landing, /hero-comer-mejor-desktop\.png/);
  assert.match(landing, /hero-comer-mejor-mobile\.png/);
  assert.match(landing, /data-vista-evento[^>]*data-evento-id="campana-nuevos-habitos"/);
  assert.match(landing, /Con\s*<span[^>]*>Menos Vueltas<\/span>,\s*<br>\s*comer mejor es\s*<br>\s*<span[^>]*>más simple\.<\/span>/);
  assert.match(landing, /onclick="mostrarCatalogoCompleto\(\)"[^>]*>Ver catálogo/);
  assert.match(landing, /active:\s*true/);
});

test('uses the approved B2C new-product and Comer mejor selections in their exact order', () => {
  assert.deepEqual(idsEnLista(app, 'NUEVOS_B2C'), NUEVOS_ESPERADOS);
  assert.deepEqual(gruposEventoComerMejor(landing), SELECCION_COMER_MEJOR_ESPERADA);
  assert.equal(new Set(SELECCION_COMER_MEJOR_ESPERADA).size, SELECCION_COMER_MEJOR_ESPERADA.length);
});

test('keeps the B2C new-product selection isolated from the existing B2B list', () => {
  assert.deepEqual(idsEnLista(app, 'NUEVOS_B2B'), NUEVOS_B2B_ANTERIORES);
  assert.match(app, /const NUEVOS = CANAL === 'B2C' \? NUEVOS_B2C : NUEVOS_B2B;/);
});

test('keeps the campaign art whole and adapts its content by canvas', () => {
  assert.match(styles, /\.hero-comer-mejor__art\s*\{[^}]*z-index:\s*0/);
  assert.match(styles, /\.hero-comer-mejor__art img\s*\{[^}]*object-fit:\s*contain[^}]*transform:\s*translateX\(3%\) scale\(\.89\)/);
  assert.match(styles, /\.hero-comer-mejor__content\s*\{[\s\S]*?width:\s*46%/);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{[\s\S]*?\.hero-comer-mejor__content[\s\S]*?width:\s*100%/);
  assert.match(styles, /\.hero-comer-mejor__actions[\s\S]*?flex-direction:\s*column/);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{[\s\S]*?\.hero-comer-mejor__primary,[\s\S]*?min-height:\s*clamp\(2\.5rem, 10vw, 3\.8rem\)/);
});

test('includes the two final campaign art files in B2C', () => {
  for (const filename of ['hero-comer-mejor-desktop.png', 'hero-comer-mejor-mobile.png']) {
    assert.equal(fs.existsSync(path.join(root, 'b2c', filename)), true, `${filename} must be published with B2C`);
  }
});
