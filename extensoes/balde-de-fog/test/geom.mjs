import { sceneToImagePixel, imagePixelToScene } from '../src/shared.js';
const item = { position: { x: 300, y: -120 }, rotation: 30, scale: { x: 1.5, y: 1.5 }, grid: { dpi: 140, offset: { x: 50, y: 70 } }, image: { width: 1086, height: 1448 } };
let worst = 0;
for (const [px, py] of [[0, 0], [1086, 1448], [500, 700], [50, 70]]) {
  const s = imagePixelToScene(item, 150, px, py);
  const b = sceneToImagePixel(item, 150, s);
  worst = Math.max(worst, Math.hypot(b.x - px, b.y - py));
}
console.log('roundtrip max error', worst.toExponential(2));
// o Path usa position/rotation/scale do mapa com comandos (px - offset): confere que bate com imagePixelToScene
const k = 150 / item.grid.dpi, a = item.rotation * Math.PI / 180;
const [px, py] = [800, 300];
const lx = (px - 50) * item.scale.x * k, ly = (py - 70) * item.scale.y * k;
const viaPath = { x: 300 + lx * Math.cos(a) - ly * Math.sin(a), y: -120 + lx * Math.sin(a) + ly * Math.cos(a) };
const viaFn = imagePixelToScene(item, 150, px, py);
console.log('path vs fn', Math.hypot(viaPath.x - viaFn.x, viaPath.y - viaFn.y).toExponential(2));
