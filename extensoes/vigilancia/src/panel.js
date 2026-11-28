import "./visibility.js";
import "./compact.js";
// Painel da Vigilância. Mestre: monta câmeras e nós, decide pedidos de hack, diz quem vê a Matriz.
// Jogador com commlink/cyberdeck: vê os nós e pede para hackear, pôr em loop, desativar ou reativar.
import OBR from "@owlbear-rodeo/sdk";
import { FEED, canWatch, nodesAround, CAM, NODE, DECK, STATES, TYPES, ACTIONS, STATE_COLOR, camOf, nodeOf, hasAccess, iconOf, stateLabel, isToken, VISION, ONLY, MODES, visionOf, ownedBy, modeLabel } from "./core.js";
import { ruidoCfg, rondaOf, routeOf, verdadeOf, VERDADE, DEFAULT_RONDA, ETIQ, DEFAULT_ETIQ } from "./extra.js";
import { editEtiqueta, fazerRuido, setRuido, editRonda, addPonto, clearRota, editVerdade, PENDING, CH_REQ, CH_RES, CH_VISION, getPrefs, setPrefs, getAccess, setAccess, makeCamera, makeNode, editCam, editNode, setState, decide, itemName, applyTheme } from "./ops.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let role = "PLAYER", myId = "";
let watching = "", dpiP = 150;
let items = [], sel = [], pending = [], access = { players: [], autoApprove: false }, players = [], ruido = ruidoCfg({});
const asked = new Map(); // jogador: nó -> ação pedida (para mostrar "aguardando")

const busy = () => ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName) && document.activeElement.type !== "checkbox";
const chip = (st) => `<span class="chip" style="background:${STATE_COLOR[st] || "#888"};color:#111">${esc(stateLabel(st))}</span>`;

// Só redesenha se algo que o painel mostra mudou. Mover itens (ronda dos guardas, tokens, qualquer coisa do mapa)
// dispara onChange várias vezes por segundo: redesenhar a cada um faz o painel piscar sem parar.
let lastSig = "";
function panelSig(list, selection, md, plist) {
  const keep = (m) => Object.fromEntries(Object.entries(m || {}).filter(([k]) => k.startsWith("vigilancia/") && k !== "vigilancia/olhar"));
  return JSON.stringify([
    list.map((i) => [i.id, i.name, i.layer, i.visible, i.createdUserId, i.text?.plainText, keep(i.metadata)]),
    selection, watching, md, plist.map((p) => [p.id, p.name, p.role]),
  ]);
}
async function load() {
  dpiP = await OBR.scene.grid.getDpi().catch(() => dpiP);
  [items, sel, players] = await Promise.all([OBR.scene.items.getItems(), OBR.player.getSelection().then((s) => s || []), OBR.party.getPlayers().catch(() => [])]);
  const md = await OBR.scene.getMetadata();
  pending = Array.isArray(md[PENDING]) ? md[PENDING] : [];
  access = await getAccess();
  ruido = ruidoCfg(md);
  const sig = panelSig(items, sel, [pending, access, ruido], players);
  if (sig === lastSig) return;
  lastSig = sig;
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
    <label class="check"><input type="checkbox" data-camb="verGuardas" ${c.verGuardas ? "checked" : ""} /> Vê guardas e outras câmeras (desligado: eles não ativam esta câmera)</label>
    <label class="check"><input type="checkbox" data-camb="ouve" ${c.ouve ? "checked" : ""} /> 👂 Ouve ruídos (tiros, barulhos${ruido.on ? "" : "; o ruído está desligado na cena"})</label>
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
    ${isToken(it) ? `<label class="check"><input type="checkbox" id="deck" ${it.metadata?.[DECK] === true ? "checked" : ""} /> Tem commlink/cyberdeck (o dono deste token vê a Matriz)</label>` : ""}
    ${visionForm(it)}
    ${rondaForm(it)}
    ${verdadeForm(it)}
    ${etiquetaForm(it)}`;
}

/** Etiqueta de RA: rótulo flutuante embaixo do item, visível só para quem tem commlink/cyberdeck (ou o mestre). */
function etiquetaForm(it) {
  const e = it.metadata?.[ETIQ];
  if (!e) return `<div class="effect"><h3>🏷 Etiqueta de RA</h3><p class="hint">Rótulo de realidade aumentada colado no item (nome do aparelho, dono, nível de segurança). Só quem tem RA vê: você, jogadores marcados e donos de tokens com commlink/cyberdeck.</p>
    <div class="btns"><button type="button" id="etOn">🏷 Criar etiqueta</button></div></div>`;
  const x = { ...DEFAULT_ETIQ, ...e };
  const pl = players.filter((p) => p.role !== "GM");
  return `<div class="effect">
    <h3>🏷 Etiqueta de RA</h3>
    <label class="check"><input type="checkbox" data-etb="on" ${x.on !== false ? "checked" : ""} /> Ligada</label>
    <input type="text" data-et="titulo" placeholder="título (ex.: Painel de acesso B-12)" value="${esc(x.titulo)}" />
    <textarea data-et="linhas" rows="3" placeholder="uma informação por linha (dono, segurança, estado...). {estado} vira o estado do nó da Matriz.">${esc(x.linhas)}</textarea>
    <div class="row"><label class="inline">cor <input type="color" data-et="cor" value="${esc(x.cor)}" /></label>
      <label class="inline">só aparece a até <input type="number" data-etn="alcance" min="0" step="1" value="${Number(x.alcance) || 0}" /> quadrados (0 = sempre)</label></div>
    <label class="check"><input type="checkbox" data-etb="mesmoOculto" ${x.mesmoOculto ? "checked" : ""} /> Aparece mesmo com o item escondido (aparelho que só existe na RA)</label>
    <div class="row"><span class="hint">Só para (nenhum marcado = todos com RA):</span>${pl.map((p) => `<label class="check"><input type="checkbox" data-etpl value="${p.id}" ${Array.isArray(x.para) && x.para.includes(p.id) ? "checked" : ""} /> ${esc(p.name)}</label>`).join("")}</div>
    <p class="hint">O alcance usa os tokens do jogador que têm commlink/cyberdeck; quem foi só marcado pelo mestre, sem token, vê sempre. O jogador pode desligar a RA no painel dele.</p>
    <div class="btns"><button type="button" id="etDel">Tirar a etiqueta</button></div>
  </div>`;
}

/** Ronda: o guarda anda sozinho por uma rota de pontos (o líder move o token). */
function rondaForm(it) {
  const r = rondaOf(it);
  const n = routeOf(items, it.id).length;
  if (!r) return `<div class="effect"><h3>🚶 Ronda</h3><p class="hint">O guarda anda sozinho por uma rota. Ele para quando vê alguém e vai investigar um ruído que ouviu.</p>
    <div class="btns"><button type="button" id="rdOn">🚶 Criar ronda</button></div></div>`;
  return `<div class="effect">
    <h3>🚶 Ronda</h3>
    <label class="check"><input type="checkbox" data-rd="on" ${r.on ? "checked" : ""} /> Em ronda (anda sozinho)</label>
    <div class="row"><label class="inline">velocidade <input type="number" data-rdn="speed" min="0.25" max="10" step="0.25" value="${r.speed}" /> quadrados/s</label></div>
    <div class="row"><label class="inline">pausa em cada ponto <input type="number" data-rdn="pausa" min="0" step="1" value="${r.pausa}" /> s</label></div>
    <div class="row"><select data-rds="modo"><option value="ciclo" ${r.modo !== "vaivem" ? "selected" : ""}>Ciclo (volta ao primeiro ponto)</option><option value="vaivem" ${r.modo === "vaivem" ? "selected" : ""}>Vai e volta</option></select></div>
    <label class="check"><input type="checkbox" data-rd="girar" ${r.girar !== false ? "checked" : ""} /> O guarda olha para onde anda (cone gira; a imagem só espelha para a esquerda/direita)</label>
    <div class="row"><select data-rds="portas"><option value="fecha" ${(r.portas ?? "fecha") === "fecha" ? "selected" : ""}>Portas: abre ao passar e fecha depois</option><option value="deixa" ${r.portas === "deixa" ? "selected" : ""}>Portas: abre e deixa aberta</option><option value="nao" ${r.portas === "nao" ? "selected" : ""}>Portas: ignora (não mexe)</option></select></div>
    <div class="row"><label class="inline">para ao ver alguém por <input type="number" data-rdn="parar" min="0" step="1" value="${r.parar}" /> s (0 = não para)</label></div>
    <label class="check"><input type="checkbox" data-rd="investiga" ${r.investiga ? "checked" : ""} /> Vai investigar ruídos que ouve (precisa de "Ouve ruídos" na câmera)</label>
    <div class="row"><label class="inline">espera no local do ruído <input type="number" data-rdn="espera" min="0" step="1" value="${r.espera}" /> s</label></div>
    <p class="hint">Rota: ${n} ponto${n === 1 ? "" : "s"}. "＋ Ponto" põe um marcador (o primeiro na posição do guarda, os outros no centro da tela): arraste os marcadores para ajustar. Os marcadores só o mestre vê.</p>
    <div class="btns"><button type="button" id="rdPonto">＋ Ponto</button>${n ? '<button type="button" id="rdLimpa">✕ Limpar rota</button>' : ""}<button type="button" id="rdDel">Tirar a ronda</button></div>
  </div>`;
}

/** Verdade por jogador: cada jogador vê uma versão diferente do item (o original fica escondido). */
function verdadeForm(it) {
  const v = it.metadata?.[VERDADE];
  if (!v) return `<div class="effect"><h3>🎭 Verdade por jogador</h3><p class="hint">Cada jogador enxerga este item de um jeito: ilusão, disfarce, aura, alucinação. O original fica escondido para os jogadores e você continua vendo ele.</p>
    <div class="btns"><button type="button" id="vdOn">🎭 Ativar</button></div></div>`;
  const pl = players.filter((p) => p.role !== "GM");
  const vers = v.versoes || [];
  return `<div class="effect">
    <h3>🎭 Verdade por jogador</h3>
    <label class="check"><input type="checkbox" id="vdLig" ${v.on !== false ? "checked" : ""} /> Ligada</label>
    <p class="hint">O original fica escondido; cada jogador vê a primeira versão que cita ele, senão a de "todos os outros", senão nada.</p>
    ${vers.map((x, i) => `<div class="sub">
      <div class="row"><b class="grow">Versão ${i + 1}</b><button type="button" class="mini danger" data-vdel="${i}">✕</button></div>
      <div class="row">${pl.map((p) => `<label class="check"><input type="checkbox" data-vpl="${i}" value="${p.id}" ${Array.isArray(x.para) && x.para.includes(p.id) ? "checked" : ""} /> ${esc(p.name)}</label>`).join("")}
        <label class="check"><input type="checkbox" data-vall="${i}" ${x.para === "*" ? "checked" : ""} /> todos os outros</label></div>
      <input type="text" data-vf="imagem" data-vi="${i}" placeholder="link da imagem (opcional)" value="${esc(x.imagem || "")}" />
      <input type="text" data-vf="texto" data-vi="${i}" placeholder="texto (opcional)" value="${esc(x.texto || "")}" />
      <label class="check"><input type="checkbox" data-vf="esconder" data-vi="${i}" ${x.esconder ? "checked" : ""} /> não enxerga nada (item invisível para quem cair aqui)</label>
    </div>`).join("")}
    <div class="btns"><button type="button" id="vdAdd">＋ Versão</button><button type="button" id="vdDel">Desfazer a verdade (mostrar o item)</button></div>
  </div>`;
}

/** Visão especial: modos que o token tem (ciberolhos) e itens que só aparecem num modo. */
function visionForm(it) {
  const v = visionOf(it);
  const only = it.metadata?.[ONLY] || "";
  return `<div class="effect">
    <h3>👁 Visão especial</h3>
    ${isToken(it) ? `<div class="row">${MODES.map(([m, l, ic]) => `<label class="check"><input type="checkbox" data-vmode="${m}" ${v?.modes.includes(m) ? "checked" : ""} /> ${ic} ${l}</label>`).join("")}</div>
    ${v ? `<p class="hint">Ligado agora: ${v.on.length ? v.on.map(modeLabel).join(", ") : "nada"} (o jogador liga e desliga no painel dele).</p>` : '<p class="hint">Ciberolhos: marque os modos que este personagem tem. O dono do token vê os itens marcados para aquele modo.</p>'}` : ""}
    <div class="row"><span class="hint">Este item só aparece em:</span><select id="only"><option value="" ${only ? "" : "selected"}>visão normal (todos)</option>${MODES.map(([m, l]) => `<option value="${m}" ${only === m ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    ${only ? `<p class="hint">O item fica escondido; quem está com ${modeLabel(only)} ligada vê uma cópia só na tela dele${only === "termica" ? " (com o brilho de calor)" : ""}.</p>` : ""}
  </div>`;
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
    <section><h2>👂 Ruído</h2>
      <label class="check"><input type="checkbox" id="ruOn" ${ruido.on ? "checked" : ""} /> Ruído ligado (desmarque e ninguém ouve nada)</label>
      <div class="row"><label class="inline">tiro <input type="number" data-ru="tiro" min="0" step="1" value="${ruido.tiro}" /> quadrados</label><label class="inline">corpo a corpo <input type="number" data-ru="corpo" min="0" step="1" value="${ruido.corpo}" /></label></div>
      <div class="row"><label class="inline">passos (Régua) <input type="number" data-ru="passos" min="0" step="1" value="${ruido.passos}" /> (0 = sem)</label><label class="inline">cada parede deixa <input type="number" data-ru="paredes" min="0" max="1" step="0.1" value="${ruido.paredes}" /> do alcance</label></div>
      <div class="row"><label class="inline">barulho manual <input type="number" id="ruRaio" min="1" step="1" value="10" /> quadrados</label><button type="button" class="mini" id="ruFaz">fazer no item selecionado</button></div>
      <p class="hint">Quem ouve: câmeras/guardas com "Ouve ruídos" ligado (paredes abafam). Tiros do Arsenal fazem barulho sozinhos. Outras extensões podem mandar o canal <code>vigilancia/ruido</code> { x, y, raio }.</p>
    </section>
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
  $("ruOn").onchange = (e) => setRuido({ on: e.target.checked });
  for (const el of document.querySelectorAll("[data-ru]")) el.onchange = () => setRuido({ [el.dataset.ru]: Math.max(0, Number(el.value) || 0) });
  $("ruFaz").onclick = () => {
    const it = items.find((i) => ids.includes(i.id));
    if (!it) return OBR.notification.show("Vigilância: selecione o item de onde sai o barulho.", "WARNING");
    fazerRuido(it.position.x, it.position.y, Math.max(1, Number($("ruRaio").value) || 10), `um barulho em ${itemName(it)}`);
  };
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
  for (const c of document.querySelectorAll("[data-vmode]")) {
    c.onchange = () => OBR.scene.items.updateItems([one.id], (d) => {
      for (const it of d) {
        const v = visionOf(it) || { modes: [], on: [] };
        const m = c.dataset.vmode;
        const modes = c.checked ? [...new Set([...v.modes, m])] : v.modes.filter((x) => x !== m);
        const on = c.checked ? [...new Set([...v.on, m])] : v.on.filter((x) => x !== m);
        if (modes.length) it.metadata[VISION] = { modes, on }; else delete it.metadata[VISION];
      }
    });
  }
  $("only")?.addEventListener("change", (e) => OBR.scene.items.updateItems([one.id], (d) => {
    for (const it of d) {
      if (e.target.value) { it.metadata[ONLY] = e.target.value; it.visible = false; } else { delete it.metadata[ONLY]; it.visible = true; }
    }
  }));
  // ronda
  $("rdOn")?.addEventListener("click", () => editRonda(one.id, (r) => ({ ...DEFAULT_RONDA, ...r })));
  for (const el of document.querySelectorAll("[data-rd]")) el.onchange = () => editRonda(one.id, (r) => ({ ...r, [el.dataset.rd]: el.checked }));
  for (const el of document.querySelectorAll("[data-rdn]")) el.onchange = () => editRonda(one.id, (r) => ({ ...r, [el.dataset.rdn]: Math.max(0, Number(el.value) || 0) }));
  for (const el of document.querySelectorAll("[data-rds]")) el.onchange = () => editRonda(one.id, (r) => ({ ...r, [el.dataset.rds]: el.value }));
  $("rdPonto")?.addEventListener("click", async () => { await editRonda(one.id, (r) => r); await addPonto(one); load(); });
  $("rdLimpa")?.addEventListener("click", async () => { await clearRota(one.id); load(); });
  $("rdDel")?.addEventListener("click", async () => { await clearRota(one.id); await OBR.scene.items.updateItems([one.id], (d) => { for (const it of d) delete it.metadata["vigilancia/ronda"]; }); load(); });
  // etiqueta de RA
  $("etOn")?.addEventListener("click", () => editEtiqueta([one.id], (e) => e));
  $("etDel")?.addEventListener("click", () => editEtiqueta([one.id], () => null));
  for (const el of document.querySelectorAll("[data-et]")) el.onchange = () => editEtiqueta([one.id], (e) => ({ ...e, [el.dataset.et]: el.value }));
  for (const el of document.querySelectorAll("[data-etb]")) el.onchange = () => editEtiqueta([one.id], (e) => ({ ...e, [el.dataset.etb]: el.checked }));
  for (const el of document.querySelectorAll("[data-etn]")) el.onchange = () => editEtiqueta([one.id], (e) => ({ ...e, [el.dataset.etn]: Math.max(0, Number(el.value) || 0) }));
  for (const el of document.querySelectorAll("[data-etpl]")) {
    el.onchange = () => editEtiqueta([one.id], (e) => {
      const cur = Array.isArray(e.para) ? e.para : [];
      return { ...e, para: el.checked ? [...new Set([...cur, el.value])] : cur.filter((id) => id !== el.value) };
    });
  }
  // verdade por jogador
  $("vdOn")?.addEventListener("click", () => editVerdade(one.id, (v) => ({ ...v, on: true, versoes: v.versoes?.length ? v.versoes : [{ para: "*", esconder: true }] }), true));
  $("vdLig")?.addEventListener("change", (e) => editVerdade(one.id, (v) => ({ ...v, on: e.target.checked }), e.target.checked));
  $("vdAdd")?.addEventListener("click", () => editVerdade(one.id, (v) => ({ ...v, versoes: [...(v.versoes || []), { para: [] }] })));
  $("vdDel")?.addEventListener("click", () => editVerdade(one.id, () => null));
  for (const b of document.querySelectorAll("[data-vdel]")) b.onclick = () => editVerdade(one.id, (v) => ({ ...v, versoes: v.versoes.filter((_, i) => i !== Number(b.dataset.vdel)) }));
  for (const el of document.querySelectorAll("[data-vf]")) {
    el.onchange = () => editVerdade(one.id, (v) => { const x = v.versoes[Number(el.dataset.vi)]; if (x) x[el.dataset.vf] = el.type === "checkbox" ? el.checked : el.value.trim(); return v; });
  }
  for (const el of document.querySelectorAll("[data-vpl]")) {
    el.onchange = () => editVerdade(one.id, (v) => {
      const x = v.versoes[Number(el.dataset.vpl)];
      if (!x) return v;
      const cur = Array.isArray(x.para) ? x.para : [];
      x.para = el.checked ? [...new Set([...cur, el.value])] : cur.filter((id) => id !== el.value);
      return v;
    });
  }
  for (const el of document.querySelectorAll("[data-vall]")) {
    el.onchange = () => editVerdade(one.id, (v) => { const x = v.versoes[Number(el.dataset.vall)]; if (x) x.para = el.checked ? "*" : []; return v; });
  }
}

// ---------------- jogador ----------------
function visionPlayer() {
  const mine = ownedBy(myId, items).filter((i) => visionOf(i));
  if (!mine.length) return "";
  const prefs = getPrefs();
  return `<section><h2>👁 Visão especial</h2>
    ${mine.map((t) => { const v = visionOf(t); return `<div class="row"><b class="grow">${esc(itemName(t))}</b>${v.modes.map((m) => {
      const ic = MODES.find((x) => x[0] === m)?.[2] || ""; const on = v.on.includes(m);
      return `<button type="button" class="chip${on ? " on" : ""}" data-vt="${t.id}" data-vm="${m}" data-von="${on ? 0 : 1}">${ic} ${esc(modeLabel(m))}${on ? " ✓" : ""}</button>`;
    }).join("")}</div>`; }).join("")}
    <label class="check"><input type="checkbox" id="pTint" ${prefs.tint !== false ? "checked" : ""} /> Filtro de cor na tela com o modo ligado</label>
  </section>`;
}

function renderPlayer() {
  const prefs = getPrefs();
  const vis = visionPlayer();
  if (!hasAccess(myId, role, items, access)) {
    $("main").innerHTML = `<h1>Vigilância</h1>${vis}<p class="hint">Você não está conectado à Matriz. Precisa de um commlink ou cyberdeck: fale com o mestre.</p>`;
    bindVision();
    return;
  }
  const all = items.filter((i) => nodeOf(i) && !nodeOf(i).hidden && i.visible !== false);
  const decks = ownedBy(myId, items).filter((i) => i.metadata?.[DECK] === true).map((i) => i.position);
  const raio = Number.isFinite(Number(prefs.raio)) ? Number(prefs.raio) : 12;
  const ar = nodesAround(all, decks, dpiP, raio);
  const row = ({ item: i, dist }) => { const n = nodeOf(i); const wait = asked.get(i.id); return `<div class="effect">
      <div class="row"><span class="ico">${iconOf(n.type)}</span><b class="grow mname">${esc(n.name)}</b>${dist != null ? `<span class="tag">${dist < 10 ? dist.toFixed(1) : Math.round(dist)} ▢</span>` : ""}${chip(n.state)}</div>
      ${canWatch(i, myId, role, items, access) ? `<div class="btns"><button type="button" class="mini" data-feed="${watching === i.id ? "" : i.id}">${watching === i.id ? "■ Parar de ver a câmera" : "👁 Ver pela câmera"}</button></div>` : (camOf(i) ? '<p class="hint">Para ver por esta câmera, hackeie-a primeiro.</p>' : "")}
      ${wait ? `<p class="hint">Aguardando o mestre: ${esc(stateLabel(wait))}…</p>` : `<div class="btns">${ACTIONS.filter(([v]) => v !== n.state).map(([v, l]) => `<button type="button" class="mini" data-req="${i.id}" data-act="${v}">${l}</button>`).join("")}</div>`}
    </div>`; };
  $("main").innerHTML = `<h1>Matriz: nós ao redor</h1>
    <label class="check"><input type="checkbox" id="pRa" ${prefs.ra ? "checked" : ""} /> Ver a camada RA no mapa</label>
    ${ar.temDeck ? `<label>Alcance do seu commlink (quadrados, 0 = todos)<input type="number" id="pRaio" min="0" step="1" value="${raio}" /></label>` : '<p class="hint">Seu acesso foi liberado pelo mestre (sem token com commlink): aparecem todos os nós.</p>'}
    <p class="hint">Escolha o que fazer com um nó: o mestre decide (role o teste dele).</p>
    ${ar.perto.length ? ar.perto.map(row).join("") : '<p class="hint">Nenhum nó da Matriz ao seu alcance.</p>'}
    ${ar.longe.length ? `<p class="hint">${ar.longe.length} nó(s) fora do alcance (aumente o alcance para ver).</p>` : ""}
    ${vis}`;
  $("pRaio")?.addEventListener("change", (e) => { setPrefs({ ...getPrefs(), raio: Math.max(0, Number(e.target.value) || 0) }); render(); });
  $("pRa").onchange = (e) => setPrefs({ ...getPrefs(), ra: e.target.checked });
  for (const b of document.querySelectorAll("[data-feed]")) b.onclick = () => OBR.player.setMetadata({ [FEED]: b.dataset.feed });
  for (const b of document.querySelectorAll("[data-req]")) {
    b.onclick = () => {
      asked.set(b.dataset.req, b.dataset.act);
      OBR.broadcast.sendMessage(CH_REQ, { node: b.dataset.req, action: b.dataset.act }, { destination: "ALL" });
      render();
    };
  }
  bindVision();
}

function bindVision() {
  for (const b of document.querySelectorAll("[data-vt]")) {
    b.onclick = () => OBR.broadcast.sendMessage(CH_VISION, { targets: [b.dataset.vt], mode: b.dataset.vm, on: b.dataset.von === "1" }, { destination: "ALL" });
  }
  $("pTint")?.addEventListener("change", (e) => setPrefs({ ...getPrefs(), tint: e.target.checked }));
}
OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  role = await OBR.player.getRole();
  myId = await OBR.player.getId();
  watching = (await OBR.player.getMetadata().catch(() => ({})))?.[FEED] || "";
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
  OBR.player.onChange((p) => { const w = p.metadata?.[FEED] || ""; if (w !== watching) { watching = w; later(); } if (JSON.stringify(p.selection || []) !== JSON.stringify(sel)) later(); });
  OBR.broadcast.onMessage(CH_RES, (e) => { if (e.data?.by === myId && !e.data.ok) { for (const [id] of asked) if (items.find((i) => i.id === id && nodeOf(i)?.name === e.data.nodeName)) asked.delete(id); later(); } });
});
