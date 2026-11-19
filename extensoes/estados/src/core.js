// Motor dos Estados: o que cada estado guarda de um item, como aplicar e como comparar.
// Funções puras (sem SDK), testadas em Node.

export const LUZ = "luz-colorida/cor";
export const CLIMA = "clima/camadas";
export const VIG_CAM = "vigilancia/camera"; // câmera da Vigilância (direção, abertura, varredura...)
export const VIG_NODE = "vigilancia/no";    // nó da Matriz da Vigilância (estado: ativo, desativado, loop, hackeado)
export const VIG_VISION = "vigilancia/visao"; // visão especial do token (térmica, baixa luz; o que está ligado)
export const VIG_ONLY = "vigilancia/so-em";   // item que só aparece em térmica ou baixa luz

/** Propriedades que um grupo pode controlar. */
export const PROPS = [
  { id: "position", label: "Posição" },
  { id: "rotation", label: "Rotação" },
  { id: "scale", label: "Tamanho" },
  { id: "visible", label: "Visível / escondido" },
  { id: "locked", label: "Travado" },
  { id: "image", label: "Imagem (troca a arte: porta aberta/fechada; escolha com o Trocador)" },
  { id: "light", label: "Luz (Luz Colorida)" },
  { id: "weather", label: "Clima (camadas do Clima)" },
  { id: "matrix", label: "Câmera e nó da Matriz (Vigilância)" },
  { id: "vision", label: "Visão especial: térmica / baixa luz (Vigilância)" },
];
export const DEFAULT_PROPS = ["position", "rotation", "scale", "visible"];

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isImage = (it) => it.type === "IMAGE" && it.image;

/** Fotografa as propriedades escolhidas de um item. */
export function capture(item, props) {
  const d = {};
  for (const p of props) {
    if (p === "position") d.position = { x: item.position.x, y: item.position.y };
    else if (p === "rotation") d.rotation = item.rotation ?? 0;
    else if (p === "scale") d.scale = { x: item.scale?.x ?? 1, y: item.scale?.y ?? 1 };
    else if (p === "visible") d.visible = item.visible !== false;
    else if (p === "locked") d.locked = !!item.locked;
    else if (p === "image") d.image = isImage(item) ? { content: clone(item.image), grid: clone(item.grid) } : null;
    else if (p === "light") d.light = clone(item.metadata?.[LUZ]) ?? null;
    else if (p === "weather") d.weather = clone(item.metadata?.[CLIMA]) ?? null;
    else if (p === "matrix") d.matrix = { cam: clone(item.metadata?.[VIG_CAM]) ?? null, node: clone(item.metadata?.[VIG_NODE]) ?? null };
    else if (p === "vision") d.vision = { modes: clone(item.metadata?.[VIG_VISION]) ?? null, only: item.metadata?.[VIG_ONLY] ?? null };
  }
  return d;
}

const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Quais propriedades do item estão diferentes do que o estado guardou (só as que o estado tem). */
export function changedProps(item, data, props) {
  if (!data) return props.slice();
  const now = capture(item, props);
  return props.filter((p) => p in data && !eq(now[p], data[p]));
}

/** Aplica o estado num rascunho do item (dentro de updateItems). Só mexe no que o grupo controla. */
export function applyTo(draft, data, props) {
  if (!data) return;
  for (const p of props) {
    if (!(p in data)) continue;
    const v = data[p];
    if (p === "position") draft.position = { ...v };
    else if (p === "rotation") draft.rotation = v;
    else if (p === "scale") draft.scale = { ...v };
    else if (p === "visible") draft.visible = v;
    else if (p === "locked") draft.locked = v;
    else if (p === "image") { if (v && isImage(draft)) { draft.image = clone(v.content); draft.grid = clone(v.grid); } }
    else if (p === "light") draft.metadata[LUZ] = v === null ? undefined : clone(v);
    else if (p === "weather") draft.metadata[CLIMA] = v === null ? undefined : clone(v);
    else if (p === "matrix" && v) {
      draft.metadata[VIG_CAM] = v.cam === null ? undefined : clone(v.cam);
      draft.metadata[VIG_NODE] = v.node === null ? undefined : clone(v.node);
    }
    else if (p === "vision" && v) {
      draft.metadata[VIG_VISION] = v.modes === null ? undefined : clone(v.modes);
      draft.metadata[VIG_ONLY] = v.only === null ? undefined : v.only;
    }
  }
}

/** Próximo estado conforme o pedido: "next", "prev", id do estado ou nome do estado. */
export function resolveTarget(group, to) {
  const st = group.states || [];
  if (!st.length) return null;
  const i = Math.max(0, st.findIndex((s) => s.id === group.current));
  const wrap = group.wrap !== false;
  if (to === "next") return i + 1 < st.length ? st[i + 1] : wrap ? st[0] : st[i];
  if (to === "prev") return i > 0 ? st[i - 1] : wrap ? st[st.length - 1] : st[i];
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  return st.find((s) => s.id === to) || st.find((s) => norm(s.name) === norm(to)) || null;
}

/** Acha um grupo por id ou por nome (para quem chama de fora, como o Gatilhos). */
export function findGroup(groups, ref) {
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  return groups.find((g) => g.id === ref) || groups.find((g) => norm(g.name) === norm(ref)) || null;
}

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Quadro intermediário de uma transição suave (posição, rotação e tamanho). t de 0 a 1. */
export function frame(from, to, t) {
  const k = ease(Math.min(1, Math.max(0, t)));
  const out = {};
  if (from.position && to.position) out.position = { x: lerp(from.position.x, to.position.x, k), y: lerp(from.position.y, to.position.y, k) };
  if (from.rotation !== undefined && to.rotation !== undefined) {
    let d = ((to.rotation - from.rotation + 540) % 360) - 180; // gira pelo lado mais curto
    out.rotation = from.rotation + d * k;
  }
  if (from.scale && to.scale) out.scale = { x: lerp(from.scale.x, to.scale.x, k), y: lerp(from.scale.y, to.scale.y, k) };
  return out;
}

// ---------------- prédios com andares ----------------
// Um prédio é um grupo (kind "floors") cujos estados são os andares (0 = térreo, de baixo para cima).
// Cada item pertence a um andar: no andar dele fica visível, nos outros escondido (os dados de cada estado guardam isso),
// então trocar de andar usa o mesmo motor de troca de estado.
export const FLOOR = "estados/andar"; // metadado do item: { g: prédio, f: andar }
export const isBuilding = (g) => g?.kind === "floors";

/** Dados de cada andar para um item que mora no andar floorId (visível só nele). */
export function floorData(group, floorId, visibleHere = true) {
  const out = {};
  for (const s of group.states || []) out[s.id] = { visible: s.id === floorId ? visibleHere : false };
  return out;
}

/** Andar vizinho: dir +1 = de cima, -1 = de baixo (sem dar a volta). */
export function neighborFloor(group, floorId, dir) {
  const st = group.states || [];
  const i = st.findIndex((s) => s.id === floorId);
  return i < 0 ? null : st[i + dir] || null;
}

/** Nome automático do próximo andar. */
export const floorName = (n) => (n === 0 ? "Térreo" : `${n}º andar`);
