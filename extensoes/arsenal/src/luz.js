// Luz colorida das habilidades: o Arsenal só manda o pedido; quem acende é a extensão Luz Colorida (mesma origem, outro canal).
// Luz curta (até 8 s): mensagem para todos. Luz longa ("fim" ou mais): fica na lista da cena, para quem entra depois também.
import OBR from "@owlbear-rodeo/sdk";
import { luzPoint } from "./abil.js";
import { uid } from "./shared.js";

export const CH_LUZ = "luz-colorida/pontual";         // { id, x, y, cor, raio (px), intens, anim, dur (s), fade (s), tag? }
export const CH_LUZ_FIM = "luz-colorida/pontual-fim"; // { tag? } ("" = todas)
export const LUZES = "luz-colorida/pontuais";         // metadado da cena: [{ ...pedido, at, until (ms | null) }]
const LONGA = 8, MAX = 8;

/** Pedido de luz de uma habilidade (ou null). cell = px por quadrado, mpc = metros por quadrado. */
export function luzRequest(ev, tag) {
  const l = ev.ab?.luz;
  if (!l) return null;
  const at = luzPoint(ev);
  const raio = Math.round((l.raio / (ev.mpc || 1.5)) * (ev.cell || 150));
  return { id: uid(), x: Math.round(at.x), y: Math.round(at.y), cor: l.cor, raio, intens: l.intens, anim: l.anim || "none", dur: l.dur, fade: l.fade, tag: tag || ev.ab.nome };
}

export async function sendLuz(req) {
  if (!req) return;
  const longa = req.dur === "fim" || Number(req.dur) > LONGA;
  if (!longa) return OBR.broadcast.sendMessage(CH_LUZ, req, { destination: "ALL" });
  const at = Date.now();
  const e = { ...req, at, until: req.dur === "fim" ? null : at + Number(req.dur) * 1000 };
  const list = [...((await OBR.scene.getMetadata())[LUZES] || []), e].slice(-MAX);
  await OBR.scene.setMetadata({ [LUZES]: list });
}
export async function endLuz(tag) {
  const t = String(tag || "").toLowerCase().trim();
  const cur = (await OBR.scene.getMetadata())[LUZES] || [];
  const keep = t && t !== "*" ? cur.filter((e) => String(e.tag || "").toLowerCase().trim() !== t) : [];
  if (keep.length !== cur.length) await OBR.scene.setMetadata({ [LUZES]: keep });
  OBR.broadcast.sendMessage(CH_LUZ_FIM, { tag: t }, { destination: "ALL" }).catch(() => {});
}
