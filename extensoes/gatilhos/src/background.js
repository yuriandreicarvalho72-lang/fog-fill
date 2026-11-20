// Motor dos Gatilhos. Roda no navegador do MESTRE e vê qualquer movimento da cena,
// inclusive os que os jogadores fazem com os próprios tokens, sem depender de ferramenta especial.
// Nos jogadores, só mostra as mensagens na tela.
import OBR from "@owlbear-rodeo/sdk";
import { zoneShape, evaluate, haltPoint, routeFromPlan, itemsInZones, formation, pickReacher } from "./engine.js";
import { ID, LIST, CH_FIRE, CH_NOTE, CH_LOG, CH_PATH, CH_HALT, CH_INTERACT, FLAG, CLIMA, CLIMA_FLASH, LUZ, ESTADOS_SET, ARSENAL_FIRE, TROCADOR_SWAP, VIG_SEEN, VIG_NODE, VIG_SET, VIG_CAUSES, VIG_VISION, ARSENAL_DESTROYED, ARSENAL_BLAST, ARSENAL_DETONATE, ARSENAL_CAUSES, ARSENAL_FX, ARSENAL_FX_END, ARSENAL_HAB_USE, SMOKE, isFogDoor, isSmokeDoor, doorIsOpen, doorIsLocked, setDoor, url, newTrigger, newEffect, isToken, isInteract } from "./shared.js";
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

const wait = (s) => new Promise((r) => setTimeout(r, Math.max(0, s) * 1000));

/** Executa os efeitos de um gatilho. ctx: { by (token), at (entrada), from } */
async function run(trigger, ctx = {}, depth = 0) {
  if (depth > 8) return; // proteção contra corrente infinita
  if (trigger.once) saveTriggers((l) => l.map((t) => (t.id === trigger.id ? { ...t, armed: false } : t))).catch(() => {});
  log(`⚡ ${trigger.name}${ctx.by ? ` (por ${names(ctx.by)})` : ""}`);
  if (trigger.delay) await wait(trigger.delay);
  if (!ctx.actorIds) ctx = { ...ctx, actorIds: (await actors(trigger, ctx).catch(() => [])).map((i) => i.id) };
  for (const e of trigger.effects || []) {
    const go = async () => {
      try { await doEffect(e, ctx, depth, trigger); } catch (err) { console.error(`[${ID}]`, err); }
    };
    if (e.delay) setTimeout(go, e.delay * 1000); else await go();
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
      return OBR.broadcast.sendMessage(CH_NOTE, { text, audience: e.audience || "all" }, { destination: "ALL" });
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
    case "chain":
    case "rearm": {
      const t = triggers.find((x) => x.id === e.trigger);
      if (!t) return;
      if (e.action === "rearm") return saveTriggers((l) => l.map((x) => (x.id === t.id ? { ...x, armed: true } : x)));
      return run(t, ctx, depth + 1);
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
  for (const tr of triggers) {
    if (!isInteract(tr) || !(tr.zones || []).includes(itemId)) continue;
    if ((tr.canUse === "players" && senderRole === "GM") || (tr.canUse === "gm" && senderRole !== "GM")) continue;
    // quem ativou: o token do jogador mais perto do objeto (o mestre: o personagem mais perto, sem limite de alcance)
    const pool = items.filter((i) => isToken(i) && (senderRole === "GM" || i.createdUserId === userId));
    const r = pickReacher(pool, shape, senderRole === "GM" ? 0 : tr.reach ?? 1, dpi);
    if (!r.ok) continue;
    if (tr.once) tr.armed = false;
    run(tr, { by: r.token || undefined, at: it.position, cause: "interact", on: r.token ? undefined : [] });
  }
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
    if (!want.has(it.id)) { anchor.delete(it.id); continue; }
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
    if (!tr.armed || tr.cause === "manual" || tr.cause === "interact" || VIG_CAUSES.includes(tr.cause) || ARSENAL_CAUSES.includes(tr.cause)) continue;
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
  await OBR.contextMenu.create({
    id: `${ID}/interagir`,
    icons: [{
      icon: url("icon.svg"), label: "Interagir",
      filter: { max: 1, every: [{ key: ["metadata", FLAG], value: undefined, operator: "!=" }] },
    }],
    onClick: (ctx) => { if (ctx.items[0]) tryInteract(ctx.items[0].id, gmUse); },
  });
  // porta do Smoke & Spectre: um clique cria o gatilho "jogadores abrem e fecham esta porta"
  await OBR.contextMenu.create({
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
  await OBR.contextMenu.create({
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

  // mensagens na tela (todos os jogadores)
  OBR.broadcast.onMessage(CH_NOTE, (e) => {
    const { text, audience } = e.data || {};
    if (audience === "gm" && role !== "GM") return;
    OBR.notification.show(text, "INFO");
  });

  // menu de contexto do mestre: criar gatilho com os itens selecionados como zona
  await OBR.contextMenu.create({
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
  };
  if (await OBR.scene.isReady()) await boot();
  OBR.scene.onReadyChange((r) => { if (r) boot(); });

  OBR.scene.onMetadataChange((md) => {
    const next = Array.isArray(md[LIST]) ? md[LIST] : [];
    // mantém "desarmado" local até o metadado confirmar (evita disparo duplo)
    triggers = next;
    if (role === "GM") syncFlags(lastItems); // objeto virou (ou deixou de ser) interagível
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

  // disparo manual pelo painel (ou pelo Arsenal, com quem ativou)
  OBR.broadcast.onMessage(CH_FIRE, (e) => {
    if (role !== "GM") return;
    const t = triggers.find((x) => x.id === e.data?.id);
    if (t) run(t, Array.isArray(e.data?.on) && e.data.on.length ? { on: e.data.on } : {});
  });
});
