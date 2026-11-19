// Áreas de efeito (D&D): prévia enquanto o mouse se move, fixa no 2º clique.
import OBR, { buildPath, buildLabel } from "@owlbear-rodeo/sdk";
import { Keeper, ID, META_AREA, shouldPin } from "./shared.js";
import { measureLabel } from "./persist.js";
import { DIFFICULT_COLOR } from "./terrain.js";
import { areaShape, affectedCells, cellsToCommands, polyToCommands, formatDistance, snapCorner, snapCenter, pointInPoly } from "./geom.js";
import { castRay, checkTarget, COVER } from "./sight.js";

const ring = (c, r, n = 28) => [...Array.from({ length: n }, (_, i) => [i ? 1 : 0, c.x + r * Math.cos((i / n) * 2 * Math.PI), c.y + r * Math.sin((i / n) * 2 * Math.PI)]), [5]];

const NAMES = { circle: "Círculo", cone: "Cone", square: "Quadrado", cube: "Cubo", line: "Linha" };

/** Onde a área começa: tokens dão o próprio centro; senão encaixa na grade. */
export function areaOrigin(kind, p, grid, target, free) {
  if (target && target.type === "IMAGE" && ["CHARACTER", "MOUNT"].includes(target.layer) && kind !== "cube") return target.position;
  if (free || !grid.square) return p;
  return kind === "square" ? snapCenter(p, grid.dpi) : snapCorner(p, grid.dpi);
}

export class AreaSession {
  /**
   * obstacles/tokens (opcionais): com eles a área respeita paredes (quadrados atrás de parede ficam de fora)
   * e mostra a cobertura de cada token dentro dela.
   */
  constructor({ kind, origin, grid, color, settings, playerId, obstacles = null, tokens = [] }) {
    Object.assign(this, { kind, origin, grid, color, settings, playerId, tokens });
    // contra áreas de efeito só paredes e coberturas marcadas contam (criaturas não)
    this.obstacles = obstacles && settings.areaWalls !== false ? { walls: obstacles.walls, partial: obstacles.partial, circles: [] } : null;
    this.cursor = origin;
    this.free = false;
    const tag = Math.random().toString(36).slice(2, 8);
    this.ids = { shape: `${ID}/area-${tag}`, cells: `${ID}/cells-${tag}`, blocked: `${ID}/blocked-${tag}`, label: "" };
    this.ringIds = COVER.map((c) => `${ID}/aring-${c.key}-${tag}`);
    this.compute();
    this.keeper = new Keeper(() => this.buildItems());
  }

  async begin() { await this.keeper.restart(); }

  compute() {
    const g = this.grid;
    const s = areaShape(this.kind, this.origin, this.cursor, g.dpi, { snap: !this.free && g.square, lineWidth: this.settings.lineWidth });
    this.shape = s;
    const all = g.square && this.settings.showCells ? affectedCells(s.poly, g.dpi, this.settings.cellRule) : [];
    // linha de efeito: o quadrado só é atingido se nenhuma parede fica entre a origem e o centro dele
    this.blocked = [];
    this.cells = all;
    const o = this.effectOrigin();
    if (this.obstacles?.walls.length && all.length) {
      this.cells = [];
      for (const cell of all) {
        const r = castRay(o, { x: (cell.c + 0.5) * g.dpi, y: (cell.r + 0.5) * g.dpi }, { walls: this.obstacles.walls, partial: [], circles: [] });
        (r.solidity >= 1 ? this.blocked : this.cells).push(cell);
      }
    }
    // tokens dentro da área e a cobertura de cada um (D&D: ½ = +2 na salvaguarda de Des, ¾ = +5, total = não é atingido)
    this.hits = Object.fromEntries(COVER.map((c) => [c.key, []]));
    let nIn = 0;
    if (this.obstacles && s.poly.length >= 3) {
      for (const t of this.tokens) {
        if (!pointInPoly(t.position, s.poly) || (t.position.x === this.origin.x && t.position.y === this.origin.y)) continue;
        // sem linha de efeito até o centro do token = protegido; senão a regra dos cantos dá ½ ou ¾
        const toCenter = castRay(o, t.position, { walls: this.obstacles.walls, partial: [], circles: [] });
        const cv = toCenter.solidity >= 1 ? COVER[0] : checkTarget(o, t.position, g.dpi, this.obstacles, "corners", [t.id]).cover;
        this.hits[cv.key].push(t);
        nIn++;
      }
    }
    const ft = (n) => formatDistance(n, g.scale);
    let t;
    if (this.kind === "circle") t = `Raio ${ft(s.size)}`;
    else if (this.kind === "square") t = `Quadrado ${ft(2 * s.size + 1)} (raio ${ft(s.size)})`;
    else if (this.kind === "cube") t = `Cubo ${ft(s.size)}`;
    else t = `${NAMES[this.kind]} ${ft(s.size)}`;
    if (this.cells.length) t += ` · ${this.cells.length} quadrado${this.cells.length > 1 ? "s" : ""}`;
    if (this.blocked.length) t += ` (${this.blocked.length} atrás de parede)`;
    if (nIn) {
      const hit = nIn - this.hits.total.length;
      const parts = [];
      if (this.hits.half.length) parts.push(`${this.hits.half.length} com ½`);
      if (this.hits["3/4"].length) parts.push(`${this.hits["3/4"].length} com ¾`);
      if (this.hits.total.length) parts.push(`${this.hits.total.length} protegido${this.hits.total.length > 1 ? "s" : ""}`);
      t += ` · ${hit} alvo${hit === 1 ? "" : "s"}${parts.length ? ` (${parts.join(", ")})` : ""}`;
    }
    this.text = t;
    this.name = t.split(" · ")[0];
  }

  shapeItem(forScene = false, dash = []) {
    const b = buildPath()
      .commands(polyToCommands(this.shape.poly))
      .fillColor(this.color).fillOpacity(this.settings.areaOpacity)
      .strokeColor(this.color).strokeOpacity(0.95).strokeWidth(Math.max(2, this.grid.dpi / 30)).strokeDash(dash)
      .layer(forScene ? "DRAWING" : "RULER").position({ x: 0, y: 0 }).name(`Área: ${this.name}`);
    if (!forScene) b.id(this.ids.shape).locked(true).disableHit(true);
    return b.build();
  }

  cellsItem(forScene = false, parentId) {
    const b = buildPath()
      .commands(cellsToCommands(this.cells, this.grid.dpi))
      .fillColor(this.color).fillOpacity(Math.min(0.5, this.settings.areaOpacity + 0.12))
      .strokeColor(this.color).strokeOpacity(0.5).strokeWidth(1)
      .layer(forScene ? "DRAWING" : "RULER").position({ x: 0, y: 0 }).locked(true).disableHit(true)
      .name(`Quadrados: ${this.name}`);
    if (!forScene) b.id(this.ids.cells);
    if (parentId) b.attachedTo(parentId);
    return b.build();
  }

  labelItem() {
    this.ids.label = `${ID}/alabel-${Math.random().toString(36).slice(2, 8)}`;
    return buildLabel()
      .id(this.ids.label).plainText(this.text).position(this.labelPos())
      .backgroundColor("#111418").backgroundOpacity(0.85).fillColor("#ffffff").fontWeight(600)
      .cornerRadius(8).pointerDirection("DOWN").pointerHeight(8).pointerWidth(12)
      .layer("RULER").locked(true).disableHit(true).build();
  }

  labelPos() { return { x: this.cursor.x, y: this.cursor.y - this.grid.dpi * 0.55 }; }

  /** Ponto de onde o efeito "sai": a origem, puxada um fio para dentro da forma (evita origem exatamente em cima da parede). */
  effectOrigin() {
    const p = this.shape?.poly || [];
    if (p.length < 3 || this.kind === "circle" || this.kind === "square") return this.origin;
    const cx = p.reduce((a, q) => a + q.x, 0) / p.length, cy = p.reduce((a, q) => a + q.y, 0) / p.length;
    const dx = cx - this.origin.x, dy = cy - this.origin.y, L = Math.hypot(dx, dy) || 1, e = this.grid.dpi * 0.02;
    return { x: this.origin.x + (dx / L) * e, y: this.origin.y + (dy / L) * e };
  }

  extraCommands() {
    const d = this.grid.dpi;
    return {
      blocked: cellsToCommands(this.blocked, d),
      rings: COVER.map((c) => this.hits[c.key].flatMap((t) => ring(t.position, t.radius))),
    };
  }

  buildItems() {
    const x = this.extraCommands();
    const extra = [
      buildPath().id(this.ids.blocked).commands(x.blocked).position({ x: 0, y: 0 })
        .fillColor("#000000").fillOpacity(0.35).strokeColor("#ff4a4a").strokeOpacity(0.6).strokeWidth(1).strokeDash([6, 6])
        .layer("RULER").locked(true).disableHit(true).build(),
      ...COVER.map((c, k) => buildPath().id(this.ringIds[k]).commands(x.rings[k]).position({ x: 0, y: 0 })
        .strokeColor(c.color).strokeWidth(Math.max(3, this.grid.dpi / 22)).strokeOpacity(1).fillOpacity(0)
        .layer("RULER").locked(true).disableHit(true).build()),
    ];
    return [this.shapeItem(), this.cellsItem(), this.labelItem(), ...extra];
  }

  move(p, free = false) {
    this.cursor = p;
    this.free = free;
    this.compute();
    const shape = polyToCommands(this.shape.poly), cells = cellsToCommands(this.cells, this.grid.dpi);
    const text = this.text, pos = this.labelPos(), x = this.extraCommands();
    this.keeper.update((draft) => {
      draft[0].commands = shape;
      draft[1].commands = cells;
      draft[2].text.plainText = text;
      draft[2].position = pos;
      if (draft[3]) draft[3].commands = x.blocked;
      x.rings.forEach((r, k) => { if (draft[4 + k]) draft[4 + k].commands = r; });
    });
  }

  cancel() { this.keeper.stop(); }

  /** Onde escrever a medida da área fixada: no meio da forma. */
  centerPos() {
    const p = this.shape.poly;
    if (this.kind === "circle" || this.kind === "square") return this.origin;
    return { x: p.reduce((a, q) => a + q.x, 0) / p.length, y: p.reduce((a, q) => a + q.y, 0) / p.length };
  }

  /**
   * 2º clique: fixa a área no mapa como desenho (todos veem), com a medida escrita.
   * difficult = vira terreno difícil (fica no mapa mesmo com "manter" desligado, e conta em dobro na régua)
   */
  async place(difficult = false) {
    this.keeper.stop();
    if (!difficult && !shouldPin(this.settings, "area")) return;
    if (this.shape.poly.length < 3 || this.shape.size <= 0) return;
    const text = difficult ? `Terreno difícil · ${this.name}` : this.name;
    const meta = { [META_AREA]: { owner: this.playerId, kind: this.kind, size: this.shape.size, text: this.name, difficult, color: this.color } };
    if (difficult) this.color = DIFFICULT_COLOR;
    const shape = this.shapeItem(true, difficult ? [12, 8] : []);
    shape.metadata = meta;
    const items = [shape];
    if (this.cells.length) {
      const cells = this.cellsItem(true, shape.id);
      cells.metadata = meta;
      items.push(cells);
    }
    const c = this.centerPos();
    items.push(measureLabel(text, { x: c.x, y: c.y }, shape.id, meta, true));
    await OBR.scene.items.addItems(items);
  }
}

/** Apaga as áreas fixadas: as suas, ou todas (mestre). */
export async function clearAreas(all) {
  const me = await OBR.player.getId();
  const items = await OBR.scene.items.getItems((i) => i.metadata?.[META_AREA] && (all || i.metadata[META_AREA].owner === me));
  if (items.length) await OBR.scene.items.deleteItems(items.map((i) => i.id));
  return items.length;
}
