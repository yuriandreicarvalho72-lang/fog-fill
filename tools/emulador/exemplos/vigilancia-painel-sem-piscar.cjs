// Exemplo: Vigilância 1.3.2 — o painel não se redesenha (não pisca) quando só a posição de itens muda (ronda, tokens).
// Uso: tools/emulador/run.sh vigilancia &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/vigilancia-painel-sem-piscar.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 160)); });
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const img = (id, name, x) => ({ id, name, type: 'IMAGE', layer: 'CHARACTER', visible: true, locked: false, createdUserId: 'gmU', position: { x, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100, url: 'a.png' }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, metadata: {} });
    window.items = [img('g', 'Guarda', 0), img('o', 'Outro', 500)];
    window.items[0].metadata['vigilancia/camera'] = { angle: 90, range: 6 };
    window.items[0].metadata['vigilancia/ronda'] = { on: true, speed: 1 };
    window.meta = {}; window.sent = [];
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 100 }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }), OBR_BROADCAST_SEND_MESSAGE: () => ({}),
      OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', primary: { main: '#bb99ff' }, secondary: { main: '#ee99ff' }, background: { default: '#222', paper: '#333' }, text: { primary: '#fff', secondary: '#ccc', disabled: '#999' } } }),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/vigilancia/index.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const fr = p.frames()[1];
  await fr.evaluate(() => { document.getElementById('pCones')?.setAttribute('data-marca', '1'); });
  const marca = () => fr.evaluate(() => document.getElementById('pCones')?.getAttribute('data-marca'));
  ok('painel desenhado', await marca(), '1');
  // a ronda move o guarda (posição, rotação, olhar) 10 vezes: o painel não pode ser refeito
  for (let i = 1; i <= 10; i++) {
    await p.evaluate((i) => { const g = window.items[0]; g.position = { x: i * 30, y: 0 }; g.rotation = i; g.metadata['vigilancia/olhar'] = i * 9; window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) }); }, i);
    await p.waitForTimeout(220);
  }
  ok('mover/girar itens não redesenha o painel', await marca(), '1');
  // mudar algo que o painel mostra (nome do item) redesenha
  await p.evaluate(() => { window.items[1].name = 'Renomeado'; window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) }); });
  await p.waitForTimeout(500);
  ok('mudar o que o painel mostra redesenha', await marca(), null);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
