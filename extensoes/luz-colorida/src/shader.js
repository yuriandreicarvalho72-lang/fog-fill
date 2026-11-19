// Gera o shader (SkSL) que pinta as luzes coloridas por cima do mapa.
// Um único efeito de VIEWPORT desenha todas as luzes coloridas, com sombra das paredes.
// Funções puras: sem OBR, testáveis em Node (CanvasKit).

export const MAX_LIGHTS = 24;

// animações por luz (o número vai para o shader)
export const ANIMS = [
  { id: 0, key: "none", label: "Fixa" },
  { id: 1, key: "flicker", label: "Tocha / fogo (tremula)" },
  { id: 2, key: "pulse", label: "Alarme (pulsa)" },
  { id: 3, key: "strobe", label: "Estrobo (pisca rápido)" },
  { id: 4, key: "beacon", label: "Giroflex (feixe girando)" },
  { id: 5, key: "faulty", label: "Lâmpada com defeito (falha)" },
  { id: 6, key: "breathe", label: "Respirando (lento e suave)" },
];
export const animId = (key) => ANIMS.find((a) => a.key === key)?.id ?? 0;

/**
 * @param {number} nL número de luzes (1..MAX_LIGHTS)
 * @param {number} nS número de segmentos de parede (0..)
 */
export function buildSksl(nL, nS, mode = "standalone", debug = false, animated = false) {
  const u = [];
  if (animated) u.push("uniform float time;");
  if (mode === "viewport") u.push("uniform mat3 view;", "uniform vec2 size;", "uniform vec2 css;");
  else if (mode === "local") u.push("uniform vec2 position;", "uniform vec2 size;", "uniform vec2 wsize;");
  else u.push("uniform mat3 model;", "uniform mat3 modelView;", "uniform vec2 size;", "uniform vec2 wsize;");
  for (let i = 0; i < nL; i++) {
    u.push(`uniform vec2 lp${i};`);   // posição da luz (mundo)
    u.push(`uniform vec3 lc${i};`);   // cor (0..1)
    u.push(`uniform vec3 la${i};`);   // raio, suavidade da borda (0..1), intensidade
    u.push(`uniform vec3 ld${i};`);   // direção (rad), meio-ângulo interno, meio-ângulo externo (rad)
    if (animated) u.push(`uniform vec3 lx${i};`); // animação: tipo, velocidade, semente
  }
  for (let j = 0; j < nS; j++) u.push(`uniform vec2 sa${j}; uniform vec2 sb${j};`);

  const fn = `
// true se o segmento p->q cruza o segmento a->b
bool cross(float2 p, float2 q, float2 a, float2 b) {
  float2 r = q - p, s = b - a;
  float den = r.x * s.y - r.y * s.x;
  if (abs(den) < 1e-6) return false;
  float2 ap = a - p;
  float t = (ap.x * s.y - ap.y * s.x) / den;
  float v = (ap.x * r.y - ap.y * r.x) / den;
  return t > 0.0005 && t < 0.9995 && v >= 0.0 && v <= 1.0;
}
float angDiff(float a, float b) {
  float d = abs(a - b);
  d = mod(d, 6.2831853);
  return min(d, 6.2831853 - d);
}${animated ? `
float hash1(float n) { return fract(sin(n * 91.345) * 43758.5453); }
// fator de brilho da animação (0..1); ang = ângulo do pixel visto da luz
float anim(float3 x, float t, float ang) {
  float k = x.x, s = x.y, sd = x.z;
  if (k < 0.5) return 1.0;
  float ts = t * s + sd * 7.13;
  if (k < 1.5) { // tocha
    float n = 0.5 * sin(ts * 7.3) + 0.3 * sin(ts * 13.1 + 1.7) + 0.2 * sin(ts * 23.7 + 4.1);
    return 0.8 + 0.2 * n;
  }
  if (k < 2.5) return 0.12 + 0.88 * (0.5 + 0.5 * sin(ts * 3.2)); // alarme
  if (k < 3.5) return step(fract(ts * 2.2), 0.14);               // estrobo
  if (k < 4.5) {                                                 // giroflex: dois feixes opostos
    float a = mod(ts * 3.0, 6.2831853);
    float m = max(1.0 - smoothstep(0.35, 0.75, angDiff(ang, a)), 1.0 - smoothstep(0.35, 0.75, angDiff(ang, a + 3.1415927)));
    return 0.1 + 0.9 * m;
  }
  if (k < 5.5) {                                                 // defeito: apaga em rajadas
    float b = floor(ts * 9.0);
    float off = step(0.78, hash1(b)) * step(0.35, hash1(floor(ts * 1.3) + 17.0));
    return mix(1.0, 0.06 + 0.25 * hash1(b + 3.0), off);
  }
  return 0.45 + 0.55 * (0.5 + 0.5 * sin(ts * 1.1));              // respirando
}` : ""}`;

  const body = [];
  // Lê escala e translação de uma mat3 afim sem depender de ela vir por linha ou por coluna.
  const affine = (m, p) => [
    `  float ${p}A = ${m}[0][0]; float ${p}D = ${m}[1][1];`,
    `  float ${p}X = ${m}[2][0] + ${m}[0][2]; float ${p}Y = ${m}[2][1] + ${m}[1][2];`,
  ];
  if (mode === "viewport") {
    // coord em pixels da tela (talvez físicos); css = tamanho da tela em pixels CSS
    body.push(...affine("view", "v"));
    body.push(`  float r = size.x / max(css.x, 1.0);`);
    body.push(`  float2 w = float2((coord.x / r - vX) / vA, (coord.y / r - vY) / vD);`);
  } else if (mode === "local") {
    // coord local ao retângulo do efeito
    body.push(`  float2 w = position + coord * (wsize / max(size, float2(1.0)));`);
  } else {
    // coord em pixels da tela; desfaz modelView (local -> tela) e refaz model (local -> mundo)
    body.push(...affine("modelView", "mv"));
    body.push(...affine("model", "m"));
    body.push(`  float r = size.x / max(wsize.x * abs(mvA), 0.0001);`);
    body.push(`  float2 lc = float2((coord.x / r - mvX) / mvA, (coord.y / r - mvY) / mvD);`);
    body.push(`  float2 w = float2(lc.x * mA + mX, lc.y * mD + mY);`);
  }
  body.push(`  float3 acc = float3(0.0);`);
  body.push(`  float am = 0.0;`);
  for (let i = 0; i < nL; i++) {
    body.push(`  {
    float2 d = w - lp${i};
    float dist = length(d);
    if (dist < la${i}.x) {
      float t = dist / la${i}.x;
      float a = la${i}.z * (1.0 - smoothstep(1.0 - la${i}.y, 1.0, t)) * (1.0 - 0.35 * t);${animated ? `
      a *= anim(lx${i}, time, atan(d.y, d.x));` : ""}
      if (ld${i}.z < 3.14) {
        float th = angDiff(atan(d.y, d.x), ld${i}.x);
        a *= 1.0 - smoothstep(ld${i}.y, max(ld${i}.z, ld${i}.y + 0.001), th);
      }
      bool lit = a > 0.002;`);
    for (let j = 0; j < nS; j++) body.push(`      if (lit && cross(lp${i}, w, sa${j}, sb${j})) lit = false;`);
    body.push(`      if (lit) { acc += lc${i} * a; am = max(am, a); }
      ${debug ? `if (abs(dist - la${i}.x * 0.08) < la${i}.x * 0.012) { acc = float3(1.0); am = 1.0; }` : ""}
    }
  }`);
  }
  body.push(`  am = clamp(am, 0.0, 1.0);`);
  body.push(`  return half4(half3(clamp(acc, 0.0, 1.0)), half(am));`);

  return `${u.join("\n")}\n${fn}\n\nhalf4 main(float2 coord) {\n${body.join("\n")}\n}\n`;
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return { x: ((n >> 16) & 255) / 255, y: ((n >> 8) & 255) / 255, z: (n & 255) / 255 };
}

/**
 * Monta os uniforms.
 * lights: [{x, y, radius, softness, intensity, color:"#rrggbb", dir(rad), inner(rad meia), outer(rad meia)}]
 * segs:   [{ax, ay, bx, by}]
 */
export function buildUniforms(lights, segs, animated = false) {
  const u = [];
  lights.forEach((l, i) => {
    if (animated) u.push({ name: `lx${i}`, value: { x: l.anim || 0, y: l.speed ?? 1, z: i * 1.618 } });
    u.push({ name: `lp${i}`, value: { x: l.x, y: l.y } });
    u.push({ name: `lc${i}`, value: hexToRgb(l.color) });
    u.push({ name: `la${i}`, value: { x: l.radius, y: l.softness, z: l.intensity } });
    u.push({ name: `ld${i}`, value: { x: l.dir, y: l.inner, z: l.outer } });
  });
  segs.forEach((s, j) => {
    u.push({ name: `sa${j}`, value: { x: s.ax, y: s.ay } });
    u.push({ name: `sb${j}`, value: { x: s.bx, y: s.by } });
  });
  return u;
}
