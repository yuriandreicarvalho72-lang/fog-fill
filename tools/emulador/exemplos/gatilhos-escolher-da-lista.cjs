// Exemplo: Gatilhos 1.25 — "escolher da lista" acha itens trancados, fog e mapa e os põe na zona do gatilho.
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-escolher-da-lista.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const it = (id, name, layer, locked, extra = {}) => ({ id, name, type: 'IMAGE', layer, visible: true, locked, createdUserId: 'gmU', lastModifiedUserId: 'gmU', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100, url: 'a.png' }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, text: { plainText: name, richText: [], style: {} }, metadata: {}, ...extra });
    window.items = [it('mapa', 'Mapa do porão', 'MAP', true), it('fog', 'Fog sala 1', 'FOG', true, { metadata: { 'rodeo.owlbear.dynamic-fog/doors': [{ open: false }] } }), it('livre', 'Caixa', 'PROP', false)];
    window.meta = { 'gatilhos/lista': [{ id: 't1', name: 'Teste', armed: true, once: true, delay: 0, zones: [], cause: 'enter', radius: 2, who: 'chars', tokens: [], ignoreHidden: true, halt: false, reach: 1, canUse: 'all', glow: true, glowColor: '#ffd34d', glowClick: true, glowD: 0, nodeTo: '', reqItem: '', reqMsg: '', reqShow: 'aviso', reqUses: 0, reqNodes: [], effects: [], conds: [] }] };
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 100 }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
      OBR_SCENE_SET_METADATA: (d) => { window.meta = { ...window.meta, ...d.update }; return {}; },
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }), OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: [] }), OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }), OBR_PLAYER_SELECT: () => ({}),
      OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', primary: { main: '#bb99ff' }, secondary: { main: '#ee99ff' }, background: { default: '#222', paper: '#333' }, text: { primary: '#fff', secondary: '#ccc', disabled: '#999' } } }),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/index.html?obrref=${ref}`); await p.waitForTimeout(1500);
  const fr = p.frames()[1];
  // abre o gatilho e clica em "escolher da lista" na zona
  await fr.evaluate(() => { const d = document.querySelector('details, .trig, [data-open]'); d?.click?.(); });
  await fr.evaluate(() => document.querySelector('.card .name').click()); await p.waitForTimeout(500);
  const n = await fr.evaluate(() => document.querySelectorAll('[data-pick]').length);
  ok('há botão "escolher da lista"', n > 0, true);
  await fr.evaluate(() => document.querySelector('[data-pick="zones"]').click()); await p.waitForTimeout(400);
  ok('a lista mostra o mapa trancado, o fog e o item livre', await fr.evaluate(() => [...document.querySelectorAll('[data-id]')].map((c) => c.dataset.id)), ['fog', 'mapa', 'livre']);
  await fr.evaluate(() => { document.querySelector('[data-f="trancado"]').click(); });
  ok('filtro Trancados', await fr.evaluate(() => [...document.querySelectorAll('[data-id]')].map((c) => c.dataset.id)), ['fog', 'mapa']);
  await fr.evaluate(() => { document.querySelector('[data-id="fog"]').click(); document.querySelector('[data-id="mapa"]').click(); document.getElementById('pkOk').click(); }); await p.waitForTimeout(700);
  ok('a zona do gatilho recebeu fog e mapa', await p.evaluate(() => window.meta['gatilhos/lista'][0].zones), ['fog', 'mapa']);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
