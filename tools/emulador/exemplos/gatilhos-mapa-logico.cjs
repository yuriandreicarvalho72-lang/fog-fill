// Exemplo: Gatilhos 1.20 — mapa lógico (diagrama, problemas, "e se?") e a causa/efeito de ruído (Vigilância).
// Uso: tools/emulador/run.sh gatilhos &  e depois  NODE_PATH=$(npm root -g) node tools/emulador/exemplos/gatilhos-mapa-logico.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  async function page(file) {
    const p = await b.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8001/index.html');
    await p.evaluate(() => {
      const img = (id, name, x, y) => ({ id, name, type: 'IMAGE', layer: 'CHARACTER', visible: true, locked: false, createdUserId: 'gmU', position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: {} });
      window.items = [img('porta', 'Porta', 300, 300), img('guarda', 'Guarda', 900, 300), img('alarme', 'Alarme', 600, 600)];
      const fx = (o) => ({ id: Math.random().toString(36).slice(2, 7), delay: 0, targets: [], audience: 'all', ...o });
      const tr = (o) => ({ armed: true, once: true, delay: 0, zones: [], radius: 2, who: 'chars', tokens: [], conds: [], reach: 1, canUse: 'all', glow: true, reqItem: '', reqNodes: [], effects: [], ...o });
      window.meta = { 'gatilhos/lista': [
        tr({ id: 'a', name: 'Alarme dispara', cause: 'manual', effects: [fx({ action: 'alarm', alarmOp: 'up' }), fx({ action: 'chain', trigger: 'b', delay: 2 }), fx({ action: 'noise', targets: ['alarme'], noiseRaio: 12 })] }),
        tr({ id: 'b', name: 'Fecha a porta', cause: 'manual', effects: [fx({ action: 'hide', targets: ['porta'] }), fx({ action: 'chain', trigger: 'a' })] }),
        tr({ id: 'c', name: 'Reforços', cause: 'alertLevel', alertTo: '1', alertDir: 'up', effects: [fx({ action: 'notify', text: 'Reforços!' }), fx({ action: 'show', targets: [] })] }),
        tr({ id: 'd', name: 'Guarda ouviu', cause: 'heard', zones: ['guarda'], effects: [fx({ action: 'notify', text: 'Ouviram!' })] }),
      ] };
      window.sent = [];
      Object.assign(window.responders, {
        OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', text: {}, primary: {} } }),
        OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_PLAYER_GET_CONNECTION_ID: () => ({ connectionId: 'gm1' }),
        OBR_PARTY_GET_PLAYERS: () => ({ players: [] }), OBR_SCENE_IS_READY: () => ({ ready: true }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_GRID_GET_TYPE: () => ({ type: 'SQUARE' }),
        OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }),
        OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); setTimeout(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }), 5); return {}; },
        OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }), OBR_SCENE_ITEMS_GET_ITEMS: (d) => ({ items: window.items.filter((i) => !d.ids || d.ids.includes(i.id)) }),
        OBR_SCENE_ITEMS_UPDATE_ITEMS: () => ({}), OBR_SCENE_LOCAL_GET_ALL_ITEMS: () => ({ items: [] }), OBR_PLAYER_GET_SELECTION: () => ({ selection: [] }),
        OBR_BROADCAST_SEND_MESSAGE: (d) => { window.sent.push([d.channel, d.data]); return {}; },
      });
    });
    const ref = Buffer.from('http://localhost:8001 room').toString('base64');
    await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/${file}?obrref=${ref}`);
    await p.waitForTimeout(1200);
    return p;
  }
  // mapa lógico
  const m = await page('mapa.html');
  const f = m.frames().find((x) => /mapa\.html/.test(x.url()));
  ok('desenha um nó por gatilho', await f.evaluate(() => document.querySelectorAll('.no').length), 4);
  ok('resumo', await f.evaluate(() => document.getElementById('resumo').textContent), '4 gatilhos · 3 ligações · 0 erros · 1 aviso');
  const probs = await f.evaluate(() => [...document.querySelectorAll('.prob')].map((e) => e.textContent.slice(0, 60)));
  ok('acha o ciclo (A → B → A)', probs.some((t) => /Ciclo/.test(t)), true);
  ok('acha o efeito sem alvo', probs.some((t) => /sem alvo/.test(t)), true);
  await f.evaluate(() => document.querySelector('.no[data-id="a"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await m.waitForTimeout(200);
  await f.evaluate(() => document.getElementById('simular').click());
  await m.waitForTimeout(200);
  const tl = await f.evaluate(() => [...document.querySelectorAll('.tl')].map((e) => e.textContent));
  ok('simulação: alerta 0 → 1 e o "Reforços" dispara', [tl.some((t) => /alerta 0 → 1/.test(t)), tl.some((t) => /Reforços/.test(t))], [true, true]);
  ok('simulação: chain com 2 s e o ruído sem guarda definido', [tl.some((t) => /\+2s.*Fecha a porta/.test(t)), tl.some((t) => /faz barulho \(raio 12\)/.test(t))], [true, true]);
  ok('a simulação não enviou nada ao mapa', await m.evaluate(() => window.sent.length), 0);
  await f.evaluate(() => document.getElementById('real').click()); await m.waitForTimeout(100);
  ok('disparar de verdade pede confirmação (nada enviado no 1º clique)', await m.evaluate(() => window.sent.length), 0);
  await f.evaluate(() => document.getElementById('real').click()); await m.waitForTimeout(200);
  ok('2º clique dispara', await m.evaluate(() => window.sent.filter((s) => s[0] === 'gatilhos/disparar').map((s) => s[1])), [{ id: 'a', force: true }]);
  // motor: efeito "Fazer barulho" e causa "ouve um ruído"
  const g = await page('background.html');
  await g.evaluate(() => window.emit('OBR_SCENE_METADATA_EVENT_CHANGE', { metadata: window.meta }));
  await g.waitForTimeout(500);
  await g.evaluate(() => window.emit('OBR_BROADCAST_MESSAGE_gatilhos/disparar', { data: { id: 'a', force: true }, connectionId: 'gm1' }));
  await g.waitForTimeout(600);
  ok('o efeito faz o barulho no lugar do item', await g.evaluate(() => window.sent.filter((s) => s[0] === 'vigilancia/ruido').map((s) => s[1])), [{ x: 600, y: 600, raio: 12, origem: 'Alarme dispara', quem: 'alarme' }]);
  await g.evaluate(() => { window.sent = []; window.emit('OBR_BROADCAST_MESSAGE_vigilancia/ouviu', { data: { camera: 'guarda', name: 'Guarda', x: 600, y: 600 }, connectionId: 'gm1' }); });
  await g.waitForTimeout(500);
  ok('a causa "ouve um ruído" dispara o gatilho do guarda', await g.evaluate(() => window.sent.filter((s) => s[0] === 'gatilhos/aviso').map((s) => s[1].text)), ['Ouviram!']);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
