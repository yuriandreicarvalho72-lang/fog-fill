// Escolher itens da lista da cena, sem clicar no mapa: funciona com itens trancados, fog, mapa e itens escondidos
// (o clique no mapa não alcança esses). Devolve a lista de ids, ou null se cancelou.
import OBR from "@owlbear-rodeo/sdk";
import { LAYERS, labelOf, FILTERS, filterItems } from "./pickfilter.js";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export async function pickItems({ preselected = [], door = () => false } = {}) {
  const items = await OBR.scene.items.getItems();
  const chosen = new Set(preselected);
  let q = "", f = "todos";
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.55);display:flex;align-items:stretch;justify-content:center";
    wrap.innerHTML = `<div style="margin:6px;flex:1;max-width:520px;display:flex;flex-direction:column;background:var(--bg,#1b1f27);color:var(--fg);border:1px solid var(--line);border-radius:10px;padding:8px;gap:6px">
      <div class="row"><b class="grow">Escolher itens da cena</b><span class="tag" id="pkN"></span></div>
      <input type="text" id="pkQ" placeholder="buscar por nome, tipo ou camada" />
      <div class="btns" id="pkF">${FILTERS.map(([v, l]) => `<button type="button" class="mini" data-f="${v}">${l}</button>`).join("")}</div>
      <div id="pkL" style="flex:1;overflow:auto;border:1px solid var(--line);border-radius:6px"></div>
      <div class="btns"><button type="button" id="pkOk">Usar escolhidos</button><button type="button" id="pkNo">Cancelar</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const $ = (id) => wrap.querySelector(id);
    const draw = () => {
      const list = filterItems(items, q, f, door);
      const shown = list.slice(0, 400);
      $("#pkL").innerHTML = shown.map((i) => `<div class="mrow" style="padding:3px 6px;border-bottom:1px solid var(--line)">
        <label class="check grow" style="margin:0"><input type="checkbox" data-id="${i.id}" ${chosen.has(i.id) ? "checked" : ""} /> ${i.locked ? "🔒 " : ""}${i.visible === false ? "🙈 " : ""}${door(i) ? "🚪 " : ""}${esc(labelOf(i))}</label>
        <span class="tag">${esc(LAYERS[i.layer] || i.layer)}</span><button type="button" class="mini" data-go="${i.id}" title="Mostrar no mapa">🎯</button></div>`).join("") || '<p class="hint" style="padding:8px">Nada encontrado.</p>';
      $("#pkN").textContent = `${chosen.size} escolhido(s)${list.length > shown.length ? ` · mostrando ${shown.length} de ${list.length}` : ""}`;
      for (const b of wrap.querySelectorAll("#pkF [data-f]")) b.style.outline = b.dataset.f === f ? "2px solid var(--accent)" : "";
      for (const c of wrap.querySelectorAll("[data-id]")) c.onchange = () => { c.checked ? chosen.add(c.dataset.id) : chosen.delete(c.dataset.id); $("#pkN").textContent = `${chosen.size} escolhido(s)`; };
      for (const b of wrap.querySelectorAll("[data-go]")) b.onclick = async () => {
        await OBR.player.select([b.dataset.go]).catch(() => {});
        const bb = await OBR.scene.items.getItemBounds([b.dataset.go]).catch(() => null);
        if (bb && bb.width > 0 && bb.width < 1e6) OBR.viewport.animateToBounds({ ...bb, min: { x: bb.min.x - 150, y: bb.min.y - 150 }, max: { x: bb.max.x + 150, y: bb.max.y + 150 } }).catch(() => {});
      };
    };
    $("#pkQ").oninput = (e) => { q = e.target.value; draw(); };
    for (const b of wrap.querySelectorAll("#pkF [data-f]")) b.onclick = () => { f = b.dataset.f; draw(); };
    const done = (v) => { wrap.remove(); resolve(v); };
    $("#pkOk").onclick = () => done([...chosen]);
    $("#pkNo").onclick = () => done(null);
    draw();
    $("#pkQ").focus();
  });
}
