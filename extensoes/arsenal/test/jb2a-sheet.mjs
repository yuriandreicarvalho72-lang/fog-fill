// Confere a geometria dos vídeos JB2A: monta disparos reais (buildShotJB2A), coloca cada vídeo como o Owlbear
// coloca uma imagem (posição, rotação, dpi, offset), toca em tempo real no Chromium e tira fotos.
// Uso: npm run jb2a && node test/jb2a-sheet.mjs saida.png   (precisa do Playwright e de um servidor na pasta)
import { buildShotJB2A } from "../src/jb2a.js";
import { createRequire } from "module";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "jb2a");

const G = 64; // px por quadrado na foto
const A = { x: 1.5 * G, y: 2.5 * G }, B = { x: 9.5 * G, y: 2.5 * G }, C = { x: 9.5 * G, y: 4.5 * G };
const cases = [
  ["pistol", "single", "flesh"], ["smg", "burst", "flesh"], ["shotgun", "single", "metal"], ["sniper", "single", "flesh"],
  ["laser", "single", "metal"], ["plasma", "single", "flesh"], ["rail", "single", "metal"], ["tesla", "single", "flesh", true],
  ["bow", "single", "flesh"], ["flame", "spray", "flesh"], ["acid", "spray", "flesh"], ["cryo", "spray", "flesh"],
  ["frag", "single", "ground"], ["smoke", "single", "ground"], ["gas", "single", "ground"], ["rocket", "single", "ground"],
  ["cannon", "single", "metal"], ["grenade", "single", "ground"], ["taser", "single", "flesh"], ["hmg", "auto", "ground"],
];
const shots = cases.map(([fx, mode, kind, two]) => {
  const targets = [{ at: B, kind }, ...(two ? [{ at: C, kind }] : [])];
  const s = buildShotJB2A({ fx, mode, from: A, targets, cell: G, seed: 5, hit: true, smokeSec: 6 });
  return { fx, mode, videos: s.videos, duration: s.duration };
});
const FR = [0.15, 0.35, 0.6, 0.9];

const html = `<!doctype html><body style="margin:0;background:#1d2024;font:12px sans-serif;color:#fff">
<div id=w style="position:relative;width:${12 * G}px;height:${6 * G}px;overflow:hidden;background:#3a4048;
background-image:linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px);background-size:${G}px ${G}px">
<div style="position:absolute;left:${A.x - G / 2}px;top:${A.y - G / 2}px;width:${G}px;height:${G}px;border-radius:50%;background:#4c8bf5"></div>
<div style="position:absolute;left:${B.x - G / 2}px;top:${B.y - G / 2}px;width:${G}px;height:${G}px;border-radius:50%;background:#e05a5a"></div>
<div id=c2 style="position:absolute;left:${C.x - G / 2}px;top:${C.y - G / 2}px;width:${G}px;height:${G}px;border-radius:50%;background:#e09a5a;display:none"></div>
<div id=lbl style="position:absolute;left:4px;top:2px"></div></div>
<script>
window.run = (shot) => new Promise((done) => {
  const w = document.getElementById('w'); w.querySelectorAll('video').forEach(v => v.remove());
  document.getElementById('c2').style.display = shot.fx === 'tesla' ? 'block' : 'none';
  const t0 = performance.now();
  for (const v of shot.videos) setTimeout(() => {
    const k = ${G} / v.dpi, el = document.createElement('video');
    el.src = '/' + v.file; el.muted = true; el.autoplay = true; el.loop = true;
    Object.assign(el.style, { position: 'absolute', left: (v.position.x - v.offset.x * k) + 'px', top: (v.position.y - v.offset.y * k) + 'px',
      width: v.w * k + 'px', height: v.h * k + 'px', transformOrigin: (v.offset.x * k) + 'px ' + (v.offset.y * k) + 'px', transform: 'rotate(' + v.rotation + 'deg)' });
    w.appendChild(el); setTimeout(() => el.remove(), v.dur * 1000);
  }, v.t0 * 1000);
  done();
});
</script></body>`;

const srv = createServer(async (req, res) => {
  if (req.url === "/") { res.setHeader("content-type", "text/html"); return res.end(html); }
  try { res.setHeader("content-type", "video/webm"); res.end(await readFile(join(ROOT, decodeURI(req.url)))); } catch { res.statusCode = 404; res.end(); }
}).listen(8123);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 12 * G, height: 6 * G } });
await p.goto("http://127.0.0.1:8123/");
// pré-carrega todos os vídeos
await p.evaluate(async (files) => { await Promise.all(files.map((f) => fetch('/' + f).then((r) => r.blob()))); }, [...new Set(shots.flatMap((s) => s.videos.map((v) => v.file)))]);
const pngs = [];
for (const s of shots) {
  await p.evaluate((x) => { document.getElementById('lbl').textContent = x.fx + ' · ' + x.mode; return window.run(x); }, s);
  let last = 0;
  for (const f of FR) {
    const at = s.duration * f * 1000; await p.waitForTimeout(Math.max(0, at - last)); last = at;
    pngs.push({ fx: s.fx, t: (at / 1000).toFixed(2), img: (await p.screenshot()).toString("base64") });
  }
  await p.waitForTimeout(Math.max(0, s.duration * 1000 - last + 100));
}
const sheet = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${FR.length},${12 * G / 2}px);gap:4px">${pngs.map((x) => `<div style="position:relative"><img src="data:image/png;base64,${x.img}" style="width:${12 * G / 2}px"><span style="position:absolute;right:4px;bottom:2px;color:#ff0;font:11px sans-serif">${x.t}s</span></div>`).join("")}</body>`;
await p.setViewportSize({ width: FR.length * (12 * G / 2 + 4), height: 600 });
await p.setContent(sheet); await p.waitForTimeout(300);
await p.screenshot({ path: process.argv[2] || "jb2a-sheet.png", fullPage: true });
await b.close(); srv.close();
console.log(shots.map((s) => `${s.fx}/${s.mode}: ${s.videos.length} vídeos, ${s.duration.toFixed(2)}s`).join("\n"));
