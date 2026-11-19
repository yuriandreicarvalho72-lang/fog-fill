// Operações do Trocador com o SDK (usadas pelo menu do botão direito, pelo painel e pelo segundo plano).
import OBR from "@owlbear-rodeo/sdk";
import { KEY, RENAME, isImageItem, variantsOf, resolve, applyVariant, variantFor, addVariants, fromItem, fromDownload } from "./core.js";

export const ID = "trocador";
export const CH_SWAP = `${ID}/trocar`;     // outras extensões (Gatilhos) -> mestre: { targets: [id], to: "next"|"prev"|nome|id, from? }
export const CH_CHANGED = `${ID}/trocou`;  // todos: { items: [{ id, name }] } depois de cada troca (para quem quiser ouvir)

export const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
export const itemName = (i) => i?.text?.plainText?.trim() || i?.name || "item";

async function announce(items) {
  if (!items.length) return;
  OBR.broadcast.sendMessage(CH_CHANGED, { items }, { destination: "ALL" }).catch(() => {});
}

/**
 * Troca a imagem de vários itens. to: "next" | "prev" | nome | id, ou uma imagem (objeto) escolhida na lista
 * de um deles — aí cada item usa a sua imagem de mesmo nome (ou recebe aquela).
 * Devolve quantos itens mudaram.
 */
export async function swap(ids, to) {
  const items = (await OBR.scene.items.getItems(ids)).filter(isImageItem);
  const plan = new Map();
  for (const it of items) {
    const v = typeof to === "object" ? variantFor(it, to) : resolve(it, to);
    if (v && v.url !== it.image.url) plan.set(it.id, { v, rename: it.metadata?.[RENAME] === true });
  }
  if (!plan.size) return 0;
  await OBR.scene.items.updateItems([...plan.keys()], (d) => {
    for (const it of d) { const p = plan.get(it.id); applyVariant(it, p.v, p.rename); }
  });
  announce([...plan].map(([id, p]) => ({ id, name: p.v.name })));
  return plan.size;
}

/** Guarda a arte atual de cada item na lista dele (se ainda não estiver lá). */
export async function saveCurrent(ids, name) {
  await OBR.scene.items.updateItems(ids, (d) => {
    for (const it of d) {
      if (!isImageItem(it)) continue;
      const list = variantsOf(it);
      if (list.some((v) => v.url === it.image.url)) continue;
      it.metadata[KEY] = addVariants(list, [fromItem(it, name || (list.length ? `Imagem ${list.length + 1}` : "Original"))]);
    }
  });
}

/** Abre o seletor de imagens do Owlbear e junta as escolhidas à lista de cada item (a arte atual entra também). */
export async function pickAndAdd(ids) {
  const got = await OBR.assets.downloadImages(true, undefined, "CHARACTER").catch(() => []);
  if (!got?.length) return 0;
  const extra = got.map(fromDownload);
  await OBR.scene.items.updateItems(ids, (d) => {
    for (const it of d) {
      if (!isImageItem(it)) continue;
      let list = variantsOf(it);
      if (!list.some((v) => v.url === it.image.url)) list = addVariants(list, [fromItem(it, list.length ? undefined : "Original")]);
      it.metadata[KEY] = addVariants(list, extra);
    }
  });
  return extra.length;
}

/** Muda a lista de imagens de um item. */
export async function editList(id, fn) {
  await OBR.scene.items.updateItems([id], (d) => {
    for (const it of d) {
      const next = fn(JSON.parse(JSON.stringify(variantsOf(it))));
      if (next.length) it.metadata[KEY] = next; else delete it.metadata[KEY];
    }
  });
}

/** Copia a lista de imagens de um item para outros (ex.: todos os guardas com as mesmas artes). */
export async function copyList(fromId, toIds) {
  const [src] = await OBR.scene.items.getItems([fromId]);
  const list = variantsOf(src);
  if (!list.length) return;
  await OBR.scene.items.updateItems(toIds.filter((x) => x !== fromId), (d) => {
    for (const it of d) it.metadata[KEY] = addVariants(variantsOf(it), JSON.parse(JSON.stringify(list)));
  });
}

export function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}
