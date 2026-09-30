const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'shared', 'multihero.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'shared', 'styles.css'), 'utf8');
const multiheroBlock = source.match(/const MultiheroCarousel = \(\(\) => \{[\s\S]*?\n\}\)\(\);/);

function multihero() {
  assert.ok(multiheroBlock, 'shared/multihero.js must expose the carousel helper');
  const context = {};
  vm.runInNewContext(`${multiheroBlock[0]}; api = MultiheroCarousel;`, context);
  return context.api;
}

test('cycles indexes forward and backward without leaving the configured slides', () => {
  const api = multihero();

  assert.equal(api.nextIndex(0, 3), 1);
  assert.equal(api.nextIndex(2, 3), 0);
  assert.equal(api.previousIndex(0, 3), 2);
  assert.equal(api.previousIndex(1, 3), 0);
});

test('does not advance a paused carousel and uses the agreed eight-second interval otherwise', () => {
  const api = multihero();

  assert.equal(api.intervalMs, 8000);
  assert.equal(api.canAutoAdvance({ interacting: false, hidden: false, reducedMotion: false }), true);
  assert.equal(api.canAutoAdvance({ interacting: true, hidden: false, reducedMotion: false }), false);
  assert.equal(api.canAutoAdvance({ interacting: false, hidden: true, reducedMotion: false }), false);
  assert.equal(api.canAutoAdvance({ interacting: false, hidden: false, reducedMotion: true }), false);
});

test('recognizes only deliberate horizontal swipes and preserves short taps', () => {
  const api = multihero();

  assert.equal(api.swipeDirection(120, 48), 1);
  assert.equal(api.swipeDirection(48, 120), -1);
  assert.equal(api.swipeDirection(120, 88), 0);
  assert.equal(api.swipeDirection(120, 120), 0);
});

test('ships the same ordered multihero structure in B2C and B2B without the retired promo switch', () => {
  for (const channel of ['b2c', 'b2b']) {
    const landing = fs.readFileSync(path.join(__dirname, '..', channel, 'index.html'), 'utf8');
    const current = landing.indexOf('multihero-slide--actual');
    const standard = landing.indexOf('multihero-slide--standard');

    assert.match(landing, /data-multihero/);
    assert.match(landing, /data-multihero-track/);
    assert.match(landing, /data-multihero-dots/);
    assert.match(landing, /multihero\.js/);
    assert.ok(current >= 0 && current < standard, `${channel} must keep actual before standard`);
    assert.doesNotMatch(landing, /data-hero=/);
    assert.doesNotMatch(landing, /hero-promo/);
  }
});

test('defines the agreed stable canvases and dots-only navigation in shared styles', () => {
  assert.match(styles, /\.multihero-slide\s*\{[\s\S]*?aspect-ratio:\s*16\s*\/\s*7/);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{[\s\S]*?\.multihero-slide\s*\{[\s\S]*?aspect-ratio:\s*9\s*\/\s*13/);
  assert.match(styles, /\.multihero-dot\.is-active\.is-progressing::after/);
  assert.match(styles, /\.multihero-arrow\s*\{[\s\S]*?display: grid/);
  assert.match(styles, /@media \(max-width: 700px\)\s*\{[\s\S]*?\.multihero-arrow\s*\{\s*display: none/);
  assert.doesNotMatch(styles, /hero-promo/);
});
