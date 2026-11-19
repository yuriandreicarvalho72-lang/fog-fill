import { build } from "../node_modules/esbuild/lib/main.js";
import { resolve } from "path";
const out = await build({
  stdin: { contents: `export * from "./src/session.js"; export * from "./src/area.js"; export * from "./src/vision.js"; export * as M from "./test/mock-sdk.mjs";`, resolveDir: resolve("."), loader: "js" },
  bundle: true, format: "esm", write: false, platform: "node",
  define: { "import.meta.env.BASE_URL": '"/"' },
  plugins: [{ name: "mock", setup(b) { b.onResolve({ filter: /^@owlbear-rodeo\/sdk$/ }, () => ({ path: resolve("test/mock-sdk.mjs") })); } }],
});
const mod = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const { RulerSession, AreaSession, areaOrigin, M } = mod;
const grid = { dpi: 150, type: "SQUARE", measurement: "ALTERNATING", scale: { parsed: { multiplier: 5, unit: "ft", digits: 0 } }, square: true };
const token = { id: "tok", type: "IMAGE", layer: "CHARACTER", position: { x: 75, y: 75 } };
M.state.scene.push(structuredClone(token));
const s = new RulerSession({ kind: "move", grid, start: token.position, token, color: "#f00", trailMs: 10, stepMs: 5 });
await s.begin();
await s.move({ x: 75 + 300 + 20, y: 75 + 290 });   // 2 diagonais
await s.addPoint();
await s.move({ x: 75 + 450 - 30, y: 75 + 470 });   // +1 diagonal: total 3 diagonais = 4 quadrados = 20 ft
const cur = M.state.interactions.at(-1).items;
console.log("rótulo:", cur[2].text.plainText, "| token na prévia:", JSON.stringify(cur[3].position), "| pontos:", cur[0].points.length);
await s.undoPoint(); await s.move({ x: 375, y: 75 }); await s.addPoint(); await s.move({ x: 375, y: 525 }); await s.addPoint(); await s.move({ x: 525, y: 525 });
let handed = null; const t0 = Date.now(); await s.confirm((t) => { handed = t; }); console.log("confirmar levou", Date.now() - t0, "ms; rastro entregue com", handed.points.length, "pontos");
console.log("passos do token:", M.log.filter((l) => l[0] === "update").map((l) => JSON.stringify(l[2][0])).join(" → "));
console.log("token na cena:", JSON.stringify(M.state.scene[0].position), "| interações paradas:", M.state.interactions.every((i) => i.stopped));
const settings = { cellRule: "center", showCells: true, pin: true, pinAreas: true, pinMeasure: true, areaOpacity: 0.2, lineWidth: 1 };
const o = areaOrigin("circle", { x: 1490, y: 1510 }, grid, null, false);
const a = new AreaSession({ kind: "circle", origin: o, grid, color: "#0af", settings, playerId: "me" });
await a.begin(); a.move({ x: o.x + 600, y: o.y + 10 });
console.log("origem:", JSON.stringify(o), "| área:", M.state.interactions.at(-1).items[2].text.plainText);
await a.place();
console.log("itens na cena:", M.state.scene.length, M.state.scene.slice(1).map((i) => `${i.type}/${i.layer}${i.attachedTo ? " preso" : ""}`).join(", "));
const sq = new AreaSession({ kind: "square", origin: areaOrigin("square", { x: 700, y: 700 }, grid, token), grid, color: "#0af", settings, playerId: "me" });
sq.move({ x: 75 + 300, y: 75 }); console.log("quadrado a partir do token:", sq.text);
const cone = new AreaSession({ kind: "cone", origin: { x: 0, y: 0 }, grid, color: "#0af", settings: { ...settings, cellRule: "half" }, playerId: "me" });
cone.move({ x: 900, y: 0 }); console.log("cone (metade):", cone.text);
console.log(M.log.filter((l) => l[0] === "notify"));

// régua fixada
const r = new RulerSession({ kind: "measure", grid, start: { x: 75, y: 75 }, color: "#0f0", trailMs: 0, persist: true, owner: "me" });
await r.begin(); await r.move({ x: 375, y: 375 }); await r.addPoint(); await r.move({ x: 825, y: 375 });
const before = M.state.scene.length; await r.confirm();
const added = M.state.scene.slice(before);
console.log("régua fixada:", added.map((i) => i.type + (i.text ? `"${i.text.plainText}"` : "")).join(", "));
const ar = M.state.scene.filter((i) => i.type === "LABEL" && i.attachedTo && !added.includes(i));
console.log("rótulos das áreas:", ar.map((i) => i.text.plainText).join(" | "));

// terreno difícil: área difícil fixada nas colunas 2..3, régua reta de 5 quadrados
const dz = new AreaSession({ kind: "cube", origin: { x: 300, y: 0 }, grid, color: "#0af", settings: { ...settings, pin: false }, playerId: "me" });
dz.move({ x: 600, y: 300 }); await dz.place(true);
const m2 = new RulerSession({ kind: "measure", grid, start: { x: 75, y: 75 }, color: "#0f0", cellRule: "center" });
await m2.begin(); await m2.move({ x: 75 + 5 * 150, y: 75 });
console.log("régua por terreno difícil:", M.state.interactions.at(-1).items[2].text.plainText, "(esperado 35 ft ⛰)");
// visão: parede vertical cobrindo metade de baixo do alvo
const { VisionSession } = mod;
const obstacles = { walls: [{ a: { x: 600, y: 80 }, b: { x: 600, y: 600 } }], partial: [], circles: [] };
const vs = new VisionSession({ source: { x: 75, y: 75 }, sourceId: null, grid, obstacles, settings: { visionShared: true, visionAll: true, visionTo: "corners" },
  tokens: [{ id: "a", position: { x: 825, y: 75 }, radius: 80 }, { id: "b", position: { x: 825, y: 1275 }, radius: 80 }] });
await vs.begin(); vs.aim({ x: 830, y: 70 }, null, false);
const vi = M.state.interactions.at(-1).items;
console.log("visão:", vi.at(-1).text.plainText, "| anéis:", Object.entries(vs.badges).filter(([, v]) => v.length).map(([k]) => k).join(", "));
vs.stop(); m2.cancel(); process.exit(0);
