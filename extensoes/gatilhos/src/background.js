// Motor dos Gatilhos. Roda no navegador do MESTRE e vê qualquer movimento da cena,
// inclusive os que os jogadores fazem com os próprios tokens, sem depender de ferramenta especial.
// Nos jogadores, só mostra as mensagens na tela.
import OBR from "@owlbear-rodeo/sdk";
import { zoneShape, evaluate } from "./engine.js";
import { ID, LIST, CH_FIRE, CH_NOTE, CH_LOG, CLIMA, CLIMA_FLASH, LUZ, url, newTrigger, isToken } from "./shared.js";

let role = "PLAYER";
let triggers = [];
let dpi = 150;
let gridSquare = true;
const prevPos = new Map();   // tokenId -> {x,y}
const prevVis = new Map();   // itemId -> visible
const memo = new Map();      // triggerId -> estado da avaliação (placas)
let lastItems = [];

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
  for (const e of trigger.effects || []) {
    const go = async () => {
      try { await doEffect(e, ctx, depth); } catch (err) { console.error(`[${ID}]`, err); }
    };
    if (e.delay) setTimeout(go, e.delay * 1000); else await go();
  }
}

async function doEffect(e, ctx, depth) {
  const ids = (e.targets || []).filter(Boolean);
  const upd = (fn) => (ids.length ? OBR.scene.items.updateItems(ids, (d) => { for (const it of d) fn(it); }) : null);
  switch (e.action) {
    case "show": return upd((it) => { it.visible = true; });
    case "hide": return upd((it) => { it.visible = false; });
    case "toggle": return upd((it) => { it.visible = !it.visible; });
    case "lock": return upd((it) => { it.locked = true; });
    case "unlock": return upd((it) => { it.locked = false; });
    case "delete": return ids.length ? OBR.scene.items.deleteItems(ids) : null;
    case "notify":
      return OBR.broadcast.sendMessage(CH_NOTE, { text: e.text || "Algo aconteceu…", audience: e.audience || "all" }, { destination: "ALL" });
    case "lightning":
      return OBR.broadcast.sendMessage(CLIMA_FLASH, {}, { destination: "ALL" });
    case "weatherOn":
    case "weatherOff":
      return upd((it) => { for (const l of it.metadata?.[CLIMA] || []) l.on = e.action === "weatherOn"; });
    case "lightColor":
      return upd((it) => { it.metadata[LUZ] = { ...(it.metadata[LUZ] || { intensity: 0.7 }), color: e.color, anim: e.anim || "none" }; });
    case "teleport": {
      if (!ctx.by || !e.dest) return;
      const [dest] = await OBR.scene.items.getItems([e.dest]);
      if (!dest) return;
      prevPos.set(ctx.by.id, { ...dest.position });
      return OBR.scene.items.updateItems([ctx.by.id], (d) => { for (const it of d) it.position = { ...dest.position }; });
    }
    case "moveTo": {
      if (!e.dest || !ids.length) return;
      const [dest] = await OBR.scene.items.getItems([e.dest]);
      if (!dest) return;
      for (const id of ids) prevPos.set(id, { ...dest.position });
      return upd((it) => { it.position = { ...dest.position }; });
    }
    case "stop": {
      if (!ctx.by || !ctx.at || !ctx.from) return;
      // volta meio quadrado antes da entrada e encaixa mantendo o alinhamento de onde o token veio
      const dx = ctx.at.x - ctx.from.x, dy = ctx.at.y - ctx.from.y, L = Math.hypot(dx, dy) || 1;
      let p = { x: ctx.at.x - (dx / L) * dpi * 0.5, y: ctx.at.y - (dy / L) * dpi * 0.5 };
      if (gridSquare) p = { x: ctx.from.x + Math.round((p.x - ctx.from.x) / dpi) * dpi, y: ctx.from.y + Math.round((p.y - ctx.from.y) / dpi) * dpi };
      prevPos.set(ctx.by.id, p);
      return OBR.scene.items.updateItems([ctx.by.id], (d) => { for (const it of d) it.position = p; });
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

/** Avalia todos os gatilhos com a cena atual. */
function check(items) {
  lastItems = items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const tokens = items.filter(isToken);
  const moves = [];
  for (const t of tokens) {
    const p = prevPos.get(t.id);
    if (p && (p.x !== t.position.x || p.y !== t.position.y)) moves.push({ token: t, from: p, to: t.position });
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
    const allowed = (t) => (tr.who === "list" ? (tr.tokens || []).includes(t.id) : true)
      && !(tr.ignoreHidden !== false && t.visible === false)
      && !(tr.zones || []).includes(t.id);
    const myMoves = moves.filter((m) => allowed(m.token));
    if (!myMoves.length && tr.cause !== "standAll") continue;
    if (tr.cause === "standAll" && !myMoves.length) continue;
    if (!memo.has(tr.id)) memo.set(tr.id, {});
    const r = evaluate(tr, myMoves, tokens.filter(allowed), zones, memo.get(tr.id), dpi);
    if (r.fire) fired.push([tr, r]);
  }
  for (const it of items) if (zoneIds.has(it.id)) prevVis.set(it.id, it.visible !== false);
  for (const [tr, r] of fired) {
    if (tr.once) tr.armed = false; // evita disparo duplo antes do metadado voltar
    run(tr, { by: r.by, at: r.at, from: r.from });
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

  // disparo manual pelo painel
  OBR.broadcast.onMessage(CH_FIRE, (e) => {
    if (role !== "GM") return;
    const t = triggers.find((x) => x.id === e.data?.id);
    if (t) run(t, {});
  });
});
