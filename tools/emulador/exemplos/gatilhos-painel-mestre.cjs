// Exemplo: painel do MESTRE dos Gatilhos 1.14 (barra de alerta, editor "Só se", causa de nível, efeito de alerta/cancelar).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 1600 } });
  const errs = []; p.on('pageerror', (e) => { errs.push('PAGEERR ' + e.message); console.log('PAGEERR', e.message); });
  await p.goto('http://localhost:8001/index.html');
  await p.evaluate(() => {
    document.getElementById('f').style.cssText = 'width:380px;height:1580px;background:#22262e';
    const im = (id, name) => ({ id, name, type: 'IMAGE', layer: 'PROP', visible: true, position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, metadata: {} });
    window.items = [im('porta', 'Porta'), im('sala', 'Sala')];
    window.meta = { 'gatilhos/lista': [
      { id: 't1', name: 'Alarme', armed: true, once: false, delay: 0, zones: ['porta'], cause: 'interact', reach: 1, canUse: 'all', glow: true, who: 'chars', tokens: [], reqItem: '', reqNodes: [], conds: [], effects: [{ id: 'e1', action: 'notify', text: 'oi', audience: 'all', targets: [], delay: 0 }] },
      { id: 't2', name: 'Nível 2', armed: true, once: false, delay: 0, zones: [], cause: 'alertLevel', alertTo: '2', alertDir: 'up', conds: [], effects: [{ id: 'e2', action: 'alarm', alarmOp: 'up', alarmTo: '', targets: [], delay: 0 }, { id: 'e3', action: 'cancel', trigger: '', targets: [], delay: 0 }] },
      { id: 't3', name: 'Porta animada', armed: true, once: false, delay: 0, zones: ['porta'], cause: 'interact', reach: 1, canUse: 'all', glow: true, who: 'chars', tokens: [], reqItem: '', reqNodes: [], conds: [], effects: [{ id: 'e4', action: 'animDoor', targets: [], doorImgs: ['porta'], doorOp: 'alternar', vfxOpen: '', vfxClose: '', vfxWait: 0, delay: 0 }] },
    ] };
    Object.assign(window.responders, {
      OBR_THEME_GET_THEME: () => ({ theme: { mode: 'DARK', text: { primary: '#fff', secondary: '#aaa' }, primary: { main: '#bb99ff' } } }),
      OBR_PLAYER_GET_ROLE: () => ({ role: 'GM' }), OBR_PLAYER_GET_ID: () => ({ id: 'gmU' }), OBR_SCENE_GRID_GET_DPI: () => ({ dpi: 150 }), OBR_SCENE_IS_READY: () => ({ ready: true }),
      OBR_SCENE_GET_METADATA: () => ({ metadata: window.meta }), OBR_SCENE_ITEMS_GET_ALL_ITEMS: () => ({ items: window.items }),
      OBR_PLAYER_GET_SELECTION: () => ({ selection: ['sala'] }),
      OBR_SCENE_SET_METADATA: (d) => { Object.assign(window.meta, d.update); return {}; },
    });
  });
  const ref = Buffer.from('http://localhost:8001 room').toString('base64');
  await p.evaluate((u) => window.load(u), `http://localhost:8002/gatilhos/index.html?obrref=${ref}`);
  await p.waitForTimeout(1500);
  const fr = p.frames()[1];
  fr.page().on('console', (m) => { if (m.type() === 'error') console.log('FRAME-ERR', m.text()); });
  p.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
  const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
  const lvl = () => p.evaluate(() => (window.meta['gatilhos/alerta'] || {}).level);
  ok('barra de alerta: 4 botões (0 a 3)', await fr.locator('[data-alert]').count(), 4);
  await fr.click('[data-alert="2"]'); await p.waitForTimeout(300);
  ok('clicar 2 grava o nível na cena', await lvl(), 2);
  // gatilho 1: adicionar condição, trocar para "quantos tokens", escolher zona pela seleção
  await fr.click('.card:nth-child(1) .name'); await p.waitForTimeout(300);
  ok('seção "Só se" aparece', /só se \(opcional\)/i.test(await fr.innerText('.card .body')), true);
  await fr.click('[data-add-cond]'); await p.waitForTimeout(300);
  const conds = () => p.evaluate(() => window.meta['gatilhos/lista'][0].conds);
  ok('+ condição cria "nível de alerta >= 1"', (await conds()).map((c) => [c.type, c.op, c.n]), [['alert', '>=', 1]]);
  await fr.selectOption('[data-ck="type"]', 'count'); await p.waitForTimeout(300);
  ok('trocar para contagem', (await conds()).map((c) => [c.type, c.op, c.n]), [['count', '>=', 3]]);
  await fr.click('.cond [data-sel]'); await p.waitForTimeout(300);
  ok('usar seleção guarda a zona da contagem', (await conds())[0].zones, ['sala']);
  await fr.click('[data-add-cond]'); await p.waitForTimeout(300);
  ok('segunda condição mostra "todas precisam valer"', (await fr.innerText('.card .body')).includes('todas precisam valer'), true);
  ok('interagir mostra a mensagem da condição', (await fr.locator('[data-k="condMsg"]').count()), 1);
  await fr.selectOption('[data-k="condAny"]', '1'); await p.waitForTimeout(600);
  ok('"basta uma valer" grava condAny', await p.evaluate(() => window.meta['gatilhos/lista'][0].condAny), true);
  await fr.click('.cond [data-del-cond]'); await p.waitForTimeout(300);
  ok('remover condição', (await conds()).length, 1);
  // gatilho 2: causa de nível e efeitos novos
  await fr.click('.card:nth-child(2) .name'); await p.waitForTimeout(300);
  const t2 = await fr.innerText('.card:nth-child(2) .body');
  ok('causa "nível de alerta": opções de direção e nível', [t2.includes('Quando o nível'), t2.includes('só ao subir'), t2.includes('Alerta: mudar o nível'), t2.includes('Cancelar sequência')], [true, true, true, true]);
  ok('efeito de alerta mostra "subir 1 nível" até 3', t2.includes('subir 1 nível') && t2.includes('3 (máximo)'), true);
  ok('cancelar sequência lista "todas as sequências pendentes"', t2.includes('todas as sequências pendentes'), true);
  await fr.click('.card:nth-child(3) .name'); await p.waitForTimeout(300);
  const t3 = await fr.innerText('.card:nth-child(3) .body');
  ok('porta animada: campos de vídeo, tempo e imagem do Trocador', [t3.includes('Linha(s) da porta'), t3.includes('Imagem da porta (Trocador)'), await fr.locator('[data-ek="vfxOpen"]').count(), await fr.locator('[data-ek="vfxWait"]').count(), t3.includes('ainda não tem artes no Trocador')], [true, true, 1, 1, true]);
  await fr.fill('[data-ek="vfxOpen"]', 'https://x.io/abre.webm'); await fr.fill('[data-ek="vfxWait"]', '2'); await fr.press('[data-ek="vfxWait"]', 'Tab'); await p.waitForTimeout(600);
  ok('guarda o link e o tempo no efeito', await p.evaluate(() => { const e = window.meta['gatilhos/lista'][2].effects[0]; return [e.vfxOpen, e.vfxWait]; }), ['https://x.io/abre.webm', 2]);
  console.log('erros:', JSON.stringify(errs));
  await b.close();
})();
