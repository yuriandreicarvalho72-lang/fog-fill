// Cálculo puro da luz pontual (sem SDK: testado em Node).
import { buildSksl, buildUniforms, animId } from "./shader.js";

/** Fator de brilho (0..1) no instante t (s) de uma luz de duração dur e apagar em fade. */
export function envelope(t, dur, fade) {
  const up = Math.min(1, t / 0.12);
  if (dur === "fim" || !fade) return up;
  return Math.max(0, Math.min(up, (dur - t) / fade));
}

export function buildPontual(req, settings, mult = 1, segs = []) {
  const radius = Math.max(8, Number(req.raio) || 150);
  const l = { x: req.x, y: req.y, radius, softness: 0.55, intensity: Math.min(1, Math.max(0.05, (Number(req.intens) || 0.7) * mult)), color: req.cor || "#ffffff", dir: 0, inner: Math.PI, outer: Math.PI, anim: animId(req.anim), speed: 1 };
  const m = 20, W = 2 * (2 * radius + 2 * m);
  const rect = { x: l.x - radius - m, y: l.y - radius - m, w: W, h: W };
  const animated = l.anim > 0;
  const uniforms = buildUniforms([l], segs, animated, { x: rect.x, y: rect.y });
  uniforms.push({ name: "wsize", value: { x: W, y: W } });
  const mode = settings.posMode === "standalone" ? "standalone" : "local";
  return { rect, uniforms, sksl: buildSksl(1, segs.length, mode, false, animated) };
}

