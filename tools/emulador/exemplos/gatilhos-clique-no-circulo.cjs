// Exemplo: Gatilhos 1.22 — interagir clicando no círculo de destaque (tamanho ajustável), como jogador.
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-clique-no-circulo.cjs
const { chromium } = require('playwright');
const S = 'com.battle-system.smoke/';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const S = 'com.battle-system.smoke/';
    const img = (id, name, layer, x, y, owner, md = {}) => ({ id, name, type: 'IMAGE', layer, visible: true, locked: false, createdUserId: owner, position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: md });
    const linha = (id, md) => ({ id, name: 'Linha', type: 'CURVE', layer: 'POINTER', visible: false, locked: false, createdUserId: 'gmU', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, points: [{ x: 600, y: 300 }, { x: 600, y: 450 }], style: { closed: false }, text: { plainText: '' }, metadata: md });
    window.items = [linha('linha', { [S + 'isVisionLine']: true, [S + 'isDoor']: true, [S + 'blocking']: true }), linha('trancada', { [S + 'isVisionLine']: true, [S + 'isDoor']: true, [S + 'isDoorLocked']: true }),
      img('porta', 'Porta', 'PROP', 600, 375, 'gmU', { 'trocador/imagens': [{ id: 'a', name: 'Fechada', url: 'f.png' }, { id: 'b', name: 'Aberta', url: 'a.png' }] }), img('porta2', 'Porta 2', 'PROP', 900, 375, 'gmU'), img('rex', 'Rex', 'CHARACTER', 525, 375, 'u1')];
    const fx = (o) => ({ id: Math.random().toString(36).slice(2, 7), delay: 0, targets: [], audience: 'all', ...o });
    const tr = (o) => ({ armed: true, once: false, delay: 0, zones: [], radius: 2, who: 'chars', tokens: [], conds: [], reach: 1, canUse: 'all', glow: true, reqItem: '', reqNodes: [], effects: [], ...o });
    const porta = (o) => fx({ action: 'animDoor', targets: ['linha'], doorImgs: ['porta'], doorOp: 'alternar', vfxOpen: 'https://x.io/abre.webm', vfxClose: 'https://x.io/fecha.webm', vfxWait: 1, imgOpen: 'Aberta', imgClosed: 'Fechada', fxTipo: 'area', fxSize: 2, ...o });
    window.meta = { 'gatilhos/lista': [
      tr({ id: 'p', name: 'Porta animada', cause: 'manual', effects: [porta()] }),
      tr({ id: 'ab', name: 'Só abrir', cause: 'manual', effects: [porta({ doorOp: 'abrir' })] }),
      tr({ id: 'tr', name: 'Trancada', cause: 'manual', effects: [porta({ targets: ['trancada'], doorImgs: [] })] }),
      tr({ id: 'img', name: 'Só imagem', cause: 'manual', effects: [porta({ targets: [], doorImgs: ['porta2'], vfxOpen: '', vfxWait: 0 })] }),
      tr({ id: 'rex', name: 'Interagir', cause: 'interact', zones: ['porta'], reach: 0, glowD: 4, effects: [porta()] }),
      tr({ id: 'sem', name: 'Sem clique no círculo', cause: 'interact', zones: ['porta2'], reach: 0, glowClick: false, effects: [porta({ targets: [], doorImgs: ['porta2'] })] }),
    ] };
    window.sent = []; window.local = [];
    const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) delete it[k]; else it[k] = JSON.parse(JSON.stringify(v)); } } };
    window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'PLAYER' }), OBR_PLAYER_GET_ID: () => ({ id: 'u1' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'p1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [{ connectionId: 'gm1', role: 'GM', id: 'gmU' }, { connectionId: 'p1', role: 'PLAYER', id: 'u1' }] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_GRID_GET_TYPE: () => ({ type: 'SQUARE' }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
      OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); setTimeout(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }), 5); return {}; },
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { apply(d); setTimeout(window.change, 5); return {}; },
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }), OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); return {}; }, OBR_SCENE_LOCAL_DELETE_ITEMS: (d) => { window.local = window.local.filter((i) => !d.ids.includes(i.id)); return {}; }, OBR_SCENE_LOCAL_UPDATE_ITEMS: () => ({}), OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }),
      OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data]); return {}; },
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/background.html?obrref=${ref}`); await p.waitForTimeout(1000);
  await p.evaluate(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta })); await p.evaluate(() => window.change()); await p.waitForTimeout(400);
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const fire = (id) => p.evaluate((id) => window.emit('OBR_BROADCAST_MESSAGE_gatilhos/disparar', { data: { id, force: true }, connectionId: 'gm1' }), id);
  const sent = (ch, from) => p.evaluate(([c, f]) => window.sent.slice(f).filter((s) => s[0] === c).map((s) => s[1]), [ch, from]);
  const mark = () => p.evaluate(() => window.sent.length);
  const aberta = (id) => p.evaluate((id) => Object.keys(window.items.find((i) => i.id === id).metadata).some((k) => /doorOpen/.test(k)), id);
  const wait = (ms) => p.waitForTimeout(ms);

  const ringOf = (item) => p.evaluate((id) => window.local.find((r) => r.metadata && r.metadata['gatilhos/brilho'] === id), item);
  const r1 = await ringOf('porta'), r2 = await ringOf('porta2');
  ok('círculo de 4 quadrados (600 px) e clicável (camada Prop, com clique)', r1 && [r1.width, r1.layer, r1.disableHit], [600, 'PROP', false]);
  ok('com "clicar no círculo" desligado: só enfeite (sem clique)', r2 && [r2.layer, r2.disableHit], ['ATTACHMENT', true]);
  const sel = (ids) => p.evaluate((ids) => window.emit('OBR_PLAYER_EVENT_CHANGE', { player: { id: 'u1', role: 'PLAYER', selection: ids } }), ids);
  let m = await mark(); await sel([r1.id]); await wait(500);
  ok('clicar no círculo usa o objeto (pede ao mestre)', (await sent('gatilhos/interagir', m)).map((d) => d.itemId), ['porta']);
  await sel([]); await wait(200);
  m = await mark(); await sel([r2.id]); await wait(500);
  ok('círculo sem a opção: não faz nada', (await sent('gatilhos/interagir', m)).length, 0);
  await sel([]); await wait(200);
  m = await mark(); await sel(['porta']); await wait(500);
  ok('clicar no próprio objeto continua funcionando', (await sent('gatilhos/interagir', m)).map((d) => d.itemId), ['porta']);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
