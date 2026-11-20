import { zoneShape, evaluate } from '../src/engine.js';
const d = 150;
const rect = (id, x, y, w, h) => ({ id, type: 'SHAPE', shapeType: 'RECTANGLE', position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, width: w, height: h });
const zones = new Map([['trap', zoneShape(rect('trap', 300, 0, 150, 150))], ['p1', zoneShape(rect('p1', 0, 600, 150, 150))], ['p2', zoneShape(rect('p2', 600, 600, 150, 150))]]);
const tok = (id, x, y) => ({ id, position: { x, y } });
const ok = (n, v, e) => console.log((v === e ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + v);
// atravessar a armadilha sem parar nela (75 -> 675 na mesma linha)
let r = evaluate({ zones: ['trap'], cause: 'enter' }, [{ token: tok('a', 675, 75), from: { x: 75, y: 75 }, to: { x: 675, y: 75 } }], [], zones, {}, d);
ok('passar por cima dispara', r.fire, true); ok('ponto de entrada x=300', Math.round(r.at.x), 300);
r = evaluate({ zones: ['trap'], cause: 'enter' }, [{ token: tok('a', 75, 375), from: { x: 75, y: 75 }, to: { x: 75, y: 375 } }], [], zones, {}, d);
ok('caminho longe não dispara', r.fire, false);
r = evaluate({ zones: ['trap'], cause: 'leave' }, [{ token: tok('a', 75, 75), from: { x: 375, y: 75 }, to: { x: 75, y: 75 } }], [], zones, {}, d);
ok('sair dispara', r.fire, true);
// duas placas
const st = {};
r = evaluate({ zones: ['p1', 'p2'], cause: 'standAll' }, [{ token: tok('a', 75, 675) }], [tok('a', 75, 675), tok('b', 75, 75)], zones, st, d);
ok('uma placa só não dispara', r.fire, false);
r = evaluate({ zones: ['p1', 'p2'], cause: 'standAll' }, [{ token: tok('b', 675, 675) }], [tok('a', 75, 675), tok('b', 675, 675)], zones, st, d);
ok('as duas placas disparam', r.fire, true);
r = evaluate({ zones: ['p1', 'p2'], cause: 'standAll' }, [{ token: tok('b', 680, 675) }], [tok('a', 75, 675), tok('b', 680, 675)], zones, st, d);
ok('continuar em cima não repete', r.fire, false);
r = evaluate({ zones: ['trap'], cause: 'near', radius: 2 }, [{ token: tok('a', 375, 375), from: { x: 375, y: 900 }, to: { x: 375, y: 375 } }], [], zones, {}, d);
ok('aproximar (2 quadrados) dispara', r.fire, true);
// fio (linha) cruzado
const wire = new Map([['w', zoneShape({ type: 'LINE', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, startPosition: { x: 450, y: 0 }, endPosition: { x: 450, y: 900 } })]]);
r = evaluate({ zones: ['w'], cause: 'enter' }, [{ token: tok('a', 600, 300), from: { x: 300, y: 300 }, to: { x: 600, y: 300 } }], [], wire, {}, d);
ok('fio cruzado dispara', r.fire, true);
// caminho da Régua em L passando pela armadilha (300..450, 0..150) e parada em cima dela
import { haltPoint, routeFromPlan } from '../src/engine.js';
const plan = [{ x: 75, y: 375 }, { x: 375, y: 375 }, { x: 375, y: -225 }, { x: 75, y: -225 }];
r = evaluate({ zones: ['trap'], cause: 'enter' }, [{ token: tok('a', 75, -225), from: plan[0], to: plan[3], route: plan }], [], zones, {}, d);
ok('rota em L dispara', r.fire, true); ok('trecho da entrada = 2', r.seg, 2);
ok('reta sem rota não pegaria', evaluate({ zones: ['trap'], cause: 'enter' }, [{ token: tok('a', 75, -225), from: plan[0], to: plan[3] }], [], zones, {}, d).fire, false);
let hp = haltPoint(r, d, true); ok('para em cima: centro da casa da armadilha', `${hp.x},${hp.y}`, '375,75');
ok('rota a partir do plano (lote)', JSON.stringify(routeFromPlan(plan, plan[0], plan[3])), JSON.stringify(plan));
ok('rota até ponto no meio do trecho', routeFromPlan(plan, plan[1], { x: 375, y: 75 }).length, 2);
ok('movimento fora do plano', routeFromPlan(plan, { x: 1, y: 1 }, plan[3]), null);
r = evaluate({ zones: ['w'], cause: 'enter' }, [{ token: tok('a', 675, 300), from: { x: 375, y: 300 }, to: { x: 675, y: 300 } }], [], wire, {}, d);
hp = haltPoint(r, d, true); ok('fio: para logo depois da linha', `${hp.x},${hp.y}`, '525,300');
// chegar perto passando ao lado (sem parar perto) e ponto onde entrou no raio
import { circleEntry, formation } from '../src/engine.js';
r = evaluate({ zones: ['trap'], cause: 'near', radius: 2.5 }, [{ token: tok('a', 975, 375), from: { x: -225, y: 375 }, to: { x: 975, y: 375 } }], [], zones, {}, d);
ok('passar perto (sem parar) dispara', r.fire, true); ok('entrou no raio em x=150', Math.round(r.at.x), 150);
ok('reta que não passa perto', circleEntry({ x: 0, y: 900 }, { x: 900, y: 900 }, { x: 375, y: 75 }, 300), null);
// formação: dois tokens lado a lado vão juntos, sem sair do grid
const f = formation([{ id: 'a', position: { x: 375, y: 75 } }, { id: 'b', position: { x: 525, y: 75 } }], { x: 1575, y: 975 });
ok('formação: um no destino', JSON.stringify(f.get('a')), '{"x":1575,"y":975}'); ok('formação: o outro ao lado', JSON.stringify(f.get('b')), '{"x":1725,"y":975}');
// placas: quem está em cima
const st2 = {};
r = evaluate({ zones: ['p1', 'p2'], cause: 'standAll' }, [{ token: tok('b', 675, 675) }], [tok('a', 75, 675), tok('b', 675, 675), tok('c', 75, 75)], zones, st2, d);
ok('placas: quem ativou = os que estão em cima', JSON.stringify(r.on), '["a","b"]');
// interagir: alcance até a alavanca (quadrado 300..450, 0..150)
import { pickReacher, distToShape } from '../src/engine.js';
const lev = zones.get('trap');
ok('encostado (lado) alcança 1', pickReacher([tok('a', 225, 75)], lev, 1, d).ok, true);
ok('encostado (diagonal) alcança 1', pickReacher([tok('a', 225, 225)], lev, 1, d).ok, true);
ok('2 quadrados não alcança 1', pickReacher([tok('a', 75, 75)], lev, 1, d).ok, false);
ok('2 quadrados alcança 2', pickReacher([tok('a', 75, 75)], lev, 2, d).ok, true);
ok('3 quadrados não alcança 2', pickReacher([tok('a', -75, 75)], lev, 2, d).ok, false);
ok('sem limite (0)', pickReacher([tok('a', -3000, 75)], lev, 0, d).ok, true);
ok('escolhe o mais perto', pickReacher([tok('longe', 1500, 75), tok('perto', 225, 75)], lev, 1, d).token.id, 'perto');
ok('sem tokens e com alcance', pickReacher([], lev, 1, d).ok, false);
ok('dentro do objeto = 0', distToShape({ x: 375, y: 75 }, lev), 0);

// portas da névoa (Smoke & Spectre e névoa do Owlbear)
import { setDoor, doorIsOpen, isFogDoor, doorIsLocked } from '../src/shared.js';
const S = 'com.battle-system.smoke/';
const door = () => ({ id: 'p', type: 'CURVE', metadata: { [`${S}isVisionLine`]: true, [`${S}isDoor`]: true, [`${S}blocking`]: true } });
const p1 = door();
const t1 = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? 'ok  ' : 'ERRO') + ' ' + n + ': ' + JSON.stringify(v));
t1('linha com isDoor é porta; parede comum não', [isFogDoor(p1), isFogDoor({ metadata: { [`${S}isVisionLine`]: true } })], [true, false]);
t1('abrir: doorOpen + disabled (como o Smoke faz)', [setDoor(p1, 'abrir'), p1.metadata[`${S}doorOpen`], p1.metadata[`${S}disabled`]], [true, true, true]);
t1('alternar fecha e tira as duas marcas', [setDoor(p1, 'alternar'), `${S}doorOpen` in p1.metadata, `${S}disabled` in p1.metadata, p1.metadata[`${S}blocking`]], [false, false, false, true]);
setDoor(p1, 'trancar');
t1('trancar marca isDoorLocked e não abre', [doorIsLocked(p1), doorIsOpen(p1)], [true, false]);
setDoor(p1, 'destrancar');
t1('destrancar', doorIsLocked(p1), false);
const fog = { id: 'f', type: 'SHAPE', metadata: { 'rodeo.owlbear.dynamic-fog/doors': [{ start: { distance: 0 }, end: { distance: 50 } }, { start: { distance: 90 }, end: { distance: 120 }, open: false }] } };
t1('névoa do Owlbear: abre todas as portas do contorno', [isFogDoor(fog), setDoor(fog, 'abrir'), fog.metadata['rodeo.owlbear.dynamic-fog/doors'].map((d) => d.open)], [true, true, [true, true]]);

// restrito: item preso (attachment) ao personagem
import { hasRequired, attachmentsOf, denyText } from '../src/shared.js';
const cena = [{ id: 'rex' }, { id: 'card', name: 'Cartão de Acesso Nível 3', attachedTo: 'rex' }, { id: 'bolsa', name: 'Bolsa', attachedTo: 'lia' }, { id: 'chave', text: { plainText: 'Chave mestra' }, attachedTo: 'bolsa' }, { id: 'lia' }];
t1('preso ao personagem conta (sem acento/maiúscula)', [hasRequired('rex', cena, 'cartao de acesso'), hasRequired('lia', cena, 'cartão de acesso')], [true, false]);
t1('item preso a um item preso também conta', [attachmentsOf('lia', cena).map((i) => i.id), hasRequired('lia', cena, 'chave')], [['bolsa', 'chave'], true]);
t1('sem restrição: qualquer um usa', hasRequired('lia', cena, '  '), true);
t1('mensagem com {item} e {quem}', [denyText({ reqItem: 'Cartão de acesso' }, 'Rex'), denyText({ reqItem: 'Cartão', reqMsg: '{quem} passa o pulso no leitor: nada. Falta o {item}.' }, 'Rex')], ['Acesso negado: é preciso Cartão de acesso.', 'Rex passa o pulso no leitor: nada. Falta o Cartão.']);

// pegar item: onde o item fica preso no token
import { attachPos } from '../src/shared.js';
const tk = { position: { x: 375, y: 375 }, image: { width: 300, height: 300 }, grid: { dpi: 300 }, scale: { x: 1, y: 1 } };
const cd = { position: { x: 900, y: 75 }, image: { width: 100, height: 60 }, grid: { dpi: 200 }, scale: { x: 1, y: 1 } };
t1('pegar: canto de baixo à direita do token', attachPos(cd, tk, 'canto', 150), { x: 375 + 75 - 22.5, y: 375 + 75 - 22.5 });
t1('pegar: centro / onde está', [attachPos(cd, tk, 'centro', 150), attachPos(cd, tk, 'onde', 150)], [{ x: 375, y: 375 }, { x: 900, y: 75 }]);

// 1.13: gasto, nó hackeado, inventário e passar item
import { findRequired, nodeHacked, isInvItem, canGive, heldBy, holderOf, nearby } from '../src/shared.js';
const inv = [{ id: 'rex', layer: 'CHARACTER', type: 'IMAGE', position: { x: 75, y: 75 } }, { id: 'kai', layer: 'CHARACTER', type: 'IMAGE', position: { x: 225, y: 75 } }, { id: 'lia', layer: 'CHARACTER', type: 'IMAGE', position: { x: 825, y: 75 } },
  { id: 'c', type: 'IMAGE', layer: 'ATTACHMENT', name: 'Cartão Nível 2', attachedTo: 'rex', metadata: {} }, { id: 'x', type: 'IMAGE', layer: 'ATTACHMENT', name: 'Selo', attachedTo: 'rex', visible: false, metadata: {} },
  { id: 'lock', type: 'IMAGE', layer: 'ATTACHMENT', name: 'Chip', attachedTo: 'rex', metadata: { 'gatilhos/item': { give: false } } }, { id: 'no', type: 'SHAPE', metadata: { 'vigilancia/no': { state: 'hackeado' } } }, { id: 'no2', type: 'SHAPE', metadata: { 'vigilancia/no': { state: 'ativo' } } }];
t1('acha o item que casa', [findRequired('rex', inv, 'cartao')?.id, findRequired('kai', inv, 'cartao')], ['c', null]);
t1('nó hackeado libera; ativo não; sem nós não', [nodeHacked(inv, ['no']), nodeHacked(inv, ['no2']), nodeHacked(inv, [])], [true, false, false]);
t1('inventário: só itens visíveis presos; fixo não passa', [heldBy('rex', inv).map((i) => i.id), canGive(inv[5]), canGive(inv[3])], [['c', 'lock'], false, true]);
t1('quem carrega o item', [holderOf(inv[3], inv)?.id, holderOf(inv[0], inv)], ['rex', null]);
t1('ao lado passa, longe não', [nearby(inv[0], inv[1], 150), nearby(inv[0], inv[2], 150)], [true, false]);
