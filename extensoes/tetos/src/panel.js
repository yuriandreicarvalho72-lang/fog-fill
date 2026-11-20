import OBR from "@owlbear-rodeo/sdk";
import { META, MODOS, applyTheme } from "./shared.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let isGM = false;

async function render() {
  const roofs = await OBR.scene.items.getItems((i) => i.metadata?.[META] != null);
  $("list").innerHTML = roofs.length ? roofs.map((r) => {
    const t = r.metadata[META];
    return `<div class="roof" data-id="${esc(r.id)}">
      <div class="head"><b title="${esc(r.name || "")}">${esc(r.name || "Teto sem nome")}</b>
        ${isGM ? `<button data-a="sel" type="button">selecionar</button><button data-a="tog" type="button">${t.aberto ? "fechar" : "abrir"}</button>` : ""}</div>
      ${isGM ? `<select data-a="modo">${MODOS.map((m) => `<option value="${m.id}" ${m.id === t.modo ? "selected" : ""}>${m.label}</option>`).join("")}</select>` : ""}
      <div class="st ${t.aberto ? "open" : ""}">${t.aberto ? "Aberto pelo mestre (sumido para todos)" : MODOS.find((m) => m.id === t.modo)?.label || ""}</div></div>`;
  }).join("") : "Nenhum teto na cena ainda.";
}

async function patch(id, fn) {
  await OBR.scene.items.updateItems([id], (draft) => { for (const it of draft) it.metadata[META] = fn({ ...it.metadata[META] }); });
}
async function all(aberto) {
  const roofs = await OBR.scene.items.getItems((i) => i.metadata?.[META] != null);
  await OBR.scene.items.updateItems(roofs.map((r) => r.id), (draft) => { for (const it of draft) it.metadata[META] = { ...it.metadata[META], aberto }; });
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  isGM = (await OBR.player.getRole()) === "GM";
  if (!isGM) $("intro").textContent = "Os tetos somem sozinhos quando o seu personagem entra no lugar.";
  $("gm").hidden = !isGM;
  if (await OBR.scene.isReady()) render();
  OBR.scene.onReadyChange((r) => r && render());
  OBR.scene.items.onChange(() => render());
  $("openAll").addEventListener("click", () => all(true));
  $("closeAll").addEventListener("click", () => all(false));
  $("list").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const id = b.closest(".roof").dataset.id;
    if (b.dataset.a === "sel") OBR.player.select([id]);
    if (b.dataset.a === "tog") patch(id, (t) => ({ ...t, aberto: !t.aberto }));
  });
  $("list").addEventListener("change", (e) => {
    if (e.target.dataset.a === "modo") patch(e.target.closest(".roof").dataset.id, (t) => ({ ...t, modo: e.target.value }));
  });
});
