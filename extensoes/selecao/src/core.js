// Núcleo da Seleção total (sem SDK, testado em Node): acha os itens sob o ponteiro (inclusive trancados, fog e mapa),
// ordena do mais específico para o mais amplo, alterna entre eles a cada clique no mesmo ponto e seleciona por caixa.

/** Camadas, da mais "de cima" para a mais "de baixo" (desempate quando a área é igual). */
export const LAYER_ORDER = ["POINTER", "RULER", "CONTEXT_MENU", "TEXT", "NOTE", "ATTACHMENT", "MOUNT", "CHARACTER", "PROP", "DRAWING", "FOG", "MAP", "GRID"];
const rank = (l) => { const i = LAYER_ORDER.indexOf(l); return i < 0 ? 99 : i; };

export const area = (b) => Math.max(0, b.max.x - b.min.x) * Math.max(0, b.max.y - b.min.y);
export const hasPoint = (b, p) => p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
export const containsBox = (outer, b) => b.min.x >= outer.min.x && b.max.x <= outer.max.x && b.min.y >= outer.min.y && b.max.y <= outer.max.y;
export const touchesBox = (a, b) => a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y;
export const boxOf = (a, b) => ({ min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }, max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) } });

/** entries: [{ id, bounds:{min,max}, layer, zIndex? }]. Os que cobrem o ponto, do menor para o maior. */
export function candidatesAt(entries, p) {
  return entries.filter((e) => e.bounds && hasPoint(e.bounds, p))
    .sort((a, b) => area(a.bounds) - area(b.bounds) || rank(a.layer) - rank(b.layer) || (b.zIndex ?? 0) - (a.zIndex ?? 0));
}

/**
 * Qual item escolher agora. Clicar de novo no mesmo ponto (dentro de tol) passa para o próximo da pilha
 * (assim se chega ao fog e ao mapa embaixo dos outros); em outro ponto volta ao primeiro.
 * state: { x, y, i, ids } da última escolha (ou null). Devolve { pick, state, n, i }.
 */
export function cyclePick(list, p, state, tol = 8) {
  if (!list.length) return { pick: null, state: null, n: 0, i: 0 };
  const ids = list.map((e) => e.id);
  const same = state && Math.hypot(state.x - p.x, state.y - p.y) <= tol && state.ids.join() === ids.join();
  const i = same ? (state.i + 1) % list.length : 0;
  return { pick: list[i], state: { x: p.x, y: p.y, i, ids }, n: list.length, i };
}

/** Itens da caixa: os que ficam inteiros dentro; com `toque` (Alt), todos que encostam nela. */
export function inBox(entries, box, toque = false) {
  return entries.filter((e) => e.bounds && (toque ? touchesBox(e.bounds, box) : containsBox(box, e.bounds))).map((e) => e.id);
}

/** Soma/alterna ids numa seleção (Shift/Ctrl). */
export function toggleIds(current, ids) {
  const set = new Set(current);
  for (const id of ids) { if (set.has(id)) set.delete(id); else set.add(id); }
  return [...set];
}

export const layerLabel = (l) => ({ MAP: "mapa", FOG: "fog", PROP: "objeto", CHARACTER: "personagem", MOUNT: "montaria", DRAWING: "desenho", TEXT: "texto", NOTE: "nota", ATTACHMENT: "anexo", POINTER: "ponteiro", RULER: "régua" }[l] || String(l || "").toLowerCase());
