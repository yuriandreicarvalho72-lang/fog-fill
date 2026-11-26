// Geometria da Régua: distâncias, encaixe na grade e formas de área (D&D).
// Funções puras, sem OBR, testáveis em Node. Unidades: coordenadas de cena; dpi = lado de um quadrado.

/** Encaixe relativo: mantém o alinhamento de quem começou (token 1x1 no centro, 2x2 na quina etc.). */
export function snapRelative(p, origin, dpi) {
  return {
    x: origin.x + Math.round((p.x - origin.x) / dpi) * dpi,
    y: origin.y + Math.round((p.y - origin.y) / dpi) * dpi,
  };
}
/** Centro do quadrado mais próximo. */
export function snapCenter(p, dpi) {
  return { x: (Math.floor(p.x / dpi) + 0.5) * dpi, y: (Math.floor(p.y / dpi) + 0.5) * dpi };
}
/** Quina (interseção da grade) mais próxima. */
export function snapCorner(p, dpi) {
  return { x: Math.round(p.x / dpi) * dpi, y: Math.round(p.y / dpi) * dpi };
}

/**
 * Distância de um caminho em quadrados, numa grade quadrada.
 * ALTERNATING (5-10-5) conta as diagonais no caminho inteiro, não por trecho.
 */
export function pathCells(points, dpi, measurement) {
  let straight = 0, diag = 0, euclid = 0, cheb = 0, manh = 0;
  for (let i = 1; i < points.length; i++) {
    const dxw = points[i].x - points[i - 1].x, dyw = points[i].y - points[i - 1].y;
    euclid += Math.hypot(dxw, dyw) / dpi;
    const dx = Math.abs(Math.round(dxw / dpi)), dy = Math.abs(Math.round(dyw / dpi));
    cheb += Math.max(dx, dy);
    manh += dx + dy;
    diag += Math.min(dx, dy);
    straight += Math.max(dx, dy) - Math.min(dx, dy);
  }
  switch (measurement) {
    case "ALTERNATING": return straight + diag + Math.floor(diag / 2);
    case "EUCLIDEAN": return euclid;
    case "MANHATTAN": return manh;
    default: return cheb; // CHEBYSHEV
  }
}

/** Texto da distância conforme a escala da grade ("5ft", "1.5m" ...). */
export function formatDistance(cells, scale) {
  const mult = scale?.parsed?.multiplier ?? 5;
  const unit = scale?.parsed?.unit ?? "ft";
  const digits = scale?.parsed?.digits ?? 0;
  const v = cells * mult;
  const txt = digits > 0 ? v.toFixed(digits) : Number.isInteger(Math.round(v * 1000) / 1000) ? String(Math.round(v)) : v.toFixed(1);
  return `${txt.replace(".", ",")} ${unit}`.trim();
}

// ---------------- Formas de área ----------------
// Cada forma devolve { poly: [{x,y}], label, size (em quadrados) }.

function circlePoly(c, r, n = 72) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return out;
}

/**
 * @param {"circle"|"cone"|"cube"|"square"|"line"} kind
 * @param {{x,y}} o origem (já encaixada)
 * @param {{x,y}} p ponteiro
 * @param {number} dpi
 * @param {object} opt { snap: bool, lineWidth: quadrados }
 */
export function areaShape(kind, o, p, dpi, opt = {}) {
  const snap = opt.snap ?? true;
  const q = (v) => (snap ? Math.max(0, Math.round(v)) : Math.max(0, v)); // tamanho em quadrados
  const dx = p.x - o.x, dy = p.y - o.y;
  const dist = Math.hypot(dx, dy) / dpi;
  const ang = Math.atan2(dy, dx);
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };
  const per = { x: -dir.y, y: dir.x };

  if (kind === "circle") {
    const r = q(dist);
    return { poly: r > 0 ? circlePoly(o, r * dpi) : [], size: r, label: "raio" };
  }
  if (kind === "cone") {
    // D&D 5e: a largura do cone, na ponta, é igual ao comprimento
    const L = q(dist), Lw = L * dpi;
    const end = { x: o.x + dir.x * Lw, y: o.y + dir.y * Lw };
    return {
      poly: L > 0 ? [o, { x: end.x + per.x * Lw / 2, y: end.y + per.y * Lw / 2 }, { x: end.x - per.x * Lw / 2, y: end.y - per.y * Lw / 2 }] : [],
      size: L, label: "cone",
    };
  }
  if (kind === "line") {
    const L = q(dist), Lw = L * dpi, hw = ((opt.lineWidth ?? 1) * dpi) / 2;
    const end = { x: o.x + dir.x * Lw, y: o.y + dir.y * Lw };
    return {
      poly: L > 0 ? [
        { x: o.x + per.x * hw, y: o.y + per.y * hw }, { x: end.x + per.x * hw, y: end.y + per.y * hw },
        { x: end.x - per.x * hw, y: end.y - per.y * hw }, { x: o.x - per.x * hw, y: o.y - per.y * hw },
      ] : [],
      size: L, label: "linha",
    };
  }
  if (kind === "cube") {
    // cubo a partir de uma quina: o lado é o maior dos dois eixos, na direção do ponteiro
    const s = q(Math.max(Math.abs(dx), Math.abs(dy)) / dpi), S = s * dpi;
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    const x0 = o.x, y0 = o.y, x1 = o.x + sx * S, y1 = o.y + sy * S;
    return { poly: s > 0 ? [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] : [], size: s, label: "cubo" };
  }
  // "square": quadrado centrado (aura / emanação): raio r em quadrados a partir do quadrado do centro
  const r = q(Math.max(Math.abs(dx), Math.abs(dy)) / dpi);
  const h = (r + 0.5) * dpi;
  return {
    poly: [{ x: o.x - h, y: o.y - h }, { x: o.x + h, y: o.y - h }, { x: o.x + h, y: o.y + h }, { x: o.x - h, y: o.y + h }],
    size: r, label: "quadrado",
  };
}

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// amostras dentro de um quadrado (0..1), para as regras "metade" e "qualquer toque"
const N = 6;
const SAMPLES = [];
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) SAMPLES.push([(i + 0.5) / N, (j + 0.5) / N]);
const EDGE = [];
for (let i = 0; i <= N; i++) for (const [a, b] of [[i / N, 0.02], [i / N, 0.98], [0.02, i / N], [0.98, i / N]]) EDGE.push([a, b]);

/**
 * Quadrados atingidos pela forma.
 * rule "center": o centro do quadrado está dentro (padrão de VTTs como o Foundry)
 * rule "half": pelo menos metade do quadrado está coberta (Xanathar / DMG opcional)
 * rule "touch": qualquer parte do quadrado é tocada
 */
export function affectedCells(poly, dpi, rule = "center", maxCells = 4000) {
  if (poly.length < 3) return [];
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  const c0 = Math.floor(Math.min(...xs) / dpi), c1 = Math.floor((Math.max(...xs) - 1e-6) / dpi);
  const r0 = Math.floor(Math.min(...ys) / dpi), r1 = Math.floor((Math.max(...ys) - 1e-6) / dpi);
  const out = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    let hit;
    if (rule === "half" || rule === "touch") {
      let n = 0;
      for (const [u, v] of SAMPLES) if (pointInPoly({ x: (c + u) * dpi, y: (r + v) * dpi }, poly)) n++;
      if (rule === "half") hit = n >= SAMPLES.length / 2;
      else hit = n > 0 || EDGE.some(([u, v]) => pointInPoly({ x: (c + u) * dpi, y: (r + v) * dpi }, poly));
    } else {
      hit = pointInPoly({ x: (c + 0.5) * dpi, y: (r + 0.5) * dpi }, poly);
    }
    if (hit) {
      out.push({ c, r });
      if (out.length >= maxCells) return out;
    }
  }
  return out;
}

/** Comandos de Path para um polígono fechado. */
export function polyToCommands(poly) {
  if (poly.length < 3) return [];
  return [[0, poly[0].x, poly[0].y], ...poly.slice(1).map((p) => [1, p.x, p.y]), [5]];
}

/** Pequenos círculos (para marcar os pontos do caminho) como comandos de Path. */
export function dotsToCommands(points, radius, n = 16) {
  const cmds = [];
  for (const p of points) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      cmds.push([i === 0 ? 0 : 1, p.x + radius * Math.cos(a), p.y + radius * Math.sin(a)]);
    }
    cmds.push([5]);
  }
  return cmds;
}

/** Elipse como comandos de Path (4 curvas cúbicas): 0=MOVE 4=CUBIC 5=CLOSE. */
export function ellipseCommands(cx, cy, rx, ry) {
  const k = 0.5522847498;
  return [
    [0, cx + rx, cy],
    [4, cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry],
    [4, cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy],
    [4, cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry],
    [4, cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy],
    [5],
  ];
}

/** Largura e altura (em pixels do mapa) que um token ocupa na grade atual. */
export function tokenSizePx(item, dpi) {
  const g = item?.grid?.dpi || dpi;
  const w = (item?.image?.width ?? dpi) * Math.abs(item?.scale?.x ?? 1) * (dpi / g);
  const h = (item?.image?.height ?? dpi) * Math.abs(item?.scale?.y ?? 1) * (dpi / g);
  return { w, h };
}

/** Aparência do token "levantado" (sombra no chão + token subindo) ou "pousado". */
export function liftLook(token, at, dpi, lifted) {
  const { w, h } = tokenSizePx(token, dpi);
  const base = Math.min(w, h);
  const up = lifted ? base * 0.2 : 0;
  return {
    ghost: { x: at.x, y: at.y - up },
    scale: lifted ? 1.08 : 1,
    shadow: { cx: at.x, cy: at.y + base * 0.3, rx: base * (lifted ? 0.34 : 0.4), ry: base * (lifted ? 0.11 : 0.15), opacity: lifted ? 0.36 : 0.55 },
  };
}

/** Junta os quadrados num único caminho (comandos de Path do Owlbear: 0=MOVE 1=LINE 5=CLOSE). */
export function cellsToCommands(cells, dpi) {
  const cmds = [];
  for (const { c, r } of cells) {
    const x = c * dpi, y = r * dpi;
    cmds.push([0, x, y], [1, x + dpi, y], [1, x + dpi, y + dpi], [1, x, y + dpi], [5]);
  }
  return cmds;
}

// ---------------- Terreno difícil ----------------

/**
 * Custo de um caminho andando quadrado a quadrado, com terreno difícil custando o dobro.
 * Sem terreno difícil o resultado é igual ao de pathCells (exceto EUCLIDEAN, que vira a soma das retas).
 * @param {(c:number, r:number) => boolean} isDifficult
 * @returns {{ total:number, extra:number, segs:number[] }}
 */
export function pathCost(points, dpi, measurement, isDifficult) {
  let diagCount = 0, total = 0, extra = 0;
  const segs = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const c0 = Math.floor(a.x / dpi), r0 = Math.floor(a.y / dpi);
    const dx = Math.round((b.x - a.x) / dpi), dy = Math.round((b.y - a.y) / dpi);
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    let seg = 0, pc = c0, pr = r0;
    const eu = Math.hypot(b.x - a.x, b.y - a.y) / dpi;
    for (let k = 1; k <= n; k++) {
      const c = c0 + Math.round((dx * k) / n), r = r0 + Math.round((dy * k) / n);
      const diag = c !== pc && r !== pr;
      let base;
      if (measurement === "MANHATTAN") base = diag ? 2 : 1;
      else if (measurement === "EUCLIDEAN") base = n ? eu / n : 0;
      else if (measurement === "ALTERNATING" && diag) base = (++diagCount % 2 === 0) ? 2 : 1;
      else base = 1;
      const add = isDifficult(c, r) ? base : 0;
      seg += base + add;
      extra += add;
      pc = c; pr = r;
    }
    segs.push(seg);
    total += seg;
  }
  return { total, extra, segs };
}

/** Polígono (mundo) de um item PATH/CURVE/SHAPE simples, considerando posição, escala e rotação. */
export function itemPolygon(item) {
  const sx = item.scale?.x ?? 1, sy = item.scale?.y ?? 1, a = ((item.rotation ?? 0) * Math.PI) / 180;
  const T = (x, y) => ({ x: item.position.x + x * sx * Math.cos(a) - y * sy * Math.sin(a), y: item.position.y + x * sx * Math.sin(a) + y * sy * Math.cos(a) });
  if (item.type === "PATH") return (item.commands || []).filter((c) => c[0] === 0 || c[0] === 1).map((c) => T(c[1], c[2]));
  if (item.type === "CURVE") return (item.points || []).map((p) => T(p.x, p.y));
  return [];
}
