// Núcleo do Balde de Fog: funções puras (sem DOM, sem OBR), testáveis em Node.
// Entrada: pixels RGBA (Uint8ClampedArray / Uint8Array), largura, altura.
// Saída: laços (loops) de pontos em coordenadas de pixel, prontos para virar Path com fillRule evenodd.

/** Distância de cor ao quadrado entre o pixel i e a cor de referência. */
function dist2(data, i, r, g, b) {
  const dr = data[i] - r, dg = data[i + 1] - g, db = data[i + 2] - b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Seleção por cor (varinha mágica).
 * @param {object} img {data, width, height}
 * @param {number} sx, sy  pixel semente
 * @param {object} opt {tolerance (0-255), contiguous (bool), sampleRadius}
 * @returns {Uint8Array} máscara 0/1
 */
export function selectByColor(img, sx, sy, opt = {}) {
  const { data, width: w, height: h } = img;
  const tol = opt.tolerance ?? 40;
  const contiguous = opt.contiguous ?? true;
  const sr = opt.sampleRadius ?? 2;
  // cor de referência = média de uma pequena janela em volta do clique (estável em texturas)
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.max(0, sy - sr); y <= Math.min(h - 1, sy + sr); y++)
    for (let x = Math.max(0, sx - sr); x <= Math.min(w - 1, sx + sr); x++) {
      const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  r /= n; g /= n; b /= n;
  const t2 = tol * tol;
  const mask = new Uint8Array(w * h);
  if (!contiguous) {
    for (let p = 0, i = 0; p < w * h; p++, i += 4) if (dist2(data, i, r, g, b) <= t2) mask[p] = 1;
    return mask;
  }
  const stack = new Int32Array(w * h);
  let top = 0;
  const seed = sy * w + sx;
  stack[top++] = seed; mask[seed] = 1;
  while (top > 0) {
    const p = stack[--top];
    const x = p % w, y = (p / w) | 0;
    if (x > 0) { const q = p - 1; if (!mask[q] && dist2(data, q * 4, r, g, b) <= t2) { mask[q] = 1; stack[top++] = q; } }
    if (x < w - 1) { const q = p + 1; if (!mask[q] && dist2(data, q * 4, r, g, b) <= t2) { mask[q] = 1; stack[top++] = q; } }
    if (y > 0) { const q = p - w; if (!mask[q] && dist2(data, q * 4, r, g, b) <= t2) { mask[q] = 1; stack[top++] = q; } }
    if (y < h - 1) { const q = p + w; if (!mask[q] && dist2(data, q * 4, r, g, b) <= t2) { mask[q] = 1; stack[top++] = q; } }
  }
  return mask;
}

/** Erosão/dilatação com janela quadrada (2r+1), separável, O(N). */
function morph(mask, w, h, r, dilate) {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  const want = dilate ? 1 : 0;
  // horizontal: conta de pixels "want" na janela
  for (let y = 0; y < h; y++) {
    let cnt = 0;
    const row = y * w;
    for (let x = -r; x < w; x++) {
      const xa = x + r; if (xa < w && mask[row + xa] === want) cnt++;
      const xr = x - r - 1; if (xr >= 0 && mask[row + xr] === want) cnt--;
      if (x >= 0) tmp[row + x] = dilate ? (cnt > 0 ? 1 : 0) : (cnt > 0 ? 0 : 1);
    }
  }
  for (let x = 0; x < w; x++) {
    let cnt = 0;
    for (let y = -r; y < h; y++) {
      const ya = y + r; if (ya < h && tmp[ya * w + x] === want) cnt++;
      const yr = y - r - 1; if (yr >= 0 && tmp[yr * w + x] === want) cnt--;
      if (y >= 0) out[y * w + x] = dilate ? (cnt > 0 ? 1 : 0) : (cnt > 0 ? 0 : 1);
    }
  }
  return out;
}
export const dilate = (m, w, h, r) => morph(m, w, h, r, true);
export const erode = (m, w, h, r) => morph(m, w, h, r, false);

/** Remove buracos menores que minArea (componentes do complemento que não tocam a borda da imagem). */
export function fillSmallHoles(mask, w, h, minArea) {
  if (minArea <= 0) return mask;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const comp = [];
  for (let s = 0; s < w * h; s++) {
    if (mask[s] || seen[s]) continue;
    let top = 0, touches = false; comp.length = 0;
    stack[top++] = s; seen[s] = 1;
    while (top > 0) {
      const p = stack[--top]; comp.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true;
      if (x > 0 && !mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < w - 1 && !mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && !mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[top++] = p - w; }
      if (y < h - 1 && !mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[top++] = p + w; }
    }
    if (!touches && comp.length < minArea) for (const p of comp) mask[p] = 1;
  }
  return mask;
}

/** Mantém só o componente conectado que contém (sx, sy) — útil depois da limpeza. */
export function keepComponent(mask, w, h, sx, sy) {
  let seed = sy * w + sx;
  if (!mask[seed]) {
    // procura o pixel marcado mais próximo num raio pequeno
    let best = -1, bd = 1e9;
    for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
      const x = sx + dx, y = sy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const q = y * w + x, d = dx * dx + dy * dy;
      if (mask[q] && d < bd) { bd = d; best = q; }
    }
    if (best < 0) return new Uint8Array(w * h);
    seed = best;
  }
  const out = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0; stack[top++] = seed; out[seed] = 1;
  while (top > 0) {
    const p = stack[--top]; const x = p % w, y = (p / w) | 0;
    if (x > 0 && mask[p - 1] && !out[p - 1]) { out[p - 1] = 1; stack[top++] = p - 1; }
    if (x < w - 1 && mask[p + 1] && !out[p + 1]) { out[p + 1] = 1; stack[top++] = p + 1; }
    if (y > 0 && mask[p - w] && !out[p - w]) { out[p - w] = 1; stack[top++] = p - w; }
    if (y < h - 1 && mask[p + w] && !out[p + w]) { out[p + w] = 1; stack[top++] = p + w; }
  }
  return out;
}

/** Remove ilhas da máscara menores que minArea. */
export function removeSmallIslands(mask, w, h, minArea) {
  if (minArea <= 0) return mask;
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h), comp = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seen[s]) continue;
    let top = 0; comp.length = 0; stack[top++] = s; seen[s] = 1;
    while (top > 0) {
      const p = stack[--top]; comp.push(p); const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[top++] = p - w; }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[top++] = p + w; }
    }
    if (comp.length < minArea) for (const p of comp) mask[p] = 0;
  }
  return mask;
}

/**
 * Contorno exato da máscara como laços fechados nas quinas dos pixels.
 * Cada aresta de borda vira um segmento orientado; encadeados, formam laços.
 * Com fillRule "evenodd" o preenchimento fica correto (furos incluídos).
 */
export function traceLoops(mask, w, h) {
  const W1 = w + 1;
  const key = (x, y) => y * W1 + x;
  const next = new Map(); // vértice -> lista de vértices seguintes
  const add = (ax, ay, bx, by) => {
    const k = key(ax, ay);
    const v = next.get(k);
    if (v) v.push(key(bx, by)); else next.set(k, [key(bx, by)]);
  };
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    if (!on(x, y - 1)) add(x, y, x + 1, y);          // topo  (sentido horário)
    if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1);  // direita
    if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1);  // base
    if (!on(x - 1, y)) add(x, y + 1, x, y);          // esquerda
  }
  const loops = [];
  for (const [start] of next) {
    while (next.has(start) && next.get(start).length) {
      const pts = [];
      let cur = start;
      for (let guard = 0; guard < 1e7; guard++) {
        pts.push([cur % W1, (cur / W1) | 0]);
        const lst = next.get(cur);
        if (!lst || !lst.length) break;
        const nx = lst.pop();
        if (!lst.length) next.delete(cur);
        cur = nx;
        if (cur === start) break;
      }
      if (pts.length >= 4) loops.push(pts);
    }
  }
  return loops;
}

/** Remove pontos colineares (degraus retos) antes do RDP. */
function dropCollinear(pts) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b);
  }
  return out.length >= 3 ? out : pts;
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [i0, i1] = st.pop();
    const [x0, y0] = pts[i0], [x1, y1] = pts[i1];
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    let md = -1, mi = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x1 * y0 - y1 * x0) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; st.push([i0, mi], [mi, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Simplifica um laço fechado (corta no ponto mais distante do primeiro para o RDP funcionar bem). */
export function simplifyLoop(pts, eps) {
  let p = dropCollinear(pts);
  if (eps <= 0 || p.length < 6) return p;
  let far = 0, fd = -1;
  for (let i = 1; i < p.length; i++) {
    const d = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2;
    if (d > fd) { fd = d; far = i; }
  }
  const a = rdp(p.slice(0, far + 1), eps);
  const b = rdp(p.slice(far).concat([p[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

export function loopArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

/**
 * Pipeline completo.
 * opt: tolerance, contiguous, smooth (px), grow (px, pode ser negativo),
 *      minHole (px²), minIsland (px²), simplify (px)
 * Coordenadas de entrada/saída na resolução da imagem recebida.
 */
export function fogFill(img, sx, sy, opt = {}) {
  const { width: w, height: h } = img;
  let m = selectByColor(img, sx, sy, opt);
  const s = Math.round(opt.smooth ?? 2);
  if (s > 0) { m = erode(dilate(m, w, h, s), w, h, s); m = dilate(erode(m, w, h, s), w, h, s); } // fecha e abre
  const g = Math.round(opt.grow ?? 0);
  if (g > 0) m = dilate(m, w, h, g); else if (g < 0) m = erode(m, w, h, -g);
  if (opt.contiguous ?? true) m = keepComponent(m, w, h, sx, sy);
  m = removeSmallIslands(m, w, h, opt.minIsland ?? 64);
  m = fillSmallHoles(m, w, h, opt.minHole ?? 400);
  let count = 0; for (let i = 0; i < m.length; i++) count += m[i];
  const loops = traceLoops(m, w, h)
    .map((l) => simplifyLoop(l, opt.simplify ?? 1.5))
    .filter((l) => l.length >= 3 && loopArea(l) >= 4);
  return { loops, pixels: count };
}

// ---------------- Varredura do mapa inteiro ----------------

/** Chão a partir de um clique: área conectada de cor parecida, com a borda suavizada (sem "abrir", para não perder o clique). */
export function floorFromSeed(img, sx, sy, opt = {}) {
  const { width: w, height: h } = img;
  let m = selectByColor(img, sx, sy, { tolerance: opt.tolerance ?? 22, contiguous: true });
  const s = Math.round(opt.smooth ?? 2);
  if (s > 0) m = erode(dilate(m, w, h, s), w, h, s); // fecha frestas da textura
  return keepComponent(m, w, h, sx, sy);
}

/**
 * Fog = tudo que não é chão. Devolve os laços do CHÃO (para contorno) e o total de pixels de chão.
 * minHole: manchas dentro do chão menores que isso (móveis, sujeira) viram chão.
 */
export function sweepFromFloor(floor, w, h, opt = {}) {
  let m = removeSmallIslands(floor, w, h, opt.minIsland ?? 64);
  m = fillSmallHoles(m, w, h, opt.minHole ?? 400);
  const g = Math.round(opt.grow ?? 0);
  // grow > 0 = o fog avança sobre o chão (recua o chão)
  if (g > 0) m = erode(m, w, h, g); else if (g < 0) m = dilate(m, w, h, -g);
  let count = 0; for (let i = 0; i < m.length; i++) count += m[i];
  const loops = traceLoops(m, w, h)
    .map((l) => simplifyLoop(l, opt.simplify ?? 1.5))
    .filter((l) => l.length >= 3 && loopArea(l) >= 4);
  return { loops, pixels: count, mask: m };
}

/** Desfoque de caixa (RGB) para comparar a "cor média da região" e não o pixel ruidoso da textura. */
export function boxBlur(img, r) {
  const { data, width: w, height: h } = img;
  if (r < 1) return img;
  const tmp = new Float32Array(w * h * 3), out = new Uint8ClampedArray(w * h * 4);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let sr = 0, sg = 0, sb = 0;
    for (let x = -r; x <= r; x++) { const i = (y * w + Math.min(w - 1, Math.max(0, x))) * 4; sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3; tmp[o] = sr / n; tmp[o + 1] = sg / n; tmp[o + 2] = sb / n;
      const a = (y * w + Math.max(0, x - r)) * 4, b = (y * w + Math.min(w - 1, x + r + 1)) * 4;
      sr += data[b] - data[a]; sg += data[b + 1] - data[a + 1]; sb += data[b + 2] - data[a + 2];
    }
  }
  for (let x = 0; x < w; x++) {
    let sr = 0, sg = 0, sb = 0;
    for (let y = -r; y <= r; y++) { const o = (Math.min(h - 1, Math.max(0, y)) * w + x) * 3; sr += tmp[o]; sg += tmp[o + 1]; sb += tmp[o + 2]; }
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4; out[i] = sr / n; out[i + 1] = sg / n; out[i + 2] = sb / n; out[i + 3] = 255;
      const a = (Math.max(0, y - r) * w + x) * 3, b = (Math.min(h - 1, y + r + 1) * w + x) * 3;
      sr += tmp[b] - tmp[a]; sg += tmp[b + 1] - tmp[a + 1]; sb += tmp[b + 2] - tmp[a + 2];
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * Varredura pelo VAZIO: clique na área fora do jogo (rocha preta, abismo, mata fechada).
 * Toda região do mapa inteiro com a mesma "cor média" vira fog, conectada ou não ao clique.
 * Ilhas pequenas são ignoradas (sombras soltas no chão não viram fog).
 */
export function sweepVoid(img, sx, sy, opt = {}) {
  const { width: w, height: h } = img;
  const r = Math.max(1, Math.round(opt.blur ?? Math.max(w, h) / 220));
  const bl = boxBlur(img, r);
  let m = selectByColor(bl, sx, sy, { tolerance: opt.tolerance ?? 22, contiguous: false, sampleRadius: r + 2 });
  const s = Math.round(opt.smooth ?? 2) + 1;
  m = erode(dilate(m, w, h, s), w, h, s); // fecha
  m = dilate(erode(m, w, h, s), w, h, s); // abre
  const g = Math.round(opt.grow ?? 0);
  if (g > 0) m = dilate(m, w, h, g); else if (g < 0) m = erode(m, w, h, -g);
  m = removeSmallIslands(m, w, h, opt.minIsland ?? 400);
  m = fillSmallHoles(m, w, h, opt.minHole ?? 400);
  let count = 0; for (let i = 0; i < m.length; i++) count += m[i];
  const loops = traceLoops(m, w, h)
    .map((l) => simplifyLoop(l, opt.simplify ?? 1.5))
    .filter((l) => l.length >= 3 && loopArea(l) >= 4);
  return { loops, pixels: count, mask: m };
}

/**
 * Varredura automática (um clique): cobre de fog o que está FORA da área jogável, no mapa inteiro.
 *  - partes transparentes da imagem são sempre fog;
 *  - clique no vazio (transparente ou da cor que domina a borda da imagem): tudo com essa cor vira fog;
 *  - clique em qualquer outro lugar (chão, móveis): usa a cor dominante da borda como "vazio".
 * Devolve { loops, pixels, mask, mode: "click" | "border" | "alpha", alphaFrac }.
 */
export function sweepAuto(img, sx, sy, opt = {}) {
  const { data, width: w, height: h } = img;
  const N = w * h;
  const cell = opt.cell ?? 50;              // lado de um quadrado em px da imagem processada
  const tol = opt.tolerance ?? 22;
  const r = Math.max(1, Math.round(opt.blur ?? Math.max(w, h) / 220));
  const alpha = new Uint8Array(N);
  let nA = 0;
  for (let p = 0; p < N; p++) if (data[p * 4 + 3] < 128) { alpha[p] = 1; nA++; }
  const bl = boxBlur(img, r);
  const B = bl.data;
  const seedAlpha = alpha[sy * w + sx] === 1;

  // cor do clique (janela desfocada, só pixels opacos)
  let seedC = null;
  {
    let R = 0, G = 0, Bb = 0, n = 0;
    for (let y = Math.max(0, sy - r - 2); y <= Math.min(h - 1, sy + r + 2); y++)
      for (let x = Math.max(0, sx - r - 2); x <= Math.min(w - 1, sx + r + 2); x++) {
        const p = y * w + x; if (alpha[p]) continue;
        R += B[p * 4]; G += B[p * 4 + 1]; Bb += B[p * 4 + 2]; n++;
      }
    if (n) seedC = [R / n, G / n, Bb / n];
  }
  // cor que domina a moldura da imagem (histograma grosso das bordas opacas)
  const fw = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const bins = new Map();
  let nBorder = 0, nBorderOpaque = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!(x < fw || y < fw || x >= w - fw || y >= h - fw)) continue;
    nBorder++;
    const p = y * w + x; if (alpha[p]) continue;
    nBorderOpaque++;
    const i = p * 4, key = ((B[i] >> 4) << 8) | ((B[i + 1] >> 4) << 4) | (B[i + 2] >> 4);
    const e = bins.get(key) || [0, 0, 0, 0];
    e[0] += B[i]; e[1] += B[i + 1]; e[2] += B[i + 2]; e[3]++; bins.set(key, e);
  }
  let borderC = null, best = 0;
  for (const e of bins.values()) if (e[3] > best) { best = e[3]; borderC = [e[0] / e[3], e[1] / e[3], e[2] / e[3]]; }
  // só vale como "vazio" se dominar boa parte da moldura opaca
  if (best < 0.25 * nBorderOpaque || nBorderOpaque < 0.2 * nBorder) borderC = null;

  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let ref = null, mode;
  if (seedAlpha) mode = "alpha";
  else if (seedC && borderC && d(seedC, borderC) <= tol * 1.5) { ref = seedC; mode = "click"; }
  else if (borderC) { ref = borderC; mode = "border"; }
  else mode = "alpha";
  if (mode === "alpha" && nA < 0.005 * N) return { loops: [], pixels: 0, mask: new Uint8Array(N), mode: "none", alphaFrac: nA / N };

  let fog = new Uint8Array(N);
  const t2 = tol * tol;
  for (let p = 0; p < N; p++) {
    if (alpha[p]) { fog[p] = 1; continue; }
    if (ref) { const i = p * 4; const dr = B[i] - ref[0], dg = B[i + 1] - ref[1], db = B[i + 2] - ref[2]; if (dr * dr + dg * dg + db * db <= t2) fog[p] = 1; }
  }
  const s = Math.round(opt.smooth ?? 2) + 1;
  fog = erode(dilate(fog, w, h, s), w, h, s);
  fog = dilate(erode(fog, w, h, s), w, h, s);
  for (let p = 0; p < N; p++) if (alpha[p]) fog[p] = 1; // a suavização não pode comer o transparente
  fog = removeSmallIslands(fog, w, h, opt.minIsland ?? 1.5 * cell * cell);
  fog = fillSmallHoles(fog, w, h, opt.minHole ?? 0.5 * cell * cell);
  const g = Math.round(opt.grow ?? 0);
  if (g > 0) fog = dilate(fog, w, h, g); else if (g < 0) { fog = erode(fog, w, h, -g); for (let p = 0; p < N; p++) if (alpha[p]) fog[p] = 1; }
  let count = 0; for (let i = 0; i < N; i++) count += fog[i];
  const loops = traceLoops(fog, w, h)
    .map((l) => simplifyLoop(l, opt.simplify ?? 1.5))
    .filter((l) => l.length >= 3 && loopArea(l) >= 4);
  return { loops, pixels: count, mask: fog, mode, alphaFrac: nA / N };
}
