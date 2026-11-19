import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { buildSksl, buildUniforms, MAX_LIGHTS, animId } from "./shader.js";
import { ID, CFG, SETTINGS, DEFAULT_SETTINGS, DF_LIGHT } from "./shared.js";

const url = (name) => new URL(`${import.meta.env.BASE_URL}${name}`, window.location.href).href;
const rad = (deg) => (deg * Math.PI) / 180;

let settings = { ...DEFAULT_SETTINGS };
let effectId = null;
let current = { sksl: "", layer: "", blend: "", mode: "" };
let timer = null;
let warnedMax = false;

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

async function removeEffect() {
  if (effectId) {
    await OBR.scene.local.deleteItems([effectId]).catch(() => {});
    effectId = null;
    current = { sksl: "", layer: "", blend: "", mode: "" };
  }
}

async function update() {
  const [local, items] = await Promise.all([OBR.scene.local.getItems(), OBR.scene.items.getItems()]);
  const byId = new Map(items.map((i) => [i.id, i]));

  // 1) luzes do Dynamic Fog cujo token tem cor definida
  const lights = [];
  for (const l of local) {
    if (l.type !== "LIGHT" || !l.attachedTo) continue;
    const parent = byId.get(l.attachedTo);
    const cfg = parent?.metadata?.[CFG];
    if (!cfg?.color || !parent?.metadata?.[DF_LIGHT] || parent.visible === false || l.visible === false) continue;
    lights.push({
      x: parent.position.x,
      y: parent.position.y,
      radius: l.attenuationRadius || 0,
      softness: Math.min(0.9, Math.max(0.08, (l.falloff ?? 1) / 2)),
      intensity: cfg.intensity ?? 0.6,
      color: cfg.color,
      dir: rad((l.rotation ?? 0) + settings.dirOffset),
      inner: rad((l.innerAngle ?? 360) / 2),
      outer: rad((l.outerAngle ?? 360) / 2),
      anim: animId(cfg.anim),
      speed: cfg.speed ?? 1,
    });
  }
  const cap = Math.max(1, Math.min(MAX_LIGHTS, settings.maxLights || 16));
  if (lights.length > cap) {
    if (!warnedMax && (await OBR.player.getRole()) === "GM") {
      warnedMax = true;
      OBR.notification.show(`Luz Colorida: o limite está em ${cap} luzes coloridas ao mesmo tempo; as demais ficam brancas. Dá para subir no painel (até ${MAX_LIGHTS}).`, "WARNING");
    }
    lights.length = cap;
  }
  if (!lights.length) return removeEffect();

  // 2) paredes: as do Dynamic Fog (locais) e as nativas da cena, só as que bloqueiam
  let segs = [];
  if (settings.shadows) {
    const walls = [...local, ...items].filter((i) => i.type === "WALL" && i.blocking !== false);
    const all = [];
    for (const wl of walls) {
      const pts = rdp((wl.points || []).map((p) => toWorld(wl, p)), 3);
      for (let k = 0; k < pts.length - 1; k++) all.push({ ax: pts[k].x, ay: pts[k].y, bx: pts[k + 1].x, by: pts[k + 1].y });
    }
    // fica só com os trechos dentro do alcance de alguma luz colorida, os mais próximos primeiro
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
    segs = scored.slice(0, settings.maxSegments).map(([, s]) => s);
  }

  const mode = ["viewport", "standalone"].includes(settings.posMode) ? settings.posMode : "local";
  const animated = lights.some((l) => l.anim > 0);
  const sksl = buildSksl(lights.length, segs.length, mode, !!settings.debug, animated);
  const uniforms = buildUniforms(lights, segs, animated);

  // retângulo do efeito (modo A): cobre todas as luzes, com folga para qualquer ponto de ancoragem
  let rect = null;
  if (mode !== "viewport") {
    const m = 20;
    const minX = Math.min(...lights.map((l) => l.x - l.radius)) - m, minY = Math.min(...lights.map((l) => l.y - l.radius)) - m;
    const maxX = Math.max(...lights.map((l) => l.x + l.radius)) + m, maxY = Math.max(...lights.map((l) => l.y + l.radius)) + m;
    const W = 2 * (maxX - minX), H = 2 * (maxY - minY);
    rect = { x: minX, y: minY, w: W, h: H };
    uniforms.push({ name: "wsize", value: { x: W, y: H } });
  } else {
    const [cw, ch] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    uniforms.push({ name: "css", value: { x: cw, y: ch } });
  }

  if (effectId && (current.layer !== settings.layer || current.blend !== settings.blend || current.mode !== mode)) await removeEffect();
  if (!effectId) {
    const b = buildEffect()
      .effectType(mode === "viewport" ? "VIEWPORT" : "STANDALONE")
      .sksl(sksl)
      .uniforms(uniforms)
      .blendMode(settings.blend)
      .layer(settings.layer)
      .locked(true)
      .disableHit(true)
      .name("Luz colorida")
      .metadata({ [`${ID}/effect`]: true });
    if (rect) b.position({ x: rect.x, y: rect.y }).width(rect.w).height(rect.h);
    const eff = b.build();
    await OBR.scene.local.addItems([eff]);
    effectId = eff.id;
    current = { sksl, layer: settings.layer, blend: settings.blend, mode };
    return;
  }
  const changedCode = sksl !== current.sksl;
  await OBR.scene.local.updateItems([effectId], (draft) => {
    for (const e of draft) {
      if (changedCode) e.sksl = sksl;
      e.uniforms = uniforms;
      if (rect) { e.position = { x: rect.x, y: rect.y }; e.width = rect.w; e.height = rect.h; }
    }
  });
  current.sksl = sksl;
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
    effectId = null;
    current = { sksl: "", layer: "", blend: "", mode: "" };
    await loadSettings();
    schedule(0);
  };
  if (await OBR.scene.isReady()) await start();
  OBR.scene.onReadyChange((ready) => { if (ready) start(); else { effectId = null; } });
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
