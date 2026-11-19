// Painel dos Estados (mestre): grupos, estados, membros e botões no mapa.
import OBR from "@owlbear-rodeo/sdk";
import { PROPS, capture } from "./core.js";
import { GROUPS, DATA, BUTTON, CH_SET, TRANSITIONS, newGroup, uid, applyTheme } from "./shared.js";

const $ = (id) => document.getElementById(id);
let groups = [];
let open = null;
let counts = new Map(); // grupoId -> nº de itens
let buttons = new Map(); // grupoId -> nº de botões
let memberList = new Map(); // grupoId -> [{ id, name, layer, visible }]
let buttonList = new Map(); // grupoId -> [{ id, name, layer, visible }]
let selected = new Set();   // o que está selecionado no mapa agora (para destacar na lista)

const LAYER_ICON = { MAP: "🗺️", CHARACTER: "🧍", MOUNT: "🐎", PROP: "📦", DRAWING: "✏️", FOG: "🌫️", NOTE: "📝", TEXT: "🔤", ATTACHMENT: "📎", POPOVER: "💬" };
const itemName = (it) => it.text?.plainText?.trim() || it.name || it.type;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let saveTimer = null;
function save(now = false) {
  clearTimeout(saveTimer);
  const go = () => OBR.scene.setMetadata({ [GROUPS]: JSON.parse(JSON.stringify(groups)) });
  if (now) return go();
  saveTimer = setTimeout(go, 300);
}
const setState = (g, to) => OBR.broadcast.sendMessage(CH_SET, { group: g.id, to }, { destination: "LOCAL" });
const selection = async () => (await OBR.player.getSelection()) || [];

function recount(items) {
  counts = new Map(); buttons = new Map(); memberList = new Map(); buttonList = new Map();
  const push = (m, gid, it) => { if (!m.has(gid)) m.set(gid, []); m.get(gid).push({ id: it.id, name: itemName(it), layer: it.layer, visible: it.visible !== false }); };
  for (const it of items) {
    for (const gid of Object.keys(it.metadata?.[DATA] || {})) { counts.set(gid, (counts.get(gid) || 0) + 1); push(memberList, gid, it); }
    const b = it.metadata?.[BUTTON];
    if (b) { buttons.set(b.group, (buttons.get(b.group) || 0) + 1); push(buttonList, b.group, it); }
  }
  for (const m of [memberList, buttonList]) for (const l of m.values()) l.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Lista clicável: clicar seleciona o item no mapa; ✕ tira do grupo (ou deixa de ser botão). */
function itemRows(list, kind) {
  if (!list?.length) return `<p class="hint">${kind === "btn" ? "Nenhum botão neste grupo." : "Nenhum item ainda: selecione no mapa e clique em + seleção."}</p>`;
  return `<div class="mlist">${list.map((m) => `
    <div class="mrow${selected.has(m.id) ? " sel" : ""}" data-pick="${m.id}" title="Clique para selecionar no mapa">
      <span class="ico">${LAYER_ICON[m.layer] || "•"}</span>
      <span class="mname">${esc(m.name)}</span>
      ${m.visible ? "" : '<span class="tag">escondido</span>'}
      <button type="button" class="x" data-un${kind}="${m.id}" title="${kind === "btn" ? "Deixa de ser botão" : "Tirar do grupo"}">✕</button>
    </div>`).join("")}</div>`;
}

/** Põe/tira itens do grupo. */
async function addMembers(g, ids) {
  if (!ids.length) return OBR.notification.show("Estados: selecione itens no mapa primeiro.", "WARNING");
  await OBR.scene.items.updateItems(ids, (d) => {
    for (const it of d) {
      const all = JSON.parse(JSON.stringify(it.metadata[DATA] || {}));
      all[g.id] = { ...(all[g.id] || {}), [g.current]: capture(it, g.props) };
      it.metadata[DATA] = all;
    }
  });
}
async function removeMembers(gid, ids) {
  if (!ids.length) return;
  await OBR.scene.items.updateItems(ids, (d) => {
    for (const it of d) {
      const all = JSON.parse(JSON.stringify(it.metadata[DATA] || {}));
      delete all[gid];
      it.metadata[DATA] = Object.keys(all).length ? all : undefined;
    }
  });
}
const members = async (gid) => (await OBR.scene.items.getItems()).filter((i) => i.metadata?.[DATA]?.[gid]);

function card(g) {
  const isOpen = open === g.id;
  const div = document.createElement("div");
  div.className = "card";
  const n = counts.get(g.id) || 0, nb = buttons.get(g.id) || 0;
  div.innerHTML = `
    <div class="head">
      <button type="button" class="name">${esc(g.name)}<small>${n} ite${n === 1 ? "m" : "ns"}${nb ? ` · ${nb} botão(ões)` : ""}</small></button>
      <button type="button" class="mini rec ${g.rec ? "on" : ""}" title="Editando: o que você mexe fica gravado no estado atual. Em jogo: nada é gravado.">${g.rec ? "✏️ Editando" : "▶ Em jogo"}</button>
    </div>
    <div class="states">
      <button type="button" class="mini" data-go="prev" title="Estado anterior">◀</button>
      ${g.states.map((s) => `<button type="button" class="chip st ${s.id === g.current ? "on" : ""}" data-go="${s.id}">${esc(s.name)}</button>`).join("")}
      <button type="button" class="mini" data-go="next" title="Próximo estado">▶</button>
    </div>
    ${isOpen ? `<div class="body">
      <input type="text" data-k="name" value="${esc(g.name)}" />
      <h3>Estados</h3>
      ${g.states.map((s) => `<div class="effect" data-sid="${s.id}">
        <div class="row"><input type="text" data-sk="name" value="${esc(s.name)}" />${g.states.length > 1 ? '<button type="button" class="x" data-del-state title="Apagar estado">✕</button>' : ""}</div>
        <input type="text" data-sk="note" value="${esc(s.note)}" placeholder="Mensagem na tela ao entrar (opcional)" />
      </div>`).join("")}
      <button type="button" data-add-state>+ Novo estado (começa igual ao atual)</button>
      <h3>O que muda entre os estados</h3>
      ${PROPS.map((p) => `<label class="check"><input type="checkbox" data-prop="${p.id}" ${g.props.includes(p.id) ? "checked" : ""} /> ${p.label}</label>`).join("")}
      <div class="row">
        <select data-k="transition">${TRANSITIONS.map(([v, l]) => `<option value="${v}" ${Number(g.transition) === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      </div>
      <label class="check"><input type="checkbox" data-k="wrap" ${g.wrap !== false ? "checked" : ""} /> Depois do último, ▶ volta para o primeiro</label>
      <h3>Itens do grupo</h3>
      <div class="row"><button type="button" data-mem="add">+ seleção</button><button type="button" data-mem="del">− seleção</button><button type="button" data-mem="show">selecionar todos</button></div>
      ${itemRows(memberList.get(g.id), "mem")}
      <h3>Botão no mapa</h3>
      <p class="hint">O item selecionado vira um botão: quando alguém clica nele (jogador ou você, em jogo), o grupo troca de estado. Ex.: uma alavanca.</p>
      <div class="row">
        <select data-btn-to><option value="next">próximo</option><option value="prev">anterior</option>${g.states.map((s) => `<option value="${s.id}">ir para: ${esc(s.name)}</option>`).join("")}</select>
        <button type="button" data-btn="make">Virar botão</button>
        <button type="button" class="mini" data-btn="undo" title="O item selecionado deixa de ser botão">desfazer</button>
      </div>
      ${itemRows(buttonList.get(g.id), "btn")}
      <div class="row"><button type="button" class="danger" data-del-group>Apagar grupo</button></div>
    </div>` : ""}`;

  div.querySelector(".name").addEventListener("click", () => { open = isOpen ? null : g.id; render(); });
  div.querySelector(".rec").addEventListener("click", () => { g.rec = !g.rec; save(true); render(); });
  for (const b of div.querySelectorAll("[data-go]")) b.addEventListener("click", () => setState(g, b.dataset.go));
  for (const el of div.querySelectorAll("[data-k]")) {
    el.addEventListener("change", () => {
      const k = el.dataset.k;
      g[k] = el.type === "checkbox" ? el.checked : k === "transition" ? Number(el.value) : el.value;
      save(); if (k === "name") render();
    });
  }
  for (const row of div.querySelectorAll("[data-sid]")) {
    const s = g.states.find((x) => x.id === row.dataset.sid);
    for (const el of row.querySelectorAll("[data-sk]")) el.addEventListener("change", () => { s[el.dataset.sk] = el.value; save(); render(); });
    row.querySelector("[data-del-state]")?.addEventListener("click", async () => {
      g.states = g.states.filter((x) => x !== s);
      const wasCurrent = g.current === s.id;
      if (wasCurrent) g.current = g.states[0].id;
      await save(true);
      const m = await members(g.id);
      if (m.length) await OBR.scene.items.updateItems(m.map((i) => i.id), (d) => {
        for (const it of d) { const all = JSON.parse(JSON.stringify(it.metadata[DATA])); delete all[g.id][s.id]; it.metadata[DATA] = all; }
      });
      if (wasCurrent) setState(g, g.current);
      render();
    });
  }
  div.querySelector("[data-add-state]")?.addEventListener("click", async () => {
    const s = { id: uid(), name: `Estado ${g.states.length + 1}`, note: "" };
    g.states.push(s);
    await save(true);
    setState(g, s.id); // entra no estado novo, que herda tudo como está agora
    render();
  });
  for (const cb of div.querySelectorAll("[data-prop]")) {
    cb.addEventListener("change", async () => {
      const p = cb.dataset.prop;
      g.props = cb.checked ? [...new Set([...g.props, p])] : g.props.filter((x) => x !== p);
      await save(true);
      if (cb.checked) { // grava já o valor atual da propriedade nova no estado atual
        const m = await members(g.id);
        if (m.length) await OBR.scene.items.updateItems(m.map((i) => i.id), (d) => {
          for (const it of d) {
            const all = JSON.parse(JSON.stringify(it.metadata[DATA]));
            all[g.id][g.current] = { ...(all[g.id][g.current] || {}), ...capture(it, [p]) };
            it.metadata[DATA] = all;
          }
        });
      }
    });
  }
  for (const b of div.querySelectorAll("[data-mem]")) {
    b.addEventListener("click", async () => {
      if (b.dataset.mem === "add") await addMembers(g, await selection());
      else if (b.dataset.mem === "del") await removeMembers(g.id, await selection());
      else { const m = await members(g.id); if (m.length) OBR.player.select(m.map((i) => i.id), true); }
    });
  }
  div.querySelector("[data-btn='make']")?.addEventListener("click", async () => {
    const sel = await selection();
    if (sel.length !== 1) return OBR.notification.show("Estados: selecione UM item para virar botão.", "WARNING");
    const to = div.querySelector("[data-btn-to]").value;
    await OBR.scene.items.updateItems(sel, (d) => { for (const it of d) it.metadata[BUTTON] = { group: g.id, to }; });
    OBR.notification.show("Botão criado. Em ▶ Em jogo, clicar nele troca o estado (no modo ✏️ Editando você pode selecionar à vontade).", "SUCCESS");
  });
  div.querySelector("[data-btn='undo']")?.addEventListener("click", async () => {
    const sel = await selection();
    if (sel.length) await OBR.scene.items.updateItems(sel, (d) => { for (const it of d) it.metadata[BUTTON] = undefined; });
  });
  for (const row of div.querySelectorAll("[data-pick]")) {
    row.addEventListener("click", (ev) => {
      if (ev.target.closest("button")) return;
      OBR.player.select([row.dataset.pick], true);
    });
  }
  for (const b of div.querySelectorAll("[data-unmem]")) b.addEventListener("click", () => removeMembers(g.id, [b.dataset.unmem]));
  for (const b of div.querySelectorAll("[data-unbtn]")) {
    b.addEventListener("click", () => OBR.scene.items.updateItems([b.dataset.unbtn], (d) => { for (const it of d) it.metadata[BUTTON] = undefined; }));
  }
  div.querySelector("[data-del-group]")?.addEventListener("click", async () => {
    const m = await members(g.id);
    await removeMembers(g.id, m.map((i) => i.id));
    groups = groups.filter((x) => x !== g);
    save(true); render();
  });
  return div;
}

function render() {
  const box = $("list");
  box.innerHTML = "";
  if (!groups.length) box.innerHTML = '<p class="hint">Nenhum grupo. Selecione no mapa o que muda junto (uma ponte, uma porta, as luzes de uma sala) e clique em <b>Novo grupo com a seleção</b>.</p>';
  for (const g of groups) box.appendChild(card(g));
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  if ((await OBR.player.getRole()) !== "GM") {
    document.querySelector("main").innerHTML = '<h1>Estados</h1><p class="hint">Só o mestre configura os estados.</p>';
    return;
  }
  const load = async () => {
    const md = await OBR.scene.getMetadata();
    groups = Array.isArray(md[GROUPS]) ? md[GROUPS] : [];
    recount(await OBR.scene.items.getItems());
    render();
  };
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  OBR.scene.onMetadataChange((md) => {
    const next = Array.isArray(md[GROUPS]) ? md[GROUPS] : [];
    if (JSON.stringify(next) === JSON.stringify(groups)) return;
    groups = next;
    // não redesenha enquanto você digita num campo
    if (!document.activeElement || !["INPUT", "SELECT"].includes(document.activeElement.tagName)) render();
  });
  let lastCount = "";
  const typing = () => document.activeElement && ["INPUT", "SELECT"].includes(document.activeElement.tagName);
  OBR.scene.items.onChange((items) => {
    recount(items);
    // redesenha só se a lista de itens mudou (nome, entrou/saiu, escondido), e não enquanto você digita
    const k = JSON.stringify([...memberList, ...buttonList]);
    if (k !== lastCount && !typing()) { lastCount = k; render(); }
  });
  // destaca na lista o que está selecionado no mapa
  OBR.player.onChange((p) => {
    const next = new Set(p.selection || []);
    if ([...next].join() === [...selected].join()) return;
    selected = next;
    for (const row of document.querySelectorAll("[data-pick]")) row.classList.toggle("sel", selected.has(row.dataset.pick));
  });
  $("new").addEventListener("click", async () => {
    const sel = await selection();
    const g = newGroup(`Grupo ${groups.length + 1}`);
    groups.push(g); open = g.id;
    await save(true);
    if (sel.length) await addMembers(g, sel);
    render();
  });
});
