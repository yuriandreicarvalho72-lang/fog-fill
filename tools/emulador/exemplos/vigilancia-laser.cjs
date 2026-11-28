// Exemplo: Vigilância 1.5 — laser: quem corta o feixe dispara (aviso para o Gatilhos, pisca e efeito do Arsenal); guarda não dispara; desativado não dispara.
// Uso: tools/emulador/run.sh vigilancia &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/vigilancia-laser.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const tk = (id, name, x, y, md = {}) => ({ id, name, type: 'IMAGE', layer: 'CHARACTER', visible: true, locked: false, createdUserId: 'ana', position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100, url: 'a.png' }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, text: { plainText: name, richText: [], style: {} }, metadata: md });
    window.items = [
      { id: 'las', name: 'Laser do cofre', type: 'LINE', layer: 'DRAWING', visible: true, locked: false, position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, startPosition: { x: 0, y: 500 }, endPosition: { x: 600, y: 500 }, style: { strokeColor: '#f00', strokeWidth: 6, strokeOpacity: 1, strokeDash: [] }, metadata: { 'vigilancia/laser': { video: 'https://x.io/faisca.webm', tipo: 'area', tamanho: 3, cooldown: 2 }, 'vigilancia/no': { name: 'Laser do cofre', type: 'laser', state: 'ativo' } } },
      tk('rex', 'Rex', 300, 200), tk('guarda', 'Guarda', 100, 200, { 'vigilancia/camera': { angle: 90, range: 5 } }),
    ];
    window.meta = {}; window.local = []; window.sent = [];
    const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) delete it[k]; else it[k] = JSON.parse(JSON.stringify(v)); } } };
    window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
    window.move = (id, x, y) => { const it = window.items.find((i) => i.id === id); it.position = { x, y }; window.change(); };
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [{ connectionId: 'gm1', role: 'GM', id: 'gmU' }] }),
      OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 100 }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { apply(d); setTimeout(window.change, 5); return {}; },
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }),
      OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); return {}; },
      OBR_SCENE_LOCAL_DELETE_ITEMS: (d) => { window.local = window.local.filter((i) => !d.ids.includes(i.id)); return {}; },
      OBR_SCENE_LOCAL_UPDATE_ITEMS: () => ({}),
      OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }),
      OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data]); if (d.channel === 'vigilancia/laser') setTimeout(() => window.emit('OBR_BROADCAST_MESSAGE_vigilancia/laser', { data: d.data, connectionId: 'gm1' }), 5); return {}; },
      OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', primary: { main: '#bb99ff' }, secondary: { main: '#ee99ff' }, background: { default: '#222', paper: '#333' }, text: { primary: '#fff', secondary: '#ccc', disabled: '#999' } } }),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/vigilancia/background.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const sent = (ch) => p.evaluate((c) => window.sent.filter((s) => s[0] === c).map((s) => s[1]).filter((d) => c !== 'vigilancia/viu' || d.camera === 'las'), ch); // (o guarda é uma câmera: ignoramos o que ELE vê)
  ok('brilho do laser desenhado para o mestre', await p.evaluate(() => window.local.filter((l) => /laser-las/.test(l.id)).length), 1);
  // o guarda anda por cima do feixe: não dispara
  await p.evaluate(() => window.move('guarda', 100, 500)); await p.waitForTimeout(700);
  ok('guarda sobre o feixe não dispara', (await sent('vigilancia/viu')).length, 0);
  // o jogador atravessa: dispara
  await p.evaluate(() => window.move('rex', 300, 495)); await p.waitForTimeout(700);
  const viu = await sent('vigilancia/viu');
  ok('Rex corta o laser: aviso para o Gatilhos (laser, câmera = id do laser)', [viu.length, viu[0]?.camera, viu[0]?.tokens, viu[0]?.laser], [1, 'las', ['rex'], true]);
  const fl = await sent('vigilancia/laser');
  ok('pisca para todas as telas no ponto do feixe', [fl.length, fl[0]?.q, fl[0]?.pulso], [1, { x: 300, y: 500 }, true]);
  const fx = await sent('arsenal/efeito');
  ok('efeito do Arsenal (vídeo) no ponto do feixe', [fx.length, fx[0]?.video, fx[0]?.point, fx[0]?.tamanho], [1, { url: 'https://x.io/faisca.webm', tipo: 'area', giro: 0 }, { x: 300, y: 500 }, 3]);
  await p.waitForTimeout(900);
  ok('o pisca fez itens locais e eles somem sozinhos', [await p.evaluate(() => window.local.filter((l) => /flash/.test(l.id)).length)], [0]);
  // continua em cima: não repete; sai e volta dentro da pausa: não repete
  await p.waitForTimeout(500);
  ok('ficar parado em cima não repete', (await sent('vigilancia/viu')).length, 1);
  // desativado (hack): atravessar não dispara
  await p.evaluate(() => { window.move('rex', 300, 200); window.items.find((i) => i.id === 'las').metadata['vigilancia/no'].state = 'hackeado'; window.change(); }); await p.waitForTimeout(500);
  await p.evaluate(() => window.move('rex', 300, 800)); await p.waitForTimeout(700);
  ok('laser hackeado não dispara', (await sent('vigilancia/viu')).length, 1);
  ok('e o brilho some', await p.evaluate(() => window.local.filter((l) => /laser-las/.test(l.id)).length), 0);
  // teste do painel: dispara o efeito sem avisar o Gatilhos
  await p.evaluate(() => { window.items.find((i) => i.id === 'las').metadata['vigilancia/no'].state = 'ativo'; window.change(); }); await p.waitForTimeout(300);
  await p.evaluate(() => window.emit('OBR_BROADCAST_MESSAGE_vigilancia/laser-teste', { data: { id: 'las' }, connectionId: 'gm1' })); await p.waitForTimeout(600);
  ok('testar: pisca e efeito, mas sem aviso ao Gatilhos', [(await sent('vigilancia/laser')).length, (await sent('arsenal/efeito')).length, (await sent('vigilancia/viu')).length], [2, 2, 1]);
  // painel do mestre com o laser selecionado
  await p.evaluate(() => { window.responders.OBR_PLAYER_GET_SELECTION = () => ({ selection: ['las'] }); });
  await p.evaluate((u) => window.load(u), `http://localhost:8002/vigilancia/index.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const fr = p.frames()[1];
  ok('painel: formulário do laser, lista de quem não dispara, efeito e testar', await fr.evaluate(() => [/🔴 Laser/.test(document.body.innerText), !!document.querySelector('#lsAdd'), !!document.querySelector('[data-ls="video"]'), !!document.querySelector('#lsTest'), document.querySelector('[data-ls="video"]').value]), [true, true, true, true, 'https://x.io/faisca.webm']);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
