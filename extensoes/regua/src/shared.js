// Constantes e utilidades compartilhadas da Régua.
import OBR from "@owlbear-rodeo/sdk";

export const ID = "regua";
export const TOOL_ID = `${ID}/tool`;
export const MODAL_ID = `${ID}/overlay`;
export const TRAIL_CHANNEL = `${ID}/trail`;
export const META_AREA = `${ID}/area`;    // em áreas fixadas: { owner, kind, size }
export const MODES = {
  move: `${ID}/mode-move`,
  measure: `${ID}/mode-measure`,
  vision: `${ID}/mode-vision`,
  circle: `${ID}/mode-circle`,
  cone: `${ID}/mode-cone`,
  square: `${ID}/mode-square`,
  cube: `${ID}/mode-cube`,
  line: `${ID}/mode-line`,
};

export const DEFAULTS = {
  confirm: "right",   // "right" = botão direito confirma (camada sobre o mapa); "native" = duplo clique/Enter
  cellRule: "center", // center | half | touch
  showCells: true,    // destaca os quadrados atingidos pelas áreas
  pin: true,          // manter no mapa como desenho, com as medidas escritas
  pinMeasure: true,   //   ... a régua de medir distância
  pinPath: false,     //   ... o caminho percorrido pelo token
  pinAreas: true,     //   ... as áreas
  visionShared: true, // visão e cobertura: todos veem (senão só você)
  visionTo: "corners",// "corners" = 4 cantos do quadrado alvo (D&D) | "center" = só o centro
  visionAll: true,    // anéis coloridos em todos os tokens mostrando a cobertura de cada um
  difficult: false,   // as próximas áreas fixadas viram terreno difícil (Shift no 2º clique faz o mesmo)
  areaOpacity: 0.22,
  lineWidth: 1,       // largura da linha, em quadrados
  trailMs: 900,       // quanto tempo o caminho fica visível depois de confirmar (não prende a tela)
  stepMs: 90,         // pausa entre um ponto e outro ao andar (dá tempo do Smoke & Spectre checar cada trecho)
};

// ajustes por jogador, no navegador (background, painel e camada são da mesma origem)
const KEY = `${ID}/settings`;
export function loadSettings() {
  try {
    const s = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) };
    if (s.keepAreas === false) { s.pinAreas = false; delete s.keepAreas; } // ajuste antigo (1.0)
    return s;
  } catch { return { ...DEFAULTS }; }
}
/** Vale fixar este tipo de medida agora? */
export function shouldPin(s, kind) {
  if (!s.pin) return false;
  if (kind === "move") return !!s.pinPath;
  if (kind === "measure") return !!s.pinMeasure;
  return !!s.pinAreas;
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* armazenamento bloqueado: segue com o padrão */ }
}

export const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;

/** Tudo da grade que a régua precisa, de uma vez. */
export async function loadGrid() {
  const [dpi, type, measurement, scale] = await Promise.all([
    OBR.scene.grid.getDpi(), OBR.scene.grid.getType(), OBR.scene.grid.getMeasurement(), OBR.scene.grid.getScale(),
  ]);
  return { dpi, type, measurement, scale, square: type === "SQUARE" };
}

/** Mantém uma interação viva: o Owlbear encerra interações paradas, então recria a cada 700 ms. */
export class Keeper {
  constructor(build) { this.build = build; this.mgrs = []; this.alive = true; this.timer = null; }
  async restart() {
    if (!this.alive) return;
    clearTimeout(this.timer);
    const mgr = await OBR.interaction.startItemInteraction(this.build());
    if (!this.alive) { mgr[1](); return; }
    this.mgrs.push(mgr);
    while (this.mgrs.length > 1) this.mgrs.shift()[1]();
    this.timer = setTimeout(() => this.restart(), 700);
  }
  update(fn) { const m = this.mgrs[this.mgrs.length - 1]; if (m) m[0](fn); }
  stop() {
    this.alive = false;
    clearTimeout(this.timer);
    for (const m of this.mgrs) m[1]();
    this.mgrs = [];
  }
}

/** Usa as cores do tema do Owlbear (o painel não fica com texto claro em fundo claro). */
export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}
