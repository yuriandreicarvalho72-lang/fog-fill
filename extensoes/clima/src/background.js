// Mantém um efeito LOCAL (cada jogador desenha o seu) para cada camada de clima de cada item da cena.
import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { buildSksl, buildUniforms } from "./shaders.js";
import { ID, LAYERS, FLASH, EFFECT_META, url } from "./shared.js";

let cell = 150;
const live = new Map(); // chave "itemId/camadaId" -> { effectId, sig, type }
let busy = false, again = false;
let flash = 0;

const key = (item, layer) => `${item.id}/${layer.id}`;
function placement(item, layer) {
  // em forma na camada de fog o clima fica logo acima dela; senão acima de tudo ou sob os tokens
  if (item.layer === "FOG") return { layer: "FOG", z: item.zIndex + 1 };
  return layer.above === false ? { layer: "DRAWING", z: 0 } : { layer: "RULER", z: 0 };
}
const sigOf = (item, layer) => JSON.stringify([layer, item.visible, item.layer, item.zIndex, cell]);

function buildFor(item, layer) {
  const pl = placement(item, layer);
  return buildEffect()
    .effectType("ATTACHMENT")
    .attachedTo(item.id)
    .position(item.position)
    .rotation(item.rotation)
    .sksl(buildSksl(layer.type))
    .uniforms(buildUniforms(layer, cell, layer.type === "storm" ? flash : 0))
    .layer(pl.layer)
    .zIndex(pl.z)
    .visible(item.visible !== false && layer.on !== false)
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .disableAttachmentBehavior(["COPY"])
    .name(`Clima: ${layer.type}`)
    .metadata({ [EFFECT_META]: true })
    .build();
}

async function reconcile() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    do {
      again = false;
      const items = await OBR.scene.items.getItems((i) => Array.isArray(i.metadata?.[LAYERS]) && i.metadata[LAYERS].length);
      const wanted = new Map();
      for (const it of items) for (const l of it.metadata[LAYERS]) wanted.set(key(it, l), { it, l });
      const add = [], del = [], upd = new Map();
      for (const [k, v] of live) if (!wanted.has(k)) { del.push(v.effectId); live.delete(k); }
      for (const [k, { it, l }] of wanted) {
        const cur = live.get(k);
        const sig = sigOf(it, l);
        if (!cur) {
          const e = buildFor(it, l);
          add.push(e);
          live.set(k, { effectId: e.id, sig, type: l.type });
        } else if (cur.sig !== sig) {
          upd.set(cur.effectId, { it, l, typeChanged: cur.type !== l.type });
          cur.sig = sig; cur.type = l.type;
        }
      }
      if (del.length) await OBR.scene.local.deleteItems(del).catch(() => {});
      if (add.length) await OBR.scene.local.addItems(add);
      if (upd.size) {
        await OBR.scene.local.updateItems([...upd.keys()], (draft) => {
          for (const e of draft) {
            const { it, l, typeChanged } = upd.get(e.id);
            const pl = placement(it, l);
            if (typeChanged) e.sksl = buildSksl(l.type);
            e.uniforms = buildUniforms(l, cell, l.type === "storm" ? flash : 0);
            e.layer = pl.layer;
            e.zIndex = pl.z;
            e.visible = it.visible !== false && l.on !== false;
          }
        });
      }
    } while (again);
  } catch (e) {
    console.error(`[${ID}]`, e);
  } finally {
    busy = false;
  }
}

async function clearAll() {
  const old = await OBR.scene.local.getItems((i) => i.metadata?.[EFFECT_META] === true);
  if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id));
  live.clear();
}

// relâmpago: um clarão forte, uma piscada e o apagar, em todos os efeitos de tempestade deste jogador
let flashTimer = null;
function lightning() {
  const t0 = performance.now();
  const curve = (ms) => {
    if (ms < 90) return 1;
    if (ms < 160) return 0.25;
    if (ms < 240) return 0.9;
    return Math.max(0, 0.9 * Math.exp(-(ms - 240) / 220));
  };
  clearInterval(flashTimer);
  flashTimer = setInterval(async () => {
    const ms = performance.now() - t0;
    flash = curve(ms);
    const ids = [...live.values()].filter((v) => v.type === "storm").map((v) => v.effectId);
    if (ids.length) {
      await OBR.scene.local.updateItems(ids, (draft) => {
        for (const e of draft) e.uniforms = e.uniforms.map((u) => (u.name === "uFlash" ? { ...u, value: flash } : u));
      }).catch(() => {});
    }
    if (ms > 1400) { clearInterval(flashTimer); flash = 0; }
  }, 40);
}

OBR.onReady(async () => {
  // menu de contexto: mapas e formas (zonas de clima). Só o mestre mexe.
  await OBR.contextMenu.create({
    id: `${ID}/menu`,
    icons: [{
      icon: url("icon.svg"),
      label: "Clima",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [
          { key: "layer", value: "MAP", coordinator: "||" },
          { key: "type", value: "SHAPE", coordinator: "||" },
          { key: "type", value: "PATH", coordinator: "||" },
          { key: "type", value: "CURVE" },
        ],
      },
    }],
    embed: { url: url("context.html"), height: 520 },
  });

  const start = async () => {
    cell = await OBR.scene.grid.getDpi().catch(() => 150);
    await clearAll();
    await reconcile();
  };
  if (await OBR.scene.isReady()) await start();
  OBR.scene.onReadyChange((r) => { if (r) start(); else live.clear(); });
  OBR.scene.items.onChange(() => reconcile());
  OBR.scene.grid.onChange(async (g) => { cell = g.dpi || cell; for (const v of live.values()) v.sig = ""; reconcile(); });
  OBR.broadcast.onMessage(FLASH, () => lightning());
});
