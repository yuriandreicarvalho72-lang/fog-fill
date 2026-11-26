// Motor dos efeitos do Arsenal: monta a "coreografia" de um disparo como uma lista de elementos
// (linha, círculo, polígono, rótulo), cada um com uma função frame(t) que diz como ele está no instante t.
// Funções puras, sem SDK: o render (render.js) transforma isso em itens locais do Owlbear.

/** Gerador pseudoaleatório com semente (todos os jogadores veem o mesmo disparo). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a, k) => ({ x: a.x * k, y: a.y * k }),
  len: (a) => Math.hypot(a.x, a.y),
  norm: (a) => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; },
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
  rot: (a, ang) => ({ x: a.x * Math.cos(ang) - a.y * Math.sin(ang), y: a.x * Math.sin(ang) + a.y * Math.cos(ang) }),
  perp: (a) => ({ x: -a.y, y: a.x }),
};
export { V };
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOut = (t) => 1 - (1 - t) * (1 - t);

/** Aparência padrão de cada tipo de efeito. Tamanhos em quadrados; velocidade em quadrados por segundo. */
export const PROFILES = {
  pistol:   { label: "Pistola", color: "#ffd27a", w: 0.035, speed: 45, flash: 0.35, casing: true, impact: 0.35 },
  revolver: { label: "Revólver", color: "#ffc35a", w: 0.045, speed: 45, flash: 0.55, casing: false, impact: 0.45 },
  smg:      { label: "Submetralhadora", color: "#ffdc8a", w: 0.03, speed: 50, flash: 0.32, casing: true, impact: 0.3 },
  rifle:    { label: "Rifle / carabina", color: "#ffe08f", w: 0.04, speed: 60, flash: 0.45, casing: true, impact: 0.4 },
  sniper:   { label: "Rifle de precisão", color: "#fff2c0", w: 0.06, speed: 95, flash: 0.7, casing: true, impact: 0.65, laser: true },
  shotgun:  { label: "Escopeta", color: "#ffcf70", w: 0.025, speed: 40, flash: 0.7, casing: true, impact: 0.25, pellets: 9 },
  mg:       { label: "Metralhadora leve", color: "#ffd77a", w: 0.04, speed: 60, flash: 0.5, casing: true, impact: 0.4 },
  mgm:      { label: "Metralhadora média", color: "#ffcc66", w: 0.05, speed: 65, flash: 0.6, casing: true, impact: 0.5 },
  hmg:      { label: "Metralhadora pesada", color: "#ffbf4d", w: 0.07, speed: 70, flash: 0.85, casing: true, impact: 0.75 },
  bow:      { label: "Arco / flecha", color: "#d9c7a3", w: 0.03, speed: 22, flash: 0, casing: false, impact: 0.3, arrow: true },
  laser:    { label: "Laser", color: "#ff3b4f", w: 0.05, speed: 0, flash: 0.35, casing: false, impact: 0.4, beam: true },
  plasma:   { label: "Plasma", color: "#d65cff", w: 0.12, speed: 22, flash: 0.45, casing: false, impact: 0.6, bolt: true },
  ion:      { label: "Íons", color: "#5cc8ff", w: 0.1, speed: 26, flash: 0.4, casing: false, impact: 0.5, bolt: true },
  rail:     { label: "Gauss / railgun", color: "#bfe8ff", w: 0.06, speed: 0, flash: 0.6, casing: false, impact: 0.7, beam: true, rail: true },
  tesla:    { label: "Tesla", color: "#7af0ff", w: 0.035, speed: 0, flash: 0.4, casing: false, impact: 0.4, arc: true },
  taser:    { label: "Taser / choque", color: "#9fe7ff", w: 0.02, speed: 0, flash: 0.15, casing: false, impact: 0.3, taser: true },
  beanbag:  { label: "Não letal (borracha)", color: "#d8d8d8", w: 0.05, speed: 25, flash: 0.5, casing: true, impact: 0.3, soft: true },
  foam:     { label: "Espuma de contenção", color: "#f4f7ff", w: 0.06, speed: 0, flash: 0.2, casing: false, impact: 0.5, spray: "foam" },
  flame:    { label: "Lança-chamas", color: "#ff8a1f", w: 0, speed: 0, flash: 0, casing: false, impact: 0, spray: "flame" },
  cryo:     { label: "Criogênico", color: "#bdf4ff", w: 0, speed: 0, flash: 0, casing: false, impact: 0, spray: "cryo" },
  acid:     { label: "Ácido", color: "#9dff3a", w: 0, speed: 0, flash: 0, casing: false, impact: 0, spray: "acid" },
  gas:      { label: "Gás / químico", color: "#c9e86a", w: 0, speed: 0, flash: 0.3, casing: false, impact: 0, lob: "gas" },
  nanite:   { label: "Nanites", color: "#5f6b78", w: 0, speed: 0, flash: 0.3, casing: false, impact: 0, lob: "nanite" },
  grenade:  { label: "Lança-granadas", color: "#ffb347", w: 0, speed: 0, flash: 0.5, casing: false, impact: 0, lob: "frag" },
  rocket:   { label: "Foguete / míssil", color: "#ffa04d", w: 0, speed: 16, flash: 0.9, casing: false, impact: 0, rocket: true },
  cannon:   { label: "Canhão", color: "#ffb84d", w: 0.12, speed: 55, flash: 1.1, casing: true, impact: 0, boom: 1.4 },
  melee:    { label: "Corpo a corpo", color: "#e8eef5", w: 0, speed: 0, flash: 0, casing: false, impact: 0 },
  frag:     { label: "Granada de fragmentação", color: "#ffb347", w: 0, speed: 0, flash: 0, casing: false, impact: 0, lob: "frag", thrown: true },
  smoke:    { label: "Granada de fumaça", color: "#9aa3ad", w: 0, speed: 0, flash: 0, casing: false, impact: 0, lob: "smoke", thrown: true },
  flashbang:{ label: "Granada de luz (flashbang)", color: "#ffffff", w: 0, speed: 0, flash: 0, casing: false, impact: 0, lob: "flashbang", thrown: true },
};

/** Balas gastas por modo. */
export const ROUNDS = { single: 1, burst: 3, auto: 10, supp: 20, spray: 1 };
export const MODE_LABEL = { single: "Tiro único", burst: "Rajada", auto: "Automático", supp: "Supressão", spray: "Jato" };

/**
 * Monta o disparo.
 * spec: { fx, mode, from, targets:[{at, kind:"flesh"|"metal"|"ground"}], hit, cell, seed,
 *         speed (multiplicador), intensity (0.5..1.5), color?, gore, casings, smokeSec }
 * Devolve { elements, duration } — cada elemento: { kind, t0, t1, frame(t) -> props | null }
 */
export function buildShot(spec) {
  const P = PROFILES[spec.fx] || PROFILES.rifle;
  const cell = spec.cell || 150;
  const R = rng(spec.seed || 1);
  const I = Math.max(0.4, Math.min(1.6, spec.intensity ?? 1));
  const spd = Math.max(0.25, Math.min(3, spec.speed ?? 1));
  const color = spec.color || P.color;
  const els = [];
  // cada elemento leva uma etiqueta (muzzle, tracer, impact...) para a camada de vídeo (jb2a.js)
  // poder trocar só algumas partes; a etiqueta da função mais de fora vale.
  let tag = "";
  const add = (e) => { e.tag = tag || "misc"; els.push(e); return e; };
  const T = (name, fn) => (...a) => { if (tag) return fn(...a); tag = name; try { return fn(...a); } finally { tag = ""; } };
  const shotLog = []; // cada tiro: { t, from, to, target, hit, pellets? }
  const landLog = []; // granadas, foguetes, jatos: { t, from, dest, target }
  const from = spec.from;
  const targets = spec.targets?.length ? spec.targets : [{ at: V.add(from, { x: cell * 4, y: 0 }), kind: "ground" }];
  const gore = spec.gore !== false, casings = spec.casings !== false && P.casing;

  // ---------- primitivos ----------
  const muzzle = T("muzzle", (t, dir, size) => {
    if (size <= 0) return;
    const s = size * cell * I, at = V.add(from, V.mul(dir, cell * 0.45)), d = 0.07;
    const spikes = [];
    const n = 7;
    for (let i = 0; i < n * 2; i++) {
      const ang = (i / (n * 2)) * Math.PI * 2;
      const fwd = Math.max(0, Math.cos(ang));
      const r = i % 2 ? s * 0.25 : s * (0.45 + 1.1 * fwd * fwd);
      spikes.push(V.add(at, V.mul(V.rot(dir, ang), r)));
    }
    add({ kind: "path", t0: t, t1: t + d, frame: (u) => {
      const k = 1 - Math.abs(u * 2 - 1);
      return { pts: spikes.map((p) => V.lerp(at, p, 0.4 + 0.6 * k)), closed: true, fill: "#fff3c4", fillOpacity: 0.95 * k, stroke: color, strokeOpacity: 0.8 * k, strokeWidth: cell * 0.02 };
    } });
    add({ kind: "circle", t0: t, t1: t + d * 2.2, frame: (u) => ({ c: at, r: s * (0.5 + 0.5 * u), fill: color, fillOpacity: 0.35 * (1 - u), strokeOpacity: 0 }) });
  });

  const tracer = T("tracer", (t, a, b, w, col = color, speedCells = P.speed) => {
    const dist = V.len(V.sub(b, a));
    const travel = Math.max(0.04, dist / (speedCells * cell * spd));
    const tail = Math.min(dist, cell * (1.2 + speedCells / 40));
    const dir = V.norm(V.sub(b, a));
    const at = (u) => {
      const head = V.lerp(a, b, clamp01(u));
      const back = V.sub(head, V.mul(dir, Math.min(tail, V.len(V.sub(head, a)))));
      return [back, head];
    };
    for (const [ww, op] of [[w * 3.2, 0.22], [w, 0.95]]) {
      add({ kind: "line", t0: t, t1: t + travel + 0.05, frame: (tt) => {
        const u = (tt - t) / travel;
        const [p, q] = u <= 1 ? at(u) : [V.lerp(at(1)[0], b, clamp01((u - 1) * travel / 0.05)), b];
        return { a: p, b: q, color: col, width: Math.max(1.5, ww * cell * I), opacity: op };
      } });
    }
    return t + travel;
  });

  const sparks = T("impact", (t, at, dirIn, n, size, col = "#ffd36b") => {
    for (let i = 0; i < n; i++) {
      const back = V.mul(dirIn, -1);
      const ang = (R() - 0.5) * Math.PI * 1.3;
      const v = V.mul(V.rot(back, ang), cell * size * (2 + R() * 3));
      const life = 0.18 + R() * 0.15;
      add({ kind: "line", t0: t, t1: t + life, frame: (tt) => {
        const u = (tt - t) / life;
        const p = V.add(at, V.mul(v, easeOut(u) * 0.5));
        return { a: p, b: V.add(p, V.mul(v, 0.08)), color: col, width: Math.max(1.5, cell * 0.02 * I), opacity: 1 - u };
      } });
    }
    add({ kind: "circle", t0: t, t1: t + 0.12, frame: (tt) => { const u = (tt - t) / 0.12; return { c: at, r: cell * size * 0.6 * (0.6 + u), fill: "#fff6d0", fillOpacity: 0.8 * (1 - u), strokeOpacity: 0 }; } });
  });

  const blood = T("impact", (t, at, dirIn, size) => {
    if (!gore) { sparks(t, at, dirIn, 3, size * 0.6, "#ff6b6b"); return; }
    const n = Math.round(5 + 4 * I);
    for (let i = 0; i < n; i++) {
      const off = V.add(V.mul(dirIn, cell * size * (0.2 + R() * 1.4)), V.mul(V.perp(dirIn), cell * size * (R() - 0.5) * 1.2));
      const r = cell * size * (0.12 + R() * 0.22);
      const life = 1.4 + R() * 0.8;
      add({ kind: "circle", t0: t, t1: t + life, frame: (tt) => {
        const u = (tt - t) / life;
        const grow = clamp01((tt - t) / 0.12);
        return { c: V.add(at, V.mul(off, grow)), r: r * (0.4 + 0.6 * grow), fill: i % 3 ? "#8a0f12" : "#b3171b", fillOpacity: 0.85 * (1 - clamp01((u - 0.5) * 2)), strokeOpacity: 0 };
      } });
    }
  });

  const dust = T("impact", (t, at, size, col = "#a8987e") => {
    for (let i = 0; i < 5; i++) {
      const off = V.mul(V.rot({ x: 1, y: 0 }, R() * Math.PI * 2), cell * size * R() * 0.6);
      const life = 0.5 + R() * 0.4;
      add({ kind: "circle", t0: t, t1: t + life, frame: (tt) => {
        const u = (tt - t) / life;
        return { c: V.add(at, V.mul(off, 1 + u)), r: cell * size * (0.2 + 0.5 * easeOut(u)), fill: col, fillOpacity: 0.55 * (1 - u), strokeOpacity: 0 };
      } });
    }
  });

  const ricochet = T("impact", (t, at, dirIn) => {
    const out = V.rot(V.mul(dirIn, -1), (R() > 0.5 ? 1 : -1) * (0.6 + R() * 0.9));
    tracer(t, at, V.add(at, V.mul(out, cell * (1.5 + R()))), P.w * 0.7, "#ffe3a0", 30);
  });

  const casing = T("casing", (t, dir) => {
    if (!casings) return;
    const side = V.perp(dir);
    const v = V.add(V.mul(side, cell * (0.9 + R() * 0.6)), V.mul(dir, -cell * 0.3 * R()));
    const life = 1.6;
    add({ kind: "circle", t0: t, t1: t + life, frame: (tt) => {
      const u = clamp01((tt - t) / 0.35);
      const hop = Math.sin(u * Math.PI) * cell * 0.35;
      return { c: V.add(V.add(from, V.mul(v, easeOut(u))), { x: 0, y: -hop }), r: cell * 0.035, fill: "#d4a640", fillOpacity: 1 - clamp01(((tt - t) - 1.0) / 0.6), strokeOpacity: 0 };
    } });
  });

  const impact = T("impact", (t, tg, dirIn, hit, size) => {
    if (!hit) { dust(t, tg.at, size * 0.8); if (R() < 0.6) ricochet(t, tg.at, dirIn); return; }
    if (P.soft) { dust(t, tg.at, size * 0.7, "#cfcfcf"); return; }
    if (tg.kind === "metal") sparks(t, tg.at, dirIn, Math.round(6 * I), size);
    else if (tg.kind === "flesh") blood(t, tg.at, dirIn, size);
    else dust(t, tg.at, size);
  });

  const flashCircle = T("flash", (t, at, rad, life, col, op = 0.9) => add({ kind: "circle", t0: t, t1: t + life, frame: (tt) => {
    const u = (tt - t) / life;
    return { c: at, r: rad * (0.3 + 0.7 * easeOut(clamp01(u * 3))), fill: col, fillOpacity: op * (1 - u), strokeOpacity: 0 };
  } }));

  const ring = T("flash", (t, at, rad, life, col, w = 0.05) => add({ kind: "circle", t0: t, t1: t + life, frame: (tt) => {
    const u = (tt - t) / life;
    return { c: at, r: rad * easeOut(u), fillOpacity: 0, stroke: col, strokeOpacity: 0.9 * (1 - u), strokeWidth: cell * w * I };
  } }));

  const explosion = T("boom", (t, at, size) => {
    const Rr = cell * size * I;
    flashCircle(t, at, Rr, 0.35, "#fff2b0", 0.95);
    ring(t, at, Rr * 1.5, 0.45, "#ffd27a", 0.06);
    for (let i = 0; i < 7; i++) {
      const off = V.mul(V.rot({ x: 1, y: 0 }, R() * Math.PI * 2), Rr * R() * 0.6);
      const life = 0.5 + R() * 0.3;
      add({ kind: "circle", t0: t + 0.03, t1: t + 0.03 + life, frame: (tt) => {
        const u = (tt - t - 0.03) / life;
        return { c: V.add(at, V.mul(off, 1 + u)), r: Rr * (0.25 + 0.35 * easeOut(u)), fill: i % 2 ? "#ff7a1a" : "#ffb02e", fillOpacity: 0.85 * (1 - u), strokeOpacity: 0 };
      } });
    }
    for (let i = 0; i < 9; i++) {
      const off = V.mul(V.rot({ x: 1, y: 0 }, R() * Math.PI * 2), Rr * R() * 0.7);
      const life = 2.2 + R() * 1.2;
      add({ kind: "circle", t0: t + 0.2, t1: t + 0.2 + life, frame: (tt) => {
        const u = (tt - t - 0.2) / life;
        return { c: V.add(V.add(at, V.mul(off, 1 + u * 0.6)), { x: 0, y: -Rr * 0.5 * u }), r: Rr * (0.3 + 0.5 * easeOut(u)), fill: "#4a4a4a", fillOpacity: 0.55 * (1 - u), strokeOpacity: 0 };
      } });
    }
    for (let i = 0; i < 10; i++) {
      const v = V.mul(V.rot({ x: 1, y: 0 }, R() * Math.PI * 2), Rr * (1.2 + R()));
      const life = 0.35 + R() * 0.2;
      add({ kind: "line", t0: t, t1: t + life, frame: (tt) => {
        const u = (tt - t) / life;
        const p = V.add(at, V.mul(v, easeOut(u)));
        return { a: p, b: V.add(p, V.mul(v, 0.1)), color: "#ffd36b", width: Math.max(1.5, cell * 0.025), opacity: 1 - u };
      } });
    }
  });

  const cloud = T("cloud", (t, at, radius, col, dur, sparkle = null) => {
    const Rr = cell * radius;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + R();
      const off = V.mul({ x: Math.cos(ang), y: Math.sin(ang) }, Rr * (0.15 + R() * 0.55));
      const r = Rr * (0.35 + R() * 0.25);
      add({ kind: "circle", t0: t, t1: t + dur + 3, frame: (tt) => {
        const e = tt - t;
        const grow = easeOut(clamp01(e / 1.5));
        const fade = 1 - clamp01((e - dur) / 3);
        return { c: V.add(at, V.mul(off, grow)), r: r * (0.3 + 0.7 * grow), fill: col, fillOpacity: 0.62 * fade, strokeOpacity: 0 };
      } });
    }
    if (sparkle) {
      for (let i = 0; i < 12; i++) {
        const off = V.mul(V.rot({ x: 1, y: 0 }, R() * Math.PI * 2), Rr * R() * 0.8);
        const ph = R() * 6;
        add({ kind: "circle", t0: t + 0.5, t1: t + dur + 1, frame: (tt) => {
          const on = Math.sin((tt + ph) * 9) > 0.3 && tt < t + dur;
          return { c: V.add(at, off), r: cell * 0.04, fill: sparkle, fillOpacity: on ? 0.95 : 0, strokeOpacity: 0 };
        } });
      }
    }
  });

  const lob = T("lob", (t, a, b, size, col, dur) => {
    // trajetória em arco (vista de cima: sobe na tela e desce no alvo)
    const dist = V.len(V.sub(b, a)), H = dist * 0.28;
    const pos = (u) => V.add(V.lerp(a, b, u), { x: 0, y: -4 * H * u * (1 - u) });
    add({ kind: "circle", t0: t, t1: t + dur, frame: (tt) => ({ c: pos(clamp01((tt - t) / dur)), r: cell * size, fill: col, fillOpacity: 1, stroke: "#222", strokeOpacity: 0.6, strokeWidth: 2 }) });
    for (let k = 1; k < 8; k++) {
      const u0 = k / 8;
      add({ kind: "circle", t0: t + dur * u0, t1: t + dur * u0 + 0.4, frame: (tt) => {
        const u = (tt - t - dur * u0) / 0.4;
        return { c: pos(u0), r: cell * size * 0.7 * (1 + u), fill: "#bbbbbb", fillOpacity: 0.35 * (1 - u), strokeOpacity: 0 };
      } });
    }
    return t + dur;
  });

  const beam = T("beam", (t, a, b, w, col, life) => {
    for (const [ww, op] of [[w * 3.5, 0.28], [w, 1]]) {
      add({ kind: "line", t0: t, t1: t + life, frame: (tt) => {
        const u = (tt - t) / life;
        const pulse = 0.75 + 0.25 * Math.sin((tt - t) * 60);
        return { a, b, color: ww === w ? "#ffffff" : col, width: Math.max(2, ww * cell * I * (1 - u * 0.6)), opacity: op * pulse * (1 - u) };
      } });
    }
    add({ kind: "line", t0: t, t1: t + life, frame: (tt) => ({ a, b, color: col, width: Math.max(1.5, w * 1.6 * cell * I), opacity: 0.8 * (1 - (tt - t) / life) }) });
  });

  const zigzag = (a, b, jitter, segs, k) => {
    const r = rng(k);
    const pts = [a];
    const dir = V.sub(b, a), perp = V.norm(V.perp(dir));
    for (let i = 1; i < segs; i++) pts.push(V.add(V.lerp(a, b, i / segs), V.mul(perp, (r() - 0.5) * jitter)));
    pts.push(b);
    return pts;
  };
  const arc = T("arc", (t, a, b, col, life, jitterCells = 0.5) => {
    for (const [ww, op] of [[0.11, 0.25], [0.035, 1]]) {
      add({ kind: "path", t0: t, t1: t + life, frame: (tt) => {
        const f = Math.floor((tt - t) * 30);
        return { pts: zigzag(a, b, cell * jitterCells, 9, (spec.seed || 1) * 31 + f), closed: false, fillOpacity: 0, stroke: ww > 0.05 ? col : "#ffffff", strokeOpacity: op, strokeWidth: Math.max(1.5, ww * cell * I) };
      } });
    }
  });

  const spray = T("spray", (t, a, b, kind, life) => {
    const dir = V.norm(V.sub(b, a)), dist = Math.max(cell * 2, V.len(V.sub(b, a)));
    const pal = {
      flame: ["#fff3a0", "#ffb000", "#ff6a00", "#b8320a", "#3a2a24"],
      cryo: ["#ffffff", "#dff8ff", "#a6ecff", "#7fd3f0", "#cfefff"],
      acid: ["#eaff9a", "#b7ff3a", "#7fdc1c", "#4f9a12", "#3d5c1a"],
      foam: ["#ffffff", "#f6f8ff", "#e9eef8", "#dfe6f2", "#cfd8e8"],
    }[kind];
    const n = Math.round(46 * I);
    for (let i = 0; i < n; i++) {
      const born = t + (i / n) * life * 0.75;
      const ang = (R() - 0.5) * 0.55;
      const v = V.rot(dir, ang);
      const fly = 0.45 + R() * 0.2;
      add({ kind: "circle", t0: born, t1: born + fly, frame: (tt) => {
        const u = (tt - born) / fly;
        const p = V.add(V.add(a, V.mul(dir, cell * 0.4)), V.mul(v, dist * easeOut(u)));
        const ci = Math.min(pal.length - 1, Math.floor(u * pal.length));
        return { c: p, r: cell * (0.08 + 0.45 * u) * (kind === "flame" ? 1 : 0.8), fill: pal[ci], fillOpacity: (kind === "flame" ? 0.8 : 0.6) * (1 - u * 0.85), strokeOpacity: 0 };
      } });
    }
    if (kind === "foam" || kind === "acid" || kind === "cryo") {
      const col = { foam: "#f2f5fb", acid: "#7fdc1c", cryo: "#d8f6ff" }[kind];
      cloud(t + life * 0.6, b, 0.7, col, kind === "foam" ? 6 : 2);
    }
    return t + life;
  });

  // ---------- coreografia por tipo ----------
  const mode = spec.mode || "single";
  const hit = spec.hit !== false;
  // quantos tiros aparecem (com pouca munição, aparecem só os que saíram)
  const shots = Math.max(1, Math.min(spec.rounds ?? Infinity, { single: 1, burst: 3, auto: 9, supp: 16, spray: 1 }[mode] || 1));
  const gap = mode === "burst" ? 0.09 : mode === "auto" ? 0.075 : mode === "supp" ? 0.07 : 0;
  let start = 0;
  const firstDir = V.norm(V.sub(targets[0].at, from));

  if (P.laser) {
    // mira laser antes do tiro
    tag = "sight";
    const t0 = 0, t1 = 0.65;
    add({ kind: "line", t0, t1, frame: (tt) => ({ a: V.add(from, V.mul(firstDir, cell * 0.4)), b: targets[0].at, color: "#ff2030", width: Math.max(1.5, cell * 0.012), opacity: 0.55 + 0.35 * Math.sin(tt * 40) }) });
    add({ kind: "circle", t0, t1, frame: (tt) => ({ c: targets[0].at, r: cell * 0.06, fill: "#ff2030", fillOpacity: 0.9, strokeOpacity: 0 }) });
    tag = "";
    start = t1;
  }

  const aimPoint = (tg, i, total) => {
    if (tg.exact) return tg.at;
    // dispersão: cresce na rajada/automático; erro joga o ponto para o lado
    const spread = mode === "single" ? 0.05 : mode === "burst" ? 0.18 : mode === "supp" ? 1.4 : 0.12 + 0.05 * i;
    let p = V.add(tg.at, V.mul(V.rot({ x: 1, y: 0 }, R() * Math.PI * 2), cell * spread * R()));
    if (!(tg.hit ?? hit)) {
      const dir = V.norm(V.sub(tg.at, from));
      p = V.add(V.add(tg.at, V.mul(V.perp(dir), cell * (0.7 + R() * 0.6) * (R() > 0.5 ? 1 : -1))), V.mul(dir, cell * R()));
    }
    return p;
  };

  if (P.spray) {
    for (const tg of targets) { landLog.push({ t: start, from, dest: tg.at, target: tg }); spray(start, from, tg.at, P.spray, 0.95); }
  } else if (P.lob) {
    for (const tg of targets) {
      const dest = (tg.hit ?? hit) ? tg.at : aimPoint(tg, 0, 1);
      landLog.push({ t: start, from, dest, target: tg, lobLand: start + 0.75 });
      if (!P.thrown) muzzle(start, V.norm(V.sub(dest, from)), P.flash * 0.6);
      const land = lob(start, V.add(from, V.mul(V.norm(V.sub(dest, from)), cell * 0.4)), dest, 0.09, P.lob === "flashbang" ? "#e8e8e8" : P.lob === "smoke" ? "#6f7a73" : "#3d4a2f", 0.75);
      if (P.lob === "frag") explosion(land, dest, 1.6);
      if (P.lob === "smoke") cloud(land, dest, 2.2, "#9aa3ad", spec.smokeSec ?? 30);
      if (P.lob === "gas") cloud(land, dest, 1.6, "#c9e86a", Math.min(20, spec.smokeSec ?? 20));
      if (P.lob === "nanite") cloud(land, dest, 1.4, "#3b4652", Math.min(20, spec.smokeSec ?? 20), "#6ff7ff");
      if (P.lob === "flashbang") { flashCircle(land, dest, cell * 4 * I, 1.3, "#ffffff", 0.97); ring(land, dest, cell * 3, 0.5, "#ffffff", 0.08); }
    }
  } else if (P.rocket) {
    for (const tg of targets) {
      const dest = (tg.hit ?? hit) ? tg.at : aimPoint(tg, 0, 1);
      const dir = V.norm(V.sub(dest, from));
      landLog.push({ t: start, from, dest, target: tg });
      muzzle(start, V.mul(dir, -1), P.flash); // jato de trás
      tag = "rocket";
      const a = V.add(from, V.mul(dir, cell * 0.5));
      const dist = V.len(V.sub(dest, a)), dur = dist / (P.speed * cell * spd);
      add({ kind: "circle", t0: start, t1: start + dur, frame: (tt) => ({ c: V.lerp(a, dest, (tt - start) / dur), r: cell * 0.09, fill: "#ffe7a0", fillOpacity: 1, stroke: "#ff7a1a", strokeOpacity: 1, strokeWidth: cell * 0.04 }) });
      for (let k = 0; k < 16; k++) {
        const u0 = k / 16, tb = start + dur * u0;
        add({ kind: "circle", t0: tb, t1: tb + 1.2, frame: (tt) => { const u = (tt - tb) / 1.2; return { c: V.lerp(a, dest, u0), r: cell * (0.08 + 0.25 * u), fill: "#9a9a9a", fillOpacity: 0.5 * (1 - u), strokeOpacity: 0 }; } });
      }
      tag = "";
      explosion(start + dur, dest, 2.2);
    }
  } else {
    // armas de projétil, feixe ou arco elétrico
    let t = start;
    for (let i = 0; i < shots; i++) {
      const tg = targets[i % targets.length];
      const p = aimPoint(tg, i, shots);
      const dir = V.norm(V.sub(p, from));
      const muzzleAt = V.add(from, V.mul(dir, cell * 0.45));
      const hit = tg.hit ?? spec.hit !== false; // alvo atrás de cobertura: a bala bate no obstáculo
      const rec = { t, i, from: muzzleAt, to: p, target: tg, hit };
      shotLog.push(rec);
      muzzle(t, dir, P.flash * (i ? 0.85 : 1));
      if (P.beam) {
        beam(t, muzzleAt, p, P.w, color, P.rail ? 0.5 : 0.28);
        if (P.rail) { ring(t, p, cell * 1.2, 0.5, "#e6f6ff", 0.05); T("beam", add)({ kind: "line", t0: t, t1: t + 1.4, frame: (tt) => ({ a: muzzleAt, b: p, color: "#bfe8ff", width: 2, opacity: 0.6 * (1 - (tt - t) / 1.4) }) }); }
        impact(t + 0.02, { ...tg, at: p }, dir, hit, P.impact);
      } else if (P.arc || P.taser) {
        const life = P.taser ? 0.9 : 0.45;
        if (P.taser) for (const s of [-1, 1]) T("wires", add)({ kind: "line", t0: t, t1: t + life, frame: () => ({ a: muzzleAt, b: V.add(p, V.mul(V.perp(dir), s * cell * 0.08)), color: "#cfd8dc", width: 1.5, opacity: 0.9 }) });
        arc(t + (P.taser ? 0.08 : 0), muzzleAt, p, color, life, P.taser ? 0.18 : 0.6);
        if (hit) sparks(t + 0.05, p, dir, 5, 0.3, color);
        if (P.arc && targets.length > 1 && i === 0) {
          // tesla: o arco salta de alvo em alvo
          for (let k = 1; k < targets.length; k++) arc(t + 0.08 * k, targets[k - 1].at, targets[k].at, color, 0.4, 0.4);
        }
      } else if (P.bolt) {
        const dist = V.len(V.sub(p, muzzleAt)), dur = dist / (P.speed * cell * spd);
        tag = "bolt";
        add({ kind: "circle", t0: t, t1: t + dur, frame: (tt) => ({ c: V.lerp(muzzleAt, p, (tt - t) / dur), r: cell * P.w * I, fill: "#ffffff", fillOpacity: 1, stroke: color, strokeOpacity: 0.9, strokeWidth: cell * P.w * 0.9 * I }) });
        add({ kind: "line", t0: t, t1: t + dur, frame: (tt) => { const q = V.lerp(muzzleAt, p, (tt - t) / dur); return { a: V.sub(q, V.mul(dir, cell * 0.8)), b: q, color, width: cell * P.w * 1.2 * I, opacity: 0.45 }; } });
        tag = "";
        flashCircle(t + dur, p, cell * P.impact * I, 0.35, color, 0.85);
        if (hit) impact(t + dur, { ...tg, at: p }, dir, true, P.impact * 0.7); else dust(t + dur, p, 0.4);
      } else if (P.pellets) {
        let end = t;
        for (let k = 0; k < P.pellets; k++) {
          const q = V.add(p, V.mul(V.rot({ x: 1, y: 0 }, R() * Math.PI * 2), cell * (0.15 + R() * 0.55)));
          (rec.pellets ||= []).push(q);
          end = Math.max(end, tracer(t, muzzleAt, q, P.w));
          if (k < 4) impact(end, { ...tg, at: q }, dir, hit, P.impact);
        }
      } else {
        const end = tracer(t, muzzleAt, p, P.arrow ? P.w * 1.3 : P.w);
        if (P.arrow) T("arrow", add)({ kind: "line", t0: end, t1: end + 1.2, frame: (tt) => ({ a: V.sub(p, V.mul(dir, cell * 0.45)), b: p, color: "#8a6b45", width: Math.max(2, cell * 0.035), opacity: 1 - clamp01((tt - end - 0.8) / 0.4) }) });
        if (P.boom) explosion(end, p, P.boom); else impact(end, { ...tg, at: p }, dir, hit, P.impact);
      }
      if (i % (mode === "auto" || mode === "supp" ? 2 : 1) === 0) casing(t + 0.02, dir);
      t += gap;
    }
    if (mode === "supp") {
      // fogo de supressão: área tracejada que pisca sobre o alvo
      for (const tg of targets) {
        tag = "supp";
        const pts = Array.from({ length: 24 }, (_, k) => V.add(tg.at, V.mul({ x: Math.cos((k / 24) * Math.PI * 2), y: Math.sin((k / 24) * Math.PI * 2) }, cell * 1.6)));
        add({ kind: "path", t0: start, t1: t + 1.8, frame: (tt) => ({ pts, closed: true, fill: "#ff3b30", fillOpacity: 0.08 + 0.08 * (Math.sin(tt * 18) > 0 ? 1 : 0), stroke: "#ff5a4a", strokeOpacity: 0.9, strokeWidth: cell * 0.04, dash: [cell * 0.18, cell * 0.12] }) });
        tag = "";
      }
    }
  }

  const duration = els.reduce((m, e) => Math.max(m, e.t1), 0);
  return { elements: els, duration, shots: shotLog, lands: landLog, start };
}

/** Rótulo curto sobre o token (recarga, sem munição...). */
export function buildLabel(at, text, cell, life = 1.3) {
  return { elements: [{ kind: "label", t0: 0, t1: life, frame: () => ({ at: { x: at.x, y: at.y - cell * 0.75 }, text }) }], duration: life };
}
