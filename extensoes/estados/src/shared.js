// Constantes e utilidades dos Estados.
import { DEFAULT_PROPS, floorName } from "./core.js";

export const ID = "estados";
export const GROUPS = `${ID}/grupos`;     // metadado da cena: [grupo, ...]
export const DATA = `${ID}/dados`;        // metadado do item: { [grupoId]: { [estadoId]: dados } }
export const BUTTON = `${ID}/botao`;      // metadado do item-botão: { group, to }
// canais (outras extensões, como o Gatilhos, usam o mesmo nome)
export const CH_SET = `${ID}/mudar`;      // { group: id|nome, to: "next"|"prev"|id|nome }
export const CH_CHANGED = `${ID}/mudou`;  // { group, groupName, state, stateName }
export const CH_NOTE = `${ID}/aviso`;     // { text }
export const TROCADOR_IMAGES = "trocador/imagens"; // metadado do item: imagens guardadas pela extensão Trocador

export const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
export const uid = () => Math.random().toString(36).slice(2, 9);

export const TRANSITIONS = [
  [0, "Na hora"], [500, "Deslizar 0,5 s"], [1000, "Deslizar 1 s"], [2000, "Deslizar 2 s"], [4000, "Deslizar 4 s"],
];

export function newGroup(name = "Grupo") {
  const a = { id: uid(), name: "Estado 1", note: "" };
  return { id: uid(), name, states: [a], current: a.id, props: DEFAULT_PROPS.slice(), rec: true, transition: 0, wrap: true };
}

/** Prédio novo: térreo e 1º andar; só controla o visível (cada item mora num andar). */
export function newBuilding(name = "Prédio") {
  const t = { id: uid(), name: floorName(0), note: "" }, a = { id: uid(), name: floorName(1), note: "" };
  return { id: uid(), name, kind: "floors", states: [t, a], current: t.id, props: ["visible"], rec: false, transition: 0, wrap: false };
}

export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}
