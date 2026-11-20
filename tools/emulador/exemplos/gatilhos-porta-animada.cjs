// Exemplo: Gatilhos 1.17 — porta animada (vídeo + troca de imagem + abre a linha da porta), alternando abrir/fechar.
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-porta-animada.cjs
const { chromium } = require('playwright');
const S = 'com.battle-system.smoke/';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    const S = 'com.battle-system.smoke/';
    const img = (id, name, layer, x, y, owner, md = {}) => ({ id, name, type: 'IMAGE', layer, visible: true, locked: false, createdUserId: owner, position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: md });
    const linha = (id, md) => ({ id, name: 'Linha', type: 'CURVE', layer: 'POINTER', visible: false, locked: false, createdUserId: 'gmU', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, points: [{ x: 600, y: 300 }, { x: 600, y: 450 }], style: { closed: false }, text: { plainText: '' }, metadata: md });
    window.items = [linha('linha', { [S + 'isVisionLine']: true, [S + 'isDoor']: true, [S + 'blocking']: true }), linha('trancada', { [S + 'isVisionLine']: true, [S + 'isDoor']: true, [S + 'isDoorLocked']: true }),
      img('porta', 'Porta', 'PROP', 600, 375, 'gmU', { 'trocador/imagens': [{ id: 'a', name: 'Fechada', url: 'f.png' }, { id: 'b', name: 'Aberta', url: 'a.png' }] }), img('porta2', 'Porta 2', 'PROP', 900, 375, 'gmU'), img('rex', 'Rex', 'CHARACTER', 525, 375, 'u1')];
    const fx = (o) => ({ id: Math.random().toString(36).slice(2, 7), delay: 0, targets: [], audience: 'all', ...o });
    const tr = (o) => ({ armed: true, once: false, delay: 0, zones: [], radius: 2, who: 'chars', tokens: [], conds: [], reach: 1, canUse: 'all', glow: true, reqItem: '', reqNodes: [], effects: [], ...o });
    const porta = (o) => fx({ action: 'animDoor', targets: ['linha'], doorImgs: ['porta'], doorOp: 'alternar', vfxOpen: 'https://x.io/abre.webm', vfxClose: 'https://x.io/fecha.webm', vfxWait: 1, imgOpen: 'Aberta', imgClosed: 'Fechada', fxTipo: 'area', fxSize: 2, ...o });
    window.meta = { 'gatilhos/lista': [
      tr({ id: 'p', name: 'Porta animada', cause: 'manual', effects: [porta()] }),
      tr({ id: 'ab', name: 'Só abrir', cause: 'manual', effects: [porta({ doorOp: 'abrir' })] }),
      tr({ id: 'tr', name: 'Trancada', cause: 'manual', effects: [porta({ targets: ['trancada'], doorImgs: [] })] }),
      tr({ id: 'img', name: 'Só imagem', cause: 'manual', effects: [porta({ targets: [], doorImgs: ['porta2'], vfxOpen: '', vfxWait: 0 })] }),
      tr({ id: 'rex', name: 'Interagir', cause: 'interact', zones: ['porta'], effects: [porta()] }),
    ] };
    window.sent = [];
    const apply = (d) => { for (const u of d.updates) { const it = window.items.find((i) => i.id === u.id); for (const [k, v] of Object.entries(u)) { if (v === undefined) delete it[k]; else it[k] = JSON.parse(JSON.stringify(v)); } } };
    window.change = () => window.emit('OBR_SCENE_ITEMS_EVENT_CHANGE', { items: JSON.parse(JSON.stringify(window.items)) });
    Object.assign(window.responders, {
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
      OBR_PARTY_GET_PLAYERS: () => ({ players: [{ connectionId: 'p1', role: 'PLAYER', id: 'u1' }] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_GRID_GET_TYPE: () => ({ type: 'SQUARE' }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
      OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); setTimeout(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }), 5); return {}; },
      OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
      OBR_SCENE_ITEMS_UPDATE_ITEMS: (d) => { apply(d); setTimeout(window.change, 5); return {}; },
      OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: [] }), OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }),
      OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data]); return {}; },
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/background.html?obrref=${ref}`); await p.waitForTimeout(1000);
  await p.evaluate(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta })); await p.evaluate(() => window.change()); await p.waitForTimeout(400);
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const fire = (id) => p.evaluate((id) => window.emit('OBR_BROADCAST_MESSAGE_gatilhos/disparar', { data: { id, force: true }, connectionId: 'gm1' }), id);
  const sent = (ch, from) => p.evaluate(([c, f]) => window.sent.slice(f).filter((s) => s[0] === c).map((s) => s[1]), [ch, from]);
  const mark = () => p.evaluate(() => window.sent.length);
  const aberta = (id) => p.evaluate((id) => Object.keys(window.items.find((i) => i.id === id).metadata).some((k) => /doorOpen/.test(k)), id);
  const wait = (ms) => p.waitForTimeout(ms);

  // fechada → abre: o vídeo toca já, a imagem e a linha só mudam depois de 1 s
  let m = await mark(); await fire('p'); await wait(300);
  const fx1 = (await sent('arsenal/efeito', m))[0];
  ok('toca o vídeo de abrir em cima da imagem da porta', fx1 && [fx1.video.url, fx1.targets, fx1.dur, fx1.tamanho], ['https://x.io/abre.webm', ['porta'], 0, 2]);
  ok('antes do fim da animação: a porta ainda está fechada e a imagem não trocou', [await aberta('linha'), (await sent('trocador/trocar', m)).length], [false, 0]);
  await wait(1100);
  ok('depois: troca para a imagem "Aberta" e abre a linha da porta', [(await sent('trocador/trocar', m)).map((d) => [d.targets, d.to]), await aberta('linha')], [[[['porta'], 'Aberta']], true]);
  // aberta → fecha com o vídeo de fechar e a imagem "Fechada"
  m = await mark(); await fire('p'); await wait(1500);
  ok('alterna: fecha com o outro vídeo, a imagem "Fechada" e fecha a linha', [(await sent('arsenal/efeito', m)).map((d) => d.video.url), (await sent('trocador/trocar', m)).map((d) => d.to), await aberta('linha')], [['https://x.io/fecha.webm'], ['Fechada'], false]);
  // "só abrir" numa porta aberta não faz nada
  await fire('ab'); await wait(1400); m = await mark(); await fire('ab'); await wait(1400);
  ok('"abrir" com a porta já aberta não repete vídeo nem troca', [(await sent('arsenal/efeito', m)).length, (await sent('trocador/trocar', m)).length], [0, 0]);
  // trancada não abre
  m = await mark(); await fire('tr'); await wait(1400);
  ok('porta trancada: avisa e não toca nada', [(await sent('gatilhos/aviso', m)).map((d) => d.text), (await sent('arsenal/efeito', m)).length, await aberta('trancada')], [['A porta está trancada.'], 0, false]);
  // só imagem, sem linha: estado guardado na própria imagem; sem vídeo, troca na hora
  m = await mark(); await fire('img'); await wait(500);
  ok('só imagem: troca na hora, sem vídeo', [(await sent('trocador/trocar', m)).map((d) => [d.targets, d.to]), (await sent('arsenal/efeito', m)).length], [[[['porta2'], 'Aberta']], 0]);
  m = await mark(); await fire('img'); await wait(500);
  ok('só imagem: segunda vez volta (estado lembrado)', (await sent('trocador/trocar', m)).map((d) => d.to), ['Fechada']);
  // interagir pelo jogador (Rex ao lado da porta)
  m = await mark(); await p.evaluate(() => window.emit('OBR_BROADCAST_MESSAGE_gatilhos/interagir', { data: { itemId: 'porta' }, connectionId: 'p1' })); await wait(1500);
  ok('o jogador usa a porta pela interação (estava aberta: toca o vídeo de fechar e fecha)', [(await sent('arsenal/efeito', m)).map((d) => d.video.url), await aberta('linha')], [['https://x.io/fecha.webm'], false]);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
