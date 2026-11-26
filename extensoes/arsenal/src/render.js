// Toca uma coreografia (fx.js / jb2a.js) com itens LOCAIS (cada jogador desenha a sua; nada fica salvo na cena).
// - elementos desenhados: criados escondidos, atualizados ~30 vezes por segundo só quando mudam;
// - vídeos JB2A: imagem de vídeo (.webm) criada no instante dela e apagada quando o vídeo acaba.
// Tudo é apagado no fim.
import OBR, { buildLine, buildShape, buildPath, buildLabel, buildImage } from "@owlbear-rodeo/sdk";
import { META_FX } from "./shared.js";

const LAYER = "ATTACHMENT"; // acima dos tokens (fumaça cobre quem está dentro)
const FPS = 30;
const live = new Set(); // ids de todos os itens de efeito vivos (para "limpar")
let gen = 0;            // muda a cada "limpar": animações em andamento param

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

/** Item de imagem de vídeo (ficha montada por jb2a.js). baseUrl = onde estão os .webm. */
export function videoItem(v, baseUrl) {
  return buildImage(
    { width: v.w, height: v.h, url: new URL(encodeURI(v.file), baseUrl).href, mime: "video/webm" },
    { dpi: v.dpi, offset: v.offset },
  ).position(v.position).rotation(v.rotation).layer(v.layer || LAYER).locked(true).disableHit(true)
    .metadata({ [META_FX]: true }).build();
}

/** Baixa os vídeos antes (para começarem na hora certa); desiste depois de 2,5 s. */
const cached = new Set();
async function prefetch(urls) {
  const todo = urls.filter((u) => !cached.has(u));
  if (!todo.length) return;
  const load = Promise.all(todo.map((u) => fetch(u, { cache: "force-cache" }).then((r) => r.blob()).then(() => cached.add(u)).catch(() => {})));
  await Promise.race([load, new Promise((r) => setTimeout(r, 2500))]);
}

const round = (v) => (typeof v === "number" ? Math.round(v * 10) / 10 : v);
const sig = (p) => (p ? JSON.stringify(p, (_, v) => round(v)) : "x");

/** Toca a animação e apaga tudo no fim. anim = { elements, videos?, duration }; baseUrl só para vídeos. */
export async function play(anim, baseUrl) {
  const els = anim.elements || [];
  const vids = (anim.videos || []).map((v) => ({ v, item: videoItem(v, baseUrl), on: false, off: false }));
  if (!els.length && !vids.length) return;
  const myGen = gen;
  if (vids.length) await prefetch([...new Set(vids.map((x) => x.item.image.url))]);
  if (myGen !== gen) return;
  const items = els.map((el) => create(el, el.frame(el.t0)));
  for (const it of items) live.add(it.id);
  if (items.length) await OBR.scene.local.addItems(items);
  const last = els.map(() => "");
  const t0 = performance.now();
  await new Promise((resolve) => {
    const tick = async () => {
      if (myGen !== gen) return resolve();
      const t = (performance.now() - t0) / 1000;
      // vídeos: entram e saem na hora deles
      const add = vids.filter((x) => !x.on && t >= x.v.t0);
      const del = vids.filter((x) => x.on && !x.off && t >= x.v.t0 + x.v.dur - 0.03);
      for (const x of add) { x.on = true; live.add(x.item.id); }
      for (const x of del) { x.off = true; live.delete(x.item.id); }
      if (add.length) OBR.scene.local.addItems(add.map((x) => x.item)).catch(() => {});
      if (del.length) OBR.scene.local.deleteItems(del.map((x) => x.item.id)).catch(() => {});
      // vídeos lançados (move): andam do começo até o ponto
      const mv = vids.filter((x) => x.v.move && x.on && !x.off && !add.includes(x) && !x.arrived);
      if (mv.length) {
        const pos = new Map(mv.map((x) => {
          const u = Math.min(1, Math.max(0, (t - x.v.t0) / x.v.move.t));
          if (u >= 1) x.arrived = true;
          const a = x.v.position, b = x.v.move.to;
          return [x.item.id, { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }];
        }));
        OBR.scene.local.updateItems([...pos.keys()], (d) => { for (const it of d) it.position = pos.get(it.id); }).catch(() => {});
      }
      // elementos desenhados
      const changed = [];
      els.forEach((el, i) => {
        const p = t >= el.t0 && t <= el.t1 ? el.frame(t) : null;
        const s = sig(p);
        if (s !== last[i]) { last[i] = s; changed.push([i, p]); }
      });
      if (changed.length) {
        const idx = new Map(changed.map(([i, p]) => [items[i].id, [i, p]]));
        const targets = changed.map(([i]) => items[i]);
        try {
          await OBR.scene.local.updateItems(targets, (draft) => { for (const it of draft) { const [i, p] = idx.get(it.id); apply(it, els[i], p); } });
          // mantém a cópia igual ao que está na tela (cópia nova: o Owlbear pode congelar a anterior)
          for (const [i, p] of changed) { items[i] = JSON.parse(JSON.stringify(items[i])); apply(items[i], els[i], p); }
        } catch { /* item apagado no meio (limpar) */ }
      }
      if (t > anim.duration) resolve();
      else setTimeout(tick, 1000 / FPS);
    };
    tick();
  });
  const ids = [...items.map((i) => i.id), ...vids.filter((x) => x.on && !x.off).map((x) => x.item.id)].filter((id) => live.has(id));
  for (const id of ids) live.delete(id);
  if (ids.length) await OBR.scene.local.deleteItems(ids).catch(() => {});
}

/** Apaga todos os efeitos (fumaça que ficou, etc.). */
export async function clearAll() {
  gen++;
  live.clear();
  const left = await OBR.scene.local.getItems((i) => i.metadata?.[META_FX]).catch(() => []);
  if (left.length) await OBR.scene.local.deleteItems(left.map((i) => i.id)).catch(() => {});
}
