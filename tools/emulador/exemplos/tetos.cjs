// Exemplo: Tetos 1.0 — a cópia local do teto some quando o personagem do jogador entra e volta quando sai.
// Uso: tools/emulador/run.sh tetos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/tetos.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  async function sessao(role, me) {
    const p = await b.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8001/index.html');
    await p.evaluate(([role, me]) => {
      const img = (id, name, layer, x, y, owner, md = {}, visible = true) => ({ id, name, type: 'IMAGE', layer, visible, locked: false, createdUserId: owner, zIndex: 5, position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 300, height: 300, url: 'teto.png' }, grid: { dpi: 150, offset: { x: 150, y: 150 } }, metadata: md });
      window.items = [
        img('teto', 'Teto da casa', 'PROP', 450, 450, 'gmU', { 'tetos/teto': { modo: 'meu', aberto: false, antes: true } }, false), // 300..600
        img('rex', 'Rex', 'CHARACTER', 100, 100, 'u1'), img('kai', 'Kai', 'CHARACTER', 100, 800, 'u2'), img('npc', 'Guarda', 'CHARACTER', 800, 800, 'gmU'),
      ];
      window.local = []; window.calls = [];
      const apply = (d) => { for (const u of d.updates || []) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) it[k] = JSON.parse(JSON.stringify(v)); } };
      window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
      Object.assign(window.responders, {
        OBR_PLAYER_GET_ROLE: () => ({ role }), OBR_PLAYER_GET_ID: () => ({ id: me }),
        OBR_PARTY_GET_PLAYERS: () => ({ players: [{ id: 'gmU', role: 'GM' }, { id: 'u1', role: 'PLAYER' }, { id: 'u2', role: 'PLAYER' }].filter((x) => x.id !== me) }),
        OBR_SCENE_IS_READY: () => ({ ready: true }),
        OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
        OBR_SCENE_ITEMS_GET_ITEM_BOUNDS: (d) => { const i = window.items.find((x) => x.id === d.ids[0]); const h = (i.image.width * i.scale.x) / 2; return { bounds: { min: { x: i.position.x - h, y: i.position.y - h }, max: { x: i.position.x + h, y: i.position.y + h }, width: 2 * h, height: 2 * h, center: i.position } }; },
        OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }), OBR_SCENE_LOCAL_GET_ITEMS: (d) => ({ items: window.local.filter((i) => d.ids.includes(i.id)) }),
        OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); window.calls.push(['add', d.items.map((i) => i.id)]); return {}; },
        OBR_SCENE_LOCAL_DELETE_ITEMS: (d) => { window.local = window.local.filter((i) => !d.ids.includes(i.id)); window.calls.push(['del', d.ids]); return {}; },
        OBR_SCENE_LOCAL_UPDATE_ITEMS: (d) => { for (const u of d.updates || []) { const it = window.local.find((i) => i.id === u.id); if (it) Object.assign(it, u); } window.calls.push(['upd', (d.updates || []).map((u) => [u.id, u.visible])]); return {}; },
        OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { apply(d); setTimeout(window.change, 5); return {}; },
      });
    }, [role, me]);
    const ref = Buffer.from('http://localhost:8001 room').toString('base64');
    await p.evaluate((u) => window.load(u), `http://localhost:8002/tetos/background.html?obrref=${ref}`);
    await p.waitForTimeout(800);
    return p;
  }
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const mover = async (p, id, x, y) => { await p.evaluate(([id, x, y]) => { const i = window.items.find((q) => q.id === id); i.position = { x, y }; window.change(); }, [id, x, y]); await p.waitForTimeout(300); };
  const copia = (p) => p.evaluate(() => { const c = window.local.find((i) => i.id === 'tetos-teto'); return c ? { vis: c.visible, layer: c.layer, hit: c.disableHit, url: c.image.url } : null; });

  const rex = await sessao('PLAYER', 'u1'), kai = await sessao('PLAYER', 'u2'), gm = await sessao('GM', 'gmU');
  ok('Rex fora: teto aparece na camada ATTACHMENT, sem clique', await copia(rex), { vis: true, layer: 'ATTACHMENT', hit: true, url: 'teto.png' });
  await mover(rex, 'rex', 450, 450); // Rex entra
  for (const p of [rex, kai, gm]) await p.evaluate(() => { window.items.find((i) => i.id === 'rex').position = { x: 450, y: 450 }; window.change(); });
  await rex.waitForTimeout(300);
  ok('Rex dentro: o teto some para ele', (await copia(rex)).vis, false);
  ok('Kai (fora): o teto continua', (await copia(kai)).vis, true);
  ok('Mestre: o teto some com jogador dentro', (await copia(gm)).vis, false);
  // NPC do mestre dentro não revela para o Kai
  for (const p of [rex, kai, gm]) await p.evaluate(() => { const i = window.items.find((q) => q.id === 'rex'); i.position = { x: 100, y: 100 }; window.items.find((q) => q.id === 'npc').position = { x: 450, y: 450 }; window.change(); });
  await rex.waitForTimeout(300);
  ok('Rex saiu: o teto volta', (await copia(rex)).vis, true);
  ok('NPC do mestre dentro não revela ao mestre', (await copia(gm)).vis, true);
  // modo "todos": Rex entra e o Kai também vê o teto sumir
  for (const p of [rex, kai, gm]) await p.evaluate(() => { window.items.find((i) => i.id === 'teto').metadata['tetos/teto'].modo = 'todos'; window.items.find((i) => i.id === 'rex').position = { x: 450, y: 450 }; window.change(); });
  await kai.waitForTimeout(300);
  ok('Modo "todos": Kai vê sumir', (await copia(kai)).vis, false);
  // mestre abre à força, com todos fora
  for (const p of [rex, kai, gm]) await p.evaluate(() => { window.items.find((i) => i.id === 'rex').position = { x: 100, y: 100 }; window.items.find((i) => i.id === 'teto').metadata['tetos/teto'] = { modo: 'manual', aberto: true, antes: true }; window.change(); });
  await kai.waitForTimeout(300);
  ok('Aberto pelo mestre: some para todos', [(await copia(kai)).vis, (await copia(rex)).vis], [false, false]);
  // teto movido ou desmarcado
  for (const p of [rex, kai, gm]) await p.evaluate(() => { const t = window.items.find((i) => i.id === 'teto'); t.position = { x: 900, y: 450 }; t.metadata['tetos/teto'].aberto = false; window.change(); });
  await kai.waitForTimeout(300);
  ok('Teto movido: a cópia acompanha', await kai.evaluate(() => window.local.find((i) => i.id === 'tetos-teto').position), { x: 900, y: 450 });
  for (const p of [rex, kai, gm]) await p.evaluate(() => { delete window.items.find((i) => i.id === 'teto').metadata['tetos/teto']; window.change(); });
  await kai.waitForTimeout(300);
  ok('Teto desmarcado: a cópia some', await copia(kai), null);
  ok('sem erros de página', errs, []);
  await b.close();
})();
