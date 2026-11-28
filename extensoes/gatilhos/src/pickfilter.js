// Parte pura do seletor de itens (sem SDK, testada em Node).
export const LAYERS = { MAP: "Mapa", GRID: "Grade", DRAWING: "Desenho", PROP: "Objeto", MOUNT: "Montaria", CHARACTER: "Personagem", ATTACHMENT: "Anexo", NOTE: "Nota", TEXT: "Texto", RULER: "Régua", FOG: "Fog", POINTER: "Ponteiro", CONTROL: "Controle", POPOVER: "Popover", POST_PROCESS: "Efeito" };
export const labelOf = (i) => (i.text?.plainText || i.name || "").trim() || `(${i.type.toLowerCase()} sem nome)`;
export const FILTERS = [["todos", "Todos"], ["MAP", "Mapa"], ["FOG", "Fog"], ["trancado", "🔒 Trancados"], ["escondido", "Escondidos"], ["porta", "Portas"]];
export const ORDER = ["FOG", "MAP", "DRAWING", "PROP", "CHARACTER", "MOUNT", "ATTACHMENT", "NOTE", "TEXT", "GRID", "RULER", "CONTROL", "POPOVER", "POINTER", "POST_PROCESS"];

/** Aplica busca e filtro. Pura (testável). door = função que diz se o item é porta da névoa. */
export function filterItems(items, q, f, door = () => false) {
  const t = String(q || "").trim().toLowerCase();
  return items
    .filter((i) => (f === "todos" || !f) ? true : f === "trancado" ? !!i.locked : f === "escondido" ? i.visible === false : f === "porta" ? door(i) : i.layer === f)
    .filter((i) => !t || labelOf(i).toLowerCase().includes(t) || (i.name || "").toLowerCase().includes(t) || (LAYERS[i.layer] || i.layer).toLowerCase().includes(t) || i.type.toLowerCase().includes(t))
    .sort((a, b) => (ORDER.indexOf(a.layer) - ORDER.indexOf(b.layer)) || labelOf(a).localeCompare(labelOf(b), "pt-BR"));
}

