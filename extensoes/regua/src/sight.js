// Visão e cobertura (geometria pura, testável em Node).
// Raios saem do ponto de origem e vão até os 4 cantos do quadrado alvo (regra de cobertura do D&D 5e):
// cantos visíveis 4/3 = sem cobertura, 2 = meia, 1 = três quartos, 0 = total.
// Cobertura parcial (móveis, criaturas...) tem "solidez" 0..1: um raio que a atravessa vale 1 - solidez.

/** Interseção do raio p->q com o segmento a->b. Devolve t (0..1 ao longo do raio) ou null. */
export function raySeg(p, q, a, b) {
  const rx = q.x - p.x, ry = q.y - p.y, sx = b.x - a.x, sy = b.y - a.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const ax = a.x - p.x, ay = a.y - p.y;
  const t = (ax * sy - ay * sx) / den;
  const u = (ax * ry - ay * rx) / den;
  // pontas do raio não contam (parede que encosta no canto do quadrado não bloqueia o canto)
  if (t <= 1e-4 || t >= 1 - 1e-4 || u < 0 || u > 1) return null;
  return t;
}

/** Interseção do raio com um círculo (criatura como cobertura). */
export function rayCircle(p, q, c, r) {
  const dx = q.x - p.x, dy = q.y - p.y, fx = p.x - c.x, fy = p.y - c.y;
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0 || A === 0) return null;
  const s = Math.sqrt(disc), t1 = (-B - s) / (2 * A), t2 = (-B + s) / (2 * A);
  if (t1 > 1e-4 && t1 < 1 - 1e-4) return t1;
  if (t2 > 1e-4 && t2 < 1 - 1e-4) return t2;
  return null;
}

/**
 * @param obstacles { walls: [{a,b}], partial: [{a,b,s}], circles: [{c,r,s,id}] }
 * @returns { t: onde parou (1 = chegou), solidity: 0..1, hit: ponto }
 */
export function castRay(p, q, obstacles, ignoreIds = []) {
  let wallT = 1;
  for (const w of obstacles.walls) {
    const t = raySeg(p, q, w.a, w.b);
    if (t !== null && t < wallT) wallT = t;
  }
  let sol = 0;
  for (const w of obstacles.partial) {
    const t = raySeg(p, q, w.a, w.b);
    if (t !== null && t < wallT && w.s > sol) sol = w.s;
  }
  for (const c of obstacles.circles) {
    if (ignoreIds.includes(c.id)) continue;
    const t = rayCircle(p, q, c.c, c.r);
    if (t !== null && t < wallT && c.s > sol) sol = c.s;
  }
  const blocked = wallT < 1;
  const hit = { x: p.x + (q.x - p.x) * wallT, y: p.y + (q.y - p.y) * wallT };
  return { t: wallT, solidity: blocked ? 1 : sol, hit };
}

export const COVER = [
  { key: "total", label: "Cobertura total (sem linha de visão)", short: "Total", color: "#e05252" },
  { key: "3/4", label: "Cobertura ¾ (+5 CA e Des)", short: "¾", color: "#e0903a" },
  { key: "half", label: "Meia cobertura (+2 CA e Des)", short: "½", color: "#e0cc3a" },
  { key: "none", label: "Sem cobertura", short: "Livre", color: "#5fd35f" },
];

/** Quantos "cantos" chegam (com cobertura parcial descontada) → categoria. */
export function coverFromScore(score, rays) {
  const k = rays === 1 ? score * 4 : score; // modo "só o centro" vale por 4
  const n = Math.floor(k + 1e-6);
  if (n <= 0) return COVER[0];
  if (n === 1) return COVER[1];
  if (n === 2) return COVER[2];
  return COVER[3];
}

/**
 * Checa a visibilidade de um alvo.
 * @param {{x,y}} src origem
 * @param {{x,y}} center centro do quadrado alvo
 * @param {number} dpi
 * @param {"corners"|"center"} to
 */
export function checkTarget(src, center, dpi, obstacles, to = "corners", ignoreIds = []) {
  const h = dpi / 2;
  const targets = to === "center" ? [center] : [
    { x: center.x - h, y: center.y - h }, { x: center.x + h, y: center.y - h },
    { x: center.x + h, y: center.y + h }, { x: center.x - h, y: center.y + h },
  ];
  let score = 0;
  const rays = targets.map((q) => {
    const r = castRay(src, q, obstacles, ignoreIds);
    score += 1 - r.solidity;
    return { from: src, to: q, hit: r.hit, solidity: r.solidity };
  });
  return { rays, score, cover: coverFromScore(score, targets.length), cell: targets.length === 4 ? targets : null };
}
