// Exemplo: Gatilhos 1.16 — submenu "Gatilhos deste item" no botão direito (lista com armar/desarmar e ativar).
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-menu-botao-direito.cjs
const { chromium } = require('playwright');
const fixture = (sel) => {
  const img = (id, name, layer, x) => ({ id, name, type: 'IMAGE', layer, visible: true, createdUserId: 'gmU', position: { x, y: 300 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: {} });
  window.items = [img('rex', 'Rex', 'CHARACTER', 300), img('painel', 'Painel', 'PROP', 900), img('luz', 'Luz', 'PROP', 1200)];
  const fx = (o) => ({ id: Math.random().toString(36).slice(2, 7), delay: 0, targets: [], audience: 'all', ...o });
  const tr = (o) => ({ armed: true, once: false, delay: 0, zones: [], radius: 2, who: 'chars', tokens: [], conds: [], effects: [], ...o });
  window.meta = { 'gatilhos/lista': [
    tr({ id: 'a', name: 'Alarme do painel', cause: 'interact', zones: ['painel'], effects: [fx({ action: 'notify', text: 'Alarme! {quem}' }), fx({ action: 'hide', targets: ['luz'] })] }),
    tr({ id: 'b', name: 'Sem itens', cause: 'manual', effects: [fx({ action: 'notify', text: 'x' })] }),
    tr({ id: 'c', name: 'Crisálida', cause: 'near', armed: false, effects: [fx({ action: 'show', targets: ['luz', '@quem'] })] }),
  ] };
  window.sent = []; window.notes = []; window.SEL = sel;
  Object.assign(window.responders, {
    OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', text: { primary: '#fff', secondary: '#aaa' }, primary: { main: '#bb99ff' } } }),
    OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
    OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_GRID_GET_TYPE: () => ({ type: 'SQUARE' }),
    OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
    OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); setTimeout(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }), 5); return {}; },
    OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
    OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
    OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: [] }), OBR_PLAYER_GET_SELECTION: () => ({ selection: window.SEL }),
    OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data]); return {}; },
    OBR_NOTIFICATION_SHOW: (d) => { window.notes.push(d.message); return { id: 'n' }; },
  });
};
(async () => {
  const b = await chromium.launch();
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  const errs = [];
  // 1) o motor registra UM submenu com a lista (embed) e o filtro por itens que estão em gatilhos
  const bg = await b.newPage(); bg.on('pageerror', (e) => errs.push(e.message));
  await bg.goto('http://localhost:8001/index.html'); await bg.evaluate(fixture, []);
  await bg.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/background.html?obrref=${ref}`); await bg.waitForTimeout(1200);
  const menus = await bg.evaluate(() => window.log.filter((l) => l.id === 'OBR_CONTEXT_MENU_CREATE' && /^gatilhos\/lista$/.test(l.data.id)).map((l) => ({ label: l.data.icons[0].label, ids: l.data.icons[0].filter.every.map((s) => s.value), coords: l.data.icons[0].filter.every.map((s) => s.coordinator || ''), roles: l.data.icons[0].filter.roles, embed: l.data.embed })));
  ok('um submenu "Gatilhos deste item" só para o mestre', menus.map((m) => [m.label, m.roles]), [['Gatilhos deste item', ['GM']]]);
  ok('aparece nos itens que estão em algum gatilho', menus[0].ids.sort(), ['luz', 'painel']);
  ok('o filtro une os itens com OU (coordinator "||" em todos menos o último), senão nenhum item casaria com 2 ids ao mesmo tempo', menus[0].coords, ['||', '']);
  ok('embed é a lista (menu.html) com altura limitada', [/menu\.html$/.test(menus[0].embed.url), menus[0].embed.height > 60 && menus[0].embed.height <= 340], [true, true]);
  // 2) a lista (página do submenu) com a luz selecionada: 2 gatilhos (um armado, um desarmado)
  const em = await b.newPage({ viewport: { width: 300, height: 400 } }); em.on('pageerror', (e) => errs.push(e.message));
  await em.goto('http://localhost:8001/index.html'); await em.evaluate(fixture, ['luz']);
  await em.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/menu.html?obrref=${ref}`); await em.waitForTimeout(1200);
  const fr = em.frames()[1];
  ok('lista os gatilhos da luz (não o "Sem itens")', await fr.locator('.gm-name').evaluateAll((els) => els.map((e) => e.firstChild.textContent)), ['Alarme do painel', 'Crisálida']);
  ok('armado ● e desarmado ○', await fr.locator('.arm').evaluateAll((els) => els.map((e) => e.textContent)), ['●', '○']);
  await fr.click('[data-arm="c"]'); await em.waitForTimeout(500);
  ok('clicar em ○ rearma o gatilho', await em.evaluate(() => window.meta['gatilhos/lista'].find((t) => t.id === 'c').armed), true);
  await fr.click('[data-arm="a"]'); await em.waitForTimeout(500);
  ok('clicar em ● desarma o gatilho', await em.evaluate(() => window.meta['gatilhos/lista'].find((t) => t.id === 'a').armed), false);
  await fr.click('#all-on'); await em.waitForTimeout(500);
  ok('"Armar todos" arma os dois', await em.evaluate(() => window.meta['gatilhos/lista'].filter((t) => t.id !== 'b').map((t) => t.armed)), [true, true]);
  await fr.click('#all-off'); await em.waitForTimeout(500);
  ok('"Desarmar todos" desarma os dois e não mexe no outro', await em.evaluate(() => window.meta['gatilhos/lista'].map((t) => t.armed)), [false, true, false]);
  // 3) ativar: manda o pedido ao motor com os personagens selecionados como quem ativou
  await em.evaluate(() => { window.SEL = ['rex', 'painel']; });
  await em.evaluate(() => window.emit('OBR_PLAYER_EVENT_CHANGE', { id: 'gmU', role: 'GM', selection: ['rex', 'painel'] })); await em.waitForTimeout(500);
  await fr.click('[data-fire="a"]'); await em.waitForTimeout(300);
  ok('⚡ pede o disparo forçado, com o Rex como quem ativou', await em.evaluate(() => window.sent.filter((s) => s[0] === 'gatilhos/disparar').map((s) => s[1])), [{ id: 'a', force: true, on: ['rex'] }]);
  ok('mostra aviso de ativado', await em.evaluate(() => window.notes), ['Gatilho "Alarme do painel" ativado.']);
  // 4) item fora de gatilhos
  await em.evaluate(() => { window.SEL = ['nada']; window.emit('OBR_PLAYER_EVENT_CHANGE', { id: 'gmU', role: 'GM', selection: ['nada'] }); }); await em.waitForTimeout(500);
  ok('item sem gatilho avisa', (await fr.innerText('#m')).trim(), 'Este item não está em nenhum gatilho.');
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
