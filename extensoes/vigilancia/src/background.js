// Vigilância em segundo plano (todos os navegadores):
// - desenha os cones das câmeras e a camada RA da Matriz como itens LOCAIS (cada um vê o que pode ver);
// - no mestre líder: vê quem entrou nos cones, avisa e manda o evento para o Gatilhos; aplica pedidos de hack.
import OBR, { buildPath, buildLabel, buildShape, buildEffect } from "@owlbear-rodeo/sdk";
import {
  CAM, NODE, DECK, ACCESS, STATE_COLOR, camOf, camOn, nodeOf, coneDir, conePolygon, seenBy, wallsFrom,
  hasAccess, nodeChanges, doorLock, iconOf, stateLabel,
  VISION, ONLY, TINT, activeModes, toggleVision, visionOf, ownedBy, EST_GROUPS,
} from "./core.js";
import {
  ID, PENDING, CH_SEEN, CH_NODE, CH_SET, CH_REQ, CH_RES, CH_PREFS, CH_VISION, APPROVE,
  url, itemName, uid, getPrefs, setState, makeCamera, makeNode, decide,
} from "./ops.js";
import { readPerf, onPerf, onClean } from "./perf.js";

const LOCAL = `${ID}/local`; // marca dos nossos itens locais
let role = "PLAYER", myId = "", myConn = "";
let items = [];          // itens da cena
let walls = [];          // trechos de parede (névoa dinâmica / Smoke & Spectre)
let wallSig = "";
let localWalls = []; // paredes locais (a névoa dinâmica desenha as paredes como itens locais)
let access = { players: [], autoApprove: false };
let prefs = getPrefs();
let perf = null; // perfil do Otimizador neste navegador (null = sem perfil): filtro de cor e frequência da varredura
let lastSweep = 0;
let dpi = 150;
let ready = false;
let estGroups = []; // prédios/andares do Estados (câmeras só veem o próprio andar)

const shown = new Map();      // id local -> assinatura do que está desenhado
const prevSeen = new Map();   // câmera -> Set(tokens) (só no líder)
const prevState = new Map();  // nó -> estado (só no líder)

async function isLeader() {
  if (role !== "GM") return false;
  const gms = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role === "GM").map((p) => p.connectionId);
  return [myConn, ...gms].sort()[0] === myConn;
}
let leader = false;
const refreshLeader = async () => { leader = await isLeader(); };

const tag = (b) => b.locked(true).disableHit(true).metadata({ [LOCAL]: true });
const lid = (kind, id) => `${ID}-${kind}-${id}`;

// ---------- desenho ----------
function coneLook(it, seen) {
  const st = nodeOf(it)?.state ?? "ativo";
  if (st === "ativo") return seen ? { fill: "#ff3b30", op: 0.28, stroke: "#ff3b30", dash: [] } : { fill: "#4fc3ff", op: 0.16, stroke: "#4fc3ff", dash: [] };
  if (st === "loop") return { fill: STATE_COLOR.loop, op: 0.1, stroke: STATE_COLOR.loop, dash: [dpi / 8, dpi / 10] };
  if (st === "hackeado") return { fill: STATE_COLOR.hackeado, op: 0.12, stroke: STATE_COLOR.hackeado, dash: [dpi / 8, dpi / 10] };
  return { fill: "#8a8f98", op: 0, stroke: "#8a8f98", dash: [dpi / 16, dpi / 8] }; // desativado: só o contorno
}

function coneCommands(it, cam, now) {
  const pts = conePolygon(coneDir(it, cam, now), cam, walls, dpi, it.position);
  return [...pts.map((p, i) => [i ? 1 : 0, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]), [5]];
}

/** O que este navegador deve ver agora: { id: { sig, build, live? } } */
function wanted(now) {
  const out = new Map();
  const gm = role === "GM";
  const ra = prefs.ra && hasAccess(myId, role, items, access);
  const modes = activeModes(myId, role, items);
  // filtro de cor na tela (térmica laranja, baixa luz verde) para quem está com o modo ligado
  if (modes.length && prefs.tint !== false && perf?.vig?.tint !== false) {
    const m = modes.includes("termica") ? "termica" : "baixa";
    const [r, g, b] = TINT[m];
    out.set(lid("filtro", m), {
      sig: m,
      build: () => tag(buildEffect().effectType("VIEWPORT").sksl(`half4 main(float2 c) { return half4(${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)}, 0.5); }`)
        .blendMode("COLOR").layer("POST_PROCESS").name(`Visão: ${m}`)).id(lid("filtro", m)).build(),
    });
  }
  for (const it of items) {
    const cam = camOf(it);
    if (cam && ((gm && prefs.cones) || (cam.showAll && it.visible !== false))) {
      const st = nodeOf(it)?.state ?? "ativo";
      if (st !== "desativado" || gm) {
        const seen = camOn(it) && seenBy(it, items, walls, dpi, now, estGroups).length > 0;
        const look = coneLook(it, seen);
        const cmds = coneCommands(it, cam, now);
        out.set(lid("cone", it.id), {
          sig: JSON.stringify([it.position, look, cmds]),
          live: { cmds, look },
          build: () => tag(buildPath().position(it.position).commands(cmds).fillColor(look.fill).fillOpacity(look.op)
            .strokeColor(look.stroke).strokeOpacity(0.8).strokeWidth(Math.max(2, dpi / 50)).strokeDash(look.dash)
            .layer("DRAWING").name(`Cone: ${itemName(it)}`)).id(lid("cone", it.id)).build(),
        });
      }
    }
    // visão especial: o item "só em térmica/baixa luz" fica escondido; quem tem o modo ligado vê uma cópia local
    const only = it.metadata?.[ONLY];
    if (only && modes.includes(only)) {
      const copy = JSON.parse(JSON.stringify(it));
      delete copy.attachedTo;
      Object.assign(copy, { id: lid("vis", it.id), visible: true, locked: true, disableHit: true, metadata: { [LOCAL]: true } });
      out.set(copy.id, { sig: JSON.stringify([it.position, it.rotation, it.scale, it.image?.url, it.text?.plainText, it.style, it.layer]), build: () => copy });
      if (only === "termica") {
        const r = dpi * 0.75;
        out.set(lid("calor", it.id), {
          sig: JSON.stringify([it.position]),
          build: () => tag(buildShape().shapeType("CIRCLE").position(it.position).width(r * 2).height(r * 2).fillColor("#ff6a1a").fillOpacity(0.28)
            .strokeColor("#ffb347").strokeOpacity(0.7).strokeWidth(Math.max(2, dpi / 40)).layer("DRAWING")).id(lid("calor", it.id)).build(),
        });
      }
    }
    const node = nodeOf(it);
    if (node && ra && (gm || (!node.hidden && it.visible !== false))) {
      const color = STATE_COLOR[node.state] || "#4fc3ff";
      const size = Math.max(dpi * 0.9, (it.image ? (it.image.width * dpi) / (it.grid?.dpi || it.image.width) : dpi) * Math.abs(it.scale?.x ?? 1)) * 1.1;
      const text = `${iconOf(node.type)} ${node.name} · ${stateLabel(node.state)}${node.hidden ? " (oculto)" : ""}`;
      out.set(lid("ra", it.id), {
        sig: JSON.stringify([it.position, size, text, color]),
        build: () => tag(buildLabel().position({ x: it.position.x, y: it.position.y - size / 2 }).plainText(text)
          .backgroundColor("#061a24").backgroundOpacity(0.85).fillColor(color).fontWeight(700).fontSize(Math.max(14, dpi / 7))
          .cornerRadius(6).pointerDirection("DOWN").pointerHeight(6).pointerWidth(10).layer("TEXT").name(`Matriz: ${node.name}`))
          .id(lid("ra", it.id)).build(),
      });
      out.set(lid("ring", it.id), {
        sig: JSON.stringify([it.position, size, color]),
        build: () => tag(buildShape().shapeType("HEXAGON").position(it.position).width(size).height(size).fillOpacity(0)
          .strokeColor(color).strokeOpacity(0.9).strokeWidth(Math.max(2, dpi / 40)).strokeDash([dpi / 12, dpi / 16])
          .layer("DRAWING")).id(lid("ring", it.id)).build(),
      });
    }
  }
  return out;
}

let drawing = false, again = false;
async function draw() {
  if (!ready) return;
  if (drawing) { again = true; return; }
  drawing = true;
  try {
    do {
      again = false;
      const want = wanted(Date.now());
      const del = [...shown.keys()].filter((k) => !want.has(k));
      const add = [], live = [];
      for (const [k, w] of want) {
        const old = shown.get(k);
        if (old === undefined) add.push(k);
        else if (old !== w.sig) (w.live && old !== "" ? live : add).push(k);
      }
      // cones que só giraram (varredura) ou mudaram de cor: atualiza no lugar
      const relive = live.filter((k) => !add.includes(k));
      if (relive.length) {
        await OBR.scene.local.updateItems(relive, (d) => {
          for (const it of d) {
            const w = want.get(it.id);
            const camItem = items.find((x) => lid("cone", x.id) === it.id);
            if (camItem) it.position = { ...camItem.position };
            it.commands = w.live.cmds;
            it.style.fillColor = w.live.look.fill; it.style.fillOpacity = w.live.look.op;
            it.style.strokeColor = w.live.look.stroke; it.style.strokeDash = w.live.look.dash;
          }
        }).catch(() => { for (const k of relive) shown.delete(k); });
        for (const k of relive) if (shown.has(k)) shown.set(k, want.get(k).sig);
      }
      const redo = add.filter((k) => shown.has(k));
      if (del.length || redo.length) await OBR.scene.local.deleteItems([...del, ...redo]).catch(() => {});
      for (const k of del) shown.delete(k);
      if (add.length) {
        await OBR.scene.local.addItems(add.map((k) => want.get(k).build())).catch((e) => console.error(`[${ID}]`, e));
        for (const k of add) shown.set(k, want.get(k).sig);
      }
    } while (again);
  } finally { drawing = false; }
}

async function clearLocal() {
  const mine = (await OBR.scene.local.getItems().catch(() => [])).filter((i) => i.metadata?.[LOCAL]);
  if (mine.length) await OBR.scene.local.deleteItems(mine.map((i) => i.id)).catch(() => {});
  shown.clear();
}

// ---------- mestre líder: quem as câmeras veem, nós que mudaram ----------
function detect(now) {
  for (const it of items) {
    if (!camOf(it)) continue;
    const seen = camOn(it) ? seenBy(it, items, walls, dpi, now, estGroups) : [];
    const before = prevSeen.get(it.id) || new Set();
    const fresh = seen.filter((t) => !before.has(t));
    prevSeen.set(it.id, new Set(seen));
    if (fresh.length) {
      OBR.broadcast.sendMessage(CH_SEEN, { camera: it.id, name: nodeOf(it)?.name || itemName(it), tokens: fresh, all: seen, alertAll: !!camOf(it).alertAll }, { destination: "ALL" }).catch(() => {});
    }
  }
  for (const id of [...prevSeen.keys()]) if (!items.some((i) => i.id === id)) prevSeen.delete(id);
}

function watchNodes() {
  const changes = nodeChanges(prevState, items);
  prevState.clear();
  for (const it of items) { const n = nodeOf(it); if (n) prevState.set(it.id, n.state); }
  if (!leader) return;
  for (const c of changes) {
    OBR.broadcast.sendMessage(CH_NODE, c, { destination: "ALL" }).catch(() => {});
    const lock = doorLock(c);
    if (lock !== null) OBR.scene.items.updateItems([c.id], (d) => { for (const it of d) it.locked = lock; }).catch(() => {});
  }
}

// ---------- pedidos de hack ----------
async function openApproval() {
  const w = await OBR.viewport.getWidth().catch(() => 1200);
  OBR.popover.open({ id: APPROVE, url: url("aprovar.html"), width: 340, height: 230, anchorReference: "POSITION", anchorPosition: { left: Math.round(w / 2), top: 70 }, anchorOrigin: { horizontal: "CENTER", vertical: "TOP" }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" }, disableClickAway: true }).catch(() => {});
}

async function onRequest(e) {
  if (!(await isLeader())) return;
  const d = e.data || {};
  const players = await OBR.party.getPlayers().catch(() => []);
  const p = players.find((x) => x.connectionId === e.connectionId);
  const by = p?.id || d.by, byName = p?.name || d.byName || "Jogador";
  const node = items.find((i) => i.id === d.node);
  const n = nodeOf(node);
  if (!n || !["hackeado", "loop", "desativado", "ativo"].includes(d.action)) return;
  if (p && p.role !== "GM" && !hasAccess(by, "PLAYER", items, access)) return;
  const req = { id: uid(), node: node.id, nodeName: n.name, action: d.action, by, byName, at: Date.now() };
  const md = await OBR.scene.getMetadata();
  const list = Array.isArray(md[PENDING]) ? md[PENDING] : [];
  if (list.some((x) => x.node === req.node && x.by === req.by && x.action === req.action)) return; // já pediu
  await OBR.scene.setMetadata({ [PENDING]: [...list, req] });
  if (access.autoApprove) return decide(req.id, true);
  OBR.notification.show(`Vigilância: ${byName} quer ${d.action === "ativo" ? "reativar" : `deixar ${stateLabel(d.action)}`} "${n.name}".`, "WARNING");
  openApproval();
}

// ---------- Gatilhos (e outras extensões) mudam o estado ----------
async function onSet(e) {
  const d = e.data || {};
  if (!Array.isArray(d.targets) || !d.targets.length || !d.state || !(await isLeader())) return;
  const n = await setState(d.targets, d.state);
  if (!n) OBR.notification.show(`Vigilância${d.from ? ` (${d.from})` : ""}: nenhum dos itens é câmera ou nó da Matriz.`, "WARNING");
}

// ---------- visão especial: liga/desliga um modo (painel do jogador, Gatilhos) ----------
async function onVision(e) {
  const d = e.data || {};
  if (!Array.isArray(d.targets) || !d.targets.length || !d.mode || !(await isLeader())) return;
  const sender = (await OBR.party.getPlayers().catch(() => [])).find((x) => x.connectionId === e.connectionId);
  let ids = d.targets;
  // jogador só mexe nos tokens dele
  if (sender && sender.role !== "GM") { const mine = new Set(ownedBy(sender.id, items).map((i) => i.id)); ids = ids.filter((id) => mine.has(id)); }
  const its = items.filter((i) => ids.includes(i.id) && visionOf(i));
  if (!its.length) {
    if (d.from) OBR.notification.show(`Vigilância (${d.from}): nenhum desses tokens tem visão especial.`, "WARNING");
    return;
  }
  await OBR.scene.items.updateItems(its.map((i) => i.id), (dr) => { for (const it of dr) it.metadata[VISION] = toggleVision(visionOf(it), d.mode, d.on !== false); });
}

// ---------- ciclo ----------
let tm = null;
function loop() {
  clearTimeout(tm);
  const now = Date.now();
  const sweeping = items.some((i) => camOf(i)?.sweep > 0);
  if (ready) {
    if (leader && items.some((i) => camOf(i))) detect(now);
    // câmeras que giram: redesenha no ritmo do perfil do Otimizador (a detecção do mestre não muda)
    if (sweeping && now - lastSweep >= (perf?.vig?.sweepMs ?? 160) - 20) { lastSweep = now; draw(); }
  }
  tm = setTimeout(loop, sweeping ? 160 : 400);
}

async function loadScene() {
  ready = false;
  await clearLocal();
  dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  items = await OBR.scene.items.getItems();
  localWalls = (await OBR.scene.local.getItems().catch(() => [])).filter((i) => i.type === "WALL" || i.metadata?.["com.battle-system.smoke/isVisionLine"]);
  walls = wallsFrom([...localWalls, ...items]);
  const md0 = await OBR.scene.getMetadata();
  access = { players: [], autoApprove: false, ...(md0[ACCESS] || {}) };
  estGroups = Array.isArray(md0[EST_GROUPS]) ? md0[EST_GROUPS] : [];
  prevSeen.clear(); prevState.clear();
  for (const it of items) { const n = nodeOf(it); if (n) prevState.set(it.id, n.state); }
  // quem já está no cone ao abrir a cena não dispara alarme
  for (const it of items) if (camOf(it)) prevSeen.set(it.id, new Set(seenBy(it, items, walls, dpi, Date.now(), estGroups)));
  ready = true;
  draw();
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  myId = await OBR.player.getId().catch(() => "");
  myConn = await OBR.player.getConnectionId().catch(() => "");
  await refreshLeader();
  OBR.player.onChange((p) => { if (p.role !== role) { role = p.role; refreshLeader(); draw(); } });
  OBR.party.onChange(() => refreshLeader());

  // ----- menus do botão direito -----
  const GM = { roles: ["GM"] };
  await OBR.contextMenu.create({
    id: `${ID}/camera`,
    icons: [{ icon: url("camera.svg"), label: "Virar câmera (Vigilância)", filter: { ...GM, every: [{ key: ["metadata", CAM], value: undefined }] } }],
    onClick: async (ctx) => { await makeCamera(ctx.items.map((i) => i.id)); OBR.action.open().catch(() => {}); },
  });
  await OBR.contextMenu.create({
    id: `${ID}/no`,
    icons: [{ icon: url("node.svg"), label: "Virar nó da Matriz", filter: { ...GM, every: [{ key: ["metadata", NODE], value: undefined }] } }],
    onClick: async (ctx) => { await makeNode(ctx.items.map((i) => i.id)); OBR.action.open().catch(() => {}); },
  });
  await OBR.contextMenu.create({
    id: `${ID}/deck`,
    icons: [
      { icon: url("deck.svg"), label: "Dar commlink/cyberdeck (vê a Matriz)", filter: { ...GM, every: [{ key: "layer", value: "CHARACTER" }, { key: ["metadata", DECK], value: undefined }] } },
      { icon: url("deck.svg"), label: "Tirar commlink/cyberdeck", filter: { ...GM, every: [{ key: "layer", value: "CHARACTER" }, { key: ["metadata", DECK], value: true }] } },
    ],
    onClick: (ctx) => {
      const give = ctx.items.some((i) => i.metadata?.[DECK] !== true);
      OBR.scene.items.updateItems(ctx.items.map((i) => i.id), (d) => { for (const it of d) { if (give) it.metadata[DECK] = true; else delete it.metadata[DECK]; } });
    },
  });
  await OBR.contextMenu.create({
    id: `${ID}/hackear`,
    icons: [{ icon: url("node.svg"), label: "Hackear (Matriz)", filter: { roles: ["PLAYER"], max: 1, every: [{ key: ["metadata", NODE], value: undefined, operator: "!=" }] } }],
    onClick: (ctx) => {
      if (!hasAccess(myId, role, items, access)) return OBR.notification.show("Vigilância: você precisa de um commlink ou cyberdeck para mexer na Matriz.", "WARNING");
      OBR.broadcast.sendMessage(CH_REQ, { node: ctx.items[0].id, action: "hackeado" }, { destination: "ALL" });
      OBR.notification.show("Pedido enviado ao mestre: hackear. (Outras ações no painel Vigilância.)", "INFO");
    },
  });

  // ----- avisos -----
  OBR.broadcast.onMessage(CH_SEEN, (e) => {
    const d = e.data || {};
    if (role !== "GM" && !d.alertAll) return;
    const who = (d.tokens || []).map((id) => itemName(items.find((i) => i.id === id))).join(", ");
    OBR.notification.show(`📷 ${d.name} viu: ${who}`, "WARNING");
  });
  OBR.broadcast.onMessage(CH_RES, (e) => {
    const d = e.data || {};
    if (d.by !== myId || role === "GM") return;
    OBR.notification.show(d.ok ? `Matriz: "${d.nodeName}" agora está ${stateLabel(d.action)}.` : `Matriz: o mestre negou o pedido em "${d.nodeName}".`, d.ok ? "SUCCESS" : "WARNING");
  });
  OBR.broadcast.onMessage(CH_REQ, onRequest);
  OBR.broadcast.onMessage(CH_SET, onSet);
  OBR.broadcast.onMessage(CH_VISION, onVision);
  OBR.broadcast.onMessage(CH_PREFS, (e) => { prefs = { ...prefs, ...(e.data || {}) }; draw(); });

  perf = readPerf();
  onPerf((p) => { perf = p; draw(); });
  onClean(() => { clearLocal().then(() => draw()); });

  // ----- cena -----
  if (await OBR.scene.isReady()) await loadScene();
  OBR.scene.onReadyChange((r) => { if (r) loadScene(); else { ready = false; shown.clear(); } });
  OBR.scene.items.onChange((list) => { items = list; walls = wallsFrom([...localWalls, ...items]); watchNodes(); draw(); });
  OBR.scene.local.onChange((list) => {
    const w = list.filter((i) => i.type === "WALL" || i.metadata?.["com.battle-system.smoke/isVisionLine"]);
    const sig = JSON.stringify(w.map((i) => [i.id, i.position, i.rotation, i.points, i.blocking]));
    if (sig === wallSig) return;
    wallSig = sig; localWalls = w;
    walls = wallsFrom([...localWalls, ...items]);
    draw();
  });
  OBR.scene.onMetadataChange((md) => {
    access = { players: [], autoApprove: false, ...(md[ACCESS] || {}) };
    estGroups = Array.isArray(md[EST_GROUPS]) ? md[EST_GROUPS] : [];
    draw();
  });
  OBR.scene.grid.onChange((g) => { dpi = g.dpi || dpi; draw(); });
  loop();
});
