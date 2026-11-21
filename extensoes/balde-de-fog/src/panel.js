import "./compact.js";
import OBR, { isImage } from "@owlbear-rodeo/sdk";
import { TOOL_ID, META, DEFAULTS, putMapFile, getMapFile, templateFromItem, loadSettings, saveSettings, cleanupLegacy, UNDO_CHANNEL } from "./shared.js";

const $ = (id) => document.getElementById(id);
const RANGES = ["tolerance", "smooth", "grow", "simplify", "minHole", "outlineSimplify"];
const fmt = { tolerance: (v) => v, smooth: (v) => `${v} px`, grow: (v) => `${v > 0 ? "+" : ""}${v} px`, simplify: (v) => `${v} px`, minHole: (v) => `${v} px²`, outlineSimplify: (v) => `${v} px` };

let settings = { ...DEFAULTS };

async function save(patch) {
  settings = { ...settings, ...patch };
  try {
    await saveSettings(OBR, TOOL_ID, patch);
    // confere se o Owlbear guardou mesmo (era aqui que a tolerância "travava")
    const back = await loadSettings(OBR, TOOL_ID);
    const bad = Object.keys(patch).filter((k) => typeof patch[k] !== "object" && back[k] !== patch[k]);
    if (bad.length) OBR.notification.show(`Balde de Fog: o Owlbear não guardou ${bad.join(", ")}. Recarregue a página (Ctrl+F5) e tente de novo.`, "ERROR");
  } catch (e) {
    console.error("[fog-fill]", e);
    OBR.notification.show("Balde de Fog: não consegui salvar o ajuste (veja o console).", "ERROR");
  }
}

function render() {
  for (const k of RANGES) {
    $(k).value = settings[k];
    $(`o-${k}`).textContent = fmt[k](settings[k]);
  }
  $("contiguous").checked = !!settings.contiguous;
  $("useDrawings").checked = !!settings.useDrawings;
  $("outline").value = settings.outline || (settings.walls ? "wall" : "none");
  $("smoke-box").style.display = $("outline").value === "smoke" ? "" : "none";
  const t = settings.smokeTemplate;
  $("smoke-info").textContent = t
    ? `Formato aprendido: ${t.type} na camada ${t.layer}\n` + Object.keys(t.metadata).map((k) => `• ${k} = ${JSON.stringify(t.metadata[k])}`).join("\n")
    : "Nenhum formato aprendido ainda.";
}

async function renderMaps() {
  const box = $("maps");
  const maps = await OBR.scene.items.getItems((i) => i.layer === "MAP" && isImage(i));
  box.innerHTML = "";
  if (!maps.length) { box.innerHTML = '<p class="hint">Nenhum mapa na cena.</p>'; return; }
  for (const m of maps) {
    const has = await getMapFile(m.image.url);
    const div = document.createElement("div");
    div.className = "map";
    div.innerHTML = `<div class="name">${m.name || "Mapa"}</div>
      <div class="hint">${m.image.width} × ${m.image.height} px ${has ? '<span class="ok">· arquivo carregado</span>' : ""}</div>
      <input type="file" accept="image/*" />`;
    div.querySelector("input").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const bmp = await createImageBitmap(file);
      const r1 = bmp.width / bmp.height, r2 = m.image.width / m.image.height;
      if (Math.abs(r1 - r2) > 0.01) {
        OBR.notification.show("Balde de Fog: a proporção desse arquivo não bate com o mapa. Use exatamente a mesma imagem.", "WARNING");
        return;
      }
      await putMapFile(m.image.url, file);
      OBR.notification.show("Balde de Fog: imagem do mapa carregada.", "SUCCESS");
      renderMaps();
    });
    box.appendChild(div);
  }
}

OBR.onReady(async () => {
  // cores do tema do Owlbear (evita texto claro em fundo claro)
  const applyTheme = (t) => {
    const r = document.documentElement.style;
    document.documentElement.classList.toggle("light", t.mode === "LIGHT");
    if (t.text?.primary) r.setProperty("--fg", t.text.primary);
    if (t.text?.secondary) r.setProperty("--muted", t.text.secondary);
  };
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);

  await cleanupLegacy(OBR, TOOL_ID, true);
  settings = await loadSettings(OBR, TOOL_ID);
  render();
  $("color").value = settings.color || (await OBR.scene.fog.getColor()) || "#222222";

  for (const k of RANGES) {
    $(k).addEventListener("input", () => { $(`o-${k}`).textContent = fmt[k](Number($(k).value)); });
    $(k).addEventListener("change", () => save({ [k]: Number($(k).value) }));
  }
  $("contiguous").addEventListener("change", (e) => save({ contiguous: e.target.checked }));
  $("useDrawings").addEventListener("change", (e) => save({ useDrawings: e.target.checked }));
  $("outline").addEventListener("change", async (e) => { await save({ outline: e.target.value }); render(); });
  $("learn").addEventListener("click", async () => {
    const sel = (await OBR.player.getSelection()) || [];
    if (sel.length !== 1) { OBR.notification.show("Balde de Fog: selecione exatamente uma obstrução do Smoke.", "WARNING"); return; }
    const [item] = await OBR.scene.items.getItems(sel);
    const t = item && templateFromItem(item);
    if (!t) {
      const keys = Object.keys(item?.metadata || {});
      $("smoke-info").textContent = `Isso não parece uma obstrução do Smoke.\nTipo: ${item?.type}, camada: ${item?.layer}\nChaves: ${keys.join(", ") || "(nenhuma)"}`;
      return;
    }
    await save({ smokeTemplate: t });
    render();
    OBR.notification.show("Balde de Fog: formato do Smoke aprendido.", "SUCCESS");
  });
  $("forget").addEventListener("click", async () => { await save({ smokeTemplate: null }); render(); });
  $("color").addEventListener("change", (e) => save({ color: e.target.value }));
  $("color-reset").addEventListener("click", async () => {
    await save({ color: "" });
    $("color").value = (await OBR.scene.fog.getColor()) || "#222222";
  });

  $("undo").addEventListener("click", () => OBR.broadcast.sendMessage(UNDO_CHANNEL, {}, { destination: "LOCAL" }));
  $("clear").addEventListener("click", async () => {
    const items = await OBR.scene.items.getItems((i) => i.metadata?.[META] === true);
    if (!items.length) return;
    await OBR.scene.items.deleteItems(items.map((i) => i.id));
    OBR.notification.show(`Balde de Fog: ${items.length} item(ns) apagado(s).`);
  });

  if (await OBR.scene.isReady()) renderMaps();
  OBR.scene.onReadyChange((ready) => ready && renderMaps());
  let sig = "";
  OBR.scene.items.onChange((items) => {
    const s = items.filter((i) => i.layer === "MAP" && isImage(i)).map((i) => i.id + i.image.url).join("|");
    if (s !== sig) { sig = s; renderMaps(); }
  });
});
