// Exemplo: Gatilhos 1.14 — condições ("Só se"), alerta com nível e cancelar sequência pendente, no motor do mestre.
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-condicao-alerta.cjs
const { chromium } = require('playwright');
const S = 'com.battle-system.smoke/';
async function gmPage(b) {
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const img = (id, layer, x, y, name, owner) => ({ id, name, type: 'IMAGE', layer, visible: true, locked: false, createdUserId: owner, lastModifiedUserId: owner, position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: {} });
    const curve = (id, pts, md) => ({ id, name: 'Linha', type: 'CURVE', layer: 'POINTER', visible: false, locked: false, createdUserId: 'gmU', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, points: pts, style: { closed: false }, text: { plainText: '' }, metadata: md });
    window.items = [curve('porta', [{ x: 600, y: 300 }, { x: 600, y: 450 }], { ['com.battle-system.smoke/isVisionLine']: true, ['com.battle-system.smoke/isDoor']: true, ['com.battle-system.smoke/blocking']: true }),
      img('rex', 'CHARACTER', 525, 375, 'Rex', 'u1'), { ...img('cofre', 'PROP', 525, 225, 'Cofre', 'gmU') }];
    const fx = (o) => ({ id: Math.random().toString(36).slice(2, 7), delay: 0, targets: [], audience: 'all', ...o });
    const tr = (o) => ({ armed: true, once: false, delay: 0, zones: [], radius: 2, who: 'chars', tokens: [], reach: 1, canUse: 'all', glow: true, reqItem: '', reqUses: 0, reqNodes: [], conds: [], condAny: false, condMsg: '', alertTo: '', alertDir: 'any', effects: [], ...o });
    const alerta = (op, n) => ({ type: 'alert', id: 'c' + Math.random(), op, n, ids: [], zones: [], is: '', group: '', name: '', hid: false });
    window.meta = { 'gatilhos/lista': [
      tr({ id: 'alta', name: 'Porta: alerta alto', cause: 'interact', zones: ['porta'], conds: [alerta('>=', 2)], effects: [fx({ action: 'door', doorOp: 'alternar', targets: ['porta'] })] }),
      tr({ id: 'baixa', name: 'Porta: alerta baixo', cause: 'interact', zones: ['porta'], conds: [alerta('<=', 1)], effects: [fx({ action: 'notify', text: 'Porta normal (alerta {nivel})' })] }),
      tr({ id: 'cofre', name: 'Cofre', cause: 'interact', zones: ['cofre'], conds: [alerta('>=', 3)], condMsg: 'Trancado pelo alarme.', effects: [fx({ action: 'notify', text: 'Cofre aberto' })] }),
      tr({ id: 'nivel2', name: 'Nível 2', cause: 'alertLevel', alertTo: '2', alertDir: 'up', effects: [fx({ action: 'notify', text: 'Sirene! Nível {nivel}' })] }),
      tr({ id: 'sobe', name: 'Subir alerta', cause: 'manual', effects: [fx({ action: 'alarm', alarmOp: 'up' })] }),
      tr({ id: 'refor', name: 'Reforços', cause: 'manual', effects: [fx({ action: 'notify', text: 'Chegam reforços', delay: 2 })] }),
      tr({ id: 'hack', name: 'Hackeou', cause: 'manual', effects: [fx({ action: 'cancel', trigger: '' })] }),
      tr({ id: 'uma', name: 'Uma vez com condição', cause: 'manual', once: true, conds: [alerta('>=', 1)], effects: [fx({ action: 'notify', text: 'Disparou uma vez' })] }),
    ] };
    window.sent = []; window.warns = []; window.notes = [];
    const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) delete it[k]; else it[k] = JSON.parse(JSON.stringify(v)); } } };
    window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [{ connectionId: 'p1', role: 'PLAYER', id: 'u1' }] }),
      OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_GRID_GET_TYPE: () => ({ type: 'SQUARE' }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
      OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); setTimeout(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }), 5); return {}; },
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { apply(d); setTimeout(window.change, 5); return {}; },
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: [] }), OBR_SCENE_LOCAL_ADD_ITEMS: () => ({}), OBR_SCENE_LOCAL_DELETE_ITEMS: () => ({}), OBR_SCENE_LOCAL_UPDATE_ITEMS: () => ({}),
      OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }),
      OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data]); return {}; },
      OBR_NOTIFICATION_SHOW: (d) => { (d.variant === 'WARNING' ? window.warns : window.notes).push(d.message); return { id: 'n' }; },
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/background.html?obrref=${ref}`);
  await p.waitForTimeout(900);
  await p.evaluate(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }));
  await p.evaluate(() => window.change());
  await p.waitForTimeout(400);
  return { p, errs };
}
(async () => {
  const b = await chromium.launch();
  const { p: gm, errs } = await gmPage(b);
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const msgs = (ch, from = 0) => gm.evaluate(([c, f]) => window.sent.slice(f).filter((s) => s[0] === c).map((s) => s[1].text), [ch, from]);
  const mark = () => gm.evaluate(() => window.sent.length);
  const level = () => gm.evaluate(() => (window.meta['gatilhos/alerta'] || {}).level || 0);
  const doorOpen = () => gm.evaluate(() => Object.keys(window.items.find((i) => i.id === 'porta').metadata).some((k) => /doorOpen/.test(k)));
  const interact = (id) => gm.evaluate((id) => window.emit('OBR_BROADCAST_MESSAGE_gatilhos/interagir', { data: { itemId: id }, connectionId: 'p1' }), id);
  const fire = (id, force) => gm.evaluate(([id, f]) => window.emit('OBR_BROADCAST_MESSAGE_gatilhos/disparar', { data: { id, force: f }, connectionId: 'gm1' }), [id, !!force]);
  const wait = (ms) => gm.waitForTimeout(ms);

  // alerta 0: só vale a porta "normal"; a de alerta alto não abre
  let m = await mark(); await interact('porta'); await wait(500);
  ok('alerta 0: porta normal avisa, não abre', [await msgs('gatilhos/aviso', m), await doorOpen()], [['Porta normal (alerta 0)'], false]);
  // cofre (alerta >= 3): o jogador vê a mensagem da condição
  m = await mark(); await interact('cofre'); await wait(500);
  ok('cofre com condição falha: mensagem para o jogador', (await gm.evaluate((f) => window.sent.slice(f).filter((s) => s[0] === 'gatilhos/negado').map((s) => [s[1].to, s[1].text]), m)), [['u1', 'Trancado pelo alarme.']]);
  // sobe o alerta 0 → 1 → 2: no nível 2 dispara o gatilho de nível e a porta passa a abrir
  m = await mark(); await fire('sobe'); await wait(500); await fire('sobe'); await wait(700);
  ok('alerta subiu para 2', await level(), 2);
  ok('gatilho "nível 2" avisou com {nivel}', (await msgs('gatilhos/aviso', m)).filter((t) => /Sirene/.test(t)), ['Sirene! Nível 2']);
  m = await mark(); await interact('porta'); await wait(600);
  ok('alerta 2: a porta de alerta alto abre; a normal não avisa', [await doorOpen(), (await msgs('gatilhos/aviso', m)).filter((t) => /normal/.test(t))], [true, []]);
  // subir de 2 para 3 não repete o "nível 2" (só vale para 2 subindo)
  m = await mark(); await fire('sobe'); await wait(600);
  ok('nível 3 não dispara o gatilho do nível 2', [await level(), (await msgs('gatilhos/aviso', m)).filter((t) => /Sirene/.test(t))], [3, []]);
  m = await mark(); await interact('cofre'); await wait(500);
  ok('alerta 3: o cofre abre', await msgs('gatilhos/aviso', m), ['Cofre aberto']);
  // "uma vez" com condição: falha sem gastar, depois dispara e desarma
  await gm.evaluate(() => { window.meta['gatilhos/alerta'] = { level: 0 }; window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }); });
  await wait(300); m = await mark(); await fire('uma'); await wait(500);
  const armed = () => gm.evaluate(() => window.meta['gatilhos/lista'].find((t) => t.id === 'uma').armed);
  ok('condição falha: não dispara e continua armado', [await msgs('gatilhos/aviso', m), await armed()], [[], true]);
  await gm.evaluate(() => { window.meta['gatilhos/alerta'] = { level: 1 }; window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }); });
  await wait(300); m = await mark(); await fire('uma'); await wait(600);
  ok('condição vale: dispara e desarma', [await msgs('gatilhos/aviso', m), await armed()], [['Disparou uma vez'], false]);
  // ⚡ com force ignora a condição
  await gm.evaluate(() => { window.meta['gatilhos/lista'].find((t) => t.id === 'uma').armed = true; window.meta['gatilhos/alerta'] = { level: 0 }; window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }); });
  await wait(300); m = await mark(); await fire('uma', true); await wait(600);
  ok('⚡ (force) ignora a condição', await msgs('gatilhos/aviso', m), ['Disparou uma vez']);
  // sequência com atraso: sem cancelar chega; cancelando não chega
  m = await mark(); await fire('refor'); await wait(2600);
  ok('reforços chegam depois de 2 s', await msgs('gatilhos/aviso', m), ['Chegam reforços']);
  m = await mark(); await fire('refor'); await wait(700); await fire('hack'); await wait(2600);
  ok('cancelar sequência: os reforços não chegam', await msgs('gatilhos/aviso', m), []);
  console.log('erros de página:', JSON.stringify(errs));
  await b.close();
})();
