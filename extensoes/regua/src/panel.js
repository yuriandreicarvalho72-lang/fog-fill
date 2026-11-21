import "./compact.js";
import OBR from "@owlbear-rodeo/sdk";
import { loadSettings, saveSettings, loadGrid, applyTheme } from "./shared.js";
import { formatDistance } from "./geom.js";
import { ROOM_VISION, ROOM_DEFAULTS } from "./vision.js";

const $ = (id) => document.getElementById(id);
let s = loadSettings();
let scale = null;

function render() {
  $("confirm").value = s.confirm;
  $("confirm-hint").textContent = s.confirm === "right"
    ? "Enquanto move, uma camada invisível cobre o mapa para receber o botão direito. A roda do mouse dá zoom e o botão do meio arrasta a câmera. Enter também confirma."
    : "Sem camada: confirme com duplo clique, Enter ou Espaço. Use se a camada atrapalhar no seu navegador.";
  $("k-confirm").innerHTML = s.confirm === "right" ? "<kbd>Direito</kbd>" : "<kbd>Duplo clique</kbd> / <kbd>Enter</kbd>";
  $("stepMs").value = s.stepMs;
  $("o-stepMs").textContent = `${s.stepMs} ms`;
  $("cellRule").value = s.cellRule;
  $("visionShared").checked = s.visionShared;
  $("visionAll").checked = s.visionAll;
  $("visionTo").value = s.visionTo;
  $("showCells").checked = s.showCells;
  $("pin").checked = s.pin;
  $("difficult").checked = s.difficult;
  $("areaWalls").checked = s.areaWalls !== false;
  for (const k of ["pinMeasure", "pinPath", "pinAreas"]) { $(k).checked = s[k]; $(k).disabled = !s.pin; }
  $("pin-what").classList.toggle("off", !s.pin);
  $("areaOpacity").value = s.areaOpacity;
  $("o-areaOpacity").textContent = `${Math.round(s.areaOpacity * 100)}%`;
  $("lineWidth").value = s.lineWidth;
  $("o-lineWidth").textContent = scale ? formatDistance(s.lineWidth, scale) : `${s.lineWidth} quadrado(s)`;
}
const set = (patch) => { s = { ...s, ...patch }; saveSettings(s); render(); };

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);
  if (await OBR.scene.isReady()) scale = (await loadGrid()).scale;
  render();

  // ajustes da sala (só o mestre): criaturas como cobertura
  if ((await OBR.player.getRole()) === "GM") {
    $("gm-vision").hidden = false;
    let room = { ...ROOM_DEFAULTS, ...((await OBR.room.getMetadata())[ROOM_VISION] || {}) };
    const draw = () => {
      $("charactersCover").checked = room.charactersCover;
      $("characterSolidity").value = room.characterSolidity;
      $("o-characterSolidity").textContent = `${Math.round(room.characterSolidity * 100)}%`;
    };
    const saveRoom = (patch) => { room = { ...room, ...patch }; draw(); OBR.room.setMetadata({ [ROOM_VISION]: room }); };
    draw();
    $("charactersCover").addEventListener("change", (e) => saveRoom({ charactersCover: e.target.checked }));
    $("characterSolidity").addEventListener("change", (e) => saveRoom({ characterSolidity: Number(e.target.value) }));
    $("characterSolidity").addEventListener("input", (e) => { $("o-characterSolidity").textContent = `${Math.round(e.target.value * 100)}%`; });
  }
});
render();

$("confirm").addEventListener("change", (e) => set({ confirm: e.target.value }));
$("stepMs").addEventListener("input", (e) => set({ stepMs: Number(e.target.value) }));
for (const k of ["visionShared", "visionAll"]) $(k).addEventListener("change", (e) => set({ [k]: e.target.checked }));
$("visionTo").addEventListener("change", (e) => set({ visionTo: e.target.value }));
$("cellRule").addEventListener("change", (e) => set({ cellRule: e.target.value }));
$("showCells").addEventListener("change", (e) => set({ showCells: e.target.checked }));
for (const k of ["pin", "pinMeasure", "pinPath", "pinAreas", "difficult", "areaWalls"]) $(k).addEventListener("change", (e) => set({ [k]: e.target.checked }));
// o atalho da barra também muda o ajuste: mantém o painel em dia
window.addEventListener("storage", () => { s = loadSettings(); render(); });
$("areaOpacity").addEventListener("input", (e) => set({ areaOpacity: Number(e.target.value) }));
$("lineWidth").addEventListener("input", (e) => set({ lineWidth: Number(e.target.value) }));
