// Arsenal em segundo plano (todos os navegadores):
// - desenha os disparos que chegam (de qualquer jogador) com itens locais;
// - ferramenta de mira: clique em tokens ou no chão marca alvos; Enter atira, R recarrega, Esc limpa;
// - botão direito: "Atirar aqui" (nos tokens selecionados) e "Usar como atirador".
import OBR, { buildShape, buildLabel, buildPath } from "@owlbear-rodeo/sdk";
import { buildShot, buildLabel as labelAnim } from "./fx.js";
import { play, clearAll } from "./render.js";
import { fire, reload, setActive, setTargets, getPlayerMeta } from "./fire.js";
import {
  ID, META_AIM, WEAPONS, ACTIVE, TARGETS, CONFIG, CH_SHOT, CH_LABEL, CH_CLEAR, TOOL, MODE_AIM, DEFAULT_CONFIG,
  url, isToken, itemName, rangeBand, metersPerUnit,
} from "./shared.js";

let config = { ...DEFAULT_CONFIG };
let dpi = 150;

// ---------- animações que chegam ----------
async function onShot(data) {
  if (!data?.spec) return;
  // sangue e cápsulas são preferência de quem assiste
  const spec = { ...data.spec, gore: config.gore, casings: config.casings };
  play(buildShot(spec)).catch((e) => console.error(`[${ID}]`, e));
}

// ---------- miras (só para quem está mirando) ----------
let aimIds = [];
let aimBusy = false, aimAgain = false;
async function drawAims() {
  if (aimBusy) { aimAgain = true; return; }
  aimBusy = true;
  try {
    do {
      aimAgain = false;
      const { active, targets } = await getPlayerMeta();
      const ids = targets.map((t) => t.id).filter(Boolean);
      const items = ids.length || active.shooter ? await OBR.scene.items.getItems([...ids, active.shooter].filter(Boolean)) : [];
      const byId = new Map(items.map((i) => [i.id, i]));
      const shooter = byId.get(active.shooter);
      const weapon = (shooter?.metadata?.[WEAPONS] || []).find((w) => w.id === active.weapon) || shooter?.metadata?.[WEAPONS]?.[0];
      const scale = await OBR.scene.grid.getScale().catch(() => null);
      const mpu = metersPerUnit(scale?.parsed?.unit) * (scale?.parsed?.multiplier || 1);
      const add = [];
      for (const t of targets) {
        const at = t.id ? byId.get(t.id)?.position : t.at;
        if (!at) continue;
        const r = dpi * 0.42;
        const cross = [[-1, 0], [-0.45, 0], [0.45, 0], [1, 0], [0, -1], [0, -0.45], [0, 0.45], [0, 1]];
        add.push(buildShape().shapeType("CIRCLE").position(at).width(r * 2).height(r * 2).fillOpacity(0)
          .strokeColor("#ff3b30").strokeWidth(Math.max(3, dpi / 30)).strokeOpacity(0.95).strokeDash([dpi / 10, dpi / 14])
          .layer("ATTACHMENT").locked(true).disableHit(true).metadata({ [META_AIM]: true }).build());
        add.push(buildPath().position({ x: 0, y: 0 }).commands([0, 2, 4, 6].flatMap((k) => [[0, at.x + cross[k][0] * r * 1.2, at.y + cross[k][1] * r * 1.2], [1, at.x + cross[k + 1][0] * r * 1.2, at.y + cross[k + 1][1] * r * 1.2]]))
          .strokeColor("#ff3b30").strokeWidth(Math.max(2, dpi / 45)).strokeOpacity(0.95).fillOpacity(0)
          .layer("ATTACHMENT").locked(true).disableHit(true).metadata({ [META_AIM]: true }).build());
        if (shooter) {
          const cells = await OBR.scene.grid.getDistance(shooter.position, at).catch(() => Math.hypot(at.x - shooter.position.x, at.y - shooter.position.y) / dpi);
          const meters = cells * mpu;
          const band = weapon ? rangeBand(meters, weapon.range) : null;
          const txt = `${meters < 10 ? meters.toFixed(1) : Math.round(meters)} m${band ? ` · ${band.label}` : ""}`;
          add.push(buildLabel().position({ x: at.x, y: at.y + r * 1.4 }).plainText(txt).backgroundColor(band?.key === "out" ? "#7a1010" : "#111418")
            .backgroundOpacity(0.85).fillColor("#ffffff").fontWeight(600).cornerRadius(6).pointerHeight(0)
            .layer("ATTACHMENT").locked(true).disableHit(true).metadata({ [META_AIM]: true }).build());
        }
      }
      const old = aimIds;
      aimIds = add.map((i) => i.id);
      if (add.length) await OBR.scene.local.addItems(add).catch(() => {});
      if (old.length) await OBR.scene.local.deleteItems(old).catch(() => {});
    } while (aimAgain);
  } finally { aimBusy = false; }
}

async function toggleTarget(t) {
  const { targets } = await getPlayerMeta();
  if (t.id) {
    const has = targets.some((x) => x.id === t.id);
    return setTargets(has ? targets.filter((x) => x.id !== t.id) : [...targets, t]);
  }
  // ponto no chão: clicar perto de um ponto já marcado tira ele
  const near = targets.findIndex((x) => x.at && Math.hypot(x.at.x - t.at.x, x.at.y - t.at.y) < dpi * 0.4);
  if (near >= 0) return setTargets(targets.filter((_, i) => i !== near));
  return setTargets([...targets, t]);
}

OBR.onReady(async () => {
  const md = await OBR.player.getMetadata();
  config = { ...DEFAULT_CONFIG, ...(md[CONFIG] || {}) };
  dpi = await OBR.scene.grid.getDpi().catch(() => 150);
  OBR.scene.grid.onChange((g) => { dpi = g.dpi || dpi; drawAims(); });

  OBR.broadcast.onMessage(CH_SHOT, (e) => onShot(e.data));
  OBR.broadcast.onMessage(CH_LABEL, (e) => { if (e.data?.at) play(labelAnim(e.data.at, e.data.text, dpi)).catch(() => {}); });
  OBR.broadcast.onMessage(CH_CLEAR, () => clearAll());

  // limpa sobras de uma sessão anterior
  const left = await OBR.scene.local.getItems((i) => i.metadata?.[META_AIM]).catch(() => []);
  if (left.length) await OBR.scene.local.deleteItems(left.map((i) => i.id)).catch(() => {});

  let lastMeta = "";
  OBR.player.onChange((p) => {
    config = { ...DEFAULT_CONFIG, ...(p.metadata?.[CONFIG] || {}) };
    const k = JSON.stringify([p.metadata?.[TARGETS], p.metadata?.[ACTIVE]]);
    if (k !== lastMeta) { lastMeta = k; drawAims(); }
  });
  OBR.scene.items.onChange(() => { if (aimIds.length) drawAims(); });

  // ---------- ferramenta de mira ----------
  await OBR.tool.create({
    id: TOOL,
    icons: [{ icon: url("icon.svg"), label: "Arsenal: mirar e atirar" }],
    defaultMode: MODE_AIM,
  });
  await OBR.tool.createMode({
    id: MODE_AIM,
    icons: [{ icon: url("aim.svg"), label: "Mirar (clique: marca/desmarca o alvo · Enter: atirar · R: recarregar · Esc: limpar)", filter: { activeTools: [TOOL] } }],
    cursors: [{ cursor: "crosshair" }],
    onToolClick: async (_ctx, ev) => {
      const it = ev.target;
      const { active } = await getPlayerMeta();
      if (it && !active.shooter && isToken(it)) {
        // ainda sem atirador: o primeiro token clicado vira o atirador
        await setActive({ shooter: it.id, weapon: it.metadata?.[WEAPONS]?.[0]?.id });
        OBR.notification.show(`Arsenal: ${itemName(it)} é o atirador. Agora clique nos alvos.`, "INFO");
        return false;
      }
      if (it && it.id === active.shooter) return false;
      if (it && (it.layer === "CHARACTER" || it.layer === "MOUNT" || it.layer === "PROP")) await toggleTarget({ id: it.id });
      else await toggleTarget({ at: ev.pointerPosition });
      return false;
    },
    onKeyDown: async (_ctx, ev) => {
      const k = ev.key;
      if (k === "Enter") await fire();
      else if (k === "Escape") await setTargets([]);
      else if (k === "r" || k === "R") await reload();
    },
    onDeactivate: () => {},
  });
  await OBR.tool.createAction({
    id: `${ID}/acao-atirar`,
    icons: [{ icon: url("fire.svg"), label: "Atirar nos alvos marcados (Enter)", filter: { activeTools: [TOOL] } }],
    onClick: () => fire(),
  });
  await OBR.tool.createAction({
    id: `${ID}/acao-recarregar`,
    icons: [{ icon: url("reload.svg"), label: "Recarregar a arma (R)", filter: { activeTools: [TOOL] } }],
    onClick: () => reload(),
  });
  await OBR.tool.createAction({
    id: `${ID}/acao-limpar`,
    icons: [{ icon: url("clear.svg"), label: "Limpar alvos (Esc)", filter: { activeTools: [TOOL] } }],
    onClick: () => setTargets([]),
  });

  // ---------- botão direito ----------
  await OBR.contextMenu.create({
    id: `${ID}/atirar-aqui`,
    icons: [{ icon: url("fire.svg"), label: "Arsenal: atirar aqui", filter: { every: [{ key: "layer", value: "MAP", operator: "!=" }] } }],
    onClick: async (ctx) => {
      const { active } = await getPlayerMeta();
      const targets = ctx.items.filter((i) => i.id !== active.shooter).map((i) => ({ id: i.id }));
      if (!targets.length) return OBR.notification.show("Arsenal: selecione o(s) alvo(s), não o próprio atirador.", "WARNING");
      await fire(targets);
    },
  });
  await OBR.contextMenu.create({
    id: `${ID}/atirador`,
    icons: [{ icon: url("icon.svg"), label: "Arsenal: usar como atirador", filter: { max: 1, every: [{ key: "type", value: "IMAGE" }] } }],
    onClick: async (ctx) => {
      const it = ctx.items[0];
      await setActive({ shooter: it.id, weapon: it.metadata?.[WEAPONS]?.[0]?.id });
      OBR.action.open();
    },
  });
});
