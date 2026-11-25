import "./visibility.js";
import "./compact.js";
// Painel do Trocador: organiza as imagens do item selecionado (nome, ordem, remover), copia a lista para
// outros itens e explica a integração com Gatilhos e Estados.
import OBR from "@owlbear-rodeo/sdk";
import { RENAME, variantsOf, currentIndex, isImageItem } from "./core.js";
import { swap, saveCurrent, pickAndAdd, editList, copyList, itemName, applyTheme } from "./ops.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const thumb = (v) => (v.mime?.startsWith("video")
  ? `<video src="${esc(v.url)}" muted preload="metadata"></video>`
  : `<img src="${esc(v.url)}" alt="" loading="lazy" />`);

let role = "PLAYER";
let sel = [];
let items = [];
const typing = () => document.activeElement?.tagName === "INPUT" && document.activeElement.type === "text";

async function load() {
  sel = (await OBR.player.getSelection()) || [];
  items = (await OBR.scene.items.getItems(sel)).filter(isImageItem);
  render();
}

function render() {
  const box = $("sel");
  const gm = role === "GM";
  const first = items[0];
  if (!first) {
    box.innerHTML = `<p class="hint">Selecione um token ou objeto no mapa. ${gm ? "Depois use <b>+ Adicionar imagens</b> para escolher as artes dele (normal, ferido, disfarçado, porta aberta/fechada…)." : "Se o mestre deu imagens a ele, elas aparecem aqui."}</p>`;
    return;
  }
  const list = variantsOf(first);
  const cur = currentIndex(first, list);
  const ids = items.map((i) => i.id);
  box.innerHTML = `
    <div class="row"><b class="grow">${esc(itemName(first))}</b>${items.length > 1 ? `<span class="tag">+${items.length - 1} selecionado(s)</span>` : ""}</div>
    ${items.length > 1 ? '<p class="hint">Clicar numa imagem troca todos os selecionados: cada um usa a sua imagem de mesmo nome (ou recebe esta).</p>' : ""}
    <div class="vlist">${list.map((v, i) => `
      <div class="vrow${i === cur ? " on" : ""}" data-i="${i}">
        <button type="button" class="th" data-use="${i}" title="Usar esta imagem">${thumb(v)}</button>
        ${gm ? `<input type="text" data-name="${i}" value="${esc(v.name)}" title="Nome (o Gatilhos usa este nome)" />` : `<span class="grow">${esc(v.name)}</span>`}
        ${gm ? `<button type="button" class="mini" data-up="${i}" title="Subir" ${i ? "" : "disabled"}>▲</button>
        <button type="button" class="mini" data-down="${i}" title="Descer" ${i < list.length - 1 ? "" : "disabled"}>▼</button>
        <button type="button" class="mini x" data-del="${i}" title="Tirar da lista" ${i === cur ? "disabled" : ""}>✕</button>` : ""}
      </div>`).join("") || '<p class="hint">Nenhuma imagem guardada ainda.</p>'}</div>
    <div class="btns">
      <button type="button" id="prev" ${list.length > 1 ? "" : "disabled"}>◀ anterior</button>
      <button type="button" id="next" ${list.length > 1 ? "" : "disabled"}>próxima ▶</button>
    </div>
    ${gm ? `<div class="btns">
      <button type="button" id="add">+ Adicionar imagens</button>
      <button type="button" id="save">Guardar a arte atual</button>
    </div>
    ${items.length > 1 && list.length ? `<div class="btns"><button type="button" id="copy">Copiar esta lista para os outros ${items.length - 1}</button></div>` : ""}
    <label class="check"><input type="checkbox" id="rename" ${first.metadata?.[RENAME] === true ? "checked" : ""} /> Trocar o nome do item junto com a imagem</label>` : ""}`;
  for (const b of box.querySelectorAll("[data-use]")) b.addEventListener("click", () => swap(ids, list[Number(b.dataset.use)]));
  $("prev").addEventListener("click", () => swap(ids, "prev"));
  $("next").addEventListener("click", () => swap(ids, "next"));
  if (!gm) return;
  for (const el of box.querySelectorAll("[data-name]")) el.addEventListener("change", () => {
    const i = Number(el.dataset.name);
    editList(first.id, (l) => { if (l[i]) l[i].name = el.value.trim() || l[i].name; return l; });
  });
  const move = (i, d) => editList(first.id, (l) => { const j = i + d; if (l[j]) [l[i], l[j]] = [l[j], l[i]]; return l; });
  for (const b of box.querySelectorAll("[data-up]")) b.addEventListener("click", () => move(Number(b.dataset.up), -1));
  for (const b of box.querySelectorAll("[data-down]")) b.addEventListener("click", () => move(Number(b.dataset.down), 1));
  for (const b of box.querySelectorAll("[data-del]")) b.addEventListener("click", () => editList(first.id, (l) => l.filter((_, i) => i !== Number(b.dataset.del))));
  $("add").addEventListener("click", () => pickAndAdd(ids));
  $("save").addEventListener("click", () => saveCurrent(ids));
  $("copy")?.addEventListener("click", async () => { await copyList(first.id, ids); OBR.notification.show(`Trocador: lista copiada para ${ids.length - 1} item(ns).`, "SUCCESS"); });
  $("rename").addEventListener("change", (e) => OBR.scene.items.updateItems(ids, (d) => { for (const it of d) { if (e.target.checked) it.metadata[RENAME] = true; else delete it.metadata[RENAME]; } }));
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  role = await OBR.player.getRole();
  if (role !== "GM") $("help").hidden = true;
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  OBR.player.onChange(async (p) => {
    const next = p.selection || [];
    if (JSON.stringify(next) !== JSON.stringify(sel)) await load();
  });
  let tm = null;
  OBR.scene.items.onChange(() => { clearTimeout(tm); tm = setTimeout(() => { if (!typing()) load(); }, 120); });
});
