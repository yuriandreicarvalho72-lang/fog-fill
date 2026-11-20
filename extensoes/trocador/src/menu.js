// Miniaturas dentro do menu do botão direito: clique troca a imagem de todos os itens selecionados.
import OBR from "@owlbear-rodeo/sdk";
import { variantsOf, currentIndex, isImageItem } from "./core.js";
import { swap, saveCurrent, pickAndAdd, applyTheme, url } from "./ops.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const thumb = (v) => (v.mime?.startsWith("video")
  ? `<video src="${esc(v.url)}" muted preload="metadata"></video>`
  : `<img src="${esc(v.url)}" alt="" loading="lazy" />`);

let role = "PLAYER";

async function render() {
  const sel = (await OBR.player.getSelection()) || [];
  const items = (await OBR.scene.items.getItems(sel)).filter(isImageItem);
  const first = items[0];
  const list = variantsOf(first);
  const cur = first ? currentIndex(first, list) : -1;
  const gm = role === "GM";
  $("m").innerHTML = `
    <div class="strip">
      <button type="button" class="nav" id="prev" title="Imagem anterior" ${list.length > 1 ? "" : "disabled"}>◀</button>
      <div class="thumbs">${list.map((v, i) => `<button type="button" class="th${i === cur ? " on" : ""}" data-i="${i}" title="${esc(v.name)}">${thumb(v)}</button>`).join("")
        || `<span class="hint">${gm ? "Sem imagens ainda: use + para escolher as artes." : "Sem imagens para trocar."}</span>`}</div>
      <button type="button" class="nav" id="next" title="Próxima imagem" ${list.length > 1 ? "" : "disabled"}>▶</button>
    </div>
    <div class="row tiny">
      <span class="grow cur">${cur >= 0 ? esc(list[cur].name) : list.length ? "arte fora da lista" : ""}${items.length > 1 ? ` · ${items.length} itens` : ""}</span>
      ${gm ? '<button type="button" class="mini" id="add" title="Escolher imagens para este item">+ imagens</button><button type="button" class="mini" id="save" title="Guardar a arte atual na lista">guardar atual</button><button type="button" class="mini" id="full" title="Lista completa: nomes, ordem, remover, copiar para outros itens">⚙</button>' : ""}
    </div>`;
  const ids = items.map((i) => i.id);
  for (const b of document.querySelectorAll("[data-i]")) b.addEventListener("click", () => swap(ids, list[Number(b.dataset.i)]).then(render));
  $("prev").addEventListener("click", () => swap(ids, "prev").then(render));
  $("next").addEventListener("click", () => swap(ids, "next").then(render));
  $("add")?.addEventListener("click", () => pickAndAdd(ids).then(render));
  $("save")?.addEventListener("click", () => saveCurrent(ids).then(render));
  // painel completo (sem ícone na barra de cima): abre como janela flutuante
  $("full")?.addEventListener("click", () => OBR.popover.open({ id: "trocador/painel", url: url("index.html"), height: 560, width: 360 }).catch(() => {}));
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  role = await OBR.player.getRole();
  render();
  OBR.scene.items.onChange(() => render());
});
