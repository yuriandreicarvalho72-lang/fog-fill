import { crossings, hears, shotRaio, ruidoCfg, DEFAULT_RUIDO, routeOf, patrolInit, patrolStep, investigate, hold, versionFor, appearance, verdadeOf, PONTO, RUIDO, VERDADE } from "../src/extra.js";
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const cell = 100;
const wall = (x) => ({ a: { x, y: -1000 }, b: { x, y: 1000 } });
ok("cruza uma parede", crossings({ x: 0, y: 0 }, { x: 500, y: 0 }, [wall(250)]), 1);
ok("não cruza", crossings({ x: 0, y: 0 }, { x: 200, y: 0 }, [wall(250)]), 0);
ok("duas paredes", crossings({ x: 0, y: 0 }, { x: 500, y: 0 }, [wall(100), wall(300)]), 2);
ok("ruído no alcance, sem parede", hears({ x: 0, y: 0 }, { x: 1000, y: 0 }, 15, cell, []).hears, true);
ok("fora do alcance", hears({ x: 0, y: 0 }, { x: 1600, y: 0 }, 15, cell, []).hears, false);
ok("uma parede abafa (15 → 7,5 quadrados)", [hears({ x: 0, y: 0 }, { x: 700, y: 0 }, 15, cell, [wall(300)]).hears, hears({ x: 0, y: 0 }, { x: 800, y: 0 }, 15, cell, [wall(300)]).hears], [true, false]);
ok("fator 1: parede não abafa", hears({ x: 0, y: 0 }, { x: 1400, y: 0 }, 15, cell, [wall(300)], 1).hears, true);
ok("alcance 0 = fonte muda", hears({ x: 0, y: 0 }, { x: 0, y: 0 }, 0, cell, []).hears, false);
ok("config padrão e chave geral", [ruidoCfg({}).on, ruidoCfg({ [RUIDO]: { on: false } }).on, ruidoCfg({ [RUIDO]: { tiro: 20 } }).tiro, ruidoCfg({}).corpo], [true, false, 20, 4]);
ok("disparo / corpo a corpo", [shotRaio({ spec: {} }, DEFAULT_RUIDO), shotRaio({ spec: { melee: { x: 1 } } }, DEFAULT_RUIDO)], [15, 4]);

// ronda
const pts = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }];
const items = [
  { id: "p2", position: { x: 300, y: 0 }, metadata: { [PONTO]: { g: "g", n: 2 } } }, { id: "p1", position: { x: 0, y: 0 }, metadata: { [PONTO]: { g: "g", n: 1 } } },
  { id: "p3", position: { x: 300, y: 300 }, metadata: { [PONTO]: { g: "g", n: 3 } } }, { id: "x", position: { x: 9, y: 9 }, metadata: { [PONTO]: { g: "outro", n: 1 } } },
];
ok("rota em ordem, só deste guarda", routeOf(items, "g").map((p) => p.id), ["p1", "p2", "p3"]);
const cfg = { speed: 1, pausa: 1, modo: "ciclo", girar: true, espera: 2 };
let st = patrolInit({ x: 10, y: 0 }, pts);
ok("começa no ponto mais perto", st.i, 0);
let pos = { x: 0, y: 0 };
let r = patrolStep(st, pos, pts, cfg, 1000, cell);   // chegou ao ponto 0 (já estava), pausa e segue para o 1
ok("chega e pausa 1 s, alvo vira o ponto 1", [r.pos, r.st.wait, r.st.i], [{ x: 0, y: 0 }, 1000, 1]);
r = patrolStep(r.st, r.pos, pts, cfg, 1000, cell);
ok("esperando", [r.pos, r.st.wait], [{ x: 0, y: 0 }, 0]);
r = patrolStep(r.st, r.pos, pts, cfg, 1000, cell);
ok("anda 1 quadrado por segundo na direção do alvo, olhando para ele", [r.pos, r.rotation], [{ x: 100, y: 0 }, 0]);
let q = { pos: { x: 300, y: 250 }, st: { ...r.st, i: 2, wait: 0 } };
q = patrolStep(q.st, q.pos, pts, cfg, 1000, cell);
ok("não passa do alvo", q.pos, { x: 300, y: 300 });
ok("ciclo volta ao primeiro", q.st.i, 0);
const vv = { ...cfg, modo: "vaivem" };
let s2 = { i: 2, dir: 1, wait: 0, hold: 0, inv: null };
let a = patrolStep(s2, { x: 300, y: 300 }, pts, vv, 1000, cell);
ok("vai-e-volta inverte no fim", [a.st.i, a.st.dir], [1, -1]);
ok("girar desligado não gira", patrolStep({ i: 1, dir: 1, wait: 0, hold: 0, inv: null }, { x: 0, y: 0 }, pts, { ...cfg, girar: false }, 1000, cell).rotation, null);
// viu alguém: segura parado
let h = patrolStep(hold(st, 3000), { x: 0, y: 0 }, pts, cfg, 1000, cell);
ok("seguro parado por 3 s", [h.pos, h.st.hold], [{ x: 0, y: 0 }, 2000]);
// investigar
let iv = investigate({ i: 1, dir: 1, wait: 0, hold: 0, inv: null }, { x: 0, y: 200 }, cfg);
let w = patrolStep(iv, { x: 0, y: 0 }, pts, cfg, 1000, cell);
ok("vai para o ruído", w.pos, { x: 0, y: 100 });
w = patrolStep(w.st, w.pos, pts, cfg, 1000, cell);
ok("chega ao ruído", [w.pos, w.st.inv], [{ x: 0, y: 200 }, null]);
w = patrolStep(w.st, w.pos, pts, cfg, 1000, cell);
ok("fica olhando em volta (espera) e depois volta à rota", [w.st.wait, w.pos], [1000, { x: 0, y: 200 }]);

// verdade
const v = { on: true, versoes: [{ para: ["ana"], imagem: "https://x/y.png", texto: "Guarda" }, { para: "*", esconder: true }] };
ok("quem é citado vê a versão dele", versionFor(v, "ana").texto, "Guarda");
ok("os outros caem em 'todos os outros'", versionFor(v, "bob").esconder, true);
ok("sem versão para ele: não vê", versionFor({ versoes: [{ para: ["ana"] }] }, "bob"), null);
const it = { id: "i", type: "IMAGE", image: { url: "orig.png", width: 150, height: 150 }, name: "Real", attachedTo: "z", metadata: { [VERDADE]: v } };
const c = appearance(it, versionFor(v, "ana"));
ok("cópia com a imagem trocada, sem prender a outro item", [c.image.url, c.image.width, c.attachedTo, c.text.plainText], ["https://x/y.png", 150, undefined, "Guarda"]);
ok("escondido para ele", appearance(it, versionFor(v, "bob")), null);
ok("desligado não vale", verdadeOf({ metadata: { [VERDADE]: { on: false, versoes: [] } } }), null);
process.exit(bad ? 1 : 0);
