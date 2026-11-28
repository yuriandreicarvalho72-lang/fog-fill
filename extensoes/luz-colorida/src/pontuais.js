// Luzes pontuais: luz colorida solta no mapa (sem token), pedida por outras extensões (habilidades do Arsenal, Gatilhos).
// Curtas: mensagem para todos (CH_LUZ). Longas: lista na cena (LUZES), para quem entra depois também.
// Cada navegador desenha a sua com um efeito local; entra, fica o tempo pedido e apaga suavemente.
import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { ID } from "./shared.js";
import { envelope, buildPontual } from "./pontual-calc.js";

export const CH_LUZ = `${ID}/pontual`;         // { id, x, y, cor, raio (px), intens, anim, dur (s | "fim"), fade (s), tag? }
export const CH_LUZ_FIM = `${ID}/pontual-fim`; // { tag } ("" = todas)
export const LUZES = `${ID}/pontuais`;         // metadado da cena: [{ ...pedido, at, until }]
export const MARCA = `${ID}/pontual-fx`;

const MAX_VIVAS = 10;
const live = new Map(); // id -> { itemId, timers, tag, lista }
const sem = (s) => String(s || "").toLowerCase().trim();

export async function setupPontuais({ getSettings, getPerf, getWalls }) {
  const apaga = async (id) => {
    const r = live.get(id);
    if (!r) return;
    live.delete(id);
    r.timers.forEach((t) => clearTimeout(t));
    clearInterval(r.iv);
    if (r.itemId) await OBR.scene.local.deleteItems([r.itemId]).catch(() => {});
  };
  const acende = async (req, lista) => {
    if (!req?.id || live.has(req.id) || getPerf()?.luz?.on === false) return;
    if (live.size >= MAX_VIVAS) await apaga(live.keys().next().value);
    const s = getSettings();
    const rec = { itemId: "", timers: [], tag: sem(req.tag), lista, iv: 0 };
    live.set(req.id, rec);
    const dur = req.dur === "fim" ? "fim" : Math.max(0.2, Number(req.dur) || 1.5);
    const fade = Math.max(0, Number(req.fade) || 0);
    const segs = await (getWalls?.({ x: req.x, y: req.y, radius: Math.max(8, Number(req.raio) || 150) }).catch(() => []) ?? []); // sombra das paredes (Dynamic Fog e Smoke & Spectre), as de agora
    const b0 = buildPontual(req, s, envelope(0, dur, fade), segs);
    const eff = buildEffect().effectType("STANDALONE").sksl(b0.sksl).uniforms(b0.uniforms).blendMode(s.blend).layer(s.layer)
      .position({ x: b0.rect.x, y: b0.rect.y }).width(b0.rect.w).height(b0.rect.h).locked(true).disableHit(true)
      .name("Luz pontual").metadata({ [MARCA]: true }).build();
    rec.itemId = eff.id;
    await OBR.scene.local.addItems([eff]).catch(() => {});
    const t0 = Date.now();
    if (dur !== "fim" || fade) {
      let last = -1;
      rec.iv = setInterval(async () => {
        const k = envelope((Date.now() - t0) / 1000, dur, fade);
        const q = Math.round(k * 20);
        if (q === last) return; // só atualiza quando o brilho muda de verdade
        last = q;
        const b = buildPontual(req, s, k, segs);
        await OBR.scene.local.updateItems([eff.id], (d) => { for (const it of d) it.uniforms = b.uniforms; }).catch(() => {});
      }, 90);
    }
    if (dur !== "fim") rec.timers.push(setTimeout(() => apaga(req.id), dur * 1000 + 150));
  };

  const doLista = (md) => {
    const list = Array.isArray(md?.[LUZES]) ? md[LUZES] : [];
    const ids = new Set(list.map((e) => e.id));
    for (const [id, r] of live) if (r.lista && !ids.has(id)) apaga(id);
    for (const e of list) acende({ ...e, dur: e.until ? Math.max(0.2, (e.until - e.at) / 1000) : "fim" }, true);
  };
  const limpa = async () => {
    for (const id of [...live.keys()]) await apaga(id);
    const old = await OBR.scene.local.getItems((i) => i.metadata?.[MARCA]).catch(() => []);
    if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id)).catch(() => {});
  };
  OBR.broadcast.onMessage(CH_LUZ, (e) => acende(e.data, false));
  OBR.broadcast.onMessage(CH_LUZ_FIM, (e) => { const t = sem(e.data?.tag); for (const [id, r] of live) if (!t || t === "*" || r.tag === t) apaga(id); });
  await limpa();
  if (await OBR.scene.isReady()) doLista(await OBR.scene.getMetadata());
  OBR.scene.onReadyChange(async (r) => { if (r) doLista(await OBR.scene.getMetadata()); else limpa(); });
  OBR.scene.onMetadataChange(doLista);
  return { limpa };
}
