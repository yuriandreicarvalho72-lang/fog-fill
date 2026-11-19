// Disparar e recarregar. Usado pelo painel, pela ferramenta de mira e pelo menu do botão direito.
// Quem atira monta o disparo e manda para TODOS; cada navegador desenha a animação localmente.
import OBR from "@owlbear-rodeo/sdk";
import { WEAPONS, ACTIVE, TARGETS, CONFIG, CH_SHOT, CH_LABEL, DEFAULT_CONFIG, roundsFor, impactKind, itemName } from "./shared.js";

export async function getPlayerMeta() {
  const md = await OBR.player.getMetadata();
  return { active: md[ACTIVE] || {}, targets: md[TARGETS] || [], config: { ...DEFAULT_CONFIG, ...(md[CONFIG] || {}) } };
}

const say = (at, text) => OBR.broadcast.sendMessage(CH_LABEL, { at, text }, { destination: "ALL" }).catch(() => {});

/**
 * Atira com a arma ativa do atirador ativo nos alvos dados (ou nos alvos marcados com a mira).
 * targetsIn: [{ id?, at? }] — tokens/objetos (id) ou pontos no mapa (at)
 */
export async function fire(targetsIn) {
  const { active, targets: marked, config } = await getPlayerMeta();
  const list = targetsIn?.length ? targetsIn : marked;
  if (!active.shooter) return OBR.notification.show("Arsenal: escolha um atirador (selecione seu token e abra o painel Arsenal).", "WARNING");
  const [shooter] = await OBR.scene.items.getItems([active.shooter]);
  if (!shooter) return OBR.notification.show("Arsenal: o atirador não está mais na cena.", "WARNING");
  const weapons = shooter.metadata?.[WEAPONS] || [];
  const w = weapons.find((x) => x.id === active.weapon) || weapons[0];
  if (!w) return OBR.notification.show(`Arsenal: ${itemName(shooter)} não tem armas. Adicione no painel.`, "WARNING");
  if (!list.length) return OBR.notification.show("Arsenal: marque um alvo (ferramenta Arsenal → clique no alvo) ou selecione tokens e use o botão direito → Atirar.", "WARNING");
  const mode = w.modes.includes(active.mode) ? active.mode : w.mode || w.modes[0];
  // munição
  let need = roundsFor(mode);
  if (w.mag != null) {
    if ((w.ammo ?? 0) <= 0) { say(shooter.position, "Clique! Sem munição"); return; }
    need = Math.min(need, w.ammo);
  }
  const ids = list.map((t) => t.id).filter(Boolean);
  const items = ids.length ? await OBR.scene.items.getItems(ids) : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const targets = list.map((t) => {
    const it = t.id ? byId.get(t.id) : null;
    return { at: it ? it.position : t.at, kind: impactKind(it, active.impact), id: it?.id };
  }).filter((t) => t.at);
  if (!targets.length) return;
  const dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  const spec = {
    fx: w.fx, mode, from: shooter.position, targets, hit: active.hit !== false, cell: dpi,
    seed: Math.floor(Math.random() * 2 ** 31), speed: config.speed, intensity: config.intensity,
    color: config.ownColor ? config.color : undefined, smokeSec: config.smokeSec,
    rounds: need,
  };
  await OBR.broadcast.sendMessage(CH_SHOT, {
    spec, shooter: shooter.id, shooterName: itemName(shooter), weapon: w.name, rounds: need,
    targets: targets.map((t) => t.id).filter(Boolean), hit: spec.hit,
  }, { destination: "ALL" });
  if (w.mag != null) {
    await OBR.scene.items.updateItems([shooter.id], (d) => {
      for (const it of d) {
        const list2 = JSON.parse(JSON.stringify(it.metadata[WEAPONS] || []));
        const ww = list2.find((x) => x.id === w.id);
        if (ww) ww.ammo = Math.max(0, (ww.ammo ?? 0) - need);
        it.metadata[WEAPONS] = list2;
      }
    }).catch(() => OBR.notification.show("Arsenal: sem permissão para atualizar a munição deste token.", "WARNING"));
  }
}

/** Recarrega a arma (ativa, ou a dada). */
export async function reload(weaponId) {
  const { active } = await getPlayerMeta();
  if (!active.shooter) return;
  const [shooter] = await OBR.scene.items.getItems([active.shooter]);
  if (!shooter) return;
  const id = weaponId || active.weapon;
  await OBR.scene.items.updateItems([shooter.id], (d) => {
    for (const it of d) {
      const list = JSON.parse(JSON.stringify(it.metadata[WEAPONS] || []));
      const w = list.find((x) => x.id === id) || list[0];
      if (w && w.mag != null) w.ammo = w.mag;
      it.metadata[WEAPONS] = list;
    }
  });
  say(shooter.position, "⟳ Recarregando");
}

export async function setActive(patch) {
  const md = await OBR.player.getMetadata();
  await OBR.player.setMetadata({ [ACTIVE]: { ...(md[ACTIVE] || {}), ...patch } });
}
export async function setTargets(list) {
  await OBR.player.setMetadata({ [TARGETS]: list });
}
