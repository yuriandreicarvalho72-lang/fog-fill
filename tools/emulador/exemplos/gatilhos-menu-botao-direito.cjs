// Exemplo: Gatilhos 1.15 — botão direito no item lista os gatilhos de que ele faz parte e ativa pelo menu.
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-menu-botao-direito.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const img = (id, name, layer, x) => ({ id, name, type: 'IMAGE', layer, visible: true, createdUserId: 'gmU', position: { x, y: 300 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: {} });
    window.items = [img('rex', 'Rex', 'CHARACTER', 300), img('painel', 'Painel', 'PROP', 900), img('luz', 'Luz', 'PROP', 1200)];
    const fx = (o) => ({ id: Math.random().toString(36).slice(2, 7), delay: 0, targets: [], audience: 'all', ...o });
    const tr = (o) => ({ armed: true, once: false, delay: 0, zones: [], radius: 2, who: 'chars', tokens: [], conds: [], effects: [], ...o });
    window.meta = { 'gatilhos/lista': [
      tr({ id: 'a', name: 'Alarme do painel', cause: 'interact', zones: ['painel'], effects: [fx({ action: 'notify', text: 'Alarme! {quem}' }), fx({ action: 'hide', targets: ['luz'] })] }),
      tr({ id: 'b', name: 'Sem itens', cause: 'manual', effects: [fx({ action: 'notify', text: 'x' })] }),
      tr({ id: 'c', name: 'Pegar a luz', cause: 'manual', armed: false, effects: [fx({ action: 'show', targets: ['luz', '@quem'] })] }),
    ] };
    window.sent = [];
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_GRID_GET_TYPE: () => ({ type: 'SQUARE' }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
      OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); setTimeout(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }), 5); return {}; },
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) it[k] = JSON.parse(JSON.stringify(v)); } return {}; },
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: [] }), OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }),
      OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data]); return {}; },
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/background.html?obrref=${ref}`);
  await p.waitForTimeout(1200);
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const menus = () => p.evaluate(() => { const m = {}; for (const l of window.log) if (l.id === 'OBR_CONTEXT_MENU_CREATE' && /^gatilhos\/t\//.test(l.data.id)) m[l.data.id] = { label: l.data.icons[0].label, ids: l.data.icons[0].filter.some.map((s) => s.value), roles: l.data.icons[0].filter.roles }; return m; });
  const m = await menus();
  ok('um menu por gatilho com itens (o sem itens não aparece)', Object.keys(m).sort(), ['gatilhos/t/a', 'gatilhos/t/c']);
  ok('Alarme: aparece no painel (zona) e na luz (alvo); só para o mestre', [m['gatilhos/t/a'].label, m['gatilhos/t/a'].ids, m['gatilhos/t/a'].roles], ['⚡ Alarme do painel', ['painel', 'luz'], ['GM']]);
  ok('gatilho desarmado avisa no nome; "quem ativou" não vira item', [m['gatilhos/t/c'].label, m['gatilhos/t/c'].ids], ['⚡ Pegar a luz (desarmado)', ['luz']]);
  // clicar no menu em cima do Rex: ativa, e o Rex conta como quem ativou
  await p.evaluate(() => window.emit('OBR_CONTEXT_MENU_EVENT_CLICK', { id: 'gatilhos/t/a', context: { items: JSON.parse(JSON.stringify([window.items[0]])) } }));
  await p.waitForTimeout(700);
  ok('ativado pelo menu: aviso com o nome do personagem e a luz some', [await p.evaluate(() => window.sent.filter((s) => s[0] === 'gatilhos/aviso').map((s) => s[1].text)), await p.evaluate(() => window.items.find((i) => i.id === 'luz').visible)], [['Alarme! Rex'], false]);
  // renomear/apagar gatilho atualiza o menu
  await p.evaluate(() => { window.meta['gatilhos/lista'] = window.meta['gatilhos/lista'].filter((t) => t.id !== 'c'); window.meta['gatilhos/lista'][0].name = 'Alarme novo'; window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }); });
  await p.waitForTimeout(600);
  ok('menu removido e renomeado', await p.evaluate(() => [window.log.filter((l) => l.id === 'OBR_CONTEXT_MENU_REMOVE').map((l) => l.data.id), window.log.filter((l) => l.id === 'OBR_CONTEXT_MENU_CREATE' && l.data.id === 'gatilhos/t/a').map((l) => l.data.icons[0].label).pop()]), [['gatilhos/t/c'], '⚡ Alarme novo']);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
