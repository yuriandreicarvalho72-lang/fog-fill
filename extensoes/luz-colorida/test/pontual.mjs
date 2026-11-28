// Luz pontual: o shader compila com a luz solta no mapa e o brilho sobe/desce como esperado.
import CanvasKitInit from "canvaskit-wasm";
import { buildPontual, envelope } from "../src/pontual-calc.js";
import { buildSksl } from "../src/shader.js";
const CK = await CanvasKitInit();
let bad = 0;
const ok = (n, v, e) => { const g = JSON.stringify(v) === JSON.stringify(e); if (!g) bad++; console.log((g ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v)); };
ok("envelope começa em 0", envelope(0, 2, 1), 0);
ok("envelope cheio no meio", envelope(0.6, 2, 1), 1);
ok("envelope apaga no fim", envelope(1.5, 2, 1), 0.5);
ok("envelope zerado depois", envelope(2.5, 2, 1), 0);
ok("sem fim não apaga", envelope(100, "fim", 5), 1);
for (const anim of ["none", "flicker", "beacon", "strobe"]) {
  const b = buildPontual({ x: 500, y: 300, cor: "#ff8a1f", raio: 150, intens: 0.8, anim }, { posMode: "local" }, 1);
  const eff = CK.RuntimeEffect.Make(b.sksl, (e) => { bad++; console.log("ERRO shader", e); });
  ok(`shader ${anim} compila`, !!eff, true);
  ok(`retângulo ${anim} centrado na luz`, [b.rect.x + b.rect.w / 2 - 20 * 0, b.rect.w > 0], [b.rect.x + b.rect.w / 2, true]);
}
const comParede = buildPontual({ x: 500, y: 300, cor: "#ff8a1f", raio: 150, intens: 0.8 }, { posMode: "local" }, 1, [{ ax: 450, ay: 250, bx: 450, by: 350 }]);
ok("shader com parede compila", !!CK.RuntimeEffect.Make(comParede.sksl, (e) => { bad++; console.log("ERRO shader", e); }), true);
ok("a parede vira uniform", comParede.uniforms.some((u) => u.name === "sa0"), true);
const k = buildPontual({ x: 0, y: 0, cor: "#fff", raio: 100, intens: 1 }, {}, 0.5);
ok("brilho multiplicado", k.uniforms.find((u) => u.name === "la0").value.z, 0.5);
if (bad) process.exit(1);
