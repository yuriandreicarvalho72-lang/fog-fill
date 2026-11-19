// Toca uma coreografia do fx.js com itens LOCAIS (cada jogador desenha a sua; nada fica salvo na cena).
// Os itens são criados escondidos, atualizados ~30 vezes por segundo só quando mudam, e apagados no fim.
import OBR, { buildLine, buildShape, buildPath, buildLabel } from "@owlbear-rodeo/sdk";
import { META_FX } from "./shared.js";

const LAYER = "ATTACHMENT"; // acima dos tokens (fumaça cobre quem está dentro)
const FPS = 30;
const live = new Set(); // ids de todos os itens de efeito vivos (para "limpar")

const cmds = (pts, closed) => [...pts.map((p, i) => [i ? 1 : 0, p.x, p.y]), ...(closed ? [[5]] : [])];

function create(el, p) {
  const common = (b) => b.layer(LAYER).locked(true).disableHit(true).visible(false).metadata({ [META_FX]: true }).build();
  if (el.kind === "line") {
    return common(buildLine().position({ x: 0, y: 0 }).startPosition(p.a).endPosition(p.b)
      .strokeColor(p.color).strokeWidth(p.width).strokeOpacity(p.opacity));
  }
  if (el.kind === "circle") {
    return common(buildShape().shapeType("CIRCLE").position(p.c).width(Math.max(1, p.r * 2)).height(Math.max(1, p.r * 2))
      .fillColor(p.fill || "#000000").fillOpacity(p.fillOpacity ?? 0).strokeColor(p.stroke || "#000000")
      .strokeOpacity(p.strokeOpacity ?? 0).strokeWidth(p.strokeWidth ?? 0));
  }
  if (el.kind === "path") {
    return common(buildPath().position({ x: 0, y: 0 }).commands(cmds(p.pts, p.closed))
      .fillColor(p.fill || "#000000").fillOpacity(p.fillOpacity ?? 0).strokeColor(p.stroke || "#000000")
      .strokeOpacity(p.strokeOpacity ?? 0).strokeWidth(p.strokeWidth ?? 0).strokeDash(p.dash || []));
  }
  return common(buildLabel().position(p.at).plainText(p.text).backgroundColor("#111418").backgroundOpacity(0.85)
    .fillColor("#ffffff").fontWeight(700).cornerRadius(8).pointerDirection("DOWN").pointerHeight(8).pointerWidth(12));
}

/** Aplica as propriedades do instante no item (usado no rascunho do Owlbear e na cópia local). */
function apply(it, el, p) {
  if (!p) { it.visible = false; return; }
  it.visible = true;
  if (el.kind === "line") {
    it.startPosition = p.a; it.endPosition = p.b;
    Object.assign(it.style, { strokeColor: p.color, strokeWidth: p.width, strokeOpacity: p.opacity });
  } else if (el.kind === "circle") {
    it.position = p.c; it.width = Math.max(1, p.r * 2); it.height = Math.max(1, p.r * 2);
    Object.assign(it.style, { fillColor: p.fill || "#000000", fillOpacity: p.fillOpacity ?? 0, strokeColor: p.stroke || "#000000", strokeOpacity: p.strokeOpacity ?? 0, strokeWidth: p.strokeWidth ?? 0 });
  } else if (el.kind === "path") {
    it.commands = cmds(p.pts, p.closed);
    Object.assign(it.style, { fillColor: p.fill || "#000000", fillOpacity: p.fillOpacity ?? 0, strokeColor: p.stroke || "#000000", strokeOpacity: p.strokeOpacity ?? 0, strokeWidth: p.strokeWidth ?? 0, strokeDash: p.dash || [] });
  } else {
    it.position = p.at; it.text.plainText = p.text;
  }
}

const round = (v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v);
const sig = (p) => (p ? JSON.stringify(p, (_, v) => round(v)) : "x");

/** Toca a animação e apaga tudo no fim. */
export async function play(anim) {
  const els = anim.elements;
  if (!els.length) return;
  const items = els.map((el) => create(el, el.frame(el.t0)));
  for (const it of items) live.add(it.id);
  await OBR.scene.local.addItems(items);
  const last = els.map(() => "");
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = async () => {
      const t = (performance.now() - t0) / 1000;
      const changed = [];
      els.forEach((el, i) => {
        const p = t >= el.t0 && t <= el.t1 ? el.frame(t) : null;
        const s = sig(p);
        if (s !== last[i]) { last[i] = s; changed.push([i, p]); }
      });
      if (changed.length && items.every((it) => live.has(it.id))) {
        const idx = new Map(changed.map(([i, p]) => [items[i].id, [i, p]]));
        const targets = changed.map(([i]) => items[i]);
        try {
          await OBR.scene.local.updateItems(targets, (draft) => { for (const it of draft) { const [i, p] = idx.get(it.id); apply(it, els[i], p); } });
          // mantém a cópia igual ao que está na tela (cópia nova: o Owlbear pode congelar a anterior)
          for (const [i, p] of changed) { items[i] = JSON.parse(JSON.stringify(items[i])); apply(items[i], els[i], p); }
        } catch { /* item apagado no meio (limpar) */ }
      }
      if (t > anim.duration || !items.some((it) => live.has(it.id))) resolve();
      else setTimeout(tick, 1000 / FPS);
    };
    tick();
  });
  const ids = items.map((i) => i.id).filter((id) => live.has(id));
  for (const id of ids) live.delete(id);
  if (ids.length) await OBR.scene.local.deleteItems(ids).catch(() => {});
}

/** Apaga todos os efeitos (fumaça que ficou, etc.). */
export async function clearAll() {
  live.clear();
  const left = await OBR.scene.local.getItems((i) => i.metadata?.[META_FX]).catch(() => []);
  if (left.length) await OBR.scene.local.deleteItems(left.map((i) => i.id)).catch(() => {});
}
