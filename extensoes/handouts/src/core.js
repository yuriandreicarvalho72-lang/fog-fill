// Handouts: funções puras (sem o SDK), testadas em test/core.mjs.

export const MAX_TITULO = 80;
export const MAX_TEXTO = 4000;
export const MAX_URL = 600;
export const MAX_BIB = 60;
export const MAX_DIARIO = 60;

/** Aceita só http(s) e converte links de "página" comuns no link direto da imagem. */
export function normImagem(u) {
  let s = String(u ?? "").trim();
  if (!/^https?:\/\/\S+$/i.test(s) || s.length > MAX_URL) return "";
  // GitHub: .../blob/ramo/arquivo -> raw.githubusercontent.com/.../ramo/arquivo
  let m = s.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
  if (m) s = `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3].split("?")[0]}`;
  // Dropbox: dl=0 mostra a página; raw=1 entrega o arquivo
  if (/^https?:\/\/(www\.)?dropbox\.com\//i.test(s)) s = s.replace(/([?&])dl=0/, "$1raw=1");
  // Google Drive: arquivo compartilhado -> link direto de imagem
  m = s.match(/^https?:\/\/drive\.google\.com\/file\/d\/([\w-]+)/i) || s.match(/^https?:\/\/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]+)/i);
  if (m) s = `https://lh3.googleusercontent.com/d/${m[1]}`;
  return s;
}

/** Limpa um handout vindo de fora (formulário, mensagem, metadado). */
export function limpa(h = {}) {
  return {
    id: String(h.id || "").slice(0, 24),
    titulo: String(h.titulo ?? "").trim().slice(0, MAX_TITULO),
    imagem: normImagem(h.imagem),
    texto: String(h.texto ?? "").slice(0, MAX_TEXTO),
  };
}
export const vazio = (h) => !h.titulo && !h.imagem && !h.texto.trim();

/** Este navegador deve mostrar? para: "todos" | "gm" | [ids de usuários]. */
export function deveMostrar(para, meuId, papel) {
  if (Array.isArray(para)) return para.includes(meuId);
  if (para === "gm") return papel === "GM";
  return true;
}

/** Quem vê de fato: "gm" só o mestre; lista só quem está nela; sem "para" = todos. */
export const paraOf = (p) => (Array.isArray(p) ? [...new Set(p.filter((x) => typeof x === "string" && x))] : p === "gm" ? "gm" : "todos");

const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/** Acha na biblioteca por nome (exato, depois "contém"). */
export function achaPorNome(lib, nome) {
  const n = sem(nome);
  if (!n) return null;
  return lib.find((h) => sem(h.titulo) === n) || lib.find((h) => sem(h.titulo).includes(n)) || null;
}

/** Mensagem de "mostrar": se vier só o nome, completa pela biblioteca; o que vier escrito vence. */
export function resolve(msg = {}, lib = []) {
  const base = msg.nome ? achaPorNome(lib, msg.nome) : null;
  const h = limpa({ ...(base || {}), ...Object.fromEntries(Object.entries(msg).filter(([k, v]) => ["titulo", "imagem", "texto"].includes(k) && String(v ?? "").trim())) , id: base?.id || msg.id });
  return h;
}

/** Chave estável de um handout (para o diário não repetir o mesmo). */
export const chaveDe = (h) => `${h.id || ""}|${h.titulo}|${h.imagem}|${h.texto.length}|${h.texto.slice(0, 40)}`;

/** Põe no começo do diário; repetido sobe para o topo; limite de itens. */
export function addDiario(lista, h, quando, max = MAX_DIARIO) {
  const k = chaveDe(h);
  return [{ ...h, k, quando }, ...lista.filter((x) => x.k !== k)].slice(0, max);
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** Texto simples para HTML: **negrito**, _itálico_ e quebras de linha. Sempre escapado. */
export function fmt(texto) {
  return esc(texto).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])_(.+?)_(?=[\s).,;!?]|$)/g, "$1<i>$2</i>").replace(/\n/g, "<br>");
}
