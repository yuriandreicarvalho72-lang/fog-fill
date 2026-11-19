// Shaders (SkSL) dos climas. Código próprio, escrito para esta extensão.
// Cada clima é um efeito ATTACHMENT preso a um mapa ou a uma forma: o Owlbear fornece `time` (segundos)
// e `size` (tamanho do item em unidades de cena). Tudo é calculado em "quadrados" (coord / uCell).
// Saída em alfa pré-multiplicado (rgb já multiplicado pelo alfa).

const HEADER = `
uniform float time;
uniform vec2 size;
uniform vec2 uDir;      // para onde o vento sopra (normalizado; y para baixo)
uniform float uSpeed;   // velocidade 0.1..3
uniform float uDensity; // intensidade 0.2..2
uniform float uScale;   // tamanho das partículas 0.5..2.5
uniform vec3 uColor;    // cor principal
uniform float uOpacity; // 0..1
uniform float uFlash;   // relâmpago manual 0..1
uniform float uCell;    // unidades de cena por quadrado

float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 h22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), u.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return v;
}
// gira o espaço para que a "queda" aponte para o eixo +y
vec2 alignTo(vec2 p, vec2 d) { vec2 n = normalize(d); return vec2(p.x * n.y - p.y * n.x, p.x * n.x + p.y * n.y); }
`;

// --- partículas: uma camada de pontos que caem/sobem com balanço ---
// p em quadrados; fall = direção do movimento; spd = velocidade em quadrados/s; dens = 0..1 chance por célula;
// rad = raio em quadrados; sway = balanço lateral
const PARTICLES = `
vec3 particleLayer(vec2 p, vec2 fall, float spd, float dens, float rad, float sway, float seed) {
  vec2 q = alignTo(p, fall);
  q.y -= time * spd;
  vec2 id = floor(q), f = fract(q);
  float best = 0.0, life = 0.0, rnd = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = id + vec2(float(i), float(j));
    float r = h12(c + seed);
    if (r > dens) continue;
    vec2 o = h22(c + seed * 1.7);
    o.x += sway * sin(time * (0.6 + o.y) + r * 6.2831) * 0.35;
    vec2 d = f - (vec2(float(i), float(j)) + o);
    float m = 1.0 - smoothstep(rad * 0.4, rad, length(d));
    if (m > best) { best = m; life = o.y; rnd = r / max(dens, 0.0001); }
  }
  return vec3(best, life, rnd);
}
`;

const BODIES = {
  // ---------- água ----------
  rain: `
vec2 fall = normalize(vec2(uDir.x * 0.6, 1.0));
vec4 col = vec4(0.0);
for (int k = 0; k < 3; k++) {
  float fk = float(k);
  float sc = (1.6 + fk * 1.3) / uScale;
  vec2 q = alignTo(p * sc, fall);
  float colw = 1.0;
  float cx = floor(q.x / colw);
  float r = h12(vec2(cx, fk * 13.0));
  if (r > uDensity * 0.55) continue;
  float spd = (6.0 + 4.0 * r) * uSpeed * sc;
  float y = fract((q.y - time * spd) / 3.0 + r * 7.0);
  float x = abs(fract(q.x / colw) - 0.5 - (h12(vec2(cx, 3.0)) - 0.5) * 0.6);
  float streak = smoothstep(0.62, 1.0, y) * (1.0 - smoothstep(0.018, 0.045, x));
  float a = streak * (0.75 - fk * 0.15);
  col += vec4(uColor * a, a);
}
col *= uOpacity;
return half4(col);`,

  storm: `
vec2 fall = normalize(vec2(uDir.x * 0.9, 1.0));
vec4 col = vec4(0.0);
for (int k = 0; k < 4; k++) {
  float fk = float(k);
  float sc = (1.4 + fk * 1.1) / uScale;
  vec2 q = alignTo(p * sc, fall);
  float cx = floor(q.x);
  float r = h12(vec2(cx, fk * 7.0));
  if (r > min(0.95, uDensity * 0.8)) continue;
  float spd = (9.0 + 5.0 * r) * uSpeed * sc;
  float y = fract((q.y - time * spd) / 2.5 + r * 5.0);
  float x = abs(fract(q.x) - 0.5 - (h12(vec2(cx, 2.0)) - 0.5) * 0.6);
  float a = smoothstep(0.7, 1.0, y) * (1.0 - smoothstep(0.014, 0.035, x)) * (0.6 - fk * 0.1);
  col += vec4(uColor * a, a);
}
// escurece o céu e acende com relâmpagos (automáticos + botão)
float tb = floor(time * 1.7);
float af = step(0.93, h12(vec2(tb, 4.0))) * exp(-fract(time * 1.7) * 7.0);
af += step(0.93, h12(vec2(tb, 4.0))) * step(0.5, h12(vec2(tb, 9.0))) * exp(-abs(fract(time * 1.7) - 0.25) * 30.0);
float fl = clamp(max(af, uFlash), 0.0, 1.0);
float dark = 0.28 * uDensity * (1.0 - fl);
col = col + vec4(0.02, 0.03, 0.06, 1.0) * dark * (1.0 - col.a);
col += vec4(vec3(0.85, 0.9, 1.0) * fl * 0.55, fl * 0.55) * (1.0 - col.a);
col *= uOpacity;
return half4(col);`,

  acid: `
vec2 fall = normalize(vec2(uDir.x * 0.5, 1.0));
vec4 col = vec4(0.0);
for (int k = 0; k < 3; k++) {
  float fk = float(k);
  float sc = (1.5 + fk * 1.2) / uScale;
  vec2 q = alignTo(p * sc, fall);
  float cx = floor(q.x);
  float r = h12(vec2(cx, fk * 11.0));
  if (r > uDensity * 0.5) continue;
  float spd = (4.0 + 3.0 * r) * uSpeed * sc;
  float y = fract((q.y - time * spd) / 3.5 + r * 9.0);
  float x = abs(fract(q.x) - 0.5 - (h12(vec2(cx, 5.0)) - 0.5) * 0.6);
  float core = smoothstep(0.7, 1.0, y) * (1.0 - smoothstep(0.01, 0.025, x));
  float glow = smoothstep(0.6, 1.0, y) * (1.0 - smoothstep(0.02, 0.12, x)) * 0.35;
  float a = (core + glow) * (0.7 - fk * 0.15);
  col += vec4(mix(uColor, vec3(1.0), core * 0.5) * a, a);
}
// respingos no chão: anéis rápidos
vec2 g = p * 1.3 / uScale;
vec2 gi = floor(g);
float rr = h12(gi + 31.0);
if (rr < uDensity * 0.35) {
  float t = fract(time * uSpeed * 0.8 + rr * 5.0);
  float d = length(fract(g) - h22(gi));
  float ring = (1.0 - smoothstep(0.0, 0.02, abs(d - t * 0.18))) * (1.0 - t) * 0.6;
  col += vec4(uColor * ring, ring);
}
col *= uOpacity;
return half4(col);`,

  // ---------- frio ----------
  snow: `
vec2 fall = normalize(vec2(uDir.x * 0.7, 1.0));
vec4 col = vec4(0.0);
for (int k = 0; k < 4; k++) {
  float fk = float(k);
  float sc = (1.0 + fk * 0.9) / uScale;
  vec3 pr = particleLayer(p * sc, fall, (0.35 + fk * 0.15) * uSpeed * sc, min(0.9, 0.35 * uDensity + 0.05 * fk), 0.09 - fk * 0.012, 1.0, fk * 21.0);
  float a = pr.x * (0.95 - fk * 0.15);
  col += vec4(uColor * a, a) * (1.0 - col.a);
}
col *= uOpacity;
return half4(col);`,

  blizzard: `
vec2 fall = normalize(vec2(uDir.x * 2.5 + 0.3, 0.6));
vec4 col = vec4(0.0);
for (int k = 0; k < 4; k++) {
  float fk = float(k);
  float sc = (1.2 + fk * 1.0) / uScale;
  vec3 pr = particleLayer(p * sc, fall, (1.6 + fk * 0.6) * uSpeed * sc, min(0.95, 0.5 * uDensity + 0.05 * fk), 0.08 - fk * 0.01, 0.4, fk * 17.0);
  float a = pr.x * (0.9 - fk * 0.12);
  col += vec4(uColor * a, a) * (1.0 - col.a);
}
// véu branco que corre com o vento
vec2 wv = p * 0.25 - normalize(fall) * time * 0.6 * uSpeed;
float veil = smoothstep(0.35, 0.9, fbm(wv)) * 0.45 * uDensity;
col += vec4(uColor * veil, veil) * (1.0 - col.a);
col *= uOpacity;
return half4(col);`,

  // ---------- fogo ----------
  embers: `
vec2 rise = normalize(vec2(uDir.x * 0.8, -1.0));
vec4 col = vec4(0.0);
for (int k = 0; k < 3; k++) {
  float fk = float(k);
  float sc = (0.9 + fk * 0.8) / uScale;
  vec3 pr = particleLayer(p * sc, rise, (0.5 + fk * 0.25) * uSpeed * sc, min(0.9, 0.3 * uDensity + 0.04 * fk), 0.1 - fk * 0.018, 1.4, fk * 41.0 + 3.0);
  // brilho pulsando e esfriando
  float flick = 0.65 + 0.35 * sin(time * (5.0 + pr.z * 9.0) + pr.z * 40.0);
  float heat = clamp(pr.y * 1.2, 0.0, 1.0);
  vec3 c = mix(uColor, vec3(1.0, 0.95, 0.6), heat * 0.6);
  float a = pr.x * flick * (1.0 - fk * 0.2);
  col += vec4(c * a, a) * (1.0 - col.a * 0.5);
  // halo
  vec3 halo = particleLayer(p * sc, rise, (0.5 + fk * 0.25) * uSpeed * sc, min(0.9, 0.3 * uDensity + 0.04 * fk), 0.3 - fk * 0.05, 1.4, fk * 41.0 + 3.0);
  float ha = halo.x * 0.25 * flick;
  col += vec4(uColor * ha, ha) * (1.0 - col.a);
}
col = min(col, vec4(1.0));
col *= uOpacity;
return half4(col);`,

  ash: `
vec2 fall = normalize(vec2(uDir.x * 0.6, 1.0));
vec4 col = vec4(0.0);
for (int k = 0; k < 3; k++) {
  float fk = float(k);
  float sc = (1.0 + fk * 0.9) / uScale;
  vec3 pr = particleLayer(p * sc, fall, (0.18 + fk * 0.08) * uSpeed * sc, min(0.9, 0.35 * uDensity + 0.04 * fk), 0.11 - fk * 0.02, 1.6, fk * 9.0 + 70.0);
  // uma em cada dez cinzas ainda arde
  float burning = step(0.9, pr.z);
  vec3 c = mix(uColor, vec3(1.0, 0.45, 0.1), burning * (0.6 + 0.4 * sin(time * 6.0 + pr.z * 30.0)));
  float a = pr.x * (0.95 - fk * 0.15);
  col += vec4(c * a, a) * (1.0 - col.a);
}
col *= uOpacity;
return half4(col);`,

  heat: `
// calor: ondulação dourada e fagulhas finas subindo
vec2 q = p * 0.6 / uScale + vec2(0.0, time * 0.4 * uSpeed);
float n = fbm(q + fbm(q * 1.7 - time * 0.2));
float a = smoothstep(0.45, 0.85, n) * 0.22 * uDensity;
vec4 col = vec4(uColor * a, a);
vec3 pr = particleLayer(p * 2.2 / uScale, vec2(0.0, -1.0), 1.4 * uSpeed, 0.18 * uDensity, 0.035, 2.0, 5.0);
float s = pr.x * 0.9;
col += vec4(vec3(1.0, 0.8, 0.4) * s, s) * (1.0 - col.a);
col *= uOpacity;
return half4(col);`,

  // ---------- névoas ----------
  fog: `
vec2 w = -normalize(uDir) * time * 0.12 * uSpeed;
vec2 q = p * 0.18 / uScale;
float n = fbm(q + w + fbm(q * 2.0 + w * 1.5) * 0.8);
float a = smoothstep(0.32, 0.85, n) * 0.75 * clamp(uDensity, 0.0, 1.6);
vec4 col = vec4(uColor * a, a) * uOpacity;
return half4(col);`,

  toxic: `
vec2 w = -normalize(uDir) * time * 0.08 * uSpeed;
vec2 q = p * 0.22 / uScale;
float n = fbm(q + w + fbm(q * 2.3 - w) * 0.9);
float a = smoothstep(0.38, 0.8, n) * 0.7 * clamp(uDensity, 0.0, 1.6);
vec4 col = vec4(uColor * a, a);
// bolhas que sobem e estouram
vec3 pr = particleLayer(p * 1.6 / uScale, vec2(0.0, -1.0), 0.35 * uSpeed, 0.2 * uDensity, 0.07, 1.0, 12.0);
float ring = smoothstep(0.0, 0.35, pr.x) * (1.0 - smoothstep(0.35, 0.8, pr.x)) * 0.9;
col += vec4(mix(uColor, vec3(1.0), 0.4) * ring, ring) * (1.0 - col.a * 0.6);
col *= uOpacity;
return half4(col);`,

  clouds: `
// sombras de nuvens passando pelo mapa
vec2 w = -normalize(uDir) * time * 0.15 * uSpeed;
float n = fbm(p * 0.06 / uScale + w);
float a = smoothstep(0.42, 0.72, n) * 0.6 * clamp(uDensity, 0.0, 1.6);
vec4 col = vec4(uColor * a, a) * uOpacity;
return half4(col);`,

  smoke: `
// fumaça densa subindo (incêndio, explosão)
vec2 q = p * 0.25 / uScale + vec2(-uDir.x * 0.3, 1.0) * time * 0.25 * uSpeed;
float n = fbm(q + fbm(q * 1.8 + time * 0.05) * 1.2);
float a = smoothstep(0.35, 0.9, n) * 0.8 * clamp(uDensity, 0.0, 1.6);
vec3 c = uColor * (0.6 + 0.4 * n);
vec4 col = vec4(c * a, a) * uOpacity;
return half4(col);`,

  sand: `
vec2 dir = normalize(uDir + vec2(0.0001));
vec4 col = vec4(0.0);
// grãos rápidos
for (int k = 0; k < 3; k++) {
  float fk = float(k);
  float sc = (2.5 + fk * 2.0) / uScale;
  vec3 pr = particleLayer(p * sc, dir, (3.0 + fk) * uSpeed * sc, min(0.95, 0.5 * uDensity), 0.05, 0.2, fk * 5.0 + 90.0);
  float a = pr.x * 0.7;
  col += vec4(uColor * a, a) * (1.0 - col.a);
}
// poeira em faixas
vec2 q = alignTo(p * 0.3 / uScale, dir);
float n = fbm(vec2(q.x * 2.5, q.y * 0.6 - time * 1.2 * uSpeed));
float haze = smoothstep(0.3, 0.85, n) * 0.55 * uDensity;
col += vec4(uColor * 0.9 * haze, haze) * (1.0 - col.a);
col *= uOpacity;
return half4(col);`,

  // ---------- natureza ----------
  leaves: `
vec2 fall = normalize(vec2(uDir.x * 1.2, 1.0));
vec4 col = vec4(0.0);
for (int k = 0; k < 3; k++) {
  float fk = float(k);
  float sc = (0.8 + fk * 0.7) / uScale;
  vec2 q = alignTo(p * sc, fall);
  q.y -= time * (0.45 + fk * 0.2) * uSpeed * sc;
  vec2 id = floor(q), f = fract(q);
  float r = h12(id + fk * 3.0);
  if (r > min(0.85, 0.25 * uDensity + 0.05 * fk)) continue;
  vec2 o = h22(id + fk * 5.0) * 0.6 + 0.2;
  o.x += 0.25 * sin(time * 1.3 + r * 30.0);
  vec2 d = f - o;
  float ang = time * (1.5 + r * 2.0) + r * 20.0;
  vec2 rd = vec2(d.x * cos(ang) - d.y * sin(ang), d.x * sin(ang) + d.y * cos(ang));
  float leaf = 1.0 - smoothstep(0.8, 1.0, length(rd / vec2(0.12, 0.055)));
  vec3 c = mix(uColor, uColor.gbr * 0.8 + vec3(0.2, 0.1, 0.0), h12(id + 9.0) * 0.6);
  float a = leaf * 0.95;
  col += vec4(c * a, a) * (1.0 - col.a);
}
col *= uOpacity;
return half4(col);`,

  spores: `
// esporos / vaga-lumes: pontos que vagam e piscam
vec4 col = vec4(0.0);
for (int k = 0; k < 2; k++) {
  float fk = float(k);
  float sc = (0.7 + fk * 0.6) / uScale;
  vec2 q = p * sc + vec2(sin(time * 0.13 + fk), cos(time * 0.11 + fk)) * 0.6 - uDir * time * 0.05 * uSpeed;
  vec2 id = floor(q), f = fract(q);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = id + vec2(float(i), float(j));
    float r = h12(c + fk * 19.0);
    if (r > min(0.9, 0.45 * uDensity)) continue;
    vec2 o = h22(c + fk * 23.0);
    o += 0.3 * vec2(sin(time * (0.5 + r) * uSpeed + r * 10.0), cos(time * (0.4 + r) * uSpeed + r * 7.0));
    float d = length(f - (vec2(float(i), float(j)) + o));
    float blink = 0.5 + 0.5 * sin(time * (1.5 + r * 3.0) + r * 50.0);
    blink = blink * blink;
    float core = (1.0 - smoothstep(0.03, 0.06, d)) * blink;
    float halo = (1.0 - smoothstep(0.0, 0.24, d)) * 0.45 * blink;
    float a = core + halo;
    col += vec4(mix(uColor, vec3(1.0), core * 0.5) * a, a) * (1.0 - col.a * 0.5);
  }
}
col = min(col, vec4(1.0)) * uOpacity;
return half4(col);`,

  // ---------- cyberpunk / dramático ----------
  glitch: `
// interferência da Matrix: faixas, blocos ciano/magenta e chiado
float t = floor(time * 8.0 * uSpeed);
vec2 uv = coord / size;
float band = step(0.82, h12(vec2(floor(uv.y * 40.0 / uScale), t)));
float block = step(0.985 - 0.02 * uDensity, h12(floor(p * vec2(0.6, 2.4) / uScale) + t));
float scan = 0.5 + 0.5 * sin(coord.y / uCell * 40.0 + time * 30.0);
float burst = step(0.75, h12(vec2(floor(time * 2.0), 3.0)));
vec3 c = mix(uColor, vec3(1.0, 0.1, 0.8), step(0.5, h12(floor(p * 0.6) + t + 7.0)));
float a = (band * 0.18 + block * 0.55) * (0.4 + 0.6 * burst) * uDensity + scan * 0.04;
float noise = step(0.997 - 0.004 * uDensity, h12(floor(coord * 0.5) + fract(time) * 100.0)) * 0.7;
vec4 col = vec4(c * a + vec3(noise), a + noise);
col = min(col, vec4(1.0)) * uOpacity;
return half4(col);`,

  pulse: `
// pulso do chefe: vinheta que bate como um coração
vec2 uv = coord / size - 0.5;
uv.x *= size.x / size.y;
float edge = smoothstep(0.25, 0.85, length(uv) * 1.25);
float bpm = 50.0 + 60.0 * uSpeed;
float t = fract(time * bpm / 60.0);
float beat = exp(-t * 14.0) + 0.6 * exp(-max(t - 0.2, 0.0) * 14.0) * step(0.2, t);
float a = edge * (0.18 + 0.55 * beat) * clamp(uDensity, 0.0, 1.6);
// veias escuras na borda
float veins = smoothstep(0.55, 0.62, fbm(p * 0.5 / uScale)) * edge * 0.5;
vec3 c = mix(uColor, uColor * 0.3, veins);
vec4 col = vec4(c * a, a) * uOpacity;
return half4(col);`,

  sparks: `
// faíscas elétricas: estalos rápidos em lugares aleatórios
vec4 col = vec4(0.0);
float t = floor(time * 6.0 * uSpeed);
vec2 g = p * 0.5 / uScale;
vec2 id = floor(g);
float r = h12(id + t);
if (r < 0.28 * uDensity) {
  vec2 f = fract(g) - 0.5;
  float ang = h12(id + t + 4.0) * 6.2831;
  vec2 d = vec2(cos(ang), sin(ang));
  // raio em ziguezague
  float s = dot(f, d);
  vec2 perp = vec2(-d.y, d.x);
  float z = (h12(vec2(floor(s * 12.0), t + id.x)) - 0.5) * 0.08;
  float line = (1.0 - smoothstep(0.008, 0.03, abs(dot(f, perp) - z))) * step(abs(s), 0.4);
  float fade = 1.0 - fract(time * 6.0 * uSpeed);
  float a = line * fade;
  col = vec4(mix(uColor, vec3(1.0), 0.6) * a, a);
  float glow = (1.0 - smoothstep(0.0, 0.25, length(f))) * 0.25 * fade;
  col += vec4(uColor * glow, glow) * (1.0 - col.a);
}
col *= uOpacity;
return half4(col);`,

  underwater: `
// debaixo d'água: cáusticas de luz e bolhas
vec2 q = p * 0.35 / uScale;
float c1 = vnoise(q * 2.0 + vec2(time * 0.3 * uSpeed, 0.0));
float c2 = vnoise(q * 2.0 - vec2(0.0, time * 0.25 * uSpeed) + 3.0);
float caust = pow(1.0 - abs(c1 - c2), 16.0) * 0.4 * uDensity;
float tint = 0.18 * uDensity;
vec4 col = vec4(uColor * tint, tint);
col += vec4(vec3(0.8, 1.0, 1.0) * caust, caust) * (1.0 - col.a);
vec3 pr = particleLayer(p * 1.4 / uScale, vec2(0.0, -1.0), 0.6 * uSpeed, 0.15 * uDensity, 0.06, 0.8, 33.0);
float ring = smoothstep(0.0, 0.4, pr.x) * (1.0 - smoothstep(0.4, 0.9, pr.x)) * 0.8;
col += vec4(vec3(0.9, 1.0, 1.0) * ring, ring) * (1.0 - col.a);
col *= uOpacity;
return half4(col);`,
};

export const TYPES = [
  { id: "rain", label: "Chuva", group: "Água", color: "#a9c4e8", density: 1, speed: 1, dir: 0 },
  { id: "storm", label: "Tempestade (com relâmpagos)", group: "Água", color: "#b8c8e0", density: 1.2, speed: 1.2, dir: 20 },
  { id: "acid", label: "Chuva ácida neon", group: "Água", color: "#4dff7a", density: 0.9, speed: 0.8, dir: 0 },
  { id: "underwater", label: "Debaixo d'água", group: "Água", color: "#1d6f8a", density: 1, speed: 1, dir: 0 },
  { id: "snow", label: "Neve", group: "Frio", color: "#ffffff", density: 1, speed: 1, dir: 0 },
  { id: "blizzard", label: "Nevasca", group: "Frio", color: "#e8f0ff", density: 1.2, speed: 1.2, dir: 70 },
  { id: "embers", label: "Brasas", group: "Fogo", color: "#ff6a1a", density: 1, speed: 1, dir: 0 },
  { id: "ash", label: "Cinzas caindo", group: "Fogo", color: "#c2bbb2", density: 1, speed: 1, dir: 0 },
  { id: "heat", label: "Calor / fornalha", group: "Fogo", color: "#ff9a3a", density: 1, speed: 1, dir: 0 },
  { id: "smoke", label: "Fumaça", group: "Fogo", color: "#4a4a4f", density: 1, speed: 1, dir: 0 },
  { id: "fog", label: "Neblina", group: "Névoa", color: "#d8dde4", density: 0.9, speed: 1, dir: 90 },
  { id: "toxic", label: "Gás tóxico", group: "Névoa", color: "#7dff3a", density: 0.9, speed: 1, dir: 90 },
  { id: "clouds", label: "Sombra de nuvens", group: "Névoa", color: "#05070c", density: 1, speed: 1, dir: 60 },
  { id: "sand", label: "Tempestade de areia", group: "Névoa", color: "#d6a866", density: 1, speed: 1, dir: 90 },
  { id: "leaves", label: "Folhas / pétalas", group: "Natureza", color: "#d9762b", density: 1, speed: 1, dir: 30 },
  { id: "spores", label: "Esporos / vaga-lumes", group: "Natureza", color: "#c8ff6a", density: 1, speed: 1, dir: 0 },
  { id: "glitch", label: "Interferência (Matrix)", group: "Dramático", color: "#21f0ff", density: 1, speed: 1, dir: 0 },
  { id: "sparks", label: "Faíscas elétricas", group: "Dramático", color: "#7fd8ff", density: 1, speed: 1, dir: 0 },
  { id: "pulse", label: "Pulso do chefe (vinheta)", group: "Dramático", color: "#b0000f", density: 1, speed: 1, dir: 0 },
];

export const NEEDS_PARTICLES = new Set(["snow", "blizzard", "embers", "ash", "heat", "toxic", "sand", "underwater"]);

/** SkSL completo de um clima. */
export function buildSksl(type) {
  const body = BODIES[type] || BODIES.snow;
  const parts = NEEDS_PARTICLES.has(type) ? PARTICLES : "";
  return `${HEADER}\n${parts}\nhalf4 main(float2 coord) {\n  vec2 p = coord / uCell;\n${body}\n}\n`;
}

export function hexToVec3(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return { x: ((n >> 16) & 255) / 255, y: ((n >> 8) & 255) / 255, z: (n & 255) / 255 };
}

/** Uniforms de uma camada. dir em graus (0 = vento soprando para a direita, 90 = para baixo). */
export function buildUniforms(layer, cell, flash = 0) {
  const a = ((layer.dir ?? 0) * Math.PI) / 180;
  return [
    { name: "uDir", value: { x: Math.cos(a), y: Math.sin(a) } },
    { name: "uSpeed", value: layer.speed ?? 1 },
    { name: "uDensity", value: layer.density ?? 1 },
    { name: "uScale", value: layer.scale ?? 1 },
    { name: "uColor", value: hexToVec3(layer.color) },
    { name: "uOpacity", value: layer.opacity ?? 1 },
    { name: "uFlash", value: flash },
    { name: "uCell", value: cell },
  ];
}
