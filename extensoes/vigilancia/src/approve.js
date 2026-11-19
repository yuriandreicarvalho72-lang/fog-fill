// Popover do mestre: pedidos de hack esperando aprovação. Fecha sozinho quando não sobra nenhum.
import OBR from "@owlbear-rodeo/sdk";
import { stateLabel } from "./core.js";
import { PENDING, APPROVE, decide, applyTheme } from "./ops.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function render(list) {
  if (!list.length) { OBR.popover.close(APPROVE); return; }
  document.getElementById("main").innerHTML = `<h1>◈ Pedido${list.length > 1 ? "s" : ""} de hack</h1>
    ${list.map((r) => `<div class="effect"><p><b>${esc(r.byName)}</b> quer ${r.action === "ativo" ? "reativar" : `deixar <b>${esc(stateLabel(r.action))}</b>`}: <b>${esc(r.nodeName)}</b></p>
      <div class="btns"><button type="button" class="ok" data-ok="${r.id}">Aprovar</button><button type="button" data-no="${r.id}">Negar</button></div></div>`).join("")}
    <div class="btns"><button type="button" class="mini" id="later">decidir depois (painel Vigilância)</button></div>`;
  for (const b of document.querySelectorAll("[data-ok]")) b.onclick = () => decide(b.dataset.ok, true);
  for (const b of document.querySelectorAll("[data-no]")) b.onclick = () => decide(b.dataset.no, false);
  document.getElementById("later").onclick = () => OBR.popover.close(APPROVE);
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  const get = (md) => (Array.isArray(md[PENDING]) ? md[PENDING] : []);
  render(get(await OBR.scene.getMetadata()));
  OBR.scene.onMetadataChange((md) => render(get(md)));
});
