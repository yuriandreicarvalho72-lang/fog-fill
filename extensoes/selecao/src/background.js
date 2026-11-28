// Seleção total: ferramenta do mestre que seleciona QUALQUER item sob o ponteiro, inclusive trancado, fog e mapa.
// Clique = o item mais específico; clicar de novo no mesmo ponto = o próximo da pilha (até o fog e o mapa).
// Shift/Ctrl/Cmd soma ou tira da seleção. Arrastar = caixa (itens inteiros dentro; com Alt, tudo que encosta).
import OBR, { buildShape } from "@owlbear-rodeo/sdk";
import { controls } from "./visibility.js";
import { candidatesAt, cyclePick, inBox, toggleIds, boxOf, layerLabel } from "./core.js";

const ID = "fog-fill.selecao";
const TOOL_ID = `${ID}/ferramenta`;
const MODE_ID = `${ID}/selecionar`;
const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;

/** Todos os itens da cena com a caixa de cada um (o Owlbear calcula, inclusive de caminhos e do fog). */
async function entries() {
  const items = await OBR.scene.items.getItems();
  const out = await Promise.all(items.map(async (it) => {
    const bounds = await OBR.scene.items.getItemBounds([it.id]).catch(() => null);
    return bounds ? { id: it.id, bounds, layer: it.layer, zIndex: it.zIndex, name: it.name || it.text?.plainText || "", type: it.type, locked: !!it.locked } : null;
  }));
  return out.filter(Boolean);
}

let cycle = null;     // última pilha clicada
let box = null;       // { a, id, last } caixa em andamento
let downAt = null;

async function applySelection(ids, add) {
  if (add) ids = toggleIds((await OBR.player.getSelection()) || [], ids);
  if (ids.length) await OBR.player.select(ids, true);
  else await OBR.player.deselect();
}

async function onClick(event) {
  const add = event.shiftKey || event.ctrlKey || event.metaKey;
  const list = candidatesAt(await entries(), event.pointerPosition);
  if (!list.length) { cycle = null; if (!add) await OBR.player.deselect(); return; }
  const scale = await OBR.viewport.getScale().catch(() => 1);
  const r = cyclePick(list, event.pointerPosition, cycle, 10 / (scale || 1));
  cycle = r.state;
  await applySelection([r.pick.id], add);
  const nome = r.pick.name || layerLabel(r.pick.layer);
  OBR.notification.show(`Seleção total: ${nome} (${layerLabel(r.pick.layer)}${r.pick.locked ? ", trancado" : ""})${r.n > 1 ? ` · ${r.i + 1} de ${r.n}: clique de novo no mesmo ponto para o próximo` : ""}`).catch(() => {});
}

const boxStyle = (b, id) => buildShape().id(id).shapeType("RECTANGLE").position(b.min).width(b.max.x - b.min.x).height(b.max.y - b.min.y)
  .fillColor("#4fc3ff").fillOpacity(0.12).strokeColor("#4fc3ff").strokeOpacity(0.9).strokeWidth(2).strokeDash([10, 8])
  .layer("POINTER").disableHit(true).locked(true).name("Seleção total (caixa)").build();

async function boxMove(event) {
  if (!box) return;
  const b = boxOf(box.a, event.pointerPosition);
  box.last = b;
  if (!box.id) { const s = boxStyle(b, `${ID}/caixa`); box.id = s.id; await OBR.scene.local.addItems([s]); return; }
  await OBR.scene.local.updateItems([box.id], (d) => { for (const it of d) { it.position = b.min; it.width = b.max.x - b.min.x; it.height = b.max.y - b.min.y; } });
}
async function boxEnd(event, cancel) {
  const cur = box; box = null;
  if (!cur) return;
  if (cur.id) await OBR.scene.local.deleteItems([cur.id]).catch(() => {});
  if (cancel || !cur.last) return;
  const add = event.shiftKey || event.ctrlKey || event.metaKey;
  const ids = inBox(await entries(), cur.last, event.altKey);
  await applySelection(ids, add);
  OBR.notification.show(ids.length ? `Seleção total: ${ids.length} item(ns)${event.altKey ? " (tudo que encosta na caixa)" : " (só os que cabem inteiros na caixa; Alt pega os que encostam)"}` : "Seleção total: nada dentro da caixa.").catch(() => {});
}

OBR.onReady(async () => {
  await controls.tool.create({
    id: TOOL_ID,
    icons: [{ icon: url("icon.svg"), label: "Seleção total (pega itens trancados, fog e mapa)", filter: { roles: ["GM"] } }],
    shortcut: "Shift+S",
    defaultMode: MODE_ID,
  });
  await controls.tool.createMode({
    id: MODE_ID,
    icons: [{ icon: url("icon.svg"), label: "Selecionar: clique (de novo = próximo da pilha), arraste = caixa", filter: { activeTools: [TOOL_ID] } }],
    cursors: [{ cursor: "crosshair" }],
    // o arrasto é nosso: o Owlbear não deve mover o mapa nem itens aqui
    preventDrag: { target: [{ key: "type", value: "__nada__" }] },
    onToolDown: (_c, e) => { downAt = e.pointerPosition; return false; },
    onToolClick: (_c, e) => { onClick(e).catch((err) => { console.error(`[${ID}]`, err); OBR.notification.show("Seleção total: erro ao selecionar (veja o console).", "ERROR").catch(() => {}); }); return false; },
    onToolDragStart: (_c, e) => { box = { a: downAt || e.pointerPosition, id: null, last: null }; },
    onToolDragMove: (_c, e) => { boxMove(e).catch(() => {}); },
    onToolDragEnd: (_c, e) => { boxEnd(e, false).catch((err) => console.error(`[${ID}]`, err)); },
    onToolDragCancel: () => { boxEnd({}, true).catch(() => {}); },
    onDeactivate: () => { boxEnd({}, true).catch(() => {}); },
  });
});
