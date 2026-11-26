// Cenário destrutível e cargas plantadas: operações com o SDK.
// Quem muda a cena é só o mestre líder (menor connectionId entre os mestres); os outros pedem por mensagem.
import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import {
  DESTR, CHARGE, DEFAULT_DESTR, DEFAULT_PLANT, destrOf, chargeOf, addDamage, damageText, affects,
  centerOf, sizeOf, caughtBy,
} from "./destroy.js";
import {
  CH_DESTROYED, CH_BLAST, CH_PLANT, CH_DETONATE, PENDING, PLANT_CFG, ESTADOS_SET, GATILHOS_FIRE, TROCADOR_SWAP,
  url, uid, itemName, isToken,
} from "./shared.js";

export async function isLeaderGM(myConn) {
  if ((await OBR.player.getRole()) !== "GM") return false;
  const gms = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role === "GM").map((p) => p.connectionId);
  return [myConn, ...gms].sort()[0] === myConn;
}

// ---------------- cenário destrutível ----------------
export async function markDestructible(ids) {
  if (!ids.length) return;
  await OBR.scene.items.updateItems(ids, (d) => { for (const it of d) if (!it.metadata[DESTR]) it.metadata[DESTR] = { ...DEFAULT_DESTR }; });
}
export async function unmarkDestructible(ids) {
  await OBR.scene.items.updateItems(ids, (d) => { for (const it of d) delete it.metadata[DESTR]; });
}
export async function editDestr(id, fn) {
  await OBR.scene.items.updateItems([id], (d) => { for (const it of d) it.metadata[DESTR] = fn({ ...DEFAULT_DESTR, ...(it.metadata[DESTR] || {}) }); });
}

const hideDraft = (it) => { it.visible = false; if (it.type === "WALL") it.blocking = false; };

/** Quebra o item: efeito para todos, o que o mestre escolheu (esconder, apagar, trocar a imagem), paredes, Estados, Gatilhos. */
export async function breakItem(item, d, by = null) {
  const dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  const [shooter] = by ? await OBR.scene.items.getItems([by]).catch(() => []) : [];
  await OBR.broadcast.sendMessage(CH_DESTROYED, {
    id: item.id, name: itemName(item), at: centerOf(item, dpi), size: sizeOf(item, dpi), by, byName: shooter ? itemName(shooter) : "",
  }, { destination: "ALL" }).catch(() => {});
  const walls = (d.walls || []).filter((w) => w !== item.id);
  // espera a poeira cobrir antes de sumir
  await new Promise((r) => setTimeout(r, 350));
  if (d.on === "delete") {
    await OBR.scene.items.deleteItems([item.id, ...walls]).catch(() => {});
  } else {
    const hideIds = [...(d.on === "hide" ? [item.id] : []), ...walls];
    if (hideIds.length) await OBR.scene.items.updateItems(hideIds, (dr) => { for (const it of dr) hideDraft(it); }).catch(() => {});
    if (d.on === "image") OBR.broadcast.sendMessage(TROCADOR_SWAP, { targets: [item.id], to: d.image || "next", from: "Arsenal" }, { destination: "ALL" }).catch(() => {});
  }
  if (d.group) OBR.broadcast.sendMessage(ESTADOS_SET, { group: d.group, to: d.to || "next" }, { destination: "ALL" }).catch(() => {});
  if (d.trigger) OBR.broadcast.sendMessage(GATILHOS_FIRE, { id: d.trigger, on: by ? [by] : [] }, { destination: "LOCAL" }).catch(() => {});
}

/** Conserta: zera o dano e mostra de novo (o item e as paredes que tinham sumido). Item apagado não volta. */
export async function repair(id) {
  const [it] = await OBR.scene.items.getItems([id]);
  const d = destrOf(it);
  if (!d) return;
  const walls = (d.walls || []).filter((w) => w !== id);
  await OBR.scene.items.updateItems([id], (dr) => {
    for (const x of dr) {
      x.metadata[DESTR] = { ...d, s: 0, b: 0, broken: false };
      if (d.on === "hide") { x.visible = true; if (x.type === "WALL") x.blocking = true; }
    }
  });
  if (walls.length) await OBR.scene.items.updateItems(walls, (dr) => { for (const x of dr) { x.visible = true; if (x.type === "WALL") x.blocking = true; } }).catch(() => {});
  if (d.on === "image") OBR.broadcast.sendMessage(TROCADOR_SWAP, { targets: [id], to: "prev", from: "Arsenal" }, { destination: "ALL" }).catch(() => {});
}

/** Quebra agora (mestre, botão direito ou painel). */
export async function breakNow(id, by = null) {
  const [it] = await OBR.scene.items.getItems([id]);
  const d = destrOf(it);
  if (!d || d.broken) return;
  const nd = { ...d, broken: true };
  await OBR.scene.items.updateItems([id], (dr) => { for (const x of dr) x.metadata[DESTR] = nd; });
  await breakItem(it, nd, by);
}

/**
 * Aplica eventos de dano ([{ kind, at, r?, id?, heavy? }]) no cenário. by = token que atirou/plantou.
 * Só o líder chama. Avisa o mestre do dano que não quebrou.
 */
export async function applyEvents(events, by = null) {
  if (!events.length) return;
  const dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  const items = (await OBR.scene.items.getItems()).filter((i) => i.metadata?.[DESTR]);
  const changed = new Map(), broke = [];
  for (const it of items) {
    let d = destrOf(it);
    for (const ev of events) {
      if (!affects(ev, it, d, dpi)) continue;
      const r = addDamage(d, ev.kind === "shape" ? ev.peso : ev.kind);
      if (!r.counted) continue;
      d = r.d;
      changed.set(it.id, d);
      if (r.broken) { broke.push([it, d]); break; }
    }
  }
  if (!changed.size) return;
  await OBR.scene.items.updateItems([...changed.keys()], (dr) => { for (const x of dr) x.metadata[DESTR] = changed.get(x.id); }).catch(() => {});
  const hurt = [...changed].filter(([id]) => !broke.some(([b]) => b.id === id)).map(([id, d]) => `${itemName(items.find((i) => i.id === id))}: ${damageText(d)}`);
  if (hurt.length) OBR.notification.show(`Arsenal — dano no cenário: ${hurt.join(" · ")}`, "INFO");
  for (const [it, d] of broke) await breakItem(it, d, by);
}

// ---------------- cargas plantadas ----------------
export const getPlantCfg = async () => ({ ...DEFAULT_PLANT, ...((await OBR.player.getMetadata())[PLANT_CFG] || {}) });
export const setPlantCfg = async (patch) => OBR.player.setMetadata({ [PLANT_CFG]: { ...(await getPlantCfg()), ...patch } });

/** Cria a carga (só o líder). req: { at, attach?, mode, sec, show, radius, token }; player = quem plantou. */
export async function createCharge(req, player) {
  const [tok] = req.token ? await OBR.scene.items.getItems([req.token]).catch(() => []) : [];
  const [host] = req.attach ? await OBR.scene.items.getItems([req.attach]).catch(() => []) : [];
  const mode = req.mode === "remote" ? "remote" : "timer";
  const sec = Math.max(1, Math.min(3600, Number(req.sec) || DEFAULT_PLANT.sec));
  const c = {
    by: player.id, byName: player.name || "", token: tok?.id || null, mode, sec,
    endsAt: mode === "timer" ? Date.now() + sec * 1000 : null,
    radius: Math.max(0.5, Math.min(12, Number(req.radius) || DEFAULT_PLANT.radius)),
    show: req.show === "me" ? "me" : "all",
    name: `Carga${tok ? ` de ${itemName(tok)}` : player.name ? ` de ${player.name}` : ""}`,
  };
  let b = buildImage({ width: 200, height: 200, url: url("charge.svg"), mime: "image/svg+xml" }, { dpi: 400, offset: { x: 100, y: 100 } })
    .position(req.at || host?.position || { x: 0, y: 0 }).layer("PROP").visible(false).name(c.name).metadata({ [CHARGE]: c });
  if (host) b = b.attachedTo(host.id);
  const item = b.build();
  await OBR.scene.items.addItems([item]);
  if (c.show === "all" && mode === "timer") OBR.notification.show(`💣 ${c.name}: ${sec} s${host ? ` (em ${itemName(host)})` : ""}`, "WARNING");
  else OBR.notification.show(`💣 ${c.name} plantada${host ? ` em ${itemName(host)}` : ""} (${mode === "timer" ? `${sec} s` : "remoto"}).`, "INFO");
  return item.id;
}

/** Cargas pedidas por ids: a própria carga ou as cargas coladas no item. */
export function chargesFor(ids, items) {
  const set = new Set(ids || []);
  return items.filter((i) => i.metadata?.[CHARGE] && (set.has(i.id) || (i.attachedTo && set.has(i.attachedTo))));
}

/** Explode a carga (só o líder): some, explosão para todos, dano no cenário, aviso ao mestre de quem foi pego. */
export async function detonate(item) {
  const c = chargeOf(item);
  if (!c) return;
  const dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  const all = await OBR.scene.items.getItems();
  if (!all.some((i) => i.id === item.id)) return; // já explodiu
  await OBR.scene.items.deleteItems([item.id]).catch(() => {});
  const at = item.position;
  const caught = caughtBy(at, c.radius, all, dpi);
  await OBR.broadcast.sendMessage(CH_BLAST, {
    id: item.id, at, radius: c.radius, by: c.token, byPlayer: c.by, name: c.name, caught, seed: Math.floor(Math.random() * 2 ** 31),
  }, { destination: "ALL" }).catch(() => {});
  const names = caught.map((id) => itemName(all.find((i) => i.id === id)));
  OBR.notification.show(`💥 ${c.name} explodiu${names.length ? `: pegou ${names.join(", ")}` : " (ninguém no raio)"}.`, "WARNING");
  setTimeout(() => applyEvents([{ kind: "blast", at, r: c.radius }], c.token).catch(() => {}), 450);
  // outras cargas no raio explodem junto
  const near = all.filter((i) => i.id !== item.id && i.metadata?.[CHARGE] && Math.hypot(i.position.x - at.x, i.position.y - at.y) <= c.radius * dpi);
  for (const n of near) setTimeout(() => detonate(n).catch(() => {}), 300);
}

export async function disarm(item, who = "") {
  const c = chargeOf(item);
  if (!c) return;
  await OBR.scene.items.deleteItems([item.id]).catch(() => {});
  OBR.notification.show(`🛠 ${c.name} desarmada${who ? ` por ${who}` : ""}.`, "SUCCESS");
}

/** Pedido de desarmar de um jogador que não plantou: vai para a lista do mestre. */
export async function addDisarmRequest(item, player) {
  const md = await OBR.scene.getMetadata();
  const list = Array.isArray(md[PENDING]) ? md[PENDING] : [];
  if (list.some((r) => r.charge === item.id && r.by === player.id)) return;
  await OBR.scene.setMetadata({ [PENDING]: [...list, { id: uid(), charge: item.id, by: player.id, byName: player.name || "Jogador", at: Date.now() }] });
  OBR.notification.show(`🛠 ${player.name || "Um jogador"} quer desarmar ${chargeOf(item)?.name || "a carga"} — aprove no painel Arsenal → Cargas.`, "WARNING");
}
export async function decideDisarm(reqId, ok) {
  const md = await OBR.scene.getMetadata();
  const list = Array.isArray(md[PENDING]) ? md[PENDING] : [];
  const r = list.find((x) => x.id === reqId);
  await OBR.scene.setMetadata({ [PENDING]: list.filter((x) => x.id !== reqId) });
  if (!r) return;
  const [it] = await OBR.scene.items.getItems([r.charge]).catch(() => []);
  if (ok && it) await disarm(it, r.byName);
  else if (!ok) OBR.notification.show(`Arsenal: pedido de ${r.byName} para desarmar negado.`, "INFO");
}

// ---------------- pedidos (qualquer navegador) ----------------
/** Planta no ponto (ou colado no item). Mestre cria direto; jogador pede ao mestre líder. */
export async function plant(at, attach, token, myConn) {
  const cfg = await getPlantCfg();
  const req = { at, attach: attach || null, token: token || null, ...cfg };
  if (await isLeaderGM(myConn)) return createCharge(req, { id: await OBR.player.getId(), name: await OBR.player.getName().catch(() => "") });
  await OBR.broadcast.sendMessage(CH_PLANT, req, { destination: "ALL" });
}
export const requestCharges = (ids, op = "detonar", from) =>
  OBR.broadcast.sendMessage(CH_DETONATE, { ids, op, from }, { destination: "ALL" });

export { isToken };
