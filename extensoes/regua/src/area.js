// Áreas de efeito (D&D): prévia enquanto o mouse se move, fixa no 2º clique.
import OBR, { buildPath, buildLabel } from "@owlbear-rodeo/sdk";
import { Keeper, ID, META_AREA, shouldPin } from "./shared.js";
import { measureLabel } from "./persist.js";
import { DIFFICULT_COLOR } from "./terrain.js";
import { areaShape, affectedCells, cellsToCommands, polyToCommands, formatDistance, snapCorner, snapCenter } from "./geom.js";

const NAMES = { circle: "Círculo", cone: "Cone", square: "Quadrado", cube: "Cubo", line: "Linha" };

/** Onde a área começa: tokens dão o próprio centro; senão encaixa na grade. */
export function areaOrigin(kind, p, grid, target, free) {
  if (target && target.type === "IMAGE" && ["CHARACTER", "MOUNT"].includes(target.layer) && kind !== "cube") return target.position;
  if (free || !grid.square) return p;
  return kind === "square" ? snapCenter(p, grid.dpi) : snapCorner(p, grid.dpi);
}

export class AreaSession {
  constructor({ kind, origin, grid, color, settings, playerId }) {
    Object.assign(this, { kind, origin, grid, color, settings, playerId });
    this.cursor = origin;
    this.free = false;
    const tag = Math.random().toString(36).slice(2, 8);
    this.ids = { shape: `${ID}/area-${tag}`, cells: `${ID}/cells-${tag}`, label: "" };
    this.compute();
    this.keeper = new Keeper(() => this.buildItems());
  }

  async begin() { await this.keeper.restart(); }

  compute() {
    const g = this.grid;
    const s = areaShape(this.kind, this.origin, this.cursor, g.dpi, { snap: !this.free && g.square, lineWidth: this.settings.lineWidth });
    this.shape = s;
    this.cells = g.square && this.settings.showCells ? affectedCells(s.poly, g.dpi, this.settings.cellRule) : [];
    const ft = (n) => formatDistance(n, g.scale);
    let t;
    if (this.kind === "circle") t = `Raio ${ft(s.size)}`;
    else if (this.kind === "square") t = `Quadrado ${ft(2 * s.size + 1)} (raio ${ft(s.size)})`;
    else if (this.kind === "cube") t = `Cubo ${ft(s.size)}`;
    else t = `${NAMES[this.kind]} ${ft(s.size)}`;
    if (this.cells.length) t += ` · ${this.cells.length} quadrado${this.cells.length > 1 ? "s" : ""}`;
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

  buildItems() { return [this.shapeItem(), this.cellsItem(), this.labelItem()]; }

  move(p, free = false) {
    this.cursor = p;
    this.free = free;
    this.compute();
    const shape = polyToCommands(this.shape.poly), cells = cellsToCommands(this.cells, this.grid.dpi);
    const text = this.text, pos = this.labelPos();
    this.keeper.update((draft) => {
      draft[0].commands = shape;
      draft[1].commands = cells;
      draft[2].text.plainText = text;
      draft[2].position = pos;
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
