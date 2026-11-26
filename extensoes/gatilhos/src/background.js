import { controls } from "./visibility.js";
// Motor dos Gatilhos. Roda no navegador do MESTRE e vê qualquer movimento da cena,
// inclusive os que os jogadores fazem com os próprios tokens, sem depender de ferramenta especial.
// Nos jogadores, só mostra as mensagens na tela.
import OBR from "@owlbear-rodeo/sdk";
import { zoneShape, evaluate, haltPoint, routeFromPlan, itemsInZones, formation, pickReacher } from "./engine.js";
import { condsOk } from "./conditions.js";
import { involvedIds, animDoorPlan, META_DOOR } from "./shared.js";
import { INV_META, ID, LIST, ALERT, ESTADOS, ALERT_CAUSES, VIG_CAM, alertLevel, alertNext, alertMatches, CH_FIRE, CH_NOTE, CH_LOG, CH_PATH, CH_HALT, CH_INTERACT, FLAG, CLIMA, CLIMA_FLASH, LUZ, ESTADOS_SET, ARSENAL_FIRE, TROCADOR_SWAP, VIG_SEEN, VIG_NODE, VIG_SET, VIG_CAUSES, VIG_VISION, VIG_NOISE, VIG_HEARD, ARSENAL_DESTROYED, ARSENAL_BLAST, ARSENAL_DETONATE, ARSENAL_CAUSES, ARSENAL_FX, ARSENAL_FX_END, ARSENAL_HAB_USE, HANDOUTS_SHOW, handoutPara, CH_DENY, CH_GIVE, META_ITEM, hasRequired, findRequired, nodeHacked, isInvItem, canGive, holderOf, nearby, denyText, attachPos, SMOKE, isFogDoor, isSmokeDoor, doorIsOpen, doorIsLocked, setDoor, url, newTrigger, newEffect, isToken, isInteract } from "./shared.js";
import { startInteract, tryInteract } from "./interact.js";

let role = "PLAYER";
let myId = "";               // usuário deste navegador
let myConn = "";             // conexão deste navegador
const anchor = new Map();    // objeto interagível -> posição que o mestre deixou (jogador arrastou: volta)
let triggers = [];
let dpi = 150;
let gridSquare = true;
const prevPos = new Map();   // tokenId -> {x,y}
const prevVis = new Map();   // itemId -> visible
const memo = new Map();      // triggerId -> estado da avaliação (placas)
let lastItems = [];
let alertPrev = null;        // nível de alerta da última vez (para saber quando mudou)
const plans = new Map();     // tokenId -> { points, until } caminho que a Régua avisou
const frozen = new Map();    // tokenId -> { pos, until } token parado por um gatilho (segura contra passos atrasados da Régua)
const FREEZE_MS = 1500;
const same = (a, b) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

/**
 * Coloca itens em "pos" sem esbarrar em paredes: a névoa dinâmica barra tokens visíveis que atravessam parede
 * (como na Régua), mas deixa um token escondido passar. Então esconde, pula e mostra de novo (só quem estava visível).
 */
async function jump(ids, pos) {
  // pos: um ponto para todos, ou Map(id -> ponto)
  const at = (id) => (pos instanceof Map ? pos.get(id) : pos);
  const items = await OBR.scene.items.getItems(ids);
  const go = items.filter((i) => at(i.id) && !same(i.position, at(i.id)));
  if (!go.length) return;
  const shown = go.filter((i) => i.visible !== false).map((i) => i.id);
  const all = go.map((i) => i.id);
  if (shown.length) await OBR.scene.items.updateItems(shown, (d) => { for (const it of d) it.visible = false; });
  await OBR.scene.items.updateItems(all, (d) => { for (const it of d) it.position = { ...at(it.id) }; });
  if (shown.length) await OBR.scene.items.updateItems(shown, (d) => { for (const it of d) it.visible = true; });
}

/** Leva itens para um destino mantendo a formação, sem esbarrar em paredes, e segura eles lá por um instante. */
async function sendTo(items, dest) {
  const pos = formation(items, dest);
  for (const [id, p] of pos) {
    prevPos.set(id, { ...p });
    frozen.set(id, { pos: { ...p }, until: Date.now() + FREEZE_MS });
    plans.delete(id);
    OBR.broadcast.sendMessage(CH_HALT, { tokenId: id, at: p, upto: -1 }, { destination: "ALL" }).catch(() => {});
  }
  return jump([...pos.keys()], pos);
}

const warn = (text) => OBR.notification.show(`Gatilhos: ${text}`, "WARNING");

/**
 * Quem "ativou" o gatilho. Com movimento é o token que se moveu (nas placas, todos que estão em cima delas).
 * Sem movimento (só quando eu disparar, ⚡, a zona aparece/some): quem está em cima da zona;
 * se a zona estiver vazia ou não houver zona, os tokens que o mestre tem selecionados.
 * who: "actor" (essa regra) | "zone" (só quem está na zona) | "selected" (só a seleção do mestre)
 */
async function actors(trigger, ctx, who = "actor") {
  // "quem ativou" é decidido uma vez por disparo: todos os efeitos falam das mesmas pessoas,
  // mesmo que um teleporte anterior já tenha tirado elas da zona
  if (who === "actor" && ctx.actorIds) {
    const items = await OBR.scene.items.getItems(ctx.actorIds);
    return items;
  }
  const items = await OBR.scene.items.getItems();
  const byId = new Map(items.map((i) => [i.id, i]));
  const inZone = () => {
    const shapes = (trigger.zones || []).map((id) => byId.get(id)).filter(Boolean).map((it) => zoneShape(it, dpi));
    return shapes.length ? itemsInZones(items.filter(isToken).filter(allowedFor(trigger)), shapes) : [];
  };
  const selected = async () => ((await OBR.player.getSelection().catch(() => [])) || []).map((id) => byId.get(id)).filter(Boolean);
  if (who === "zone") return inZone();
  if (who === "selected") return selected();
  if (ctx.on?.length) return ctx.on.map((id) => byId.get(id)).filter(Boolean);
  if (ctx.by) return [byId.get(ctx.by.id)].filter(Boolean);
  const z = inZone();
  return z.length ? z : selected();
}

/** Itens de um efeito; "@quem" na lista vira quem ativou. */
async function targetsOf(e, trigger, ctx) {
  const ids = (e.targets || []).filter(Boolean);
  if (!ids.includes("@quem")) return ids;
  const who = (await actors(trigger, ctx)).map((i) => i.id);
  return [...new Set([...ids.filter((x) => x !== "@quem"), ...who])];
}

/** Para o token em "pos": corta o resto do movimento da Régua e segura o token ali por um instante. */
function haltToken(id, pos) {
  prevPos.set(id, { ...pos });
  frozen.set(id, { pos: { ...pos }, until: Date.now() + FREEZE_MS });
  plans.delete(id);
  OBR.broadcast.sendMessage(CH_HALT, { tokenId: id, at: pos, upto: -1 }, { destination: "ALL" }).catch(() => {});
  return jump([id], pos);
}

/** Quem pode disparar este gatilho. */
const allowedFor = (tr) => (t) => (tr.who === "list" ? (tr.tokens || []).includes(t.id) : true)
  && !(tr.ignoreHidden !== false && t.visible === false)
  && !(tr.zones || []).includes(t.id);

const names = (it) => it?.text?.plainText || it?.name || "item";

async function saveTriggers(mut) {
  const md = await OBR.scene.getMetadata();
  const list = Array.isArray(md[LIST]) ? md[LIST] : [];
  const next = mut(JSON.parse(JSON.stringify(list)));
  await OBR.scene.setMetadata({ [LIST]: next });
}

function log(text) {
  OBR.broadcast.sendMessage(CH_LOG, { text, at: Date.now() }, { destination: "LOCAL" }).catch(() => {});
}

// espera e efeitos com atraso ficam registrados por gatilho, para dar para cancelar a sequência (efeito "Cancelar sequência")
const pending = new Map(); // triggerId -> Map(timeoutId -> resolve | null)
function later(trigId, secs, fn, resolve = null) {
  const m = pending.get(trigId) || pending.set(trigId, new Map()).get(trigId);
  const tid = setTimeout(() => { m.delete(tid); fn(); }, Math.max(0, secs) * 1000);
  m.set(tid, resolve);
}
const sleep = (trigId, secs) => new Promise((res) => later(trigId, secs, () => res(true), res)); // false = cancelado
/** Cancela o que está esperando: de um gatilho, ou de todos (menos "keep"). Devolve quantos. */
function cancelPending(trigId, keep = "") {
  let n = 0;
  for (const [id, m] of pending) {
    if ((trigId && id !== trigId) || id === keep) continue;
    for (const [tid, res] of m) { clearTimeout(tid); n++; if (res) res(false); }
    m.clear();
  }
  return n;
}

// botão direito num item: submenu "Gatilhos" (lista de menu.html) com os gatilhos de que o item faz parte: armar/desarmar e ativar
let menuSig = "";
let menuBusy = false, menuAgain = false;
async function syncMenu() {
  if (role !== "GM") return;
  if (menuBusy) { menuAgain = true; return; }
  menuBusy = true;
  try {
    do {
      menuAgain = false;
      const per = new Map(); // item -> quantos gatilhos usam
      for (const t of triggers) for (const id of involvedIds(t)) per.set(id, (per.get(id) || 0) + 1);
      // o filtro do Owlbear junta as condições com "e"; para "este item OU aquele" cada uma leva coordinator "||" (como o Clima faz)
      const ids = [...per.keys()].slice(0, 600);
      const height = Math.max(70, Math.min(340, Math.max(0, ...per.values()) * 38 + 54));
      const sig = JSON.stringify([ids, height]);
      if (sig === menuSig) continue;
      if (!ids.length) await controls.contextMenu.remove(`${ID}/lista`).catch(() => {});
      else await controls.contextMenu.create({
        id: `${ID}/lista`,
        icons: [{ icon: url("icon.svg"), label: "Gatilhos deste item", filter: { roles: ["GM"], every: ids.map((x, i) => (i < ids.length - 1 ? { key: "id", value: x, coordinator: "||" } : { key: "id", value: x })) } }],
        embed: { url: url("menu.html"), height },
      }).catch(() => {});
      menuSig = sig;
    } while (menuAgain);
  } finally { menuBusy = false; }
}

/** Inventário de mesa de cada jogador na sala: { idDoJogador: [nomes] } (metadado publicado pela extensão Inventário). */
async function inventories() {
  const out = {};
  const put = (id, md) => { const l = md?.[INV_META]; if (id && Array.isArray(l)) out[id] = l.map(String); };
  try { put(await OBR.player.getId(), await OBR.player.getMetadata()); } catch { /* sem sala */ }
  try { for (const p of await OBR.party.getPlayers()) put(p.id, p.metadata); } catch { /* sem sala */ }
  return out;
}

/** As condições do gatilho valem agora? */
async function checkConds(trigger, ctx) {
  const [items, md] = await Promise.all([OBR.scene.items.getItems(), OBR.scene.getMetadata()]);
  const actorIds = (trigger.conds || []).some((c) => c.type === "has") ? (await actors(trigger, ctx).catch(() => [])).map((i) => i.id) : [];
  return condsOk(trigger, { alert: alertLevel(md), items, groups: Array.isArray(md[ESTADOS]) ? md[ESTADOS] : [], dpi, zones: trigger.zones || [], actorIds, inv: actorIds.length ? await inventories() : {} });
}

/** Executa os efeitos de um gatilho. ctx: { by (token), at (entrada), from } */
async function run(trigger, ctx = {}, depth = 0) {
  if (depth > 8) return; // proteção contra corrente infinita
  // condição: se não valer, não dispara e não gasta o "uma vez" (o gatilho continua armado)
  if (!ctx.force && !ctx.condsOk && (trigger.conds || []).length && !(await checkConds(trigger, ctx).catch(() => true))) {
    if (trigger.once) trigger.armed = true;
    log(`⏸ ${trigger.name}: condição não cumprida`);
    return;
  }
  if (trigger.once) saveTriggers((l) => l.map((t) => (t.id === trigger.id ? { ...t, armed: false } : t))).catch(() => {});
  log(`⚡ ${trigger.name}${ctx.by ? ` (por ${names(ctx.by)})` : ""}${ctx.force ? " (forçado)" : ""}`);
  if (trigger.delay && !(await sleep(trigger.id, trigger.delay))) return;
  if (!ctx.actorIds) ctx = { ...ctx, actorIds: (await actors(trigger, ctx).catch(() => [])).map((i) => i.id) };
  for (const e of trigger.effects || []) {
    const go = async () => {
      try { await doEffect(e, ctx, depth, trigger); } catch (err) { console.error(`[${ID}]`, err); }
    };
    if (e.delay) later(trigger.id, e.delay, go); else await go();
  }
}

async function doEffect(e, ctx, depth, trigger) {
  const ids = await targetsOf(e, trigger, ctx);
  const upd = (fn) => (ids.length ? OBR.scene.items.updateItems(ids, (d) => { for (const it of d) fn(it); }) : null);
  switch (e.action) {
    case "show": return upd((it) => { it.visible = true; });
    case "hide": return upd((it) => { it.visible = false; });
    case "toggle": return upd((it) => { it.visible = !it.visible; });
    case "lock": return upd((it) => { it.locked = true; });
    case "unlock": return upd((it) => { it.locked = false; });
    case "delete": return ids.length ? OBR.scene.items.deleteItems(ids) : null;
    case "notify": {
      let text = e.text || "Algo aconteceu…";
      if (text.includes("{quem}")) {
        const who = (await actors(trigger, ctx)).map(names);
        const list = who.length > 1 ? `${who.slice(0, -1).join(", ")} e ${who[who.length - 1]}` : who[0] || "alguém";
        text = text.replaceAll("{quem}", list);
      }
      if (text.includes("{nivel}")) text = text.replaceAll("{nivel}", String(ctx.level ?? alertLevel(await OBR.scene.getMetadata())));
      return OBR.broadcast.sendMessage(CH_NOTE, { text, audience: e.audience || "all" }, { destination: "ALL" });
    }
    case "alarm": {
      // nível de alerta da cena (0 a 3): subir, descer, ir para um nível ou zerar; os gatilhos "O nível de alerta mudou" reagem
      const cur = alertLevel(await OBR.scene.getMetadata());
      const next = alertNext(cur, e.alarmOp || "up", e.alarmTo);
      if (next === cur) return null;
      log(`🚨 Alerta ${cur} → ${next}`);
      return OBR.scene.setMetadata({ [ALERT]: { level: next, at: Date.now() } });
    }
    case "cancel": {
      // tira da espera os efeitos com atraso de um gatilho (vazio = de todos os outros)
      const n = cancelPending(e.trigger || "", trigger.id);
      return log(`⏹ ${n} efeito(s) com atraso cancelado(s)${e.trigger ? "" : " (todas as sequências)"}`);
    }
    case "lightning":
      return OBR.broadcast.sendMessage(CLIMA_FLASH, {}, { destination: "ALL" });
    case "weatherOn":
    case "weatherOff":
      return upd((it) => { for (const l of it.metadata?.[CLIMA] || []) l.on = e.action === "weatherOn"; });
    case "lightColor":
      return upd((it) => { it.metadata[LUZ] = { ...(it.metadata[LUZ] || { intensity: 0.7 }), color: e.color, anim: e.anim || "none" }; });
    case "teleport": {
      if (!e.dest) return warn(`"${trigger.name}": o teleporte está sem destino.`);
      const [dest] = await OBR.scene.items.getItems([e.dest]);
      if (!dest) return warn(`"${trigger.name}": o destino do teleporte foi apagado.`);
      const who = (await actors(trigger, ctx, e.who || "actor")).filter((i) => i.id !== dest.id);
      if (!who.length) {
        return warn(`"${trigger.name}": ninguém para teleportar. Sem movimento, ele leva quem está em cima da zona; se ela estiver vazia, os tokens que você selecionar.`);
      }
      return sendTo(who, dest.position);
    }
    case "moveTo": {
      if (!e.dest || !ids.length) return;
      const [dest] = await OBR.scene.items.getItems([e.dest]);
      if (!dest) return;
      return sendTo(await OBR.scene.items.getItems(ids), dest.position);
    }
    case "stop": {
      if (!ctx.by || !ctx.from) return depth ? null : warn(`"${trigger.name}": "Barrar" só funciona quando alguém se move (entrar, sair ou chegar perto).`);
      // sair: volta para onde estava, ainda dentro
      if ((ctx.cause || trigger.cause) === "leave") return haltToken(ctx.by.id, ctx.from);
      if (!ctx.at) return;
      // volta meio quadrado antes da entrada e encaixa mantendo o alinhamento de onde o token veio
      const dx = ctx.at.x - ctx.from.x, dy = ctx.at.y - ctx.from.y, L = Math.hypot(dx, dy) || 1;
      let p = { x: ctx.at.x - (dx / L) * dpi * 0.5, y: ctx.at.y - (dy / L) * dpi * 0.5 };
      if (gridSquare) p = { x: ctx.from.x + Math.round((p.x - ctx.from.x) / dpi) * dpi, y: ctx.from.y + Math.round((p.y - ctx.from.y) / dpi) * dpi };
      return haltToken(ctx.by.id, p);
    }
    case "stateSet":
      // a extensão Estados faz a troca (ela só executa uma vez, mesmo com dois mestres)
      return e.group ? OBR.broadcast.sendMessage(ESTADOS_SET, { group: e.group, to: e.to || "next" }, { destination: "ALL" }) : null;
    case "arsenal": {
      // o Arsenal faz o disparo (só um mestre executa); "@quem" nos alvos vira quem ativou
      if (!e.shooter) return warn(`"${trigger.name}": o disparo do Arsenal está sem atirador.`);
      const tg = ids.filter((id) => id !== e.shooter);
      if (!tg.length) return warn(`"${trigger.name}": o disparo do Arsenal está sem alvo (use "+ quem ativou" para atirar em quem pisou na zona).`);
      const hit = e.hit === "miss" ? false : e.hit === "half" ? Math.random() < 0.5 : true;
      return OBR.broadcast.sendMessage(ARSENAL_FIRE, { shooter: e.shooter, weapon: e.weapon || undefined, mode: e.mode || undefined, targets: tg.map((id) => ({ id })), hit, from: trigger.name }, { destination: "ALL" });
    }
    case "swapImage":
      // o Trocador faz a troca (só um mestre executa); "@quem" nos alvos vira quem ativou
      if (!ids.length) return warn(`"${trigger.name}": trocar imagem está sem alvo.`);
      return OBR.broadcast.sendMessage(TROCADOR_SWAP, { targets: ids, to: e.image || "next", from: trigger.name }, { destination: "ALL" });
    case "floor": {
      // a extensão Estados troca o andar; quem ativou (quem usou a escada) vai junto, se marcado
      if (!e.group) return warn(`"${trigger.name}": mudar de andar está sem prédio.`);
      const carry = e.carry !== false ? (await actors(trigger, ctx)).map((i) => i.id) : [];
      return OBR.broadcast.sendMessage(ESTADOS_SET, { group: e.group, to: e.to || "next", carry }, { destination: "ALL" });
    }
    case "vision":
      if (!ids.length) return warn(`"${trigger.name}": ligar/desligar visão está sem token.`);
      return OBR.broadcast.sendMessage(VIG_VISION, { targets: ids, mode: e.visionMode || "termica", on: e.visionOn !== "off", from: trigger.name }, { destination: "ALL" });
    case "charge":
      // o Arsenal detona ou desarma (só um mestre executa); alvo = a carga, ou o objeto onde ela está colada
      if (!ids.length) return warn(`"${trigger.name}": a carga está sem alvo (escolha a carga ou o objeto onde ela está colada).`);
      return OBR.broadcast.sendMessage(ARSENAL_DETONATE, { ids, op: e.chargeOp || "detonar", from: trigger.name }, { destination: "ALL" });
    case "door": {
      // porta da névoa (Smoke & Spectre, ou a névoa do próprio Owlbear): abre/fecha a linha para todos
      const doors = (ids.length ? await OBR.scene.items.getItems(ids) : []).filter(isFogDoor);
      if (!doors.length) return warn(`"${trigger.name}": nenhum desses itens é porta da névoa (no Smoke & Spectre: botão direito na linha → Enable Door).`);
      const op = e.doorOp || "alternar";
      // tranca do Smoke: porta trancada não abre por gatilho (use "destrancar" antes)
      const stuck = op === "abrir" || op === "alternar" ? doors.filter((d) => doorIsLocked(d) && !doorIsOpen(d)) : [];
      if (stuck.length) OBR.broadcast.sendMessage(CH_NOTE, { text: stuck.length > 1 ? "As portas estão trancadas." : "A porta está trancada.", audience: "all" }, { destination: "ALL" }).catch(() => {});
      const go = doors.filter((d) => !stuck.includes(d)).map((d) => d.id);
      return go.length ? OBR.scene.items.updateItems(go, (d) => { for (const it of d) setDoor(it, op); }) : null;
    }
    case "animDoor": {
      // porta animada: toca o vídeo (VFX do Arsenal), espera a animação, troca a imagem (Trocador) e abre/fecha a linha da porta da névoa
      const lines = (ids.length ? await OBR.scene.items.getItems(ids) : []).filter(isFogDoor);
      const imgIds = (e.doorImgs || []).filter(Boolean);
      const imgs = imgIds.length ? await OBR.scene.items.getItems(imgIds) : [];
      if (!lines.length && !imgs.length) return warn(`"${trigger.name}": a porta animada está sem a linha da porta nem a imagem dela.`);
      const state = lines.length ? doorIsOpen(lines[0]) : imgs[0]?.metadata?.[META_DOOR]?.open === true;
      const p = animDoorPlan(e, state);
      if (p.noop) return null;
      if (p.opening && lines.some((d) => doorIsLocked(d) && !doorIsOpen(d))) {
        return OBR.broadcast.sendMessage(CH_NOTE, { text: lines.length > 1 ? "As portas estão trancadas." : "A porta está trancada.", audience: "all" }, { destination: "ALL" });
      }
      if (p.url) {
        const where = imgs.length ? imgs.map((i) => i.id) : lines.map((i) => i.id);
        OBR.broadcast.sendMessage(ARSENAL_FX, {
          video: { url: p.url, tipo: e.fxTipo || "area", giro: Number(e.fxGiro) || 0 }, targets: where, dur: 0,
          tamanho: Number(e.fxSize) > 0 ? Number(e.fxSize) : undefined, tag: (e.fxTag || "").trim() || trigger.name, origem: trigger.name,
        }, { destination: "ALL" }).catch(() => {});
      }
      const finish = async () => {
        if (imgs.length) OBR.broadcast.sendMessage(TROCADOR_SWAP, { targets: imgs.map((i) => i.id), to: p.to, from: trigger.name }, { destination: "ALL" }).catch(() => {});
        if (lines.length) await OBR.scene.items.updateItems(lines.map((d) => d.id), (d) => { for (const it of d) setDoor(it, p.opening ? "abrir" : "fechar"); });
        if (imgs.length) await OBR.scene.items.updateItems(imgs.map((i) => i.id), (d) => { for (const it of d) it.metadata[META_DOOR] = { open: p.opening }; });
      };
      log(`🚪 ${trigger.name}: ${p.opening ? "abrindo" : "fechando"}${p.wait ? ` (em ${p.wait} s)` : ""}`);
      if (p.wait > 0) { later(trigger.id, p.wait, () => finish().catch((err) => console.error(`[${ID}]`, err))); return null; }
      return finish();
    }
    case "attach": {
      // pegar item: o item (cartão, chave…) fica preso no token e anda com ele; soltar larga onde está
      const its = (ids.length ? await OBR.scene.items.getItems(ids) : []).filter((i) => !isToken(i));
      if (!its.length) return warn(`"${trigger.name}": pegar item está sem o item (escolha o cartão, a chave… em "Itens").`);
      if ((e.attachOp || "prender") === "soltar") {
        const held = its.filter((i) => i.attachedTo).map((i) => i.id);
        return held.length ? OBR.scene.items.updateItems(held, (d) => { for (const it of d) delete it.attachedTo; }) : null;
      }
      const holder = (await actors(trigger, ctx, e.attachWho === "selected" ? "selected" : "actor")).find((i) => isToken(i) && !its.some((x) => x.id === i.id));
      if (!holder) return warn(`"${trigger.name}": ninguém para pegar o item (sem movimento: quem está em cima da zona ou o token selecionado).`);
      const pos = new Map(its.map((i) => [i.id, attachPos(i, holder, e.attachPlace || "canto", dpi)]));
      for (const id of pos.keys()) anchor.delete(id);
      await OBR.scene.items.updateItems([...pos.keys()], (d) => {
        for (const it of d) {
          it.attachedTo = holder.id; it.position = { ...pos.get(it.id) };
          it.metadata[META_ITEM] = { give: e.attachGive !== false };
          if (e.attachShow !== false) it.visible = true;
          if (e.attachLock !== false) it.locked = true;
        }
      });
      return log(`🪪 ${names(holder)} pegou ${its.map(names).join(", ")}`);
    }
    case "fx": {
      // o Arsenal toca o vídeo para todos (só um mestre executa); sem "sai de", fica em cima de cada item
      if (!ids.length && !e.shooter) return warn(`"${trigger.name}": o efeito visual está sem alvo (escolha itens ou "+ quem ativou").`);
      const link = e.fxSrc === "link";
      if (link ? !/^https?:\/\/\S+$/i.test((e.fxUrl || "").trim()) : !(e.fxVis || "").trim()) return warn(`"${trigger.name}": o efeito visual está sem ${link ? "link (https://…/efeito.webm)" : "nome do visual"}.`);
      const dur = e.fxDur === "loop" ? "fim" : e.fxDur === "secs" ? Math.max(1, Number(e.fxSecs) || 10) : 0;
      return OBR.broadcast.sendMessage(ARSENAL_FX, {
        visual: link ? undefined : e.fxVis.trim(), video: link ? { url: e.fxUrl.trim(), tipo: e.fxTipo || "area", giro: Number(e.fxGiro) || 0 } : undefined,
        from: e.shooter || undefined, targets: ids.filter((id) => id !== e.shooter), dur, tamanho: Number(e.fxSize) > 0 ? Number(e.fxSize) : undefined,
        tag: (e.fxTag || "").trim() || trigger.name, origem: trigger.name,
      }, { destination: "ALL" });
    }
    case "handout": {
      // a extensão Handouts abre a janela (imagem por link + texto) para quem deve ver
      const nome = (e.hoNome || "").trim(), titulo = (e.hoTitulo || "").trim(), imagem = (e.hoImg || "").trim(), texto = e.hoTexto || "";
      if (!nome && !titulo && !imagem && !texto.trim()) return warn(`"${trigger.name}": o handout está vazio (escolha um da biblioteca ou escreva título, imagem ou texto).`);
      if (imagem && !/^https?:\/\/\S+$/i.test(imagem)) return warn(`"${trigger.name}": o link da imagem do handout precisa começar com http:// ou https://.`);
      const who = (e.hoPara || "actor") === "actor" ? await actors(trigger, ctx) : [];
      const to = handoutPara(e.hoPara || "actor", who);
      if (to.semDono) warn(`"${trigger.name}": quem ativou não tem jogador dono; o handout foi só para o mestre.`);
      const list = who.map(names), quem = list.length > 1 ? `${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}` : list[0] || "alguém";
      return OBR.broadcast.sendMessage(HANDOUTS_SHOW, { nome, titulo: titulo.replaceAll("{quem}", quem), imagem, texto: texto.replaceAll("{quem}", quem), para: to.para, origem: trigger.name }, { destination: "ALL" });
    }
    case "fxEnd":
      return OBR.broadcast.sendMessage(ARSENAL_FX_END, { tag: (e.fxTag || "").trim(), origem: trigger.name }, { destination: "ALL" });
    case "npcAbility":
      // o Arsenal usa a habilidade do dossiê (animação, quem ficou na área, contadores); o mestre rola os dados
      if (!e.shooter || !e.ability) return warn(`"${trigger.name}": a habilidade de NPC está sem ${e.shooter ? "habilidade" : "NPC"}.`);
      return OBR.broadcast.sendMessage(ARSENAL_HAB_USE, { token: e.shooter, nome: e.ability, targets: ids.filter((id) => id !== e.shooter), origem: trigger.name }, { destination: "ALL" });
    case "camPower":
    case "nodeSet": {
      // a Vigilância faz a troca (só um mestre executa)
      if (!ids.length) return warn(`"${trigger.name}": ${e.action === "camPower" ? "ligar/desligar câmera" : "mudar estado do nó"} está sem alvo.`);
      const state = e.action === "camPower" ? (e.power === "on" ? "ativo" : "desativado") : e.nodeState || "hackeado";
      return OBR.broadcast.sendMessage(VIG_SET, { targets: ids, state, from: trigger.name }, { destination: "ALL" });
    }
    case "noise": {
      // barulho no lugar de cada item escolhido (ou de quem ativou); a Vigilância calcula quem ouve
      const src = ids.length ? await OBR.scene.items.getItems(ids) : [];
      if (!src.length) return warn(`"${trigger.name}": fazer barulho está sem item (escolha de onde sai o barulho).`);
      const raio = Math.max(1, Number(e.noiseRaio) || 10);
      for (const s of src) OBR.broadcast.sendMessage(VIG_NOISE, { x: s.position.x, y: s.position.y, raio, origem: trigger.name, quem: s.id }, { destination: "ALL" }).catch(() => {});
      return;
    }
    case "chain":
    case "rearm": {
      const t = triggers.find((x) => x.id === e.trigger);
      if (!t) return;
      if (e.action === "rearm") return saveTriggers((l) => l.map((x) => (x.id === t.id ? { ...x, armed: true } : x)));
      return run(t, { ...ctx, condsOk: false }, depth + 1);
    }
    case "broadcast": {
      let data = e.text;
      try { data = JSON.parse(e.text); } catch { /* texto puro */ }
      return e.channel ? OBR.broadcast.sendMessage(e.channel, data, { destination: "ALL" }) : null;
    }
    default: return null;
  }
}

/** Só um mestre executa pedidos de jogadores (se houver dois mestres na sala). */
async function isLeader() {
  const gms = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role === "GM").map((p) => p.connectionId);
  return [myConn, ...gms].sort()[0] === myConn;
}

/** Jogador (ou o mestre) usou um objeto interagível: confere quem pode e o alcance, e dispara. */
async function handleInteract(itemId, userId, senderRole) {
  const items = await OBR.scene.items.getItems();
  const it = items.find((i) => i.id === itemId);
  if (!it) return;
  const shape = zoneShape(it, dpi);
  let blocked = "", did = false; // nada aconteceu porque a condição não valeu: o jogador vê a mensagem
  for (const tr of triggers) {
    if (!isInteract(tr) || !(tr.zones || []).includes(itemId)) continue;
    if ((tr.canUse === "players" && senderRole === "GM") || (tr.canUse === "gm" && senderRole !== "GM")) continue;
    // quem ativou: o token do jogador mais perto do objeto (o mestre: o personagem mais perto, sem limite de alcance)
    const pool = items.filter((i) => isToken(i) && (senderRole === "GM" || i.createdUserId === userId));
    const reach = senderRole === "GM" ? 0 : tr.reach ?? 1;
    let r = pickReacher(pool, shape, reach, dpi);
    if (!r.ok) continue;
    // condição (alerta, nó, porta…): antes do restrito, para não gastar o cartão à toa
    if ((tr.conds || []).length && !(await checkConds(tr, { by: r.token || undefined, cause: "interact" }).catch(() => true))) {
      log(`⏸ ${tr.name}: condição não cumprida`);
      if (senderRole !== "GM") blocked = blocked || tr.condMsg || "Nada acontece.";
      continue;
    }
    // restrito: só um personagem (ao alcance) com o item preso nele usa; o mestre usa sem o item
    let spend = null; // item do restrito que se gasta nesta passagem
    const hacked = nodeHacked(items, tr.reqNodes); // cartão clonado: o nó da Matriz hackeado libera sem o item
    if (String(tr.reqItem || "").trim() && senderRole !== "GM" && !hacked) {
      const inv = await inventories();
      const withItem = pool.filter((t) => hasRequired(t.id, items, tr.reqItem, inv));
      const r2 = withItem.length ? pickReacher(withItem, shape, reach, dpi) : { ok: false };
      if (!r2.ok) {
        const who = r.token ? names(r.token) : "";
        log(`🔒 ${tr.name}: ${who || "jogador"} sem ${tr.reqItem}`);
        OBR.broadcast.sendMessage(CH_DENY, { to: userId, title: tr.name, text: denyText(tr, who), show: tr.reqShow || "aviso" }, { destination: "ALL" }).catch(() => {});
        continue;
      }
      r = r2;
      if (Number(tr.reqUses) > 0) spend = findRequired(r.token.id, items, tr.reqItem);
    }
    if (tr.once) tr.armed = false;
    if (spend) spendItem(spend, tr, r.token);
    did = true;
    run(tr, { by: r.token || undefined, at: it.position, cause: "interact", on: r.token ? undefined : [], condsOk: true });
  }
  if (blocked && !did) OBR.broadcast.sendMessage(CH_DENY, { to: userId, title: it.text?.plainText?.trim() || it.name || "Objeto", text: blocked, show: "aviso" }, { destination: "ALL" }).catch(() => {});
}

/** Gasta um uso do item do restrito; no último uso o item some. */
async function spendItem(item, tr, token) {
  const total = Number(tr.reqUses);
  const left = (Number(item.metadata?.[`${ID}/usos`] ?? total)) - 1;
  if (left <= 0) {
    await OBR.scene.items.deleteItems([item.id]).catch(() => {});
    OBR.broadcast.sendMessage(CH_NOTE, { text: `${names(token)}: ${names(item)} foi gasto.`, audience: "all" }, { destination: "ALL" }).catch(() => {});
    log(`🪪 ${names(item)} gasto (${names(token)})`);
  } else {
    await OBR.scene.items.updateItems([item.id], (d) => { for (const it of d) it.metadata[`${ID}/usos`] = left; }).catch(() => {});
    log(`🪪 ${names(item)}: restam ${left} uso(s)`);
  }
}

/** Jogador passa um item para outro personagem ao lado (o mestre confere e executa). */
async function handleGive(itemId, toId, userId) {
  const items = await OBR.scene.items.getItems();
  const item = items.find((i) => i.id === itemId);
  const to = items.find((i) => i.id === toId);
  const deny = (text) => OBR.broadcast.sendMessage(CH_DENY, { to: userId, title: "Passar item", text, show: "aviso" }, { destination: "ALL" }).catch(() => {});
  if (!item || !to || !isInvItem(item) || !isToken(to)) return;
  const from = holderOf(item, items);
  if (!from || from.createdUserId !== userId) return deny("Esse item não está com um personagem seu.");
  if (!canGive(item)) return deny(`${names(item)} não pode ser passado adiante.`);
  if (from.id === to.id) return;
  if (!nearby(from, to, dpi)) return deny(`${names(to)} está longe: chegue ao lado para passar ${names(item)}.`);
  await OBR.scene.items.updateItems([item.id], (d) => { for (const it of d) { it.attachedTo = to.id; it.position = { ...attachPos(it, to, "canto", dpi) }; } });
  OBR.broadcast.sendMessage(CH_NOTE, { text: `${names(from)} passou ${names(item)} para ${names(to)}.`, audience: "all" }, { destination: "ALL" }).catch(() => {});
  log(`🪪 ${names(from)} → ${names(to)}: ${names(item)}`);
}

/** Marca no item quem é interagível (para o menu "Interagir") e tira a marca de quem deixou de ser. */
let flagging = false;
function syncFlags(items) {
  if (flagging) return;
  const want = new Set(triggers.filter(isInteract).flatMap((t) => t.zones || []));
  const fix = items.filter((i) => !!i.metadata?.[FLAG] !== want.has(i.id));
  if (!fix.length) return;
  flagging = true;
  OBR.scene.items.updateItems(fix.map((i) => i.id), (d) => { for (const it of d) it.metadata[FLAG] = want.has(it.id) ? true : undefined; })
    .catch(() => {}).finally(() => { flagging = false; });
}

/** Objeto interagível arrastado por um jogador volta para o lugar (mudanças do mestre e do Estados valem). */
function guardInteractables(items) {
  const want = new Set(triggers.filter(isInteract).flatMap((t) => t.zones || []));
  const back = [];
  for (const it of items) {
    if (!want.has(it.id) || it.attachedTo) { anchor.delete(it.id); continue; } // preso num token: anda com ele
    const a = anchor.get(it.id);
    if (!a || it.lastModifiedUserId === myId) { anchor.set(it.id, { ...it.position }); continue; }
    if (!same(a, it.position)) back.push([it.id, a]);
  }
  if (back.length) {
    const pos = new Map(back);
    OBR.scene.items.updateItems([...pos.keys()], (d) => { for (const it of d) it.position = { ...pos.get(it.id) }; }).catch(() => {});
  }
}

/** Avalia todos os gatilhos com a cena atual. */
function check(items) {
  lastItems = items;
  syncFlags(items);
  guardInteractables(items);
  const byId = new Map(items.map((i) => [i.id, i]));
  const tokens = items.filter(isToken);
  const moves = [];
  const now = Date.now();
  for (const t of tokens) {
    const fz = frozen.get(t.id);
    if (fz && now < fz.until) {
      // passo atrasado da Régua depois de parar: devolve o token para onde o gatilho mandou
      if (!same(fz.pos, t.position)) jump([t.id], fz.pos).catch(() => {});
      prevPos.set(t.id, { ...fz.pos });
      continue;
    }
    if (fz) frozen.delete(t.id);
    const p = prevPos.get(t.id);
    if (p && (p.x !== t.position.x || p.y !== t.position.y)) {
      const plan = plans.get(t.id);
      const route = plan && now < plan.until ? routeFromPlan(plan.points, p, t.position) : null;
      moves.push({ token: t, from: p, to: t.position, route });
    }
    prevPos.set(t.id, { ...t.position });
  }
  const zoneIds = new Set(triggers.flatMap((t) => t.zones || []));
  const zones = new Map();
  for (const id of zoneIds) { const it = byId.get(id); if (it) zones.set(id, zoneShape(it, dpi)); }

  const fired = [];
  for (const tr of triggers) {
    if (!tr.armed || tr.cause === "manual" || tr.cause === "interact" || VIG_CAUSES.includes(tr.cause) || ARSENAL_CAUSES.includes(tr.cause) || ALERT_CAUSES.includes(tr.cause)) continue;
    if (tr.cause === "appear" || tr.cause === "disappear") {
      for (const zid of tr.zones || []) {
        const it = byId.get(zid);
        if (!it || !prevVis.has(zid)) continue;
        const was = prevVis.get(zid), now = it.visible !== false;
        if (tr.cause === "appear" && !was && now) { fired.push([tr, {}]); break; }
        if (tr.cause === "disappear" && was && !now) { fired.push([tr, {}]); break; }
      }
      continue;
    }
    const allowed = allowedFor(tr);
    const myMoves = moves.filter((m) => allowed(m.token));
    if (!myMoves.length && tr.cause !== "standAll") continue;
    if (tr.cause === "standAll" && !myMoves.length) continue;
    if (!memo.has(tr.id)) memo.set(tr.id, {});
    const r = evaluate(tr, myMoves, tokens.filter(allowed), zones, memo.get(tr.id), dpi);
    if (r.fire) fired.push([tr, r]);
  }
  for (const it of items) if (zoneIds.has(it.id)) prevVis.set(it.id, it.visible !== false);
  // "parar em cima da zona": vale a primeira zona do caminho; o que vinha depois dela não dispara
  const halts = new Map(); // tokenId -> { dist, pos }
  for (const [tr, r] of fired) {
    if (!tr.halt || tr.cause !== "enter" || !r.by || r.dist == null) continue;
    const h = halts.get(r.by.id);
    if (!h || r.dist < h.dist) halts.set(r.by.id, { dist: r.dist, pos: haltPoint(r, dpi, gridSquare) });
  }
  for (const [id, h] of halts) haltToken(id, h.pos).catch(() => {});
  for (const [tr, r] of fired) {
    const h = r.by && halts.get(r.by.id);
    if (h && r.dist != null && r.dist > h.dist + 1e-6) continue; // o token não chegou até aqui
    if (tr.once) tr.armed = false; // evita disparo duplo antes do metadado voltar
    run(tr, { by: r.by, at: r.at, from: r.from, on: r.on, cause: tr.cause });
  }
}

async function startGM() {
  dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  gridSquare = (await OBR.scene.grid.getType().catch(() => "SQUARE")) === "SQUARE";
  const md = await OBR.scene.getMetadata();
  triggers = Array.isArray(md[LIST]) ? md[LIST] : [];
  alertPrev = alertLevel(md); cancelPending("");
  prevPos.clear(); prevVis.clear(); memo.clear();
  const items = await OBR.scene.items.getItems();
  // só memoriza o estado inicial: abrir a cena não dispara nada
  for (const t of items.filter(isToken)) prevPos.set(t.id, { ...t.position });
  for (const i of items) prevVis.set(i.id, i.visible !== false);
  lastItems = items;
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  myId = await OBR.player.getId().catch(() => "");
  myConn = await OBR.player.getConnectionId().catch(() => "");
  OBR.player.onChange((p) => { role = p.role; });

  // objetos interagíveis: brilho e clique (em todos os navegadores); o mestre executa direto
  const gmUse = (itemId, userId) => handleInteract(itemId, userId, "GM");
  startInteract(gmUse);
  OBR.broadcast.onMessage(CH_INTERACT, async (e) => {
    if (role !== "GM") return;
    const sender = (await OBR.party.getPlayers().catch(() => [])).find((x) => x.connectionId === e.connectionId);
    if (!sender || sender.role === "GM") return; // outro mestre executa no navegador dele
    if (!(await isLeader())) return;
    handleInteract(e.data?.itemId, sender.id, "PLAYER");
  });
  OBR.broadcast.onMessage(CH_GIVE, async (e) => {
    if (role !== "GM") return;
    const sender = (await OBR.party.getPlayers().catch(() => [])).find((x) => x.connectionId === e.connectionId);
    if (!sender || sender.role === "GM" || !(await isLeader())) return;
    handleGive(e.data?.itemId, e.data?.toId, sender.id);
  });
  await controls.contextMenu.create({
    id: `${ID}/interagir`,
    icons: [{
      icon: url("icon.svg"), label: "Interagir",
      filter: { max: 1, every: [{ key: ["metadata", FLAG], value: undefined, operator: "!=" }] },
    }],
    onClick: (ctx) => { if (ctx.items[0]) tryInteract(ctx.items[0].id, gmUse); },
  });
  // porta do Smoke & Spectre: um clique cria o gatilho "jogadores abrem e fecham esta porta"
  await controls.contextMenu.create({
    id: `${ID}/porta-jogadores`,
    icons: [{
      icon: url("icon.svg"), label: "Gatilhos: jogadores abrem e fecham esta porta",
      filter: { roles: ["GM"], every: [{ key: ["metadata", `${SMOKE}isDoor`], value: true }, { key: ["metadata", FLAG], value: undefined, operator: "==" }] },
    }],
    onClick: async (ctx) => {
      const doors = ctx.items.filter(isSmokeDoor);
      if (!doors.length) return;
      const t = newTrigger(doors.map((i) => i.id), doors.length > 1 ? `Portas da névoa (${doors.length})` : `Porta${doors[0].text?.plainText?.trim() ? `: ${doors[0].text.plainText.trim()}` : " da névoa"}`);
      t.cause = "interact"; t.once = false; t.reach = 1;
      const fx = newEffect("door"); fx.targets = doors.map((i) => i.id); fx.doorOp = "alternar";
      t.effects = [fx];
      await saveTriggers((l) => [...l, t]);
      OBR.notification.show("Porta pronta: o jogador com um personagem ao lado usa pelo painel Gatilhos (botão Usar). Trancada no Smoke, ela não abre.", "SUCCESS");
    },
  });
  // porta animada: linha da porta (Smoke & Spectre ou névoa) + imagem da porta → gatilho "Interagir" pronto
  await controls.contextMenu.create({
    id: `${ID}/porta-animada`,
    icons: [{
      icon: url("icon.svg"), label: "Gatilhos: criar porta animada (VFX + imagem + porta)",
      filter: { roles: ["GM"], every: [{ key: "layer", value: "CHARACTER", operator: "!=" }, { key: "layer", value: "MOUNT", operator: "!=" }] },
    }],
    onClick: async (ctx) => {
      const lines = ctx.items.filter(isFogDoor);
      const imgs = ctx.items.filter((i) => i.type === "IMAGE" && !isFogDoor(i) && !isToken(i));
      if (!lines.length && !imgs.length) return OBR.notification.show("Gatilhos: selecione a linha da porta (Smoke & Spectre com Enable Door, ou a névoa) e/ou a imagem da porta, e use de novo.", "WARNING");
      const nm = names(imgs[0] || lines[0]);
      const t = newTrigger((imgs.length ? imgs : lines).map((i) => i.id), `Porta animada: ${nm}`);
      t.cause = "interact"; t.once = false; t.reach = 1;
      const fx = newEffect("animDoor"); fx.targets = lines.map((i) => i.id); fx.doorImgs = imgs.map((i) => i.id); fx.doorOp = "alternar";
      t.effects = [fx];
      await saveTriggers((l) => [...l, t]);
      OBR.notification.show(`Porta animada criada. No painel Gatilhos, cole o link do vídeo (.webm) de abrir${imgs.length ? " e guarde as imagens fechada/aberta no Trocador (botão direito na imagem → Trocar imagem → + imagens)" : ""}.`, "SUCCESS");
    },
  });
  // item que o personagem pega ao chegar perto (cartão de acesso, chave): vira um gatilho pronto
  await controls.contextMenu.create({
    id: `${ID}/pegar-item`,
    icons: [{
      icon: url("icon.svg"), label: "Gatilhos: o personagem pega este item ao chegar perto",
      filter: { roles: ["GM"], max: 1, every: [{ key: "layer", value: "CHARACTER", operator: "!=" }, { key: "type", value: "IMAGE" }, { key: ["metadata", FLAG], value: undefined, operator: "==" }] },
    }],
    onClick: async (ctx) => {
      const it = ctx.items[0];
      if (!it) return;
      const nm = names(it);
      const t = newTrigger([it.id], `Pegar: ${nm}`);
      t.cause = "near"; t.radius = 1; t.once = true; t.ignoreHidden = true;
      const fx = newEffect("attach"); fx.targets = [it.id];
      const msg = newEffect("notify"); msg.text = `{quem} pegou ${nm}.`;
      t.effects = [fx, msg];
      await saveTriggers((l) => [...l, t]);
      OBR.notification.show(`Pronto: o primeiro personagem que chegar a 1 quadrado de "${nm}" pega o item (fica preso no token). Para pegar só clicando, mude a causa para Interagir.`, "SUCCESS");
    },
  });
  await controls.contextMenu.create({
    id: `${ID}/tornar-interagivel`,
    icons: [{
      icon: url("icon.svg"), label: "Tornar interagível (alavanca, porta…)",
      filter: { roles: ["GM"], every: [{ key: ["metadata", FLAG], value: undefined, operator: "==" }] },
    }],
    onClick: async (ctx) => {
      const zones = ctx.items.map((i) => i.id);
      const nm = ctx.items.length === 1 ? names(ctx.items[0]) : "objeto";
      const t = newTrigger(zones, `Interagir: ${nm}`);
      t.cause = "interact"; t.once = false;
      const fx = newEffect("notify"); fx.text = `{quem} mexe em ${nm}.`;
      t.effects = [fx];
      await saveTriggers((l) => [...l, t]);
      OBR.notification.show(`"${nm}" agora é interagível. No painel Gatilhos, escolha o que acontece (ex.: Mudar estado → porta abre).`, "SUCCESS");
    },
  });

  // acesso negado (restrito): só o jogador que tentou vê, como aviso ou como nota para ler
  OBR.broadcast.onMessage(CH_DENY, (e) => {
    const d = e.data || {};
    if (!d.to || d.to !== myId) return;
    if (d.show === "nota") {
      const q = new URLSearchParams({ t: d.title || "", m: d.text || "" }).toString();
      controls.modal.open({ id: `${ID}/nota`, url: url(`nota.html?${q}`), width: 380, height: 210 }).catch(() => OBR.notification.show(d.text, "WARNING"));
    } else OBR.notification.show(d.text || "Acesso negado.", "WARNING");
  });

  // mensagens na tela (todos os jogadores)
  OBR.broadcast.onMessage(CH_NOTE, (e) => {
    const { text, audience } = e.data || {};
    if (audience === "gm" && role !== "GM") return;
    OBR.notification.show(text, "INFO");
  });

  // menu de contexto do mestre: criar gatilho com os itens selecionados como zona
  await controls.contextMenu.create({
    id: `${ID}/criar`,
    icons: [{ icon: url("icon.svg"), label: "Criar gatilho com esta zona", filter: { roles: ["GM"] } }],
    onClick: async (ctx) => {
      const zones = ctx.items.map((i) => i.id);
      const name = ctx.items.length === 1 ? `Gatilho: ${names(ctx.items[0])}` : "Gatilho";
      await saveTriggers((l) => [...l, newTrigger(zones, name)]);
      OBR.notification.show("Gatilho criado. Abra o painel Gatilhos (⚡ no topo) para escolher os efeitos.", "SUCCESS");
    },
  });

  const boot = async () => {
    if (role !== "GM") return;
    await startGM();
    syncMenu();
  };
  if (await OBR.scene.isReady()) await boot();
  OBR.scene.onReadyChange((r) => { if (r) boot(); });

  OBR.scene.onMetadataChange((md) => {
    const next = Array.isArray(md[LIST]) ? md[LIST] : [];
    // mantém "desarmado" local até o metadado confirmar (evita disparo duplo)
    triggers = next;
    if (role === "GM") { syncFlags(lastItems); syncMenu(); } // objeto virou (ou deixou de ser) interagível; menu do botão direito
    const lvl = alertLevel(md);
    if (role === "GM" && alertPrev !== null && lvl !== alertPrev) { const prev = alertPrev; alertPrev = lvl; onAlert(lvl, prev); } else if (role === "GM") alertPrev = lvl;
  });
  OBR.scene.items.onChange((items) => { if (role === "GM") check(items); });
  OBR.scene.grid.onChange((g) => { dpi = g.dpi || dpi; gridSquare = g.type === "SQUARE"; });

  // a Régua avisa o caminho antes de andar: se ele passa por um gatilho que para o token,
  // já responde onde parar, e o token nem chega a passar da armadilha
  OBR.broadcast.onMessage(CH_PATH, (e) => {
    if (role !== "GM") return;
    const { tokenId, points } = e.data || {};
    if (!tokenId || !Array.isArray(points) || points.length < 2) return;
    plans.set(tokenId, { points, until: Date.now() + points.length * 400 + 4000 });
    const token = lastItems.find((i) => i.id === tokenId);
    if (!token || !isToken(token)) return;
    const byId = new Map(lastItems.map((i) => [i.id, i]));
    let best = null;
    for (const tr of triggers) {
      if (!tr.armed || !tr.halt || tr.cause !== "enter" || !allowedFor(tr)(token)) continue;
      const zones = new Map();
      for (const id of tr.zones || []) { const it = byId.get(id); if (it) zones.set(id, zoneShape(it, dpi)); }
      const r = evaluate(tr, [{ token, from: points[0], to: points[points.length - 1], route: points }], [], zones, {}, dpi);
      if (r.fire && (!best || r.dist < best.dist)) best = r;
    }
    if (!best) return;
    OBR.broadcast.sendMessage(CH_HALT, { tokenId, at: haltPoint(best, dpi, gridSquare), upto: best.seg - 1 }, { destination: "ALL" }).catch(() => {});
  });

  // Vigilância: uma câmera viu alguém (quem ativou = quem foi visto) / um nó da Matriz mudou de estado
  OBR.broadcast.onMessage(VIG_SEEN, async (e) => {
    const d = e.data || {};
    if (role !== "GM" || !d.camera || !(await isLeader())) return;
    for (const tr of triggers) {
      if (!tr.armed || tr.cause !== "cameraSees" || !(tr.zones || []).includes(d.camera)) continue;
      if (tr.once) tr.armed = false;
      run(tr, { on: d.tokens || [], cause: "cameraSees" });
    }
  });
  OBR.broadcast.onMessage(VIG_HEARD, async (e) => {
    const d = e.data || {};
    if (role !== "GM" || !d.camera || !(await isLeader())) return;
    for (const tr of triggers) {
      if (!tr.armed || tr.cause !== "heard" || ((tr.zones || []).length && !(tr.zones || []).includes(d.camera))) continue;
      if (tr.once) tr.armed = false;
      run(tr, { cause: "heard", on: [d.camera] });
    }
  });
  OBR.broadcast.onMessage(VIG_NODE, async (e) => {
    const d = e.data || {};
    if (role !== "GM" || !d.id || !(await isLeader())) return;
    for (const tr of triggers) {
      if (!tr.armed || tr.cause !== "nodeState" || !(tr.zones || []).includes(d.id)) continue;
      if (tr.nodeTo && tr.nodeTo !== d.state) continue;
      if (tr.once) tr.armed = false;
      run(tr, { cause: "nodeState" });
    }
  });

  // Arsenal: um objeto foi destruído (quem ativou = quem atirou) / uma carga explodiu (quem ativou = quem foi pego)
  OBR.broadcast.onMessage(ARSENAL_DESTROYED, async (e) => {
    const d = e.data || {};
    if (role !== "GM" || !d.id || !(await isLeader())) return;
    for (const tr of triggers) {
      if (!tr.armed || tr.cause !== "destroyed" || !(tr.zones || []).includes(d.id)) continue;
      if (tr.once) tr.armed = false;
      run(tr, { on: d.by ? [d.by] : [], cause: "destroyed" });
    }
  });
  OBR.broadcast.onMessage(ARSENAL_BLAST, async (e) => {
    const d = e.data || {};
    if (role !== "GM" || !d.at || !(await isLeader())) return;
    const all = await OBR.scene.items.getItems();
    for (const tr of triggers) {
      if (!tr.armed || tr.cause !== "chargeBlew") continue;
      // sem zona: qualquer carga; com zona: a explosão pega a zona (ou a carga estava colada nela)
      const zs = (tr.zones || []).map((id) => all.find((i) => i.id === id)).filter(Boolean);
      if ((tr.zones || []).length && !zs.some((z) => z.id === d.id || Math.hypot(z.position.x - d.at.x, z.position.y - d.at.y) <= ((d.radius || 2) + 0.5) * dpi)) continue;
      if (tr.once) tr.armed = false;
      run(tr, { on: d.caught?.length ? d.caught : d.by ? [d.by] : [], cause: "chargeBlew" });
    }
  });

  // o nível de alerta mudou (só o mestre líder dispara)
  async function onAlert(level, prev) {
    if (!(await isLeader())) return;
    for (const tr of triggers) {
      if (!tr.armed || tr.cause !== "alertLevel" || !alertMatches(tr, level, prev)) continue;
      if (tr.once) tr.armed = false;
      run(tr, { cause: "alertLevel", level, prev });
    }
  }

  // câmera que sobe o alerta: um clique cria o gatilho "a câmera viu alguém → alerta +1"
  await controls.contextMenu.create({
    id: `${ID}/camera-alerta`,
    icons: [{
      icon: url("icon.svg"), label: "Gatilhos: esta câmera sobe o alerta",
      filter: { roles: ["GM"], every: [{ key: ["metadata", VIG_CAM], value: undefined, operator: "!=" }] },
    }],
    onClick: async (ctx) => {
      const cams = ctx.items.filter((i) => i.metadata?.[VIG_CAM]);
      if (!cams.length) return;
      const t = newTrigger(cams.map((i) => i.id), cams.length > 1 ? `Alerta: câmeras (${cams.length})` : `Alerta: ${names(cams[0])}`);
      t.cause = "cameraSees"; t.once = false;
      const up = newEffect("alarm"); up.alarmOp = "up";
      const msg = newEffect("notify"); msg.text = "📷 {quem} foi visto. Alerta {nivel}."; msg.audience = "gm";
      t.effects = [up, msg];
      await saveTriggers((l) => [...l, t]);
      OBR.notification.show("Pronto: quem a câmera vir faz o alerta subir 1 nível (até 3). Crie gatilhos com a causa \"O nível de alerta mudou\" para o que acontece em cada nível.", "SUCCESS");
    },
  });

  // disparo manual pelo painel (ou pelo Arsenal, com quem ativou)
  OBR.broadcast.onMessage(CH_FIRE, (e) => {
    if (role !== "GM") return;
    const t = triggers.find((x) => x.id === e.data?.id);
    // o ⚡ do painel testa o gatilho: ignora as condições (force)
    if (t) run(t, { ...(Array.isArray(e.data?.on) && e.data.on.length ? { on: e.data.on } : {}), force: e.data?.force === true });
  });
});
