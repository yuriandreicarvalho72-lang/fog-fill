// Animações JB2A (vídeos .webm) para o Arsenal.
// Os vídeos são do pacote gratuito do JB2A (https://jb2a.com), licença CC BY-NC-SA 4.0
// (https://creativecommons.org/licenses/by-nc-sa/4.0/). Não foram alterados; o build baixa os arquivos
// do repositório oficial (commit fixo) para public/jb2a/ e eles são servidos junto com a extensão.
// Este arquivo é só dados + geometria (sem SDK), para o build e os testes poderem importar.
import { buildShot, V } from "./fx.js";

export const JB2A_REPO = "Jules-Bens-Aa/JB2A_DnD5e";
export const JB2A_COMMIT = "e930132102cbfa22a0ba964a3df73feb3412727a";
export const JB2A_CREDIT = "Animações: JB2A (jb2a.com), CC BY-NC-SA 4.0";

// Projéteis (vídeo de A até B). Nos vídeos do JB2A o tiro sai em x=200 e chega em x=largura-200,
// no meio da altura, a 200 px por quadrado. dur = duração (ms) de cada distância; hit = fração do vídeo
// em que o projétil chega no alvo.
const W = { 5: 600, 15: 1000, 30: 1600, 45: 2200, 60: 2800, 90: 4000 };
const FT = (ft) => String(ft).padStart(2, "0"); // os arquivos usam 05ft, 15ft...
const ranged = (base, durs, hit, fmt = (ft) => `${base}_${FT(ft)}ft_${W[ft]}x400.webm`) =>
  ({ type: "ranged", hit, v: Object.fromEntries(Object.entries(durs).map(([ft, d]) => [ft, { file: fmt(Number(ft)), w: W[ft], h: 400, dur: d }])) });

export const LIB = {
  bullet:  ranged("Generic/Weapon_Attacks/Ranged/Bullet_01_Regular_Orange", { 5: 533, 15: 533, 30: 633, 60: 833, 90: 967 }, 0.5),
  bulletL: ranged("Generic/Weapon_Attacks/Ranged/Bullet_02_Regular_Orange", { 5: 933, 15: 933, 30: 933, 60: 933, 90: 933 }, 0.45),
  bulletB: ranged("Generic/Weapon_Attacks/Ranged/Bullet_03_Regular_Blue", { 5: 1033, 15: 1300, 30: 1300, 60: 1233, 90: 1367 }, 0.5),
  snipe:   ranged("Generic/Weapon_Attacks/Ranged/Snipe_01_Regular_Blue", { 5: 1100, 15: 1367, 30: 1167, 60: 1200, 90: 2567 }, 0.35),
  laser:   ranged("Generic/Weapon_Attacks/Ranged/LaserShot_01_Regular_Red", { 5: 500, 15: 633, 30: 667, 60: 900, 90: 1033 }, 0.5),
  arrow:   ranged("Generic/Weapon_Attacks/Ranged/Arrow01_01_Regular_White", { 5: 1733, 15: 1867, 30: 1867, 60: 2067, 90: 2400 }, 0.45),
  missile: ranged("Generic/Weapon_Attacks/Ranged/Missile02_01_Regular_White", { 15: 667, 30: 933, 60: 1367, 90: 1833 }, 0.8),
  cannon:  ranged("Generic/Weapon_Attacks/Ranged/LaunchCannonBall01_01_Regular_Black", { 5: 467, 15: 767, 30: 1167, 60: 2067, 90: 2433 }, 0.85),
  bomb:    ranged("Generic/Weapon_Attacks/Ranged/ThrowBomb01_01_Regular_Black", { 5: 1467, 15: 1800, 30: 2200, 60: 3067, 90: 3533 }, 0.85),
  flask:   ranged("Generic/Weapon_Attacks/Ranged/ThrowFlask01_01_Regular_Orange", { 5: 1467, 15: 1800, 30: 2200, 60: 3067, 90: 3533 }, 0.85),
  plasma:  ranged("Generic/RangedSpell/OverchargedSphere01_01_Dark_Purple", { 5: 933, 15: 1200, 30: 1600, 60: 2433, 90: 3267 }, 0.88),
  chain:   ranged("6th_Level/Chain_Lightning/ChainLightning_01_Regular_Blue", { 5: 1633, 15: 1667, 30: 1700, 60: 1733, 90: 1767 }, 0.25,
    (ft) => `6th_Level/Chain_Lightning/ChainLightning_01_Regular_Blue_${FT(ft)}ft_Primary_${W[ft]}x400.webm`),
  chain2:  ranged("6th_Level/Chain_Lightning/ChainLightning_01_Regular_Blue", { 5: 1200, 15: 1267, 30: 1300, 60: 2967, 90: 1333 }, 0.25,
    (ft) => `6th_Level/Chain_Lightning/ChainLightning_01_Regular_Blue_${FT(ft)}ft_Secondary_${W[ft]}x400.webm`),
  frost:   ranged("Cantrip/Ray_Of_Frost/RayOfFrost_01_Regular_Blue", { 5: 2533, 15: 2533, 30: 2533, 45: 2533, 60: 2533, 90: 2600 }, 0.2),
  // jatos que saem da arma (x=0) e esticam até o alvo
  fireJet: { type: "jet", hit: 0.15, v: {
    15: { file: "Generic/Fire/FireJet_01_Orange_15ft_600x200.webm", w: 600, h: 200, dur: 3800 },
    30: { file: "Generic/Fire/FireJet_01_Orange_30ft_1200x200.webm", w: 1200, h: 200, dur: 3800 } } },
  acidJet: { type: "jet", hit: 0.15, v: {
    30: { file: "Generic/Template/Line/Breath_Weapon/BreathWeapon_Acid01_Regular_Green_30ft_Line_Burst_1200x200.webm", w: 1200, h: 200, dur: 7100 } } },
  // efeitos num ponto (centro do vídeo). ox = onde fica a origem (fração da largura) nos vídeos "de lado".
  muzzle1: { type: "side", ox: 0.15, file: "Generic/Muzzle_Flash/MuzzleFlashSingle01_01_Regular_Yellow_600x300.webm", w: 600, h: 300, dur: 833 },
  muzzle2: { type: "side", ox: 0.15, file: "Generic/Muzzle_Flash/MuzzleFlashSingle01_02_Regular_Yellow_600x300.webm", w: 600, h: 300, dur: 833 },
  blood:   { type: "side", ox: 0.12, file: "Generic/Liquid/LiquidSplashSide02_01_Regular_Red_600x600.webm", w: 600, h: 600, dur: 1033 },
  bloodTop:{ type: "point", file: "Generic/Liquid/LiquidSplash02_01_Regular_Red_500x500.webm", w: 500, h: 500, dur: 1133 },
  dust1:   { type: "side", ox: 0.08, file: "Generic/Smoke/SmokePuffSide01_01_Regular_Grey_400x400.webm", w: 400, h: 400, dur: 1100 },
  dust2:   { type: "side", ox: 0.08, file: "Generic/Smoke/SmokePuffSide01_02_Regular_Grey_400x400.webm", w: 400, h: 400, dur: 1100 },
  puff:    { type: "point", file: "Generic/Smoke/SmokePuff01_01_Regular_Grey_400x400.webm", w: 400, h: 400, dur: 2300 },
  sparkY:  { type: "point", file: "Generic/Impact/Impact_06_Regular_Yellow_400x400.webm", w: 400, h: 400, dur: 267 },
  sparkO:  { type: "point", file: "Generic/Impact/Impact_08_Regular_Orange_400x400.webm", w: 400, h: 400, dur: 233 },
  sparkB:  { type: "point", file: "Generic/Impact/Impact_01_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 300 },
  iceHit:  { type: "point", file: "Generic/Impact/ImpactIceShard01_01_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 1800 },
  crack:   { type: "point", file: "Generic/Impact/GroundCrackImpact_01_Regular_Orange_600x600.webm", w: 600, h: 600, dur: 5033 },
  boom:    { type: "point", file: "Generic/Explosion/Explosion_01_Orange_400x400.webm", w: 400, h: 400, dur: 1367 },
  boomBig: { type: "point", file: "Generic/Explosion/Explosion_05_Regular_Orange_400x400.webm", w: 400, h: 400, dur: 3042 },
  boomBlue:{ type: "point", file: "Generic/Explosion/Explosion_04_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 1033 },
  shrapnel:{ type: "point", file: "Generic/Explosion/ShrapnelBomb01_01_Regular_Black_800x800.webm", w: 800, h: 800, dur: 700 },
  plumes:  { type: "point", file: "Generic/Smoke/SmokePlumes01_01_Regular_Grey_400x400.webm", w: 400, h: 400, dur: 8533 },
  fog:     { type: "point", loop: true, file: "1st_Level/Fog_Cloud/FogCloud_01_White_800x800.webm", w: 800, h: 800, dur: 5042 },
  poison:  { type: "point", loop: true, file: "Generic/Template/Circle/TemplatePoisonCircle_01_Dark_Green_800x800.webm", w: 800, h: 800, dur: 6042 },
  static:  { type: "point", file: "Generic/Lightning/StaticElectricity_01_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 1967 },
  sparkles:{ type: "point", loop: true, file: "Generic/Energy/SwirlingSparkles_01_Regular_Blue_400x400.webm", w: 400, h: 400, dur: 3300 },
};

/** Todos os arquivos que o build precisa baixar. */
export function allFiles() {
  const out = new Set();
  for (const a of Object.values(LIB)) {
    if (a.v) for (const v of Object.values(a.v)) out.add(v.file);
    else out.add(a.file);
  }
  return [...out].sort();
}

// Como cada tipo de efeito usa os vídeos. proj = projétil; muzzle = clarão; impact = "bullet" | "energy:<efeito>" | "none";
// keep = partes do efeito desenhado que continuam (cápsulas, mira laser, área de supressão...).
export const PLAN = {
  melee: null, // corpo a corpo: usa o motor das habilidades (arma-vfx.js)
  pistol:   { proj: "bullet", muzzle: "muzzle1", impact: "bullet" },
  revolver: { proj: "bulletL", muzzle: "muzzle2", impact: "bullet" },
  smg:      { proj: "bullet", muzzle: "muzzle1", impact: "bullet" },
  rifle:    { proj: "bullet", muzzle: "muzzle2", impact: "bullet" },
  sniper:   { proj: "bulletL", muzzle: "muzzle2", impact: "bullet" },
  shotgun:  { proj: "bullet", muzzle: "muzzle2", impact: "bullet", pellets: 4 },
  mg:       { proj: "bullet", muzzle: "muzzle1", impact: "bullet" },
  mgm:      { proj: "bullet", muzzle: "muzzle2", impact: "bullet" },
  hmg:      { proj: "bulletL", muzzle: "muzzle2", impact: "bullet" },
  beanbag:  { proj: "bullet", muzzle: "muzzle1", impact: "soft" },
  bow:      { proj: "arrow", impact: "bullet" },
  laser:    { proj: "laser", impact: "energy:sparkO", keep: ["muzzle"] },
  ion:      { proj: "bulletB", impact: "energy:sparkB", keep: ["muzzle"] },
  plasma:   { proj: "plasma", impact: "energy:boomBlue", keep: ["muzzle"] },
  rail:     { proj: "snipe", impact: "energy:sparkB", keep: ["muzzle"] },
  tesla:    { proj: "chain", chain: "chain2", impact: "none", keep: ["muzzle"] },
  taser:    { impact: "energy:static", keep: ["muzzle", "wires", "arc"] },
  foam:     null, // continua desenhado (o JB2A gratuito não tem espuma)
  flame:    { jet: "fireJet" },
  acid:     { jet: "acidJet" },
  cryo:     { proj: "frost", impact: "energy:iceHit", spray: true },
  grenade:  { lob: "cannon", land: ["boom:3", "shrapnel:4"], keep: ["muzzle"] },
  frag:     { lob: "bomb", land: ["shrapnel:4", "boom:3"] },
  smoke:    { lob: "bomb", land: ["plumes:4"], cloud: "fog:4.6" },
  gas:      { lob: "flask", land: ["puff:2"], cloud: "poison:3.4", keep: ["muzzle", "cloud"] },
  nanite:   { lob: "flask", cloud: "sparkles:3", keep: ["muzzle", "cloud"] },
  flashbang:{ lob: "bomb", land: ["sparkY:4"], keep: ["flash"] },
  rocket:   { lob: "missile", land: ["boomBig:4.4", "crack:3"] },
  cannon:   { proj: "cannon", land: ["boom:2.8", "crack:2.4"], muzzle: "muzzle2", keep: ["casing"] },
};

const ALWAYS_KEEP = ["casing", "sight", "supp"];

const pickVariant = (asset, cells) => {
  const fts = Object.keys(asset.v).map(Number);
  const ft = fts.reduce((b, f) => (Math.abs(f - cells * 5) < Math.abs(b - cells * 5) ? f : b), fts[0]);
  return asset.v[ft];
};
const angle = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/**
 * Vídeo de A até B. Devolve a "ficha" do item de imagem: arquivo, tamanho em px, dpi (px por quadrado),
 * offset (ponto do vídeo que fica na posição), posição, rotação, quando começa e quanto dura.
 */
export function rangedVideo(key, a, b, cell, t0) {
  const asset = LIB[key];
  const cells = Math.max(0.5, V.len(V.sub(b, a)) / cell);
  const v = pickVariant(asset, cells);
  const jet = asset.type === "jet";
  const span = jet ? v.w : v.w - 400;              // px do vídeo entre a saída e o alvo
  const dpi = span / cells;
  return { file: v.file, w: v.w, h: v.h, dpi, offset: { x: jet ? 0 : 200, y: v.h / 2 }, position: a, rotation: angle(a, b), t0, dur: v.dur / 1000, hitAt: t0 + (v.dur / 1000) * asset.hit };
}

/** Vídeo num ponto. size = diâmetro em quadrados; dir (opcional) gira os vídeos "de lado". */
export function pointVideo(key, at, size, t0, cell, dir = null, life = null) {
  const a = LIB[key];
  const dpi = a.w / size;
  const side = a.type === "side";
  return {
    file: a.file, w: a.w, h: a.h, dpi, offset: side ? { x: a.w * a.ox, y: a.h / 2 } : { x: a.w / 2, y: a.h / 2 },
    position: at, rotation: dir ? (Math.atan2(dir.y, dir.x) * 180) / Math.PI : 0, t0, dur: life ?? a.dur / 1000, loop: !!a.loop,
  };
}

const shift = (els, dt) => els.map((e) => ({ ...e, t0: e.t0 + dt, t1: e.t1 + dt, frame: (t) => e.frame(t - dt) }));

/**
 * Monta o disparo com vídeos do JB2A. has(file) diz se o arquivo está disponível.
 * Devolve { elements (partes desenhadas que ficam), videos, duration } — ou null se este efeito não usa JB2A
 * ou se falta algum vídeo (aí o Arsenal usa o efeito desenhado inteiro).
 */
export function buildShotJB2A(spec, has = () => true) {
  const plan = PLAN[spec.fx];
  if (!plan) return null;
  const base = buildShot(spec);
  const cell = spec.cell || 150;
  const videos = [];
  const keep = new Set([...ALWAYS_KEEP, ...(plan.keep || [])]);
  const gore = spec.gore !== false;
  const dirOf = (a, b) => V.norm(V.sub(b, a));
  let dtCloud = 0;

  const impactAt = (t, at, dir, kind, hit, i) => {
    if (plan.impact === "none") return;
    if (!hit) { videos.push(pointVideo(i % 2 ? "dust2" : "dust1", at, 1.3, t, cell, V.mul(dir, -1))); return; }
    if (plan.impact?.startsWith("energy:")) { videos.push(pointVideo(plan.impact.slice(7), at, 1.4, t, cell, dir)); return; }
    if (plan.impact === "soft") { videos.push(pointVideo("dust1", at, 1.2, t, cell, V.mul(dir, -1))); return; }
    if (kind === "flesh" && gore) videos.push(pointVideo("blood", at, 1.7, t, cell, dir));
    else if (kind === "flesh") videos.push(pointVideo("sparkO", at, 1.1, t, cell));
    else if (kind === "metal") videos.push(pointVideo(i % 2 ? "sparkO" : "sparkY", at, 1.2, t, cell));
    else videos.push(pointVideo(i % 2 ? "dust2" : "dust1", at, 1.3, t, cell, V.mul(dir, -1)));
  };
  const landAt = (t, at) => {
    for (const s of plan.land || []) { const [k, size] = s.split(":"); videos.push(pointVideo(k, at, Number(size), t, cell)); }
    if (plan.cloud) {
      const [k, size] = plan.cloud.split(":");
      const life = spec.fx === "smoke" ? (spec.smokeSec ?? 30) : Math.min(20, spec.smokeSec ?? 20);
      videos.push(pointVideo(k, at, Number(size), t + 0.3, cell, null, life));
    }
  };

  if (plan.jet || (plan.spray && plan.proj)) {
    for (const l of base.lands) {
      const a = V.add(l.from, V.mul(dirOf(l.from, l.dest), cell * 0.4));
      const v = plan.jet ? rangedVideo(plan.jet, a, l.dest, cell, l.t) : rangedVideo(plan.proj, a, l.dest, cell, l.t);
      videos.push(v);
      if (plan.impact) impactAt(v.hitAt, l.dest, dirOf(a, l.dest), l.target.kind, true, 0);
    }
  } else if (plan.lob) {
    for (const l of base.lands) {
      const a = V.add(l.from, V.mul(dirOf(l.from, l.dest), cell * 0.4));
      const v = rangedVideo(plan.lob, a, l.dest, cell, l.t);
      videos.push(v);
      landAt(v.hitAt, l.dest);
      if (l.lobLand != null) dtCloud = v.hitAt - l.lobLand;
    }
  } else if (plan.proj || plan.impact) {
    const every = spec.mode === "auto" || spec.mode === "supp" ? 2 : 1;
    for (const s of base.shots) {
      const dir = dirOf(s.from, s.to);
      if (plan.muzzle && s.i % every === 0) videos.push(pointVideo(plan.muzzle, s.from, 1.6, s.t, cell, dir));
      const ends = plan.pellets && s.pellets ? s.pellets.slice(0, plan.pellets) : [s.to];
      ends.forEach((to, k) => {
        if (!plan.proj) { if (s.i % every === 0) impactAt(s.t + 0.08, to, dir, s.target.kind, s.hit, s.i); return; }
        const v = rangedVideo(plan.proj, s.from, to, cell, s.t + k * 0.02);
        videos.push(v);
        if (s.i % every === 0 && k < 2) {
          if (plan.land && s.hit) landAt(v.hitAt, to); else impactAt(v.hitAt, to, dir, s.target.kind, s.hit, s.i + k);
        }
      });
      // tesla: o raio salta do primeiro alvo para os outros
      if (plan.chain && s.i === 0) {
        const tg = spec.targets || [];
        for (let k = 1; k < tg.length; k++) videos.push(rangedVideo(plan.chain, tg[k - 1].at, tg[k].at, cell, s.t + 0.35 * k));
      }
    }
  }

  let elements = base.elements.filter((e) => keep.has(e.tag));
  if (dtCloud) {
    const moving = elements.filter((e) => e.tag === "cloud" || e.tag === "flash");
    elements = [...elements.filter((e) => !moving.includes(e)), ...shift(moving, dtCloud)];
  }
  if (videos.some((v) => !has(v.file))) return null;
  const duration = Math.max(0, ...elements.map((e) => e.t1), ...videos.map((v) => v.t0 + v.dur));
  return { elements, videos, duration };
}
