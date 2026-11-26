// Disparar e recarregar. Usado pelo painel, pelo painel de mira, pela ferramenta, pelo menu do botão direito
// e por outras extensões (Gatilhos). Quem atira monta o disparo e manda para TODOS; cada navegador desenha.
import OBR from "@owlbear-rodeo/sdk";
import {
  WEAPONS, ACTIVE, TARGETS, CONFIG, CH_SHOT, CH_LABEL, CH_AMMO, RULES, DEFAULT_CONFIG,
  roundsFor, impactKind, itemName, applyAmmo, metersPerUnit,
} from "./shared.js";
import { PROFILES } from "./fx.js";
import { obstaclesFrom, coverBetween, firstHit, halfSize, DEFAULT_RULES } from "./cover.js";

export async function getPlayerMeta() {
  const md = await OBR.player.getMetadata();
  return { active: md[ACTIVE] || {}, targets: md[TARGETS] || [], config: { ...DEFAULT_CONFIG, ...(md[CONFIG] || {}) } };
}

/** Bônus de cobertura da mesa (sala), com padrão d20: meia +2, três quartos +5. */
export async function getRules() {
  const md = await OBR.room.getMetadata().catch(() => ({}));
  return { ...DEFAULT_RULES, ...(md[RULES] || {}) };
}

/** Obstáculos da cena: paredes da névoa dinâmica (locais e da cena) e itens marcados como cobertura. */
export async function loadObstacles(dpi) {
  const [local, items] = await Promise.all([OBR.scene.local.getItems().catch(() => []), OBR.scene.items.getItems()]);
  return obstaclesFrom([...local, ...items], dpi);
}

/** Cobertura de cada alvo ([{ id } | { at }]) visto do atirador: [{ key, name, ... }]. */
export function coverOf(shooter, targets, items, obs, dpi) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return targets.map((t) => {
    const it = t.id ? byId.get(t.id) : null;
    const at = it ? it.position : t.at;
    if (!at || !shooter) return { key: "none", name: "" };
    return { ...coverBetween(shooter.position, at, it ? halfSize(it, dpi) : 0, obs, [shooter.id, it?.id].filter(Boolean)), name: it ? itemName(it) : "o ponto marcado" };
  });
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
  const dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  // cobertura: com cobertura total (ou errando um alvo com meia / três quartos) a bala bate no obstáculo
  const obs = await loadObstacles(dpi);
  const blocked = [];
  const lobbed = !!PROFILES[w.fx]?.lob || !!w.melee; // granadas jogadas, lança-granadas e golpes corpo a corpo não batem em cobertura
  if (w.melee) {
    // corpo a corpo: só o que está ao alcance da arma (distância do centro, como a mira das habilidades)
    const sc = await OBR.scene.grid.getScale().catch(() => null);
    const mpc = (metersPerUnit(sc?.parsed?.unit) * (sc?.parsed?.multiplier || 1.5)) || 1.5;
    const far = list.map((t) => { const it = t.id ? byId.get(t.id) : null; const at = it ? it.position : t.at; return at ? { it, m: (Math.hypot(at.x - shooter.position.x, at.y - shooter.position.y) / dpi) * mpc } : null; })
      .filter((x) => x && x.m > (w.melee.alcance || 1.5) + 0.01);
    if (far.length) return { error: `${w.name}: ${far.map((x) => (x.it ? itemName(x.it) : "o ponto")).join(", ")} fora do alcance (${String(w.melee.alcance || 1.5).replace(".", ",")} m).` };
  }
  const targets = list.map((t) => {
    const it = t.id ? byId.get(t.id) : null;
    const at = it ? it.position : t.at;
    if (!at) return null;
    const half = it ? halfSize(it, dpi) : 0;
    const ignore = [shooter.id, it?.id].filter(Boolean);
    const cv = coverBetween(shooter.position, at, half, obs, ignore);
    if (!lobbed && (cv.key === "total" || (hit === false && (cv.key === "half" || cv.key === "three")))) {
      const h = firstHit(shooter.position, at, half, obs, ignore, dpi * 0.06);
      if (h) {
        blocked.push({ name: it ? itemName(it) : "o ponto", total: cv.key === "total" });
        return { at: h.at, kind: h.wall ? "ground" : "metal", id: h.id || undefined, hit: true, exact: true };
      }
    }
    return { at, kind: impactKind(it, impact), id: it?.id };
  }).filter(Boolean);
  if (!targets.length) return { error: "os alvos não estão mais na cena." };
  if (blocked.length) OBR.notification.show(`Arsenal: ${blocked.map((b) => `${b.name} ${b.total ? "atrás de cobertura total" : "na cobertura"}`).join(", ")} — a bala bateu no obstáculo.`, "INFO");
  const spec = {
    fx: w.fx, mode: m, from: shooter.position, targets, hit: hit !== false, cell: dpi,
    seed: Math.floor(Math.random() * 2 ** 31), speed: config.speed, intensity: config.intensity,
    color: config.ownColor ? config.color : undefined, smokeSec: config.smokeSec,
    rounds: need, weaponName: w.name,
    ...(w.melee ? { melee: w.melee } : {}), ...(w.vfx ? { vfx: w.vfx } : {}),
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
  const list = targetsIn?.length ? targetsIn : marked;
  const r = await fireWith({
    shooterId: active.shooter, weaponId: active.weapon, mode: active.mode,
    targets: list, hit: active.hit, impact: active.impact, config,
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
