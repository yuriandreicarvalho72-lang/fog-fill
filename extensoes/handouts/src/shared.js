import { MAX_DIARIO } from "./core.js";
export const ID = "handouts";
export const BIB = `${ID}/biblioteca`;        // metadado da sala: [{ id, titulo, imagem, texto }] (só o mestre grava)
export const CH_MOSTRAR = `${ID}/mostrar`;    // para todos: { titulo?, imagem?, texto?, nome?, para: "todos"|"gm"|[userId], origem? }
export const MODAL_ID = `${ID}/ver`;
export const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
export const uid = () => Math.random().toString(36).slice(2, 10);

// Diário e "o que está aberto agora" ficam no armazenamento do navegador (background, painel e janela são da mesma origem).
const kDiario = (sala) => `${ID}/diario/${sala || "sala"}`;
export const ATUAL = `${ID}/atual`;
export function lerDiario(sala) { try { const l = JSON.parse(localStorage.getItem(kDiario(sala)) || "[]"); return Array.isArray(l) ? l.slice(0, MAX_DIARIO) : []; } catch { return []; } }
export function gravarDiario(sala, lista) { try { localStorage.setItem(kDiario(sala), JSON.stringify(lista)); } catch { /* cheio ou bloqueado: o diário só não guarda */ } }

export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}
