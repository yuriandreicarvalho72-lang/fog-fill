// Exemplo: Vigilância 1.4 — jogador com commlink vê os nós ao redor e "vê pela câmera" (só câmera hackeada): enquadra e escurece fora do cone.
// Uso: tools/emulador/run.sh vigilancia &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/vigilancia-ver-pela-camera.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const img = (id, name, x, md = {}, extra = {}) => ({ id, name, type: 'IMAGE', layer: 'CHARACTER', visible: true, locked: false, createdUserId: 'p1', position: { x, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100, url: 'a.png' }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, text: { plainText: name, richText: [], style: {} }, metadata: md, ...extra });
    window.items = [
      img('tk', 'Decker', 0, { 'vigilancia/commlink': true }),
      img('cam', 'Câmera 1', 400, { 'vigilancia/camera': { angle: 90, range: 5 }, 'vigilancia/no': { name: 'Câmera 1', type: 'camera', state: 'ativo' } }, { createdUserId: 'gm' }),
      img('longe', 'Painel longe', 5000, { 'vigilancia/no': { name: 'Painel longe', type: 'painel', state: 'ativo' } }, { createdUserId: 'gm' }),
    ];
    window.meta = {}; window.local = []; window.pmeta = {}; window.viewport = []; window.vp = { pos: { x: 7, y: 8 }, scale: 1.5 };
    window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'PLAYER' }), OBR_PLAYER_GET_ID: () => ({ id: 'p1' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'c1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 100 }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }),
      OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); return {}; },
      OBR_SCENE_LOCAL_DELETE_ITEMS: (d) => { window.local = window.local.filter((i) => !d.ids.includes(i.id)); return {}; },
      OBR_SCENE_LOCAL_UPDATE_ITEMS: () => ({}),
      OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }), OBR_BROADCAST_SEND_MESSAGE: () => ({}),
      OBR_PLAYER_GET_METADATA: () => ({ metadata: window.pmeta }),
      OBR_PLAYER_SET_METADATA: (d) => { window.pmeta = { ...window.pmeta, ...d.update }; setTimeout(() => window.emit('OBR_PLAYER_EVENT_CHANGE', { player: { id: 'p1', role: 'PLAYER', metadata: window.pmeta, selection: [] } }), 5); return {}; },
      OBR_VIEWPORT_GET_POSITION: () => ({ position: window.vp.pos }), OBR_VIEWPORT_GET_SCALE: () => ({ scale: window.vp.scale }),
      OBR_VIEWPORT_ANIMATE_TO_BOUNDS: (d) => { window.viewport.push(['bounds', d.bounds.center]); return {}; },
      OBR_VIEWPORT_SET_POSITION: (d) => { window.viewport.push(['pos', d.position]); return {}; }, OBR_VIEWPORT_SET_SCALE: (d) => { window.viewport.push(['scale', d.scale]); return {}; },
      OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', primary: { main: '#bb99ff' }, secondary: { main: '#ee99ff' }, background: { default: '#222', paper: '#333' }, text: { primary: '#fff', secondary: '#ccc', disabled: '#999' } } }),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/vigilancia/background.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const masks = () => p.evaluate(() => window.local.filter((l) => /feed/.test(l.id)).map((l) => [l.fillRule, l.layer, l.commands.length > 9]));
  ok('sem pedir, nada de máscara', await masks(), []);
  // jogador pede ver pela câmera ainda ATIVA: não pode
  await p.evaluate(() => { window.pmeta = { 'vigilancia/assistindo': 'cam' }; window.emit('OBR_PLAYER_EVENT_CHANGE', { player: { id: 'p1', role: 'PLAYER', metadata: window.pmeta, selection: [] } }); }); await p.waitForTimeout(600);
  ok('câmera não hackeada: sem máscara e o pedido é limpo', [await masks(), await p.evaluate(() => window.pmeta['vigilancia/assistindo'])], [[], '']);
  // hackeada: pode
  await p.evaluate(() => { window.items[1].metadata['vigilancia/no'].state = 'hackeado'; window.change(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { window.pmeta = { 'vigilancia/assistindo': 'cam' }; window.emit('OBR_PLAYER_EVENT_CHANGE', { player: { id: 'p1', role: 'PLAYER', metadata: window.pmeta, selection: [] } }); }); await p.waitForTimeout(800);
  ok('câmera hackeada: máscara escura com buraco no topo (POINTER)', await masks(), [['evenodd', 'POINTER', true]]);
  ok('a tela foi enquadrada na câmera', await p.evaluate(() => window.viewport.filter((v) => v[0] === 'bounds').length), 1);
  // o mestre desfaz o hack: sai sozinho e devolve o enquadramento
  await p.evaluate(() => { window.items[1].metadata['vigilancia/no'].state = 'ativo'; window.change(); }); await p.waitForTimeout(800);
  ok('hack desfeito: máscara some e enquadramento volta', [await masks(), await p.evaluate(() => window.viewport.filter((v) => v[0] !== 'bounds'))], [[], [['pos', { x: 7, y: 8 }], ['scale', 1.5]]]);
  // painel do jogador: nós ao redor por distância
  await p.evaluate((u) => window.load(u), `http://localhost:8002/vigilancia/index.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const fr = p.frames()[1];
  const txt = await fr.evaluate(() => document.body.innerText);
  ok('painel: título, o nó perto aparece com distância e o longe fica de fora', [/nós ao redor/i.test(txt), /Câmera 1/.test(txt), /4\.0/.test(txt), /Painel longe/.test(txt), /1 nó\(s\) fora do alcance/.test(txt)], [true, true, true, false, true]);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
