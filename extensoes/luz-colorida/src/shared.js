// Constantes e utilidades compartilhadas.
export const ID = "luz-colorida";
export const CFG = `${ID}/cor`;             // metadado no token: { color, intensity }
export const SETTINGS = `${ID}/settings`;   // metadado da cena: ajustes globais
export const DF_LIGHT = "rodeo.owlbear.dynamic-fog/light"; // luz do Dynamic Fog

export const DEFAULT_SETTINGS = {
  blend: "SCREEN",     // como a cor se mistura com o mapa
  layer: "DRAWING",    // DRAWING = sob os tokens; ATTACHMENT = sobre os tokens
  shadows: true,       // paredes bloqueiam a cor
  maxSegments: 48,     // limite de trechos de parede considerados por vez
  dirOffset: -90,      // ajuste da direção das luzes em cone (graus)
  posMode: "local", // como o shader acha a posição no mundo: "standalone" (A) ou "viewport" (B)
  debug: false,        // desenha um anel branco no centro de cada luz colorida
  maxLights: 16,       // luzes coloridas ao mesmo tempo (até 24; mais luzes = mais peso)
};

export const PRESETS = [
  { name: "Tocha", color: "#ff8a2a" },
  { name: "Vela", color: "#ffc35a" },
  { name: "Luar", color: "#7fa8ff" },
  { name: "Neon rosa", color: "#ff3fb4" },
  { name: "Neon ciano", color: "#2fe6ff" },
  { name: "Químico", color: "#6dff4a" },
  { name: "Emergência", color: "#ff2a2a" },
  { name: "Arcano", color: "#a066ff" },
];

export const BLENDS = [
  { id: "SCREEN", label: "Brilho (clareia com a cor)" },
  { id: "OVERLAY", label: "Tingir (mantém a textura)" },
  { id: "SOFT_LIGHT", label: "Luz suave" },
  { id: "PLUS", label: "Somar (mais forte)" },
  { id: "COLOR", label: "Só a cor (troca o matiz)" },
];

/** Usa as cores do tema do Owlbear (evita texto claro em fundo claro e vice-versa). */
export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}
