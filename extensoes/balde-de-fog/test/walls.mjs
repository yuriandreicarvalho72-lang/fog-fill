import { itemPolylines, fillFromWalls, polygonArea } from '../src/walls.js';
const dpi = 150;
const curve = (pts, extra = {}) => ({ type: 'CURVE', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, points: pts, style: { closed: false }, ...extra });
const line = (a, b) => ({ type: 'LINE', position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, startPosition: a, endPosition: b });
const P = (items) => items.flatMap((i) => itemPolylines(i, dpi * 0.3));
const show = (name, r) => console.log(name, r.error ? 'ERRO ' + r.error : `${r.method}: ${r.loops.length} laço(s), áreas ${r.loops.map((l) => Math.round(polygonArea(l))).join(', ')}`);

// 1) rocha fechada (último ponto = primeiro) com posição/escala
const rock = curve([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }, { x: 0, y: 0 }], { position: { x: 1000, y: 500 }, scale: { x: 2, y: 2 } });
show('rocha fechada, clique dentro', fillFromWalls({ x: 1400, y: 800 }, P([rock]), dpi));
show('rocha fechada, clique fora  ', fillFromWalls({ x: 100, y: 100 }, P([rock]), dpi));

// 2) sala feita de 4 linhas soltas + ilha fechada dentro
const room = [line({ x: 0, y: 0 }, { x: 900, y: 0 }), line({ x: 900, y: 0 }, { x: 900, y: 600 }), line({ x: 900, y: 600 }, { x: 0, y: 600 }), line({ x: 0, y: 600 }, { x: 0, y: 0 })];
const island = curve([{ x: 300, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 400 }, { x: 300, y: 400 }], { style: { closed: true } });
show('sala de linhas + ilha       ', fillFromWalls({ x: 100, y: 100 }, P([...room, island]), dpi));
show('dentro da ilha              ', fillFromWalls({ x: 400, y: 300 }, P([...room, island]), dpi));

// 3) sala com um vão
const gap = [line({ x: 0, y: 0 }, { x: 900, y: 0 }), line({ x: 900, y: 0 }, { x: 900, y: 600 }), line({ x: 900, y: 600 }, { x: 500, y: 600 }), line({ x: 0, y: 600 }, { x: 0, y: 0 })];
show('sala com vão                ', fillFromWalls({ x: 100, y: 100 }, P(gap), dpi));
