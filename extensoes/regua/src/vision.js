// Modo "Visão e cobertura": junta paredes (Dynamic Fog / Smoke & Spectre), coberturas parciais
// e criaturas, e mostra raios até os cantos do quadrado alvo, com a cobertura no rótulo.
import OBR, { buildLabel, buildPath } from "@owlbear-rodeo/sdk";
import { ID, Keeper } from "./shared.js";
import { checkTarget, COVER } from "./sight.js";
import { snapCenter, pathCells, formatDistance, dotsToCommands } from "./geom.js";

export const COVER_KEY = `${ID}/cover`;                         // solidez 0..1 marcada pela Régua
export const PEEKABOO_KEY = "com.desain.peekaboo/coverSolidity"; // coberturas já marcadas no Peekaboo continuam valendo
export const ROOM_VISION = `${ID}/vision`;                       // ajustes da sala (mestre)
export const ROOM_DEFAULTS = { charactersCover: true, characterSolidity: 0.5 };
const SMOKE_VISION = "com.battle-system.smoke/isVisionLine";

const rad = (d) => (d * Math.PI) / 180;
function toWorld(item, p) {
  const sx = item.scale?.x ?? 1, sy = item.scale?.y ?? 1, a = rad(item.rotation ?? 0);
  const x = p.x * sx, y = p.y * sy;
  return { x: item.position.x + x * Math.cos(a) - y * Math.sin(a), y: item.position.y + x * Math.sin(a) + y * Math.cos(a) };
}
const segsOf = (pts, closed) => {
  const out = [];
  for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1], b: pts[i] });
  if (closed && pts.length > 2) out.push({ a: pts[pts.length - 1], b: pts[0] });
  return out;
};

/** Contorno (em trechos) de um desenho, para servir de parede ou cobertura. */
function outline(item) {
  if (item.type === "WALL" || item.type === "CURVE") {
    return segsOf((item.points || []).map((p) => toWorld(item, p)), item.type === "CURVE" && item.style?.closed);
  }
  if (item.type === "LINE") return [{ a: toWorld(item, item.startPosition), b: toWorld(item, item.endPosition) }];
  if (item.type === "PATH") {
    const out = []; let cur = [];
    for (const c of item.commands || []) {
      if (c[0] === 0) { if (cur.length) out.push(...segsOf(cur, true)); cur = [toWorld(item, { x: c[1], y: c[2] })]; }
      else if (c[0] === 1) cur.push(toWorld(item, { x: c[1], y: c[2] }));
      else if (c[0] === 5) { out.push(...segsOf(cur, true)); cur = []; }
    }
    if (cur.length) out.push(...segsOf(cur, false));
    return out;
  }
  if (item.type === "SHAPE") {
    const w = item.width, h = item.height;
    let pts;
    if (item.shapeType === "CIRCLE") pts = Array.from({ length: 24 }, (_, i) => ({ x: (w / 2) * Math.cos((i / 24) * 2 * Math.PI), y: (h / 2) * Math.sin((i / 24) * 2 * Math.PI) }));
    else if (item.shapeType === "TRIANGLE") pts = [{ x: 0, y: 0 }, { x: w / 2, y: h }, { x: -w / 2, y: h }];
    else if (item.shapeType === "HEXAGON") pts = Array.from({ length: 6 }, (_, i) => ({ x: (w / 2) * Math.cos((i / 6) * 2 * Math.PI), y: (h / 2) * Math.sin((i / 6) * 2 * Math.PI) }));
    else pts = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    return segsOf(pts.map((p) => toWorld(item, p)), true);
  }
  return [];
}

export const solidityOf = (item) => {
  const v = item.metadata?.[COVER_KEY] ?? item.metadata?.[PEEKABOO_KEY];
  return typeof v === "number" ? v : null;
};

/** Junta tudo que bloqueia ou atrapalha a visão. */
export async function loadObstacles(sceneDpi) {
  const [local, items, roomMd] = await Promise.all([OBR.scene.local.getItems(), OBR.scene.items.getItems(), OBR.room.getMetadata()]);
  const room = { ...ROOM_DEFAULTS, ...(roomMd[ROOM_VISION] || {}) };
  const walls = [], partial = [], circles = [];
  for (const it of [...local, ...items]) {
    if (it.type === "WALL" && it.blocking !== false) { walls.push(...outline(it)); continue; }
    if (it.metadata?.[SMOKE_VISION] === true && it.metadata?.["com.battle-system.smoke/disabled"] !== true) { walls.push(...outline(it)); continue; }
    const s = solidityOf(it);
    if (s !== null && s > 0) {
      for (const seg of outline(it)) (s >= 1 ? walls : partial).push(s >= 1 ? seg : { ...seg, s });
      continue;
    }
    if (room.charactersCover && it.type === "IMAGE" && (it.layer === "CHARACTER" || it.layer === "MOUNT") && it.visible !== false) {
      const size = (it.image.width * sceneDpi) / (it.grid?.dpi || it.image.width) * Math.abs(it.scale?.x ?? 1);
      circles.push({ c: it.position, r: size * 0.4, s: room.characterSolidity, id: it.id });
    }
  }
  return { walls, partial, circles };
}

const lineCmds = (list) => list.flatMap(([a, b]) => [[0, a.x, a.y], [1, b.x, b.y]]);
const ringCmds = (c, r, n = 28) => [...Array.from({ length: n }, (_, i) => [i ? 1 : 0, c.x + r * Math.cos((i / n) * 2 * Math.PI), c.y + r * Math.sin((i / n) * 2 * Math.PI)]), [5]];

/** Itens visíveis só para mim (scene.local), com a mesma interface do Keeper. */
class LocalDisplay {
  constructor(build) { this.build = build; this.ids = []; this.pending = null; this.busy = false; this.alive = true; }
  async restart() { const items = this.build(); this.ids = items.map((i) => i.id); await OBR.scene.local.addItems(items); }
  update(fn) {
    this.pending = fn;
    if (this.busy) return;
    const run = async () => {
      this.busy = true;
      while (this.pending && this.alive) {
        const f = this.pending; this.pending = null;
        await OBR.scene.local.updateItems(this.ids, (drafts) => f(this.ids.map((id) => drafts.find((d) => d.id === id)).filter(Boolean))).catch(() => {});
      }
      this.busy = false;
    };
    run();
  }
  stop() { this.alive = false; if (this.ids.length) OBR.scene.local.deleteItems(this.ids).catch(() => {}); }
}

export class VisionSession {
  /** o: { source:{x,y}, sourceId, grid, obstacles, settings, tokens } */
  constructor(o) {
    Object.assign(this, o);
    this.target = o.source;
    const tag = Math.random().toString(36).slice(2, 8);
    this.ids = ["clear", "partial", "blocked", "cell", "dot", ...COVER.map((c) => `ring-${c.key}`)].map((k) => `${ID}/v-${k}-${tag}`);
    this.badges = this.settings.visionAll ? this.computeBadges() : {};
    this.result = null;
    const Display = this.settings.visionShared ? Keeper : LocalDisplay;
    this.display = new Display(() => this.buildItems());
  }

  begin() { return this.display.restart(); }

  computeBadges() {
    const by = Object.fromEntries(COVER.map((c) => [c.key, []]));
    for (const t of this.tokens) {
      if (t.id === this.sourceId) continue;
      const r = checkTarget(this.source, t.position, this.grid.dpi, this.obstacles, this.settings.visionTo, [this.sourceId, t.id]);
      by[r.cover.key].push(...ringCmds(t.position, t.radius));
    }
    return by;
  }

  compute() {
    const r = checkTarget(this.source, this.target, this.grid.dpi, this.obstacles, this.settings.visionTo, [this.sourceId, this.targetId]);
    const clear = [], partial = [], blocked = [];
    for (const ray of r.rays) {
      if (ray.solidity >= 1) { clear.push([ray.from, ray.hit]); blocked.push([ray.hit, ray.to]); }
      else if (ray.solidity > 0) partial.push([ray.from, ray.to]);
      else clear.push([ray.from, ray.to]);
    }
    const d = this.grid.dpi, h = d / 2, c = this.target;
    const dist = this.grid.square ? formatDistance(pathCells([this.source, this.target], d, this.grid.measurement), this.grid.scale) : "";
    this.result = {
      clear: lineCmds(clear), partial: lineCmds(partial), blocked: lineCmds(blocked),
      cell: [[0, c.x - h, c.y - h], [1, c.x + h, c.y - h], [1, c.x + h, c.y + h], [1, c.x - h, c.y + h], [5]],
      color: r.cover.color,
      text: dist && (this.target.x !== this.source.x || this.target.y !== this.source.y) ? `${r.cover.label} · ${dist}` : r.cover.label,
    };
  }

  pathItem(i, cmds, color, opt = {}) {
    const d = this.grid.dpi;
    return buildPath().id(this.ids[i]).commands(cmds).position({ x: 0, y: 0 })
      .strokeColor(color).strokeWidth(opt.w ?? Math.max(2, d / 45)).strokeOpacity(opt.so ?? 0.95)
      .fillColor(color).fillOpacity(opt.fill ?? 0).strokeDash(opt.dash ?? [])
      .layer("RULER").locked(true).disableHit(true).build();
  }

  buildItems() {
    if (!this.result) this.compute();
    const r = this.result, d = this.grid.dpi;
    const items = [
      this.pathItem(0, r.clear, "#ffffff"),
      this.pathItem(1, r.partial, "#ffd84a", { dash: [d / 10, d / 14] }),
      this.pathItem(2, r.blocked, "#ff4a4a", { dash: [d / 14, d / 14], so: 0.8 }),
      this.pathItem(3, r.cell, r.color, { fill: 0.28, so: 1 }),
      this.pathItem(4, dotsToCommands([this.source], Math.max(5, d / 9)), "#ffffff", { fill: 1 }),
      ...COVER.map((c, k) => this.pathItem(5 + k, this.badges[c.key] || [], c.color, { w: Math.max(3, d / 22), so: 1 })),
    ];
    this.labelId = `${ID}/v-label-${Math.random().toString(36).slice(2, 8)}`;
    items.push(buildLabel().id(this.labelId).plainText(r.text).position({ x: this.target.x, y: this.target.y - d * 0.6 })
      .backgroundColor("#111418").backgroundOpacity(0.88).fillColor(r.color).fontWeight(700)
      .cornerRadius(8).pointerDirection("DOWN").pointerHeight(8).pointerWidth(12)
      .layer("RULER").locked(true).disableHit(true).build());
    return items;
  }

  /** Alvo: centro do token sob o cursor ou do quadrado. */
  aim(p, target, free) {
    const isTok = target && target.type === "IMAGE" && (target.layer === "CHARACTER" || target.layer === "MOUNT") && target.id !== this.sourceId;
    this.targetId = isTok ? target.id : null;
    this.target = isTok ? target.position : free || !this.grid.square ? p : snapCenter(p, this.grid.dpi);
    this.compute();
    const r = this.result, d = this.grid.dpi, pos = { x: this.target.x, y: this.target.y - d * 0.6 };
    this.display.update((dr) => {
      dr[0].commands = r.clear; dr[1].commands = r.partial; dr[2].commands = r.blocked;
      dr[3].commands = r.cell; dr[3].style.fillColor = r.color; dr[3].style.strokeColor = r.color;
      const lb = dr[dr.length - 1];
      lb.text.plainText = r.text; lb.text.style.fillColor = r.color; lb.position = pos;
    });
  }

  stop() { this.display.stop(); }
}

/** Tokens da cena com raio aproximado (para os anéis de cobertura). */
export async function sceneTokens(sceneDpi) {
  const items = await OBR.scene.items.getItems((i) => i.type === "IMAGE" && (i.layer === "CHARACTER" || i.layer === "MOUNT") && i.visible !== false);
  return items.map((it) => ({
    id: it.id, position: it.position,
    radius: ((it.image.width * sceneDpi) / (it.grid?.dpi || it.image.width)) * Math.abs(it.scale?.x ?? 1) * 0.55,
  }));
}
