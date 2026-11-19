import OBR from "@owlbear-rodeo/sdk";
import { TYPES } from "./shaders.js";
import { LAYERS, FLASH, applyTheme } from "./shared.js";

const $ = (id) => document.getElementById(id);
const label = (t) => TYPES.find((x) => x.id === t)?.label || t;

async function setAll(on) {
  const items = await OBR.scene.items.getItems((i) => Array.isArray(i.metadata?.[LAYERS]));
  await OBR.scene.items.updateItems(items.map((i) => i.id), (draft) => {
    for (const it of draft) for (const l of it.metadata[LAYERS]) l.on = on;
  });
}

async function renderList() {
  const items = await OBR.scene.items.getItems((i) => Array.isArray(i.metadata?.[LAYERS]) && i.metadata[LAYERS].length);
  $("list").innerHTML = items.length
    ? items.map((i) => `<div class="li"><b>${i.name || (i.layer === "MAP" ? "Mapa" : "Zona")}</b>: ${i.metadata[LAYERS].map((l) => `<span style="opacity:${l.on === false ? 0.5 : 1}"><span class="dot" style="background:${l.color}"></span> ${label(l.type)}</span>`).join(", ")}</div>`).join("")
    : "Nenhum clima na cena ainda.";
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  if ((await OBR.player.getRole()) !== "GM") {
    document.querySelector("main").innerHTML = '<h1>Clima</h1><p class="hint">Só o mestre ajusta o clima.</p>';
    return;
  }
  if (await OBR.scene.isReady()) renderList();
  OBR.scene.onReadyChange((r) => r && renderList());
  OBR.scene.items.onChange(() => renderList());
  $("flash").addEventListener("click", () => OBR.broadcast.sendMessage(FLASH, {}, { destination: "ALL" }));
  $("pause").addEventListener("click", () => setAll(false));
  $("resume").addEventListener("click", () => setAll(true));
});
