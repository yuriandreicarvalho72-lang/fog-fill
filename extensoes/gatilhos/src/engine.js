// Motor dos Gatilhos: geometria das zonas e avaliação das causas. Funções puras, testáveis em Node.

const rad = (d) => (d * Math.PI) / 180;
function tf(item, p) {
  const sx = item.scale?.x ?? 1, sy = item.scale?.y ?? 1, a = rad(item.rotation ?? 0);
  const x = p.x * sx, y = p.y * sy;
  return { x: item.position.x + x * Math.cos(a) - y * Math.sin(a), y: item.position.y + x * Math.sin(a) + y * Math.cos(a) };
}

/**
 * Forma de uma zona no mundo.
 * { kind: "poly", pts } para áreas; { kind: "line", pts } para fios (linha/caminho aberto: dispara ao ser cruzado).
 */
export function zoneShape(item, sceneDpi = 150) {
  if (item.type === "IMAGE") {
    const k = sceneDpi / (item.grid?.dpi || sceneDpi);
    const w = item.image.width * k, h = item.image.height * k;
    const ox = (item.grid?.offset?.x ?? 0) * k, oy = (item.grid?.offset?.y ?? 0) * k;
    return { kind: "poly", pts: [{ x: -ox, y: -oy }, { x: w - ox, y: -oy }, { x: w - ox, y: h - oy }, { x: -ox, y: h - oy }].map((p) => tf(item, p)) };
  }
  if (item.type === "SHAPE") {
    const w = item.width, h = item.height;
    let pts;
    if (item.shapeType === "CIRCLE") pts = Array.from({ length: 32 }, (_, i) => ({ x: (w / 2) * Math.cos((i / 32) * 2 * Math.PI), y: (h / 2) * Math.sin((i / 32) * 2 * Math.PI) }));
    else if (item.shapeType === "TRIANGLE") pts = [{ x: 0, y: 0 }, { x: w / 2, y: h }, { x: -w / 2, y: h }];
    else if (item.shapeType === "HEXAGON") pts = Array.from({ length: 6 }, (_, i) => ({ x: (w / 2) * Math.cos((i / 6) * 2 * Math.PI), y: (h / 2) * Math.sin((i / 6) * 2 * Math.PI) }));
    else pts = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    return { kind: "poly", pts: pts.map((p) => tf(item, p)) };
  }
  if (item.type === "LINE") return { kind: "line", pts: [tf(item, item.startPosition), tf(item, item.endPosition)] };
  if (item.type === "CURVE") {
    const pts = (item.points || []).map((p) => tf(item, p));
    return { kind: item.style?.closed ? "poly" : "line", pts };
  }
  if (item.type === "PATH") {
    const pts = (item.commands || []).filter((c) => c[0] === 0 || c[0] === 1).map((c) => tf(item, { x: c[1], y: c[2] }));
    const closed = (item.commands || []).some((c) => c[0] === 5);
    return { kind: closed ? "poly" : "line", pts };
  }
  // qualquer outro item: um quadrado em volta da posição
  const h = sceneDpi / 2, c = item.position;
  return { kind: "poly", pts: [{ x: c.x - h, y: c.y - h }, { x: c.x + h, y: c.y - h }, { x: c.x + h, y: c.y + h }, { x: c.x - h, y: c.y + h }] };
}

export function inPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function segHit(p, q, a, b) {
  const rx = q.x - p.x, ry = q.y - p.y, sx = b.x - a.x, sy = b.y - a.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const ax = a.x - p.x, ay = a.y - p.y;
  const t = (ax * sy - ay * sx) / den, u = (ax * ry - ay * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** Primeiro ponto em que o trajeto p→q toca a zona (null se não toca). */
export function firstContact(p, q, shape) {
  if (shape.kind === "poly" && inPoly(p, shape.pts)) return { t: 0, at: p };
  let best = null;
  const n = shape.pts.length, closed = shape.kind === "poly";
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const t = segHit(p, q, shape.pts[i], shape.pts[(i + 1) % n]);
    if (t !== null && (best === null || t < best)) best = t;
  }
  if (best === null) return shape.kind === "poly" && inPoly(q, shape.pts) ? { t: 1, at: q } : null;
  return { t: best, at: { x: p.x + (q.x - p.x) * best, y: p.y + (q.y - p.y) * best } };
}

export const insideZone = (p, shape) => shape.kind === "poly" && inPoly(p, shape.pts);

export function center(shape) {
  const n = shape.pts.length || 1;
  return { x: shape.pts.reduce((a, p) => a + p.x, 0) / n, y: shape.pts.reduce((a, p) => a + p.y, 0) / n };
}

/**
 * Avalia um gatilho depois de um lote de movimentos.
 * moves: [{ token, from, to }] (só tokens que se mexeram e que podem disparar este gatilho)
 * tokens: todos os tokens que podem disparar (para "ficar em todas")
 * zones: Map(zoneId -> shape)
 * state: { allWasOn } memória do gatilho entre avaliações
 * Devolve { fire: bool, by: token|null, at: ponto de entrada|null }
 */
export function evaluate(trigger, moves, tokens, zones, state, cellSize) {
  const shapes = trigger.zones.map((id) => zones.get(id)).filter(Boolean);
  if (!shapes.length) return { fire: false };
  const c = trigger.cause;
  if (c === "enter") {
    let best = null;
    for (const m of moves) for (const s of shapes) {
      const wasIn = insideZone(m.from, s);
      if (wasIn) continue;
      const hit = firstContact(m.from, m.to, s);
      if (hit && (!best || hit.t < best.hit.t)) best = { m, hit };
    }
    return best ? { fire: true, by: best.m.token, at: best.hit.at, from: best.m.from } : { fire: false };
  }
  if (c === "leave") {
    for (const m of moves) for (const s of shapes) {
      if (s.kind !== "poly") continue;
      if (insideZone(m.from, s) && !insideZone(m.to, s)) return { fire: true, by: m.token, at: m.to, from: m.from };
    }
    return { fire: false };
  }
  if (c === "near") {
    const r = (trigger.radius ?? 2) * cellSize;
    for (const m of moves) for (const s of shapes) {
      const z = center(s);
      const before = Math.hypot(m.from.x - z.x, m.from.y - z.y), after = Math.hypot(m.to.x - z.x, m.to.y - z.y);
      if (before > r && after <= r) return { fire: true, by: m.token, at: m.to, from: m.from };
    }
    return { fire: false };
  }
  if (c === "standAll") {
    // cada zona com pelo menos um token em cima, ao mesmo tempo (placas de pressão)
    const on = shapes.every((s) => tokens.some((t) => insideZone(t.position, s)));
    const fire = on && !state.allWasOn;
    state.allWasOn = on;
    const by = moves[0]?.token || null;
    return { fire, by, at: by?.position || null };
  }
  return { fire: false };
}
