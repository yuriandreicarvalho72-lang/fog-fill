// Exemplo: Gatilhos 1.25.1 — "criar porta animada" a partir da linha vermelha/ícone da porta do fog do Owlbear (item local) e do próprio fog.
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-porta-animada-fog.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const D = 'rodeo.owlbear.dynamic-fog/';
    window.items = [{ id: 'fog', name: 'Fog', type: 'PATH', layer: 'FOG', visible: true, locked: false, createdUserId: 'gmU', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, metadata: { [D + 'doors']: [{ open: false, start: { x: 10, y: 10 }, end: { x: 10, y: 60 } }, { open: true, start: { x: 300, y: 10 }, end: { x: 300, y: 60 } }] } },
      { id: 'img', name: 'Porta', type: 'IMAGE', layer: 'PROP', visible: true, locked: false, createdUserId: 'gmU', position: { x: 300, y: 35 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100 }, grid: { dpi: 150, offset: { x: 50, y: 50 } }, metadata: {} }];
    window.local = [{ id: 'ico', type: 'BILLBOARD', layer: 'CONTROL', attachedTo: 'fog', position: { x: 300, y: 35 }, metadata: { [D + 'door-index']: 1 } }];
    window.meta = {}; window.added = []; window.notes = [];
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_GRID_GET_TYPE: () => ({ type: 'SQUARE' }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
      OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); return {}; },
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_ITEMS_ADD_ITEMS: (d) => { window.added.push(...d.items); return {}; },
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }),
      OBR_SCENE_LOCAL_GET_ITEMS: (d) => ({ items: window.local.filter((i) => d.ids.includes(i.id)) }),
      OBR_NOTIFICATION_SHOW: (d) => { window.notes.push(d.message || JSON.stringify(d)); return { id: 'n' }; },
      OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }), OBR_BROADCAST_SEND_MESSAGE: () => ({}),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/background.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const clique = (ids) => p.evaluate((ids) => window.emit('OBR_CONTEXT_MENU_EVENT_CLICK', { id: 'gatilhos/porta-animada', context: { items: ids.map((id) => window.items.find((i) => i.id === id) || window.local.find((i) => i.id === id)) } }), ids);
  await clique(['ico']); await p.waitForTimeout(600);
  let l = await p.evaluate(() => (window.meta['gatilhos/lista'] || []));
  ok('linha vermelha da porta 2 do fog: cria o gatilho com o fog e o número da porta', [l.length, l[0]?.effects[0]?.action, l[0]?.effects[0]?.targets, l[0]?.effects[0]?.doorIdx], [1, 'animDoor', ['fog'], '1']);
  ok('o ponto de uso é um círculo pequeno no centro da porta', await p.evaluate(() => window.added.map((a) => [a.type === 'SHAPE' ? a.shapeType : a.type, a.position])), [['CIRCLE', { x: 300, y: 35 }]]);
  await p.evaluate(() => { window.meta = {}; window.added = []; window.notes = []; });
  await clique(['fog', 'img']); await p.waitForTimeout(600);
  l = await p.evaluate(() => (window.meta['gatilhos/lista'] || []));
  ok('fog + imagem da porta: gatilho na imagem, alvo no fog', [l.length, l[0]?.zones, l[0]?.effects[0]?.targets, l[0]?.effects[0]?.doorImgs], [1, ['img'], ['fog'], ['img']]);
  console.log('avisos:', JSON.stringify(await p.evaluate(() => window.notes)));
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
