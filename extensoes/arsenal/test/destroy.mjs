import { DESTR, DEFAULT_DESTR, destrOf, addDamage, damageText, resistText, itemDistance, centerOf, damageEvents, affects, caughtBy, remaining, seesCountdown, canControl, chargeOf, buildDebris, buildBlast, CHARGE, shapeHitsItem, habEvents } from "../src/destroy.js";
const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v));
const dpi = 100;
const box = (id, x, y, md = {}) => ({ id, type: "IMAGE", layer: "PROP", position: { x, y }, rotation: 0, scale: { x: 1, y: 1 }, image: { width: 100, height: 100 }, grid: { dpi: 100, offset: { x: 50, y: 50 } }, metadata: md });
const wall = { id: "w", type: "WALL", position: { x: 500, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, points: [{ x: 0, y: -100 }, { x: 0, y: 100 }] };

// resistência e dano
const d0 = { ...DEFAULT_DESTR };
ok("padrão: 3 tiros pesados ou 1 explosão", resistText(d0), "3 tiros pesados ou 1 explosão");
let r = addDamage(d0, "shot"); r = addDamage(r.d, "shot");
ok("dois tiros: ainda de pé", [r.broken, damageText(r.d)], [false, "2/3 tiros · 0/1 explosão"]);
r = addDamage(r.d, "shot");
ok("terceiro tiro quebra", [r.broken, r.d.broken], [true, true]);
ok("quebrado não conta mais", addDamage(r.d, "shot").counted, false);
ok("uma explosão quebra", addDamage(d0, "blast").broken, true);
const mix = addDamage(addDamage({ ...d0, blasts: 2 }, "shot").d, "blast");
ok("tiros e explosões somam (1/3 + 1/2: de pé; mais um tiro: quebra)", [mix.broken, addDamage(mix.d, "shot").broken], [false, true]);
ok("à prova de tiros (0) só quebra com explosão", [addDamage({ ...d0, shots: 0 }, "shot").counted, addDamage({ ...d0, shots: 0 }, "blast").broken], [false, true]);
ok("padrão no item", destrOf({ metadata: { [DESTR]: { shots: 5 } } }).blasts, 1);

// geometria
ok("ponto dentro da caixa: distância 0", itemDistance(box("c", 0, 0), { x: 10, y: 10 }, dpi), 0);
ok("ponto ao lado da caixa", itemDistance(box("c", 0, 0), { x: 150, y: 0 }, dpi), 100);
ok("distância até a parede", itemDistance(wall, { x: 300, y: 50 }, dpi), 200);
ok("centro da parede", centerOf(wall, dpi), { x: 500, y: 0 });

// eventos de um disparo
const spec = (fx, hit = true, targets = [{ at: { x: 400, y: 0 }, kind: "metal", id: "c" }], mode = "single") => ({ fx, mode, from: { x: 0, y: 0 }, targets, hit, cell: dpi, seed: 7, rounds: { single: 1, burst: 3 }[mode] });
ok("metralhadora pesada: tiro pesado no alvo", damageEvents(spec("hmg")).map((e) => [e.kind, e.id, e.heavy]), [["shot", "c", true]]);
ok("pistola: tiro comum", damageEvents(spec("pistol"))[0].heavy, false);
ok("errou: não conta", damageEvents(spec("hmg", false)).length, 0);
ok("rajada: 3 tiros", damageEvents(spec("hmg", true, undefined, "burst")).length, 3);
const g = damageEvents(spec("frag"));
ok("granada: explosão de raio 2 no ponto", [g.length, g[0].kind, g[0].r, Math.round(g[0].at.x)], [1, "blast", 2, 400]);
ok("foguete: raio 3", damageEvents(spec("rocket"))[0].r, 3);
ok("canhão: explosão pequena", damageEvents(spec("cannon"))[0].kind, "blast");

// quem é atingido
const door = box("c", 400, 0); const dd = { ...DEFAULT_DESTR };
ok("tiro pesado no alvo marcado", affects({ kind: "shot", id: "c", heavy: true, at: { x: 0, y: 0 } }, door, dd, dpi), true);
ok("tiro comum não conta (a menos que marque qualquer tiro)", [affects({ kind: "shot", id: "c", heavy: false }, door, dd, dpi), affects({ kind: "shot", id: "c", heavy: false }, door, { ...dd, any: true }, dpi)], [false, true]);
ok("tiro pesado num ponto em cima da parede", affects({ kind: "shot", heavy: true, at: { x: 510, y: 30 } }, wall, dd, dpi), true);
ok("explosão pega o que está no raio", [affects({ kind: "blast", at: { x: 320, y: 0 }, r: 2 }, wall, dd, dpi), affects({ kind: "blast", at: { x: 250, y: 0 }, r: 2 }, wall, dd, dpi)], [true, false]);
ok("quebrado não é atingido", affects({ kind: "blast", at: { x: 400, y: 0 }, r: 2 }, door, { ...dd, broken: true }, dpi), false);

// cargas
const tok = (id, x, y) => ({ ...box(id, x, y), layer: "CHARACTER" });
ok("tokens pegos na explosão", caughtBy({ x: 0, y: 0 }, 2, [tok("a", 100, 0), tok("b", 300, 0), box("x", 0, 0)], dpi), ["a"]);
const c = chargeOf({ metadata: { [CHARGE]: { by: "p1", mode: "timer", endsAt: 10500, show: "me" } } });
ok("contagem: segundos que faltam", [remaining(c, 0), remaining(c, 10000), remaining(c, 20000)], [11, 1, 0]);
ok("remoto não tem contagem", remaining({ mode: "remote" }, 0), null);
ok("quem vê a contagem (só eu): eu, mestre, outro", [seesCountdown(c, { id: "p1", role: "PLAYER" }), seesCountdown(c, { id: "gm", role: "GM" }), seesCountdown(c, { id: "p2", role: "PLAYER" })], [true, true, false]);
ok("quem controla: quem plantou e o mestre", [canControl(c, "p1", "PLAYER"), canControl(c, "p2", "PLAYER"), canControl(c, "gm", "GM")], [true, false, true]);

// efeitos
const has = () => true;
ok("quebra com vídeos JB2A", buildDebris({ x: 0, y: 0 }, 2, dpi, 1, has).videos.length, 4);
ok("explosão sem vídeos: desenhada", buildBlast({ x: 0, y: 0 }, 2, dpi, 1, () => false).videos.length, 0);

// habilidades no cenário
const circle = (x, y, r) => ({ kind: "circle", c: { x, y }, r });
const cone = { kind: "poly", pts: [{ x: 0, y: 0 }, { x: 400, y: 200 }, { x: 400, y: -200 }] };
ok("círculo pega a caixa no raio", [shapeHitsItem(circle(150, 0, 120), box("c", 0, 0), dpi), shapeHitsItem(circle(400, 0, 60), box("c", 0, 0), dpi)], [true, false]);
ok("cone pega a caixa à frente, não a de trás", [shapeHitsItem(cone, box("c", 200, 0), dpi), shapeHitsItem(cone, box("c", -300, 0), dpi)], [true, false]);
ok("cone pega a parede que ele atravessa", shapeHitsItem(cone, { ...wall, position: { x: 300, y: 0 } }, dpi), true);
ok("cone fora da parede", shapeHitsItem(cone, { ...wall, position: { x: 700, y: 0 } }, dpi), false);
const abArea = { forma: "area", area: 3, dano: "6d6 fogo" };
ok("área com dano: 1 explosão pesada", habEvents(abArea, circle(0, 0, 200), []).map((e) => [e.kind, e.peso]), [["shape", "blast"]]);
ok("área sem dano não machuca o cenário", habEvents({ forma: "area", area: 3 }, circle(0, 0, 200), []), []);
ok("cenario: nenhum desliga", habEvents({ ...abArea, cenario: "nenhum" }, circle(0, 0, 200), []), []);
ok("cenario: tiro vira tiro pesado", habEvents({ ...abArea, cenario: "tiro" }, circle(0, 0, 200), [])[0].peso, "shot");
ok("alvo só machuca com cenario explícito", [habEvents({ forma: "alvo", dano: "2d8" }, null, [{ id: "c", at: { x: 1, y: 1 } }]).length, habEvents({ forma: "alvo", cenario: "tiro" }, null, [{ id: "c", at: { x: 1, y: 1 } }]).map((e) => [e.kind, e.id, e.heavy])], [0, [["shot", "c", true]]]);
ok("alvo com explosão: raio da área em quadrados", habEvents({ forma: "alvo", cenario: "explosao", area: 3 }, null, [{ id: "c", at: { x: 0, y: 0 } }], 1.5)[0].r, 2);
const evS = habEvents(abArea, circle(150, 0, 120), [])[0];
const dest0 = { ...DEFAULT_DESTR };
ok("evento de forma afeta o destrutível na área (explosão)", [affects(evS, box("c", 0, 0), dest0, dpi), affects(evS, box("c", 900, 0), dest0, dpi)], [true, false]);
ok("à prova de explosão não é afetado", affects(evS, box("c", 0, 0), { ...dest0, blasts: 0 }, dpi), false);
ok("tiro de habilidade só conta se o item aguenta tiros", [affects({ ...evS, peso: "shot" }, box("c", 0, 0), dest0, dpi), affects({ ...evS, peso: "shot" }, box("c", 0, 0), { ...dest0, shots: 0 }, dpi)], [true, false]);
