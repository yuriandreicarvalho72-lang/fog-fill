import { controls } from "./visibility.js";
// Anonimato em segundo plano.
// - Menu do botão direito (mestre): tornar anônimo / revelar.
// - O mestre líder (menor connectionId) aplica o rosto anônimo nos itens, devolve o verdadeiro ao desligar e desfaz o
//   que um jogador mexer num item anônimo travado.
// - Cada mestre vê um rótulo local com quem o item é de verdade (os jogadores não).
import OBR, { buildText } from "@owlbear-rodeo/sdk";
import { ANON, DEFAULT_CFG, cfgOf, needs, applyTo, realLabel, snapOf, sameSnap, revert, byPlayer } from "./core.js";

const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
const LABEL = `${ANON}/rotulo`;
let role = "PLAYER", myConn = "", myId = "";
let gmIds = new Set();
let items = [], dpi = 150;
const snaps = new Map();   // itemId -> snapshot do que o jogador não pode mudar
const labels = new Map();  // itemId -> { id, sig }
let busy = false, again = false, labelBusy = false, labelAgain = false;

async function refreshParty() {
  const ps = await OBR.party.getPlayers().catch(() => []);
  gmIds = new Set([myId, ...ps.filter((p) => p.role === "GM").map((p) => p.id)].filter(Boolean));
}
async function isLeader() {
  if (role !== "GM") return false;
  const gms = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role === "GM").map((p) => p.connectionId);
  return [myConn, ...gms].sort()[0] === myConn;
}

/** Aplica o anonimato, desfaz mexidas de jogadores e atualiza os snapshots. Só o mestre líder. */
async function enforce() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    do {
      again = false;
      if (!(await isLeader())) return;
      const generic = url("anonimo.png");
      const fix = [], rev = [];
      const seen = new Set();
      for (const it of items) {
        const s = snaps.get(it.id);
        // a trava vale pelo que estava protegido (snapshot): jogador desligando o anonimato também é desfeito
        if (s && byPlayer(it, gmIds) && !sameSnap(s, snapOf(it))) { rev.push(it.id); seen.add(it.id); continue; }
        const cfg = cfgOf(it);
        if (!cfg) { snaps.delete(it.id); continue; }
        seen.add(it.id);
        const locked = cfg.on && cfg.trava !== false;
        if (!locked) snaps.delete(it.id);
        if (needs(it, generic)) fix.push(it.id);
        else if (locked) snaps.set(it.id, snapOf(it));
      }
      for (const id of [...snaps.keys()]) if (!seen.has(id)) snaps.delete(id);
      if (rev.length) {
        await OBR.scene.items.updateItems(rev, (d) => { for (const it of d) { const s = snaps.get(it.id); if (s) revert(it, s); } }).catch(() => {});
      }
      if (fix.length) await OBR.scene.items.updateItems(fix, (d) => { for (const it of d) applyTo(it, generic); }).catch(() => {});
    } while (again);
  } finally { busy = false; }
}

/** Rótulo local do mestre com o nome verdadeiro, em cima do item. */
async function drawLabels() {
  if (labelBusy) { labelAgain = true; return; }
  labelBusy = true;
  try {
    do {
      labelAgain = false;
      if (role !== "GM") return;
      const want = new Map(items.filter((i) => cfgOf(i)?.on && cfgOf(i)?.real).map((i) => [i.id, i]));
      const del = [], add = [];
      for (const [id, l] of labels) if (!want.has(id)) { del.push(l.id); labels.delete(id); }
      for (const [id, it] of want) {
        const b = await OBR.scene.items.getItemBounds([id]).catch(() => null);
        if (!b) continue;
        const text = realLabel(it);
        const sig = JSON.stringify([text, Math.round(b.width), Math.round(b.height)]);
        const cur = labels.get(id);
        if (cur && cur.sig === sig) continue;
        if (cur) del.push(cur.id);
        const w = dpi * 3;
        const t = buildText().plainText(text).textType("PLAIN").width(w).fontSize(Math.max(14, Math.round(dpi / 7)))
          .textAlign("CENTER").fillColor("#ffe9a8").strokeColor("#000000").strokeWidth(3)
          .position({ x: b.center.x - w / 2, y: b.min.y - dpi * 0.5 })
          .attachedTo(id).layer("TEXT").locked(true).disableHit(true).name("Anonimato: quem é")
          .disableAttachmentBehavior(["ROTATION", "SCALE", "COPY", "LOCKED", "VISIBLE"])
          .metadata({ [LABEL]: id }).build();
        add.push(t);
        labels.set(id, { id: t.id, sig });
      }
      if (del.length) await OBR.scene.local.deleteItems(del).catch(() => {});
      if (add.length) await OBR.scene.local.addItems(add).catch(() => {});
    } while (labelAgain);
  } finally { labelBusy = false; }
}

const onItems = (list) => { items = list; enforce(); drawLabels(); };

async function setOn(ids, on) {
  await OBR.scene.items.updateItems(ids, (d) => { for (const it of d) it.metadata[ANON] = { ...DEFAULT_CFG, ...(it.metadata[ANON] || {}), on }; });
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  myConn = await OBR.player.getConnectionId().catch(() => "");
  myId = await OBR.player.getId().catch(() => "");
  OBR.player.onChange((p) => { role = p.role; });
  await refreshParty();
  OBR.party.onChange(() => refreshParty());

  await controls.contextMenu.create({
    id: `${ANON}/menu`,
    icons: [
      { icon: url("icon.svg"), label: "Anonimato: revelar", filter: { roles: ["GM"], some: [{ key: ["metadata", ANON, "on"], value: true }] } },
      { icon: url("icon.svg"), label: "Anonimato: tornar anônimo", filter: { roles: ["GM"] } },
    ],
    onClick: (ctx) => {
      const ids = ctx.items.map((i) => i.id);
      const anyOn = ctx.items.some((i) => cfgOf(i)?.on);
      return setOn(ids, !anyOn);
    },
  });

  const start = async () => {
    dpi = await OBR.scene.grid.getDpi().catch(() => 150);
    snaps.clear();
    for (const l of labels.values()) await OBR.scene.local.deleteItems([l.id]).catch(() => {});
    labels.clear();
    const old = await OBR.scene.local.getItems((i) => i.metadata?.[LABEL]).catch(() => []);
    if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id)).catch(() => {});
    onItems(await OBR.scene.items.getItems());
  };
  if (await OBR.scene.isReady()) await start();
  OBR.scene.onReadyChange((r) => { if (r) start(); });
  OBR.scene.items.onChange(onItems);
  OBR.scene.grid.onChange((g) => { dpi = g.dpi || dpi; });
});
