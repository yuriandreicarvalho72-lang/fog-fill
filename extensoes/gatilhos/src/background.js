// Motor dos Gatilhos. Roda no navegador do MESTRE e vê qualquer movimento da cena,
// inclusive os que os jogadores fazem com os próprios tokens, sem depender de ferramenta especial.
// Nos jogadores, só mostra as mensagens na tela.
import OBR from "@owlbear-rodeo/sdk";
import { zoneShape, evaluate, haltPoint, routeFromPlan, itemsInZones, formation } from "./engine.js";
import { ID, LIST, CH_FIRE, CH_NOTE, CH_LOG, CH_PATH, CH_HALT, CLIMA, CLIMA_FLASH, LUZ, ESTADOS_SET, url, newTrigger, isToken } from "./shared.js";

let role = "PLAYER";
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

/** Avalia todos os gatilhos com a cena atual. */
function check(items) {
  lastItems = items;
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
    if (!tr.armed || tr.cause === "manual") continue;
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
  OBR.player.onChange((p) => { role = p.role; });

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

  // disparo manual pelo painel
  OBR.broadcast.onMessage(CH_FIRE, (e) => {
    if (role !== "GM") return;
    const t = triggers.find((x) => x.id === e.data?.id);
    if (t) run(t, {});
  });
});
