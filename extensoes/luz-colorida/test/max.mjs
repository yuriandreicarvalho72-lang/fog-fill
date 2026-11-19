import CanvasKitInit from 'canvaskit-wasm';
import fs from 'fs';
import { buildSksl, buildUniforms } from '../src/shader.js';
const CK = await CanvasKitInit();
// 1) o tamanho máximo compila?
let err = ''; const big = CK.RuntimeEffect.Make(buildSksl(8, 96), (e) => (err = e));
console.log('8 luzes x 96 trechos:', big ? `ok (${big.getUniformFloatCount()} floats)` : 'ERRO ' + err);
// 2) com câmera: zoom 0.5 e deslocada; a luz em mundo (1000,600) deve aparecer na tela em (1000*0.5-200, 600*0.5-100) = (300,200)
const lights = [{ x: 1000, y: 600, radius: 200, softness: 0.5, intensity: 0.9, color: '#ff3fb4', dir: 0, inner: Math.PI, outer: Math.PI }];
const eff = CK.RuntimeEffect.Make(buildSksl(1, 0));
const view = [0.5, 0, 0, 0, 0.5, 0, -200, -100, 1]; // col-major: a,b,0 | c,d,0 | tx,ty,1
const vals = [...view]; for (const u of buildUniforms(lights, [])) { const v = u.value; vals.push(v.x, v.y); if (v.z !== undefined) vals.push(v.z); }
const surf = CK.MakeSurface(600, 400); const c = surf.getCanvas(); c.clear(CK.Color(50, 50, 50, 1));
const p = new CK.Paint(); p.setShader(eff.makeShader(vals)); p.setBlendMode(CK.BlendMode.Screen); c.drawRect(CK.LTRBRect(0, 0, 600, 400), p);
const m = new CK.Paint(); m.setColor(CK.Color(255, 255, 255, 1)); c.drawCircle(300, 200, 3, m);
fs.writeFileSync('/home/claude/shader_cam.png', surf.makeImageSnapshot().encodeToBytes());
console.log('render da câmera ok');
