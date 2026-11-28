// Paredes que bloqueiam a luz (puro, sem SDK: testado em Node).
// Dynamic Fog (WALL, bloqueando) e, se ligado, linhas de visão do Smoke & Spectre (CURVE/LINE com isVisionLine).
// Porta do Smoke aberta fica "disabled" e deixa a luz passar.
export const SMOKE_VISION = "com.battle-system.smoke/isVisionLine";
export const SMOKE_OFF = "com.battle-system.smoke/disabled";

const rad = (deg) => (deg * Math.PI) / 180;

export function toWorld(item, p) {
  const sx = item.scale?.x ?? 1, sy = item.scale?.y ?? 1;
  const a = rad(item.rotation ?? 0);
  const x = p.x * sx, y = p.y * sy;
  return { x: item.position.x + x * Math.cos(a) - y * Math.sin(a), y: item.position.y + x * Math.sin(a) + y * Math.cos(a) };
}

// simplificação de polilinha (menos trechos = shader mais leve)
export function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [i0, i1] = st.pop(); const a = pts[i0], b = pts[i1];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    let md = -1, mi = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; st.push([i0, mi], [mi, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function segDist(px, py, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / L2));
  return Math.hypot(px - (s.ax + t * dx), py - (s.ay + t * dy));
}

/** Uma linha de visão do Smoke & Spectre que está valendo (não desativada, nem porta aberta)? */
export const isSmokeWall = (i) => i?.metadata?.[SMOKE_VISION] === true && i.metadata[SMOKE_OFF] !== true;

/** Todos os trechos { ax, ay, bx, by } que bloqueiam a luz, a partir dos itens locais e da cena. */
export function wallSegs(items, { smoke = true } = {}) {
  const all = [];
  const poly = (pts, closed) => {
    const p = rdp(pts, 3);
    for (let k = 0; k < p.length - 1; k++) all.push({ ax: p[k].x, ay: p[k].y, bx: p[k + 1].x, by: p[k + 1].y });
    if (closed && p.length > 2) all.push({ ax: p[p.length - 1].x, ay: p[p.length - 1].y, bx: p[0].x, by: p[0].y });
  };
  for (const i of items) {
    if (i.type === "WALL") { if (i.blocking !== false) poly((i.points || []).map((p) => toWorld(i, p)), false); continue; }
    if (!smoke || !isSmokeWall(i)) continue;
    if (i.type === "CURVE") poly((i.points || []).map((p) => toWorld(i, p)), !!i.style?.closed);
    else if (i.type === "LINE") poly([toWorld(i, i.startPosition), toWorld(i, i.endPosition)], false);
  }
  return all;
}

/** Os trechos mais próximos das luzes (as que o raio alcança), no máximo "max". */
export function nearest(all, lights, max) {
  const scored = [];
  for (const s of all) {
    let best = Infinity;
    for (const l of lights) {
      const d = segDist(l.x, l.y, s);
      if (d < l.radius) best = Math.min(best, d / l.radius);
    }
    if (best < Infinity) scored.push([best, s]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, Math.max(0, max)).map(([, s]) => s);
}
