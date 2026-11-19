// Núcleo do Trocador (sem SDK): imagens alternativas guardadas no próprio token.
// Cada imagem: { id, name, url, mime, w, h, dpi, offset }. A imagem "atual" é descoberta pela URL do token
// (assim o Estados pode trocar a imagem por conta própria e o Trocador continua sabendo qual é).

export const KEY = "trocador/imagens";   // metadado do token: [imagem]
export const RENAME = "trocador/renomear"; // metadado do token: true = troca o nome do token junto

const uid = () => Math.random().toString(36).slice(2, 9);
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export const isImageItem = (it) => it?.type === "IMAGE" && !!it.image;

/** Imagem a partir do próprio token (a arte que ele está usando agora). */
export function fromItem(it, name) {
  return {
    id: uid(), name: name || it.name || "Original",
    url: it.image.url, mime: it.image.mime || "", w: it.image.width, h: it.image.height,
    dpi: it.grid?.dpi ?? null, offset: it.grid?.offset ? { ...it.grid.offset } : null,
  };
}

/** Imagem a partir do que o seletor de imagens do Owlbear devolve (ImageDownload). */
export function fromDownload(d) {
  return {
    id: uid(), name: d.name || "Imagem",
    url: d.image.url, mime: d.image.mime || "", w: d.image.width, h: d.image.height,
    dpi: d.grid?.dpi ?? null, offset: d.grid?.offset ? { ...d.grid.offset } : null,
  };
}

export const variantsOf = (it) => (Array.isArray(it?.metadata?.[KEY]) ? it.metadata[KEY] : []);

/** Índice da imagem que o token está usando (-1 se a arte atual não está na lista). */
export const currentIndex = (it, list = variantsOf(it)) => list.findIndex((v) => v.url === it?.image?.url);
export const currentVariant = (it) => variantsOf(it)[currentIndex(it)] || null;

/** Junta imagens novas à lista, sem repetir a mesma URL. */
export function addVariants(list, extra) {
  const out = [...(list || [])];
  for (const v of extra) if (!out.some((x) => x.url === v.url)) out.push(v);
  return out;
}

/**
 * Qual imagem usar. to: "next" | "prev" | id | nome (sem diferenciar maiúsculas e acentos).
 * Devolve a imagem ou null (não achou / lista vazia).
 */
export function resolve(it, to) {
  const list = variantsOf(it);
  if (!list.length || to == null || to === "") return null;
  const i = currentIndex(it, list);
  if (to === "next") return list[(i + 1 + list.length) % list.length];
  if (to === "prev") return list[(i - 1 + list.length * 2) % list.length];
  return list.find((v) => v.id === to) || list.find((v) => norm(v.name) === norm(to)) || null;
}

/** Aplica a imagem no item (rascunho do Owlbear). Não mexe em posição, escala nem rotação. */
export function applyVariant(draft, v, rename = false) {
  draft.image.url = v.url;
  draft.image.width = v.w;
  draft.image.height = v.h;
  if (v.mime) draft.image.mime = v.mime;
  if (v.dpi != null || v.offset) {
    draft.grid = { ...(draft.grid || {}) };
    if (v.dpi != null) draft.grid.dpi = v.dpi;
    if (v.offset) draft.grid.offset = { ...v.offset };
  }
  if (rename && v.name) draft.name = v.name;
}

/**
 * Vários tokens selecionados e o usuário escolheu a imagem "v" (da lista de um deles):
 * cada token usa a SUA imagem com o mesmo nome, se tiver; senão recebe a própria "v".
 */
export function variantFor(it, v) {
  return variantsOf(it).find((x) => norm(x.name) === norm(v.name)) || v;
}

/** Nomes de imagem disponíveis num conjunto de itens (para o Gatilhos listar). */
export function namesIn(items) {
  const seen = new Map();
  for (const it of items) for (const v of variantsOf(it)) if (!seen.has(norm(v.name))) seen.set(norm(v.name), v.name);
  return [...seen.values()];
}
