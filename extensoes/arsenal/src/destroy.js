// Cenário destrutível e cargas plantadas (sem SDK, testado em Node).
// - Itens marcados como destrutíveis aguentam N tiros pesados ou M explosões; o Arsenal conta o dano.
// - Cargas (explosivos plantados) explodem por tempo ou por controle remoto e danificam o cenário no raio.
import { buildShot, rng, V } from "./fx.js";
import { outline } from "./cover.js";
import { pointVideo } from "./jb2a.js";

export const DESTR = "arsenal/destrutivel"; // metadado do item: resistência, dano e o que acontece ao quebrar
export const CHARGE = "arsenal/carga";       // metadado do item da carga: { by, token, mode, sec, endsAt, radius, show, name }

/** Armas cujo tiro conta no cenário (as outras só contam se o item aceitar "qualquer tiro"). */
export const HEAVY = ["hmg", "mgm", "sniper", "rail", "plasma", "cannon"];
/** Raio da explosão (em quadrados) de cada efeito explosivo. */
export const BLAST_R = { frag: 2, grenade: 2, rocket: 3, cannon: 1.5 };
export const DEFAULT_CHARGE_R = 2;

/** O que acontece com o item ao quebrar. */
export const ON_BREAK = [["hide", "some (esconde)"], ["delete", "é apagado"], ["image", "troca a imagem (Trocador)"], ["none", "fica como está"]];

export const DEFAULT_DESTR = {
  shots: 3, blasts: 1, any: false,     // aguenta 3 tiros pesados ou 1 explosão; any = qualquer tiro conta
  s: 0, b: 0, broken: false,           // dano até agora
  on: "hide", image: "", walls: [],    // o que acontece com o item; paredes que abrem junto
  group: "", to: "next", trigger: "",  // Estados e Gatilhos
};
export const destrOf = (it) => (it?.metadata?.[DESTR] ? { ...DEFAULT_DESTR, ...it.metadata[DESTR] } : null);

/** Quanto do item já foi (0 a 1). shots/blasts 0 = esse tipo de dano não conta. */
export function wear(d) {
  const a = d.shots > 0 ? d.s / d.shots : 0;
  const b = d.blasts > 0 ? d.b / d.blasts : 0;
  return a + b;
}

/** Soma um dano ("shot" | "blast"). Devolve { d, broken, counted }. */
export function addDamage(d0, kind) {
  const d = { ...d0 };
  if (d.broken) return { d, broken: false, counted: false };
  if (kind === "blast" && d.blasts > 0) d.b += 1;
  else if (kind === "shot" && d.shots > 0) d.s += 1;
  else return { d, broken: false, counted: false };
  const broken = wear(d) >= 1 - 1e-9;
  if (broken) d.broken = true;
  return { d, broken, counted: true };
}

/** Texto do dano para o painel e para o rótulo no mapa. */
export function damageText(d) {
  if (d.broken) return "destruído";
  const parts = [];
  if (d.shots > 0) parts.push(`${d.s}/${d.shots} tiros`);
  if (d.blasts > 0) parts.push(`${d.b}/${d.blasts} explos${d.blasts === 1 ? "ão" : "ões"}`);
  return parts.join(" · ") || "indestrutível";
}

/** Resistência em palavras (para o rótulo do mapa e para o painel). */
export function resistText(d) {
  const a = d.shots > 0 ? `${d.shots} tiro${d.shots === 1 ? "" : "s"} pesado${d.shots === 1 ? "" : "s"}` : "";
  const b = d.blasts > 0 ? `${d.blasts} explos${d.blasts === 1 ? "ão" : "ões"}` : "";
  return [a, b].filter(Boolean).join(" ou ") || "nada (indestrutível)";
}

// ---------------- geometria ----------------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function distToSeg(p, s) {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / L)) : 0;
  return Math.hypot(p.x - (s.a.x + dx * t), p.y - (s.a.y + dy * t));
}
function inside(p, segs) {
  let c = false;
  for (const s of segs) {
    if ((s.a.y > p.y) !== (s.b.y > p.y) && p.x < ((s.b.x - s.a.x) * (p.y - s.a.y)) / (s.b.y - s.a.y) + s.a.x) c = !c;
  }
  return c;
}
const closed = (it) => it.type === "IMAGE" || it.type === "SHAPE" || (it.type === "CURVE" && it.style?.closed !== false);

/** Distância (px) de um ponto até o item: 0 se dentro dele; paredes e linhas, até o traço mais perto. */
export function itemDistance(item, at, dpi) {
  const segs = outline(item, dpi);
  if (!segs.length) return dist(item.position, at);
  if (closed(item) && inside(at, segs)) return 0;
  return Math.min(...segs.map((s) => distToSeg(at, s)));
}

/** Centro do item: meio do contorno (imagens e formas: meio do retângulo; paredes e linhas: média dos pontos). */
export function centerOf(item, dpi) {
  const segs = outline(item, dpi);
  if (!segs.length) return { ...item.position };
  const pts = segs.flatMap((s) => [s.a, s.b]);
  if (closed(item)) {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
  return { x: pts.reduce((m, p) => m + p.x, 0) / pts.length, y: pts.reduce((m, p) => m + p.y, 0) / pts.length };
}

/** Tamanho do item em quadrados (o maior lado), para o tamanho da poeira. */
export function sizeOf(item, dpi) {
  const segs = outline(item, dpi);
  if (!segs.length) return 1;
  const xs = segs.flatMap((s) => [s.a.x, s.b.x]), ys = segs.flatMap((s) => [s.a.y, s.b.y]);
  return Math.max(0.6, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / dpi);
}

// ---------------- dano de um disparo ----------------
/**
 * Eventos de dano de um disparo do Arsenal (mesmo spec que todos desenham; a semente garante os mesmos pontos).
 * [{ kind: "shot", id?, at, heavy, t }] para tiros e [{ kind: "blast", at, r (quadrados), t }] para explosões.
 * t = segundos depois do disparo (quando o tiro/explosão chega).
 */
export function damageEvents(spec) {
  const out = [];
  if (!spec?.targets?.length) return out;
  const shot = buildShot(spec);
  const fx = spec.fx;
  if (BLAST_R[fx] && fx !== "cannon") {
    for (const l of shot.lands) out.push({ kind: "blast", at: l.dest, r: BLAST_R[fx], t: (l.lobLand ?? l.t) + 1.2 });
    return out;
  }
  for (const s of shot.shots) {
    if (fx === "cannon") { out.push({ kind: "blast", at: s.to, r: BLAST_R.cannon, t: s.t + 0.6 }); continue; }
    if (!s.hit) continue;
    out.push({ kind: "shot", id: s.target.id, at: s.to, heavy: HEAVY.includes(fx), t: s.t + 0.3 });
  }
  return out;
}

// ---------------- habilidades no cenário ----------------
const segsOfPoly = (pts) => pts.map((p, i) => ({ a: p, b: pts[(i + 1) % pts.length] }));
const side = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const segHit = (p1, p2, p3, p4) => side(p1, p2, p3) !== side(p1, p2, p4) && side(p3, p4, p1) !== side(p3, p4, p2);

/** A forma da habilidade (círculo { c, r } ou polígono { pts }, em px) pega este item? */
export function shapeHitsItem(shape, item, dpi) {
  if (!shape) return false;
  if (shape.kind === "circle") return itemDistance(item, shape.c, dpi) <= shape.r;
  if (!shape.pts?.length) return false;
  const poly = segsOfPoly(shape.pts);
  const segs = outline(item, dpi);
  if (!segs.length) return inside(item.position, poly);
  const pts = [centerOf(item, dpi), ...segs.flatMap((s) => [s.a, s.b])];
  if (pts.some((p) => inside(p, poly))) return true;
  if (segs.some((s) => poly.some((e) => segHit(s.a, s.b, e.a, e.b)))) return true;
  return closed(item) && shape.pts.some((p) => inside(p, segs));
}

/** Peso do dano de cenário de cada valor do campo "cenario" da habilidade. */
export const CENARIO_PESO = { explosao: "blast", tiro: "shot" };

/**
 * Eventos de dano no cenário de uma habilidade usada. Área, aura, cone e linha com dano contam como 1 explosão
 * (cenario: "nenhum" desliga; "tiro" conta como tiro pesado). Habilidade de alvo só machuca o cenário se tiver
 * cenario: "explosao" ou "tiro" no dossiê. targets = [{ id, at }]; shape = a área da habilidade (ou null); mpc = metros por quadrado.
 */
export function habEvents(ab, shape, targets, mpc = 1.5) {
  if (!ab || ab.cenario === "nenhum") return [];
  const areaLike = ["area", "aura", "cone", "linha"].includes(ab.forma);
  const mode = ab.cenario || (areaLike && ab.dano ? "explosao" : "");
  if (!mode) return [];
  const peso = CENARIO_PESO[mode] || "blast";
  if (ab.forma === "alvo") {
    return (targets || []).map((t) => (peso === "shot"
      ? { kind: "shot", id: t.id, at: t.at, heavy: true }
      : { kind: "blast", at: t.at, r: ab.area > 0 ? Math.max(0.5, ab.area / (mpc || 1.5)) : 1 }));
  }
  return areaLike && shape ? [{ kind: "shape", shape, peso, heavy: true }] : [];
}

/** O evento pega este item destrutível? (tiro: o alvo marcado ou um ponto em cima dele; explosão: dentro do raio) */
export function affects(ev, item, d, dpi) {
  if (!d || d.broken) return false;
  if (ev.kind === "shape") return (ev.peso === "shot" ? d.shots > 0 : d.blasts > 0) && shapeHitsItem(ev.shape, item, dpi);
  if (ev.kind === "blast") return d.blasts > 0 && itemDistance(item, ev.at, dpi) <= ev.r * dpi;
  if (!(ev.heavy || d.any) || d.shots <= 0) return false;
  if (ev.id) return ev.id === item.id;
  return itemDistance(item, ev.at, dpi) <= dpi * 0.25;
}

// ---------------- cargas ----------------
export const DEFAULT_PLANT = { mode: "timer", sec: 10, show: "all", radius: DEFAULT_CHARGE_R };
export const chargeOf = (it) => (it?.metadata?.[CHARGE] ? { ...DEFAULT_PLANT, ...it.metadata[CHARGE] } : null);
/** Segundos que faltam (temporizador), arredondado para cima; null no remoto. */
export const remaining = (c, now = Date.now()) => (c.mode === "timer" && c.endsAt ? Math.max(0, Math.ceil((c.endsAt - now) / 1000)) : null);
/** Quem vê a contagem regressiva: todos, ou só quem plantou (e o mestre). */
export const seesCountdown = (c, me) => me.role === "GM" || c.show === "all" || c.by === me.id;
/** Pode detonar/desarmar direto: o mestre e quem plantou. */
export const canControl = (c, playerId, role) => role === "GM" || (c && c.by === playerId);
/** Tokens pegos na explosão (o centro deles dentro do raio, mais meio token). */
export function caughtBy(at, radius, items, dpi) {
  return items.filter((i) => i.type === "IMAGE" && (i.layer === "CHARACTER" || i.layer === "MOUNT")
    && itemDistance(i, at, dpi) <= radius * dpi).map((i) => i.id);
}

// ---------------- efeitos visuais ----------------
/** Coreografia da quebra: poeira, destroços (vídeos JB2A; sem eles, círculos desenhados). size em quadrados. */
export function buildDebris(at, size, cell, seed = 1, has = null) {
  const s = Math.max(0.8, Math.min(6, size));
  const vids = [
    pointVideo("crack", at, s * 1.2, 0, cell),
    pointVideo("puff", at, s * 1.6, 0.05, cell),
    pointVideo("dust1", at, s, 0.1, cell, { x: 1, y: 0 }),
    pointVideo("dust2", at, s, 0.15, cell, { x: -1, y: 0 }),
  ];
  if (has && vids.every((v) => has(v.file))) return { elements: [], videos: vids, duration: Math.max(...vids.map((v) => v.t0 + v.dur)) };
  return drawnBurst(at, s * 0.7, cell, seed, false);
}

/** Coreografia da explosão de uma carga (raio em quadrados). */
export function buildBlast(at, radius, cell, seed = 1, has = null) {
  const d = Math.max(1, radius * 2);
  const vids = [
    pointVideo("boomBig", at, d * 1.1, 0, cell),
    pointVideo("shrapnel", at, d * 1.3, 0.05, cell),
    pointVideo("crack", at, d * 0.8, 0.2, cell),
    pointVideo("plumes", at, d * 0.9, 0.6, cell),
  ];
  if (has && vids.every((v) => has(v.file))) return { elements: [], videos: vids, duration: Math.max(...vids.map((v) => v.t0 + v.dur)) };
  return drawnBurst(at, radius, cell, seed, true);
}

/** Versão desenhada (sem vídeos): clarão laranja (explosão), lascas e nuvem de poeira. r em quadrados. */
function drawnBurst(at, r, cell, seed, fire) {
  const R = rng(seed);
  const els = [];
  const life = fire ? 2.6 : 2;
  if (fire) {
    els.push({ kind: "circle", t0: 0, t1: 0.55, frame: (t) => ({ c: at, r: cell * r * (0.3 + 1.1 * (t / 0.55)), fill: "#ffd27a", fillOpacity: 0.85 * (1 - t / 0.55), stroke: "#ff7a1a", strokeOpacity: 0.9 * (1 - t / 0.55), strokeWidth: cell * 0.08 }) });
    els.push({ kind: "circle", t0: 0, t1: 0.9, frame: (t) => ({ c: at, r: cell * r * (0.2 + 0.9 * (t / 0.9)), fill: "#ff5a1a", fillOpacity: 0.55 * (1 - t / 0.9), strokeOpacity: 0 }) });
  }
  for (let k = 0; k < 10; k++) {
    const a = R() * Math.PI * 2, sp = (0.6 + R()) * r * cell, t0 = 0.05 + R() * 0.1;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    els.push({ kind: "circle", t0, t1: t0 + 0.7, frame: (t) => { const u = (t - t0) / 0.7; return { c: V.add(at, V.mul(dir, sp * (1 - (1 - u) * (1 - u)))), r: cell * 0.05, fill: "#4a4038", fillOpacity: 1 - u, strokeOpacity: 0 }; } });
  }
  for (let k = 0; k < 6; k++) {
    const a = R() * Math.PI * 2, off = R() * r * cell * 0.5, t0 = 0.1 + R() * 0.3;
    const c0 = V.add(at, V.mul({ x: Math.cos(a), y: Math.sin(a) }, off));
    els.push({ kind: "circle", t0, t1: t0 + life, frame: (t) => { const u = (t - t0) / life; return { c: c0, r: cell * r * (0.25 + 0.45 * u), fill: "#8f877c", fillOpacity: 0.45 * (1 - u), strokeOpacity: 0 }; } });
  }
  return { elements: els, videos: [], duration: Math.max(...els.map((e) => e.t1)) };
}
