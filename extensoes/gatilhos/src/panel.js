// Painel dos Gatilhos (mestre): criar, editar, testar e rearmar.
import OBR from "@owlbear-rodeo/sdk";
import { LIST, CH_FIRE, CH_LOG, CAUSES, ACTIONS, ANIMS, ESTADOS, newTrigger, newEffect, applyTheme } from "./shared.js";

const $ = (id) => document.getElementById(id);
let list = [];
let open = null;          // gatilho aberto
let itemNames = new Map();
let estados = [];         // grupos da extensão Estados
const logLines = [];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const nameOf = (id) => itemNames.get(id) || "(item apagado)";

async function refreshNames() {
  const items = await OBR.scene.items.getItems();
  itemNames = new Map(items.map((i) => [i.id, i.text?.plainText || i.name || i.type]));
}

let saveTimer = null;
function save(now = false) {
  clearTimeout(saveTimer);
  const go = () => OBR.scene.setMetadata({ [LIST]: JSON.parse(JSON.stringify(list)) });
  if (now) go(); else saveTimer = setTimeout(go, 250);
}

async function selection() { return (await OBR.player.getSelection()) || []; }

function chips(ids, key) {
  return `<div class="chips">${(ids || []).map((id) => `<span class="chip">${esc(nameOf(id))}</span>`).join("") || '<span class="hint">nenhum</span>'}
    <button type="button" class="mini" data-sel="${key}" title="Usar os itens selecionados no mapa">usar seleção</button></div>`;
}

function effectRow(t, e) {
  const a = ACTIONS.find((x) => x.id === e.action) || ACTIONS[0];
  const need = new Set(a.need);
  return `<div class="effect" data-eid="${e.id}">
    <div class="row">
      <select data-ek="action">${ACTIONS.map((x) => `<option value="${x.id}" ${x.id === e.action ? "selected" : ""}>${x.label}</option>`).join("")}</select>
      <button type="button" class="x" data-del-effect title="Remover efeito">✕</button>
    </div>
    ${need.has("targets") ? `<div class="sub">Itens: ${chips(e.targets, `e:${e.id}:targets`)}</div>` : ""}
    ${need.has("dest") ? `<div class="sub">Destino: ${chips(e.dest ? [e.dest] : [], `e:${e.id}:dest`)}</div>` : ""}
    ${need.has("text") ? `<input type="text" data-ek="text" value="${esc(e.text)}" placeholder="${e.action === "broadcast" ? "dados (texto ou JSON)" : "Texto que aparece na tela"}" />` : ""}
    ${need.has("channel") ? `<input type="text" data-ek="channel" value="${esc(e.channel)}" placeholder="canal (ex.: minha-extensao/evento)" />` : ""}
    ${need.has("audience") ? `<select data-ek="audience"><option value="all" ${e.audience !== "gm" ? "selected" : ""}>para todos</option><option value="gm" ${e.audience === "gm" ? "selected" : ""}>só para o mestre</option></select>` : ""}
    ${need.has("color") ? `<div class="row"><input type="color" data-ek="color" value="${esc(e.color)}" /><select data-ek="anim">${ANIMS.map(([v, l]) => `<option value="${v}" ${v === e.anim ? "selected" : ""}>${l}</option>`).join("")}</select></div>` : ""}
    ${need.has("trigger") ? `<select data-ek="trigger"><option value="">escolha o gatilho…</option>${list.filter((x) => x.id !== t.id).map((x) => `<option value="${x.id}" ${x.id === e.trigger ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}
    ${need.has("group") ? (estados.length ? `<div class="row"><select data-ek="group"><option value="">grupo…</option>${estados.map((g) => `<option value="${g.id}" ${g.id === e.group ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select>
      <select data-ek="to"><option value="next" ${e.to === "next" ? "selected" : ""}>próximo</option><option value="prev" ${e.to === "prev" ? "selected" : ""}>anterior</option>${(estados.find((g) => g.id === e.group)?.states || []).map((st) => `<option value="${st.id}" ${st.id === e.to ? "selected" : ""}>${esc(st.name)}</option>`).join("")}</select></div>`
      : '<span class="hint">Crie um grupo na extensão Estados primeiro.</span>') : ""}
    <label class="inline">depois de <input type="number" data-ek="delay" min="0" step="0.5" value="${e.delay || 0}" /> s</label>
  </div>`;
}

function card(t) {
  const isOpen = open === t.id;
  const cause = CAUSES.find((c) => c.id === t.cause)?.label || t.cause;
  const div = document.createElement("div");
  div.className = "card" + (t.armed ? "" : " off");
  div.innerHTML = `
    <div class="head">
      <input type="checkbox" data-k="armed" title="Armado" ${t.armed ? "checked" : ""} />
      <button type="button" class="name">${esc(t.name)}<small>${esc(cause)} · ${t.effects?.length || 0} efeito(s)${t.armed ? "" : " · desarmado"}</small></button>
      <button type="button" class="mini fire" title="Disparar agora (teste)">⚡</button>
    </div>
    ${isOpen ? `<div class="body">
      <input type="text" data-k="name" value="${esc(t.name)}" />
      <h3>Quando</h3>
      <select data-k="cause">${CAUSES.map((c) => `<option value="${c.id}" ${c.id === t.cause ? "selected" : ""}>${c.label}</option>`).join("")}</select>
      ${t.cause === "near" ? `<label class="inline">raio <input type="number" data-k="radius" min="0.5" step="0.5" value="${t.radius ?? 2}" /> quadrados</label>` : ""}
      ${t.cause !== "manual" ? `<div class="sub">Zona(s): ${chips(t.zones, "zones")}</div>` : ""}
      ${["enter", "leave", "near", "standAll"].includes(t.cause) ? `
      <select data-k="who"><option value="chars" ${t.who !== "list" ? "selected" : ""}>qualquer token (personagens e montarias)</option><option value="list" ${t.who === "list" ? "selected" : ""}>só estes tokens…</option></select>
      ${t.who === "list" ? `<div class="sub">${chips(t.tokens, "tokens")}</div>` : ""}
      <label class="check"><input type="checkbox" data-k="ignoreHidden" ${t.ignoreHidden !== false ? "checked" : ""} /> Tokens escondidos não ativam</label>` : ""}
      ${t.cause === "enter" ? `<label class="check" title="Em vez de ir até onde o jogador soltou, o token para no meio do caminho, em cima da zona. Vale para a Régua e para o arrasto."><input type="checkbox" data-k="halt" ${t.halt ? "checked" : ""} /> Parar o token em cima da zona (corta o resto do movimento)</label>` : ""}
      <div class="row">
        <select data-k="once"><option value="1" ${t.once ? "selected" : ""}>dispara uma vez (desarma)</option><option value="0" ${!t.once ? "selected" : ""}>dispara sempre</option></select>
        <label class="inline">atraso <input type="number" data-k="delay" min="0" step="0.5" value="${t.delay || 0}" /> s</label>
      </div>
      <h3>Então</h3>
      ${(t.effects || []).map((e) => effectRow(t, e)).join("")}
      <div class="row"><button type="button" data-add-effect>+ efeito</button><button type="button" class="danger" data-del-trigger>Apagar gatilho</button></div>
    </div>` : ""}`;

  div.querySelector(".name").addEventListener("click", () => { open = isOpen ? null : t.id; render(); });
  div.querySelector(".fire").addEventListener("click", () => OBR.broadcast.sendMessage(CH_FIRE, { id: t.id }, { destination: "LOCAL" }));
  for (const el of div.querySelectorAll("[data-k]")) {
    const k = el.dataset.k;
    el.addEventListener("change", () => {
      let v = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
      if (k === "once") v = v === "1";
      t[k] = v;
      save(k === "armed");
      if (["cause", "who", "armed", "name"].includes(k)) render();
    });
  }
  for (const btn of div.querySelectorAll("[data-sel]")) {
    btn.addEventListener("click", async () => {
      const sel = await selection();
      const key = btn.dataset.sel;
      if (key === "zones") t.zones = sel;
      else if (key === "tokens") t.tokens = sel;
      else {
        const [, eid, field] = key.split(":");
        const e = t.effects.find((x) => x.id === eid);
        if (field === "dest") e.dest = sel[0] || null; else e.targets = sel;
      }
      if (!sel.length) OBR.notification.show("Gatilhos: selecione itens no mapa primeiro (a seleção ficou vazia).", "WARNING");
      await refreshNames();
      save(true); render();
    });
  }
  for (const row of div.querySelectorAll(".effect")) {
    const e = t.effects.find((x) => x.id === row.dataset.eid);
    for (const el of row.querySelectorAll("[data-ek]")) {
      el.addEventListener("change", () => {
        e[el.dataset.ek] = el.type === "number" ? Number(el.value) : el.value;
        save();
        if (el.dataset.ek === "action" || el.dataset.ek === "group") render();
      });
    }
    row.querySelector("[data-del-effect]").addEventListener("click", () => { t.effects = t.effects.filter((x) => x !== e); save(true); render(); });
  }
  div.querySelector("[data-add-effect]")?.addEventListener("click", () => { t.effects.push(newEffect("notify")); save(true); render(); });
  div.querySelector("[data-del-trigger]")?.addEventListener("click", () => { list = list.filter((x) => x !== t); save(true); render(); });
  return div;
}

function render() {
  const box = $("list");
  box.innerHTML = "";
  if (!list.length) box.innerHTML = '<p class="hint">Nenhum gatilho. Selecione no mapa a zona (uma armadilha escondida, uma forma, uma linha de "fio") e clique em <b>Novo gatilho com a seleção</b>, ou use o botão direito → <b>Criar gatilho com esta zona</b>.</p>';
  for (const t of list) box.appendChild(card(t));
  $("log").innerHTML = logLines.length ? logLines.map((l) => `<div>${esc(l)}</div>`).join("") : '<span class="hint">Nada disparou ainda.</span>';
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  if ((await OBR.player.getRole()) !== "GM") {
    document.querySelector("main").innerHTML = '<h1>Gatilhos</h1><p class="hint">Só o mestre configura os gatilhos. Eles funcionam sozinhos: é só mover o seu token.</p>';
    return;
  }
  const load = async () => {
    await refreshNames();
    const md = await OBR.scene.getMetadata();
    list = Array.isArray(md[LIST]) ? md[LIST] : [];
    estados = Array.isArray(md[ESTADOS]) ? md[ESTADOS] : [];
    render();
  };
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  OBR.scene.onMetadataChange((md) => {
    const next = Array.isArray(md[LIST]) ? md[LIST] : [];
    const est = Array.isArray(md[ESTADOS]) ? md[ESTADOS] : [];
    if (JSON.stringify(est.map((g) => [g.id, g.name, g.states])) !== JSON.stringify(estados.map((g) => [g.id, g.name, g.states]))) { estados = est; if (JSON.stringify(next) === JSON.stringify(list)) render(); }
    // só redesenha se mudou por fora (ex.: o motor desarmou um gatilho)
    if (JSON.stringify(next) !== JSON.stringify(list)) { list = next; render(); }
  });
  OBR.broadcast.onMessage(CH_LOG, (e) => {
    const d = new Date(e.data.at);
    logLines.unshift(`${d.toLocaleTimeString().slice(0, 5)}  ${e.data.text}`);
    logLines.length = Math.min(logLines.length, 8);
    render();
  });
  $("new").addEventListener("click", async () => {
    const sel = await selection();
    await refreshNames();
    const t = newTrigger(sel, sel.length === 1 ? `Gatilho: ${nameOf(sel[0])}` : `Gatilho ${list.length + 1}`);
    list.push(t); open = t.id; save(true); render();
  });
  $("rearm").addEventListener("click", () => { for (const t of list) t.armed = true; save(true); render(); });
});
