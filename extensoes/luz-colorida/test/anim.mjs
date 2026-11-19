// Compila o shader com animação e desenha 7 luzes (uma por tipo) em 3 instantes.
import CanvasKitInit from 'canvaskit-wasm';
import fs from 'fs';
import { buildSksl, buildUniforms, ANIMS } from '../src/shader.js';
const CK = await CanvasKitInit();
let err = '';
const big = CK.RuntimeEffect.Make(buildSksl(24, 96, 'local', false, true), (e) => (err = e));
console.log('24 luzes x 96 trechos (animado):', big ? `ok (${big.getUniformFloatCount()} floats)` : 'ERRO ' + err);
const lights = ANIMS.map((a, i) => ({ x: 90 + i * 120, y: 90, radius: 55, softness: 0.4, intensity: 0.95, color: '#ff3030', dir: 0, inner: Math.PI, outer: Math.PI, anim: a.id, speed: 1 }));
const W = 860, H = 180;
const eff = CK.RuntimeEffect.Make(buildSksl(lights.length, 0, 'local', false, true), (e) => console.log(e));
const surf = CK.MakeSurface(W, H * 3); const c = surf.getCanvas(); c.clear(CK.Color(30, 30, 30, 1));
for (const [row, t] of [0.0, 0.37, 0.81].entries()) {
  // uniforms na ordem da declaração: time, position, size, wsize, depois por luz lp lc la ld lx
  const vals = [t, 0, 0, W, H, W, H];
  for (const u of buildUniforms(lights, [], true)) { const v = u.value; vals.push(v.x, v.y); if (v.z !== undefined) vals.push(v.z); }
  const ordered = [];
  // buildUniforms coloca lx antes de lp; reordena para lp, lc, la, ld, lx
  const per = 14; const base = vals.slice(0, 7); const rest = vals.slice(7);
  for (let i = 0; i < lights.length; i++) { const b = rest.slice(i * per, i * per + per); ordered.push(...b.slice(3), ...b.slice(0, 3)); }
  const p = new CK.Paint(); p.setShader(eff.makeShader([...base, ...ordered]));
  c.save(); c.translate(0, row * H); c.drawRect(CK.LTRBRect(0, 0, W, H), p); c.restore();
}
fs.writeFileSync(process.argv[2] || 'anim.png', surf.makeImageSnapshot().encodeToBytes());
console.log('ok');
