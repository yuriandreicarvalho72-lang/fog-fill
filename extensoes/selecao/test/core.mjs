import { candidatesAt, cyclePick, inBox, toggleIds, boxOf, area } from "../src/core.js";
let fails = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) fails++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const bb = (x1, y1, x2, y2) => ({ min: { x: x1, y: y1 }, max: { x: x2, y: y2 } });
const E = [
  { id: "mapa", layer: "MAP", bounds: bb(-1000, -1000, 5000, 5000) },
  { id: "fog", layer: "FOG", bounds: bb(-1000, -1000, 5000, 5000) },
  { id: "porta", layer: "PROP", bounds: bb(100, 100, 200, 120) },
  { id: "rex", layer: "CHARACTER", bounds: bb(90, 80, 190, 180) },
  { id: "longe", layer: "PROP", bounds: bb(900, 900, 1000, 1000) },
];
ok("pilha no ponto: menor primeiro, fog antes do mapa (mesma área)", candidatesAt(E, { x: 150, y: 110 }).map((e) => e.id), ["porta", "rex", "fog", "mapa"]);
ok("fora de tudo menos fog e mapa", candidatesAt(E, { x: 3000, y: 3000 }).map((e) => e.id), ["fog", "mapa"]);
const L = candidatesAt(E, { x: 150, y: 110 });
let r = cyclePick(L, { x: 150, y: 110 }, null);
ok("1º clique pega o mais específico", [r.pick.id, r.i, r.n], ["porta", 0, 4]);
r = cyclePick(L, { x: 152, y: 111 }, r.state);
ok("2º clique no mesmo ponto: o próximo", r.pick.id, "rex");
r = cyclePick(L, { x: 150, y: 110 }, r.state); r = cyclePick(L, { x: 150, y: 110 }, r.state);
ok("chega ao mapa no 4º clique", r.pick.id, "mapa");
r = cyclePick(L, { x: 150, y: 110 }, r.state);
ok("volta ao primeiro", r.pick.id, "porta");
ok("outro ponto reinicia a pilha", cyclePick(candidatesAt(E, { x: 3000, y: 3000 }), { x: 3000, y: 3000 }, r.state).pick.id, "fog");
ok("sem nada: vazio", cyclePick([], { x: 0, y: 0 }, null), { pick: null, state: null, n: 0, i: 0 });
const box = boxOf({ x: 80, y: 70 }, { x: 250, y: 200 });
ok("caixa: só os que cabem inteiros", inBox(E, box), ["porta", "rex"]);
ok("caixa com Alt: tudo que encosta (inclui fog e mapa)", inBox(E, box, true), ["mapa", "fog", "porta", "rex"]);
ok("shift/ctrl alterna", toggleIds(["a", "b"], ["b", "c"]), ["a", "c"]);
ok("área", area(bb(0, 0, 10, 5)), 50);
if (fails) { console.log(fails + " falha(s)"); process.exit(1); }
