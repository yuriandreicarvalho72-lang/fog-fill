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

/** Contorno(s) de uma forma da obstrução: lista de { pts (mundo), closed }. Tipos: LINE, CURVE, PATH, SHAPE (retângulo, círculo). Outros: []. */
export function outlines(i) {
  if (i.type === "LINE") return [{ pts: [toWorld(i, i.startPosition), toWorld(i, i.endPosition)], closed: false }];
  if (i.type === "CURVE") return [{ pts: (i.points || []).map((p) => toWorld(i, p)), closed: !!i.style?.closed }];
  if (i.type === "PATH") { // comandos: 0 mover, 1 reta, 2 quadrática, 3 cúbica, 4 cônica, 5 fechar (curvas: só os pontos finais)
    const out = []; let cur = null;
    for (const c of i.commands || []) {
      const k = Array.isArray(c) ? c[0] : c.type ?? c.command, a = Array.isArray(c) ? c.slice(1) : null;
      if (k === 0 && a) { cur = { pts: [toWorld(i, { x: a[0], y: a[1] })], closed: false }; out.push(cur); }
      else if (cur && a && (k === 1 || k === 2 || k === 3 || k === 4)) { const n = a.length; cur.pts.push(toWorld(i, { x: a[n - 2 - (k === 4 ? 1 : 0)], y: a[n - 1 - (k === 4 ? 1 : 0)] })); }
      else if (k === 5 && cur) cur.closed = true;
    }
    return out;
  }
  if (i.type === "SHAPE") {
    const w = i.width ?? 0, h = i.height ?? 0;
    if (i.shapeType === "RECTANGLE") return [{ pts: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }].map((p) => toWorld(i, p)), closed: true }];
    if (i.shapeType === "CIRCLE") { // círculo: centro na posição, "width" é o diâmetro; 16 lados
      const r = w / 2; const pts = [];
      for (let k = 0; k < 16; k++) pts.push(toWorld(i, { x: r * Math.cos((k / 16) * 2 * Math.PI), y: r * Math.sin((k / 16) * 2 * Math.PI) }));
      return [{ pts, closed: true }];
    }
  }
  return [];
}

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
    for (const o of outlines(i)) poly(o.pts, o.closed);
  }
  return all;
}

/** Diagnóstico da obstrução do Smoke: quantos itens de cada tipo, quantos desativados e quantos de tipo desconhecido. */
export function smokeReport(items) {
  const r = { total: 0, ativos: 0, desativados: 0, porTipo: {}, naoLidos: {}, trechos: 0 };
  for (const i of items) {
    if (i?.metadata?.[SMOKE_VISION] !== true) continue;
    r.total++;
    const t = i.type === "SHAPE" ? `SHAPE/${i.shapeType}` : i.type;
    r.porTipo[t] = (r.porTipo[t] || 0) + 1;
    if (i.metadata[SMOKE_OFF] === true) { r.desativados++; continue; }
    r.ativos++;
    const o = outlines(i);
    if (!o.length) r.naoLidos[t] = (r.naoLidos[t] || 0) + 1;
  }
  r.trechos = wallSegs(items.filter((i) => i.type !== "WALL")).length;
  return r;
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
