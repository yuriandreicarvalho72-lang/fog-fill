import { wallSegs, nearest, SMOKE_VISION, SMOKE_OFF } from "../src/paredes.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const base = { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } };
const wall = { ...base, id: "w", type: "WALL", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
const linha = { ...base, id: "l", type: "LINE", startPosition: { x: 0, y: 50 }, endPosition: { x: 100, y: 50 }, metadata: { [SMOKE_VISION]: true } };
const curva = { ...base, id: "c", type: "CURVE", points: [{ x: 0, y: 80 }, { x: 100, y: 80 }, { x: 100, y: 160 }], style: { closed: false }, metadata: { [SMOKE_VISION]: true } };
const porta = { ...linha, id: "p", metadata: { [SMOKE_VISION]: true, [SMOKE_OFF]: true } }; // porta aberta
const decor = { ...linha, id: "d", metadata: {} };
ok("sem Smoke: só a parede do Dynamic Fog", wallSegs([wall, linha, curva], { smoke: false }).length, 1);
ok("com Smoke: parede + linha + 2 trechos da curva", wallSegs([wall, linha, curva]).length, 4);
ok("porta aberta (disabled) e desenho comum não bloqueiam", wallSegs([porta, decor]).length, 0);
ok("a linha vira trecho em coordenadas do mundo", wallSegs([{ ...linha, position: { x: 10, y: 20 } }])[0], { ax: 10, ay: 70, bx: 110, by: 70 });
ok("curva fechada fecha o contorno", wallSegs([{ ...curva, style: { closed: true } }]).length, 3);
const segs = wallSegs([wall, linha, curva]);
ok("só os trechos ao alcance da luz, os mais próximos primeiro", nearest(segs, [{ x: 50, y: 40, radius: 30 }], 10).map((s) => s.ay), [50]);
ok("respeita o máximo", nearest(segs, [{ x: 50, y: 40, radius: 500 }], 2).length, 2);
if (bad) process.exit(1);
