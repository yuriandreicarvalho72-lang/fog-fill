// Exemplo: Vigilância 1.5.2 — o guarda em ronda dispara o gatilho Interagir da porta (em vez de mexer na linha) e dispara de novo para fechar.
// Uso: tools/emulador/run.sh vigilancia &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/vigilancia-ronda-gatilho-porta.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const errs = [];
  async function open(role, id, conn, itemsFn) {
    const p = await b.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8001/index.html');
    await p.evaluate(([role, id, conn, src]) => {
      window.items = eval(src)();
      window.meta = { 'gatilhos/lista': [{ id: 'gp', name: 'Porta', cause: 'interact', armed: true, delay: 0, zones: ['img'], effects: [{ id: 'e', action: 'animDoor', targets: ['porta'], doorImgs: ['img'], doorOp: 'alternar', vfxOpen: 'https://x.io/abre.webm', vfxClose: '', vfxWait: 1.2, delay: 0 }] }] }; window.sent = []; window.local = [];
      const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) delete it[k]; else it[k] = JSON.parse(JSON.stringify(v)); } } };
      window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
      Object.assign(window.responders, {
        OBR_PLAYER_GET_ROLE: () => ({ role }), OBR_PLAYER_GET_ID: () => ({ id }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: conn }),
        OBR_PARTY_GET_PLAYERS: () => ({ players: [{ connectionId: 'gm1', role: 'GM', id: 'gmU' }, { connectionId: 'p1', role: 'PLAYER', id: 'ana' }] }),
        OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 100 }),
        OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
        OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); setTimeout(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }), 5); return {}; },
        OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
        OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
        OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { apply(d); setTimeout(window.change, 5); return {}; },
        OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }),
        OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); return {}; },
        OBR_SCENE_LOCAL_DELETE_ITEMS: (d) => { window.local = window.local.filter((i) => !d.ids.includes(i.id)); return {}; },
        OBR_SCENE_LOCAL_UPDATE_ITEMS: () => ({}),
        OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }),
        OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data]); return {}; },
      });
    }, [role, id, conn, `(${itemsFn.toString()})`]);
    const ref = Buffer.from('http://localhost:8001 room').toString('base64');
    await p.evaluate((u) => window.load(u), `http://localhost:8002/vigilancia/background.html?obrref=${ref}`);
    await p.waitForTimeout(900);
    return p;
  }
  const scene = () => {
    const img = (id, name, x, y, md = {}, extra = {}) => ({ id, name, type: 'IMAGE', layer: 'CHARACTER', visible: true, locked: false, createdUserId: 'gmU', position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100, url: 'real.png' }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, metadata: md, ...extra });
    const ponto = (id, n, x, y) => img(id, `Ronda ${n}`, x, y, { 'vigilancia/ponto': { g: 'g', n } }, { layer: 'PROP', visible: false });
    return [
      img('g', 'Guarda', 0, 0, { 'vigilancia/camera': { angle: 90, range: 6, ouve: true }, 'vigilancia/no': { name: 'Guarda', type: 'camera', state: 'ativo' }, 'vigilancia/ronda': { on: true, speed: 2, pausa: 0, modo: 'ciclo', girar: true, parar: 5, investiga: true, espera: 6 } }),
      ponto('p1', 1, 0, 0), ponto('p2', 2, 400, 0),
      { id: 'porta', name: 'Porta', type: 'LINE', layer: 'DRAWING', visible: false, locked: true, createdUserId: 'gmU', position: { x: 200, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, startPosition: { x: 0, y: -100 }, endPosition: { x: 0, y: 100 }, metadata: { 'com.battle-system.smoke/isVisionLine': true, 'com.battle-system.smoke/isDoor': true } },
      img('atirador', 'Atirador', 0, 900), img('surdo', 'Surdo', 1500, 500, { 'vigilancia/camera': { angle: 90, range: 4 } }),
      img('espelho', 'Espelho', 700, 700, { 'vigilancia/verdade': { on: true, versoes: [{ para: ['ana'], imagem: 'falso.png', texto: 'Aliado' }, { para: '*', esconder: true }] } }, { visible: false }),
    ];
  };
  const gm = await open('GM', 'gmU', 'gm1', scene);
  const fires = () => gm.evaluate(() => window.sent.filter((s) => s[0] === 'gatilhos/disparar').map((s) => s[1]));
  const doorMd = () => gm.evaluate(() => { const m = window.items.find((i) => i.id === 'porta').metadata; return [m['com.battle-system.smoke/doorOpen'] === true, m['com.battle-system.smoke/disabled'] === true]; });
  let f = [];
  for (let i = 0; i < 30 && !f.length; i++) { await gm.waitForTimeout(150); f = await fires(); }
  ok('chegou perto: dispara o gatilho da porta como o guarda (uma vez)', f, [{ id: 'gp', force: true, on: ['g'] }]);
  ok('a linha NÃO foi mexida pela ronda (o gatilho é que abre)', await doorMd(), [false, false]);
  await gm.waitForTimeout(1500);
  ok('não repete enquanto a porta anima', (await fires()).length, 1);
  // o gatilho (simulado) abre a linha; o guarda segue e, longe, dispara de novo para fechar
  await gm.evaluate(() => { const m = window.items.find((i) => i.id === 'porta').metadata; m['com.battle-system.smoke/doorOpen'] = true; m['com.battle-system.smoke/disabled'] = true; window.change(); });
  let g2 = [];
  for (let i = 0; i < 60 && g2.length < 2; i++) { await gm.waitForTimeout(150); g2 = await fires(); }
  ok('depois de passar, dispara o gatilho de novo (fechar)', g2.length, 2);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
