import CanvasKitInit from 'canvaskit-wasm';
import fs from 'fs';
import { buildSksl, buildUniforms } from '../src/shader.js';
const CK = await CanvasKitInit();
const lights = [{ x: 420, y: 260, radius: 120, softness: 0.5, intensity: 0.9, color: '#ff2a2a', dir: 0, inner: Math.PI, outer: Math.PI }];
const segs = [{ ax: 470, ay: 180, bx: 470, by: 330 }];
const sk = buildSksl(1, 1, 'standalone', true);
let err = ''; const eff = CK.RuntimeEffect.Make(sk, (e) => (err = e));
if (!eff) { console.log(err); process.exit(1); }
// retângulo como o background calcula
const m = 20, minX = 420 - 120 - m, minY = 260 - 120 - m, W = 2 * (240 + 2 * m), H = 2 * (240 + 2 * m);
const vals = [minX, minY, W, H, W, H]; // position, size, wsize
for (const u of buildUniforms(lights, segs)) { const v = u.value; vals.push(v.x, v.y); if (v.z !== undefined) vals.push(v.z); }
console.log('floats', eff.getUniformFloatCount(), vals.length);
const surf = CK.MakeSurface(800, 600); const c = surf.getCanvas(); c.clear(CK.Color(50, 50, 50, 1));
const p = new CK.Paint(); p.setShader(eff.makeShader(vals)); p.setBlendMode(CK.BlendMode.Screen);
c.save(); c.translate(minX, minY); c.drawRect(CK.LTRBRect(0, 0, W, H), p); c.restore();
const tok = new CK.Paint(); tok.setColor(CK.Color(255, 255, 0, 1)); tok.setStyle(CK.PaintStyle.Stroke); tok.setStrokeWidth(2); c.drawCircle(420, 260, 22, tok);
const wp = new CK.Paint(); wp.setColor(CK.Color(255, 255, 255, 1)); wp.setStrokeWidth(3); c.drawLine(470, 180, 470, 330, wp);
fs.writeFileSync('/home/claude/standalone.png', surf.makeImageSnapshot().encodeToBytes());
