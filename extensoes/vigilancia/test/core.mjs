import { CAM, NODE, DECK, wallsFrom, rayDist, blocked, inCone, sees, coneDir, conePolygon, seenBy, camOn, nodeOf, hasAccess, nodeChanges, doorLock } from "../src/core.js";
const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v));
const r1 = (v) => Math.round(v * 10) / 10;

const cell = 100;
const wall = { id: "w", type: "WALL", position: { x: 500, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, blocking: true, points: [{ x: 0, y: -1000 }, { x: 0, y: 1000 }] };
const walls = wallsFrom([wall, { ...wall, id: "w2", blocking: false, position: { x: 300, y: 0 } }]);
ok("parede da névoa dinâmica (as que não bloqueiam ficam de fora)", walls.length, 1);
ok("parede girada e deslocada", wallsFrom([{ ...wall, rotation: 90, position: { x: 0, y: 200 } }]).map((s) => [r1(s.a.x), r1(s.a.y), r1(s.b.x), r1(s.b.y)]), [[1000, 200, -1000, 200]]);
ok("linha de visão do Smoke & Spectre", wallsFrom([{ type: "LINE", position: { x: 0, y: 0 }, startPosition: { x: 0, y: 0 }, endPosition: { x: 10, y: 0 }, metadata: { "com.battle-system.smoke/isVisionLine": true } }]).length, 1);
ok("raio para na parede", r1(rayDist({ x: 0, y: 0 }, 1, 0, walls, 2000)), 500);
ok("raio sem parede vai até o alcance", rayDist({ x: 0, y: 0 }, -1, 0, walls, 800), 800);
ok("parede no meio bloqueia", blocked({ x: 0, y: 0 }, { x: 700, y: 0 }, walls), true);
ok("sem parede no meio", blocked({ x: 0, y: 0 }, { x: 400, y: 100 }, walls), false);

const cam = { angle: 90, range: 8, dir: 0, sweep: 0, period: 8 };
ok("dentro do cone", inCone({ x: 0, y: 0 }, 0, cam, { x: 300, y: 100 }, cell), true);
ok("fora do ângulo", inCone({ x: 0, y: 0 }, 0, cam, { x: 100, y: 300 }, cell), false);
ok("fora do alcance", inCone({ x: 0, y: 0 }, 0, cam, { x: 900, y: 0 }, cell), false);
ok("ângulo atravessando 180°", inCone({ x: 0, y: 0 }, 180, cam, { x: -300, y: -50 }, cell), true);
ok("360° vê em volta", inCone({ x: 0, y: 0 }, 0, { ...cam, angle: 360 }, { x: -300, y: 0 }, cell), true);
ok("vê através do vazio, não através da parede", [sees({ x: 0, y: 0 }, 0, cam, { x: 400, y: 0 }, walls, cell), sees({ x: 0, y: 0 }, 0, cam, { x: 600, y: 0 }, walls, cell)], [true, false]);

const it = (id, x, y, md = {}, extra = {}) => ({ id, type: "IMAGE", layer: "CHARACTER", visible: true, position: { x, y }, rotation: 0, metadata: md, ...extra });
ok("direção = rotação do item + direção", coneDir({ rotation: 90 }, { dir: 45, sweep: 0 }), 135);
ok("varredura: começa no meio, vai até metade da amplitude", [coneDir({ rotation: 0 }, { dir: 0, sweep: 90, period: 4 }, 0), r1(coneDir({ rotation: 0 }, { dir: 0, sweep: 90, period: 4 }, 1000))], [0, 45]);

const camera = it("c", 0, 0, { [CAM]: { angle: 90, range: 8 }, [NODE]: { name: "Saguão", type: "camera", state: "ativo" } }, { layer: "PROP" });
const tokens = [camera, it("a", 300, 0), it("b", 600, 0), it("h", 200, 0, {}, { visible: false }), it("g", 250, 50, {}), it("p", 300, 20, {}, { layer: "PROP" })];
ok("quem a câmera vê (atrás da parede, escondido e objetos não)", seenBy(camera, tokens, walls, cell), ["a", "g"]);
ok("ignora aliados", seenBy({ ...camera, metadata: { ...camera.metadata, [CAM]: { angle: 90, range: 8, ignore: ["g"] } } }, tokens, walls, cell), ["a"]);
const loop = { ...camera, metadata: { ...camera.metadata, [NODE]: { state: "loop", type: "camera" } } };
ok("em loop não vê", [camOn(loop), seenBy(loop, tokens, walls, cell)], [false, []]);

const poly = conePolygon(0, cam, walls, cell, { x: 0, y: 0 });
ok("cone começa na câmera e é cortado pela parede", [poly[0], Math.max(...poly.map((p) => r1(p.x)))], [{ x: 0, y: 0 }, 500]);
ok("cone 360° sem ponto central", conePolygon(0, { ...cam, angle: 360 }, [], cell, { x: 0, y: 0 }).length, 120);

ok("nó com padrão", nodeOf({ name: "Porta", metadata: { [NODE]: {} } }), { name: "Porta", type: "outro", state: "ativo", hidden: false });
ok("acesso: mestre", hasAccess("u1", "GM", [], {}), true);
ok("acesso: marcado pelo mestre", hasAccess("u1", "PLAYER", [], { players: ["u1"] }), true);
ok("acesso: dono de token com cyberdeck", hasAccess("u1", "PLAYER", [{ createdUserId: "u1", metadata: { [DECK]: true } }], {}), true);
ok("acesso: dono pelo Arsenal", hasAccess("u2", "PLAYER", [{ createdUserId: "gm", metadata: { [DECK]: true, "arsenal/dono": "u2" } }], {}), true);
ok("sem acesso", hasAccess("u3", "PLAYER", [{ createdUserId: "u1", metadata: { [DECK]: true } }], {}), false);

const prev = new Map([["c", "ativo"], ["d", "ativo"]]);
ok("mudança de estado de nó", nodeChanges(prev, [camera, it("d", 0, 0, { [NODE]: { name: "Porta", type: "porta", state: "hackeado" } })]).map((c) => [c.id, c.prev, c.state]), [["d", "ativo", "hackeado"]]);
ok("porta hackeada destrava, ativa trava, loop não mexe", [doorLock({ type: "porta", state: "hackeado" }), doorLock({ type: "porta", state: "ativo" }), doorLock({ type: "porta", state: "loop" }), doorLock({ type: "camera", state: "ativo" })], [false, true, null, null]);
