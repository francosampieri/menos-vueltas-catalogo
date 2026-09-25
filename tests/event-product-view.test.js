const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'shared', 'app.js'), 'utf8');
const b2c = fs.readFileSync(path.join(root, 'b2c', 'index.html'), 'utf8');
const b2b = fs.readFileSync(path.join(root, 'b2b', 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'shared', 'styles.css'), 'utf8');
const eventViewBlock = source.match(/const VistaEventoB2C = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);

function eventView() {
  assert.ok(eventViewBlock, 'shared/app.js must expose the reusable B2C event-view helper');
  const context = {};
  vm.runInNewContext(`${eventViewBlock[0]}; api = VistaEventoB2C;`, context);
  return context.api;
}

test('keeps only configured, available group ids in explicit order', () => {
  const api = eventView();
  const definition = { active: true, groupIds: ['280', '901', '280', '117'] };

  assert.deepEqual(
    [...api.eligibleGroupIds(definition, new Set(['117', '280']))],
    ['280', '117']
  );
});

test('does not expose inactive or empty event definitions', () => {
  const api = eventView();

  assert.equal(api.canOpen({ active: false, groupIds: ['280'] }, ['280']), false);
  assert.equal(api.canOpen({ active: true, groupIds: [] }, []), false);
  assert.equal(api.canOpen({ active: true, groupIds: ['280'] }, ['280']), true);
});

test('ships an isolated B2C event shell and no B2B entry point', () => {
  assert.match(b2c, /VISTAS_EVENTO_B2C/);
  assert.match(b2c, /id="vista-evento"/);
  assert.match(b2c, /data-vista-evento[^>]*data-evento-id="campana-nuevos-habitos"/);
  assert.match(source, /\[data-vista-evento\]\[data-evento-id\]/);
  assert.doesNotMatch(b2b, /vista-evento|VISTAS_EVENTO_B2C|data-vista-evento/);
  assert.match(styles, /#vista-evento/);
  assert.doesNotMatch(styles, /\.evento-head h1\s*\{[\s\S]*?--font-display/);
});

test('keeps event cards and history distinct from the normal catalog', () => {
  assert.match(source, /event-card-/);
  assert.match(source, /eventoVisible\s*\?\s*'evento'/);
  assert.match(source, /abrirModalProducto\(gid, vars, 0, event\.currentTarget/);
  assert.match(source, /data-evento-id/);
  assert.match(source, /tipo === 'evento'[\s\S]*?history\.state\.vista !== 'evento'/);
});
