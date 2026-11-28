import "./visibility.js";
import "./compact.js";
// Painel dos Gatilhos (mestre): criar, editar, testar e rearmar.
import OBR from "@owlbear-rodeo/sdk";
import { pickItems } from "./picker.js";
import { ALERT, ALERT_MAX, ALERT_OPS, ALERT_DIRS, alertLevel, CMP_OPS, COND_TYPES, DOOR_IS, newCond, LIST, CH_FIRE, CH_LOG, CAUSES, ACTIONS, ANIMS, ESTADOS, WHO, ACTOR, MOVING, CAN_USE, ARSENAL_WEAPONS, ARSENAL_MODES, TROCADOR_IMAGES, VIG_CAM, VIG_NODE_META, NODE_STATES, VISION_MODES, CHARGE_OPS, REQ_SHOW, REQ_DEFAULT, CH_GIVE, heldBy, canGive, nearby, itemLabel, ARSENAL_DOSSIE, ID, FX_TIPOS, FX_GIROS, DOOR_OPS, ATTACH_OPS, ATTACH_PLACES, ATTACH_WHO, isFogDoor, fogDoorCount, resolveFogDoors, doorIsOpen, doorIsLocked, isInteract, isToken, newTrigger, newEffect, applyTheme, HANDOUTS_BIB } from "./shared.js";
import { zoneShape, pickReacher } from "./engine.js";
import { controls } from "./visibility.js";
import { tryInteract, usableTriggers } from "./interact.js";

const $ = (id) => document.getElementById(id);
let list = [];
let open = null;          // gatilho aberto
let itemNames = new Map();
let itemWeapons = new Map(); // armas do Arsenal de cada token
let itemImages = new Map();  // nomes das imagens do Trocador de cada item
let itemVig = new Map();     // câmeras e nós da Vigilância: id -> { cam, node }
let itemHabs = new Map();    // habilidades do dossiê do Arsenal de cada NPC: id -> [{ nome, forma }]
let itemDoor = new Map();    // portas da névoa: id -> { open, locked }
let visuais = [];            // visuais do Arsenal por grupo (arsenal/visuais.json): [[grupo, [nomes]]]
let handoutsLib = [];     // biblioteca da extensão Handouts (metadado da sala)
let estados = [];         // grupos da extensão Estados
let alertNow = 0;         // nível de alerta atual
const logLines = [];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const nameOf = (id) => (id === ACTOR ? "⚑ quem ativou" : itemNames.get(id) || "(item apagado)");

async function refreshNames() {
  const items = await OBR.scene.items.getItems();
  itemNames = new Map(items.map((i) => [i.id, i.text?.plainText || i.name || i.type]));
  itemWeapons = new Map(items.map((i) => [i.id, i.metadata?.[ARSENAL_WEAPONS] || []]));
  itemImages = new Map(items.filter((i) => Array.isArray(i.metadata?.[TROCADOR_IMAGES])).map((i) => [i.id, i.metadata[TROCADOR_IMAGES].map((v) => v.name)]));
  itemDoor = new Map(items.filter(isFogDoor).map((i) => [i.id, { open: doorIsOpen(i), locked: doorIsLocked(i), n: fogDoorCount(i) }]));
  itemHabs = new Map(items.filter((i) => Array.isArray(i.metadata?.[ARSENAL_DOSSIE]?.habilidades)).map((i) => [i.id, i.metadata[ARSENAL_DOSSIE].habilidades.map((h) => ({ nome: h.nome, forma: h.forma, secao: h.secao }))]));
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
    <button type="button" class="mini" data-pick="${key}" title="Escolher numa lista: acha itens trancados, fog, mapa e escondidos">escolher da lista</button>
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

/** Abrir, fechar, alternar, trancar ou destrancar portas da névoa. */
function doorRow(e) {
  const tg = (e.targets || []).filter((id) => id !== ACTOR);
  const bad = tg.length && !tg.some((id) => itemDoor.has(id));
  return `<div class="row"><span class="hint">Porta:</span><select data-ek="doorOp">${DOOR_OPS.map(([v, l]) => `<option value="${v}" ${(e.doorOp || "alternar") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    ${tg.length ? `<div class="hint">${tg.filter((id) => itemDoor.has(id)).map((id) => `${esc(nameOf(id))}: ${itemDoor.get(id).open ? "aberta" : "fechada"}${itemDoor.get(id).locked ? " (trancada)" : ""}`).join(" · ")}</div>` : '<span class="hint warn">⚠ Sem porta: selecione a linha da porta (Smoke & Spectre) e clique em "usar seleção".</span>'}
    ${bad ? '<span class="hint warn">⚠ Nenhum desses itens é porta da névoa (Smoke & Spectre: botão direito na linha → Enable Door; fog do Owlbear: ferramenta Door).</span>' : ""}
    ${(() => { const n = Math.max(0, ...tg.map((id) => itemDoor.get(id)?.n || 0)); return n > 1 ? `<div class="row"><span class="hint">Qual porta deste fog:</span><select data-ek="doorIdx"><option value="">todas (${n})</option>${Array.from({ length: n }, (_, k) => `<option value="${k}" ${String(e.doorIdx ?? "") === String(k) ? "selected" : ""}>porta ${k + 1}</option>`).join("")}</select></div><span class="hint">Um fog do Owlbear pode ter várias portas; "porta 1, 2…" segue a ordem em que você as criou. Teste e ajuste.</span>` : ""; })()}
    <span class="hint">Para os jogadores abrirem: causa "Interagir" na própria linha da porta (ou botão direito na linha → <b>Gatilhos: jogadores abrem e fecham esta porta</b>). Porta trancada no Smoke não abre.</span>`;
}

/** Pegar item: prender no token de quem ativou (ou soltar). */
function attachRow(t, e) {
  const op = e.attachOp || "prender";
  const sel = (k, opts, cur) => `<select data-ek="${k}">${opts.map(([v, l]) => `<option value="${v}" ${cur === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  const tg = (e.targets || []).filter((id) => id !== ACTOR);
  return `<div class="row"><span class="hint">Item:</span>${sel("attachOp", ATTACH_OPS, op)}</div>
    ${op === "prender" ? `<div class="row"><span class="hint">Fica com:</span>${sel("attachWho", ATTACH_WHO, e.attachWho || "actor")}</div>
    <div class="row"><span class="hint">Onde:</span>${sel("attachPlace", ATTACH_PLACES, e.attachPlace || "canto")}</div>
    <label class="check"><input type="checkbox" data-ekb="attachShow" ${e.attachShow !== false ? "checked" : ""} /> Mostrar o item (se estava escondido)</label>
    <label class="check"><input type="checkbox" data-ekb="attachLock" ${e.attachLock !== false ? "checked" : ""} /> Travar o item (o jogador não arrasta para fora)</label>
    <label class="check"><input type="checkbox" data-ekb="attachGive" ${e.attachGive !== false ? "checked" : ""} /> O jogador pode passar o item para outro personagem ao lado</label>` : ""}
    ${tg.length ? "" : '<span class="hint warn">⚠ Sem item: selecione o cartão, a chave… no mapa e clique em "usar seleção".</span>'}
    <span class="hint">${op === "prender" ? `O item fica preso (attachment) no token e anda com ele, e passa a valer para o <b>Restrito</b> de portas e terminais. Para pegar ao chegar perto: causa "Chegar perto" com o próprio item como zona (raio 1); para pegar clicando: causa "Interagir" no item. Atalho: botão direito no item → <b>Gatilhos: o personagem pega este item ao chegar perto</b>.${MOVING.includes(t.cause) || t.cause === "interact" ? "" : " Sem movimento, quem ativou = quem está em cima da zona ou o token selecionado."}` : "Solta os itens escolhidos que estiverem presos (ficam no chão, onde estão)."}</span>`;
}

/** Efeito visual do Arsenal: vídeo da lista ou link, duração, nome (para encerrar), tamanho. */
function fxRow(e) {
  const link = e.fxSrc === "link";
  const dur = e.fxDur || "once";
  return `<div class="row"><span class="hint">Vídeo:</span><select data-ek="fxSrc"><option value="lista" ${!link ? "selected" : ""}>da lista do Arsenal</option><option value="link" ${link ? "selected" : ""}>link próprio (.webm)</option></select></div>
    ${link ? `<input type="text" data-ek="fxUrl" value="${esc(e.fxUrl)}" placeholder="https://…/meu-efeito.webm" />
      <div class="row"><select data-ek="fxTipo">${FX_TIPOS.map(([v, l]) => `<option value="${v}" ${(e.fxTipo || "area") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select data-ek="fxGiro">${FX_GIROS.map(([v, l]) => `<option value="${v}" ${Number(e.fxGiro || 0) === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>`
    : `<input type="text" data-ek="fxVis" list="gat-visuais" value="${esc(e.fxVis)}" placeholder="nome do visual (ex.: nuvem_veneno, muro_fogo, meu_…)" />
      ${e.fxVis && visuais.length && !visuais.some(([, l]) => l.includes(e.fxVis.trim())) ? '<span class="hint warn">⚠ Esse nome não está na lista de visuais do Arsenal.</span>' : ""}`}
    <div class="row"><span class="hint">Duração:</span><select data-ek="fxDur"><option value="once" ${dur === "once" ? "selected" : ""}>uma vez</option><option value="secs" ${dur === "secs" ? "selected" : ""}>por segundos (em loop)</option><option value="loop" ${dur === "loop" ? "selected" : ""}>em loop até encerrar</option></select>
      ${dur === "secs" ? `<input type="number" data-ek="fxSecs" min="1" step="1" value="${e.fxSecs || 10}" /> s` : ""}</div>
    <div class="row"><input type="text" class="grow" data-ek="fxTag" value="${esc(e.fxTag)}" placeholder="nome do efeito (padrão: nome do gatilho)" />
      <label class="inline" title="0 = tamanho padrão do vídeo">tam. <input type="number" data-ek="fxSize" min="0" step="0.5" value="${e.fxSize || 0}" /> q</label></div>
    ${(e.targets || []).length || e.shooter ? "" : '<span class="hint warn">⚠ Sem alvo: escolha os itens onde o efeito aparece, ou "+ quem ativou".</span>'}
    <span class="hint">Sem "Sai de", o vídeo fica em cima de cada item. Com "Sai de", projétil, linha e cone saem dele até cada item. Para encerrar um efeito em loop: efeito "Encerrar efeito visual" com o mesmo nome, ou ✕ no painel Habilidades do Arsenal. Precisa da extensão Arsenal.</span>`;
}

/** Mostrar um handout (extensão Handouts): da biblioteca por nome, ou escrito aqui. */
function handoutRow(e) {
  const nome = (e.hoNome || "").trim();
  const falta = nome && handoutsLib.length && !handoutsLib.some((h) => String(h.titulo).toLowerCase().includes(nome.toLowerCase()));
  return `<div class="row"><span class="hint">Quem vê:</span><select data-ek="hoPara"><option value="actor" ${(e.hoPara || "actor") === "actor" ? "selected" : ""}>só quem ativou</option><option value="all" ${e.hoPara === "all" ? "selected" : ""}>todos os jogadores</option><option value="gm" ${e.hoPara === "gm" ? "selected" : ""}>só o mestre</option></select></div>
    <input type="text" data-ek="hoNome" list="gat-handouts" value="${esc(e.hoNome)}" placeholder="da biblioteca do Handouts (nome)" />
    ${falta ? '<span class="hint warn">⚠ Não há handout com esse nome na biblioteca.</span>' : ""}
    <input type="text" data-ek="hoTitulo" value="${esc(e.hoTitulo)}" placeholder="título (opcional se usar a biblioteca)" />
    <input type="text" data-ek="hoImg" value="${esc(e.hoImg)}" placeholder="https://…/imagem.png (link direto)" />
    <textarea data-ek="hoTexto" rows="4" placeholder="texto ({quem} = nome de quem ativou)">${esc(e.hoTexto)}</textarea>
    <span class="hint">O que você escrever aqui vence o que vem da biblioteca. Funciona com "interagir": o jogador usa o objeto e só ele vê a imagem e a nota. Precisa da extensão Handouts.</span>`;
}

/** Fazer barulho: de onde sai e até onde chega. */
function noiseRow(e) {
  return `<div class="row"><label class="inline">alcance <input type="number" data-ek="noiseRaio" min="1" step="1" value="${Number(e.noiseRaio) || 10}" /> quadrados</label></div>
    ${(e.targets || []).length ? "" : '<span class="hint warn">⚠ Sem item: escolha de onde sai o barulho.</span>'}
    <span class="hint">Os guardas e câmeras com "Ouve ruídos" (Vigilância) ligado, perto o bastante (as paredes abafam), reagem: avisam o mestre, vão investigar se estão em ronda, e disparam gatilhos com a causa "ouve um ruído". Precisa da extensão Vigilância, com o ruído ligado.</span>`;
}

/** Encerrar efeitos que ficaram no mapa (pelo nome; vazio = todos). */
function fxEndRow(e) {
  return `<input type="text" data-ek="fxTag" value="${esc(e.fxTag)}" placeholder="nome do efeito (vazio = encerra todos)" />
    <span class="hint">Encerra os efeitos em loop com esse nome (o nome dado no efeito visual, o nome do gatilho que o criou, ou o nome da habilidade do NPC). Precisa da extensão Arsenal.</span>`;
}

/** Habilidade do dossiê de um NPC (Arsenal). */
function abilityRow(e) {
  if (!e.shooter) return '<span class="hint">Escolha o NPC: selecione o token que tem dossiê de habilidades no Arsenal e clique em "usar seleção".</span>';
  const hs = itemHabs.get(e.shooter) || [];
  if (!hs.length) return '<span class="hint warn">⚠ Esse token não tem dossiê de habilidades no Arsenal (ferramenta Habilidades → colar o dossiê).</span>';
  const known = hs.some((h) => h.nome === e.ability);
  return `<select data-ek="ability"><option value="">habilidade…</option>${hs.filter((h) => h.secao !== "passiva").map((h) => `<option value="${esc(h.nome)}" ${h.nome === e.ability ? "selected" : ""}>${esc(h.nome)} (${esc(h.forma)})</option>`).join("")}${e.ability && !known ? `<option value="${esc(e.ability)}" selected>${esc(e.ability)} (não está no dossiê)</option>` : ""}</select>
    <span class="hint">Os alvos também dão a direção de cone, linha e área (o primeiro alvo). Usa os contadores (recarga, lendárias) e mostra o resultado no painel Habilidades; você rola os dados.</span>`;
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

/** Alerta: subir, descer, ir para um nível ou zerar. */
function alarmRow(e) {
  const op = e.alarmOp || "up";
  const lv = (from) => Array.from({ length: ALERT_MAX + 1 - from }, (_, i) => i + from);
  const opt = (v, l) => `<option value="${v}" ${String(e.alarmTo ?? "") === String(v) ? "selected" : ""}>${l}</option>`;
  const to = op === "up" ? `<span class="hint">até</span><select data-ek="alarmTo">${opt("", `${ALERT_MAX} (máximo)`)}${lv(1).filter((n) => n < ALERT_MAX).map((n) => opt(n, n)).join("")}</select>`
    : op === "down" ? `<span class="hint">até</span><select data-ek="alarmTo">${opt("", "0 (mínimo)")}${lv(1).filter((n) => n < ALERT_MAX).map((n) => opt(n, n)).join("")}</select>`
    : op === "set" ? `<select data-ek="alarmTo">${opt("", "nível…")}${lv(0).map((n) => opt(n, n)).join("")}</select>` : "";
  return `<div class="row"><select data-ek="alarmOp">${ALERT_OPS.map(([v, l]) => `<option value="${v}" ${v === op ? "selected" : ""}>${l}</option>`).join("")}</select>${to}</div>
    ${op === "set" && (e.alarmTo ?? "") === "" ? '<span class="hint warn">⚠ Escolha o nível.</span>' : ""}
    <span class="hint">O alerta é da cena (0 a ${ALERT_MAX}). Use o gatilho com a causa "O nível de alerta mudou" para o que acontece em cada nível. Dica: câmera → botão direito → <b>Gatilhos: esta câmera sobe o alerta</b>. No texto da mensagem, {nivel} vira o nível.</span>`;
}

/** Porta animada: linha da porta + imagem (Trocador) + vídeo de abrir/fechar. */
function animDoorRow(e) {
  const lines = (e.targets || []).filter((id) => id !== ACTOR);
  const imgs = e.doorImgs || [];
  const names = [...new Set(imgs.flatMap((id) => itemImages.get(id) || []))];
  const so = (k, cur, def) => `<select data-ek="${k}"><option value="${def}" ${(cur || def) === def ? "selected" : ""}>${def === "next" ? "próxima imagem" : "imagem anterior"}</option>${names.map((n) => `<option value="${esc(n)}" ${n === cur ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
  const state = lines.find((id) => itemDoor.has(id));
  const dur = Number(e.vfxWait) || 0;
  const semVfx = e.action === "imgDoor";
  return `<div class="sub">Linha(s) da porta (Smoke & Spectre ou névoa): ${chips(lines, `e:${e.id}:targets`)}</div>
    <div class="sub">Imagem da porta (Trocador): ${chips(imgs, `e:${e.id}:doorImgs`)}</div>
    <div class="row"><span class="hint">Porta:</span><select data-ek="doorOp">${DOOR_OPS.filter(([v]) => ["alternar", "abrir", "fechar"].includes(v)).map(([v, l]) => `<option value="${v}" ${(e.doorOp || "alternar") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    ${semVfx ? "" : `<input type="text" data-ek="vfxOpen" value="${esc(e.vfxOpen)}" placeholder="Vídeo de ABRIR (https://…/porta-abrindo.webm)" />
    <input type="text" data-ek="vfxClose" value="${esc(e.vfxClose)}" placeholder="Vídeo de FECHAR (opcional; sem ele, fecha sem vídeo)" />
    <div class="row"><span class="hint">A porta muda</span><input type="number" data-ek="vfxWait" min="0" step="0.5" value="${dur}" /><span class="hint">s depois de o vídeo começar (a duração da animação)</span></div>
    <div class="row"><select data-ek="fxTipo">${FX_TIPOS.map(([v, l]) => `<option value="${v}" ${(e.fxTipo || "area") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select data-ek="fxGiro">${FX_GIROS.map(([v, l]) => `<option value="${v}" ${Number(e.fxGiro || 0) === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <label class="inline" title="0 = tamanho padrão do vídeo">tam. <input type="number" data-ek="fxSize" min="0" step="0.5" value="${e.fxSize || 0}" /> q</label></div>`}
    ${imgs.length ? `<div class="row"><span class="hint">Ao abrir:</span>${so("imgOpen", e.imgOpen, "next")}</div><div class="row"><span class="hint">Ao fechar:</span>${so("imgClosed", e.imgClosed, "prev")}</div>
      ${names.length ? "" : '<span class="hint warn">⚠ A imagem ainda não tem artes no Trocador: botão direito nela → Trocar imagem → + imagens (a fechada primeiro, depois a aberta).</span>'}` : ""}
    ${!lines.length && !imgs.length ? '<span class="hint warn">⚠ Escolha a linha da porta e/ou a imagem dela (selecione no mapa e clique em "usar seleção").</span>' : ""}
    ${lines.length && !lines.some((id) => itemDoor.has(id)) ? '<span class="hint warn">⚠ Nenhum item da linha é porta da névoa (no Smoke & Spectre: botão direito na linha → Enable Door).</span>' : ""}
    ${state ? `<span class="hint">Agora: ${itemDoor.get(state).open ? "aberta" : "fechada"}${itemDoor.get(state).locked ? " (trancada)" : ""}</span>` : ""}
    ${semVfx ? '<span class="hint">Ao ativar: troca a imagem da porta (próxima ao abrir, anterior ao fechar, ou as artes que você escolher acima) e abre ou fecha a linha da porta na hora, sem vídeo. Alterna conforme o estado da linha. Porta trancada no Smoke não abre. Para o jogador usar: causa "Interagir" na imagem da porta.</span>' : ""}
    ${semVfx ? "" : `<span class="hint">Ao ativar: toca o vídeo em cima da imagem da porta (Arsenal), espera o tempo da animação, troca a imagem (Trocador) e abre ou fecha a linha da porta (alterna conforme o estado dela). Sem vídeo, troca na hora. Porta trancada no Smoke não abre. Para o jogador usar: causa "Interagir" na imagem da porta. Atalho: selecione a linha e a imagem → botão direito → <b>Gatilhos: criar porta animada</b>.</span>`}`;
}

/** Uma condição do "Só se". */
function condRow(t, c) {
  const so = (k, opts, cur) => `<select data-ck="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(cur ?? "") === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const head = `<div class="row">${so("type", COND_TYPES.map((x) => [x.id, x.label]), c.type)}<button type="button" class="x" data-del-cond title="Remover condição">✕</button></div>`;
  const ids = c.ids || [];
  let body = "";
  if (c.type === "alert") body = `<div class="row">${so("op", CMP_OPS, c.op)}<input type="number" data-ck="n" min="0" max="${ALERT_MAX}" step="1" value="${c.n ?? 1}" /><span class="hint">(0 a ${ALERT_MAX}; agora: ${alertNow})</span></div>`;
  else if (c.type === "node") body = `<div class="sub">Nós: ${chips(ids, `c:${c.id}:ids`)}</div><div class="row">${so("op", [["==", "algum está"], ["!=", "nenhum está"]], c.op)}${so("is", NODE_STATES, c.is || "hackeado")}</div>
    ${!ids.length ? '<span class="hint warn">⚠ Escolha os nós (sem eles a condição é ignorada).</span>' : !ids.some((id) => itemVig.get(id)?.node) ? '<span class="hint warn">⚠ Nenhum desses itens é nó da Matriz.</span>' : ""}`;
  else if (c.type === "door") body = `<div class="sub">Portas: ${chips(ids, `c:${c.id}:ids`)}</div><div class="row">${so("op", [["==", "alguma"], ["!=", "nenhuma"]], c.op)}${so("is", DOOR_IS, c.is || "aberta")}</div>
    ${!ids.length ? '<span class="hint warn">⚠ Escolha as portas (sem elas a condição é ignorada).</span>' : !ids.some((id) => itemDoor.has(id)) ? '<span class="hint warn">⚠ Nenhum desses itens é porta da névoa.</span>' : ""}`;
  else if (c.type === "state") {
    const g = estados.find((x) => x.id === c.group);
    body = estados.length ? `<div class="row">${so("group", [["", "grupo…"], ...estados.map((x) => [x.id, x.name])], c.group)}${so("op", [["==", "está em"], ["!=", "não está em"]], c.op)}${so("is", [["", "estado…"], ...(g?.states || []).map((x) => [x.id, x.name])], c.is)}</div>
      ${g && c.is ? `<span class="hint">Agora: ${esc((g.states || []).find((x) => x.id === g.current)?.name || "?")}</span>` : '<span class="hint warn">⚠ Escolha o grupo e o estado (sem eles a condição é ignorada).</span>'}` : '<span class="hint">Crie um grupo na extensão Estados primeiro.</span>';
  } else if (c.type === "count") body = `<div class="sub">Zonas (vazio = as zonas do gatilho): ${chips(c.zones, `c:${c.id}:zones`)}</div>
    <div class="row"><span class="hint">Tokens:</span>${so("op", CMP_OPS, c.op)}<input type="number" data-ck="n" min="0" step="1" value="${c.n ?? 3}" /></div>
    <label class="check"><input type="checkbox" data-ckb="hid" ${c.hid ? "checked" : ""} /> Contar também os tokens escondidos</label>
    ${!(c.zones || []).length && !(t.zones || []).length ? '<span class="hint warn">⚠ Sem zona: escolha a área onde contar (sem ela a condição é ignorada).</span>' : ""}`;
  else if (c.type === "has") body = `<div class="row">${so("op", [["==", "tem"], ["!=", "não tem"]], c.op)}<input type="text" data-ck="name" value="${esc(c.name)}" placeholder="nome do item (ex.: Cartão de acesso)" /></div>
    <span class="hint">O item precisa estar preso (attachment) no personagem que ativou, ou guardado no Inventário de mesa do jogador dele (como no Restrito).</span>`;
  return `<div class="cond" data-cid="${c.id}">${head}${body}</div>`;
}

function effectRow(t, e) {
  const a = ACTIONS.find((x) => x.id === e.action) || ACTIONS[0];
  const need = new Set(a.need);
  return `<div class="effect" data-eid="${e.id}">
    <div class="row">
      <select data-ek="action">${ACTIONS.map((x) => `<option value="${x.id}" ${x.id === e.action ? "selected" : ""}>${x.label}</option>`).join("")}</select>
      <button type="button" class="x" data-del-effect title="Remover efeito">✕</button>
    </div>
    ${need.has("shooter") ? `<div class="sub">${e.action === "fx" ? "Sai de (opcional)" : e.action === "npcAbility" ? "NPC" : "Atirador"}: ${chips(e.shooter ? [e.shooter] : [], `e:${e.id}:shooter`)}${e.action === "fx" && e.shooter ? ` <button type="button" class="mini" data-noshooter="${e.id}" title="O efeito fica em cima de cada item">✕ sem origem</button>` : ""}</div>` : ""}
    ${need.has("targets") ? `<div class="sub">${["arsenal", "npcAbility"].includes(e.action) ? "Alvos" : e.action === "fx" ? "Onde aparece" : e.action === "attach" ? "Item(ns) que o personagem pega" : "Itens"}: ${chips(e.targets, `e:${e.id}:targets`, e.action !== "attach")}</div>` : ""}
    ${need.has("weapon") ? arsenalRow(e) : ""}
    ${need.has("image") ? imageRow(e) : ""}
    ${need.has("power") ? vigRow(e, "power") : ""}
    ${need.has("nodeState") ? vigRow(e, "nodeState") : ""}
    ${need.has("floor") ? floorRow(e) : ""}
    ${need.has("vision") ? visionRow(e) : ""}
    ${need.has("chargeOp") ? chargeRow(e) : ""}
    ${need.has("animDoor") ? animDoorRow(e) : ""}
    ${need.has("alarm") ? alarmRow(e) : ""}
    ${need.has("doorOp") ? doorRow(e) : ""}
    ${need.has("attach") ? attachRow(t, e) : ""}
    ${need.has("fx") ? fxRow(e) : ""}
    ${need.has("fxEnd") ? fxEndRow(e) : ""}
    ${need.has("handout") ? handoutRow(e) : ""}
    ${need.has("noise") ? noiseRow(e) : ""}
    ${need.has("ability") ? abilityRow(e) : ""}
    ${need.has("who") ? `<div class="row"><span class="hint">Quem vai:</span><select data-ek="who">${WHO.map(([v, l]) => `<option value="${v}" ${(e.who || "actor") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>` : ""}
    ${need.has("who") && (e.who || "actor") === "actor" && !MOVING.includes(t.cause) && t.cause !== "standAll" ? '<span class="hint">Sem movimento, "quem ativou" = quem está em cima da zona; se ela estiver vazia, os tokens que você tiver selecionado.</span>' : ""}
    ${need.has("moving") && !MOVING.includes(t.cause) ? '<span class="hint warn">⚠ Barrar só funciona com Entrar, Sair ou Chegar perto (precisa de alguém se movendo).</span>' : ""}
    ${need.has("dest") ? `<div class="sub">Destino: ${chips(e.dest ? [e.dest] : [], `e:${e.id}:dest`)}</div>` : ""}
    ${need.has("text") ? `<input type="text" data-ek="text" value="${esc(e.text)}" placeholder="${e.action === "broadcast" ? "dados (texto ou JSON)" : "Texto na tela ({quem} = nome de quem ativou)"}" />` : ""}
    ${need.has("channel") ? `<input type="text" data-ek="channel" value="${esc(e.channel)}" placeholder="canal (ex.: minha-extensao/evento)" />` : ""}
    ${need.has("audience") ? `<select data-ek="audience"><option value="all" ${e.audience !== "gm" ? "selected" : ""}>para todos</option><option value="gm" ${e.audience === "gm" ? "selected" : ""}>só para o mestre</option></select>` : ""}
    ${need.has("color") ? `<div class="row"><input type="color" data-ek="color" value="${esc(e.color)}" /><select data-ek="anim">${ANIMS.map(([v, l]) => `<option value="${v}" ${v === e.anim ? "selected" : ""}>${l}</option>`).join("")}</select></div>` : ""}
    ${need.has("trigger") ? `<select data-ek="trigger"><option value="">escolha o gatilho…</option>${list.filter((x) => x.id !== t.id).map((x) => `<option value="${x.id}" ${x.id === e.trigger ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}
    ${need.has("trigger") ? '<span class="hint">Para atrasar, use "depois de N s" no fim deste efeito. Dá para cancelar o atraso com "Cancelar sequência pendente".</span>' : ""}
    ${need.has("triggerAny") ? `<select data-ek="trigger"><option value="">todas as sequências pendentes</option>${list.filter((x) => x.id !== t.id).map((x) => `<option value="${x.id}" ${x.id === e.trigger ? "selected" : ""}>só a de: ${esc(x.name)}</option>`).join("")}</select>
      <span class="hint">Cancela os efeitos que ainda estão esperando o "depois de N s" (e o atraso do gatilho). Ex.: o jogador hackeia o alarme antes de os reforços chegarem.</span>` : ""}
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
      <button type="button" class="mini fire" title="Disparar agora (teste: ignora as condições). Sem movimento, &quot;quem ativou&quot; = quem está em cima da zona ou os tokens que você tiver selecionado.">⚡</button>
    </div>
    ${isOpen ? `<div class="body">
      <input type="text" data-k="name" value="${esc(t.name)}" />
      <h3>Quando</h3>
      <select data-k="cause">${CAUSES.map((c) => `<option value="${c.id}" ${c.id === t.cause ? "selected" : ""}>${c.label}</option>`).join("")}</select>
      ${t.cause === "near" ? `<label class="inline">raio <input type="number" data-k="radius" min="0.5" step="0.5" value="${t.radius ?? 2}" /> quadrados</label>` : ""}
      ${t.cause === "alertLevel" ? `<div class="row"><span class="hint">Quando o nível:</span><select data-k="alertDir">${ALERT_DIRS.map(([v, l]) => `<option value="${v}" ${(t.alertDir || "any") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <span class="hint">para</span><select data-k="alertTo"><option value="">qualquer nível</option>${Array.from({ length: ALERT_MAX + 1 }, (_, n) => `<option value="${n}" ${String(t.alertTo ?? "") === String(n) ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <p class="hint">Dispara quando o alerta da cena muda (efeito "Alerta: mudar o nível", ou os botões 🚨 no topo do painel). Use "Só se" para casos como "só se alguma porta estiver aberta".</p>` : `<div class="sub">${t.cause === "interact" ? "Objeto(s) que o jogador usa" : t.cause === "cameraSees" ? "Câmera(s)" : t.cause === "nodeState" ? "Nó(s) da Matriz" : t.cause === "heard" ? "Guarda(s)/câmera(s) que ouvem (vazio = qualquer um)" : t.cause === "destroyed" ? "Objeto(s) destrutível(is)" : t.cause === "chargeBlew" ? "Perto de (vazio = qualquer carga)" : `Zona(s)${t.cause === "manual" ? " (opcional: quem estiver em cima conta como quem ativou)" : ""}`}: ${chips(t.zones, "zones")}</div>`}
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
      <div class="sub">🔒 Restrito (opcional): só funciona se o personagem tiver o item (preso nele ou no inventário)</div>
      <input type="text" data-k="reqItem" value="${esc(t.reqItem || "")}" placeholder="nome do item (ex.: Cartão de acesso)" />
      ${String(t.reqItem || "").trim() ? `<input type="text" data-k="reqMsg" value="${esc(t.reqMsg || "")}" placeholder="${esc(REQ_DEFAULT)}" />
      <div class="row"><span class="hint">Sem o item, mostrar como:</span><select data-k="reqShow">${REQ_SHOW.map(([v, l]) => `<option value="${v}" ${(t.reqShow || "aviso") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="row"><label class="inline">gasta <input type="number" data-k="reqUses" min="0" step="1" value="${t.reqUses || 0}" /> uso(s) do item</label><span class="hint">(0 = não gasta; no último uso o item some)</span></div>
      <div class="sub">Cartão clonado: libera sem o item se este nó da Matriz estiver hackeado: ${chips(t.reqNodes, "reqNodes")}</div>
      <span class="hint">Vale o item preso no token ou guardado no <b>Inventário de mesa</b> do jogador (extensão Inventário, botão <i>Da cena</i> guarda e tira da cena; o inventário só é lido do jogador que controla o token). Para prender:  selecione o item, botão direito → Attach (prender), ou use o efeito Pegar item. Vale se o nome do item contiver esse texto. Só o jogador que tentou vê a mensagem; {item} e {quem} viram o nome do item e do personagem. O mestre usa sem o item. O nó é da extensão Vigilância (botão direito no item → Virar nó da Matriz).</span>` : ""}
      <div class="row">
        <label class="check"><input type="checkbox" data-k="glow" ${t.glow !== false ? "checked" : ""} /> Destacar com brilho</label>
        <input type="color" data-k="glowColor" value="${esc(t.glowColor || "#ffd34d")}" title="Cor do brilho" />
      </div>
      <div class="row">
        <label class="inline">círculo <input type="number" data-k="glowD" min="0" step="0.5" value="${Number(t.glowD) || 0}" /> quadrado(s) de diâmetro</label>
        <span class="hint">(0 = automático, um pouco maior que o objeto)</span>
      </div>
      <label class="check"><input type="checkbox" data-k="glowClick" ${t.glowClick !== false ? "checked" : ""} /> Clicar no círculo de destaque também usa o objeto (não precisa acertar o objeto)</label>` : ""}
      ${["enter", "leave", "near", "standAll"].includes(t.cause) ? `
      <select data-k="who"><option value="chars" ${t.who !== "list" ? "selected" : ""}>qualquer token (personagens e montarias)</option><option value="list" ${t.who === "list" ? "selected" : ""}>só estes tokens…</option></select>
      ${t.who === "list" ? `<div class="sub">${chips(t.tokens, "tokens")}</div>` : ""}
      <label class="check"><input type="checkbox" data-k="ignoreHidden" ${t.ignoreHidden !== false ? "checked" : ""} /> Tokens escondidos não ativam</label>` : ""}
      ${t.cause === "enter" ? `<label class="check" title="Em vez de ir até onde o jogador soltou, o token para no meio do caminho, em cima da zona. Vale para a Régua e para o arrasto."><input type="checkbox" data-k="halt" ${t.halt ? "checked" : ""} /> Parar o token em cima da zona (corta o resto do movimento)</label>` : ""}
      <h3>Só se (opcional)</h3>
      ${(t.conds || []).map((c) => condRow(t, c)).join("")}
      <div class="row"><button type="button" data-add-cond>+ condição</button>${(t.conds || []).length > 1 ? `<select data-k="condAny"><option value="0" ${!t.condAny ? "selected" : ""}>todas precisam valer</option><option value="1" ${t.condAny ? "selected" : ""}>basta uma valer</option></select>` : ""}</div>
      ${(t.conds || []).length && t.cause === "interact" ? `<input type="text" data-k="condMsg" value="${esc(t.condMsg || "")}" placeholder="Se não valer, o jogador vê: (padrão: Nada acontece.)" />` : ""}
      ${(t.conds || []).length ? '<span class="hint">Se a condição não valer, o gatilho não dispara e continua armado (não gasta o "uma vez" nem o cartão). O ⚡ do painel ignora as condições, para teste. Para uma porta que muda de comportamento, crie dois gatilhos no mesmo objeto, um com a condição e outro com a condição oposta.</span>' : ""}
      <div class="row">
        <select data-k="once"><option value="1" ${t.once ? "selected" : ""}>dispara uma vez (desarma)</option><option value="0" ${!t.once ? "selected" : ""}>dispara sempre</option></select>
        <label class="inline">atraso <input type="number" data-k="delay" min="0" step="0.5" value="${t.delay || 0}" /> s</label>
      </div>
      <h3>Então</h3>
      ${(t.effects || []).map((e) => effectRow(t, e)).join("")}
      <div class="row"><button type="button" data-add-effect>+ efeito</button><button type="button" class="danger" data-del-trigger>Apagar gatilho</button></div>
    </div>` : ""}`;

  div.querySelector(".name").addEventListener("click", () => { open = isOpen ? null : t.id; render(); });
  div.querySelector(".fire").addEventListener("click", () => OBR.broadcast.sendMessage(CH_FIRE, { id: t.id, force: true }, { destination: "LOCAL" }));
  for (const el of div.querySelectorAll("[data-k]")) {
    const k = el.dataset.k;
    el.addEventListener("change", () => {
      let v = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
      if (k === "once" || k === "condAny") v = v === "1";
      t[k] = v;
      save(k === "armed");
      if (["cause", "who", "armed", "name", "reqItem", "condAny"].includes(k)) render();
    });
  }
  for (const btn of div.querySelectorAll("[data-sel],[data-pick]")) {
    btn.addEventListener("click", async () => {
      const sel = btn.dataset.pick ? await pickItems({ door: isFogDoor }) : await selection();
      if (sel === null) return;
      const key = btn.dataset.sel || btn.dataset.pick;
      if (key === "zones") t.zones = sel;
      else if (key === "reqNodes") t.reqNodes = sel;
      else if (key === "tokens") t.tokens = sel;
      else if (key.startsWith("c:")) { const [, cid, field] = key.split(":"); const c = t.conds.find((x) => x.id === cid); if (c) c[field] = sel; }
      else {
        const [, eid, field] = key.split(":");
        const e = t.effects.find((x) => x.id === eid);
        if (field === "dest") e.dest = sel[0] || null;
        else if (field === "doorImgs") e.doorImgs = sel;
        else if (field === "shooter") { e.shooter = sel[0] || ""; e.weapon = ""; e.mode = ""; if (e.action === "npcAbility") e.ability = ""; }
        else {
          // linha vermelha/ícone da porta do fog do Owlbear → o fog dono + o número da porta
          const r = field === "targets" ? await resolveFogDoors(OBR, sel) : { ids: sel, idx: "" };
          if (field === "targets" && r.idx !== "") e.doorIdx = String(r.idx);
          e.targets = (e.targets || []).includes(ACTOR) ? [ACTOR, ...r.ids] : r.ids;
        }
      }
      if (!sel.length) OBR.notification.show("Gatilhos: selecione itens no mapa primeiro (a seleção ficou vazia).", "WARNING");
      await refreshNames();
      save(true); render();
    });
  }
  for (const row of div.querySelectorAll(".cond")) {
    const c = t.conds.find((x) => x.id === row.dataset.cid);
    if (!c) continue;
    for (const el of row.querySelectorAll("[data-ck]")) {
      el.addEventListener("change", () => {
        const k = el.dataset.ck;
        if (k === "type") { Object.assign(c, newCond(el.value), { id: c.id }); save(true); return render(); }
        c[k] = el.type === "number" ? Number(el.value) : el.value;
        if (k === "group") c.is = "";
        save();
        if (["group", "is", "op"].includes(k)) render();
      });
    }
    for (const el of row.querySelectorAll("[data-ckb]")) el.addEventListener("change", () => { c[el.dataset.ckb] = el.checked; save(); });
    row.querySelector("[data-del-cond]").addEventListener("click", () => { t.conds = t.conds.filter((x) => x !== c); save(true); render(); });
  }
  div.querySelector("[data-add-cond]")?.addEventListener("click", () => { t.conds = [...(t.conds || []), newCond("alert")]; save(true); render(); });
  for (const btn of div.querySelectorAll("[data-noshooter]")) {
    btn.addEventListener("click", () => { const e = t.effects.find((x) => x.id === btn.dataset.noshooter); e.shooter = ""; save(true); render(); });
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
        if (["action", "group", "who", "weapon", "fxSrc", "fxDur", "fxVis", "attachOp", "hoNome"].includes(el.dataset.ek)) render();
      });
    }
    for (const el of row.querySelectorAll("[data-ekb]")) el.addEventListener("change", () => { e[el.dataset.ekb] = el.checked; save(); });
    row.querySelector("[data-del-effect]").addEventListener("click", () => { t.effects = t.effects.filter((x) => x !== e); save(true); render(); });
  }
  div.querySelector("[data-add-effect]")?.addEventListener("click", () => { t.effects.push(newEffect("notify")); save(true); render(); });
  div.querySelector("[data-del-trigger]")?.addEventListener("click", () => { list = list.filter((x) => x !== t); save(true); render(); });
  return div;
}

function renderAlert() {
  const el = $("alert");
  if (!el) return;
  el.innerHTML = `<span class="hint">🚨 Alerta:</span> ${Array.from({ length: ALERT_MAX + 1 }, (_, n) => `<button type="button" class="mini${n === alertNow ? " on" : ""}" data-alert="${n}" title="${n ? `Nível ${n}` : "Sem alerta"}">${n}</button>`).join("")}`;
  for (const b of el.querySelectorAll("[data-alert]")) b.addEventListener("click", () => OBR.scene.setMetadata({ [ALERT]: { level: Number(b.dataset.alert), at: Date.now() } }));
}

function render() {
  renderAlert();
  const box = $("list");
  box.innerHTML = "";
  if (!list.length) box.innerHTML = '<p class="hint">Nenhum gatilho. Selecione no mapa a zona (uma armadilha escondida, uma forma, uma linha de "fio") e clique em <b>Novo gatilho com a seleção</b>, ou use o botão direito → <b>Criar gatilho com esta zona</b>.</p>';
  for (const t of list) box.appendChild(card(t));
  if (visuais.length) box.insertAdjacentHTML("beforeend", `<datalist id="gat-visuais">${visuais.flatMap(([, l]) => l).map((v) => `<option value="${esc(v)}"></option>`).join("")}</datalist>`);
  if (handoutsLib.length) box.insertAdjacentHTML("beforeend", `<datalist id="gat-handouts">${handoutsLib.map((h) => `<option value="${esc(h.titulo)}"></option>`).join("")}</datalist>`);
  $("log").innerHTML = logLines.length ? logLines.map((l) => `<div>${esc(l)}</div>`).join("") : '<span class="hint">Nada disparou ainda.</span>';
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  $("mapa").addEventListener("click", () => controls.modal.open({ id: `${ID}/mapa`, url: new URL(`${import.meta.env.BASE_URL}mapa.html`, window.location.href).href, width: 1040, height: 700 }).catch(() => OBR.notification.show("Não consegui abrir o mapa lógico.", "WARNING")));
  if ((await OBR.player.getRole()) !== "GM") return playerView();
  // lista de visuais do Arsenal (mesmo site): sugestões no efeito visual
  fetch(new URL("../arsenal/visuais.json", window.location.href), { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (Array.isArray(j?.grupos)) { visuais = j.grupos; render(); } }).catch(() => {});
  const loadHandouts = (m) => { const l = Array.isArray(m[HANDOUTS_BIB]) ? m[HANDOUTS_BIB] : []; if (JSON.stringify(l.map((h) => h.titulo)) !== JSON.stringify(handoutsLib.map((h) => h.titulo))) { handoutsLib = l; render(); } };
  OBR.room.getMetadata().then(loadHandouts).catch(() => {});
  OBR.room.onMetadataChange(loadHandouts);
  const load = async () => {
    await refreshNames();
    const md = await OBR.scene.getMetadata();
    list = Array.isArray(md[LIST]) ? md[LIST] : [];
    estados = Array.isArray(md[ESTADOS]) ? md[ESTADOS] : [];
    alertNow = alertLevel(md);
    render();
  };
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  OBR.scene.onMetadataChange((md) => {
    const next = Array.isArray(md[LIST]) ? md[LIST] : [];
    const est = Array.isArray(md[ESTADOS]) ? md[ESTADOS] : [];
    if (alertLevel(md) !== alertNow) { alertNow = alertLevel(md); renderAlert(); }
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
  main.innerHTML = `<h1>Gatilhos</h1><p class="hint">Objetos com brilho na cena podem ser usados: clique neles, use o botão direito → Interagir, ou o botão abaixo. Você precisa de um personagem perto.</p><div id="usable"></div><h2 style="margin-top:14px">Inventário</h2><div id="inv"></div>`;
  const draw = async () => {
    const [md, items, dpi, userId] = await Promise.all([OBR.scene.getMetadata(), OBR.scene.items.getItems(), OBR.scene.grid.getDpi().catch(() => 150), OBR.player.getId()]);
    const triggers = Array.isArray(md[LIST]) ? md[LIST] : [];
    const mine = items.filter((i) => isToken(i) && i.createdUserId === userId);
    const ids = [...new Set(triggers.filter(isInteract).flatMap((t) => t.zones || []))];
    const rows = [];
    for (const id of ids) {
      const it = items.find((i) => i.id === id);
      if (!it || (it.visible === false && !isFogDoor(it))) continue;
      const trs = usableTriggers(triggers, id, "PLAYER");
      if (!trs.length) continue;
      const reach = Math.max(...trs.map((t) => (t.reach > 0 ? t.reach : Infinity)));
      const ok = pickReacher(mine, zoneShape(it, dpi), reach === Infinity ? 0 : reach, dpi).ok;
      const door = isFogDoor(it);
      const locked = trs.some((t) => String(t.reqItem || "").trim());
      rows.push({ id, name: `${locked ? "🔒 " : ""}${it.text?.plainText?.trim() || (door ? `Porta (${doorIsOpen(it) ? "aberta" : "fechada"})` : it.name || "objeto")}`, ok });
    }
    rows.sort((a, b) => (b.ok - a.ok) || a.name.localeCompare(b.name, "pt-BR"));
    $("usable").innerHTML = rows.length ? `<div class="mlist">${rows.map((r) => `
      <div class="mrow"><span class="mname">${esc(r.name)}</span><span class="tag">${r.ok ? "ao alcance" : "longe"}</span>
      <button type="button" class="mini" data-use="${r.id}" ${r.ok ? "" : "disabled"}>Usar</button></div>`).join("")}</div>`
      : '<p class="hint">Nada para usar por aqui.</p>';
    for (const b of document.querySelectorAll("[data-use]")) b.addEventListener("click", () => tryInteract(b.dataset.use));
    // inventário: itens presos nos meus personagens; passar para um personagem ao lado
    const lines = [];
    for (const tk of mine) {
      for (const it of heldBy(tk.id, items)) {
        const near = items.filter((o) => isToken(o) && o.id !== tk.id && o.visible !== false && nearby(tk, o, dpi));
        const label = itemLabel(it) || "item";
        lines.push(`<div class="mrow"><span class="mname">${esc(label)}<small class="hint">com ${esc(tk.text?.plainText || tk.name || "personagem")}</small></span>`
          + (!canGive(it) ? '<span class="tag">fixo</span>' : near.length
            ? `<select data-giveto="${it.id}">${near.map((o) => `<option value="${o.id}">${esc(o.text?.plainText || o.name || "personagem")}</option>`).join("")}</select><button type="button" class="mini" data-give="${it.id}">Passar</button>`
            : '<span class="tag">ninguém ao lado</span>') + "</div>");
      }
    }
    $("inv").innerHTML = lines.length ? `<div class="mlist">${lines.join("")}</div>` : '<p class="hint">Nenhum item com seus personagens.</p>';
    for (const b of document.querySelectorAll("[data-give]")) b.addEventListener("click", () => {
      const to = document.querySelector(`[data-giveto="${b.dataset.give}"]`)?.value;
      if (to) OBR.broadcast.sendMessage(CH_GIVE, { itemId: b.dataset.give, toId: to }, { destination: "ALL" });
    });
  };
  if (await OBR.scene.isReady()) draw();
  OBR.scene.onReadyChange((r) => r && draw());
  OBR.scene.onMetadataChange(() => draw());
  let t = null;
  OBR.scene.items.onChange(() => { clearTimeout(t); t = setTimeout(draw, 150); });
}
