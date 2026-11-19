// Painel dos Gatilhos (mestre): criar, editar, testar e rearmar.
import OBR from "@owlbear-rodeo/sdk";
import { LIST, CH_FIRE, CH_LOG, CAUSES, ACTIONS, ANIMS, ESTADOS, WHO, ACTOR, MOVING, CAN_USE, ARSENAL_WEAPONS, ARSENAL_MODES, TROCADOR_IMAGES, VIG_CAM, VIG_NODE_META, NODE_STATES, VISION_MODES, CHARGE_OPS, isInteract, isToken, newTrigger, newEffect, applyTheme } from "./shared.js";
import { zoneShape, pickReacher } from "./engine.js";
import { tryInteract, usableTriggers } from "./interact.js";

const $ = (id) => document.getElementById(id);
let list = [];
let open = null;          // gatilho aberto
let itemNames = new Map();
let itemWeapons = new Map(); // armas do Arsenal de cada token
let itemImages = new Map();  // nomes das imagens do Trocador de cada item
let itemVig = new Map();     // câmeras e nós da Vigilância: id -> { cam, node }
let estados = [];         // grupos da extensão Estados
const logLines = [];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const nameOf = (id) => (id === ACTOR ? "⚑ quem ativou" : itemNames.get(id) || "(item apagado)");

async function refreshNames() {
  const items = await OBR.scene.items.getItems();
  itemNames = new Map(items.map((i) => [i.id, i.text?.plainText || i.name || i.type]));
  itemWeapons = new Map(items.map((i) => [i.id, i.metadata?.[ARSENAL_WEAPONS] || []]));
  itemImages = new Map(items.filter((i) => Array.isArray(i.metadata?.[TROCADOR_IMAGES])).map((i) => [i.id, i.metadata[TROCADOR_IMAGES].map((v) => v.name)]));
  itemVig = new Map(items.filter((i) => i.metadata?.[VIG_CAM] || i.metadata?.[VIG_NODE_META]).map((i) => [i.id, { cam: !!i.metadata[VIG_CAM], node: !!i.metadata[VIG_NODE_META] }]));
}

let saveTimer = null;
function save(now = false) {
  clearTimeout(saveTimer);
  const go = () => OBR.scene.setMetadata({ [LIST]: JSON.parse(JSON.stringify(list)) });
  if (now) go(); else saveTimer = setTimeout(go, 250);
}

async function selection() { return (await OBR.player.getSelection()) || []; }

function chips(ids, key, actor = false) {
  return `<div class="chips">${(ids || []).map((id) => `<span class="chip${id === ACTOR ? " actor" : ""}">${esc(nameOf(id))}</span>`).join("") || '<span class="hint">nenhum</span>'}
    <button type="button" class="mini" data-sel="${key}" title="Usar os itens selecionados no mapa">usar seleção</button>
    ${actor ? `<button type="button" class="mini" data-actor="${key}" title="Inclui (ou tira) quem ativou o gatilho">${(ids || []).includes(ACTOR) ? "− quem ativou" : "+ quem ativou"}</button>` : ""}</div>`;
}

/** Arma, modo e acerto do disparo do Arsenal. */
function arsenalRow(e) {
  if (!e.shooter) return '<span class="hint">Escolha o atirador: selecione o token (torreta, guarda…) e clique em "usar seleção".</span>';
  const ws = itemWeapons.get(e.shooter) || [];
  if (!ws.length) return '<span class="hint warn">⚠ Esse token não tem armas no Arsenal. Abra o Arsenal, use-o como atirador e adicione uma arma.</span>';
  const w = ws.find((x) => x.id === e.weapon) || ws[0];
  return `<select data-ek="weapon">${ws.map((x) => `<option value="${x.id}" ${x.id === w.id ? "selected" : ""}>${esc(x.name)}${x.mag != null ? ` (${x.ammo ?? 0}/${x.mag})` : ""}</option>`).join("")}</select>
    <div class="row">
      <select data-ek="mode"><option value="">modo da arma</option>${(w.modes || []).map((m) => `<option value="${m}" ${m === e.mode ? "selected" : ""}>${ARSENAL_MODES[m] || m}</option>`).join("")}</select>
      <select data-ek="hit"><option value="hit" ${e.hit !== "miss" && e.hit !== "half" ? "selected" : ""}>acerta</option><option value="miss" ${e.hit === "miss" ? "selected" : ""}>erra</option><option value="half" ${e.hit === "half" ? "selected" : ""}>50% de chance</option></select>
    </div>${(e.targets || []).length ? "" : '<span class="hint warn">⚠ Sem alvo: use "+ quem ativou" para atirar em quem pisou na zona.</span>'}
    <span class="hint">Usa a munição da arma. Precisa da extensão Arsenal instalada.</span>`;
}

/** Qual imagem o Trocador usa: próxima/anterior ou uma pelo nome (nomes das imagens dos alvos). */
function imageRow(e) {
  const tg = e.targets || [];
  const pool = tg.includes(ACTOR) ? [...itemImages.values()] : tg.map((id) => itemImages.get(id) || []);
  const names = [...new Set(pool.flat())];
  const cur = e.image || "next";
  const known = ["next", "prev", ...names].includes(cur);
  return `<div class="row"><span class="hint">Imagem:</span><select data-ek="image">
      <option value="next" ${cur === "next" ? "selected" : ""}>próxima</option>
      <option value="prev" ${cur === "prev" ? "selected" : ""}>anterior</option>
      ${names.map((n) => `<option value="${esc(n)}" ${n === cur ? "selected" : ""}>${esc(n)}</option>`).join("")}
      ${known ? "" : `<option value="${esc(cur)}" selected>${esc(cur)} (nenhum alvo tem)</option>`}
    </select></div>
    ${!names.length && tg.length && !tg.includes(ACTOR) ? '<span class="hint warn">⚠ Esses itens ainda não têm imagens no Trocador (botão direito no item → Trocar imagem → + imagens).</span>' : ""}
    ${tg.length ? "" : '<span class="hint warn">⚠ Sem alvo: escolha os itens ou "+ quem ativou".</span>'}
    <span class="hint">Itens com uma imagem de mesmo nome trocam juntos. Precisa da extensão Trocador instalada.</span>`;
}

/** Ligar/desligar câmera e estado do nó (Vigilância). */
function vigRow(e, kind) {
  const tg = (e.targets || []).filter((id) => id !== ACTOR);
  const bad = tg.length && !tg.some((id) => (kind === "power" ? itemVig.get(id)?.cam : itemVig.get(id)));
  const sel = kind === "power"
    ? `<select data-ek="power"><option value="off" ${e.power !== "on" ? "selected" : ""}>desligar</option><option value="on" ${e.power === "on" ? "selected" : ""}>ligar</option></select>`
    : `<select data-ek="nodeState">${NODE_STATES.map(([v, l]) => `<option value="${v}" ${(e.nodeState || "hackeado") === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  return `<div class="row"><span class="hint">${kind === "power" ? "Câmera:" : "Novo estado:"}</span>${sel}</div>
    ${bad ? `<span class="hint warn">⚠ ${kind === "power" ? "Nenhum desses itens é câmera" : "Nenhum desses itens é câmera ou nó da Matriz"} (botão direito no item → ${kind === "power" ? "Virar câmera" : "Virar nó da Matriz"}).</span>` : ""}
    ${(e.targets || []).length ? "" : '<span class="hint warn">⚠ Sem alvo: escolha as câmeras ou nós.</span>'}
    <span class="hint">Precisa da extensão Vigilância instalada.</span>`;
}

/** Mudar de andar: prédio do Estados, para onde, e se quem ativou vai junto. */
function floorRow(e) {
  const bs = estados.filter((g) => g.kind === "floors");
  if (!bs.length) return '<span class="hint">Crie um prédio na extensão Estados primeiro (🏢 Novo prédio).</span>';
  const b = bs.find((g) => g.id === e.group);
  return `<div class="row"><select data-ek="group"><option value="">prédio…</option>${bs.map((g) => `<option value="${g.id}" ${g.id === e.group ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select>
      <select data-ek="to"><option value="next" ${e.to === "next" ? "selected" : ""}>subir um andar</option><option value="prev" ${e.to === "prev" ? "selected" : ""}>descer um andar</option>${(b?.states || []).map((st) => `<option value="${st.id}" ${st.id === e.to ? "selected" : ""}>ir para: ${esc(st.name)}</option>`).join("")}</select></div>
    <label class="check"><input type="checkbox" data-ekb="carry" ${e.carry !== false ? "checked" : ""} /> Levar quem ativou junto (quem usou a escada/elevador)</label>
    <span class="hint">Para escada ou elevador: causa "Interagir" no objeto da escada. Precisa da extensão Estados.</span>`;
}

/** Ligar/desligar visão especial (térmica, baixa luz) dos tokens. */
function visionRow(e) {
  return `<div class="row"><select data-ek="visionMode">${VISION_MODES.map(([v, l]) => `<option value="${v}" ${(e.visionMode || "termica") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select data-ek="visionOn"><option value="on" ${e.visionOn !== "off" ? "selected" : ""}>ligar</option><option value="off" ${e.visionOn === "off" ? "selected" : ""}>desligar</option></select></div>
    ${(e.targets || []).length ? "" : '<span class="hint warn">⚠ Sem alvo: escolha os tokens ou "+ quem ativou".</span>'}
    <span class="hint">Só vale para tokens com esse modo (marcado na Vigilância). Ex.: granada de luz desliga a baixa luz. Precisa da extensão Vigilância.</span>`;
}

/** Detonar ou desarmar uma carga do Arsenal. */
function chargeRow(e) {
  return `<div class="row"><span class="hint">Carga:</span><select data-ek="chargeOp">${CHARGE_OPS.map(([v, l]) => `<option value="${v}" ${(e.chargeOp || "detonar") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    ${(e.targets || []).length ? "" : '<span class="hint warn">⚠ Sem alvo: escolha a carga (você vê as escondidas) ou o objeto onde ela está colada.</span>'}
    <span class="hint">Vale para a carga escolhida e para as cargas coladas nos itens escolhidos. Precisa da extensão Arsenal.</span>`;
}

function effectRow(t, e) {
  const a = ACTIONS.find((x) => x.id === e.action) || ACTIONS[0];
  const need = new Set(a.need);
  return `<div class="effect" data-eid="${e.id}">
    <div class="row">
      <select data-ek="action">${ACTIONS.map((x) => `<option value="${x.id}" ${x.id === e.action ? "selected" : ""}>${x.label}</option>`).join("")}</select>
      <button type="button" class="x" data-del-effect title="Remover efeito">✕</button>
    </div>
    ${need.has("shooter") ? `<div class="sub">Atirador: ${chips(e.shooter ? [e.shooter] : [], `e:${e.id}:shooter`)}</div>` : ""}
    ${need.has("targets") ? `<div class="sub">${e.action === "arsenal" ? "Alvos" : "Itens"}: ${chips(e.targets, `e:${e.id}:targets`, true)}</div>` : ""}
    ${need.has("weapon") ? arsenalRow(e) : ""}
    ${need.has("image") ? imageRow(e) : ""}
    ${need.has("power") ? vigRow(e, "power") : ""}
    ${need.has("nodeState") ? vigRow(e, "nodeState") : ""}
    ${need.has("floor") ? floorRow(e) : ""}
    ${need.has("vision") ? visionRow(e) : ""}
    ${need.has("chargeOp") ? chargeRow(e) : ""}
    ${need.has("who") ? `<div class="row"><span class="hint">Quem vai:</span><select data-ek="who">${WHO.map(([v, l]) => `<option value="${v}" ${(e.who || "actor") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>` : ""}
    ${need.has("who") && (e.who || "actor") === "actor" && !MOVING.includes(t.cause) && t.cause !== "standAll" ? '<span class="hint">Sem movimento, "quem ativou" = quem está em cima da zona; se ela estiver vazia, os tokens que você tiver selecionado.</span>' : ""}
    ${need.has("moving") && !MOVING.includes(t.cause) ? '<span class="hint warn">⚠ Barrar só funciona com Entrar, Sair ou Chegar perto (precisa de alguém se movendo).</span>' : ""}
    ${need.has("dest") ? `<div class="sub">Destino: ${chips(e.dest ? [e.dest] : [], `e:${e.id}:dest`)}</div>` : ""}
    ${need.has("text") ? `<input type="text" data-ek="text" value="${esc(e.text)}" placeholder="${e.action === "broadcast" ? "dados (texto ou JSON)" : "Texto na tela ({quem} = nome de quem ativou)"}" />` : ""}
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
      <button type="button" class="mini fire" title="Disparar agora. Sem movimento, &quot;quem ativou&quot; = quem está em cima da zona ou os tokens que você tiver selecionado.">⚡</button>
    </div>
    ${isOpen ? `<div class="body">
      <input type="text" data-k="name" value="${esc(t.name)}" />
      <h3>Quando</h3>
      <select data-k="cause">${CAUSES.map((c) => `<option value="${c.id}" ${c.id === t.cause ? "selected" : ""}>${c.label}</option>`).join("")}</select>
      ${t.cause === "near" ? `<label class="inline">raio <input type="number" data-k="radius" min="0.5" step="0.5" value="${t.radius ?? 2}" /> quadrados</label>` : ""}
      <div class="sub">${t.cause === "interact" ? "Objeto(s) que o jogador usa" : t.cause === "cameraSees" ? "Câmera(s)" : t.cause === "nodeState" ? "Nó(s) da Matriz" : t.cause === "destroyed" ? "Objeto(s) destrutível(is)" : t.cause === "chargeBlew" ? "Perto de (vazio = qualquer carga)" : `Zona(s)${t.cause === "manual" ? " (opcional: quem estiver em cima conta como quem ativou)" : ""}`}: ${chips(t.zones, "zones")}</div>
      ${t.cause === "cameraSees" ? `<p class="hint">Dispara quando a câmera (extensão Vigilância) vê alguém entrar no cone. "Quem ativou" = quem foi visto.</p>
        ${(t.zones || []).length && !(t.zones || []).some((id) => itemVig.get(id)?.cam) ? '<span class="hint warn">⚠ Nenhum desses itens é câmera (botão direito → Virar câmera).</span>' : ""}` : ""}
      ${t.cause === "destroyed" ? '<p class="hint">Dispara quando o objeto quebra no Arsenal (tiros pesados, explosões, cargas). "Quem ativou" = quem atirou ou plantou a carga.</p>' : ""}
      ${t.cause === "chargeBlew" ? '<p class="hint">Dispara quando uma carga do Arsenal explode (perto de um dos itens escolhidos, ou qualquer uma se a lista estiver vazia). "Quem ativou" = os tokens pegos na explosão (ou quem plantou, se ninguém foi pego).</p>' : ""}
      ${t.cause === "nodeState" ? `<div class="row"><span class="hint">Quando ficar:</span><select data-k="nodeTo"><option value="">qualquer estado</option>${NODE_STATES.map(([v, l]) => `<option value="${v}" ${t.nodeTo === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        ${(t.zones || []).length && !(t.zones || []).some((id) => itemVig.get(id)) ? '<span class="hint warn">⚠ Nenhum desses itens é nó da Matriz (botão direito → Virar nó da Matriz).</span>' : ""}` : ""}
      ${t.cause === "interact" ? `
      <p class="hint">O jogador usa clicando no objeto, pelo botão direito → Interagir, ou pela lista no painel dele. "Quem ativou" = o personagem dele mais perto. Arrastar o objeto não funciona: ele volta para o lugar.</p>
      <div class="row">
        <label class="inline">alcance <input type="number" data-k="reach" min="0" step="1" value="${t.reach ?? 1}" /> quadrado(s)</label>
        <span class="hint">(0 = de qualquer lugar)</span>
      </div>
      <div class="row"><span class="hint">Quem pode usar:</span><select data-k="canUse">${CAN_USE.map(([v, l]) => `<option value="${v}" ${(t.canUse || "all") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="row">
        <label class="check"><input type="checkbox" data-k="glow" ${t.glow !== false ? "checked" : ""} /> Destacar com brilho</label>
        <input type="color" data-k="glowColor" value="${esc(t.glowColor || "#ffd34d")}" title="Cor do brilho" />
      </div>` : ""}
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
        if (field === "dest") e.dest = sel[0] || null;
        else if (field === "shooter") { e.shooter = sel[0] || ""; e.weapon = ""; e.mode = ""; }
        else e.targets = (e.targets || []).includes(ACTOR) ? [ACTOR, ...sel] : sel;
      }
      if (!sel.length) OBR.notification.show("Gatilhos: selecione itens no mapa primeiro (a seleção ficou vazia).", "WARNING");
      await refreshNames();
      save(true); render();
    });
  }
  for (const btn of div.querySelectorAll("[data-actor]")) {
    btn.addEventListener("click", () => {
      const [, eid] = btn.dataset.actor.split(":");
      const e = t.effects.find((x) => x.id === eid);
      e.targets = (e.targets || []).includes(ACTOR) ? e.targets.filter((x) => x !== ACTOR) : [ACTOR, ...(e.targets || [])];
      save(true); render();
    });
  }
  for (const row of div.querySelectorAll(".effect")) {
    const e = t.effects.find((x) => x.id === row.dataset.eid);
    for (const el of row.querySelectorAll("[data-ek]")) {
      el.addEventListener("change", () => {
        e[el.dataset.ek] = el.type === "number" ? Number(el.value) : el.value;
        save();
        if (el.dataset.ek === "weapon") e.mode = "";
        if (["action", "group", "who", "weapon"].includes(el.dataset.ek)) render();
      });
    }
    for (const el of row.querySelectorAll("[data-ekb]")) el.addEventListener("change", () => { e[el.dataset.ekb] = el.checked; save(); });
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
  if ((await OBR.player.getRole()) !== "GM") return playerView();
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

// ---------- painel do jogador: objetos que ele pode usar ----------
async function playerView() {
  const main = document.querySelector("main");
  main.innerHTML = `<h1>Gatilhos</h1><p class="hint">Objetos com brilho na cena podem ser usados: clique neles, use o botão direito → Interagir, ou o botão abaixo. Você precisa de um personagem perto.</p><div id="usable"></div>`;
  const draw = async () => {
    const [md, items, dpi, userId] = await Promise.all([OBR.scene.getMetadata(), OBR.scene.items.getItems(), OBR.scene.grid.getDpi().catch(() => 150), OBR.player.getId()]);
    const triggers = Array.isArray(md[LIST]) ? md[LIST] : [];
    const mine = items.filter((i) => isToken(i) && i.createdUserId === userId);
    const ids = [...new Set(triggers.filter(isInteract).flatMap((t) => t.zones || []))];
    const rows = [];
    for (const id of ids) {
      const it = items.find((i) => i.id === id);
      if (!it || it.visible === false) continue;
      const trs = usableTriggers(triggers, id, "PLAYER");
      if (!trs.length) continue;
      const reach = Math.max(...trs.map((t) => (t.reach > 0 ? t.reach : Infinity)));
      const ok = pickReacher(mine, zoneShape(it, dpi), reach === Infinity ? 0 : reach, dpi).ok;
      rows.push({ id, name: it.text?.plainText?.trim() || it.name || "objeto", ok });
    }
    rows.sort((a, b) => (b.ok - a.ok) || a.name.localeCompare(b.name, "pt-BR"));
    $("usable").innerHTML = rows.length ? `<div class="mlist">${rows.map((r) => `
      <div class="mrow"><span class="mname">${esc(r.name)}</span><span class="tag">${r.ok ? "ao alcance" : "longe"}</span>
      <button type="button" class="mini" data-use="${r.id}" ${r.ok ? "" : "disabled"}>Usar</button></div>`).join("")}</div>`
      : '<p class="hint">Nada para usar por aqui.</p>';
    for (const b of document.querySelectorAll("[data-use]")) b.addEventListener("click", () => tryInteract(b.dataset.use));
  };
  if (await OBR.scene.isReady()) draw();
  OBR.scene.onReadyChange((r) => r && draw());
  OBR.scene.onMetadataChange(() => draw());
  let t = null;
  OBR.scene.items.onChange(() => { clearTimeout(t); t = setTimeout(draw, 150); });
}
