// Habilidades: operações com o SDK, usadas pelo painel e pelo segundo plano.
// Só o mestre usa. O dossiê fica no token; a mira (habilidade ativa, alvos, ponto) fica no metadado do jogador.
import OBR from "@owlbear-rodeo/sdk";
import { DOSSIE, HAB_USO, CH_HAB, normalize, canUse, markUse, numbers, shapeOf, caughtIn, setVisual, setVideo, setDuracao, buildAbility, keyOf, registerLink, parseDuracao, giroOf } from "./abil.js";
import { prepareCustom, loadMeus } from "./meus.js";
import { addAtivo } from "./ativos.js";
import { halfSize } from "./cover.js";
import { ID, metersPerUnit, itemName, isToken } from "./shared.js";

export const HAB_TOOL = `${ID}/habilidades`;
export const HAB_MODE = `${ID}/hab-mira`;
export const HAB_PANEL = `${ID}/hab-painel`;
export const HAB_AIM = `${ID}/hab-ativa`;   // metadado do jogador: { token, nome, targets: [id], point }
export const HAB_LAST = `${ID}/hab-ultimo`; // metadado do jogador: { nome, text, caught: [nomes], at }
export const HAB_PREVIEW = `${ID}/hab-previa`; // marca dos itens locais da prévia

export const dossieOf = (it) => it?.metadata?.[DOSSIE] || null;
export const usoOf = (it) => it?.metadata?.[HAB_USO] || {};
export const getAim = async () => (await OBR.player.getMetadata())[HAB_AIM] || {};
export const setAim = async (patch, replace = false) => {
  const cur = replace ? {} : await getAim();
  await OBR.player.setMetadata({ [HAB_AIM]: { ...cur, ...patch } });
};

/** Guarda o dossiê (texto colado) no token. Devolve os avisos. */
export async function saveDossie(tokenId, raw) {
  const { dossie, avisos } = normalize(raw);
  await OBR.scene.items.updateItems([tokenId], (d) => { for (const it of d) { it.metadata[DOSSIE] = dossie; it.metadata[HAB_USO] = {}; } });
  return { dossie, avisos };
}
export const removeDossie = (tokenId) => OBR.scene.items.updateItems([tokenId], (d) => { for (const it of d) { delete it.metadata[DOSSIE]; delete it.metadata[HAB_USO]; } });
/** Troca o visual (vídeo) de uma habilidade do dossiê do token ("" = sem vídeo). */
export const setVisualOn = (tokenId, nome, vis) => OBR.scene.items.updateItems([tokenId], (d) => { for (const it of d) if (it.metadata[DOSSIE]) it.metadata[DOSSIE] = setVisual(it.metadata[DOSSIE], nome, vis); });
/** Põe ou tira o link de vídeo próprio de uma habilidade ({ url, tipo } ou null). */
export const setVideoOn = (tokenId, nome, video) => OBR.scene.items.updateItems([tokenId], (d) => { for (const it of d) if (it.metadata[DOSSIE]) it.metadata[DOSSIE] = setVideo(it.metadata[DOSSIE], nome, video); });
/** Duração do efeito da habilidade (null = uma vez, segundos, ou "fim" = até encerrar). */
export const setDuracaoOn = (tokenId, nome, dur) => OBR.scene.items.updateItems([tokenId], (d) => { for (const it of d) if (it.metadata[DOSSIE]) it.metadata[DOSSIE] = setDuracao(it.metadata[DOSSIE], nome, dur); });
export const setUso = (tokenId, fn) => OBR.scene.items.updateItems([tokenId], (d) => { for (const it of d) it.metadata[HAB_USO] = fn(it.metadata[HAB_USO] || {}); });

/** Metros por quadrado da cena. */
export async function metersPerCell() {
  const s = await OBR.scene.grid.getScale().catch(() => null);
  return (metersPerUnit(s?.parsed?.unit) * (s?.parsed?.multiplier || 1.5)) || 1.5;
}

/** Manda a animação para todos e, se a habilidade tem duração, guarda os vídeos que ficam no mapa. */
export async function sendAbility(ev, { tag, by } = {}) {
  await OBR.broadcast.sendMessage(CH_HAB, ev, { destination: "ALL" });
  if (!ev.ab.duracao) return;
  await prepareCustom(ev.ab, ev.subs); // vídeos próprios: tamanho lido do arquivo antes de guardar
  const { persist } = buildAbility(ev, () => true, (n) => ev.subs?.[n]);
  if (persist.length) await addAtivo({ nome: ev.ab.nome, tag: tag || ev.ab.nome, by, dur: ev.ab.duracao, vids: persist });
}

/**
 * Usa a habilidade: animação para todos, quem ficou na área, contadores. Devolve { error } ou { ok, caught }.
 * Os dados são do mestre: aqui só os números da ficha aparecem para ele.
 */
export async function useAbility(tokenId, nome, aim = {}) {
  const [tok] = await OBR.scene.items.getItems([tokenId]);
  const dossie = dossieOf(tok);
  if (!tok || !dossie) return { error: "o token não tem dossiê." };
  const ab = dossie.habilidades.find((h) => h.nome === nome);
  if (!ab) return { error: `"${nome}" não está no dossiê.` };
  const can = canUse(ab, usoOf(tok), dossie);
  if (!can.ok) return { error: `${ab.nome}: ${can.why}.` };
  const forma = ab.forma;
  if (forma === "alvo" && !(aim.targets || []).length) return { error: "marque o(s) alvo(s) no mapa com a ferramenta Habilidades." };
  if ((forma === "cone" || forma === "linha" || forma === "movimento" || (forma === "area" && ab.alcance > 0)) && !aim.point) return { error: "clique no mapa para apontar a habilidade." };
  const cell = await OBR.scene.grid.getDpi().catch(() => 150);
  const mpc = await metersPerCell();
  const all = await OBR.scene.items.getItems();
  const byId = new Map(all.map((i) => [i.id, i]));
  const selfHalf = halfSize(tok, cell) || cell / 2;
  const targets = (aim.targets || []).map((id) => byId.get(id)).filter(Boolean).map((i) => ({ id: i.id, at: i.position, half: halfSize(i, cell) || cell / 2 }));
  const subs = Object.fromEntries((ab.faz || []).map((n) => [n, dossie.habilidades.find((h) => h.nome === n)]).filter(([, h]) => h));
  const ev = { token: tok.id, ab, subs, from: tok.position, aim: { targets, point: aim.point || null }, cell, mpc, selfHalf, seed: Math.floor(Math.random() * 2 ** 31) };
  await sendAbility(ev, { by: itemName(tok) });
  // quem ficou na área (o mestre rola as resistências e o dano na mão)
  const shape = shapeOf(ab, tok.position, ev.aim, cell, mpc, selfHalf);
  const pool = all.filter((i) => isToken(i) && i.id !== tok.id).map((i) => ({ id: i.id, at: i.position, half: halfSize(i, cell) || cell / 2 }));
  const caughtIds = forma === "alvo" ? targets.map((t) => t.id) : caughtIn(shape, pool, [tok.id]);
  const caught = caughtIds.map((id) => itemName(byId.get(id)));
  const { uso, aviso } = markUse(ab, usoOf(tok), dossie);
  await setUso(tok.id, () => uso);
  // Ataque Múltiplo: mostra os números dos ataques que ele faz (ex.: "2× Garras do Gânglio: +9 para acertar · ...")
  const counts = (ab.faz || []).reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map());
  const text = ab.faz?.length ? [...counts].map(([n, k]) => `${k}× ${n}${subs[n] ? `: ${numbers(subs[n])}` : ""}`).join(" | ") : numbers(ab);
  await OBR.player.setMetadata({ [HAB_LAST]: { nome: ab.nome, by: itemName(tok), text, caught, forma, at: Date.now() } });
  // sem aviso de confirmação: o resultado fica no topo do painel (só o de covil repetido avisa)
  if (aviso) OBR.notification.show(`Habilidades: ${aviso}`, "WARNING");
  return { ok: true, caught };
}

const semAc = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Efeito visual pedido pelo Gatilhos: { visual? | video: { url, tipo, giro? }, from? (token de onde sai), targets: [ids],
 * dur (0 | segundos | "fim"), tamanho? (quadrados), tag? (nome para encerrar depois), origem? }.
 * Sem "from": o efeito fica em cima de cada alvo. Com "from": projétil, linha e cone saem dele até cada alvo.
 */
export async function playFx(d = {}) {
  await loadMeus();
  const ab = { nome: String(d.tag || "Efeito").slice(0, 60), forma: "alvo", impacto: "nenhum" };
  if (d.video?.url) {
    if (!registerLink(String(d.video.url).trim(), d.video.tipo)) return { error: "o link do vídeo precisa começar com http(s):// e ter um tipo (alvo, área, em si, projétil, linha ou cone)." };
    ab.video = { url: String(d.video.url).trim(), tipo: d.video.tipo };
    const g = giroOf(d.video.giro); if (g) ab.video.giro = g;
  } else ab.visual = semAc(d.visual).replace(/\s+/g, "_");
  if (!keyOf(ab)) return { error: `o visual "${d.visual || ""}" não existe (a lista está no painel Habilidades do Arsenal).` };
  const dur = parseDuracao(d.dur); if (dur) ab.duracao = dur;
  if (Number(d.tamanho) > 0) ab.tamanho = Math.min(40, Number(d.tamanho));
  const cell = await OBR.scene.grid.getDpi().catch(() => 150);
  const all = await OBR.scene.items.getItems();
  const byId = new Map(all.map((i) => [i.id, i]));
  const src = d.from ? byId.get(d.from) : null;
  const tgs = (d.targets || []).map((id) => byId.get(id)).filter((i) => i && i.id !== d.from);
  const list = tgs.length ? tgs : src ? [src] : [];
  if (!list.length) return { error: "o efeito visual está sem alvo." };
  const targets = list.map((i) => ({ id: i.id, at: i.position, half: halfSize(i, cell) || cell / 2 }));
  const ev = { token: src?.id || null, ab, subs: {}, from: src ? src.position : targets[0].at, semOrigem: !src, aim: { targets, point: null }, cell, mpc: await metersPerCell(), selfHalf: src ? halfSize(src, cell) || cell / 2 : cell / 2, seed: Math.floor(Math.random() * 2 ** 31) };
  await sendAbility(ev, { tag: ab.nome, by: d.origem || "Gatilhos" });
  return { ok: true };
}

/** Habilidade de NPC pedida pelo Gatilhos: { token, nome, targets: [ids] }. Os alvos também dão a direção (cone, linha, área, movimento). */
export async function useFromTrigger(d = {}) {
  const [tok] = d.token ? await OBR.scene.items.getItems([d.token]) : [];
  const dossie = dossieOf(tok);
  if (!tok || !dossie) return { error: "o NPC escolhido não tem dossiê no Arsenal." };
  const ab = dossie.habilidades.find((h) => semAc(h.nome) === semAc(d.nome));
  if (!ab) return { error: `"${d.nome || ""}" não está no dossiê de ${itemName(tok)}.` };
  const ids = (d.targets || []).filter((id) => id && id !== tok.id);
  const its = ids.length ? await OBR.scene.items.getItems(ids) : [];
  const ordered = ids.map((id) => its.find((i) => i.id === id)).filter(Boolean);
  const max = ab.faz?.length || ab.alvos || 1;
  const aim = { targets: ab.forma === "alvo" ? ordered.slice(0, max).map((i) => i.id) : [], point: ["cone", "linha", "movimento"].includes(ab.forma) || (ab.forma === "area" && ab.alcance > 0) ? ordered[0]?.position || null : null };
  if (ab.forma === "alvo" && !aim.targets.length) return { error: `${ab.nome}: escolha o(s) alvo(s) no gatilho (ou "+ quem ativou").` };
  if (!aim.point && aim.targets.length === 0 && !["si", "aura"].includes(ab.forma) && !(ab.forma === "area" && !ab.alcance) && ab.secao !== "passiva") return { error: `${ab.nome}: escolha um alvo no gatilho (a habilidade aponta para ele).` };
  return useAbility(tok.id, ab.nome, aim);
}
