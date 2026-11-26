// Página "Personagens": quem na cena tem armas no Arsenal (e quem tem dossiê de habilidades).
import OBR from "@owlbear-rodeo/sdk";
import { WEAPONS, OWNER, itemName } from "./shared.js";
import { DOSSIE } from "./abil.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Personagens da cena com armas ou dossiê, em ordem de nome. */
export function rosterOf(items) {
  return items
    .filter((i) => i.type === "IMAGE" && ((i.metadata?.[WEAPONS] || []).length || i.metadata?.[DOSSIE]?.habilidades?.length))
    .sort((a, b) => itemName(a).localeCompare(itemName(b), "pt-BR"));
}
const ammoOf = (w) => (w.mag == null ? "∞" : `${w.ammo ?? 0}/${w.mag}`);

/** Desenha a página. ctx = { items, me, party, active, setActive }. */
export function renderRoster(box, ctx) {
  const list = rosterOf(ctx.items);
  const who = (it) => {
    const id = it.metadata?.[OWNER] || it.createdUserId;
    const p = (ctx.party || []).find((x) => x.id === id);
    return id === ctx.me.id ? "você" : p?.name || (ctx.me.role === "GM" ? "mestre / NPC" : "");
  };
  const canUse = (it) => ctx.me.role === "GM" || it.metadata?.[OWNER] === ctx.me.id || (!it.metadata?.[OWNER] && it.createdUserId === ctx.me.id);
  box.innerHTML = list.length ? `<div class="mlist roster">${list.map((it) => {
    const ws = it.metadata?.[WEAPONS] || [];
    const first = ws[0];
    const hab = it.metadata?.[DOSSIE]?.habilidades?.length || 0;
    const on = ctx.active?.shooter === it.id;
    return `<div class="mrow rrow2${on ? " on" : ""}" data-r="${it.id}">
      <span class="mname"><b>${esc(itemName(it))}</b> <small>${esc(who(it))}</small>
        <small>${ws.length ? `${ws.length} arma${ws.length > 1 ? "s" : ""}${first ? ` · ${esc(first.name)} ${esc(ammoOf(first))}` : ""}` : "sem armas"}${hab ? ` · ${hab} habilidade${hab > 1 ? "s" : ""}` : ""}</small></span>
      <button type="button" class="mini" data-ver="${it.id}" title="Selecionar e mostrar no mapa">👁</button>
      <button type="button" class="mini" data-usar="${it.id}" ${ws.length && canUse(it) ? "" : "disabled"} title="${ws.length ? (canUse(it) ? "Usar como atirador" : "Só o dono ou o mestre") : "Sem armas"}">${on ? "✔ atirador" : "🎯 usar"}</button>
    </div>`;
  }).join("")}</div>` : `<p class="hint">Nenhum personagem da cena tem armas no Arsenal ainda. Selecione um token, abra a página Principal e adicione uma arma.</p>`;
  for (const b of box.querySelectorAll("[data-usar]")) b.addEventListener("click", () => {
    const it = ctx.items.find((i) => i.id === b.dataset.usar);
    if (it) { ctx.setActive({ shooter: it.id, weapon: it.metadata?.[WEAPONS]?.[0]?.id, mode: undefined }); document.dispatchEvent(new CustomEvent("menu:ir", { detail: "Principal" })); }
  });
  for (const b of box.querySelectorAll("[data-ver]")) b.addEventListener("click", async () => {
    const it = ctx.items.find((i) => i.id === b.dataset.ver);
    if (!it) return;
    await OBR.player.select([it.id]).catch(() => {});
    const dpi = await OBR.scene.grid.getDpi().catch(() => 150);
    const r = dpi * 4;
    await OBR.viewport.animateToBounds({ min: { x: it.position.x - r, y: it.position.y - r }, max: { x: it.position.x + r, y: it.position.y + r }, width: r * 2, height: r * 2, center: it.position }).catch(() => {});
  });
}
