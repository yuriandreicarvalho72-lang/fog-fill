// Exemplo: Seleção total 1.0 — clique pega o item trancado, de novo no mesmo ponto desce a pilha até o fog e o mapa; caixa seleciona vários.
// Uso: tools/emulador/run.sh selecao &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/selecao-total.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const it = (id, layer, locked, b) => ({ id, name: id, type: 'IMAGE', layer, visible: true, locked, position: { x: b[0], y: b[1] }, rotation: 0, scale: { x: 1, y: 1 }, zIndex: 0, metadata: {}, _b: { min: { x: b[0], y: b[1] }, max: { x: b[2], y: b[3] } } });
    window.items = [it('mapa', 'MAP', true, [-1000, -1000, 5000, 5000]), it('fog', 'FOG', true, [-1000, -1000, 5000, 5000]), it('cofre', 'PROP', true, [100, 100, 200, 160]), it('rex', 'CHARACTER', false, [400, 400, 450, 450])];
    window.sel = []; window.created = []; window.notes = [];
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gm' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'c1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEM_BOUNDS: (d) => ({ bounds: window.items.find((i) => i.id === d.ids[0])._b }),
      OBR_PLAYER_GET_SELECTION: () => ({ selection: window.sel }),
      OBR_PLAYER_SELECT: (d) => { window.sel = d.items; return {}; }, OBR_PLAYER_DESELECT: () => { window.sel = []; return {}; },
      OBR_VIEWPORT_GET_SCALE: () => ({ scale: 1 }),
      OBR_NOTIFICATION_SHOW: (d) => { window.notes.push(d.notification?.message || ''); return { id: 'n' }; },
      OBR_SCENE_LOCAL_ADD_ITEMS: () => ({}), OBR_SCENE_LOCAL_UPDATE_ITEMS: () => ({}), OBR_SCENE_LOCAL_DELETE_ITEMS: () => ({}),
      OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', primary: { main: '#bb99ff' }, secondary: { main: '#ee99ff' }, background: { default: '#222', paper: '#333' }, text: { primary: '#fff', secondary: '#ccc', disabled: '#999' } } }),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/selecao/background.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const ev = (name, x, y, extra = {}) => p.evaluate(([n, x, y, e]) => window.emit(n, { id: 'fog-fill.selecao/selecionar', context: {}, event: { pointerPosition: { x, y }, ...e } }), [name, x, y, extra]);
  const sel = () => p.evaluate(() => window.sel);
  await ev('OBR_TOOL_MODE_EVENT_TOOL_CLICK', 150, 130); await p.waitForTimeout(400);
  ok('1º clique: o cofre TRANCADO', await sel(), ['cofre']);
  await ev('OBR_TOOL_MODE_EVENT_TOOL_CLICK', 151, 131); await p.waitForTimeout(400);
  ok('2º clique no mesmo ponto: o fog', await sel(), ['fog']);
  await ev('OBR_TOOL_MODE_EVENT_TOOL_CLICK', 150, 130); await p.waitForTimeout(400);
  ok('3º clique: o mapa', await sel(), ['mapa']);
  await ev('OBR_TOOL_MODE_EVENT_TOOL_CLICK', 420, 420, { shiftKey: true }); await p.waitForTimeout(400);
  ok('shift soma o personagem', await sel(), ['mapa', 'rex']);
  await ev('OBR_TOOL_MODE_EVENT_TOOL_DOWN', 50, 50); await ev('OBR_TOOL_MODE_EVENT_TOOL_DRAG_START', 60, 60); await ev('OBR_TOOL_MODE_EVENT_TOOL_DRAG_MOVE', 300, 300);
  await ev('OBR_TOOL_MODE_EVENT_TOOL_DRAG_END', 300, 300); await p.waitForTimeout(400);
  ok('caixa: só o cofre cabe inteiro', await sel(), ['cofre']);
  await ev('OBR_TOOL_MODE_EVENT_TOOL_DOWN', 50, 50); await ev('OBR_TOOL_MODE_EVENT_TOOL_DRAG_START', 60, 60); await ev('OBR_TOOL_MODE_EVENT_TOOL_DRAG_MOVE', 300, 300);
  await ev('OBR_TOOL_MODE_EVENT_TOOL_DRAG_END', 300, 300, { altKey: true }); await p.waitForTimeout(400);
  ok('caixa com Alt: encosta no mapa, fog e cofre', (await sel()).sort(), ['cofre', 'fog', 'mapa']);
  await ev('OBR_TOOL_MODE_EVENT_TOOL_CLICK', 3000, 3000); await p.waitForTimeout(300); await ev('OBR_TOOL_MODE_EVENT_TOOL_CLICK', 3000, 3000); await p.waitForTimeout(300);
  console.log('avisos:', JSON.stringify((await p.evaluate(() => window.notes)).slice(0, 3)));
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
