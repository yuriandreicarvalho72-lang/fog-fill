// Modo "segurar e soltar": o jogador segura o token e arrasta; ao soltar, a posição fica marcada
// (um ponto do caminho). Dá para pegar de novo a última marca e mudar, ou clicar em outro lugar
// para acrescentar um ponto. Confirmar anda com o token; cancelar o deixa onde estava.
// A lógica é só esta classe; o background (modo nativo) e a camada do botão direito só repassam o ponteiro.
import { RulerSession, movableToken } from "./session.js";
import { tokenSizePx } from "./geom.js";

export { movableToken };

export class GrabController {
  /**
   * @param {object} o  o mesmo de RulerSession (grid, token, color, ...), mais:
   * @param {{x,y}[]} [o.points]  marcas já feitas (a primeira é onde o token está); com elas, começa "pousado"
   * @param {boolean} [o.shadow]  mostrar a sombra do token levantado
   */
  constructor(o) {
    const pending = Array.isArray(o.points) && o.points.length > 1;
    this.s = new RulerSession({ ...o, kind: "move", lift: true, lifted: !pending, shadow: o.shadow !== false, start: o.start || o.points?.[0] });
    this.phase = pending ? "pending" : "idle";   // idle (ainda não pegou) | drag (segurando) | pending (marcado)
    this.done = false;
  }

  begin() { return this.s.begin(); }
  get points() { return this.s.points; }
  get last() { return this.s.points[this.s.points.length - 1]; }

  /** O ponteiro está em cima do token "pousado" na última marca? */
  near(p) {
    const { w, h } = tokenSizePx(this.s.token, this.s.grid.dpi);
    const r = Math.max(Math.min(w, h) / 2, this.s.grid.dpi * 0.5);
    return Math.hypot(p.x - this.last.x, p.y - this.last.y) <= r;
  }

  /** Apertou o botão (ou começou a arrastar o token). */
  async down(p, alt = false) {
    if (this.done) return;
    if (this.phase === "idle") {
      this.phase = "drag";
      this.s.setLifted(true);
      await this.s.move(p, alt);
    } else if (this.phase === "pending") {
      if (this.near(p)) {
        // pega de novo a última marca para mudar o destino
        if (this.s.points.length > 1) await this.s.undoPoint();
        this.phase = "drag";
        this.s.setLifted(true);
        await this.s.move(p, alt);
      } else {
        // clique em outro lugar: mais um ponto no caminho
        await this.s.move(p, alt);
        await this.s.addPoint();
        this.s.setLifted(false);
      }
    }
  }

  async move(p, alt = false) {
    if (this.done || this.phase !== "drag") return;
    await this.s.move(p, alt);
  }

  /** Soltou: a posição fica marcada. */
  async up(p, alt = false) {
    if (this.done || this.phase !== "drag") return;
    await this.s.move(p, alt);
    await this.s.addPoint();
    this.phase = "pending";
    this.s.setLifted(false);
  }

  /** Backspace: tira a última marca. */
  async undo() {
    if (this.done || this.s.points.length < 2) return;
    await this.s.undoPoint();
    this.s.cursor = this.last;
    await this.s.move(this.last, true);
    if (this.s.points.length < 2) this.phase = "idle"; else this.phase = "pending";
    this.s.setLifted(false);
  }

  /** Só dá para confirmar se há ao menos uma marca além do ponto de partida. */
  get ready() { return this.s.points.length > 1; }

  async confirm(handoff) {
    if (this.done) return false;
    this.done = true;
    return this.s.confirm(handoff);
  }

  cancel() {
    if (this.done) return;
    this.done = true;
    this.s.cancel();
  }
}
