// Perfil de desempenho do Otimizador. Este arquivo é IGUAL em todas as extensões que obedecem ao Otimizador
// (Arsenal, Luz Colorida, Clima, Vigilância e o próprio Otimizador): mude em todas juntas.
// O perfil fica neste navegador (localStorage). As nossas extensões estão todas no mesmo site, então todas leem
// o mesmo valor. Sem perfil escolhido, readPerf() devolve null e cada extensão segue as próprias configurações.
import OBR from "@owlbear-rodeo/sdk";

export const PERF_KEY = "otimizador/perfil";  // localStorage: { level, custom? }
export const CH_PERF = "otimizador/perfil";   // LOCAL: o perfil mudou
export const CH_CLEAN = "otimizador/limpar";  // LOCAL: apagar e redesenhar os itens locais (efeitos, miras, cones)

const INF = 999;
/** Limites de cada perfil. Os números são tetos: a extensão usa o menor entre o dela e o do perfil. */
export const LEVELS = {
  maximo: {
    arsenal: { jb2a: true, casings: true, intensity: 1.5 },
    luz: { on: true, anim: true, shadows: true, maxLights: INF, maxSegments: INF },
    clima: { on: true, maxLayers: INF, density: 1, lightning: true },
    vig: { tint: true, sweepMs: 160 },
  },
  equilibrado: {
    arsenal: { jb2a: true, casings: true, intensity: 1 },
    luz: { on: true, anim: true, shadows: true, maxLights: 10, maxSegments: 32 },
    clima: { on: true, maxLayers: 2, density: 0.8, lightning: true },
    vig: { tint: true, sweepMs: 250 },
  },
  leve: {
    arsenal: { jb2a: false, casings: false, intensity: 0.8 },
    luz: { on: true, anim: false, shadows: true, maxLights: 6, maxSegments: 16 },
    clima: { on: true, maxLayers: 1, density: 0.6, lightning: true },
    vig: { tint: true, sweepMs: 500 },
  },
  apresentacao: {
    arsenal: { jb2a: false, casings: false, intensity: 0.6 },
    luz: { on: false, anim: false, shadows: false, maxLights: 0, maxSegments: 0 },
    clima: { on: false, maxLayers: 0, density: 0.5, lightning: false },
    vig: { tint: false, sweepMs: 1000 },
  },
};
export const LEVEL_LIST = [
  ["maximo", "Máximo", "tudo ligado, como as extensões vêm"],
  ["equilibrado", "Equilibrado", "menos luzes coloridas e camadas de clima ao mesmo tempo"],
  ["leve", "Leve", "sem vídeos do Arsenal, luz sem animação, 1 camada de clima"],
  ["apresentacao", "Apresentação", "computador fraco ou telão: sem luz colorida, sem clima, sem vídeos"],
];

const merge = (base, over) => {
  const out = {};
  for (const k of Object.keys(base)) out[k] = { ...base[k], ...((over || {})[k] || {}) };
  return out;
};

/** O que está guardado: { level, custom } ou null. */
export function readRaw() {
  try { const s = JSON.parse(localStorage.getItem(PERF_KEY) || "null"); return s && s.level ? s : null; } catch { return null; }
}
/** Limites em vigor neste navegador ({ level, arsenal, luz, clima, vig }) ou null (sem perfil). */
export function readPerf() {
  const s = readRaw();
  if (!s) return null;
  if (s.level === "custom") return { level: "custom", ...merge(LEVELS[s.base] || LEVELS.equilibrado, s.custom) };
  return LEVELS[s.level] ? { level: s.level, ...merge(LEVELS[s.level], null) } : null;
}
/** Guarda e avisa as extensões deste navegador. raw = { level, base?, custom? } ou null (desligar). */
export function writePerf(raw) {
  try { if (raw) localStorage.setItem(PERF_KEY, JSON.stringify(raw)); else localStorage.removeItem(PERF_KEY); } catch { /* sem armazenamento */ }
  OBR.broadcast.sendMessage(CH_PERF, raw || {}, { destination: "LOCAL" }).catch(() => {});
}
/** Chama cb(perf) quando o perfil muda (chamar dentro de OBR.onReady). */
export function onPerf(cb) {
  let last = JSON.stringify(readPerf());
  const fire = () => { const p = readPerf(); const k = JSON.stringify(p); if (k !== last) { last = k; cb(p); } };
  try { window.addEventListener("storage", (e) => { if (e.key === PERF_KEY || e.key === null) fire(); }); } catch { /* sem storage */ }
  OBR.broadcast.onMessage(CH_PERF, fire);
}
/** Chama cb() quando o Otimizador pede para limpar e redesenhar os itens locais. */
export function onClean(cb) {
  OBR.broadcast.onMessage(CH_CLEAN, () => cb());
}
