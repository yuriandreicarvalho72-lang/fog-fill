// Arsenal em segundo plano (todos os navegadores):
// - desenha os disparos que chegam (de qualquer jogador) com itens locais;
// - ferramenta de mira: clique em tokens ou no chão marca alvos; Enter atira, R recarrega, Esc limpa;
// - botão direito: "Atirar aqui" (nos tokens selecionados), "Usar como atirador" e "é cobertura" (mestre).
import OBR, { buildShape, buildLabel, buildPath } from "@owlbear-rodeo/sdk";
import { buildShot, buildLabel as labelAnim } from "./fx.js";
import { buildShotJB2A } from "./jb2a.js";
import { play, clearAll } from "./render.js";
import { readPerf, onPerf, onClean } from "./perf.js";
import { fire, fireWith, reload, setActive, setTargets, getPlayerMeta, cycleShooter, getRules, loadObstacles, coverOf } from "./fire.js";
import { COVER, MARKS } from "./cover.js";
import { DESTR, CHARGE, damageEvents, buildDebris, buildBlast, chargeOf, remaining, seesCountdown, canControl } from "./destroy.js";
import {
  markDestructible, breakNow, applyEvents, createCharge, chargesFor, detonate, disarm, addDisarmRequest, plant, requestCharges, getPlantCfg,
} from "./scenery.js";
import {
  ID, META_AIM, WEAPONS, ACTIVE, TARGETS, CONFIG, CH_SHOT, CH_LABEL, CH_CLEAR, CH_AMMO, CH_REMOTE, TOOL, MODE_AIM, HUD,
  CH_DESTROYED, CH_BLAST, CH_PLANT, CH_DETONATE, MODE_PLANT,
  DEFAULT_CONFIG, url, isToken, itemName, rangeBand, metersPerUnit, applyAmmo, myShooters,
} from "./shared.js";

let config = { ...DEFAULT_CONFIG };
let dpi = 150;
let me = { id: "", role: "PLAYER" };
let myConn = "";
let hideAimsUntil = 0; // durante o disparo a mira some (não cobre o efeito)
let perf = null;       // perfil do Otimizador neste navegador (null = sem perfil)
const videosOn = () => config.jb2a !== false && perf?.arsenal?.jb2a !== false;

// ---------- vídeos JB2A (baixados no build para jb2a/; ok.json lista os que chegaram) ----------
const JB2A_BASE = url("jb2a/");
let jb2aFiles = null; // Set dos arquivos disponíveis (null = sem vídeos: usa só o efeito desenhado)
async function loadJB2A() {
  try {
    const r = await fetch(`${JB2A_BASE}ok.json`, { cache: "no-cache" });
    if (r.ok) jb2aFiles = new Set((await r.json()).files || []);
  } catch { jb2aFiles = null; }
}

// ---------- animações que chegam ----------
async function onShot(data) {
  if (!data?.spec) return;
  // sangue, cápsulas e vídeos são preferência de quem assiste
  // o Otimizador pode desligar vídeos e cápsulas e baixar a intensidade (só para quem assiste)
  const spec = {
    ...data.spec, gore: config.gore, casings: config.casings && perf?.arsenal?.casings !== false,
    intensity: perf ? Math.min(data.spec.intensity ?? 1, perf.arsenal.intensity) : data.spec.intensity,
  };
  const anim = (videosOn() && jb2aFiles && buildShotJB2A(spec, (f) => jb2aFiles.has(f))) || buildShot(spec);
  if (aimIds.length) {
    hideAimsUntil = Date.now() + Math.min(4, anim.duration) * 1000;
    drawAims();
    setTimeout(drawAims, Math.min(4, anim.duration) * 1000 + 50);
  }
  play(anim, JB2A_BASE).catch((e) => console.error(`[${ID}]`, e));
}

// ---------- só um mestre executa pedidos (munição de jogadores, disparos de outras extensões) ----------
async function isLeader() {
  if (me.role !== "GM") return false;
  const gms = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role === "GM").map((p) => p.connectionId);
  return [myConn, ...gms].sort()[0] === myConn;
}

/** Disparo pedido por outra extensão (ex.: Gatilhos): { shooter, weapon?, mode?, targets: [{id}|{at}], hit?, impact? } */
async function onRemoteFire(d) {
  if (!d?.shooter || !(await isLeader())) return;
  const r = await fireWith({ shooterId: d.shooter, weaponId: d.weapon, mode: d.mode, targets: d.targets || [], hit: d.hit !== false, impact: d.impact || "auto", config });
  if (r.error) OBR.notification.show(`Arsenal (${d.from || "gatilho"}): ${r.error}`, "WARNING");
}

// ---------- cenário destrutível: o líder conta o dano quando o tiro / a explosão chega ----------
async function onShotDamage(data) {
  if (!data?.spec || !(await isLeader())) return;
  const evs = damageEvents(data.spec);
  const slots = new Map(); // agrupa por meio segundo
  for (const ev of evs) { const k = Math.round(ev.t * 2) / 2; if (!slots.has(k)) slots.set(k, []); slots.get(k).push(ev); }
  for (const [t, list] of slots) setTimeout(() => applyEvents(list, data.shooter || null).catch((e) => console.error(`[${ID}]`, e)), t * 1000);
}
const hasVideo = () => (videosOn() && jb2aFiles ? (f) => jb2aFiles.has(f) : null);

// ---------- cargas plantadas ----------
let sceneItems = [];
const sender = async (e) => (await OBR.party.getPlayers().catch(() => [])).find((x) => x.connectionId === e.connectionId) || null;

async function onPlant(e) {
  if (!(await isLeader())) return;
  const p = await sender(e);
  if (!p && e.connectionId !== myConn) return;
  await createCharge(e.data || {}, p ? { id: p.id, name: p.name } : { id: me.id, name: await OBR.player.getName().catch(() => "") });
}

async function onDetonate(e) {
  if (!(await isLeader())) return;
  const d = e.data || {};
  const p = await sender(e);
  const gm = !p || p.role === "GM"; // sem remetente na lista = este mesmo navegador (o mestre líder, ou o Gatilhos dele)
  const list = chargesFor(d.ids, await OBR.scene.items.getItems());
  if (!list.length) { if (d.from) OBR.notification.show(`Arsenal (${d.from}): nenhuma carga nesses itens.`, "WARNING"); return; }
  for (const it of list) {
    const c = chargeOf(it);
    const ok = gm || canControl(c, p.id, p.role);
    if (d.op === "desarmar") { if (ok) await disarm(it, p?.name || ""); else await addDisarmRequest(it, p); }
    else if (ok) await detonate(it);
  }
}

/** Timers (só o líder) e o que cada navegador desenha: a cópia da carga para quem plantou e a contagem regressiva. */
const CARGO_LOCAL = `${ID}/carga-local`;
const cShown = new Map();
let cBusy = false;
async function tickCharges() {
  if (cBusy) return;
  cBusy = true;
  try {
    const now = Date.now();
    const charges = sceneItems.filter((i) => i.metadata?.[CHARGE]);
    if (me.role === "GM" && charges.some((i) => chargeOf(i).mode === "timer" && chargeOf(i).endsAt <= now) && (await isLeader())) {
      for (const it of charges) { const c = chargeOf(it); if (c.mode === "timer" && c.endsAt <= now) await detonate(it).catch(() => {}); }
    }
    const want = new Map();
    for (const it of charges) {
      const c = chargeOf(it);
      const mine = c.by === me.id;
      if (me.role !== "GM" && mine && it.visible === false) {
        const id = `${ID}-cg-${it.id}`;
        want.set(id, { sig: JSON.stringify(it.position), build: () => {
          const copy = JSON.parse(JSON.stringify(it));
          delete copy.attachedTo;
          return Object.assign(copy, { id, visible: true, locked: true, disableHit: true, metadata: { [CARGO_LOCAL]: true } });
        } });
      }
      const left = remaining(c, now);
      const showTimer = c.mode === "timer" && seesCountdown(c, me);
      const showRemote = c.mode === "remote" && (me.role === "GM" || mine);
      if (showTimer || showRemote) {
        const id = `${ID}-cd-${it.id}`;
        const text = showTimer ? `💣 ${left} s` : "📡 remoto";
        const at = { x: it.position.x, y: it.position.y - dpi * 0.35 };
        want.set(id, { sig: JSON.stringify([text, at]), build: () => buildLabel().position(at).plainText(text)
          .backgroundColor(showTimer && left <= 3 ? "#b3121a" : "#3a1010").backgroundOpacity(0.9).fillColor("#ffffff").fontWeight(700)
          .cornerRadius(6).pointerDirection("DOWN").pointerHeight(5).pointerWidth(8).layer("ATTACHMENT").locked(true).disableHit(true)
          .metadata({ [CARGO_LOCAL]: true }).id(id).build() });
      }
    }
    const del = [...cShown.keys()].filter((k) => !want.has(k) || cShown.get(k) !== want.get(k).sig);
    const add = [...want.keys()].filter((k) => cShown.get(k) !== want.get(k).sig);
    if (del.length) { await OBR.scene.local.deleteItems(del).catch(() => {}); for (const k of del) cShown.delete(k); }
    if (add.length) { await OBR.scene.local.addItems(add.map((k) => want.get(k).build())).catch(() => {}); for (const k of add) cShown.set(k, want.get(k).sig); }
  } finally { cBusy = false; }
}

// ---------- painel de mira (canto inferior esquerdo, enquanto a ferramenta está ativa) ----------
async function openHud() {
  const h = await OBR.viewport.getHeight().catch(() => 800);
  await OBR.popover.open({
    id: HUD, url: url("hud.html"), width: 300, height: 282,
    anchorReference: "POSITION", anchorPosition: { left: 72, top: h - 16 },
    anchorOrigin: { horizontal: "LEFT", vertical: "BOTTOM" }, transformOrigin: { horizontal: "LEFT", vertical: "BOTTOM" },
    disableClickAway: true, marginThreshold: 8,
  }).catch(() => {});
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
      const hidden = Date.now() < hideAimsUntil;
      // cobertura de cada alvo: mira cinza = cobertura total (sem linha de tiro)
      const covers = shooter && targets.length && !hidden ? coverOf(shooter, targets, items, await loadObstacles(dpi), dpi) : [];
      const rules = config.mapLabel && covers.length ? await getRules() : null;
      for (const [k, t] of (hidden ? [] : targets).entries()) {
        const at = t.id ? byId.get(t.id)?.position : t.at;
        if (!at) continue;
        const cv = covers[k]?.key || "none";
        const aimColor = cv === "total" ? "#9aa0a6" : "#ff3b30";
        const r = dpi * 0.42;
        const cross = [[-1, 0], [-0.45, 0], [0.45, 0], [1, 0], [0, -1], [0, -0.45], [0, 0.45], [0, 1]];
        add.push(buildShape().shapeType("CIRCLE").position(at).width(r * 2).height(r * 2).fillOpacity(0)
          .strokeColor(aimColor).strokeWidth(Math.max(3, dpi / 30)).strokeOpacity(0.95).strokeDash([dpi / 10, dpi / 14])
          .layer("ATTACHMENT").locked(true).disableHit(true).metadata({ [META_AIM]: true }).build());
        add.push(buildPath().position({ x: 0, y: 0 }).commands([0, 2, 4, 6].flatMap((k) => [[0, at.x + cross[k][0] * r * 1.2, at.y + cross[k][1] * r * 1.2], [1, at.x + cross[k + 1][0] * r * 1.2, at.y + cross[k + 1][1] * r * 1.2]]))
          .strokeColor(aimColor).strokeWidth(Math.max(2, dpi / 45)).strokeOpacity(0.95).fillOpacity(0)
          .layer("ATTACHMENT").locked(true).disableHit(true).metadata({ [META_AIM]: true }).build());
        if (shooter && config.mapLabel) {
          const cells = await OBR.scene.grid.getDistance(shooter.position, at).catch(() => Math.hypot(at.x - shooter.position.x, at.y - shooter.position.y) / dpi);
          const meters = cells * mpu;
          const band = weapon ? rangeBand(meters, weapon.range) : null;
          const cvTxt = cv === "half" ? ` · meia +${rules.half}` : cv === "three" ? ` · ¾ +${rules.three}` : cv === "total" ? " · cob. total" : "";
          const txt = `${meters < 10 ? meters.toFixed(1) : Math.round(meters)} m${band ? ` · ${band.label}` : ""}${cvTxt}`;
          add.push(buildLabel().position({ x: at.x, y: at.y + r * 1.4 }).plainText(txt).backgroundColor(band?.key === "out" || cv === "total" ? "#7a1010" : "#111418")
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
  me = { id: await OBR.player.getId(), role: await OBR.player.getRole() };
  myConn = await OBR.player.getConnectionId();
  OBR.player.onChange((p) => { me.role = p.role; });
  loadJB2A();
  OBR.scene.grid.onChange((g) => { dpi = g.dpi || dpi; drawAims(); });
  perf = readPerf();
  onPerf((p) => { perf = p; });
  // Otimizador: limpar sobras (efeitos, miras, cópias de cargas e contagens) e redesenhar o que precisa
  onClean(async () => {
    await clearAll();
    const left = await OBR.scene.local.getItems((i) => i.metadata?.[META_AIM] || i.metadata?.[CARGO_LOCAL]).catch(() => []);
    if (left.length) await OBR.scene.local.deleteItems(left.map((i) => i.id)).catch(() => {});
    aimIds = [];
    cShown.clear();
    drawAims();
  });

  OBR.broadcast.onMessage(CH_SHOT, (e) => { onShot(e.data); onShotDamage(e.data); });
  OBR.broadcast.onMessage(CH_DESTROYED, (e) => {
    const d = e.data || {};
    if (d.at) play(buildDebris(d.at, d.size || 1, dpi, Math.floor(Math.random() * 1e9), hasVideo()), JB2A_BASE).catch(() => {});
  });
  OBR.broadcast.onMessage(CH_BLAST, (e) => {
    const d = e.data || {};
    if (d.at) play(buildBlast(d.at, d.radius || 2, dpi, d.seed || 1, hasVideo()), JB2A_BASE).catch(() => {});
  });
  OBR.broadcast.onMessage(CH_PLANT, onPlant);
  OBR.broadcast.onMessage(CH_DETONATE, onDetonate);
  // cargas: itens da cena, cópias locais e contagem
  const leftC = await OBR.scene.local.getItems((i) => i.metadata?.[CARGO_LOCAL]).catch(() => []);
  if (leftC.length) await OBR.scene.local.deleteItems(leftC.map((i) => i.id)).catch(() => {});
  if (await OBR.scene.isReady()) sceneItems = await OBR.scene.items.getItems();
  OBR.scene.onReadyChange(async (r) => { cShown.clear(); sceneItems = r ? await OBR.scene.items.getItems() : []; });
  OBR.scene.items.onChange((its) => { sceneItems = its; });
  setInterval(() => { tickCharges().catch(() => {}); }, 250);
  OBR.broadcast.onMessage(CH_LABEL, (e) => { if (e.data?.at) play(labelAnim(e.data.at, e.data.text, dpi)).catch(() => {}); });
  OBR.broadcast.onMessage(CH_CLEAR, () => clearAll());
  OBR.broadcast.onMessage(CH_REMOTE, (e) => onRemoteFire(e.data));
  OBR.broadcast.onMessage(CH_AMMO, async (e) => {
    const d = e.data;
    if (!d?.itemId || !(await isLeader())) return;
    await OBR.scene.items.updateItems([d.itemId], (dr) => { for (const it of dr) it.metadata[WEAPONS] = applyAmmo(it.metadata[WEAPONS], d.weaponId, d.op || {}); }).catch(() => {});
  });

  // limpa sobras de uma sessão anterior
  const left = await OBR.scene.local.getItems((i) => i.metadata?.[META_AIM]).catch(() => []);
  if (left.length) await OBR.scene.local.deleteItems(left.map((i) => i.id)).catch(() => {});

  let lastMeta = "";
  OBR.player.onChange((p) => {
    config = { ...DEFAULT_CONFIG, ...(p.metadata?.[CONFIG] || {}) };
    const k = JSON.stringify([p.metadata?.[TARGETS], p.metadata?.[ACTIVE], config.mapLabel]);
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
    onActivate: () => { if (config.hud !== false) openHud(); },
    onDeactivate: () => { OBR.popover.close(HUD).catch(() => {}); },
    onToolClick: async (_ctx, ev) => {
      const it = ev.target;
      const { active } = await getPlayerMeta();
      if (it && ev.shiftKey && it.type === "IMAGE") {
        // Shift+clique: este token vira o atirador
        await setActive({ shooter: it.id, weapon: it.metadata?.[WEAPONS]?.[0]?.id, mode: undefined });
        OBR.notification.show(`Arsenal: atirador = ${itemName(it)}`, "INFO");
        return false;
      }
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
      else if (k === "Tab") await cycleShooter(myShooters(await OBR.scene.items.getItems(), me), ev.shiftKey ? -1 : 1);
    },
  });
  await OBR.tool.createMode({
    id: MODE_PLANT,
    icons: [{ icon: url("charge.svg"), label: "Plantar carga (clique no chão, ou num objeto para colar nele)", filter: { activeTools: [TOOL] } }],
    cursors: [{ cursor: "crosshair" }],
    onActivate: async () => {
      const c = await getPlantCfg();
      OBR.notification.show(`Arsenal: clique para plantar — ${c.mode === "timer" ? `temporizador de ${c.sec} s` : "detonação remota"}, raio de ${c.radius} quadrado(s). Mude no painel Arsenal → Cargas.`, "INFO");
    },
    onToolClick: async (_ctx, ev) => {
      const { active } = await getPlayerMeta();
      const it = ev.target;
      const attach = it && it.layer !== "MAP" && it.id !== active.shooter && !it.metadata?.[CHARGE] ? it.id : null;
      await plant(ev.pointerPosition, attach, active.shooter || null, myConn);
      return false;
    },
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
  // mestre marca o que serve de cobertura (caixote, carro, mureta): meia -> três quartos -> total -> nada
  const NEXT = { meia: "tres", tres: "total", total: undefined };
  const notMap = { key: "layer", value: "MAP", operator: "!=" };
  await OBR.contextMenu.create({
    id: `${ID}/cobertura`,
    icons: [
      { icon: url("cover.svg"), label: "Arsenal: é cobertura (meia)", filter: { roles: ["GM"], every: [notMap, { key: ["metadata", COVER], value: undefined }] } },
      { icon: url("cover.svg"), label: "Arsenal: cobertura → três quartos", filter: { roles: ["GM"], every: [{ key: ["metadata", COVER], value: "meia" }] } },
      { icon: url("cover.svg"), label: "Arsenal: cobertura → total", filter: { roles: ["GM"], every: [{ key: ["metadata", COVER], value: "tres" }] } },
      { icon: url("cover.svg"), label: "Arsenal: deixar de ser cobertura", filter: { roles: ["GM"], every: [{ key: ["metadata", COVER], value: "total" }] } },
    ],
    onClick: async (ctx) => {
      const cur = ctx.items[0]?.metadata?.[COVER];
      const next = cur === undefined ? "meia" : NEXT[cur];
      await OBR.scene.items.updateItems(ctx.items.map((i) => i.id), (d) => { for (const it of d) { if (next) it.metadata[COVER] = next; else delete it.metadata[COVER]; } });
      const label = MARKS.find(([k]) => k === next)?.[1];
      OBR.notification.show(label ? `Arsenal: ${ctx.items.length > 1 ? `${ctx.items.length} itens dão` : "dá"} cobertura ${label}.` : "Arsenal: não é mais cobertura.", "INFO");
    },
  });
  // cenário destrutível (mestre)
  await OBR.contextMenu.create({
    id: `${ID}/destrutivel`,
    icons: [{ icon: url("destr.svg"), label: "Arsenal: tornar destrutível", filter: { roles: ["GM"], every: [{ key: ["metadata", DESTR], value: undefined }, { key: ["metadata", CHARGE], value: undefined }] } }],
    onClick: async (ctx) => { await markDestructible(ctx.items.map((i) => i.id)); OBR.action.open().catch(() => {}); },
  });
  await OBR.contextMenu.create({
    id: `${ID}/quebrar`,
    icons: [{ icon: url("destr.svg"), label: "Arsenal: quebrar agora", filter: { roles: ["GM"], every: [{ key: ["metadata", DESTR], value: undefined, operator: "!=" }] } }],
    onClick: async (ctx) => { for (const it of ctx.items) await breakNow(it.id); },
  });
  // cargas: quem plantou (ou o mestre) detona; desarmar de outro jogador vai para o mestre aprovar
  const isCharge = { every: [{ key: ["metadata", CHARGE], value: undefined, operator: "!=" }] };
  await OBR.contextMenu.create({
    id: `${ID}/detonar`,
    icons: [{ icon: url("charge.svg"), label: "Arsenal: detonar carga", filter: isCharge }],
    onClick: (ctx) => requestCharges(ctx.items.map((i) => i.id), "detonar"),
  });
  await OBR.contextMenu.create({
    id: `${ID}/desarmar`,
    icons: [{ icon: url("defuse.svg"), label: "Arsenal: desarmar carga", filter: isCharge }],
    onClick: async (ctx) => {
      await requestCharges(ctx.items.map((i) => i.id), "desarmar");
      if (me.role !== "GM" && ctx.items.some((i) => chargeOf(i)?.by !== me.id)) OBR.notification.show("Arsenal: pedido enviado ao mestre (role o teste de desarmar).", "INFO");
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
