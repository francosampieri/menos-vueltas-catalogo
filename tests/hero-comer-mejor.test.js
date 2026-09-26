const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const landing = fs.readFileSync(path.join(root, 'b2c', 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'shared', 'styles.css'), 'utf8');

test('ships the comer-mejor campaign in the first B2C multihero slide', () => {
  assert.match(landing, /multihero-slide--actual[\s\S]*?hero-comer-mejor/);
  assert.match(landing, /hero-comer-mejor-desktop\.png/);
  assert.match(landing, /hero-comer-mejor-mobile\.png/);
  assert.match(landing, /data-vista-evento[^>]*data-evento-id="campana-nuevos-habitos"/);
  assert.match(landing, /Con\s*<span[^>]*>Menos Vueltas<\/span>,\s*<br>\s*comer mejor es\s*<br>\s*<span[^>]*>más simple\.<\/span>/);
  assert.match(landing, /onclick="mostrarCatalogoCompleto\(\)"[^>]*>Ver catálogo/);
  assert.match(landing, /active:\s*true[\s\S]*?groupIds:\s*\['280'\]/);
});

test('keeps the campaign art whole and adapts its content by canvas', () => {
  assert.match(styles, /\.hero-comer-mejor__art\s*\{[^}]*z-index:\s*0/);
  assert.match(styles, /\.hero-comer-mejor__art img\s*\{[\s\S]*?object-fit:\s*contain/);
  assert.match(styles, /\.hero-comer-mejor__content\s*\{[\s\S]*?width:\s*46%/);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{[\s\S]*?\.hero-comer-mejor__content[\s\S]*?width:\s*100%/);
  assert.match(styles, /\.hero-comer-mejor__actions[\s\S]*?flex-direction:\s*column/);
});

test('includes the two final campaign art files in B2C', () => {
  for (const filename of ['hero-comer-mejor-desktop.png', 'hero-comer-mejor-mobile.png']) {
    assert.equal(fs.existsSync(path.join(root, 'b2c', filename)), true, `${filename} must be published with B2C`);
  }
});
