import "./visibility.js";
import "./compact.js";
import OBR from "@owlbear-rodeo/sdk";
import { CFG, SETTINGS, DEFAULT_SETTINGS, DF_LIGHT, BLENDS, applyTheme } from "./shared.js";

const $ = (id) => document.getElementById(id);
let settings = { ...DEFAULT_SETTINGS };

async function save(patch) {
  settings = { ...settings, ...patch };
  await OBR.scene.setMetadata({ [SETTINGS]: settings });
}

function render() {
  $("blend").value = settings.blend;
  $("layer").value = settings.layer;
  $("shadows").checked = !!settings.shadows;
  $("smoke").checked = settings.smoke !== false;
  $("maxSegments").value = settings.maxSegments;
  $("o-maxSegments").textContent = settings.maxSegments;
  $("dirOffset").value = settings.dirOffset;
  $("o-dirOffset").textContent = `${settings.dirOffset}°`;
  $("posMode").value = settings.posMode || "local";
  $("maxLights").value = settings.maxLights;
  $("o-maxLights").textContent = settings.maxLights;
  $("debug").checked = !!settings.debug;
}

async function renderList() {
  const items = await OBR.scene.items.getItems((i) => i.metadata?.[DF_LIGHT] !== undefined);
  const colored = items.filter((i) => i.metadata?.[CFG]?.color);
  $("list").innerHTML = items.length
    ? `${items.length} luz(es) do Dynamic Fog, ${colored.length} com cor.` +
      colored.map((i) => `<div class="li"><span class="dot" style="background:${i.metadata[CFG].color}"></span>${i.name || "Token"}</div>`).join("")
    : "Nenhuma luz do Dynamic Fog na cena.";
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);

  for (const b of BLENDS) {
    const o = document.createElement("option"); o.value = b.id; o.textContent = b.label; $("blend").appendChild(o);
  }
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    document.querySelector("main").innerHTML = '<h1>Luz Colorida</h1><p class="hint">Só o mestre ajusta as cores.</p>';
    return;
  }
  const load = async () => {
    const md = await OBR.scene.getMetadata();
    settings = { ...DEFAULT_SETTINGS, ...(md[SETTINGS] || {}) };
    render();
    renderList();
  };
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  OBR.scene.items.onChange(() => renderList());

  $("blend").addEventListener("change", (e) => save({ blend: e.target.value }));
  $("layer").addEventListener("change", (e) => save({ layer: e.target.value }));
  $("shadows").addEventListener("change", (e) => save({ shadows: e.target.checked }));
  $("smoke").addEventListener("change", (e) => save({ smoke: e.target.checked }));
  $("maxSegments").addEventListener("input", (e) => { $("o-maxSegments").textContent = e.target.value; });
  $("maxSegments").addEventListener("change", (e) => save({ maxSegments: Number(e.target.value) }));
  $("dirOffset").addEventListener("input", (e) => { $("o-dirOffset").textContent = `${e.target.value}°`; });
  $("dirOffset").addEventListener("change", (e) => save({ dirOffset: Number(e.target.value) }));
  $("maxLights").addEventListener("input", (e) => { $("o-maxLights").textContent = e.target.value; });
  $("maxLights").addEventListener("change", (e) => save({ maxLights: Number(e.target.value) }));
  $("posMode").addEventListener("change", (e) => save({ posMode: e.target.value }));
  $("debug").addEventListener("change", (e) => save({ debug: e.target.checked }));
});
