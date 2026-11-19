// Painel da Vigilância. Mestre: monta câmeras e nós, decide pedidos de hack, diz quem vê a Matriz.
// Jogador com commlink/cyberdeck: vê os nós e pede para hackear, pôr em loop, desativar ou reativar.
import OBR from "@owlbear-rodeo/sdk";
import { CAM, NODE, DECK, STATES, TYPES, ACTIONS, STATE_COLOR, camOf, nodeOf, hasAccess, iconOf, stateLabel, isToken } from "./core.js";
import { PENDING, CH_REQ, CH_RES, getPrefs, setPrefs, getAccess, setAccess, makeCamera, makeNode, editCam, editNode, setState, decide, itemName, applyTheme } from "./ops.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let role = "PLAYER", myId = "";
let items = [], sel = [], pending = [], access = { players: [], autoApprove: false }, players = [];
const asked = new Map(); // jogador: nó -> ação pedida (para mostrar "aguardando")

const busy = () => ["INPUT", "SELECT"].includes(document.activeElement?.tagName) && document.activeElement.type !== "checkbox";
const chip = (st) => `<span class="chip" style="background:${STATE_COLOR[st] || "#888"};color:#111">${esc(stateLabel(st))}</span>`;

async function load() {
  [items, sel, players] = await Promise.all([OBR.scene.items.getItems(), OBR.player.getSelection().then((s) => s || []), OBR.party.getPlayers().catch(() => [])]);
  const md = await OBR.scene.getMetadata();
  pending = Array.isArray(md[PENDING]) ? md[PENDING] : [];
  access = await getAccess();
  render();
}
const render = () => (role === "GM" ? renderGM() : renderPlayer());

// ---------------- mestre ----------------
function camForm(it) {
  const c = camOf(it);
  const n = nodeOf(it);
  const ign = (c.ignore || []).map((id) => esc(itemName(items.find((i) => i.id === id)))).join(", ");
  return `<div class="effect">
    <h3>📷 Câmera</h3>
    <label>Abertura <output>${c.angle}°</output><input type="range" data-cam="angle" min="10" max="360" step="5" value="${c.angle}" /></label>
    <label>Alcance <output>${c.range} quadrados</output><input type="range" data-cam="range" min="1" max="40" step="1" value="${c.range}" /></label>
    <label>Direção <output>${c.dir}°</output><input type="range" data-cam="dir" min="-180" max="180" step="5" value="${c.dir}" /></label>
    <label>Varredura (vai e volta) <output>${c.sweep ? `${c.sweep}°` : "parada"}</output><input type="range" data-cam="sweep" min="0" max="180" step="5" value="${c.sweep}" /></label>
    ${c.sweep ? `<label class="inline">uma ida e volta a cada <input type="number" data-cam="period" min="1" step="1" value="${c.period}" /> s</label>` : ""}
    <p class="hint">A direção gira junto com o item: girar o token da câmera também gira o cone.</p>
    <label class="check"><input type="checkbox" data-camb="showAll" ${c.showAll ? "checked" : ""} /> Jogadores também veem o cone</label>
    <label class="check"><input type="checkbox" data-camb="alertAll" ${c.alertAll ? "checked" : ""} /> Avisar os jogadores quando ela vê alguém</label>
    <label class="check"><input type="checkbox" data-camb="hiddenSeen" ${c.hiddenSeen ? "checked" : ""} /> Vê tokens escondidos</label>
    <div class="sub">Não vê (aliados): ${ign || '<span class="hint">ninguém</span>'} <button type="button" class="mini" id="ignSel">usar seleção</button> ${ign ? '<button type="button" class="mini" id="ignClr">limpar</button>' : ""}</div>
    <div class="row"><span class="hint grow">Estado: ${chip(n?.state || "ativo")}</span><button type="button" class="mini danger" id="camDel">deixar de ser câmera</button></div>
  </div>`;
}

function nodeForm(it) {
  const n = nodeOf(it);
  return `<div class="effect">
    <h3>◈ Nó da Matriz</h3>
    <input type="text" data-node="name" value="${esc(n.name)}" title="Nome que os deckers veem" />
    <div class="row"><select data-node="type">${TYPES.map(([v, l, ic]) => `<option value="${v}" ${v === n.type ? "selected" : ""}>${ic} ${l}</option>`).join("")}</select></div>
    <div class="states">${STATES.map(([v, l]) => `<button type="button" class="chip${v === n.state ? " on" : ""}" data-state="${v}">${l}</button>`).join("")}</div>
    ${n.type === "porta" ? '<p class="hint">Porta: hackeada ou desativada fica destravada (pode ser arrastada); ativa trava de novo.</p>' : ""}
    <label class="check"><input type="checkbox" data-nodeb="hidden" ${n.hidden ? "checked" : ""} /> Oculto na Matriz (os deckers não veem)</label>
    <div class="row"><span class="grow"></span><button type="button" class="mini danger" id="nodeDel">deixar de ser nó</button></div>
  </div>`;
}

function renderSel() {
  const its = items.filter((i) => sel.includes(i.id));
  if (!its.length) return '<p class="hint">Selecione um item no mapa para transformar em câmera (guarda, torreta, câmera) ou em nó da Matriz (porta, painel, arquivo). Ou use o botão direito no item.</p>';
  if (its.length > 1) {
    return `<p class="hint">${its.length} itens selecionados.</p><div class="btns"><button type="button" id="mkCam">📷 Virar câmeras</button><button type="button" id="mkNode">◈ Virar nós</button></div>
      <div class="row"><span class="hint grow">Estado de todos:</span></div><div class="states">${STATES.map(([v, l]) => `<button type="button" class="chip" data-stateall="${v}">${l}</button>`).join("")}</div>`;
  }
  const it = its[0];
  const cam = camOf(it), node = nodeOf(it);
  return `<div class="row"><b class="grow">${esc(itemName(it))}</b></div>
    ${cam ? camForm(it) : ""}
    ${node ? nodeForm(it) : ""}
    ${!cam || !node ? `<div class="btns">${cam ? "" : '<button type="button" id="mkCam">📷 Virar câmera</button>'}${node ? "" : '<button type="button" id="mkNode">◈ Virar nó da Matriz</button>'}</div>` : ""}
    ${isToken(it) ? `<label class="check"><input type="checkbox" id="deck" ${it.metadata?.[DECK] === true ? "checked" : ""} /> Tem commlink/cyberdeck (o dono deste token vê a Matriz)</label>` : ""}`;
}

function renderGM() {
  const prefs = getPrefs();
  const cams = items.filter((i) => camOf(i));
  const nodes = items.filter((i) => nodeOf(i) && !camOf(i));
  const online = new Map(players.filter((p) => p.role !== "GM").map((p) => [p.id, p.name]));
  const known = [...new Set([...online.keys(), ...(access.players || [])])];
  $("main").innerHTML = `
    <h1>Vigilância</h1>
    <div class="row"><label class="check"><input type="checkbox" id="pCones" ${prefs.cones ? "checked" : ""} /> Ver cones</label><label class="check"><input type="checkbox" id="pRa" ${prefs.ra ? "checked" : ""} /> Ver a Matriz (RA)</label></div>
    ${pending.length ? `<section><h2>Pedidos de hack</h2>${pending.map((r) => `<div class="mrow"><span class="mname">${esc(r.byName)} → ${esc(r.nodeName)}: <b>${esc(stateLabel(r.action))}</b></span>
      <button type="button" class="mini" data-ok="${r.id}">aprovar</button><button type="button" class="mini x" data-no="${r.id}">negar</button></div>`).join("")}</section>` : ""}
    <section id="selbox">${renderSel()}</section>
    <section><h2>Na cena</h2>
      ${cams.length || nodes.length ? `<div class="mlist">${[...cams, ...nodes].map((i) => { const n = nodeOf(i); return `<div class="mrow${sel.includes(i.id) ? " sel" : ""}" data-pick="${i.id}">
        <span class="ico">${camOf(i) ? "📷" : iconOf(n.type)}</span><span class="mname">${esc(n?.name || itemName(i))}</span>${n ? chip(n.state) : ""}${n?.hidden ? '<span class="tag">oculto</span>' : ""}</div>`; }).join("")}</div>`
        : '<p class="hint">Nenhuma câmera ou nó ainda.</p>'}
    </section>
    <section><h2>Quem vê a Matriz</h2>
      <p class="hint">Jogadores marcados aqui, e os donos de tokens com commlink/cyberdeck (botão direito no token).</p>
      ${known.length ? known.map((id) => `<label class="check"><input type="checkbox" data-acc="${id}" ${(access.players || []).includes(id) ? "checked" : ""} /> ${esc(online.get(id) || "jogador fora da sala")}</label>`).join("") : '<p class="hint">Nenhum jogador na sala agora.</p>'}
      <label class="check"><input type="checkbox" id="auto" ${access.autoApprove ? "checked" : ""} /> Aprovar pedidos de hack sozinho (sem me perguntar)</label>
    </section>
    <section><details><summary>Com Gatilhos, Estados e Arsenal</summary>
      <p class="hint"><b>Gatilhos:</b> causa <i>Uma câmera vê alguém</i> (quem ativou = quem foi visto) e <i>Nó da Matriz muda de estado</i>; efeitos <i>Ligar/desligar câmera</i> e <i>Mudar estado do nó</i>.</p>
      <p class="hint"><b>Arsenal:</b> torreta = token com arma no Arsenal + câmera. Gatilho "câmera vê alguém" → efeito "Disparo (Arsenal)" com o atirador = torreta e alvo "+ quem ativou".</p>
      <p class="hint"><b>Estados:</b> marque <i>Câmera e nó da Matriz</i> no grupo: cada estado guarda se a câmera está ligada, para onde aponta e o estado do nó (ex.: "Alarme" liga todas as câmeras).</p>
    </details></section>`;
  bindGM();
}

function bindGM() {
  const one = items.find((i) => sel.length === 1 && i.id === sel[0]);
  const ids = sel.slice();
  $("pCones").onchange = (e) => setPrefs({ ...getPrefs(), cones: e.target.checked });
  $("pRa").onchange = (e) => setPrefs({ ...getPrefs(), ra: e.target.checked });
  for (const b of document.querySelectorAll("[data-ok]")) b.onclick = () => decide(b.dataset.ok, true);
  for (const b of document.querySelectorAll("[data-no]")) b.onclick = () => decide(b.dataset.no, false);
  for (const r of document.querySelectorAll("[data-pick]")) r.onclick = () => OBR.player.select([r.dataset.pick], false);
  for (const c of document.querySelectorAll("[data-acc]")) c.onchange = () => setAccess((a) => ({ ...a, players: c.checked ? [...new Set([...(a.players || []), c.dataset.acc])] : (a.players || []).filter((x) => x !== c.dataset.acc) }));
  $("auto").onchange = (e) => setAccess((a) => ({ ...a, autoApprove: e.target.checked }));
  $("mkCam")?.addEventListener("click", () => makeCamera(ids));
  $("mkNode")?.addEventListener("click", () => makeNode(ids));
  for (const b of document.querySelectorAll("[data-stateall]")) b.onclick = () => setState(ids, b.dataset.stateall);
  if (!one) return;
  for (const el of document.querySelectorAll("[data-cam]")) {
    const k = el.dataset.cam;
    el.oninput = () => { const o = el.parentElement.querySelector("output"); if (o) o.textContent = k === "range" ? `${el.value} quadrados` : k === "sweep" && el.value === "0" ? "parada" : `${el.value}°`; };
    el.onchange = () => editCam(one.id, (c) => ({ ...c, [k]: Number(el.value) }));
  }
  for (const el of document.querySelectorAll("[data-camb]")) el.onchange = () => editCam(one.id, (c) => ({ ...c, [el.dataset.camb]: el.checked }));
  $("ignSel")?.addEventListener("click", async () => { const s = (await OBR.player.getSelection()) || []; editCam(one.id, (c) => ({ ...c, ignore: [...new Set([...(c.ignore || []), ...s.filter((x) => x !== one.id)])] })); });
  $("ignClr")?.addEventListener("click", () => editCam(one.id, (c) => ({ ...c, ignore: [] })));
  $("camDel")?.addEventListener("click", () => OBR.scene.items.updateItems([one.id], (d) => { for (const it of d) { delete it.metadata[CAM]; if (it.metadata[NODE]?.type === "camera") delete it.metadata[NODE]; } }));
  for (const el of document.querySelectorAll("[data-node]")) el.onchange = () => editNode(one.id, (n) => ({ ...n, [el.dataset.node]: el.value.trim() || n[el.dataset.node] }));
  for (const el of document.querySelectorAll("[data-nodeb]")) el.onchange = () => editNode(one.id, (n) => ({ ...n, [el.dataset.nodeb]: el.checked }));
  for (const b of document.querySelectorAll("[data-state]")) b.onclick = () => setState([one.id], b.dataset.state);
  $("nodeDel")?.addEventListener("click", () => OBR.scene.items.updateItems([one.id], (d) => { for (const it of d) { delete it.metadata[NODE]; delete it.metadata[CAM]; } }));
  $("deck")?.addEventListener("change", (e) => OBR.scene.items.updateItems([one.id], (d) => { for (const it of d) { if (e.target.checked) it.metadata[DECK] = true; else delete it.metadata[DECK]; } }));
}

// ---------------- jogador ----------------
function renderPlayer() {
  const prefs = getPrefs();
  if (!hasAccess(myId, role, items, access)) {
    $("main").innerHTML = '<h1>Vigilância</h1><p class="hint">Você não está conectado à Matriz. Precisa de um commlink ou cyberdeck: fale com o mestre.</p>';
    return;
  }
  const nodes = items.filter((i) => nodeOf(i) && !nodeOf(i).hidden && i.visible !== false);
  $("main").innerHTML = `<h1>Matriz</h1>
    <label class="check"><input type="checkbox" id="pRa" ${prefs.ra ? "checked" : ""} /> Ver a camada RA no mapa</label>
    <p class="hint">Escolha o que fazer com um nó: o mestre decide (role o teste dele).</p>
    ${nodes.length ? nodes.map((i) => { const n = nodeOf(i); const wait = asked.get(i.id); return `<div class="effect">
      <div class="row"><span class="ico">${iconOf(n.type)}</span><b class="grow mname">${esc(n.name)}</b>${chip(n.state)}</div>
      ${wait ? `<p class="hint">Aguardando o mestre: ${esc(stateLabel(wait))}…</p>` : `<div class="btns">${ACTIONS.filter(([v]) => v !== n.state).map(([v, l]) => `<button type="button" class="mini" data-req="${i.id}" data-act="${v}">${l}</button>`).join("")}</div>`}
    </div>`; }).join("") : '<p class="hint">Nenhum nó da Matriz por aqui.</p>'}`;
  $("pRa").onchange = (e) => setPrefs({ ...getPrefs(), ra: e.target.checked });
  for (const b of document.querySelectorAll("[data-req]")) {
    b.onclick = () => {
      asked.set(b.dataset.req, b.dataset.act);
      OBR.broadcast.sendMessage(CH_REQ, { node: b.dataset.req, action: b.dataset.act }, { destination: "ALL" });
      render();
    };
  }
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  role = await OBR.player.getRole();
  myId = await OBR.player.getId();
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  let tm = null;
  const later = () => { clearTimeout(tm); tm = setTimeout(() => { if (!busy()) load(); }, 150); };
  OBR.scene.items.onChange((list) => {
    // pedido respondido: o nó mudou de estado
    for (const [id, act] of asked) if (nodeOf(list.find((i) => i.id === id))?.state === act) asked.delete(id);
    later();
  });
  OBR.scene.onMetadataChange(later);
  OBR.party.onChange(later);
  OBR.player.onChange((p) => { if (JSON.stringify(p.selection || []) !== JSON.stringify(sel)) later(); });
  OBR.broadcast.onMessage(CH_RES, (e) => { if (e.data?.by === myId && !e.data.ok) { for (const [id] of asked) if (items.find((i) => i.id === id && nodeOf(i)?.name === e.data.nodeName)) asked.delete(id); later(); } });
});
