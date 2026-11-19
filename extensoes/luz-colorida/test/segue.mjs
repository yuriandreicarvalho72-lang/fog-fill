// A luz acompanha o efeito: com os MESMOS uniforms, mover o efeito (como acontece quando ele está preso ao
// token e o token é arrastado) move a luz junto; a parede continua no lugar e segue fazendo sombra.
import CanvasKitInit from "canvaskit-wasm";
import fs from "fs";
import { buildSksl, buildUniforms } from "../src/shader.js";
const CK = await CanvasKitInit();
const ok = (n, v, e) => console.log((JSON.stringify(v) === JSON.stringify(e) ? "ok  " : "ERRO") + " " + n + ": " + JSON.stringify(v));

const R = 100, m = 20;
const light = { x: 200, y: 200, radius: R, softness: 0.3, intensity: 1, color: "#ff0000", dir: 0, inner: Math.PI, outer: Math.PI };
const rect = { x: light.x - R - m, y: light.y - R - m, w: 2 * (2 * R + 2 * m), h: 2 * (2 * R + 2 * m) };
const wall = [{ ax: 330, ay: 0, bx: 330, by: 600 }]; // parede fixa no mundo
const eff = CK.RuntimeEffect.Make(buildSksl(1, 1, "local"), (e) => console.log(e));
const uniforms = buildUniforms([light], wall, false, { x: rect.x, y: rect.y }); // calculados UMA vez

function render(pos) {
  const vals = [pos.x, pos.y, rect.w, rect.h, rect.w, rect.h];
  for (const u of uniforms) { const v = u.value; vals.push(v.x, v.y); if (v.z !== undefined) vals.push(v.z); }
  const surf = CK.MakeSurface(700, 400); const c = surf.getCanvas(); c.clear(CK.Color(0, 0, 0, 1));
  const p = new CK.Paint(); p.setShader(eff.makeShader(vals));
  c.save(); c.translate(pos.x, pos.y); c.drawRect(CK.LTRBRect(0, 0, rect.w, rect.h), p); c.restore();
  const img = surf.makeImageSnapshot();
  const px = img.readPixels(0, 0, { width: 700, height: 400, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB });
  let sx = 0, sy = 0, n = 0;
  const red = (x, y) => px[(y * 700 + x) * 4];
  for (let y = 0; y < 400; y++) for (let x = 0; x < 700; x++) if (red(x, y) > 120) { sx += x; sy += y; n++; }
  return { center: n ? [Math.round(sx / n), Math.round(sy / n)] : null, red, bytes: img.encodeToBytes() };
}
const a = render({ x: rect.x, y: rect.y });
const b = render({ x: rect.x + 150, y: rect.y + 40 }); // token arrastado 150 para a direita, 40 para baixo
ok("luz no lugar do token", a.center, [200, 200]);
ok("efeito movido: a luz vai junto (sem novos uniforms)", b.center && [Math.abs(b.center[1] - 240) <= 2, b.center[0] > 330], [true, true]);
// a luz agora está em (350,240), à direita da parede fixa em x=330: o lado esquerdo da parede fica na sombra
ok("parede fixa continua fazendo sombra (sombra do outro lado)", [b.red(320, 240) < 10, b.red(345, 240) > 200], [true, true]);
if (process.argv[2]) fs.writeFileSync(process.argv[2], Buffer.from(a.bytes));
if (process.argv[3]) fs.writeFileSync(process.argv[3], Buffer.from(b.bytes));
