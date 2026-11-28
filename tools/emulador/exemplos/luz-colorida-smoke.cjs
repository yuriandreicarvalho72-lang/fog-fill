// Exemplo: Luz Colorida 1.4 — a luz (pontual) é bloqueada pelas linhas de obstrução do Smoke & Spectre; porta aberta e opção desligada deixam passar.
// Uso: tools/emulador/run.sh luz-colorida &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/luz-colorida-smoke.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const S = 'com.battle-system.smoke/';
    const base = { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, layer: 'DRAWING', visible: true };
    window.items = [
      { ...base, id: 'parede', type: 'LINE', startPosition: { x: 540, y: 200 }, endPosition: { x: 540, y: 400 }, metadata: { [S + 'isVisionLine']: true } },
      { ...base, id: 'porta', type: 'LINE', startPosition: { x: 460, y: 200 }, endPosition: { x: 460, y: 400 }, metadata: { [S + 'isVisionLine']: true, [S + 'isDoor']: true, [S + 'disabled']: true } },
      { ...base, id: 'enfeite', type: 'LINE', startPosition: { x: 500, y: 200 }, endPosition: { x: 500, y: 400 }, metadata: {} },
    ];
    window.local = []; window.meta = {};
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }), OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }), OBR_SCENE_LOCAL_GET_ITEMS: (d) => ({ items: window.local.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); return {}; },
      OBR_SCENE_LOCAL_DELETE_ITEMS: (d) => { window.local = window.local.filter((i) => !d.ids.includes(i.id)); return {}; },
      OBR_SCENE_LOCAL_UPDATE_ITEMS: () => ({}), OBR_VIEWPORT_GET_WIDTH: () => ({ width: 1000 }), OBR_VIEWPORT_GET_HEIGHT: () => ({ height: 800 }),
      OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }), OBR_BROADCAST_SEND_MESSAGE: () => ({}),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/luz-colorida/background.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const acende = (id) => p.evaluate((id) => window.emit('OBR_BROADCAST_MESSAGE_luz-colorida/pontual', { data: { id, x: 500, y: 300, cor: '#ff8a1f', raio: 150, intens: 0.8, dur: 'fim', fade: 0 }, connectionId: 'gm1' }), id);
  const trechos = () => p.evaluate(() => { const e = window.local.filter((i) => i.name === 'Luz pontual').pop(); return e ? e.uniforms.filter((u) => /^sa\d/.test(u.name)).map((u) => [u.name, u.value.x]) : null; });
  await acende('l1'); await p.waitForTimeout(500);
  const t = await trechos();
  ok('só a obstrução ativa vira sombra (porta aberta e enfeite não)', t, [['sa0', 540]]);
  await p.evaluate(() => { window.meta['luz-colorida/settings'] = { smoke: false }; window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { window.local = []; });
  await acende('l2'); await p.waitForTimeout(500);
  ok('com a opção desligada, nenhum trecho do Smoke', (await trechos()).length, 0);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
