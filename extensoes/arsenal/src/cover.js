// Cobertura entre o atirador e o alvo (sem SDK, testado em Node).
// Obstáculos: paredes da névoa dinâmica do Owlbear (itens WALL que bloqueiam), linhas de visão do Smoke & Spectre
// e itens marcados no Arsenal como cobertura (meia, três quartos ou total).

export const COVER = "arsenal/cobertura"; // metadado do item: "meia" | "tres" | "total"
export const LEVELS = ["none", "half", "three", "total"];
const FROM_MARK = { meia: "half", tres: "three", total: "total" };
export const MARKS = [["meia", "meia"], ["tres", "três quartos"], ["total", "total"]];
export const DEFAULT_RULES = { half: 2, three: 5 }; // bônus de defesa (d20)

/** Texto da cobertura (com o bônus de defesa do d20). */
export function coverText(key, rules = DEFAULT_RULES) {
  const r = { ...DEFAULT_RULES, ...(rules || {}) };
  if (key === "half") return `meia cobertura (+${r.half} defesa)`;
  if (key === "three") return `três quartos (+${r.three} defesa)`;
  if (key === "total") return "cobertura total (sem linha de tiro)";
  return "sem cobertura";
}
export const COVER_SHORT = { none: "sem cob.", half: "meia", three: "¾", total: "total" };

const rad = (d) => (d * Math.PI) / 180;
function toWorld(item, p) {
  const sx = item.scale?.x ?? 1, sy = item.scale?.y ?? 1, a = rad(item.rotation ?? 0);
  const x = p.x * sx, y = p.y * sy;
  return { x: item.position.x + x * Math.cos(a) - y * Math.sin(a), y: item.position.y + x * Math.sin(a) + y * Math.cos(a) };
}
const segsOf = (pts, closed) => {
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1], b: pts[i] });
  if (closed && pts.length > 2) out.push({ a: pts[pts.length - 1], b: pts[0] });
  return out;
};

/** Contorno de um item (para cobertura): imagem = retângulo do tamanho dela; formas, linhas e desenhos = o próprio contorno. */
export function outline(item, dpi) {
  if (item.type === "WALL" || item.type === "CURVE") return segsOf((item.points || []).map((p) => toWorld(item, p)), item.type === "CURVE" ? item.style?.closed !== false : false);
  if (item.type === "LINE") return [{ a: toWorld(item, item.startPosition), b: toWorld(item, item.endPosition) }];
  if (item.type === "SHAPE") {
    const w = item.width, h = item.height;
    const pts = item.shapeType === "CIRCLE"
      ? Array.from({ length: 16 }, (_, i) => ({ x: (w / 2) * Math.cos((i / 16) * 2 * Math.PI), y: (h / 2) * Math.sin((i / 16) * 2 * Math.PI) }))
      : [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    return segsOf(pts.map((p) => toWorld(item, p)), true);
  }
  if (item.type === "IMAGE" && item.image) {
    const g = item.grid || {};
    const k = dpi / (g.dpi || item.image.width || dpi);
    const ox = (g.offset?.x ?? item.image.width / 2) * k, oy = (g.offset?.y ?? item.image.height / 2) * k;
    const w = item.image.width * k, h = item.image.height * k;
    return segsOf([{ x: -ox, y: -oy }, { x: w - ox, y: -oy }, { x: w - ox, y: h - oy }, { x: -ox, y: h - oy }].map((p) => toWorld(item, p)), true);
  }
  return [];
}

/** Junta os obstáculos: { walls: [trecho], covers: [{ id, level, segs }] }. */
export function obstaclesFrom(items, dpi) {
  const walls = [], covers = [];
  for (const it of items) {
    if (it.type === "WALL" && it.blocking !== false) { walls.push(...outline(it, dpi)); continue; }
    if (it.metadata?.["com.battle-system.smoke/isVisionLine"] === true && it.metadata?.["com.battle-system.smoke/disabled"] !== true) { walls.push(...outline(it, dpi)); continue; }
    const level = FROM_MARK[it.metadata?.[COVER]];
    if (level && it.visible !== false) covers.push({ id: it.id, level, segs: outline(it, dpi) });
  }
  return { walls, covers };
}

function crosses(p, q, s) {
  const rx = q.x - p.x, ry = q.y - p.y, sx = s.b.x - s.a.x, sy = s.b.y - s.a.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return false;
  const ax = s.a.x - p.x, ay = s.a.y - p.y;
  const t = (ax * sy - ay * sx) / den, u = (ax * ry - ay * rx) / den;
  return t > 1e-6 && t < 1 - 1e-6 && u >= 0 && u <= 1;
}
const blockedBy = (p, q, segs) => segs.some((s) => crosses(p, q, s));

/**
 * Cobertura do alvo visto do atirador. from: centro do atirador; to: centro do alvo; half: meio tamanho do alvo
 * (0 para um ponto no mapa). Traça 5 linhas (centro e 4 cantos):
 * paredes bloqueiam 1-2 linhas = meia, 3-4 = três quartos, todas = total.
 * Item marcado como cobertura no caminho do centro = pelo menos o nível dele. Vale o maior.
 */
export function coverBetween(from, to, half, obs, ignore = []) {
  const h = half * 0.8;
  const pts = h > 0 ? [to, { x: to.x - h, y: to.y - h }, { x: to.x + h, y: to.y - h }, { x: to.x + h, y: to.y + h }, { x: to.x - h, y: to.y + h }] : [to];
  const k = pts.filter((p) => blockedBy(from, p, obs.walls)).length;
  let wall = "none";
  if (k === pts.length) wall = "total";
  else if (k >= 3) wall = "three";
  else if (k > 0) wall = "half";
  let item = "none", by = null;
  for (const c of obs.covers) {
    if (ignore.includes(c.id)) continue;
    if (blockedBy(from, to, c.segs) && LEVELS.indexOf(c.level) > LEVELS.indexOf(item)) { item = c.level; by = c.id; }
  }
  const key = LEVELS.indexOf(item) > LEVELS.indexOf(wall) ? item : wall;
  return { key, by: key === "none" ? null : key === item && item !== "none" ? by : "parede", blockedLines: k, lines: pts.length };
}

/** Meio tamanho de um token (para os cantos). */
export function halfSize(item, dpi) {
  if (!item?.image) return 0;
  const k = dpi / (item.grid?.dpi || item.image.width || dpi);
  return (Math.min(item.image.width, item.image.height) * k * Math.abs(item.scale?.x ?? 1)) / 2;
}
