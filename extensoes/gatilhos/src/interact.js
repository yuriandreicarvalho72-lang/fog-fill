// Objetos interagíveis (alavancas, portas, botões).
// - Brilho pulsando em volta de cada um (item LOCAL em cada navegador: todos veem, ninguém clica nele).
//   Fica mais forte quando um personagem seu está ao alcance.
// - O jogador interage clicando no objeto, pelo menu do botão direito ou pela lista no painel.
//   O alcance é conferido aqui (resposta na hora) e de novo no navegador do mestre, que executa o gatilho.
import OBR, { buildShape } from "@owlbear-rodeo/sdk";
import { zoneShape, shapeBox, pickReacher } from "./engine.js";
import { LIST, CH_INTERACT, isInteract, isToken } from "./shared.js";

const GLOW_META = "gatilhos/brilho";
const nameOf = (it) => it?.text?.plainText?.trim() || it?.name || "isto";

/** Gatilhos de interação de um item que esta pessoa pode usar. */
export function usableTriggers(triggers, itemId, role) {
  return triggers.filter((t) => isInteract(t) && (t.zones || []).includes(itemId)
    && !((t.canUse === "players" && role === "GM") || (t.canUse === "gm" && role !== "GM")));
}

/**
 * Tenta usar um objeto. Confere alcance (jogador) e pede ao mestre.
 * onGM(itemId, userId): o mestre executa direto no próprio navegador (sem mensagem).
 */
export async function tryInteract(itemId, onGM) {
  const [role, userId, md, items, dpi] = await Promise.all([
    OBR.player.getRole(), OBR.player.getId(), OBR.scene.getMetadata(), OBR.scene.items.getItems(), OBR.scene.grid.getDpi().catch(() => 150),
  ]);
  const triggers = Array.isArray(md[LIST]) ? md[LIST] : [];
  const it = items.find((i) => i.id === itemId);
  if (!it) return;
  const trs = usableTriggers(triggers, itemId, role);
  if (!trs.length) {
    const any = triggers.some((t) => isInteract(t) && (t.zones || []).includes(itemId));
    if (any) OBR.notification.show(role === "GM" ? `${nameOf(it)}: só os jogadores podem usar.` : `Você não consegue usar ${nameOf(it)}.`, "WARNING");
    return;
  }
  if (role === "GM") return onGM?.(itemId, userId);
  const mine = items.filter((i) => isToken(i) && i.createdUserId === userId);
  const reach = Math.max(...trs.map((t) => (t.reach > 0 ? t.reach : Infinity)));
  const r = pickReacher(mine, zoneShape(it, dpi), reach === Infinity ? 0 : reach, dpi);
  if (!r.ok) {
    OBR.notification.show(mine.length ? `Muito longe para alcançar ${nameOf(it)}.` : `Você precisa de um personagem perto de ${nameOf(it)}.`, "WARNING");
    return;
  }
  await OBR.broadcast.sendMessage(CH_INTERACT, { itemId }, { destination: "REMOTE" });
}

// ---------------- brilho ----------------
const rings = new Map(); // itemId -> { ringId, sig, near, color }
let busy = false, again = false, timer = null;
let state = { triggers: [], items: [], dpi: 150, role: "PLAYER", userId: "" };

function ringItem(it, t, dpi) {
  const box = shapeBox(zoneShape(it, dpi));
  const d = Math.max(box.width, box.height, dpi * 0.6) + dpi * 0.45;
  return buildShape()
    .shapeType("CIRCLE").width(d).height(d).position(box.center)
    .strokeColor(t.glowColor || "#ffd34d").strokeWidth(Math.max(4, dpi / 22)).strokeOpacity(0.7)
    .strokeDash([dpi / 7, dpi / 11])
    .fillColor(t.glowColor || "#ffd34d").fillOpacity(0.06)
    .attachedTo(it.id).layer("ATTACHMENT").locked(true).disableHit(true)
    .disableAttachmentBehavior(["COPY", "LOCKED"])
    .name("Interagível").metadata({ [GLOW_META]: true })
    .build();
}

async function reconcile() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    do {
      again = false;
      const { triggers, items, dpi, role, userId } = state;
      const byId = new Map(items.map((i) => [i.id, i]));
      const wanted = new Map(); // itemId -> gatilho que manda no brilho
      for (const t of triggers) {
        if (!isInteract(t) || t.glow === false) continue;
        if (t.canUse === "gm" && role !== "GM") continue; // jogador não vê brilho do que não pode usar
        for (const z of t.zones || []) { const it = byId.get(z); if (it && it.visible !== false && !wanted.has(z)) wanted.set(z, t); }
      }
      const mine = items.filter((i) => isToken(i) && i.createdUserId === userId);
      const add = [], del = [];
      for (const [id, r] of rings) if (!wanted.has(id)) { del.push(r.ringId); rings.delete(id); }
      for (const [id, t] of wanted) {
        const it = byId.get(id);
        const shape = zoneShape(it, dpi);
        const near = role !== "GM" && pickReacher(mine, shape, t.reach > 0 ? t.reach : 1, dpi).ok;
        const sig = JSON.stringify([t.glowColor, it.type, it.image?.width, it.image?.height, it.width, it.height, it.grid?.dpi, dpi]);
        const cur = rings.get(id);
        if (cur && cur.sig === sig) { cur.near = near; continue; }
        if (cur) del.push(cur.ringId);
        const ring = ringItem(it, t, dpi);
        add.push(ring);
        rings.set(id, { ringId: ring.id, sig, near, color: t.glowColor || "#ffd34d" });
      }
      if (del.length) await OBR.scene.local.deleteItems(del).catch(() => {});
      if (add.length) await OBR.scene.local.addItems(add).catch(() => {});
      if (rings.size && !timer) timer = setInterval(pulse, 140);
      if (!rings.size && timer) { clearInterval(timer); timer = null; }
    } while (again);
  } finally { busy = false; }
}

let phase = 0;
function pulse() {
  phase += 0.14;
  const ids = [...rings.values()].map((r) => r.ringId);
  if (!ids.length) return;
  const byRing = new Map([...rings.values()].map((r) => [r.ringId, r]));
  const s = (Math.sin(phase * 2.2) + 1) / 2;
  OBR.scene.local.updateItems(ids, (d) => {
    for (const it of d) {
      const r = byRing.get(it.id);
      if (!r) continue;
      it.style.strokeOpacity = r.near ? 0.55 + 0.45 * s : 0.25 + 0.35 * s;
      it.style.fillOpacity = r.near ? 0.10 + 0.12 * s : 0.03 + 0.04 * s;
      it.style.strokeWidth = (r.near ? 1.8 : 1) * Math.max(4, state.dpi / 22);
    }
  }).catch(() => {});
}

/** Liga o brilho e o "clicar no objeto". Chamado por todos (mestre e jogadores). onGM: execução local do mestre. */
export async function startInteract(onGM) {
  state.role = await OBR.player.getRole();
  state.userId = await OBR.player.getId();
  // limpa brilhos que tenham sobrado de uma sessão anterior
  const old = await OBR.scene.local.getItems((i) => i.metadata?.[GLOW_META]).catch(() => []);
  if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id)).catch(() => {});

  const refresh = async () => {
    const [md, items, dpi] = await Promise.all([OBR.scene.getMetadata(), OBR.scene.items.getItems(), OBR.scene.grid.getDpi().catch(() => 150)]);
    state = { ...state, triggers: Array.isArray(md[LIST]) ? md[LIST] : [], items, dpi };
    reconcile();
  };
  if (await OBR.scene.isReady()) await refresh();
  OBR.scene.onReadyChange((r) => {
    if (r) refresh();
    else { rings.clear(); if (timer) { clearInterval(timer); timer = null; } }
  });
  OBR.scene.onMetadataChange((md) => { state.triggers = Array.isArray(md[LIST]) ? md[LIST] : []; reconcile(); });
  OBR.scene.items.onChange((items) => { state.items = items; reconcile(); });
  OBR.scene.grid.onChange((g) => { state.dpi = g.dpi || state.dpi; reconcile(); });

  // jogador clicou (selecionou) um objeto interagível: usa e desseleciona (o mestre seleciona à vontade para editar)
  let last = "";
  OBR.player.onChange((p) => {
    state.role = p.role;
    const sel = p.selection || [];
    const k = sel.join();
    if (k === last) return;
    last = k;
    if (p.role === "GM" || sel.length !== 1) return;
    if (!state.triggers.some((t) => isInteract(t) && (t.zones || []).includes(sel[0]))) return;
    OBR.player.deselect().catch(() => {});
    tryInteract(sel[0], onGM);
  });
}
