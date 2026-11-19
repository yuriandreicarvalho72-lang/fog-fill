// Constantes, receitas e utilidades do Clima.
import { TYPES } from "./shaders.js";

export const ID = "clima";
export const LAYERS = `${ID}/camadas`;      // no item (mapa ou forma): [camada, ...]
export const FLASH = `${ID}/relampago`;     // canal de broadcast do relâmpago
export const EFFECT_META = `${ID}/effect`;  // marca os efeitos locais

export const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;

const uid = () => Math.random().toString(36).slice(2, 9);

/** Camada nova com os padrões do tipo. */
export function newLayer(type, patch = {}) {
  const t = TYPES.find((x) => x.id === type) || TYPES[0];
  return {
    id: uid(), type: t.id, color: t.color, dir: t.dir ?? 0, speed: t.speed ?? 1,
    density: t.density ?? 1, scale: 1, opacity: 1, above: true, on: true, ...patch,
  };
}

export const PRESETS = [
  { name: "Arena do chefe", layers: [["embers", { density: 1.3 }], ["smoke", { density: 0.55, color: "#2e2222", opacity: 0.8 }], ["pulse", { density: 0.8, speed: 0.6 }]] },
  { name: "Incêndio", layers: [["embers", { density: 1.1 }], ["smoke", { density: 0.8 }], ["heat", { density: 0.8 }], ["ash", { density: 0.7 }]] },
  { name: "Tempestade noturna", layers: [["storm", {}], ["clouds", { density: 1.1 }]] },
  { name: "Cidade neon (chuva ácida)", layers: [["acid", {}], ["fog", { color: "#7a4dff", density: 0.45, opacity: 0.7 }], ["glitch", { density: 0.5, opacity: 0.8 }]] },
  { name: "Esgoto tóxico", layers: [["toxic", { density: 0.8 }], ["spores", { color: "#9dff6a", density: 0.6 }]] },
  { name: "Pane elétrica", layers: [["sparks", { density: 1.2 }], ["glitch", { density: 0.7 }]] },
  { name: "Inverno", layers: [["snow", {}], ["fog", { density: 0.4, opacity: 0.7 }]] },
  { name: "Nevasca", layers: [["blizzard", {}]] },
  { name: "Deserto", layers: [["sand", {}], ["heat", { density: 0.6, color: "#ffc070" }]] },
  { name: "Floresta mágica", layers: [["spores", { color: "#9cf6ff" }], ["leaves", { color: "#ff8fc8", density: 0.6 }], ["fog", { density: 0.4, color: "#bfe8d8" }]] },
  { name: "Submerso", layers: [["underwater", {}], ["spores", { color: "#bff6ff", density: 0.4, speed: 0.4 }]] },
  { name: "Chuva leve", layers: [["rain", { density: 0.6 }]] },
];

export function presetLayers(name) {
  const p = PRESETS.find((x) => x.name === name);
  return p ? p.layers.map(([t, patch]) => newLayer(t, patch)) : [];
}

/** Usa as cores do tema do Owlbear. */
export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}

/** Itens que podem receber clima: mapas (imagens na camada Mapa) e formas/desenhos (zonas). */
export const canHaveWeather = (i) =>
  (i.type === "IMAGE" && i.layer === "MAP") || ["SHAPE", "PATH", "CURVE"].includes(i.type);
