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
