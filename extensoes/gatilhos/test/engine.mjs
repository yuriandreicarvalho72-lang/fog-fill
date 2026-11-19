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
