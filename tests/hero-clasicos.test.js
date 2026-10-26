const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'shared', 'styles.css'), 'utf8');
const landing = fs.readFileSync(path.join(root, 'b2c', 'index.html'), 'utf8');

function slides(source) {
  return [...source.matchAll(/<article\b[^>]*data-multihero-slide[^>]*>([\s\S]*?)<\/article>/g)].map(([, html]) => html);
}

test('orders B2C as Clasicos, standard and Comer mejor without changing B2B', () => {
  const b2c = slides(landing);
  assert.equal(b2c.length, 3);
  assert.match(b2c[0], /class="hero-clasicos"/);
  assert.match(b2c[1], /class="hero-standard"/);
  assert.match(b2c[2], /class="hero-comer-mejor"/);
  const b2b = fs.readFileSync(path.join(root, 'b2b', 'index.html'), 'utf8');
  assert.equal(slides(b2b).length, 2);
  assert.doesNotMatch(b2b, /hero-clasicos|clasicos-cocina/);
});

test('publishes responsive clean art with editable title, description and catalog action', () => {
  const hero = slides(landing)[0];
  assert.match(hero, /<source media="\(max-width: 700px\)" srcset="hero-clasicos-mobile\.png">/);
  assert.match(hero, /<img src="hero-clasicos-desktop\.jpg" alt="">/);
  assert.match(hero, /hero-clasicos__title-main">Más Clásicos<\/span>/);
  assert.match(hero, /hero-clasicos__title-secondary">para tu cocina<\/span>/);
  assert.match(hero, /Tu cocina suma clásicos<\/span><span>de primeras marcas/);
  assert.match(hero, /onclick="mostrarCatalogoCompleto\(\)"[^>]*>Ver catálogo<\/button>/);
  for (const filename of ['hero-clasicos-desktop.jpg', 'hero-clasicos-mobile.png']) {
    assert.ok(fs.statSync(path.join(root, 'b2c', filename)).size > 0);
  }
});

test('leaves the selection pending and its CTA hidden before the catalog loads', () => {
  const script = landing.match(/<script>\s*(window\.VISTAS_EVENTO_B2C[\s\S]*?)<\/script>/);
  assert.ok(script);
  const context = { window: {} };
  vm.runInNewContext(script[1], context);
  const pending = context.window.VISTAS_EVENTO_B2C['clasicos-cocina'];
  assert.ok(pending, 'Clasicos must use the existing editorial-view API');
  assert.equal(pending.active, false);
  assert.equal(pending.groupIds.length, 0);
  assert.equal(pending.cta, 'Ver Selección');
  assert.match(slides(landing)[0], /<button[^>]*data-evento-id="clasicos-cocina"[^>]*\bhidden\b[^>]*aria-hidden="true"[^>]*>Ver Selección<\/button>/);
  assert.equal(context.window.VISTAS_EVENTO_B2C['campana-nuevos-habitos'].active, true);
});

function rule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `${selector} must have its own campaign rule`);
  return match[1];
}

test('keeps the approved desktop artwork whole and its copy in a separate layer', () => {
  assert.match(rule(styles, '.hero-clasicos'), /container-type:\s*inline-size/);
  assert.match(rule(styles, '.hero-clasicos__art img'), /object-fit:\s*contain/);
  assert.match(rule(styles, '.hero-clasicos__title'), /position:\s*absolute/);
  assert.match(rule(styles, '.hero-clasicos__description'), /position:\s*absolute/);
  assert.match(rule(styles, '.hero-clasicos__actions'), /position:\s*absolute/);
});

test('shows the approved centered Cabin title without a description on mobile', () => {
  const mobile = styles.slice(styles.indexOf('/* Clásicos: lienzo mobile aprobado */'));
  assert.match(mobile, /@media\s*\(max-width:\s*700px\)/);
  assert.match(rule(mobile, '.hero-clasicos__title'), /text-align:\s*center/);
  assert.match(rule(mobile, '.hero-clasicos__title-main'), /font-family:\s*var\(--font-body\)/);
  assert.match(rule(mobile, '.hero-clasicos__title-secondary'), /font-family:\s*var\(--font-body\)/);
  assert.match(rule(mobile, '.hero-clasicos__description'), /display:\s*none/);
  assert.match(rule(mobile, '.hero-clasicos__actions'), /flex-direction:\s*column/);
});
