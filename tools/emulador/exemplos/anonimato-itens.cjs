// Exemplo: Anonimato 1.0 — rosto anônimo no mesmo item (luz anexada continua), rótulo do mestre e trava para jogadores.
// Uso: tools/emulador/run.sh anonimato &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/anonimato-itens.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const img = (id, name, x, md = {}, extra = {}) => ({ id, name, type: 'IMAGE', layer: 'CHARACTER', visible: true, locked: false, createdUserId: 'gmU', lastModifiedUserId: 'gmU', position: { x, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100, url: 'https://x/' + id + '.png' }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, text: { plainText: name, richText: [], style: {} }, metadata: md, ...extra });
    window.items = [
      img('k', 'Kassandra', 0, { 'anonimato/dados': { on: true, modo: 'imagem', nome: 'Encapuzada', trava: true }, 'outra/ext': 7 }),
      { ...img('luz', 'Luz', 0, { 'luz/dado': 1 }), attachedTo: 'k', layer: 'ATTACHMENT', text: undefined },
      img('livre', 'Livre', 400, { 'anonimato/dados': { on: true, trava: false } }),
      img('comum', 'Comum', 800),
    ];
    window.meta = {}; window.sent = []; window.local = [];
    const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) delete it[k]; else it[k] = JSON.parse(JSON.stringify(v)); } } };
    window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
    window.updates = [];
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [{ connectionId: 'gm1', role: 'GM', id: 'gmU' }, { connectionId: 'p1', role: 'PLAYER', id: 'ana' }] }),
      OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 100 }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_ITEMS_GET_ITEM_BOUNDS: (d) => { const it = window.items.find((i) => d.ids.includes(i.id)); const x = it.position.x - 50, y = it.position.y - 50; return { bounds: { min: { x, y }, max: { x: x + 100, y: y + 100 }, center: { x: x + 50, y: y + 50 }, width: 100, height: 100 } }; },
      OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { window.updates.push(d.updates.map((u) => u.id)); apply(d); setTimeout(window.change, 5); return {}; },
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }),
      OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); return {}; },
      OBR_SCENE_LOCAL_DELETE_ITEMS: (d) => { window.local = window.local.filter((i) => !d.ids.includes(i.id)); return {}; },
      OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }),
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/anonimato/background.html?obrref=${ref}`); await p.waitForTimeout(1200);
  const get = (id) => p.evaluate((id) => { const i = window.items.find((x) => x.id === id); return { name: i.name, text: i.text?.plainText, url: i.image?.url, pos: i.position, rot: i.rotation, md: i.metadata }; }, id);
  const wait = (ms) => p.waitForTimeout(ms);
  const edit = (id, fn) => p.evaluate(([id, src]) => { const i = window.items.find((x) => x.id === id); eval(src)(i); window.change(); }, [id, `(${fn.toString()})`]);

  let k = await get('k');
  ok('o item virou anônimo no próprio lugar (nome, texto e imagem genéricos)', [k.name, k.text, /anonimo\.png$/.test(k.url)], ['Encapuzada', 'Encapuzada', true]);
  ok('o resto do item e os metadados de outras extensões continuam', [k.pos, k.md['outra/ext']], [{ x: 0, y: 0 }, 7]);
  ok('guardou o rosto verdadeiro', k.md['anonimato/dados'].real, { name: 'Kassandra', text: 'Kassandra', url: 'https://x/k.png' });
  const luz = await get('luz');
  ok('a luz anexada ficou intacta', [luz.name, luz.md['luz/dado'], await p.evaluate(() => window.items.find((i) => i.id === 'luz').attachedTo)], ['Luz', 1, 'k']);
  ok('"comum" não foi tocado', (await get('comum')).name, 'Comum');
  ok('"livre" (sem trava) também ficou anônimo', (await get('livre')).name, '???');
  ok('rótulo só do mestre (local) com o nome verdadeiro', await p.evaluate(() => window.local.filter((l) => l.metadata['anonimato/dados/rotulo']).map((l) => [l.text?.plainText ?? l.text?.richText, l.attachedTo, l.disableHit])), [['🕶 Kassandra', 'k', true], ['🕶 Livre', 'livre', true]]);

  // jogador arrasta o item anônimo travado: volta para o lugar
  await edit('k', (i) => { i.position = { x: 300, y: 300 }; i.lastModifiedUserId = 'ana'; }); await wait(500);
  ok('trava: a mexida do jogador foi desfeita', (await get('k')).pos, { x: 0, y: 0 });
  // jogador troca o nome / liga a revelação à força: volta
  await edit('k', (i) => { i.name = 'Kassandra'; i.metadata['anonimato/dados'].on = false; i.lastModifiedUserId = 'ana'; }); await wait(500);
  k = await get('k');
  ok('trava: nome e anonimato voltam', [k.name, k.md['anonimato/dados'].on], ['Encapuzada', true]);
  // o mestre arrasta: vale (e vira a nova posição que a trava protege)
  await edit('k', (i) => { i.position = { x: 100, y: 0 }; i.lastModifiedUserId = 'gmU'; }); await wait(400);
  ok('o mestre move o item anônimo normalmente', (await get('k')).pos, { x: 100, y: 0 });
  await edit('k', (i) => { i.position = { x: 500, y: 500 }; i.lastModifiedUserId = 'ana'; }); await wait(500);
  ok('trava protege a nova posição do mestre', (await get('k')).pos, { x: 100, y: 0 });
  // sem trava: o jogador pode mexer, mas o rosto anônimo continua
  await edit('livre', (i) => { i.position = { x: 450, y: 50 }; i.lastModifiedUserId = 'ana'; }); await wait(400);
  ok('sem trava: o jogador mexe na posição', (await get('livre')).pos, { x: 450, y: 50 });
  await edit('livre', (i) => { i.name = 'Livre'; i.lastModifiedUserId = 'ana'; }); await wait(500);
  ok('sem trava: o rosto anônimo é reposto mesmo assim', (await get('livre')).name, '???');

  // mudar nome falso e voltar a só-nome
  await edit('k', (i) => { i.metadata['anonimato/dados'].nome = 'Vulto'; i.metadata['anonimato/dados'].modo = 'nome'; i.lastModifiedUserId = 'gmU'; }); await wait(500);
  k = await get('k');
  ok('nome falso trocado e imagem verdadeira de volta (modo só nome)', [k.name, k.text, k.url], ['Vulto', 'Vulto', 'https://x/k.png']);
  // revelar
  await edit('k', (i) => { i.metadata['anonimato/dados'].on = false; i.lastModifiedUserId = 'gmU'; }); await wait(500);
  k = await get('k');
  ok('revelar: tudo de volta e sem cópia do rosto', [k.name, k.text, k.url, k.md['anonimato/dados'].real], ['Kassandra', 'Kassandra', 'https://x/k.png', undefined]);
  ok('revelar: o rótulo do mestre some', await p.evaluate(() => window.local.filter((l) => l.metadata['anonimato/dados/rotulo'] === 'k').length), 0);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
