// Exemplo: Vigilância 1.3 — etiquetas de RA (rótulo só para quem tem commlink/cyberdeck, com alcance e "só para").
// Uso: tools/emulador/run.sh vigilancia &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/vigilancia-etiquetas-ra.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const errs = [];
  async function open(role, id, conn, itemsFn) {
    const p = await b.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8001/index.html');
    await p.evaluate(([role, id, conn, src]) => {
      window.items = eval(src)(); window.meta = {}; window.sent = []; window.local = [];
      const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) delete it[k]; else it[k] = JSON.parse(JSON.stringify(v)); } } };
      window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
      Object.assign(window.responders, {
        OBR_PLAYER_GET_ROLE: () => ({ role }), OBR_PLAYER_GET_ID: () => ({ id }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: conn }),
        OBR_PARTY_GET_PLAYERS: () => ({ players: [{ connectionId: 'gm1', role: 'GM', id: 'gmU' }, { connectionId: 'p1', role: 'PLAYER', id: 'ana' }] }),
        OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 100 }),
        OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
        OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); return {}; },
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
  const scene = (deckX) => () => {
    const img = (id, name, x, y, md = {}, extra = {}) => ({ id, name, type: 'IMAGE', layer: 'CHARACTER', visible: true, locked: false, createdUserId: 'gmU', position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100, url: 'real.png' }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, metadata: md, ...extra });
    return [
      // Ana tem um token com commlink em x=DECKX; o painel tem etiqueta com alcance 5 quadrados
      img('ana1', 'Ana', 'DECKX', 0, { 'vigilancia/commlink': true }, { createdUserId: 'ana' }),
      img('painel', 'Painel', 0, 0, { 'vigilancia/etiqueta': { on: true, titulo: 'Painel B-12', linhas: 'Dono: Horizon\nSeg.: 4', cor: '#4fc3ff', alcance: 5, para: [], mesmoOculto: false } }, { layer: 'PROP' }),
      img('livre', 'Servidor', 900, 900, { 'vigilancia/etiqueta': { on: true, titulo: 'Servidor {estado}', linhas: '', alcance: 0 }, 'vigilancia/no': { name: 'Servidor', type: 'painel', state: 'hackeado' } }, { layer: 'PROP' }),
      img('oculto', 'Escuta', 0, 600, { 'vigilancia/etiqueta': { on: true, titulo: 'Escuta RA', linhas: '', alcance: 0, mesmoOculto: true } }, { layer: 'PROP', visible: false }),
      img('semoculto', 'Fantasma', 0, 800, { 'vigilancia/etiqueta': { on: true, titulo: 'Fantasma', linhas: '', alcance: 0, mesmoOculto: false } }, { layer: 'PROP', visible: false }),
      img('soana', 'Cofre', 300, 900, { 'vigilancia/etiqueta': { on: true, titulo: 'Cofre', linhas: '', alcance: 0, para: ['bob'] } }, { layer: 'PROP' }),
    ].map((i) => JSON.parse(JSON.stringify(i).replace('"DECKX"', String(DECKX_PLACEHOLDER))));
  };
  const labels = (p) => p.evaluate(() => window.local.filter((i) => i.id.includes('-etiq-')).map((i) => [i.id.replace('vigilancia-etiq-', ''), i.text.plainText]).sort());
  global.DECKX_PLACEHOLDER = 0;
  // o placeholder é lido dentro da página: injeta como número
  const mk = (x) => scene(x).toString().replace('DECKX_PLACEHOLDER', String(x));

  const gm = await open('GM', 'gmU', 'gm1', eval('(' + mk(200) + ')'));
  const gl = await labels(gm);
  ok('mestre vê todas as etiquetas (inclusive item escondido)', gl.map((x) => x[0]), ['livre', 'oculto', 'painel', 'semoculto', 'soana']);
  ok('{estado} vira o estado do nó (hackeado)', gl.find((x) => x[0] === 'livre')[1], 'Servidor hackeado');
  ok('várias linhas no texto', gl.find((x) => x[0] === 'painel')[1], 'Painel B-12\nDono: Horizon\nSeg.: 4');

  const perto = await open('PLAYER', 'ana', 'p1', eval('(' + mk(200) + ')'));
  const lp = (await labels(perto)).map((x) => x[0]);
  ok('Ana com commlink perto (2 quadrados): vê painel, servidor e a escuta oculta; não vê o fantasma nem o cofre (só Bob)', lp, ['livre', 'oculto', 'painel']);

  const longe = await open('PLAYER', 'ana', 'p1', eval('(' + mk(900) + ')'));
  ok('Ana longe (9 quadrados): o painel de alcance 5 some', (await labels(longe)).map((x) => x[0]), ['livre', 'oculto']);

  const semdeck = await open('PLAYER', 'bob', 'p2', eval('(' + mk(200) + ')'));
  ok('Bob sem commlink: nenhuma etiqueta (não tem RA)', (await labels(semdeck)).length, 0);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
