import "./visibility.js";
// Lista dentro do menu do botão direito: os gatilhos de que o item selecionado faz parte, com armar/desarmar e ativar.
import OBR from "@owlbear-rodeo/sdk";
import { LIST, CH_FIRE, CAUSES, involvedIds, isToken, applyTheme } from "./shared.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const short = (id) => (CAUSES.find((c) => c.id === id)?.label || id).replace(/\s*\(.*$/, "").replace(/:.*$/, "");

let role = "PLAYER";

/** Muda o "armado" de gatilhos (lê a lista atual da cena, para não pisar em edições do painel). */
async function setArmed(ids, armed) {
  const md = await OBR.scene.getMetadata();
  const list = Array.isArray(md[LIST]) ? md[LIST] : [];
  await OBR.scene.setMetadata({ [LIST]: list.map((t) => (ids.includes(t.id) ? { ...t, armed } : t)) });
}

async function render() {
  if (role !== "GM") { $("m").innerHTML = '<span class="hint">Só o mestre usa os gatilhos.</span>'; return; }
  const [md, sel] = await Promise.all([OBR.scene.getMetadata(), OBR.player.getSelection().then((s) => s || [])]);
  const list = Array.isArray(md[LIST]) ? md[LIST] : [];
  const mine = list.filter((t) => involvedIds(t).some((id) => sel.includes(id)));
  const tokens = (await OBR.scene.items.getItems(sel)).filter(isToken).map((i) => i.id);
  const off = mine.filter((t) => !t.armed).map((t) => t.id), on = mine.filter((t) => t.armed).map((t) => t.id);
  $("m").innerHTML = mine.length ? `
    <div class="gm-list">${mine.map((t) => `
      <div class="gm-row${t.armed ? "" : " off"}">
        <button type="button" class="arm${t.armed ? " on" : ""}" data-arm="${t.id}" title="${t.armed ? "Armado: clique para desarmar" : "Desarmado: clique para rearmar"}">${t.armed ? "●" : "○"}</button>
        <span class="gm-name" title="${esc(t.name)}">${esc(t.name)}<small>${esc(short(t.cause))}${t.armed ? "" : " · desarmado"}</small></span>
        <button type="button" class="mini" data-fire="${t.id}" title="Ativar agora (ignora as condições)${tokens.length ? "; o personagem selecionado conta como quem ativou" : ""}">⚡</button>
      </div>`).join("")}</div>
    ${mine.length > 1 ? `<div class="row gm-foot"><button type="button" class="mini grow" id="all-on" ${off.length ? "" : "disabled"}>Armar todos</button><button type="button" class="mini grow" id="all-off" ${on.length ? "" : "disabled"}>Desarmar todos</button></div>` : ""}`
    : '<span class="hint">Este item não está em nenhum gatilho.</span>';
  for (const b of document.querySelectorAll("[data-arm]")) b.addEventListener("click", () => setArmed([b.dataset.arm], !mine.find((t) => t.id === b.dataset.arm)?.armed));
  for (const b of document.querySelectorAll("[data-fire]")) b.addEventListener("click", () => {
    const t = mine.find((x) => x.id === b.dataset.fire);
    OBR.broadcast.sendMessage(CH_FIRE, { id: b.dataset.fire, force: true, on: tokens }, { destination: "LOCAL" });
    OBR.notification.show(`Gatilho "${t?.name || ""}" ativado.`, "SUCCESS");
  });
  $("all-on")?.addEventListener("click", () => setArmed(off, true));
  $("all-off")?.addEventListener("click", () => setArmed(on, false));
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  role = await OBR.player.getRole();
  OBR.theme.onChange(applyTheme);
  await render();
  OBR.scene.onMetadataChange(() => render());
  OBR.player.onChange(() => render());
});
