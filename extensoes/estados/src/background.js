import { controls } from "./visibility.js";
// Motor dos Estados.
// No MESTRE: grava sozinho o que você muda no estado atual (modo Editando) e troca os estados.
// Em TODOS: percebe quando alguém clica num item-botão e pede a troca ao mestre.
import OBR from "@owlbear-rodeo/sdk";
import { capture, changedProps, applyTo, resolveTarget, findGroup, frame, FLOOR, isBuilding } from "./core.js";
import { assignFloor, moveFloor } from "./floors.js";
import { ID, GROUPS, DATA, BUTTON, CH_SET, CH_CHANGED, CH_NOTE, url } from "./shared.js";

let role = "PLAYER";
let myConn = "";
let groups = [];
const busy = new Set();          // grupos trocando de estado agora (não grava no meio)
const queue = new Map();         // grupoId -> promessa da troca em andamento
const MOTION = ["position", "rotation", "scale"];
const isToken = (i) => i.type === "IMAGE" && (i.layer === "CHARACTER" || i.layer === "MOUNT");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => a && b && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

async function saveGroups() {
  await OBR.scene.setMetadata({ [GROUPS]: JSON.parse(JSON.stringify(groups)) });
}

/** Só um mestre executa pedidos vindos de outros (se houver dois mestres na sala). */
async function isLeader() {
  const others = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role === "GM").map((p) => p.connectionId);
  return [myConn, ...others].sort()[0] === myConn;
}

// ---------- gravação ao vivo ----------
function record(items) {
  const live = groups.filter((g) => g.rec && !isBuilding(g) && !busy.has(g.id)); // prédios não gravam ao vivo
  if (!live.length) return;
  const todo = new Map(); // itemId -> { [gid]: { [sid]: dados } }
  for (const it of items) {
    const all = it.metadata?.[DATA];
    if (!all) continue;
    for (const g of live) {
      if (!all[g.id]) continue;
      const data = all[g.id][g.current];
      const missing = data ? g.props.filter((p) => !(p in data)) : g.props;
      const diff = data ? changedProps(it, data, g.props) : [];
      const need = [...new Set([...missing, ...diff])];
      if (!need.length) continue;
      const next = { ...(data || {}), ...capture(it, need) };
      const cur = todo.get(it.id) || {};
      cur[g.id] = { ...(cur[g.id] || {}), [g.current]: next };
      todo.set(it.id, cur);
    }
  }
  if (!todo.size) return;
  OBR.scene.items.updateItems([...todo.keys()], (d) => {
    for (const it of d) {
      const add = todo.get(it.id);
      const all = JSON.parse(JSON.stringify(it.metadata[DATA] || {}));
      for (const [gid, states] of Object.entries(add)) all[gid] = { ...(all[gid] || {}), ...states };
      it.metadata[DATA] = all;
    }
  }).catch((e) => console.error(`[${ID}]`, e));
}

// ---------- troca de estado ----------
async function change(ref, to, carry = []) {
  const g = findGroup(groups, ref);
  if (!g) return;
  const prev = queue.get(g.id) || Promise.resolve();
  const p = prev.then(() => doChange(g.id, to, carry)).catch((e) => console.error(`[${ID}]`, e));
  queue.set(g.id, p);
  return p;
}

async function doChange(gid, to, carry = []) {
  const g = groups.find((x) => x.id === gid);
  if (!g) return;
  const target = resolveTarget(g, to);
  if (!target) return;
  busy.add(g.id);
  try {
    // prédio: quem sobe/desce junto (ex.: quem usou a escada) passa a morar no andar novo
    if (isBuilding(g) && carry?.length) await assignFloor({ ...g, current: target.id }, carry, target.id);
    const items = (await OBR.scene.items.getItems()).filter((i) => i.metadata?.[DATA]?.[g.id]);
    // dados do novo estado; item que ainda não tem esse estado herda como está agora
    const tdata = new Map();
    for (const it of items) tdata.set(it.id, it.metadata[DATA][g.id][target.id] || capture(it, g.props));
    g.current = target.id;
    saveGroups().catch(() => {});

    const ids = items.map((i) => i.id);
    const props = g.props;
    const moves = props.filter((p) => MOTION.includes(p));
    const keepData = (d) => {
      // guarda o estado herdado no item, para a próxima vez
      const all = JSON.parse(JSON.stringify(d.metadata[DATA] || {}));
      all[g.id] = { ...(all[g.id] || {}), [target.id]: tdata.get(d.id) };
      d.metadata[DATA] = all;
    };

    if (ids.length && g.transition > 0 && moves.length) {
      // deslizar: o que não é movimento muda antes; esconder fica para o fim
      const startPose = new Map(items.map((i) => [i.id, capture(i, moves)]));
      const rest = props.filter((p) => !MOTION.includes(p));
      await OBR.scene.items.updateItems(ids, (d) => {
        for (const it of d) {
          const t = tdata.get(it.id);
          const pre = { ...t };
          if (pre.visible === false) delete pre.visible;
          applyTo(it, pre, rest);
          keepData(it);
        }
      });
      const steps = Math.max(2, Math.round(g.transition / 50));
      for (let k = 1; k <= steps; k++) {
        await wait(g.transition / steps);
        await OBR.scene.items.updateItems(ids, (d) => {
          for (const it of d) {
            const f = frame(startPose.get(it.id), tdata.get(it.id), k / steps);
            applyTo(it, f, moves);
          }
        });
      }
      await OBR.scene.items.updateItems(ids, (d) => { for (const it of d) applyTo(it, tdata.get(it.id), props); });
    } else if (ids.length) {
      // na hora; tokens que mudam de lugar pulam escondidos (a névoa dinâmica não deixa token visível atravessar parede)
      const jumpers = items.filter((i) => isToken(i) && i.visible !== false && props.includes("position")
        && tdata.get(i.id).position && !same(i.position, tdata.get(i.id).position)).map((i) => i.id);
      if (jumpers.length) await OBR.scene.items.updateItems(jumpers, (d) => { for (const it of d) it.visible = false; });
      await OBR.scene.items.updateItems(ids, (d) => {
        for (const it of d) {
          applyTo(it, tdata.get(it.id), props);
          if (jumpers.includes(it.id)) it.visible = false;
          keepData(it);
        }
      });
      if (jumpers.length) {
        await OBR.scene.items.updateItems(jumpers, (d) => {
          for (const it of d) { const v = tdata.get(it.id).visible; it.visible = v === undefined ? true : v; }
        });
      }
    }
    if (target.note) OBR.broadcast.sendMessage(CH_NOTE, { text: target.note }, { destination: "ALL" }).catch(() => {});
    OBR.broadcast.sendMessage(CH_CHANGED, { group: g.id, groupName: g.name, state: target.id, stateName: target.name }, { destination: "ALL" }).catch(() => {});
  } finally {
    // deixa os ecos da troca passarem antes de voltar a gravar; depois confere de novo o mapa,
    // para gravar o que você mexeu durante a troca
    setTimeout(async () => {
      busy.delete(g.id);
      if (role === "GM" && g.rec) record(await OBR.scene.items.getItems().catch(() => []));
    }, 400);
  }
}

// ---------- botões no mapa ----------
let lastButton = 0;
async function onSelection(sel) {
  if (!sel || sel.length !== 1) return;
  const [it] = await OBR.scene.items.getItems(sel).catch(() => []);
  const b = it?.metadata?.[BUTTON];
  if (!b) return;
  // o mestre editando o grupo pode selecionar o botão sem disparar (para mover, renomear…)
  if (role === "GM") {
    const g = findGroup(groups, b.group);
    if (g?.rec) return;
  }
  if (Date.now() - lastButton < 400) return;
  lastButton = Date.now();
  OBR.player.deselect().catch(() => {});
  if (role === "GM") change(b.group, b.to || "next");
  else OBR.broadcast.sendMessage(CH_SET, { group: b.group, to: b.to || "next" }, { destination: "REMOTE" }).catch(() => {});
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  myConn = await OBR.player.getConnectionId().catch(() => "");
  let lastSel = "";
  OBR.player.onChange((p) => {
    role = p.role;
    const s = JSON.stringify(p.selection || []);
    if (s !== lastSel) { lastSel = s; onSelection(p.selection); }
  });

  OBR.broadcast.onMessage(CH_NOTE, (e) => { if (e.data?.text) OBR.notification.show(e.data.text, "INFO"); });

  const load = async () => {
    const md = await OBR.scene.getMetadata();
    groups = Array.isArray(md[GROUPS]) ? md[GROUPS] : [];
  };
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => { if (r) load(); });
  OBR.scene.onMetadataChange((md) => {
    const next = Array.isArray(md[GROUPS]) ? md[GROUPS] : [];
    // durante uma troca, o estado atual local manda (o metadado pode chegar atrasado)
    for (const g of next) { const mine = groups.find((x) => x.id === g.id); if (mine && busy.has(g.id)) g.current = mine.current; }
    groups = next;
  });
  OBR.scene.items.onChange((items) => { if (role === "GM") record(items); });

  // pedidos de troca: do painel, do Gatilhos (no mesmo navegador) ou de botões clicados por jogadores
  OBR.broadcast.onMessage(CH_SET, async (e) => {
    if (role !== "GM") return;
    if (e.connectionId && e.connectionId !== myConn) {
      // pedido de outra pessoa: se veio de outro mestre, o navegador dele já cuida;
      // se veio de um jogador (botão no mapa), só o mestre "líder" executa
      const sender = (await OBR.party.getPlayers().catch(() => [])).find((x) => x.connectionId === e.connectionId);
      if (sender?.role === "GM" || !(await isLeader())) return;
    }
    change(e.data?.group, e.data?.to ?? "next", Array.isArray(e.data?.carry) ? e.data.carry : []);
  });

  await controls.contextMenu.create({
    id: `${ID}/proximo`,
    icons: [{
      icon: url("icon.svg"), label: "Estados: próximo estado",
      filter: { roles: ["GM"], every: [{ key: ["metadata", DATA], value: undefined, operator: "!=" }] },
    }],
    onClick: async (ctx) => {
      const gids = new Set();
      for (const it of ctx.items) for (const gid of Object.keys(it.metadata?.[DATA] || {})) gids.add(gid);
      for (const gid of gids) change(gid, "next");
    },
  });

  // ----- prédios: ver outro andar / levar itens de andar -----
  const inBuilding = { roles: ["GM"], every: [{ key: ["metadata", FLOOR], value: undefined, operator: "!=" }] };
  const buildingOf = (ctx) => [...new Set(ctx.items.map((i) => i.metadata?.[FLOOR]?.g).filter(Boolean))];
  await controls.contextMenu.create({
    id: `${ID}/andar-cima`,
    icons: [{ icon: url("up.svg"), label: "Prédio: mostrar o andar de cima", filter: inBuilding }],
    onClick: (ctx) => { for (const gid of buildingOf(ctx)) change(gid, "next"); },
  });
  await controls.contextMenu.create({
    id: `${ID}/andar-baixo`,
    icons: [{ icon: url("down.svg"), label: "Prédio: mostrar o andar de baixo", filter: inBuilding }],
    onClick: (ctx) => { for (const gid of buildingOf(ctx)) change(gid, "prev"); },
  });
  await controls.contextMenu.create({
    id: `${ID}/levar-cima`,
    icons: [{ icon: url("up.svg"), label: "Prédio: levar para o andar de cima", filter: inBuilding }],
    onClick: async (ctx) => {
      const n = await moveFloor(groups, ctx.items, 1);
      OBR.notification.show(n ? `Estados: ${n} item(ns) no andar de cima.` : "Estados: já está no último andar.", n ? "INFO" : "WARNING");
    },
  });
  await controls.contextMenu.create({
    id: `${ID}/levar-baixo`,
    icons: [{ icon: url("down.svg"), label: "Prédio: levar para o andar de baixo", filter: inBuilding }],
    onClick: async (ctx) => {
      const n = await moveFloor(groups, ctx.items, -1);
      OBR.notification.show(n ? `Estados: ${n} item(ns) no andar de baixo.` : "Estados: já está no térreo.", n ? "INFO" : "WARNING");
    },
  });
});
