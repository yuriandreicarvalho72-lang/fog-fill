// Disparar e recarregar. Usado pelo painel, pelo painel de mira, pela ferramenta, pelo menu do botão direito
// e por outras extensões (Gatilhos). Quem atira monta o disparo e manda para TODOS; cada navegador desenha.
import OBR from "@owlbear-rodeo/sdk";
import {
  WEAPONS, ACTIVE, TARGETS, CONFIG, CH_SHOT, CH_LABEL, CH_AMMO, DEFAULT_CONFIG,
  roundsFor, impactKind, itemName, applyAmmo,
} from "./shared.js";

export async function getPlayerMeta() {
  const md = await OBR.player.getMetadata();
  return { active: md[ACTIVE] || {}, targets: md[TARGETS] || [], config: { ...DEFAULT_CONFIG, ...(md[CONFIG] || {}) } };
}

const say = (at, text) => OBR.broadcast.sendMessage(CH_LABEL, { at, text }, { destination: "ALL" }).catch(() => {});

/**
 * Muda a munição. O mestre (ou quem criou o token) muda direto; o jogador sem permissão pede ao mestre,
 * que muda por ele (precisa de um mestre na sala).
 */
export async function ammoOp(item, weaponId, op) {
  const role = await OBR.player.getRole();
  const me = await OBR.player.getId();
  const direct = async () => OBR.scene.items.updateItems([item.id], (d) => {
    for (const it of d) it.metadata[WEAPONS] = applyAmmo(it.metadata[WEAPONS], weaponId, op);
  });
  const relay = () => OBR.broadcast.sendMessage(CH_AMMO, { itemId: item.id, weaponId, op }, { destination: "REMOTE" }).catch(() => {});
  if (role === "GM" || item.createdUserId === me) {
    try { await direct(); } catch { await relay(); }
  } else await relay();
}

/**
 * Dispara. shooterId: token que atira; weaponId (opcional: a primeira arma); mode (opcional: o da arma);
 * targets: [{ id } | { at }]; hit; impact ("auto" | "flesh" | "metal" | "ground"); config: aparência.
 * Devolve { ok } ou { error } (texto para aviso) ou { empty } (sem munição).
 */
export async function fireWith({ shooterId, weaponId, mode, targets: list, hit = true, impact = "auto", config = DEFAULT_CONFIG }) {
  const [shooter] = shooterId ? await OBR.scene.items.getItems([shooterId]) : [];
  if (!shooter) return { error: "o atirador não está na cena." };
  const weapons = shooter.metadata?.[WEAPONS] || [];
  const w = weapons.find((x) => x.id === weaponId) || weapons[0];
  if (!w) return { error: `${itemName(shooter)} não tem armas. Adicione no painel.` };
  if (!list?.length) return { error: "marque um alvo (ferramenta Arsenal → clique no alvo) ou selecione tokens e use o botão direito → Atirar." };
  const m = w.modes.includes(mode) ? mode : w.mode || w.modes[0];
  let need = roundsFor(m);
  if (w.mag != null) {
    if ((w.ammo ?? 0) <= 0) { say(shooter.position, "Clique! Sem munição"); return { empty: true }; }
    need = Math.min(need, w.ammo);
  }
  const ids = list.map((t) => t.id).filter(Boolean);
  const items = ids.length ? await OBR.scene.items.getItems(ids) : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const targets = list.map((t) => {
    const it = t.id ? byId.get(t.id) : null;
    return { at: it ? it.position : t.at, kind: impactKind(it, impact), id: it?.id };
  }).filter((t) => t.at);
  if (!targets.length) return { error: "os alvos não estão mais na cena." };
  const dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  const spec = {
    fx: w.fx, mode: m, from: shooter.position, targets, hit: hit !== false, cell: dpi,
    seed: Math.floor(Math.random() * 2 ** 31), speed: config.speed, intensity: config.intensity,
    color: config.ownColor ? config.color : undefined, smokeSec: config.smokeSec,
    rounds: need,
  };
  await OBR.broadcast.sendMessage(CH_SHOT, {
    spec, shooter: shooter.id, shooterName: itemName(shooter), weapon: w.name, rounds: need,
    targets: targets.map((t) => t.id).filter(Boolean), hit: spec.hit,
  }, { destination: "ALL" });
  if (w.mag != null) await ammoOp(shooter, w.id, { use: need });
  return { ok: true };
}

/** Atira com o atirador e a arma ativos do jogador, nos alvos dados (ou nos marcados com a mira). */
export async function fire(targetsIn) {
  const { active, targets: marked, config } = await getPlayerMeta();
  if (!active.shooter) return OBR.notification.show("Arsenal: escolha um atirador (selecione seu token e abra o painel Arsenal).", "WARNING");
  const r = await fireWith({
    shooterId: active.shooter, weaponId: active.weapon, mode: active.mode,
    targets: targetsIn?.length ? targetsIn : marked, hit: active.hit, impact: active.impact, config,
  });
  if (r.error) OBR.notification.show(`Arsenal: ${r.error}`, "WARNING");
}

/** Recarrega a arma (ativa, ou a dada). */
export async function reload(weaponId) {
  const { active } = await getPlayerMeta();
  if (!active.shooter) return;
  const [shooter] = await OBR.scene.items.getItems([active.shooter]);
  if (!shooter) return;
  await ammoOp(shooter, weaponId || active.weapon, { reload: true });
  say(shooter.position, "⟳ Recarregando");
}

export async function setActive(patch) {
  const md = await OBR.player.getMetadata();
  await OBR.player.setMetadata({ [ACTIVE]: { ...(md[ACTIVE] || {}), ...patch } });
}
export async function setTargets(list) {
  await OBR.player.setMetadata({ [TARGETS]: list });
}

/** Troca de atirador: o próximo (step 1) ou o anterior (-1) da lista de atiradores do jogador. */
export async function cycleShooter(shooters, step = 1) {
  if (!shooters.length) return OBR.notification.show("Arsenal: nenhum token com armas para você.", "WARNING");
  const { active } = await getPlayerMeta();
  const i = shooters.findIndex((s) => s.id === active.shooter);
  const next = shooters[(i + step + shooters.length) % shooters.length];
  await setActive({ shooter: next.id, weapon: next.metadata?.[WEAPONS]?.[0]?.id, mode: undefined });
  return next;
}
