// Prefab: guarda os gatilhos dentro dos itens e os recria quando uma cópia dos itens aparece (Prefabs, copiar e colar).
// O Prefabs copia os itens (metadados vão junto) com ids novos; os gatilhos apontam para ids, então sem isto ficam para trás.
import { ID, involvedIds, uid } from "./shared.js";

export const PKG = `${ID}/pacote`;  // metadado do item: { id (pacote), k (chave do item), triggers: [gatilho com @i:chave e @t:n] }
export const DONO = `${ID}/dono`;   // metadado do item: id do próprio item quando os gatilhos dele já existem na cena

const TI = "@i:", TT = "@t:";

/** Troca (em profundidade) cada texto que é igual a uma chave do mapa. */
function swap(v, map) {
  if (typeof v === "string") return map.has(v) ? map.get(v) : v;
  if (Array.isArray(v)) return v.map((x) => swap(x, map));
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = swap(v[k], map); return o; }
  return v;
}
/** Todos os textos de um valor. */
function strings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}
/** Gatilhos que o efeito "chain/rearm/cancel" chama (ids de gatilho). */
const calls = (t) => (t.effects || []).map((e) => e.trigger).filter(Boolean);

/**
 * Empacota os gatilhos ligados aos itens selecionados.
 * items: os itens selecionados (com metadata). list: todos os gatilhos da cena.
 * Devolve { pkg, keys: { itemId: chave }, triggers } ou null se nenhum gatilho usa esses itens.
 */
export function pack(items, list) {
  const sel = new Set(items.map((i) => i.id));
  const chosen = new Map();
  for (const t of list) if (involvedIds(t).some((id) => sel.has(id))) chosen.set(t.id, t);
  for (let again = true; again;) { // gatilhos chamados pelos escolhidos (corrente, rearmar, cancelar) vão junto
    again = false;
    for (const t of [...chosen.values()]) for (const c of calls(t)) {
      const x = list.find((y) => y.id === c);
      if (x && !chosen.has(x.id)) { chosen.set(x.id, x); again = true; }
    }
  }
  if (!chosen.size) return null;
  const pkg = items.map((i) => i.metadata?.[PKG]?.id).find(Boolean) || uid() + uid();
  const keys = {};
  for (const i of items) keys[i.id] = i.metadata?.[PKG]?.k || uid();
  const map = new Map();
  for (const [id, k] of Object.entries(keys)) map.set(id, TI + k);
  [...chosen.keys()].forEach((id, n) => map.set(id, TT + n));
  const triggers = [...chosen.values()].map((t) => {
    const c = swap(JSON.parse(JSON.stringify(t)), map);
    c.id = map.get(t.id);
    return c;
  });
  return { pkg, keys, triggers };
}

/**
 * Itens que são cópias novas: têm pacote e ainda não são "donos" dos seus gatilhos.
 * Devolve instâncias: [{ pkg, items: { chave: itemId } }]. O j-ésimo item novo de cada chave forma a cópia j.
 */
export function orphans(items) {
  const byPkg = new Map();
  for (const i of items) {
    const p = i.metadata?.[PKG];
    if (!p?.id || !p.k || i.metadata?.[DONO] === i.id) continue;
    const g = byPkg.get(p.id) || new Map();
    const l = g.get(p.k) || [];
    l.push(i); g.set(p.k, l); byPkg.set(p.id, g);
  }
  const out = [];
  for (const [pkg, g] of byPkg) {
    const n = Math.max(...[...g.values()].map((l) => l.length));
    for (let j = 0; j < n; j++) {
      const inst = { pkg, items: {}, carriers: [] };
      for (const [k, l] of g) if (l[j]) { inst.items[k] = l[j].id; inst.carriers.push(l[j]); }
      out.push(inst);
    }
  }
  return out;
}

/** Cria os gatilhos de uma cópia. Pula o gatilho que usa um item que não veio na cópia. Devolve { triggers, skipped }. */
export function instantiate(packTriggers, inst) {
  const map = new Map();
  for (const [k, id] of Object.entries(inst.items)) map.set(TI + k, id);
  const alive = packTriggers.filter((t) => strings(t).every((s) => !s.startsWith(TI) || map.has(s)));
  const ids = new Map();
  for (const t of alive) ids.set(t.id, uid());
  for (const [tok, id] of ids) map.set(tok, id);
  const triggers = alive.map((t) => {
    const c = swap(t, map);
    c.id = ids.get(t.id);
    c.armed = true;
    // referência a gatilho que não veio junto vira vazia
    return JSON.parse(JSON.stringify(c), (k, v) => (typeof v === "string" && v.startsWith(TT) ? "" : v));
  });
  return { triggers, skipped: packTriggers.length - alive.length };
}
