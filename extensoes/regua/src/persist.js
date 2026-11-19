// Medidas fixadas no mapa: viram desenhos (camada de desenho) com as dimensões escritas.
// Tudo leva o metadado META_AREA com o dono, para a lixeira da barra apagar.
import OBR, { buildCurve, buildLabel, buildPath } from "@owlbear-rodeo/sdk";
import { META_AREA } from "./shared.js";
import { dotsToCommands } from "./geom.js";

/** Rótulo de medida preso a um desenho (move e some junto com ele). */
export function measureLabel(text, pos, parentId, meta, small = false) {
  return buildLabel()
    .plainText(text).position(pos)
    .backgroundColor("#111418").backgroundOpacity(0.8).fillColor("#ffffff").fontWeight(small ? 500 : 600)
    .fontSize(small ? 18 : 22).cornerRadius(7).padding(small ? 5 : 7)
    .pointerDirection("DOWN").pointerHeight(small ? 0 : 7).pointerWidth(small ? 0 : 11)
    .layer("DRAWING").attachedTo(parentId).disableHit(true).locked(true)
    .metadata(meta).name(`Medida: ${text}`)
    .build();
}

/**
 * Régua ou caminho fixado: linha tracejada + pontos + total no fim + cada trecho no meio dele.
 * @param {object} o { points, segTexts: string[], total: string, color, dpi, owner, kind: "measure"|"move" }
 */
export async function persistRuler(o) {
  const { points, segTexts, total, color, dpi, owner, kind } = o;
  if (!points || points.length < 2) return;
  const meta = { [META_AREA]: { owner, kind: kind === "move" ? "path" : "ruler", text: total } };
  const line = buildCurve()
    .points(points).tension(0).closed(false)
    .strokeColor(color).strokeWidth(Math.max(3, dpi / 20)).strokeDash([dpi / 6, dpi / 10]).strokeOpacity(0.95)
    .fillOpacity(0).layer("DRAWING").position({ x: 0, y: 0 })
    .metadata(meta).name(`${kind === "move" ? "Caminho" : "Régua"}: ${total}`).build();
  const dots = buildPath()
    .commands(dotsToCommands(points, Math.max(5, dpi / 11)))
    .fillColor(color).fillOpacity(1).strokeColor("#000000").strokeOpacity(0.4).strokeWidth(2)
    .layer("DRAWING").position({ x: 0, y: 0 }).attachedTo(line.id).disableHit(true).locked(true)
    .metadata(meta).name("Pontos da régua").build();
  const end = points[points.length - 1];
  const items = [line, dots, measureLabel(total, { x: end.x, y: end.y - dpi * 0.5 }, line.id, meta)];
  if (points.length > 2) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      items.push(measureLabel(segTexts[i - 1], { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, line.id, meta, true));
    }
  }
  await OBR.scene.items.addItems(items);
}
