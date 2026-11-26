// Efeitos que ficam no mapa (habilidade com duração, efeito visual dos Gatilhos).
// A lista fica no metadado da cena (todos veem, quem entra depois também); cada navegador desenha os seus vídeos
// com itens locais, em loop, até a duração acabar ou o mestre encerrar. O mestre líder tira da lista os que venceram.
import OBR from "@owlbear-rodeo/sdk";
import { videoItem } from "./render.js";
import { ID, uid } from "./shared.js";
import { CAMADA_SOB } from "./abil.js";

export const ATIVOS = `${ID}/efeitos-ativos`; // metadado da cena: [{ id, nome, tag, by, at, until (ms | null = até encerrar), v: [vídeo compacto] }]
export const ATIVO_FX = `${ID}/fx-ativo`;     // marca dos itens locais (fora do "limpar" do Arsenal)
const MAX = 12, MAX_CHARS = 7000;             // o metadado da cena é dividido com as outras extensões: lista curta

export const listOf = (md) => (Array.isArray(md?.[ATIVOS]) ? md[ATIVOS] : []);
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const pack = (v) => ({ f: v.file, w: v.w, h: v.h, d: r2(v.dpi), o: [r2(v.offset.x), r2(v.offset.y)], p: [r2(v.position.x), r2(v.position.y)], r: r2(v.rotation), t: r2(v.t0), ...(v.layer ? { y: v.layer } : {}) });
const unpack = (c) => ({ file: c.f, w: c.w, h: c.h, dpi: c.d, offset: { x: c.o[0], y: c.o[1] }, position: { x: c.p[0], y: c.p[1] }, rotation: c.r, t0: c.t, layer: c.y });
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Guarda um efeito que fica. dur = segundos ou "fim" (até encerrar). Os mais antigos saem se a lista encher. */
export async function addAtivo({ nome, tag, by, dur, vids }) {
  if (!vids?.length || !dur) return null;
  const at = Date.now();
  const t0 = Math.max(0, ...vids.map((v) => v.t0 || 0));
  const e = { id: uid(), nome: nome || "Efeito", tag: tag || nome || "", by: by || "", at, until: dur === "fim" ? null : Math.round(at + (t0 + Number(dur)) * 1000), v: vids.map(pack) };
  const list = [...listOf(await OBR.scene.getMetadata()), e];
  let cut = 0;
  while (list.length > 1 && (list.length > MAX || JSON.stringify(list).length > MAX_CHARS)) { list.shift(); cut++; }
  await OBR.scene.setMetadata({ [ATIVOS]: list });
  if (cut) OBR.notification.show(`Arsenal: ${cut} efeito(s) mais antigo(s) encerrado(s) para caber o novo (máximo ${MAX} ao mesmo tempo).`, "INFO");
  return e;
}

/** Encerra os efeitos em que fn(e) é verdade. Devolve quantos saíram. */
export async function endAtivos(fn) {
  const list = listOf(await OBR.scene.getMetadata());
  const keep = list.filter((e) => !fn(e));
  if (keep.length !== list.length) await OBR.scene.setMetadata({ [ATIVOS]: keep });
  return list.length - keep.length;
}
/** Troca a camada (sob/sobre os tokens) de um efeito que ficou no mapa. */
export async function setAtivoCamada(id, camada) {
  const list = listOf(await OBR.scene.getMetadata()).map((e) => (e.id !== id ? e : { ...e, v: e.v.map((c) => { const n = { ...c }; if (camada === "sob") n.y = CAMADA_SOB; else delete n.y; return n; }) }));
  await OBR.scene.setMetadata({ [ATIVOS]: list });
}
/** Pelo nome do efeito (o "nome" que o Gatilhos deu, ou o nome da habilidade). "" ou "*" = todos. */
export const endByTag = (tag) => { const t = sem(tag); return endAtivos((e) => !t || t === "*" || sem(e.tag) === t || sem(e.nome) === t); };

/** Todos os navegadores: desenha a lista e acompanha as mudanças. has() = arquivos disponíveis (null = vídeos desligados). */
export async function setupAtivos({ base, has, isLeader }) {
  const shown = new Map(); // id -> { ids, timers }
  const drop = (id) => {
    const rec = shown.get(id);
    if (!rec) return;
    shown.delete(id);
    rec.timers.forEach(clearTimeout);
    if (rec.ids.length) OBR.scene.local.deleteItems(rec.ids).catch(() => {});
  };
  let last = [];
  const sync = (list) => {
    last = list;
    const now = Date.now();
    const h = has();
    const keep = new Set();
    for (const e of list) {
      keep.add(e.id);
      const sig = (e.v || []).map((c) => c.y || "").join(",");
      if (shown.has(e.id) && shown.get(e.id).sig !== sig) drop(e.id); // camada trocada: desenha de novo
      if (shown.has(e.id)) continue;
      const rec = { ids: [], timers: [], sig };
      shown.set(e.id, rec);
      if (e.until) rec.timers.push(setTimeout(() => drop(e.id), Math.max(0, e.until - e.at))); // conta daqui (relógios diferentes)
      if (!h) continue;
      for (const c of e.v || []) {
        const v = unpack(c);
        if (!(v.w > 0 && v.h > 0 && (h(v.file) || /^(https?:|\.\.\/)/.test(v.file)))) continue;
        const item = videoItem(v, base);
        item.metadata = { [ATIVO_FX]: e.id };
        rec.ids.push(item.id);
        const wait = Math.min(v.t0 * 1000, Math.max(0, e.at + v.t0 * 1000 - now));
        rec.timers.push(setTimeout(() => { if (shown.get(e.id) === rec) OBR.scene.local.addItems([item]).catch(() => {}); }, wait));
      }
    }
    for (const id of [...shown.keys()]) if (!keep.has(id)) drop(id);
  };
  // o líder tira da lista os que venceram
  let expT = null;
  const expire = (list) => {
    clearTimeout(expT);
    const next = Math.min(...list.filter((e) => e.until).map((e) => e.until));
    if (!Number.isFinite(next)) return;
    expT = setTimeout(async () => { if (await isLeader()) endAtivos((e) => e.until && e.until <= Date.now() + 100).catch(() => {}); }, Math.max(0, next - Date.now()) + 50);
  };
  const onList = (md) => { const l = listOf(md); sync(l); expire(l); };
  const left = await OBR.scene.local.getItems((i) => i.metadata?.[ATIVO_FX]).catch(() => []);
  if (left.length) await OBR.scene.local.deleteItems(left.map((i) => i.id)).catch(() => {});
  if (await OBR.scene.isReady()) onList(await OBR.scene.getMetadata());
  OBR.scene.onReadyChange(async (r) => { if (r) onList(await OBR.scene.getMetadata()); else { for (const id of [...shown.keys()]) drop(id); last = []; } });
  OBR.scene.onMetadataChange(onList);
  // vídeos ligados/desligados neste navegador (Otimizador): desenha de novo
  return { resync: () => { for (const id of [...shown.keys()]) drop(id); sync(last); } };
}
