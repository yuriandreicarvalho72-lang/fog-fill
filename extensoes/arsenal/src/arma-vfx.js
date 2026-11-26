// Armas com efeito próprio e armas corpo a corpo: a animação do disparo usa o mesmo motor das habilidades (abil.js).
// weapon.vfx = { visual? | video: { url, tipo, giro? }, tamanho? }  ·  weapon.melee = { golpe: corte|estocada|impacto|soco, alcance (m) }
// Sem SDK: testado em Node.
import { buildAbility, registerLink, GOLPES, giroOf, keyOf } from "./abil.js";
import { V } from "./fx.js";

/** A "habilidade" equivalente à arma: um ataque num alvo. */
export function abilityOf(spec) {
  const v = spec.vfx || {};
  const ab = { nome: spec.weaponName || "Arma", forma: "alvo", impacto: spec.hit === false ? "nenhum" : spec.melee ? (spec.gore === false ? "poeira" : "sangue") : "faiscas" };
  if (v.video?.url && registerLink(String(v.video.url).trim(), v.video.tipo)) {
    ab.video = { url: String(v.video.url).trim(), tipo: v.video.tipo };
    const g = giroOf(v.video.giro); if (g) ab.video.giro = g;
  } else if (v.visual) ab.visual = v.visual;
  else if (spec.melee) ab.visual = (GOLPES.find(([k]) => k === spec.melee.golpe) || GOLPES[0])[2];
  if (Number(v.tamanho) > 0) ab.tamanho = Number(v.tamanho);
  return ab;
}

/** Tem animação própria? (efeito da arma ou golpe corpo a corpo) */
export const hasOwnFx = (spec) => !!(spec?.vfx?.video?.url || spec?.vfx?.visual || spec?.melee);

/**
 * Coreografia do disparo. spec = { from, targets: [{ at, id? }], hit, rounds, cell, seed, melee?, vfx?, gore?, weaponName }.
 * has(file) = vídeo disponível (null = vídeos desligados: só o risco do golpe). Devolve { ab, anim }.
 */
export function weaponAnim(spec, has) {
  const ab = abilityOf(spec);
  const cell = spec.cell || 150;
  const half = cell / 2;
  let s = (spec.seed || 1) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  // errou: o golpe ou o tiro passa ao lado do alvo
  const targets = (spec.targets || []).map((t) => {
    if (spec.hit !== false) return { id: t.id || "x", at: t.at, half };
    const d = V.norm(V.sub(t.at, spec.from));
    const p = V.perp(d);
    return { id: t.id || "x", at: V.add(V.add(t.at, V.mul(p, (rnd() < 0.5 ? -1 : 1) * cell * (0.7 + rnd() * 0.5))), V.mul(d, cell * 0.3)), half };
  });
  const ev = { ab, from: spec.from, aim: { targets }, cell, mpc: 1.5, selfHalf: half };
  const anim = buildAbility(ev, has);
  // rajada: repete o vídeo de projétil, um pouco depois do outro (no corpo a corpo, um golpe só)
  const n = spec.melee ? 1 : Math.min(6, Math.max(1, spec.rounds || 1));
  if (n > 1) {
    const base = anim.videos.slice();
    for (let i = 1; i < n; i++) for (const v of base) anim.videos.push({ ...v, t0: v.t0 + i * 0.11 });
    anim.duration += (n - 1) * 0.11;
  }
  // sem vídeo (desligados ou indisponíveis): um risco rápido do atacante ao alvo, para o golpe/tiro aparecer
  if (!anim.videos.length) {
    for (const t of targets) {
      const d = V.norm(V.sub(t.at, spec.from));
      const a = spec.melee ? V.sub(t.at, V.mul(d, cell * 0.9)) : spec.from;
      const color = spec.melee ? "#e8eef5" : "#ffd27a";
      anim.elements.push({ kind: "line", tag: "golpe", t0: 0, t1: 0.35, frame: (tt) => ({ a, b: t.at, color, width: Math.max(3, cell / 24), opacity: Math.max(0, 0.9 * (1 - tt / 0.35)) }) });
    }
    anim.duration = Math.max(anim.duration, 0.4);
  }
  return { ab, anim };
}
export { keyOf };
