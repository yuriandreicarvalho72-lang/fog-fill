import { controls } from "./visibility.js";
// Camada transparente sobre o mapa durante um movimento/medição.
// Existe só para receber o botão direito (o Owlbear não diz às extensões qual botão foi usado).
// Esquerdo = novo ponto · Direito = confirmar · Esc = cancelar · Backspace = desfazer ponto
// Roda = zoom · Botão do meio arrastando = mover a câmera
import OBR from "@owlbear-rodeo/sdk";
import { MODAL_ID, TRAIL_CHANNEL, loadGrid, loadSettings, shouldPin, ID } from "./shared.js";
import { RulerSession } from "./session.js";

const q = new URLSearchParams(location.search);
const kind = q.get("kind") === "move" ? "move" : "measure";
const start = { x: Number(q.get("sx")), y: Number(q.get("sy")) };
const firstPointer = { x: Number(q.get("px")), y: Number(q.get("py")) };
const tokenId = q.get("token");

let session = null;
let closing = false;
// transformação da câmera: tela = mundo * k + o (lida do Owlbear e atualizada no zoom/pan)
let view = { k: 1, ox: 0, oy: 0 };
let last = { x: 0, y: 0, alt: false, has: false };
let raf = 0;

async function readView() {
  const [a, b] = await Promise.all([OBR.viewport.transformPoint({ x: 0, y: 0 }), OBR.viewport.transformPoint({ x: 1000, y: 0 })]);
  view = { k: (b.x - a.x) / 1000 || 1, ox: a.x, oy: a.y };
}
const toWorld = (cx, cy) => ({ x: (cx - view.ox) / view.k, y: (cy - view.oy) / view.k });

async function close() {
  if (closing) return;
  closing = true;
  try { await controls.modal.close(MODAL_ID); } catch { /* já fechada */ }
}

async function finish(confirm) {
  if (!session || session.done) return close();
  document.body.classList.add("ending");
  if (!confirm) { session.cancel(); return close(); }
  // anda com o token pelo caminho e passa o rastro para o background, que continua vivo depois que a camada fecha
  await session.confirm((trail) => OBR.broadcast.sendMessage(TRAIL_CHANNEL, trail, { destination: "LOCAL" }).catch(() => {}));
  close();
}

function onMove(e) {
  last = { x: e.clientX, y: e.clientY, alt: e.altKey, has: true };
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (session && last.has) session.move(toWorld(last.x, last.y), last.alt);
  });
}

let pan = null;
async function onDown(e) {
  if (!session || session.done) return;
  if (e.button === 0) {
    await session.move(toWorld(e.clientX, e.clientY), e.altKey);
    await session.addPoint();
  } else if (e.button === 2) {
    e.preventDefault();
    finish(true);
  } else if (e.button === 1) {
    e.preventDefault();
    pan = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy };
  }
}
function onUp(e) { if (e.button === 1) pan = null; }
async function onPanMove(e) {
  if (!pan) return;
  view.ox = pan.ox + (e.clientX - pan.x);
  view.oy = pan.oy + (e.clientY - pan.y);
  await OBR.viewport.setPosition({ x: view.ox, y: view.oy });
}

let zoomBusy = false;
async function onWheel(e) {
  e.preventDefault();
  if (zoomBusy) return;
  zoomBusy = true;
  try {
    const k2 = Math.min(10, Math.max(0.05, view.k * Math.exp(-e.deltaY * 0.0015)));
    const r = k2 / view.k;
    const ox = e.clientX - (e.clientX - view.ox) * r, oy = e.clientY - (e.clientY - view.oy) * r;
    await OBR.viewport.setScale(k2);
    await OBR.viewport.setPosition({ x: ox, y: oy });
    await readView();
    if (session && last.has) session.move(toWorld(last.x, last.y), last.alt);
  } finally { zoomBusy = false; }
}

function onKey(e) {
  if (e.key === "Escape") { e.preventDefault(); finish(false); }
  else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(true); }
  else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); session?.undoPoint(); }
}

OBR.onReady(async () => {
  try {
    const settings = loadSettings();
    const [grid, color, owner] = await Promise.all([loadGrid(), OBR.player.getColor(), OBR.player.getId(), readView()]);
    let token = null;
    if (tokenId) [token] = await OBR.scene.items.getItems([tokenId]);
    if (kind === "move" && !token) return close();
    session = new RulerSession({ kind, grid, start, token, color, trailMs: settings.trailMs, stepMs: settings.stepMs, persist: shouldPin(settings, kind), owner, cellRule: settings.cellRule });
    await session.begin();
    await session.move(firstPointer, false);
    document.getElementById("hud-move").hidden = kind !== "move";
    document.getElementById("hud-measure").hidden = kind === "move";
  } catch (e) {
    console.error(`[${ID}]`, e);
    return close();
  }
  window.addEventListener("pointermove", (e) => { onMove(e); onPanMove(e); });
  window.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  window.focus();
  document.body.focus();
});

// se a camada for fechada por fora (Esc do próprio Owlbear, troca de cena), não deixa a régua pendurada
window.addEventListener("pagehide", () => { if (session && !session.done) session.cancel(); });
