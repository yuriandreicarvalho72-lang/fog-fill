import CanvasKitInit from 'canvaskit-wasm';
import fs from 'fs';
import { buildSksl, buildUniforms } from '../src/shader.js';
const CK = await CanvasKitInit();
const lights = [
  { x: 150, y: 150, radius: 130, softness: 0.6, intensity: 0.8, color: '#ff8a2a', dir: 0, inner: Math.PI, outer: Math.PI },
  { x: 330, y: 90, radius: 90, softness: 0.3, intensity: 0.9, color: '#3aa0ff', dir: Math.PI / 2, inner: 0.4, outer: 0.6 },
];
const segs = [{ ax: 200, ay: 90, bx: 200, by: 210 }, { ax: 60, ay: 230, bx: 140, by: 250 }];
const sksl = buildSksl(lights.length, segs.length);
let err = '';
const eff = CK.RuntimeEffect.Make(sksl, (e) => (err = e));
if (!eff) { console.log('ERRO DE COMPILAÇÃO:\n' + err); process.exit(1); }
// uniforms na ordem de declaração: view (mat3 col-major) + os nossos
const view = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // identidade: mundo = tela
const vals = [...view];
for (const u of buildUniforms(lights, segs)) { const v = u.value; vals.push(v.x, v.y); if (v.z !== undefined) vals.push(v.z); }
console.log('uniforms esperados', eff.getUniformFloatCount(), 'enviados', vals.length);
const shader = eff.makeShader(vals);
const surf = CK.MakeSurface(400, 300);
const c = surf.getCanvas();
c.clear(CK.Color(60, 60, 60, 1));
const grid = new CK.Paint(); grid.setColor(CK.Color(90, 90, 90, 1));
for (let x = 0; x < 400; x += 20) c.drawLine(x, 0, x, 300, grid);
for (let y = 0; y < 300; y += 20) c.drawLine(0, y, 400, y, grid);
const p = new CK.Paint(); p.setShader(shader); p.setBlendMode(CK.BlendMode.Screen);
c.drawRect(CK.LTRBRect(0, 0, 400, 300), p);
const wp = new CK.Paint(); wp.setColor(CK.Color(255, 255, 255, 1)); wp.setStrokeWidth(3);
for (const s of segs) c.drawLine(s.ax, s.ay, s.bx, s.by, wp);
const img = surf.makeImageSnapshot();
fs.writeFileSync(process.argv[2], img.encodeToBytes());
console.log('ok, linhas do shader:', sksl.split('\n').length);
