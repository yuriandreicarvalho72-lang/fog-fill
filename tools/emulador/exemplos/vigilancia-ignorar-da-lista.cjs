// Exemplo: Vigilância 1.4.2 — escolher quem a câmera não vê numa lista (sem mudar a seleção) e ícone do comlink na barra lateral.
// Uso: tools/emulador/run.sh vigilancia &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/vigilancia-ignorar-da-lista.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const img = (id, name, x, md = {}) => ({ id, name, type: 'IMAGE', layer: 'CHARACTER', visible: true, locked: false, createdUserId: 'gm', position: { x, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100, url: 'a.png' }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, text: { plainText: name, richText: [], style: {} }, metadata: md });
    window.items = [img('cam', 'Câmera 1', 0, { 'vigilancia/camera': { angle: 90, range: 5 }, 'vigilancia/no': { name: 'Câmera 1', type: 'camera', state: 'ativo' } }), img('npc', 'Segurança Zé', 300), img('pc', 'Rex', 600)];
    window.actions = [];
    window.meta = {}; window.local = []; window.pmeta = {};
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gm' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'c1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 100 }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }), OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }), OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); return {}; },
      OBR_SCENE_LOCAL_DELETE_ITEMS: () => ({}), OBR_SCENE_LOCAL_UPDATE_ITEMS: () => ({}),
      OBR_PLAYER_GET_SELECTION: () => ({ selection: ['cam'] }), OBR_BROADCAST_SEND_MESSAGE: () => ({}),
      OBR_PLAYER_GET_METADATA: () => ({ metadata: window.pmeta }), OBR_PLAYER_SET_METADATA: () => ({}),
      OBR_TOOL_ACTION_CREATE: (d) => { window.actions.push(d.id); return {}; },
      OBR_SCENE_ITEMS_UPDATE_ITEMS: null,
      OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', primary: { main: '#bb99ff' }, secondary: { main: '#ee99ff' }, background: { default: '#222', paper: '#333' }, text: { primary: '#fff', secondary: '#ccc', disabled: '#999' } } }),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/vigilancia/background.html?obrref=${ref}`); await p.waitForTimeout(1200);
  ok('ícone do comlink criado na barra lateral', await p.evaluate(() => window.actions.filter((a) => /comlink/.test(a))), ['vigilancia/comlink']);
  await p.evaluate((u) => window.load(u), `http://localhost:8002/vigilancia/index.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const fr = p.frames()[1];
  ok('lista de quem escolher: sem a própria câmera', await fr.evaluate(() => [...document.querySelectorAll('#ignAdd option')].map((o) => o.textContent)), ['+ escolher da lista…', 'Segurança Zé', 'Rex']);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
