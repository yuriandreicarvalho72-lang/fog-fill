// Compila todos os climas no CanvasKit e monta uma folha de contato sobre um mapa.
import CanvasKitInit from 'canvaskit-wasm';
import fs from 'fs';
import { TYPES, buildSksl, buildUniforms } from '../src/shaders.js';
const CK = await CanvasKitInit();
const bgBytes = fs.readFileSync(process.argv[2]);
const bg = CK.MakeImageFromEncoded(bgBytes);
const W = 360, H = 250, cols = 4, times = [0.6, 2.2];
const only = process.argv[4] ? process.argv[4].split(',') : null;
const list = TYPES.filter((t) => !only || only.includes(t.id));
const rows = Math.ceil(list.length / cols);
const surf = CK.MakeSurface(cols * W * times.length, rows * (H + 18));
const c = surf.getCanvas(); c.clear(CK.Color(20, 20, 24, 1));
const font = new CK.Font(null, 13);
const txt = new CK.Paint(); txt.setColor(CK.Color(255, 255, 255, 1));
let errors = 0;
list.forEach((t, idx) => {
  let err = '';
  const eff = CK.RuntimeEffect.Make(buildSksl(t.id), (e) => (err = e));
  if (!eff) { console.log('ERRO', t.id, err); errors++; return; }
  const cell = 40; // a área tem 9 x 6,25 quadrados
  times.forEach((tm, k) => {
    const x0 = ((idx % cols) * times.length + k) * W, y0 = Math.floor(idx / cols) * (H + 18) + 18;
    c.save(); c.translate(x0, y0);
    c.drawImageRect(bg, CK.LTRBRect(0, 0, bg.width(), bg.height()), CK.LTRBRect(0, 0, W, H), new CK.Paint());
    // uniforms na ordem de declaração: time, size, depois os da camada
    const u = buildUniforms({ ...t, opacity: 1, scale: 1 }, cell, 0);
    const vals = [tm, W, H];
    for (const x of u) { const v = x.value; if (typeof v === 'number') vals.push(v); else { vals.push(v.x, v.y); if (v.z !== undefined) vals.push(v.z); } }
    if (vals.length !== eff.getUniformFloatCount()) console.log('uniforms', t.id, vals.length, eff.getUniformFloatCount());
    const p = new CK.Paint(); p.setShader(eff.makeShader(vals));
    c.drawRect(CK.LTRBRect(0, 0, W, H), p);
    c.restore();
  });
  const x0 = (idx % cols) * times.length * W, y0 = Math.floor(idx / cols) * (H + 18);
  c.drawText(`${t.id} — ${t.label}`, x0 + 6, y0 + 14, txt, font);
});
fs.writeFileSync(process.argv[3], surf.makeImageSnapshot().encodeToBytes());
console.log(errors ? `${errors} com erro` : `todos os ${list.length} compilaram`);
