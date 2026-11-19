// Preenchimento por obstrução: o "balde" respeita as linhas do Smoke & Spectre! e as paredes.
// Funções puras (sem OBR), testáveis em Node.
import { traceLoops, simplifyLoop, dilate } from "./core.js";

/** Converte um ponto local do item em coordenada de cena (posição, rotação em graus, escala). */
function toScene(item, p) {
  const sx = item.scale?.x ?? 1, sy = item.scale?.y ?? 1;
  const a = ((item.rotation ?? 0) * Math.PI) / 180;
  const x = p.x * sx, y = p.y * sy;
  const pos = item.position ?? { x: 0, y: 0 };
  return { x: pos.x + x * Math.cos(a) - y * Math.sin(a), y: pos.y + x * Math.sin(a) + y * Math.cos(a) };
}

/**
 * Extrai a geometria de um item que funciona como borda.
 * Retorna uma lista de polilinhas em coordenadas de cena: [{pts:[{x,y}], closed}]
 */
export function itemPolylines(item, closeTol = 0) {
  const out = [];
  const push = (pts, closedFlag) => {
    if (pts.length < 2) return;
    const a = pts[0], b = pts[pts.length - 1];
    const closed = !!closedFlag || (pts.length >= 3 && Math.hypot(a.x - b.x, a.y - b.y) <= closeTol);
    out.push({ pts, closed });
  };
  if (item.type === "CURVE" || item.type === "WALL") {
    push((item.points || []).map((p) => toScene(item, p)), item.style?.closed);
  } else if (item.type === "LINE") {
    push([toScene(item, item.startPosition), toScene(item, item.endPosition)], false);
  } else if (item.type === "PATH") {
    // comandos: [0=MOVE,x,y] [1=LINE,x,y] [5=CLOSE]; curvas são aproximadas pelo ponto final
    let cur = [];
    for (const c of item.commands || []) {
      const t = c[0];
      if (t === 0) { if (cur.length) push(cur, false); cur = [toScene(item, { x: c[1], y: c[2] })]; }
      else if (t === 5) { if (cur.length) push(cur, true); cur = []; }
      else if (c.length >= 3) cur.push(toScene(item, { x: c[c.length - 2], y: c[c.length - 1] }));
    }
    if (cur.length) push(cur, false);
  }
  return out;
}

export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Tira o ponto final repetido de um polígono fechado. */
function ring(pts) {
  const a = pts[0], b = pts[pts.length - 1];
  return a.x === b.x && a.y === b.y ? pts.slice(0, -1) : pts;
}

/**
 * Encontra a área cercada por obstruções que contém o ponto.
 * @param {{x,y}} point clique, em coordenadas de cena
 * @param {Array} polylines saída combinada de itemPolylines para todos os itens-borda
 * @param {number} dpi tamanho de um quadrado da grade, em unidades de cena
 * @returns {{loops: Array<Array<{x,y}>>, method: string} | {error: string}}
 */
export function fillFromWalls(point, polylines, dpi, opt = {}) {
  if (!polylines.length) return { error: "NO_WALLS" };

  // 1) Caminho exato: o menor polígono fechado que contém o clique, com as ilhas fechadas dentro dele como furos.
  const closed = polylines.filter((p) => p.closed).map((p) => ring(p.pts)).filter((r) => r.length >= 3);
  const containing = closed.filter((r) => pointInPolygon(point, r)).sort((a, b) => polygonArea(a) - polygonArea(b));
  if (containing.length) {
    const outer = containing[0];
    const inner = closed.filter((r) => r !== outer && !pointInPolygon(point, r) && r.every((q) => pointInPolygon(q, outer)));
    // só as ilhas de primeiro nível (não as que estão dentro de outra ilha)
    const holes = inner.filter((r) => !inner.some((o) => o !== r && r.every((q) => pointInPolygon(q, o))));
    // se houver linhas abertas dentro do polígono, o resultado exato pode estar errado: cai no modo raster
    const openInside = polylines.some((p) => !p.closed && p.pts.some((q) => pointInPolygon(q, outer)));
    if (!openInside) return { loops: [outer, ...holes], method: "exact" };
  }

  // 2) Caminho raster: desenha todas as linhas numa grade fina e faz o balde de tinta nela.
  const all = polylines.flatMap((p) => p.pts);
  let minX = Math.min(point.x, ...all.map((q) => q.x)), maxX = Math.max(point.x, ...all.map((q) => q.x));
  let minY = Math.min(point.y, ...all.map((q) => q.y)), maxY = Math.max(point.y, ...all.map((q) => q.y));
  const pad = dpi;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const maxCells = opt.maxCells ?? 1600;
  let cell = Math.max(dpi / (opt.cellsPerSquare ?? 12), Math.max(maxX - minX, maxY - minY) / maxCells);
  const w = Math.ceil((maxX - minX) / cell) + 1, h = Math.ceil((maxY - minY) / cell) + 1;
  const wall = new Uint8Array(w * h);
  const plot = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) wall[y * w + x] = 1; };
  const gx = (x) => (x - minX) / cell, gy = (y) => (y - minY) / cell;
  for (const pl of polylines) {
    const pts = pl.closed ? [...pl.pts, pl.pts[0]] : pl.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const x0 = gx(pts[i].x), y0 = gy(pts[i].y), x1 = gx(pts[i + 1].x), y1 = gy(pts[i + 1].y);
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        plot(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t));
      }
    }
  }
  const thick = dilate(wall, w, h, 1); // linha com 3 células: não deixa o balde vazar pela diagonal
  const sx = Math.round(gx(point.x)), sy = Math.round(gy(point.y));
  if (thick[sy * w + sx]) return { error: "ON_WALL" };
  const fill = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0, leaked = false;
  stack[top++] = sy * w + sx; fill[sy * w + sx] = 1;
  while (top > 0) {
    const p = stack[--top]; const x = p % w, y = (p / w) | 0;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { leaked = true; break; }
    for (const q of [p - 1, p + 1, p - w, p + w]) if (!fill[q] && !thick[q]) { fill[q] = 1; stack[top++] = q; }
  }
  if (leaked) return { error: "NOT_CLOSED" };
  // estende o preenchimento até o meio da linha, para o fog encostar na obstrução
  const loops = traceLoops(dilate(fill, w, h, 1), w, h)
    .map((l) => simplifyLoop(l, 0.75))
    .filter((l) => l.length >= 3)
    .map((l) => l.map(([x, y]) => ({ x: minX + x * cell, y: minY + y * cell })));
  if (!loops.length) return { error: "NOT_CLOSED" };
  return { loops, method: "raster" };
}
