// node test/sweep.mjs mapa.png '[[x,y]]' saida.png [tolerância] → fog (vermelho) por varredura do vazio
import fs from 'fs';
import { PNG } from 'pngjs';
import { sweepVoid } from '../src/core.js';
const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
const img = { data: png.data, width: png.width, height: png.height };
const { width: w, height: h } = img;
const [[x, y]] = JSON.parse(process.argv[3]);
const t = Date.now();
const cell = Number(process.argv[6] || 40);
const r = sweepVoid(img, x, y, { tolerance: Number(process.argv[5] || 22), minIsland: cell * cell * 1.5, minHole: cell * cell * 0.5 });
console.log('laços', r.loops.length, 'pontos', r.loops.reduce((a, l) => a + l.length, 0), 'fog', (100 * r.pixels / (w * h)).toFixed(1) + '%', 'ms', Date.now() - t);
for (let p = 0; p < w * h; p++) if (r.mask[p]) { const i = p * 4; png.data[i] = png.data[i] * 0.3 + 180; png.data[i + 1] *= 0.3; png.data[i + 2] *= 0.3; }
fs.writeFileSync(process.argv[4], PNG.sync.write(png));
