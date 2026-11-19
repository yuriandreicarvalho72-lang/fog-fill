// Contact sheet: cada linha é um efeito, colunas são instantes do disparo. Gera um PNG para conferir no olho.
import { buildShot } from "../src/fx.js";
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("playwright"); // ferramenta local (playwright instalado à parte)
import { writeFileSync } from "fs";
const cell = 40;
const cases = [
  ["pistol", "single", true, "flesh"], ["smg", "auto", true, "flesh"], ["rifle", "burst", false, "flesh"], ["sniper", "single", true, "metal"],
  ["shotgun", "single", true, "flesh"], ["hmg", "supp", true, "ground"], ["laser", "burst", true, "metal"], ["rail", "single", true, "metal"],
  ["plasma", "single", true, "flesh"], ["tesla", "single", true, "flesh"], ["taser", "single", true, "flesh"], ["bow", "single", true, "flesh"],
  ["flame", "spray", true, "flesh"], ["cryo", "spray", true, "flesh"], ["acid", "spray", true, "flesh"], ["foam", "spray", true, "flesh"],
  ["frag", "single", true, "ground"], ["smoke", "single", true, "ground"], ["flashbang", "single", true, "ground"], ["gas", "single", true, "ground"],
  ["nanite", "single", true, "ground"], ["rocket", "single", true, "ground"], ["cannon", "single", true, "metal"], ["beanbag", "single", true, "flesh"],
];
const W = 360, H = 120, COLS = 5;
const rows = cases.map(([fx, mode, hit, kind]) => {
  const from = { x: 40, y: 70 }, to = { x: 300, y: 70 };
  const shot = buildShot({ fx, mode, hit, from, targets: [{ at: to, kind }], cell, seed: 7, smokeSec: 3 });
  const times = Array.from({ length: COLS }, (_, i) => (shot.duration * (i + 0.5)) / COLS * (fx === "smoke" ? 0.4 : 1));
  return { fx, mode, hit, dur: shot.duration, frames: times.map((t) => ({ t, ops: shot.elements.filter((e) => t >= e.t0 && t <= e.t1).map((e) => ({ kind: e.kind, p: e.frame(t) })).filter((o) => o.p) })) };
});
const html = `<canvas id=c width=${W * COLS} height=${H * rows.length}></canvas><script>
const rows = ${JSON.stringify(rows)}; const W=${W}, H=${H};
const c = document.getElementById('c').getContext('2d');
c.fillStyle = '#2c3138'; c.fillRect(0,0,${W * COLS},${H * rows.length});
const col = (h, a) => { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n>>16) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + (a ?? 1) + ')'; };
rows.forEach((r, ri) => r.frames.forEach((f, ci) => {
  c.save(); c.translate(ci*W, ri*H); c.beginPath(); c.rect(0,0,W,H); c.clip();
  c.fillStyle = '#3a4048'; c.fillRect(0,0,W,H);
  c.fillStyle = '#4c8bf5'; c.beginPath(); c.arc(40,70,16,0,7); c.fill();
  c.fillStyle = '#e05a5a'; c.beginPath(); c.arc(300,70,16,0,7); c.fill();
  for (const o of f.ops) { const p = o.p;
    if (o.kind === 'line') { c.strokeStyle = col(p.color, p.opacity); c.lineWidth = p.width; c.lineCap='round'; c.beginPath(); c.moveTo(p.a.x,p.a.y); c.lineTo(p.b.x,p.b.y); c.stroke(); }
    if (o.kind === 'circle') { c.beginPath(); c.arc(p.c.x,p.c.y,Math.max(0.5,p.r),0,7); if (p.fill && p.fillOpacity>0) { c.fillStyle = col(p.fill, p.fillOpacity); c.fill(); } if (p.stroke && p.strokeOpacity>0) { c.strokeStyle = col(p.stroke, p.strokeOpacity); c.lineWidth = p.strokeWidth||1; c.stroke(); } }
    if (o.kind === 'path') { c.beginPath(); p.pts.forEach((q,i)=> i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y)); if (p.closed) c.closePath(); c.setLineDash(p.dash||[]); if (p.fill && p.fillOpacity>0) { c.fillStyle = col(p.fill, p.fillOpacity); c.fill(); } if (p.stroke && p.strokeOpacity>0) { c.strokeStyle = col(p.stroke, p.strokeOpacity); c.lineWidth = p.strokeWidth||1; c.stroke(); } c.setLineDash([]); }
  }
  c.fillStyle = '#fff'; c.font = '12px sans-serif'; c.fillText(r.fx + ' · ' + r.mode + (r.hit?'':' (erro)') + '  t=' + f.t.toFixed(2) + 's / ' + r.dur.toFixed(1), 6, 14);
  c.restore();
}));
</script>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W * COLS, height: H * rows.length } });
await p.setContent(html); await p.screenshot({ path: process.argv[2] || "sheet.png", fullPage: true }); await b.close();
console.log(rows.map((r) => `${r.fx}/${r.mode}: ${r.dur.toFixed(2)}s, até ${Math.max(...r.frames.map((f) => f.ops.length))} elementos`).join("\n"));
