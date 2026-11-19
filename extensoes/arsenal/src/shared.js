// Constantes e utilidades do Arsenal.
import { PROFILES, ROUNDS } from "./fx.js";

export const ID = "arsenal";
export const META_FX = `${ID}/fx`;          // marca dos itens locais de efeito
export const META_AIM = `${ID}/mira`;       // marca das miras locais
export const WEAPONS = `${ID}/armas`;       // metadado do token: repertório [arma]
export const ACTIVE = `${ID}/ativo`;        // metadado do jogador: { shooter, weapon, mode, hit, impact }
export const TARGETS = `${ID}/alvos`;       // metadado do jogador: [{ id?, at }]
export const CONFIG = `${ID}/config`;       // metadado do jogador: aparência
export const CH_SHOT = `${ID}/disparo`;     // todos: { spec, shooter, weapon, targets } (outras extensões podem ouvir)
export const CH_LABEL = `${ID}/rotulo`;     // todos: { at, text }
export const CH_CLEAR = `${ID}/limpar`;     // todos: apagar fumaça e efeitos que ficaram
export const TOOL = `${ID}/tool`;
export const MODE_AIM = `${ID}/mirar`;

export const DEFAULT_CONFIG = { intensity: 1, speed: 1, ownColor: false, color: "#ffd27a", gore: true, casings: true, smokeSec: 30 };

export const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Granadas de mão (não estão na planilha). */
export const GRENADES = [
  { n: "Granada de fragmentação", c: "Granadas", fx: "frag", m: ["single"], mag: 1, r: [9, 18], dmg: "" },
  { n: "Granada de fumaça", c: "Granadas", fx: "smoke", m: ["single"], mag: 1, r: [9, 18], dmg: "" },
  { n: "Granada de luz (flashbang)", c: "Granadas", fx: "flashbang", m: ["single"], mag: 1, r: [9, 18], dmg: "" },
];

/** Catálogo compacto (gerado por tools/catalogo.py a partir da planilha) -> lista de armas. */
export function decodeCatalog(raw) {
  const modes = { s: "single", b: "burst", a: "auto", j: "spray" };
  return raw.w.map(([n, ci, r0, r1, m, mag, xi]) => ({
    n, c: raw.c[ci], r: [r0, r1], rt: r0 == null ? "" : r1 != null && r1 !== r0 ? `${r0}m/${r1}m` : `${r0}m`,
    m: [...m].map((k) => modes[k]), mag, fx: raw.x[xi],
  }));
}

/** Uma arma do catálogo vira uma arma do repertório (com munição cheia). */
export function weaponFrom(entry) {
  const modes = [...entry.m];
  if (modes.includes("auto") && !modes.includes("supp")) modes.push("supp");
  return {
    id: uid(), name: entry.n, cat: entry.c || "", fx: entry.fx, modes, mode: modes[0],
    mag: entry.mag ?? null, ammo: entry.mag ?? null, range: entry.r || [null, null], dmg: entry.dmg || "",
  };
}

export const roundsFor = (mode) => ROUNDS[mode] || 1;
export const fxLabel = (fx) => PROFILES[fx]?.label || fx;

/** Metros por unidade da grade (para comparar com o alcance da planilha, em metros). */
export function metersPerUnit(unit) {
  const u = String(unit || "").toLowerCase();
  if (u.startsWith("ft") || u.includes("feet") || u.includes("pé")) return 0.3048;
  if (u === "km") return 1000;
  if (u.startsWith("mi")) return 1609;
  if (u === "cm") return 0.01;
  return 1; // m ou desconhecido
}

/** Faixa de alcance a partir do alcance normal/longo da arma (em metros). */
export function rangeBand(meters, range) {
  const [n, l] = range || [];
  if (n == null) return { key: "free", label: "sem limite" };
  if (meters <= n / 2) return { key: "short", label: "curto" };
  if (meters <= n) return { key: "medium", label: "médio" };
  if (l != null && meters <= l) return { key: "long", label: "longo (desvantagem)" };
  return { key: "out", label: "fora de alcance" };
}

export const isToken = (i) => i.type === "IMAGE" && (i.layer === "CHARACTER" || i.layer === "MOUNT");
export const itemName = (i) => i?.text?.plainText?.trim() || i?.name || "token";

/** Tipo de impacto: carne em personagens, metal em objetos, chão em pontos vazios. */
export function impactKind(item, override) {
  if (override && override !== "auto") return override;
  if (!item) return "ground";
  if (isToken(item)) return "flesh";
  return "metal";
}

export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}
