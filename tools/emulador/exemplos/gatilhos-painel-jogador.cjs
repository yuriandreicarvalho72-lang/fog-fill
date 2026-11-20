// Exemplo: painel do JOGADOR dos Gatilhos (inventário), conferindo o texto da tela.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 1500 } });
  const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    document.getElementById('f').style.cssText = 'width:380px;height:1480px;background:#22262e';
    const im = (id, name, layer, x, y, owner) => ({ id, name, type: 'IMAGE', layer, visible: true, createdUserId: owner, position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: {} });
    const im2 = (id, name, layer, x, y, owner, extra = {}) => ({ id, name, type: 'IMAGE', layer, visible: true, createdUserId: owner, position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: {}, ...extra });
    window.items = [im2('rex', 'Rex', 'CHARACTER', 225, 375, 'u1'), im2('kai', 'Kai', 'CHARACTER', 375, 375, 'u2'), im2('lia', 'Lia', 'CHARACTER', 1500, 375, 'u3'), im2('c', 'Cartão de Acesso', 'ATTACHMENT', 250, 400, 'gm', { attachedTo: 'rex' }), im2('f', 'Chip fixo', 'ATTACHMENT', 250, 400, 'gm', { attachedTo: 'rex', metadata: { 'gatilhos/item': { give: false } } })];
    window.meta = { 'gatilhos/lista': [] };
    Object.assign(window.responders, {
      OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', text: { primary: '#fff', secondary: '#aaa' }, primary: { main: '#bb99ff' } } }),
      OBR_PLAYER_GET_ROLE: () => ({ role: 'PLAYER' }), OBR_PLAYER_GET_ID: () => ({ id: 'u1' }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_PLAYER_GET_ID: () => ({ id: 'u1' }), OBR_SCENE_IS_READY: () => ({ ready: true }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); return {}; },
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/index.html?obrref=${ref}`);
  await p.waitForTimeout(1500);
  const fr = p.frames()[1];
  await p.waitForTimeout(500);
  console.log('INVENTARIO:', (await fr.innerText('#inv')).replace(/\n+/g, ' | '), '| botoes Passar:', await fr.locator('[data-give]').count(), '| erros:', errs);
  await b.close();
})();
