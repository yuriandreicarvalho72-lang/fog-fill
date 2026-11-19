import fs from 'fs';
import { PNG } from 'pngjs';
import { fogFill } from '../src/core.js';
const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
const img = { data: png.data, width: png.width, height: png.height };
const clicks = JSON.parse(process.argv[3]);
const opt = JSON.parse(process.argv[4] || '{}');
let paths = [];
for (const [x, y] of clicks) {
  const t = Date.now();
  const r = fogFill(img, x, y, opt);
  console.log('click', x, y, 'loops', r.loops.length, 'pts', r.loops.reduce((a, l) => a + l.length, 0), 'px', r.pixels, 'ms', Date.now() - t);
  paths.push(r.loops.map(l => 'M' + l.map(p => p.join(',')).join(' L') + ' Z').join(' '));
}
const b64 = fs.readFileSync(process.argv[2]).toString('base64');
fs.writeFileSync(process.argv[5], `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${png.width}" height="${png.height}"><image href="data:image/png;base64,${b64}" width="${png.width}" height="${png.height}"/>${paths.map(d => `<path d="${d}" fill="#3060ff" fill-opacity="0.55" fill-rule="evenodd" stroke="#00ffff" stroke-width="2"/>`).join('')}</svg>`);
