// Terreno difícil: áreas fixadas marcadas como difíceis contam em dobro na régua.
import OBR from "@owlbear-rodeo/sdk";
import { META_AREA } from "./shared.js";
import { itemPolygon, affectedCells } from "./geom.js";

export const DIFFICULT_COLOR = "#c8963e";

/** Conjunto "c,r" dos quadrados em terreno difícil na cena. */
export async function loadDifficult(dpi, rule = "center") {
  const items = await OBR.scene.items.getItems((i) => i.metadata?.[META_AREA]?.difficult === true && !i.attachedTo);
  const set = new Set();
  for (const it of items) {
    const poly = itemPolygon(it);
    for (const { c, r } of affectedCells(poly, dpi, rule)) set.add(`${c},${r}`);
  }
  return set;
}

/** Liga/desliga terreno difícil em áreas já fixadas (e atualiza cor e rótulo). */
export async function toggleDifficult(ids, on) {
  const sel = await OBR.scene.items.getItems(ids);
  const roots = new Set(sel.filter((i) => i.metadata?.[META_AREA]).map((i) => i.attachedTo || i.id));
  const all = await OBR.scene.items.getItems((i) => i.metadata?.[META_AREA] && (roots.has(i.id) || roots.has(i.attachedTo)));
  if (!all.length) return;
  await OBR.scene.items.updateItems(all.map((i) => i.id), (draft) => {
    for (const it of draft) {
      const m = { ...it.metadata[META_AREA] };
      const base = (m.text || "").replace(/^Terreno difícil · /, "");
      m.difficult = on;
      if (!m.color && it.style?.fillColor) m.color = it.style.fillColor;
      it.metadata[META_AREA] = m;
      if (it.type === "PATH" && it.style) {
        const color = on ? DIFFICULT_COLOR : (m.color || it.style.fillColor);
        it.style.fillColor = color;
        it.style.strokeColor = color;
        if (!it.attachedTo) it.style.strokeDash = on ? [12, 8] : [];
      }
      if (it.type === "LABEL") it.text.plainText = on ? `Terreno difícil · ${base}` : base;
    }
  });
}
