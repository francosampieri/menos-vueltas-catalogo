const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'shared', 'app.js'), 'utf8');
const renderBlock = source.match(/function renderNuevosIngresos\(\) \{[\s\S]*?\n\}/)?.[0];
const landingOrder = source.match(/const ORDEN_NUEVOS_LANDING_B2C = \[[\s\S]*?\];/)?.[0];

function render(channel, products) {
  assert.ok(landingOrder, 'the landing must have a B2C display order separate from the full Nuevos list');
  assert.ok(renderBlock);
  const list = source.match(new RegExp(`const NUEVOS_${channel} = \\[[\\s\\S]*?\\];`))?.[0];
  const cards = [];
  const section = { style: {} };
  const context = {
    CANAL: channel,
    catalogo: Object.fromEntries(products.map(([id,gid])=>[gid,[{Id:id}]])),
    document: {getElementById:id=>id==='nuevos-grid'?{innerHTML:'',appendChild:card=>cards.push(card)}:section},
    crearCardNuevo:gid=>({gid}),
    crearCardVerTodosNuevos:()=>({all:true})
  };
  vm.runInNewContext(`${list}\nconst NUEVOS=NUEVOS_${channel};\n${landingOrder}\nfunction esNuevo(id){return NUEVOS.includes(String(id));}\nfunction grupoTieneNuevo(vars){return vars.some(v=>esNuevo(v.Id));}\n${renderBlock}\nrenderNuevosIngresos();`,context);
  return cards;
}

const products = [['563','298'],['564','299'],['582','311'],['583','312'],['584','313'],['585','314'],['587','316'],['588','317']];

test('shows rice, Chef puree, tallarin, cream and sugar in the B2C landing order', () => {
  const cards = render('B2C',products);
  assert.deepEqual(cards.filter(card=>!card.all).map(card=>card.gid),['316','313','314','311','317']);
  assert.equal(cards.at(-1).all,true);
});

test('skips missing products and fills the strip with another eligible new product', () => {
  const cards = render('B2C',products.filter(([id])=>id!=='587'));
  assert.deepEqual(cards.filter(card=>!card.all).map(card=>card.gid),['313','314','311','317','298']);
});

test('preserves the existing B2B order independently of the B2C landing selection', () => {
  const cards = render('B2B',[['484','b'],['541','c'],['532','a']]);
  assert.deepEqual(cards.filter(card=>!card.all).map(card=>card.gid),['a','b','c']);
});
