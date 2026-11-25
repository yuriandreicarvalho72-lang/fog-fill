import "./visibility.js";
// Painel do menu de contexto "Clima": camadas do item selecionado, receitas prontas e relâmpago.
import OBR from "@owlbear-rodeo/sdk";
import { TYPES } from "./shaders.js";
import { LAYERS, FLASH, PRESETS, newLayer, presetLayers, applyTheme } from "./shared.js";

const $ = (id) => document.getElementById(id);
let itemIds = [];
let layers = [];
let open = null; // camada com os controles abertos

const typeLabel = (t) => TYPES.find((x) => x.id === t)?.label || t;

async function save() {
  const copy = JSON.parse(JSON.stringify(layers));
  await OBR.scene.items.updateItems(itemIds, (draft) => {
    for (const it of draft) {
      if (copy.length) it.metadata[LAYERS] = copy;
      else delete it.metadata[LAYERS];
    }
  });
}
let saveTimer = null;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 120); };

function typeOptions(sel) {
  const groups = [...new Set(TYPES.map((t) => t.group))];
  return groups.map((g) => `<optgroup label="${g}">${TYPES.filter((t) => t.group === g).map((t) => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${t.label}</option>`).join("")}</optgroup>`).join("");
}

function slider(l, key, label, min, max, step, fmt) {
  return `<label>${label} <output>${fmt(l[key])}</output>
    <input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${l[key]}" /></label>`;
}

function render() {
  $("flash").hidden = !layers.some((l) => l.type === "storm" && l.on !== false);
  $("empty").hidden = layers.length > 0;
  const box = $("layers");
  box.innerHTML = "";
  for (const l of layers) {
    const card = document.createElement("div");
    card.className = "card" + (l.on === false ? " off" : "");
    const isOpen = open === l.id;
    card.innerHTML = `
      <div class="head">
        <input type="checkbox" data-k="on" title="Ligar/desligar" ${l.on !== false ? "checked" : ""} />
        <span class="sw" style="background:${l.color}"></span>
        <button class="name" type="button">${typeLabel(l.type)}</button>
        <button class="x" type="button" title="Remover">✕</button>
      </div>
      ${isOpen ? `<div class="body">
        <select data-k="type">${typeOptions(l.type)}</select>
        <div class="row"><input type="color" data-k="color" value="${l.color}" />
          <label class="check"><input type="checkbox" data-k="above" ${l.above !== false ? "checked" : ""} /> Acima dos tokens</label></div>
        ${slider(l, "density", "Intensidade", 0.2, 2, 0.05, (v) => `${Math.round(v * 100)}%`)}
        ${slider(l, "speed", "Vento / velocidade", 0.1, 3, 0.05, (v) => `${(+v).toFixed(2)}×`)}
        <label>Direção do vento <output>${Math.round(l.dir)}°</output>
          <span class="dirrow"><span class="arrow" style="transform:rotate(${l.dir}deg)">➜</span>
          <input type="range" data-k="dir" min="0" max="359" step="1" value="${l.dir}" /></span></label>
        ${slider(l, "scale", "Tamanho", 0.5, 2.5, 0.05, (v) => `${(+v).toFixed(2)}×`)}
        ${slider(l, "opacity", "Opacidade", 0.05, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
      </div>` : ""}`;
    card.querySelector(".name").addEventListener("click", () => { open = isOpen ? null : l.id; render(); });
    card.querySelector(".x").addEventListener("click", () => { layers = layers.filter((x) => x !== l); save(); render(); });
    for (const el of card.querySelectorAll("[data-k]")) {
      const k = el.dataset.k;
      const read = () => (el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value);
      el.addEventListener("input", () => {
        l[k] = read();
        const out = el.closest("label")?.querySelector("output");
        if (out && el.type === "range") out.textContent = k === "dir" ? `${Math.round(l.dir)}°` : k === "density" || k === "opacity" ? `${Math.round(l[k] * 100)}%` : `${(+l[k]).toFixed(2)}×`;
        if (k === "dir") card.querySelector(".arrow").style.transform = `rotate(${l.dir}deg)`;
        if (k === "color") card.querySelector(".sw").style.background = l.color;
        saveSoon();
      });
      el.addEventListener("change", () => {
        l[k] = read();
        if (k === "type") {
          // trocar o tipo traz a cor e a direção típicas dele
          const t = TYPES.find((x) => x.id === l.type);
          if (t) { l.color = t.color; l.dir = t.dir ?? l.dir; }
          render();
        }
        if (k === "on") card.classList.toggle("off", !l.on);
        save();
        if (k === "on" || k === "type") render();
      });
    }
    box.appendChild(card);
  }
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  itemIds = (await OBR.player.getSelection()) || [];
  if (!itemIds.length) return;
  const [item] = await OBR.scene.items.getItems([itemIds[0]]);
  layers = Array.isArray(item?.metadata?.[LAYERS]) ? JSON.parse(JSON.stringify(item.metadata[LAYERS])) : [];
  open = layers[0]?.id ?? null;

  $("add").innerHTML = `<option value="">+ Adicionar clima…</option>${typeOptions("")}`;
  $("preset").innerHTML = `<option value="">Receitas prontas…</option>${PRESETS.map((p) => `<option>${p.name}</option>`).join("")}`;
  $("add").addEventListener("change", (e) => {
    if (!e.target.value) return;
    const l = newLayer(e.target.value);
    layers.push(l); open = l.id; e.target.value = "";
    save(); render();
  });
  $("preset").addEventListener("change", (e) => {
    if (!e.target.value) return;
    layers = presetLayers(e.target.value); open = layers[0]?.id ?? null; e.target.value = "";
    save(); render();
  });
  $("flash").addEventListener("click", () => OBR.broadcast.sendMessage(FLASH, {}, { destination: "ALL" }));
  $("clear").addEventListener("click", () => { layers = []; save(); render(); });
  render();
});
