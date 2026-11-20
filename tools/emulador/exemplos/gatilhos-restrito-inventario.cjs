// Exemplo: Gatilhos com restrito (gasto, nó hackeado) e passar item, num mestre e jogadores simulados.
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-restrito-inventario.cjs
// Interagir: mestre recebe o pedido do jogador; jogador clica; brilho; trava contra arrasto.
const { chromium } = require('playwright');
async function page(b, role, me) {
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(([role, me]) => {
    const img = (id, layer, x, y, name, owner = 'gmU') => ({ id, name, type: 'IMAGE', layer, visible: true, locked: false, createdUserId: owner, lastModifiedUserId: owner, position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: {} });
    const S = 'com.battle-system.smoke/';
    const curve = (id, pts, md) => ({ id, name: 'Obstruction Line', type: 'CURVE', layer: 'POINTER', visible: false, locked: false, createdUserId: 'gmU', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, points: pts, style: { closed: false, strokeColor: '#000', strokeWidth: 10 }, text: { plainText: '' }, metadata: md });
    window.items = [curve('porta', [{ x: 600, y: 300 }, { x: 600, y: 450 }], { [S + 'isVisionLine']: true, [S + 'isDoor']: true, [S + 'blocking']: true }), img('rex', 'CHARACTER', 525, 375, 'Rex', 'u1'), img('kai', 'CHARACTER', 1275, 375, 'Kai', 'u2'),
      curve('parede', [{ x: 600, y: 450 }, { x: 600, y: 900 }], { [S + 'isVisionLine']: true, [S + 'blocking']: true })];
    window.items.push({ id: 'card', name: 'Cartão de Acesso Nível 3', type: 'IMAGE', layer: 'PROP', visible: false, locked: false, createdUserId: 'gmU', position: { x: 1275, y: 1275 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 60 }, grid: { dpi: 200, offset: { x: 50, y: 30 } }, metadata: {} });
    window.items.push({ id: 'painel', name: 'Painel', type: 'SHAPE', layer: 'DRAWING', visible: true, position: { x: 0, y: 0 }, metadata: { 'vigilancia/no': { state: 'ativo' } } }, { id: 'card2', name: 'Cartão de Acesso', type: 'IMAGE', layer: 'ATTACHMENT', visible: true, attachedTo: 'rex', position: { x: 577, y: 427 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 60 }, grid: { dpi: 200, offset: { x: 50, y: 30 } }, metadata: {} });
    window.meta = { 'gatilhos/lista': [
      { id: 'tp', name: 'Porta do laboratório', armed: true, once: false, delay: 0, zones: ['porta'], cause: 'interact', reach: 1, canUse: 'all', glow: true, who: 'chars', tokens: [], reqItem: 'Cartão de acesso', reqMsg: '', reqShow: 'aviso', reqUses: 1, reqNodes: ['painel'],
        effects: [{ id: 'd1', action: 'door', doorOp: 'alternar', targets: ['porta'], delay: 0 }] }] };
    window.local = []; window.localUpd = 0; window.sent = []; window.notes = []; window.warns = []; window.deselect = 0;
    const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) { delete it[k]; continue; } if (k === 'metadata') { it.metadata = JSON.parse(JSON.stringify(v)); } else it[k] = JSON.parse(JSON.stringify(v)); } it.lastModifiedUserId = window.ME; } };
    window.ME = me.id;
    window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role }), OBR_PLAYER_GET_ID: () => ({ id: me.id }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: me.conn }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [{ connectionId: 'p1', role: 'PLAYER', id: 'u1' }, { connectionId: 'p2', role: 'PLAYER', id: 'u2' }] }),
      OBR_SCENE_IS_READY: () => ({ ready: true }),
      OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_GRID_GET_TYPE: () => ({ type: 'SQUARE' }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
      OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); return {}; },
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_ITEMS_DELETE_ITEMS: (d) => { window.items = window.items.filter((i) => !d.ids.includes(i.id)); setTimeout(window.change, 5); return {}; }, OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { apply(d); setTimeout(window.change, 5); return {}; },
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }),
      OBR_SCENE_LOCAL_GET_ITEMS: (d) => ({ items: window.local.filter((i) => d.ids.includes(i.id)) }),
      OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); return {}; },
      OBR_SCENE_LOCAL_DELETE_ITEMS: (d) => { window.local = window.local.filter((i) => !d.ids.includes(i.id)); return {}; },
      OBR_SCENE_LOCAL_UPDATE_ITEMS: (d) => { window.localUpd++; window.lastPulse = d.updates; return {}; },
      OBR_PLAYER_DESELECT: () => { window.deselect++; return {}; },
      OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data, d.options?.destination]); if (d.channel === 'gatilhos/aviso') window.emit('OBR_BROADCAST_MESSAGE_gatilhos/aviso', { data: d.data, connectionId: me.conn }); return {}; },
      OBR_MODAL_OPEN: (d) => { (window.modals = window.modals || []).push(d.url); return {}; },
      OBR_NOTIFICATION_SHOW: (d) => { (d.variant === 'WARNING' ? window.warns : window.notes).push(d.message); return { id: 'n' }; },
    });
  }, [role, me]);
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/background.html?obrref=${ref}`);
  await p.waitForTimeout(900);
  return { p, errs };
}
(async () => {
  const b = await chromium.launch();
  const { p: gm, errs } = await page(b, 'GM', { id: 'gmU', conn: 'gm1' });
  await gm.evaluate(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta })); await gm.evaluate(() => window.change()); await gm.waitForTimeout(400);
  const has = (id) => gm.evaluate((id) => !!window.items.find((i) => i.id === id), id);
  const doorOpen = () => gm.evaluate(() => Object.keys(window.items.find((i) => i.id === 'porta').metadata).some((k) => /doorOpen/.test(k)));
  const ask = (conn = 'p1') => gm.evaluate((conn) => window.emit('OBR_BROADCAST_MESSAGE_gatilhos/interagir', { data: { itemId: 'porta' }, connectionId: conn }), conn);
  const give = (itemId, toId, conn) => gm.evaluate(([i, t, c]) => window.emit('OBR_BROADCAST_MESSAGE_gatilhos/dar', { data: { itemId: i, toId: t }, connectionId: c }), [itemId, toId, conn]);
  const log = () => gm.evaluate(() => window.sent.filter((s) => s[0] === 'gatilhos/log' || s[0] === 'gatilhos/aviso' || s[0] === 'gatilhos/negado').map((s) => s[1].text));
  // gasto: 1 uso, o cartão some e a porta abre
  await gm.waitForTimeout(1200); await ask(); await gm.waitForTimeout(1200);
  console.log('log:', JSON.stringify(await log())); console.log('GASTO porta aberta:', await doorOpen(), '| cartão ainda existe:', await has('card2'));
  // clonado: painel hackeado, Rex sem cartão abre a porta fechada
  await gm.evaluate(() => { const p = window.items.find((i) => i.id === 'porta'); for (const k of Object.keys(p.metadata)) if (/doorOpen|disabled/.test(k)) delete p.metadata[k]; window.items.find((i) => i.id === 'painel').metadata['vigilancia/no'].state = 'hackeado'; window.change(); });
  await gm.waitForTimeout(300); await ask(); await gm.waitForTimeout(500);
  console.log('CLONADO (nó hackeado) abre sem cartão:', await doorOpen());
  // passar item: Rex (u1) tem cartão novo; Kai (u2) está longe, depois ao lado
  await gm.evaluate(() => { window.items.push({ id: 'card3', name: 'Chave', type: 'IMAGE', layer: 'ATTACHMENT', visible: true, attachedTo: 'rex', position: { x: 577, y: 427 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 60 }, grid: { dpi: 200, offset: { x: 50, y: 30 } }, metadata: {} }); window.change(); });
  await gm.waitForTimeout(200);
  await give('card3', 'kai', 'p1'); await gm.waitForTimeout(400);
  console.log('PASSAR longe: chave com', await gm.evaluate(() => window.items.find((i) => i.id === 'card3').attachedTo), '| negado:', JSON.stringify(await gm.evaluate(() => window.sent.filter((s) => s[0] === 'gatilhos/negado').map((s) => s[1].text).slice(-1))));
  await gm.evaluate(() => { window.items.find((i) => i.id === 'kai').position = { x: 675, y: 375 }; window.change(); }); await gm.waitForTimeout(200);
  await give('card3', 'kai', 'p2'); await gm.waitForTimeout(400);
  console.log('PASSAR de quem não é dono (u2 pede): chave com', await gm.evaluate(() => window.items.find((i) => i.id === 'card3').attachedTo));
  await give('card3', 'kai', 'p1'); await gm.waitForTimeout(500);
  console.log('PASSAR ao lado: chave com', await gm.evaluate(() => window.items.find((i) => i.id === 'card3').attachedTo), '| aviso:', JSON.stringify(await gm.evaluate(() => window.sent.filter((s) => s[0] === 'gatilhos/aviso').map((s) => s[1].text).slice(-1))));
  console.log('erros:', errs);
  // painel do jogador: inventário
  await b.close();
})();
