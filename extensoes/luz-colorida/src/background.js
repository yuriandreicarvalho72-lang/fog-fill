import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { buildSksl, buildUniforms, MAX_LIGHTS, animId } from "./shader.js";
import { ID, CFG, SETTINGS, DEFAULT_SETTINGS, DF_LIGHT } from "./shared.js";
import { readPerf, onPerf, onClean } from "./perf.js";

const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
const rad = (deg) => (deg * Math.PI) / 180;

let settings = { ...DEFAULT_SETTINGS };
let timer = null;
let warnedMax = false;
let perf = null; // perfil do Otimizador neste navegador (null = sem perfil): tetos de luzes, trechos e animação

function schedule(delay = 50) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    update().catch((e) => console.error(`[${ID}]`, e));
  }, delay);
}

function toWorld(item, p) {
  const sx = item.scale?.x ?? 1, sy = item.scale?.y ?? 1;
  const a = rad(item.rotation ?? 0);
  const x = p.x * sx, y = p.y * sy;
  return { x: item.position.x + x * Math.cos(a) - y * Math.sin(a), y: item.position.y + x * Math.sin(a) + y * Math.cos(a) };
}

// simplificação de polilinha (menos trechos = shader mais leve)
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [i0, i1] = st.pop(); const a = pts[i0], b = pts[i1];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    let md = -1, mi = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; st.push([i0, mi], [mi, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function segDist(px, py, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / L2));
  return Math.hypot(px - (s.ax + t * dx), py - (s.ay + t * dy));
}

// Efeitos desenhados por este navegador. Modos "local" e "standalone": um efeito POR LUZ, preso ao token
// (attachedTo), então a cor acompanha o token na hora (arrastar, Régua, teleporte do Gatilhos, Estados).
// Modo "viewport": um efeito só cobrindo a tela (como antes).
const effects = new Map(); // chave (id do token, ou "tela") -> { id, sksl, look, sig }

async function removeAll() {
  const ids = [...effects.values()].map((e) => e.id);
  effects.clear();
  if (ids.length) await OBR.scene.local.deleteItems(ids).catch(() => {});
}

/** Trechos de parede dentro do alcance das luzes, os mais próximos primeiro. */
function wallSegments(local, items, lights) {
  if (!settings.shadows || perf?.luz?.shadows === false) return [];
  const walls = [...local, ...items].filter((i) => i.type === "WALL" && i.blocking !== false);
  const all = [];
  for (const wl of walls) {
    const pts = rdp((wl.points || []).map((p) => toWorld(wl, p)), 3);
    for (let k = 0; k < pts.length - 1; k++) all.push({ ax: pts[k].x, ay: pts[k].y, bx: pts[k + 1].x, by: pts[k + 1].y });
  }
  const scored = [];
  for (const s of all) {
    let best = Infinity;
    for (const l of lights) {
      const d = segDist(l.x, l.y, s);
      if (d < l.radius) best = Math.min(best, d / l.radius);
    }
    if (best < Infinity) scored.push([best, s]);
  }
  scored.sort((a, b) => a[0] - b[0]);
  return scored.slice(0, Math.min(settings.maxSegments, perf?.luz?.maxSegments ?? Infinity)).map(([, s]) => s);
}

/** O que cada efeito precisa ter: { key, attach, sksl, uniforms, rect, effectType } */
async function plan(local, items, lights, mode) {
  if (mode === "viewport") {
    const segs = wallSegments(local, items, lights);
    const animated = lights.some((l) => l.anim > 0);
    const uniforms = buildUniforms(lights, segs, animated);
    const [cw, ch] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    uniforms.push({ name: "css", value: { x: cw, y: ch } });
    return [{ key: "tela", attach: null, sksl: buildSksl(lights.length, segs.length, mode, !!settings.debug, animated), uniforms, rect: null, effectType: "VIEWPORT" }];
  }
  return lights.map((l) => {
    const segs = wallSegments(local, items, [l]);
    const animated = l.anim > 0;
    // retângulo com folga para qualquer ponto de ancoragem (o shader acha o mundo a partir da posição do efeito)
    const m = 20, W = 2 * (2 * l.radius + 2 * m), H = W;
    const rect = { x: l.x - l.radius - m, y: l.y - l.radius - m, w: W, h: H };
    const uniforms = buildUniforms([l], segs, animated, { x: rect.x, y: rect.y });
    uniforms.push({ name: "wsize", value: { x: W, y: H } });
    return { key: l.parent, attach: l.parent, sksl: buildSksl(1, segs.length, mode, !!settings.debug, animated), uniforms, rect, effectType: "STANDALONE" };
  });
}

async function update() {
  if (perf?.luz?.on === false) return removeAll(); // Otimizador: luz colorida desligada neste navegador
  const [local, items] = await Promise.all([OBR.scene.local.getItems(), OBR.scene.items.getItems()]);
  const byId = new Map(items.map((i) => [i.id, i]));

  // 1) luzes do Dynamic Fog cujo token tem cor definida (token escondido ou apagado: a cor some junto)
  const lights = [];
  for (const l of local) {
    if (l.type !== "LIGHT" || !l.attachedTo) continue;
    const parent = byId.get(l.attachedTo);
    const cfg = parent?.metadata?.[CFG];
    if (!cfg?.color || !parent?.metadata?.[DF_LIGHT] || parent.visible === false || l.visible === false) continue;
    if (lights.some((x) => x.parent === parent.id)) continue; // uma luz colorida por token
    lights.push({
      parent: parent.id,
      x: parent.position.x,
      y: parent.position.y,
      radius: l.attenuationRadius || 0,
      softness: Math.min(0.9, Math.max(0.08, (l.falloff ?? 1) / 2)),
      intensity: cfg.intensity ?? 0.6,
      color: cfg.color,
      dir: rad((l.rotation ?? 0) + settings.dirOffset),
      inner: rad((l.innerAngle ?? 360) / 2),
      outer: rad((l.outerAngle ?? 360) / 2),
      anim: perf?.luz?.anim === false ? 0 : animId(cfg.anim),
      speed: cfg.speed ?? 1,
    });
  }
  const cap = Math.max(1, Math.min(MAX_LIGHTS, settings.maxLights || 16));
  const pcap = perf?.luz?.maxLights ?? Infinity; // teto do Otimizador: as mais perto do centro da tela ficam
  if (lights.length > pcap) {
    const [vp, w, h, sc] = await Promise.all([OBR.viewport.getPosition(), OBR.viewport.getWidth(), OBR.viewport.getHeight(), OBR.viewport.getScale()]).catch(() => [null]);
    if (vp) {
      const c = { x: (w / 2 - vp.x) / sc, y: (h / 2 - vp.y) / sc };
      lights.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    }
    lights.length = Math.max(0, pcap);
  }
  if (lights.length > cap) {
    if (!warnedMax && (await OBR.player.getRole()) === "GM") {
      warnedMax = true;
      OBR.notification.show(`Luz Colorida: o limite está em ${cap} luzes coloridas ao mesmo tempo; as demais ficam brancas. Dá para subir no painel (até ${MAX_LIGHTS}).`, "WARNING");
    }
    lights.length = cap;
  }
  if (!lights.length) return removeAll();

  const mode = ["viewport", "standalone"].includes(settings.posMode) ? settings.posMode : "local";
  const want = await plan(local, items, lights, mode);
  const look = `${settings.layer}|${settings.blend}|${mode}`;

  // apaga o que não serve mais (luz sumiu, mudou de modo, camada ou mistura)
  const gone = [];
  for (const [k, e] of effects) if (!want.some((w) => w.key === k) || e.look !== look) { gone.push(e.id); effects.delete(k); }
  if (gone.length) await OBR.scene.local.deleteItems(gone).catch(() => {});

  // cria os novos
  const add = [];
  for (const w of want) {
    if (effects.has(w.key)) continue;
    const b = buildEffect()
      .effectType(w.effectType)
      .sksl(w.sksl)
      .uniforms(w.uniforms)
      .blendMode(settings.blend)
      .layer(settings.layer)
      .locked(true)
      .disableHit(true)
      .name("Luz colorida")
      .metadata({ [`${ID}/effect`]: true });
    if (w.rect) b.position({ x: w.rect.x, y: w.rect.y }).width(w.rect.w).height(w.rect.h);
    // preso ao token: anda junto; não gira nem cresce com ele (o retângulo é calculado no mundo)
    if (w.attach) b.attachedTo(w.attach).disableAttachmentBehavior(["ROTATION", "SCALE"]);
    const eff = b.build();
    add.push(eff);
    effects.set(w.key, { id: eff.id, sksl: w.sksl, look, sig: JSON.stringify([w.uniforms, w.rect]) });
  }
  if (add.length) await OBR.scene.local.addItems(add);

  // atualiza só o que mudou (nada de piscar nem de laço de atualização)
  const upd = new Map();
  for (const w of want) {
    const e = effects.get(w.key);
    const sig = JSON.stringify([w.uniforms, w.rect]);
    if (add.some((a) => a.id === e.id) || (sig === e.sig && w.sksl === e.sksl)) continue;
    upd.set(e.id, { w, codeChanged: w.sksl !== e.sksl });
    e.sig = sig; e.sksl = w.sksl;
  }
  if (upd.size) {
    await OBR.scene.local.updateItems([...upd.keys()], (draft) => {
      for (const it of draft) {
        const { w, codeChanged } = upd.get(it.id);
        if (codeChanged) it.sksl = w.sksl;
        it.uniforms = w.uniforms;
        if (w.rect) { it.position = { x: w.rect.x, y: w.rect.y }; it.width = w.rect.w; it.height = w.rect.h; }
      }
    }).catch(() => { for (const id of upd.keys()) for (const [k, e] of effects) if (e.id === id) effects.delete(k); schedule(); });
  }
}

async function loadSettings() {
  const md = await OBR.scene.getMetadata();
  settings = { ...DEFAULT_SETTINGS, ...(md[SETTINGS] || {}) };
}

OBR.onReady(async () => {
  // menu de contexto: só aparece em tokens que já têm luz do Dynamic Fog
  await OBR.contextMenu.create({
    id: `${ID}/menu`,
    icons: [{
      icon: url("icon.svg"),
      label: "Cor da luz",
      filter: { every: [{ key: ["metadata", DF_LIGHT], value: undefined, operator: "!=" }], roles: ["GM"] },
    }],
    embed: { url: url("context.html"), height: 250 },
  });

  const start = async () => {
    // limpa efeitos que tenham sobrado de uma sessão anterior
    const old = await OBR.scene.local.getItems((i) => i.metadata?.[`${ID}/effect`] === true);
    if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id));
    effects.clear();
    await loadSettings();
    schedule(0);
  };
  perf = readPerf();
  onPerf((p) => { perf = p; schedule(0); });
  onClean(() => start());
  if (await OBR.scene.isReady()) await start();
  OBR.scene.onReadyChange((ready) => { if (ready) start(); else effects.clear(); });
  OBR.scene.onMetadataChange((md) => { settings = { ...DEFAULT_SETTINGS, ...(md[SETTINGS] || {}) }; schedule(); });
  OBR.scene.items.onChange(() => schedule());
  // só reage quando luzes ou paredes locais mudam (o próprio efeito também dispara onChange)
  let sig = "";
  OBR.scene.local.onChange((items) => {
    const next = items
      .filter((i) => i.type === "LIGHT" || i.type === "WALL")
      .map((i) => `${i.id}:${i.lastModified}:${i.position.x | 0},${i.position.y | 0}:${i.visible}:${i.blocking ?? ""}:${i.attenuationRadius ?? ""}:${i.rotation ?? 0}:${i.points?.length ?? 0}`)
      .join("|");
    if (next !== sig) { sig = next; schedule(); }
  });
});
