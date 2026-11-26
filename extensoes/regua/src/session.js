// Uma medição ou um movimento em andamento: pontos fixos + ponto do cursor.
// Roda tanto no background (modo nativo) quanto na camada sobre o mapa (botão direito).
import OBR, { buildCurve, buildLabel, buildPath } from "@owlbear-rodeo/sdk";
import { Keeper, ID, PATH_CHANNEL, HALT_CHANNEL } from "./shared.js";
import { persistRuler } from "./persist.js";
import { pathCells, pathCost, formatDistance, snapRelative, snapCenter, dotsToCommands, ellipseCommands, liftLook } from "./geom.js";
import { loadDifficult } from "./terrain.js";

export class RulerSession {
  /**
   * @param {object} o
   * @param {"move"|"measure"} o.kind
   * @param {object} o.grid  resultado de loadGrid()
   * @param {{x,y}} o.start
   * @param {object} [o.token] item do token (modo mover)
   * @param {string} o.color  cor do jogador
   * @param {number} [o.trailMs]
   */
  constructor(o) {
    Object.assign(this, o);
    this.points = o.points ? o.points.map((p) => ({ ...p })) : [o.start];
    this.cursor = o.cursor || this.points[this.points.length - 1];
    this.lifted = o.lift ? o.lifted !== false : false; // modo "segurar e soltar": o token sobe e deixa sombra
    this.fixedDist = 0;       // grades não quadradas: soma dos trechos fixos
    this.lastDist = 0;
    this.seq = 0;
    this.done = false;
    const tag = Math.random().toString(36).slice(2, 8);
    this.ids = { line: `${ID}/line-${tag}`, dots: `${ID}/dots-${tag}`, label: `${ID}/label-${tag}` };
    this.keeper = new Keeper(() => this.buildItems());
  }

  async begin() {
    // terreno difícil fixado no mapa (só grade quadrada)
    this.difficult = this.grid.square ? await loadDifficult(this.grid.dpi, this.cellRule).catch(() => new Set()) : new Set();
    await this.keeper.restart();
  }

  /** Custo em quadrados de um caminho, contando terreno difícil. */
  cost(points) {
    if (!this.difficult?.size) return { total: pathCells(points, this.grid.dpi, this.grid.measurement), extra: 0 };
    return pathCost(points, this.grid.dpi, this.grid.measurement, (c, r) => this.difficult.has(`${c},${r}`));
  }

  /** Encaixe do ponto do cursor (Alt desliga). */
  async snap(p, free) {
    if (free) return p;
    const d = this.grid.dpi;
    if (this.grid.square) return this.kind === "move" ? snapRelative(p, this.start, d) : snapCenter(p, d);
    return OBR.scene.grid.snapPosition(p, 1, false, true);
  }

  async distanceCells(points) {
    if (this.grid.square) return this.cost(points).total;
    // hex / isométrica: o próprio Owlbear mede cada trecho
    const a = points[points.length - 2], b = points[points.length - 1];
    return this.fixedDist + (a && b ? await OBR.scene.grid.getDistance(a, b) : 0);
  }

  labelText(totalCells, segCells, hard = false) {
    const total = formatDistance(totalCells, this.grid.scale) + (hard ? " ⛰" : "");
    if (this.points.length > 1 && segCells > 0) return `${total}  (+${formatDistance(segCells, this.grid.scale)})`;
    return total;
  }

  buildItems() {
    const d = this.grid.dpi;
    const pts = [...this.points, this.cursor];
    const line = buildCurve()
      .id(this.ids.line).points(pts).tension(0).closed(false)
      .strokeColor(this.color).strokeWidth(Math.max(3, d / 18)).strokeDash([d / 6, d / 10]).strokeOpacity(1)
      .fillOpacity(0).layer("RULER").locked(true).disableHit(true).position({ x: 0, y: 0 }).build();
    const dots = buildPath()
      .id(this.ids.dots).commands(dotsToCommands(this.points, Math.max(5, d / 10)))
      .fillColor(this.color).fillOpacity(1).strokeColor("#000000").strokeOpacity(0.4).strokeWidth(2)
      .layer("RULER").locked(true).disableHit(true).position({ x: 0, y: 0 }).build();
    // o id do rótulo muda a cada recriação (evita rótulo congelado nos outros jogadores)
    this.ids.label = `${ID}/label-${Math.random().toString(36).slice(2, 8)}`;
    const label = buildLabel()
      .id(this.ids.label).plainText(this.text || "0").position(this.labelPos())
      .backgroundColor("#111418").backgroundOpacity(0.85).fillColor("#ffffff").fontWeight(600)
      .cornerRadius(8).pointerDirection("DOWN").pointerHeight(8).pointerWidth(12)
      .layer("RULER").locked(true).disableHit(true).build();
    const items = [line, dots, label];
    if (this.token && this.lift) {
      const lk = liftLook(this.token, this.cursor, d, this.lifted);
      const sh = lk.shadow;
      if (this.shadow !== false) {
        items.push(buildPath().id(`${ID}/shadow-${Math.random().toString(36).slice(2, 8)}`).commands(ellipseCommands(sh.cx, sh.cy, sh.rx, sh.ry))
          .fillColor("#000000").fillOpacity(sh.opacity).strokeOpacity(0).strokeWidth(0).layer("MOUNT").locked(true).disableHit(true).position({ x: 0, y: 0 }).build());
      } else items.push(buildPath().id(`${ID}/shadow-off`).commands(ellipseCommands(0, 0, 1, 1)).fillOpacity(0).strokeOpacity(0).layer("MOUNT").locked(true).disableHit(true).position({ x: 0, y: 0 }).build());
      items.push({ ...this.token, position: lk.ghost, scale: { x: (this.token.scale?.x ?? 1) * lk.scale, y: (this.token.scale?.y ?? 1) * lk.scale } });
    } else if (this.token) items.push({ ...this.token, position: this.cursor });
    return items;
  }

  /** Atualiza o token-fantasma (e a sombra, no modo levantar) na interação em andamento. */
  paintGhost(draft) {
    if (!this.token) return;
    if (!this.lift) { if (draft[3]) draft[3].position = this.cursor; return; }
    const lk = liftLook(this.token, this.cursor, this.grid.dpi, this.lifted);
    const sh = lk.shadow;
    if (draft[3]) { draft[3].commands = ellipseCommands(sh.cx, sh.cy, sh.rx, sh.ry); draft[3].style = { ...(draft[3].style || {}), fillOpacity: sh.opacity }; draft[3].fillOpacity = sh.opacity; }
    if (draft[4]) { draft[4].position = lk.ghost; draft[4].scale = { x: (this.token.scale?.x ?? 1) * lk.scale, y: (this.token.scale?.y ?? 1) * lk.scale }; }
  }

  /** Levanta (true) ou pousa (false) o token-fantasma. */
  setLifted(v) {
    this.lifted = !!v;
    this.keeper.update((draft) => this.paintGhost(draft));
  }

  labelPos() { return { x: this.cursor.x, y: this.cursor.y - this.grid.dpi * 0.55 }; }

  async move(p, free = false) {
    if (this.done) return;
    const my = ++this.seq;
    const c = await this.snap(p, free);
    if (my !== this.seq || this.done) return;
    this.cursor = c;
    const all = [...this.points, c];
    let total, seg, hard = false;
    if (this.grid.square) {
      const all1 = this.cost(all), prev = this.cost(this.points);
      total = all1.total; seg = total - prev.total; hard = all1.extra > 0;
    } else {
      total = await this.distanceCells(all);
      seg = total - this.fixedDist;
    }
    if (my !== this.seq || this.done) return;
    this.lastDist = total;
    this.text = this.labelText(total, seg, hard);
    const pos = this.labelPos(), text = this.text;
    this.keeper.update((draft) => {
      draft[0].points = all;
      draft[2].text.plainText = text;
      draft[2].position = pos;
      this.paintGhost(draft);
    });
  }

  /** Clique esquerdo: fixa o ponto atual e começa um novo trecho. */
  async addPoint() {
    if (this.done) return;
    const last = this.points[this.points.length - 1];
    if (last.x === this.cursor.x && last.y === this.cursor.y) return;
    if (!this.grid.square) this.fixedDist += await OBR.scene.grid.getDistance(last, this.cursor);
    this.points.push(this.cursor);
    const cmds = dotsToCommands(this.points, Math.max(5, this.grid.dpi / 10));
    this.keeper.update((draft) => { draft[1].commands = cmds; });
  }

  /** Backspace: tira o último ponto fixo. */
  async undoPoint() {
    if (this.done || this.points.length < 2) return;
    const removed = this.points.pop();
    if (!this.grid.square) this.fixedDist -= await OBR.scene.grid.getDistance(this.points[this.points.length - 1], removed);
    const cmds = dotsToCommands(this.points, Math.max(5, this.grid.dpi / 10));
    this.keeper.update((draft) => { draft[1].commands = cmds; });
  }

  cancel() {
    if (this.done) return;
    this.done = true;
    this.keeper.stop();
  }

  /** Quanto mede cada trecho (em quadrados), de forma que a soma bata com o total. */
  async segmentCells(path) {
    const out = [];
    if (this.grid.square) {
      let prev = 0;
      for (let i = 1; i < path.length; i++) {
        const cum = this.cost(path.slice(0, i + 1)).total;
        out.push(cum - prev);
        prev = cum;
      }
    } else {
      for (let i = 1; i < path.length; i++) out.push(await OBR.scene.grid.getDistance(path[i - 1], path[i]));
    }
    return out;
  }

  /** Caminho final: pontos fixos + cursor, sem repetidos. */
  path() {
    const out = [];
    for (const p of [...this.points, this.cursor]) {
      const l = out[out.length - 1];
      if (!l || l.x !== p.x || l.y !== p.y) out.push(p);
    }
    return out;
  }

  /**
   * Botão direito / Enter: anda com o token ponto a ponto pelo caminho desenhado
   * (assim o Smoke & Spectre checa cada trecho, e não a reta do início ao fim).
   * @param {(trail) => void} [handoff] entrega o rastro a quem fica vivo (background) para não segurar a tela
   */
  async confirm(handoff) {
    if (this.done) return false;
    this.done = true;
    const path = this.path();
    const trail = { points: path, text: this.text, color: this.color, dpi: this.grid.dpi, ms: this.trailMs ?? 900 };
    let moved = false;
    if (this.token && path.length > 1) {
      const step = this.stepMs ?? 90;
      const tokenId = this.token.id;
      // Gatilhos (se instalado): avisa o caminho; se ele passar por uma armadilha que prende o token,
      // chega um "parar" com o ponto onde ficar, e o resto do caminho é cortado
      let halt = null;
      let off = () => {};
      try {
        off = OBR.broadcast.onMessage(HALT_CHANNEL, (e) => { if (e.data?.tokenId === tokenId && e.data.at) halt = e.data; });
        OBR.broadcast.sendMessage(PATH_CHANNEL, { tokenId, points: path }, { destination: "ALL" }).catch(() => {});
      } catch { /* sem broadcast: anda normal */ }
      const put = (p) => OBR.scene.items.updateItems([tokenId], (draft) => { for (const it of draft) it.position = p; });
      try {
        for (let i = 1; i < path.length; i++) {
          if (halt && i > (halt.upto ?? -1)) { await put(halt.at); break; }
          await put(path[i]);
          if (i < path.length - 1 && step > 0) await new Promise((r) => setTimeout(r, step));
        }
        moved = true;
      } catch (e) {
        console.error(`[${ID}]`, e);
        OBR.notification.show("Régua: você não tem permissão para mover esse token.", "ERROR");
      }
      // um "parar" que chegue depois disso é resolvido pelo próprio Gatilhos (ele devolve o token)
      off();
    }
    if (this.persist && path.length > 1) {
      // fixa como desenho, com as medidas; aí o rastro temporário não é necessário
      try {
        const segs = await this.segmentCells(path);
        await persistRuler({
          points: path, total: this.text?.split("  (")[0] || formatDistance(segs.reduce((a, b) => a + b, 0), this.grid.scale),
          segTexts: segs.map((c) => formatDistance(c, this.grid.scale)),
          color: this.color, dpi: this.grid.dpi, owner: this.owner, kind: this.kind,
        });
      } catch (e) { console.error(`[${ID}]`, e); }
      this.keeper.stop();
      return moved;
    }
    if (handoff) handoff(trail); else showTrail(trail);
    this.keeper.stop();
    return moved;
  }
}

/** Rastro do caminho (linha + pontos + rótulo), visível a todos por um instante, sem prender a tela. */
export async function showTrail({ points, text, color, dpi, ms }) {
  if (!points || points.length < 2 || !(ms > 0)) return;
  const tag = Math.random().toString(36).slice(2, 8);
  const end = points[points.length - 1];
  const keeper = new Keeper(() => [
    buildCurve().id(`${ID}/tline-${tag}`).points(points).tension(0).closed(false)
      .strokeColor(color).strokeWidth(Math.max(3, dpi / 18)).strokeDash([dpi / 6, dpi / 10]).strokeOpacity(0.85)
      .fillOpacity(0).layer("RULER").locked(true).disableHit(true).position({ x: 0, y: 0 }).build(),
    buildPath().id(`${ID}/tdots-${tag}`).commands(dotsToCommands(points.slice(0, -1), Math.max(5, dpi / 10)))
      .fillColor(color).fillOpacity(1).strokeColor("#000000").strokeOpacity(0.4).strokeWidth(2)
      .layer("RULER").locked(true).disableHit(true).position({ x: 0, y: 0 }).build(),
    buildLabel().id(`${ID}/tlabel-${Math.random().toString(36).slice(2, 8)}`).plainText(text || "")
      .position({ x: end.x, y: end.y - dpi * 0.55 })
      .backgroundColor("#111418").backgroundOpacity(0.85).fillColor("#ffffff").fontWeight(600)
      .cornerRadius(8).pointerDirection("DOWN").pointerHeight(8).pointerWidth(12)
      .layer("RULER").locked(true).disableHit(true).build(),
  ]);
  await keeper.restart();
  setTimeout(() => keeper.stop(), ms);
}

/** O item clicado pode ser arrastado pela régua? */
export function movableToken(item, role) {
  if (!item || item.type !== "IMAGE") return false;
  if (!['CHARACTER', 'MOUNT', 'PROP'].includes(item.layer)) return false;
  if (item.locked && role !== "GM") return false;
  return true;
}
