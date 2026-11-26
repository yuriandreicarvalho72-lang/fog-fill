// Exemplo: Vigilância 1.2 — ruído (com chave geral), ronda de guardas e verdade por jogador.
// Uso: tools/emulador/run.sh vigilancia &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/vigilancia-ruido-ronda-verdade.cjs
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
      window.meta = {}; window.sent = []; window.local = [];
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
      img('atirador', 'Atirador', 0, 900), img('surdo', 'Surdo', 1500, 500, { 'vigilancia/camera': { angle: 90, range: 4 } }),
      img('espelho', 'Espelho', 700, 700, { 'vigilancia/verdade': { on: true, versoes: [{ para: ['ana'], imagem: 'falso.png', texto: 'Aliado' }, { para: '*', esconder: true }] } }, { visible: false }),
    ];
  };
  const gm = await open('GM', 'gmU', 'gm1', scene);
  const sent = (p, ch) => p.evaluate((c) => window.sent.filter((s) => s[0] === c).map((s) => s[1]), ch);
  const pos = (p, id) => p.evaluate((id) => window.items.find((i) => i.id === id).position, id);
  const rot = (p) => p.evaluate(() => window.items.find((i) => i.id === 'g').rotation);

  // ronda: anda em direção ao ponto 2 (2 quadrados/s = 200 px/s), olhando para ele
  await gm.waitForTimeout(1200);
  const a = await pos(gm, 'g');
  ok('o guarda anda pela rota (para a direita)', [a.x > 100, Math.round(a.y)], [true, 0]);
  ok('e olha para onde anda', Math.round(await rot(gm)), 0);
  // tiro a 9 quadrados (900 px): o guarda ouve (alcance 15), o "surdo" (sem "ouve") não
  await gm.evaluate(() => { window.sent = []; window.emit('OBR_BROADCAST_MESSAGE_arsenal/disparo', { data: { spec: { from: { x: 0, y: 900 } }, shooter: 'atirador', shooterName: 'Atirador' }, connectionId: 'p1' }); });
  await gm.waitForTimeout(300);
  const ouv = await sent(gm, 'vigilancia/ouviu');
  ok('só quem tem "ouve" ouviu o tiro', ouv.map((d) => [d.camera, d.origem]), [['g', 'o disparo de Atirador']]);
  await gm.waitForTimeout(2500);
  const b1 = await pos(gm, 'g');
  ok('o guarda foi investigar (desceu em direção ao tiro)', b1.y > 100, true);
  // corpo a corpo faz menos barulho (4 quadrados): nenhum ouve de longe
  await gm.evaluate(() => { window.sent = []; window.emit('OBR_BROADCAST_MESSAGE_arsenal/disparo', { data: { spec: { from: { x: 0, y: 900 }, melee: { x: 1 } }, shooter: 'atirador' }, connectionId: 'p1' }); });
  await gm.waitForTimeout(300);
  ok('corpo a corpo longe: ninguém ouve', (await sent(gm, 'vigilancia/ouviu')).length, 0);
  // chave geral desligada: ninguém ouve nada
  await gm.evaluate(() => { window.meta['vigilancia/ruido'] = { on: false }; window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }); window.sent = []; });
  await gm.waitForTimeout(200);
  await gm.evaluate(() => window.emit('OBR_BROADCAST_MESSAGE_vigilancia/ruido', { data: { x: 0, y: 100, raio: 20, origem: 'teste' }, connectionId: 'p1' }));
  await gm.waitForTimeout(300);
  ok('ruído desligado: nada é ouvido', (await sent(gm, 'vigilancia/ouviu')).length, 0);
  await gm.evaluate(() => { window.meta['vigilancia/ruido'] = { on: true }; window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }); window.sent = []; });
  await gm.waitForTimeout(200);
  await gm.evaluate(() => window.emit('OBR_BROADCAST_MESSAGE_vigilancia/ruido', { data: { x: 0, y: 100, raio: 20, origem: 'teste' }, connectionId: 'p1' }));
  await gm.waitForTimeout(300);
  ok('ligado de novo: ouve o barulho manual', (await sent(gm, 'vigilancia/ouviu')).map((d) => d.camera), ['g']);
  // o mestre vê o original da verdade; a rota e os números da ronda aparecem só para ele
  const gl = await gm.evaluate(() => window.local.map((i) => i.id));
  ok('mestre: rota desenhada, nenhuma cópia da verdade', [gl.some((i) => i.includes('rota-g')), gl.some((i) => i.includes('-ver-'))], [true, false]);

  // jogador: vê a versão dele
  const pl = await open('PLAYER', 'ana', 'p1', scene);
  const ana = await pl.evaluate(() => window.local.filter((i) => i.id.includes('-ver-')).map((i) => [i.image.url, i.text?.plainText, i.visible, i.locked]));
  ok('Ana vê a versão dela (imagem e texto trocados)', ana, [['falso.png', 'Aliado', true, true]]);
  const pl2 = await open('PLAYER', 'bob', 'p2', scene);
  ok('Bob cai em "todos os outros" (esconder): não vê nada', (await pl2.evaluate(() => window.local.filter((i) => i.id.includes('-ver-')).length)), 0);
  ok('jogador não vê a rota', (await pl.evaluate(() => window.local.filter((i) => i.id.includes('rota')).length)), 0);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
