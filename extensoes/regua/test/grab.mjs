// Segurar e soltar: fases (pegar, soltar, pegar de novo, clicar fora, desfazer, confirmar) e a aparência do token levantado.
import { build } from "../node_modules/esbuild/lib/main.js";
import { resolve } from "path";
const out = await build({
  stdin: { contents: `export * from "./src/grab.js"; export * from "./src/geom.js"; export * as M from "./test/mock-sdk.mjs";`, resolveDir: resolve("."), loader: "js" },
  bundle: true, format: "esm", write: false, platform: "node",
  define: { "import.meta.env.BASE_URL": '"/"' },
  plugins: [{ name: "mock", setup(b) { b.onResolve({ filter: /^@owlbear-rodeo\/sdk$/ }, () => ({ path: resolve("test/mock-sdk.mjs") })); } }],
});
const mod = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const { GrabController, liftLook, ellipseCommands, tokenSizePx, M } = mod;
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
const grid = { dpi: 150, type: "SQUARE", measurement: "ALTERNATING", scale: { parsed: { multiplier: 5, unit: "ft", digits: 0 } }, square: true };
const token = { id: "tok", type: "IMAGE", layer: "CHARACTER", position: { x: 75, y: 75 }, image: { width: 150, height: 150 }, grid: { dpi: 150, offset: { x: 75, y: 75 } }, scale: { x: 1, y: 1 } };
M.state.scene.push(structuredClone(token));

// aparência
const up = liftLook(token, { x: 300, y: 300 }, 150, true), down = liftLook(token, { x: 300, y: 300 }, 150, false);
ok("levantado: o token sobe e cresce", [up.ghost.y < 300, up.scale > 1], [true, true]);
ok("pousado: no lugar, tamanho normal", [down.ghost, down.scale], [{ x: 300, y: 300 }, 1]);
ok("a sombra fica no chão, abaixo do centro", up.shadow.cy > 300, true);
ok("elipse: 4 curvas cúbicas e fecha", ellipseCommands(0, 0, 10, 4).map((c) => c[0]), [0, 4, 4, 4, 4, 5]);
ok("tamanho de token 2x2", tokenSizePx({ image: { width: 150, height: 150 }, scale: { x: 2, y: 2 }, grid: { dpi: 150 } }, 150), { w: 300, h: 300 });

const g = new GrabController({ grid, token, color: "#f00", trailMs: 0, stepMs: 1, start: token.position });
await g.begin();
const items = () => M.state.interactions.at(-1).items;
ok("começa parado", [g.phase, g.ready], ["idle", false]);
await g.move({ x: 500, y: 500 });
ok("sem segurar, mexer o ponteiro não faz nada", [g.phase, g.s.cursor], ["idle", { x: 75, y: 75 }]);
await g.down({ x: 300, y: 75 });
ok("pegou: segurando e levantado", [g.phase, g.s.lifted], ["drag", true]);
ok("a prévia tem sombra e token", [items().length, items()[3].layer, items()[4].id], [5, "MOUNT", "tok"]);
await g.move({ x: 450, y: 75 });
ok("arrastando: o token acompanha (levantado)", [items()[4].position.x, items()[4].position.y < 75], [525, true]);
await g.up({ x: 450, y: 75 });
ok("soltou: marcado e pousado", [g.phase, g.points.length, g.s.lifted, g.ready], ["pending", 2, false, true]);
ok("pousado: o token fica no ponto", [items()[4].position, items()[4].scale], [{ x: 525, y: 75 }, { x: 1, y: 1 }]);
await g.down({ x: 540, y: 80 });   // perto da última marca: pega de novo
ok("pegou a marca de novo", [g.phase, g.points.length], ["drag", 1]);
await g.up({ x: 450, y: 375 });
ok("mudou a marca", [g.phase, g.points.length, g.last], ["pending", 2, { x: 525, y: 375 }]);
await g.down({ x: 900, y: 375 });  // longe: novo ponto
ok("clique longe acrescenta um ponto", [g.phase, g.points.length, g.last], ["pending", 3, { x: 975, y: 375 }]);
await g.undo();
ok("backspace tira a última marca", [g.points.length, g.phase], [2, "pending"]);
await g.undo();
ok("sem marcas volta a esperar", [g.points.length, g.phase, g.ready], [1, "idle", false]);
await g.down({ x: 300, y: 75 }); await g.up({ x: 300, y: 75 + 300 }); await g.down({ x: 900, y: 375 });
let handed = null;
await g.confirm((t) => { handed = t; });
ok("confirmar anda pelo caminho e para a prévia", [M.state.scene[0].position, M.state.interactions.at(-1).stopped, handed.points.length], [{ x: 975, y: 375 }, true, 3]);
const g2 = new GrabController({ grid, token: M.state.scene[0], color: "#f00", trailMs: 0, stepMs: 1, points: [{ x: 975, y: 375 }, { x: 1125, y: 375 }] });
await g2.begin();
ok("retomando marcas, o rótulo mostra a distância (não 0)", [g2.s.text && g2.s.text !== "0", g2.s.text], [true, g2.s.text]);
ok("com marcas prontas começa pousado (camada do botão direito)", [g2.phase, g2.s.lifted, g2.ready], ["pending", false, true]);
g2.cancel();
ok("cancelar para a prévia e não mexe no token", [M.state.interactions.at(-1).stopped, M.state.scene[0].position], [true, { x: 975, y: 375 }]);
const gs = new GrabController({ grid, token, color: "#f00", shadow: false, start: token.position });
await gs.begin();
ok("sombra desligada: o item da sombra fica invisível", [M.state.interactions.at(-1).items[3].fillOpacity, M.state.interactions.at(-1).items[3].id.endsWith("shadow-off")], [0, true]);
gs.cancel();
process.exit(bad ? 1 : 0);
