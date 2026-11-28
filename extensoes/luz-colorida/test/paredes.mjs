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
// formas além de linha e curva
import { smokeReport } from "../src/paredes.js";
{
  let bad2 = 0;
  const ok2 = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad2++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
  const b = { position: { x: 100, y: 100 }, rotation: 0, scale: { x: 1, y: 1 }, metadata: { [SMOKE_VISION]: true } };
  const caminho = { ...b, id: "pa", type: "PATH", commands: [[0, 0, 0], [1, 50, 0], [1, 50, 50], [5]] };
  ok2("PATH fechado vira 3 trechos (2 retas + fechamento)", wallSegs([caminho]).length, 3);
  const ret = { ...b, id: "r", type: "SHAPE", shapeType: "RECTANGLE", width: 40, height: 20 };
  ok2("retângulo vira 4 trechos", wallSegs([ret]).length, 4);
  ok2("retângulo em coordenadas do mundo", wallSegs([ret])[0], { ax: 100, ay: 100, bx: 140, by: 100 });
  const circ = { ...b, id: "ci", type: "SHAPE", shapeType: "CIRCLE", width: 100, height: 100 };
  ok2("círculo vira trechos", wallSegs([circ]).length > 8, true);
  const rep = smokeReport([caminho, ret, { ...b, id: "x", type: "IMAGE" }, { ...b, id: "d", type: "LINE", startPosition: { x: 0, y: 0 }, endPosition: { x: 5, y: 5 }, metadata: { [SMOKE_VISION]: true, [SMOKE_OFF]: true } }]);
  ok2("relatório conta tipos, desativados e não lidos", [rep.total, rep.ativos, rep.desativados, rep.porTipo, rep.naoLidos], [4, 3, 1, { PATH: 1, "SHAPE/RECTANGLE": 1, IMAGE: 1, LINE: 1 }, { IMAGE: 1 }]);
  if (bad2) process.exit(1);
}
