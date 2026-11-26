// Exemplo: Arsenal 1.10 — cenário como arma (objeto com dossiê que os jogadores usam) e habilidades que machucam o cenário destrutível.
// Uso: tools/emulador/run.sh arsenal &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/arsenal-cenario-como-arma.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const errs = [];
  const DOSSIE = { nome: 'Barril', nd: null, ca: null, pv: null, lendarias: 0, covil: '', habilidades: [
    { nome: 'Explosão do barril', secao: 'acao', uso: 'livre', forma: 'area', alcance: 0, area: 4.5, alvos: 1, dano: '6d6 fogo', resistencia: 'DES 14', metade: true },
    { nome: 'Chute', secao: 'acao', uso: 'livre', forma: 'alvo', alcance: 3, area: 0, alvos: 1, ataque: 5, dano: '1d6' },
  ] };
  const scene = (cen) => () => {
    const img = (id, name, x, y, md = {}, extra = {}) => ({ id, name, type: 'IMAGE', layer: 'PROP', visible: true, locked: false, createdUserId: 'gmU', position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100, url: 'a.png' }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, metadata: md, ...extra });
    return [
      img('barril', 'Barril', 0, 0, { 'arsenal/dossie': 'DOSSIE', 'arsenal/cenario': 'CEN', 'arsenal/destrutivel': { shots: 1, blasts: 1 } }),
      img('caixa', 'Caixa', 200, 0, { 'arsenal/destrutivel': { shots: 3, blasts: 1 } }),
      img('longe', 'Caixa longe', 1500, 0, { 'arsenal/destrutivel': { shots: 3, blasts: 1 } }),
      img('ana1', 'Ana', 100, 100, {}, { layer: 'CHARACTER', createdUserId: 'ana' }),
      img('bob1', 'Bob', 900, 900, {}, { layer: 'CHARACTER', createdUserId: 'bob' }),
    ];
  };
  const mk = (cen) => scene(cen).toString().replace("'DOSSIE'", JSON.stringify(DOSSIE)).replace("'CEN'", JSON.stringify(cen));
  async function open(role, id, conn, cen, page = 'background.html', pm = {}) {
    const p = await b.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8001/index.html');
    await p.evaluate(([role, id, conn, src, pm]) => {
      window.items = eval(src)(); window.meta = {}; window.sent = []; window.local = []; window.pmeta = pm;
      const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) delete it[k]; else it[k] = JSON.parse(JSON.stringify(v)); } } };
      window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
      Object.assign(window.responders, {
        OBR_PLAYER_GET_ROLE: () => ({ role }), OBR_PLAYER_GET_ID: () => ({ id }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: conn }), OBR_PLAYER_GET_NAME: () => ({ name: id }),
        OBR_PARTY_GET_PLAYERS: () => ({ players: [{ connectionId: 'gm1', role: 'GM', id: 'gmU' }, { connectionId: 'p1', role: 'PLAYER', id: 'ana' }] }),
        OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 100 }),
        OBR_SCENE_GRID_GET_SCALE: () => ({ scale: { raw: '1.5m', parsed: { multiplier: 1.5, unit: 'm', digits: 1 } } }),
        OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
        OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); return {}; },
        OBR_PLAYER_GET_METADATA: () => ({ metadata: window.pmeta }),
        OBR_PLAYER_SET_METADATA: (d) => { Object.assign(window.pmeta, d.update); return {}; },
        OBR_ROOM_GET_METADATA: () => ({ metadata: {} }),
        OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', primary: {}, secondary: {}, background: {}, text: {} } }),
        OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
        OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
        OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { apply(d); setTimeout(window.change, 5); return {}; },
        OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: window.local }),
        OBR_SCENE_LOCAL_ADD_ITEMS: (d) => { window.local.push(...d.items); return {}; },
        OBR_SCENE_LOCAL_DELETE_ITEMS: (d) => { window.local = window.local.filter((i) => !d.ids.includes(i.id)); return {}; },
        OBR_SCENE_LOCAL_UPDATE_ITEMS: () => ({}),
        OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }),
        OBR_NOTIFICATION_SHOW: (d) => { (window.notes = window.notes || []).push(d.notification?.message || JSON.stringify(d)); return {}; },
        OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data]); return {}; },
      });
    }, [role, id, conn, `(${mk(cen)})`, pm]);
    const ref = Buffer.from('http://localhost:8001 room').toString('base64');
    await p.evaluate((u) => window.load(u), `http://localhost:8002/arsenal/${page}?obrref=${ref}`);
    await p.waitForTimeout(1200);
    return p;
  }
  const sent = (p, ch) => p.evaluate((c) => window.sent.filter((s) => s[0] === c).map((s) => s[1]), ch);
  const meta = (p, id, k) => p.evaluate(([id, k]) => window.items.find((i) => i.id === id)?.metadata?.[k], [id, k]);
  const vis = (p, id) => p.evaluate((id) => window.items.find((i) => i.id === id)?.visible, id);
  const use = (p, by, nome = 'Explosão do barril', extra = {}) => p.evaluate(([by, nome, extra]) => window.emit('OBR_BROADCAST_MESSAGE_arsenal/cenario-usar', { data: { item: 'barril', nome, targets: [], point: null, by, ...extra }, connectionId: 'p1' }), [by, nome, extra]);

  // 1) liberado para jogadores, alcance 2 quadrados: Ana (a ~1,4 quadrado) usa; barril quebra e machuca a caixa perto
  const gm = await open('GM', 'gmU', 'gm1', { jogadores: true, alcance: 2, aoUsar: 'quebrar' });
  await use(gm, 'ana');
  await gm.waitForTimeout(3000);
  const res = await sent(gm, 'arsenal/cenario-res');
  ok('resultado volta para Ana com os números', [res.length, res[0]?.by, /Explosão do barril/.test(res[0]?.text || ''), /6d6 fogo/.test(res[0]?.text || '')], [1, 'ana', true, true]);
  ok('a animação foi mandada para todos', (await sent(gm, 'arsenal/habilidade')).length, 1);
  ok('a caixa perto (2 quadrados, dentro dos 4,5 m) quebrou com a explosão', (await meta(gm, 'caixa', 'arsenal/destrutivel')).broken, true);
  ok('a caixa longe ficou intacta', !!(await meta(gm, 'longe', 'arsenal/destrutivel')).broken, false);
  ok('o próprio barril quebrou (some)', [(await meta(gm, 'barril', 'arsenal/destrutivel')).broken, await vis(gm, 'barril')], [true, false]);

  // 2) Bob está longe: recusado, nada acontece
  const gm2 = await open('GM', 'gmU', 'gm1', { jogadores: true, alcance: 2, aoUsar: 'nada' });
  await use(gm2, 'bob');
  await gm2.waitForTimeout(800);
  const r2 = await sent(gm2, 'arsenal/cenario-res');
  ok('Bob longe: recusado pelo alcance', [r2[0]?.by, /chegue a até 2/.test(r2[0]?.error || '')], ['bob', true]);
  ok('sem animação nem dano', [(await sent(gm2, 'arsenal/habilidade')).length, !!(await meta(gm2, 'caixa', 'arsenal/destrutivel')).broken], [0, false]);

  // 3) não liberado para jogadores
  const gm3 = await open('GM', 'gmU', 'gm1', { jogadores: false, alcance: 0, aoUsar: 'nada' });
  await use(gm3, 'ana');
  await gm3.waitForTimeout(800);
  ok('objeto não liberado: recusado', /não pode ser usado/.test((await sent(gm3, 'arsenal/cenario-res'))[0]?.error || ''), true);

  // 4) habilidade inexistente
  const gm4 = await open('GM', 'gmU', 'gm1', { jogadores: true, alcance: 0, aoUsar: 'nada' });
  await use(gm4, 'ana', 'Nada disso');
  await gm4.waitForTimeout(800);
  ok('habilidade que o objeto não tem: recusada', /não está no objeto/.test((await sent(gm4, 'arsenal/cenario-res'))[0]?.error || ''), true);

  // 5) alcance 0 = qualquer distância (Bob usa; objeto continua)
  const gm5 = await open('GM', 'gmU', 'gm1', { jogadores: true, alcance: 0, aoUsar: 'sumir' });
  await use(gm5, 'bob');
  await gm5.waitForTimeout(2500);
  ok('alcance 0: Bob usa; "some" esconde o barril', [(await sent(gm5, 'arsenal/habilidade')).length, await vis(gm5, 'barril')], [1, false]);

  // 6) quem não é mestre não executa o pedido
  const pl = await open('PLAYER', 'ana', 'p1', { jogadores: true, alcance: 0, aoUsar: 'nada' });
  await use(pl, 'ana');
  await pl.waitForTimeout(800);
  ok('jogador não executa pedidos (só o líder)', (await sent(pl, 'arsenal/habilidade')).length, 0);

  // 7) janela do jogador: lista as habilidades e pede para usar
  const jan = await open('PLAYER', 'ana', 'p1', { jogadores: true, alcance: 2, aoUsar: 'nada' }, 'cenario.html');
  const fr = jan.frames().find((f) => f.url().includes('cenario.html'));
  const txt = await fr.evaluate(() => document.getElementById('cen').innerText);
  ok('janela do jogador mostra a arma e as habilidades', [/Barril/.test(txt), /Explosão do barril/.test(txt), /Chute/.test(txt)], [true, true, true]);
  await fr.evaluate(() => document.querySelector('[data-go^="barril|Explosão"]').click());
  await jan.waitForTimeout(500);
  const req = await sent(jan, 'arsenal/cenario-usar');
  ok('▶ (usar na hora) manda o pedido ao mestre', [req[0]?.item, req[0]?.nome, req[0]?.by], ['barril', 'Explosão do barril', 'ana']);
  const jan2 = await open('PLAYER', 'bob', 'p2', { jogadores: true, alcance: 2, aoUsar: 'nada' }, 'cenario.html');
  const fr2 = jan2.frames().find((f) => f.url().includes('cenario.html'));
  ok('Bob longe: botões desligados e aviso de alcance', await fr2.evaluate(() => [document.querySelector('[data-go]').disabled, /chegue a até 2/.test(document.getElementById('cen').innerText)]), [true, true]);

  // 8) painel do mestre mostra a seção "Arma de cenário"
  const hab = await open('GM', 'gmU', 'gm1', { jogadores: true, alcance: 2, aoUsar: 'quebrar' }, 'hab.html', { 'arsenal/hab-ativa': { token: 'barril' } });
  const fh = hab.frames().find((f) => f.url().includes('hab.html'));
  const ht = await fh.evaluate(() => document.getElementById('hab').innerText);
  ok('painel do mestre: seção Arma de cenário no barril', [/Arma de cenário/.test(ht), /Jogadores podem usar/.test(ht)], [true, true]);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
