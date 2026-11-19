import { pathCells, formatDistance, areaShape, affectedCells, snapRelative } from '../src/geom.js';
const d = 150, P = (x, y) => ({ x: x * d + 75, y: y * d + 75 });
const eq = (name, got, exp) => console.log((Math.abs(got - exp) < 1e-9 ? 'ok  ' : 'ERRO') + ` ${name}: ${got} (esperado ${exp})`);
// 5-10-5: três diagonais num trecho = 1+2+1 = 4 quadrados
eq('alternada, 3 diagonais', pathCells([P(0, 0), P(3, 3)], d, 'ALTERNATING'), 4);
// em dois trechos (2 + 1 diagonais) a contagem continua: ainda 4, não 3+1
eq('alternada, em 2 trechos', pathCells([P(0, 0), P(2, 2), P(3, 3)], d, 'ALTERNATING'), 4);
eq('chebyshev', pathCells([P(0, 0), P(3, 3), P(5, 3)], d, 'CHEBYSHEV'), 5);
eq('manhattan', pathCells([P(0, 0), P(3, 3)], d, 'MANHATTAN'), 6);
console.log('texto:', formatDistance(4, { parsed: { multiplier: 5, unit: 'ft', digits: 0 } }), '|', formatDistance(3, { parsed: { multiplier: 1.5, unit: 'm', digits: 1 } }));
// esfera de 20 ft (raio 4) a partir de uma interseção: 4x4x4 = 52 quadrados pela regra do centro
const c = areaShape('circle', { x: 1500, y: 1500 }, { x: 1500 + 4 * d, y: 1500 }, d);
console.log('círculo raio', c.size, 'quadrados atingidos', affectedCells(c.poly, d).length);
const cone = areaShape('cone', { x: 1500, y: 1500 }, { x: 1500 + 3 * d, y: 1500 }, d);
console.log('cone 15 ft, quadrados', affectedCells(cone.poly, d).length);
const sq = areaShape('square', P(10, 10), P(12, 11), d);
console.log('quadrado centrado raio', sq.size, 'quadrados', affectedCells(sq.poly, d).length, '(esperado 25)');
const cube = areaShape('cube', { x: 1500, y: 1500 }, { x: 1500 - 3 * d, y: 1500 + 2 * d }, d);
console.log('cubo lado', cube.size, 'quadrados', affectedCells(cube.poly, d).length, '(esperado 9)');
const line = areaShape('line', { x: 1500, y: 1575 }, { x: 1500 + 6 * d, y: 1575 }, d);
console.log('linha', line.size, 'quadrados', affectedCells(line.poly, d).length, '(esperado 6)');
console.log('token 2x2 encaixe:', JSON.stringify(snapRelative({ x: 640, y: 410 }, { x: 300, y: 300 }, d)));
import { pathCost } from '../src/geom.js';
const none = () => false;
const P2 = (x, y) => ({ x: x * 150 + 75, y: y * 150 + 75 });
console.log('custo sem terreno (alternada 3 diag) =', pathCost([P2(0,0), P2(3,3)], 150, 'ALTERNATING', none).total, '(esperado 4)');
// terreno difícil nas colunas 2..3
const diff = (c) => c >= 2 && c <= 3;
const r = pathCost([P2(0,0), P2(5,0)], 150, 'CHEBYSHEV', diff);
console.log('reta de 5 com 2 quadrados difíceis =', r.total, 'extra', r.extra, '(esperado 7, extra 2)');
