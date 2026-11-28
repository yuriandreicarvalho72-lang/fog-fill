// Exemplo: Gatilhos 1.26 — Prefab: guardar os gatilhos nos itens e recriá-los quando uma cópia (ids novos) aparece.
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-prefab.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const mk = (id, x) => ({ id, name: id, type: 'IMAGE', layer: 'PROP', visible: true, locked: false, createdUserId: 'gmU', position: { x, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100 }, grid: { dpi: 150, offset: { x: 50, y: 50 } }, metadata: {} });
    window.items = [mk('porta', 0), mk('linha', 50), mk('lampada', 900)];
    window.meta = { 'gatilhos/lista': [{ id: 'g1', name: 'Porta', armed: false, once: false, delay: 0, zones: ['porta'], cause: 'interact', radius: 2, who: 'chars', tokens: [], reach: 1, canUse: 'all', conds: [], effects: [{ id: 'e1', action: 'animDoor', targets: ['linha'], doorImgs: ['porta'], delay: 0 }, { id: 'e2', action: 'show', targets: ['lampada'], delay: 0 }] }] };
    window.notes = [];
    const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) delete it[k]; else it[k] = JSON.parse(JSON.stringify(v)); } } };
    window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_GRID_GET_TYPE: () => ({ type: 'SQUARE' }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
      OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); return {}; },
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { apply(d); setTimeout(window.change, 5); return {}; },
      OBR_SCENE_ITEMS_ADD_ITEMS: () => ({}), OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: [] }),
      OBR_NOTIFICATION_SHOW: (d) => { window.notes.push(d.message || JSON.stringify(d)); return { id: 'n' }; },
      OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }), OBR_BROADCAST_SEND_MESSAGE: () => ({}),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/background.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const clique = (id, ids) => p.evaluate(([id, ids]) => window.emit('OBR_CONTEXT_MENU_EVENT_CLICK', { id, context: { items: ids.map((i) => window.items.find((x) => x.id === i)) } }), [id, ids]);
  const lista = () => p.evaluate(() => window.meta['gatilhos/lista'] || []);

  await clique('gatilhos/prefab-guardar', ['porta', 'linha']); await p.waitForTimeout(500);
  ok('pacote guardado nos dois itens', await p.evaluate(() => window.items.map((i) => [i.id, !!i.metadata['gatilhos/pacote'], i.metadata['gatilhos/dono']])), [['porta', true, 'porta'], ['linha', true, 'linha'], ['lampada', false, undefined]]);
  ok('guardar não cria gatilhos novos', (await lista()).length, 1);

  // o Prefabs insere cópias: ids novos, metadados iguais (dono continua sendo o id do original)
  await p.evaluate(() => {
    for (const [novo, velho] of [['porta2', 'porta'], ['linha2', 'linha']]) { const o = JSON.parse(JSON.stringify(window.items.find((i) => i.id === velho))); o.id = novo; o.position.x += 1000; window.items.push(o); }
    window.change();
  });
  await p.waitForTimeout(800);
  let l = await lista();
  ok('a cópia ganhou o gatilho (ids novos)', [l.length, l[1]?.id !== 'g1', l[1]?.armed], [2, true, true]);
  ok('o gatilho novo aponta para a cópia; item de fora continua', [l[1]?.zones, l[1]?.effects[0]?.targets, l[1]?.effects[0]?.doorImgs, l[1]?.effects[1]?.targets], [['porta2'], ['linha2'], ['porta2'], ['lampada']]);
  ok('o original não mudou', [l[0].zones, l[0].effects[0].targets], [['porta'], ['linha']]);
  ok('a cópia virou dona (não repete)', await p.evaluate(() => window.items.filter((i) => i.id.endsWith('2')).map((i) => i.metadata['gatilhos/dono'])), ['porta2', 'linha2']);
  await p.evaluate(() => window.change()); await p.waitForTimeout(600);
  ok('mudança seguinte não duplica', (await lista()).length, 2);

  // uma segunda inserção
  await p.evaluate(() => {
    for (const [novo, velho] of [['porta3', 'porta'], ['linha3', 'linha']]) { const o = JSON.parse(JSON.stringify(window.items.find((i) => i.id === velho))); o.id = novo; o.position.x += 2000; window.items.push(o); }
    window.change();
  });
  await p.waitForTimeout(800); l = await lista();
  ok('segunda cópia: terceiro gatilho', [l.length, l[2]?.zones, l[2]?.effects[0]?.targets], [3, ['porta3'], ['linha3']]);

  // cópia só da imagem: o gatilho precisa da linha, então é pulado e o mestre é avisado
  await p.evaluate(() => { window.notes = []; const o = JSON.parse(JSON.stringify(window.items.find((i) => i.id === 'porta'))); o.id = 'sozinha'; window.items.push(o); window.change(); });
  await p.waitForTimeout(800);
  ok('cópia só da imagem não cria gatilho quebrado', [(await lista()).length, (await p.evaluate(() => window.notes)).some((n) => /ficou de fora/.test(n))], [3, true]);

  // esquecer o pacote
  await clique('gatilhos/prefab-esquecer', ['porta']); await p.waitForTimeout(400);
  ok('esquecer remove o pacote do item', await p.evaluate(() => [!!window.items.find((i) => i.id === 'porta').metadata['gatilhos/pacote'], !!window.items.find((i) => i.id === 'linha').metadata['gatilhos/pacote']]), [false, true]);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
