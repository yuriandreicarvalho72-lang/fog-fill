import OBR from "@owlbear-rodeo/sdk";
import { ANIMS } from "./shader.js";
import { CFG, PRESETS, applyTheme } from "./shared.js";

const $ = (id) => document.getElementById(id);

async function selectedIds() {
  return (await OBR.player.getSelection()) || [];
}

async function apply(patch) {
  const ids = await selectedIds();
  if (!ids.length) return;
  await OBR.scene.items.updateItems(ids, (items) => {
    for (const it of items) {
      const cur = it.metadata[CFG] || { intensity: Number($("intensity").value), color: $("color").value };
      it.metadata[CFG] = { ...cur, ...patch };
    }
  });
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);

  const box = $("swatches");
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.className = "sw";
    b.title = p.name;
    b.style.background = p.color;
    b.addEventListener("click", () => { $("color").value = p.color; apply({ color: p.color, intensity: Number($("intensity").value) }); });
    box.appendChild(b);
  }

  for (const a of ANIMS) {
    const o = document.createElement("option"); o.value = a.key; o.textContent = `Animação: ${a.label}`; $("anim").appendChild(o);
  }

  // estado atual do primeiro item selecionado
  const ids = await selectedIds();
  if (ids.length) {
    const [it] = await OBR.scene.items.getItems([ids[0]]);
    const cfg = it?.metadata?.[CFG];
    if (cfg?.color) $("color").value = cfg.color;
    if (cfg?.intensity) $("intensity").value = cfg.intensity;
    if (cfg?.anim) $("anim").value = cfg.anim;
    if (cfg?.speed) $("speed").value = cfg.speed;
  }
  $("o-speed").textContent = `${Number($("speed").value).toFixed(2)}×`;
  $("anim").addEventListener("change", (e) => apply({ anim: e.target.value }));
  $("speed").addEventListener("input", (e) => { $("o-speed").textContent = `${Number(e.target.value).toFixed(2)}×`; });
  $("speed").addEventListener("change", (e) => apply({ speed: Number(e.target.value) }));
  $("o-int").textContent = `${Math.round($("intensity").value * 100)}%`;

  $("color").addEventListener("input", (e) => apply({ color: e.target.value, intensity: Number($("intensity").value) }));
  $("intensity").addEventListener("input", (e) => { $("o-int").textContent = `${Math.round(e.target.value * 100)}%`; });
  $("intensity").addEventListener("change", (e) => apply({ intensity: Number(e.target.value) }));
  $("clear").addEventListener("click", async () => {
    const ids = await selectedIds();
    await OBR.scene.items.updateItems(ids, (items) => { for (const it of items) delete it.metadata[CFG]; });
  });
});
