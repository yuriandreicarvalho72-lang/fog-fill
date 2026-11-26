// Página "Efeitos" do painel: solta um efeito (VFX + luz colorida) em qualquer ponto do mapa ou num token, sem precisar de NPC,
// e guarda efeitos recorrentes numa biblioteca (metadado da sala). Só o mestre.
import OBR from "@owlbear-rodeo/sdk";
import { visualGroups, previewFile, LUZ_ANIMS, normLuz, duracaoText, meusVisuais } from "./abil.js";
import { loadMeus, videoSrc } from "./meus.js";
import { playFx, FX_MODE, FX_LIVRE, BIBLIOTECA, HAB_TOOL } from "./hab-ops.js";
import { endByTag, listOf, endAtivos, setAtivoCamada } from "./ativos.js";
import { endLuz } from "./luz.js";
import { uid } from "./shared.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const MAX_BIB = 40;
const VAZIO = { id: "", nome: "", visual: "explosao_fogo", tamanho: 0, dur: "", camada: "", luz: null };

let form = { ...VAZIO };
let lib = [];
let host = null;
let sel = [];
let loaded = false;
let ativos = [];
let armedNow = null;

const durOf = (f) => (f.dur === "" ? 0 : f.dur === "fim" ? "fim" : Number(f.dur) || 0);
export const specOf = (f) => ({ visual: f.visual || "", tamanho: Number(f.tamanho) > 0 ? Number(f.tamanho) : 0, dur: durOf(f), camada: f.camada === "sob" ? "sob" : "", luz: f.luz ? normLuz(f.luz) : null, tag: f.nome || f.visual || "Efeito" });

async function saveLib(next) {
  lib = next.slice(-MAX_BIB);
  await OBR.room.setMetadata({ [BIBLIOTECA]: lib });
}
const cardOf = (e) => `<div class="mrow"><span class="mname" title="${esc(e.visual)}">${esc(e.nome || e.visual)} <small>· ${esc(e.visual || "só luz")}${e.luz ? " · 💡" : ""}${e.dur ? ` · ⏱ ${esc(duracaoText(e.dur))}` : ""}</small></span>
  <button type="button" class="mini" data-bib-arm="${e.id}" title="Armar: clique no mapa para soltar">🎯</button>
  <button type="button" class="mini" data-bib-edit="${e.id}" title="Carregar no formulário">✎</button>
  <button type="button" class="mini danger" data-bib-del="${e.id}" title="Apagar da biblioteca">✕</button></div>`;

function draw() {
  if (!host) return;
  const l = form.luz;
  const vis = form.visual;
  const pf = vis ? previewFile(vis) : "";
  host.innerHTML = `<div class="card">
    <label>Nome <input type="text" id="fxnome" maxlength="40" value="${esc(form.nome)}" placeholder="ex.: Granada de fumaça"></label>
    <label>Visual <select id="fxvis"><option value=""${vis ? "" : " selected"}>(só luz)</option>${visualGroups().map(([t, ls]) => `<optgroup label="${esc(t)}">${ls.map((v) => `<option value="${v}"${v === vis ? " selected" : ""}>${v}</option>`).join("")}</optgroup>`).join("")}</select></label>
    ${pf ? `<video class="fxprev" src="${esc(videoSrc(pf))}" autoplay loop muted playsinline></video>` : ""}
    <div class="row"><span class="hint">Tamanho</span><input type="number" id="fxtam" min="0" max="40" step="0.5" value="${form.tamanho || ""}" placeholder="auto"> <span class="hint">quadrados</span></div>
    <div class="row"><span class="hint">Duração</span><select id="fxdur"><option value=""${form.dur === "" ? " selected" : ""}>uma vez</option><option value="10"${form.dur !== "" && form.dur !== "fim" ? " selected" : ""}>por segundos</option><option value="fim"${form.dur === "fim" ? " selected" : ""}>até eu encerrar</option></select>
      ${form.dur !== "" && form.dur !== "fim" ? `<input type="number" id="fxsec" min="1" max="3600" value="${esc(form.dur)}"> s` : ""}</div>
    <label class="check"><input type="checkbox" id="fxsob" ${form.camada === "sob" ? "checked" : ""}> Por baixo dos tokens (névoa e área não escondem ninguém)</label>
    <label class="check"><input type="checkbox" id="fxluz" ${l ? "checked" : ""}> 💡 Acende luz colorida</label>
    ${l ? `<div class="luzbox"><div class="row"><input type="color" id="lzcor" value="${esc(l.cor)}"><select id="lzanim">${LUZ_ANIMS.map(([k, t]) => `<option value="${k}"${(l.anim || "none") === k ? " selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="row"><span class="hint">Raio</span><input type="number" id="lzraio" min="0.5" max="60" step="0.5" value="${l.raio}"> m <span class="hint">Brilho</span><input type="number" id="lzint" min="0.1" max="1" step="0.1" value="${l.intens}"></div>
      <div class="row"><span class="hint">Luz dura</span><input type="number" id="lzdur" min="0.2" max="3600" step="0.5" value="${l.dur === "fim" ? 10 : l.dur}"> s <label class="check"><input type="checkbox" id="lzfim" ${l.dur === "fim" ? "checked" : ""}> até encerrar</label></div>
      <div class="row"><span class="hint">Apaga em</span><input type="number" id="lzfade" min="0" max="30" step="0.2" value="${l.fade}"> s</div></div>` : ""}
    <div class="btns">
      <button type="button" class="primary" id="fxarm">🎯 Soltar no mapa</button>
 <button type="button" id="fxcenter" title="Solta no centro do que você está vendo">No centro da tela</button>
      <button type="button" id="fxsel" ${sel.length ? "" : "disabled"} title="Solta em cima dos tokens selecionados">Nos selecionados (${sel.length})</button>
    </div>
    <label class="check"><input type="checkbox" id="fxrep" ${armedNow?.repetir ? "checked" : ""}> Continuar armado depois do clique</label>
    <div class="btns"><button type="button" id="fxsave">💾 ${form.id ? "Atualizar" : "Guardar"} na biblioteca</button>${form.id ? `<button type="button" id="fxnew">Novo</button>` : ""}</div>
    <small>${armedNow?.spec ? "Armado: clique no mapa com a ferramenta Habilidades (modo Efeito no mapa). Esc desarma." : "Depois de armar, clique no mapa."}</small>
  </div>
  <h3>Biblioteca (${lib.length})</h3>
  <div class="mlist">${lib.length ? lib.map(cardOf).join("") : `<small>Nenhum efeito guardado ainda. Monte um acima e guarde para usar de novo.</small>`}</div>
  ${ativos.length ? `<h3>No mapa agora (${ativos.length})</h3><div class="mlist">${ativos.map((e) => `<div class="mrow"><span class="mname">${esc(e.nome)}</span>
    <button type="button" class="mini" data-camada-at="${e.id}" title="Trocar entre por cima e por baixo dos tokens">${e.v?.some((c) => c.y) ? "▾ sob" : "▴ sobre"}</button>
    <button type="button" class="mini" data-fim="${e.id}" title="Encerrar">✕</button></div>`).join("")}</div>
  <div class="btns"><button type="button" class="danger" id="fxall">Encerrar tudo (efeitos e luzes)</button></div>` : ""}`;
  bind();
}

function read() {
  const g = (id) => host.querySelector("#" + id);
  form.nome = g("fxnome")?.value ?? form.nome;
  form.visual = g("fxvis")?.value ?? form.visual;
  form.tamanho = Number(g("fxtam")?.value) || 0;
  const dm = g("fxdur")?.value;
  form.dur = dm === "fim" ? "fim" : dm === "10" ? String(Number(g("fxsec")?.value) || 10) : "";
  form.camada = g("fxsob")?.checked ? "sob" : "";
  if (g("fxluz")?.checked) {
    const old = form.luz || { cor: "#ff8a1f", raio: 6, intens: 0.7, dur: 1.5, fade: 0.8 };
    form.luz = g("lzcor") ? { cor: g("lzcor").value, anim: g("lzanim").value, raio: Number(g("lzraio").value), intens: Number(g("lzint").value), dur: g("lzfim").checked ? "fim" : Number(g("lzdur").value) || 1.5, fade: Number(g("lzfade").value) } : old;
  } else form.luz = null;
}

async function arm(spec, repetir) {
  if (!spec.visual && !spec.luz) return OBR.notification.show("Efeitos: escolha um visual ou ligue a luz.", "WARNING");
  await OBR.player.setMetadata({ [FX_LIVRE]: { spec, repetir: !!repetir } });
  try { await OBR.tool.activateMode(HAB_TOOL, FX_MODE); }
  catch (e) { OBR.notification.show("Efeitos: armado, mas não consegui trocar a ferramenta. Escolha o ícone Habilidades na barra e clique no mapa.", "WARNING"); console.warn("[arsenal] activateMode", e); return; }
  OBR.notification.show("Efeitos: armado. Clique no mapa (Esc desarma).", "INFO");
}

function bind() {
  const g = (id) => host.querySelector("#" + id);
  for (const id of ["fxvis", "fxdur", "fxsob", "fxluz", "lzfim"]) g(id)?.addEventListener("change", () => { read(); draw(); });
  for (const id of ["fxnome", "fxtam", "fxsec", "lzcor", "lzanim", "lzraio", "lzint", "lzdur", "lzfade"]) g(id)?.addEventListener("change", read);
  g("fxarm")?.addEventListener("click", () => { read(); arm(specOf(form), g("fxrep")?.checked); });
  g("fxcenter")?.addEventListener("click", async () => {
    read();
    const s = specOf(form);
    if (!s.visual && !s.luz) return OBR.notification.show("Efeitos: escolha um visual ou ligue a luz.", "WARNING");
    const [pos, sc, w, h] = await Promise.all([OBR.viewport.getPosition(), OBR.viewport.getScale(), OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    const r = await playFx({ ...s, point: { x: (w / 2 - pos.x) / sc, y: (h / 2 - pos.y) / sc }, origem: "Efeitos" }).catch((e) => ({ error: e.message }));
    if (r.error) OBR.notification.show(`Efeitos: ${r.error}`, "WARNING");
  });
  g("fxsel")?.addEventListener("click", async () => {
    read();
    const s = specOf(form);
    if (!s.visual && !s.luz) return OBR.notification.show("Efeitos: escolha um visual ou ligue a luz.", "WARNING");
    const r = await playFx({ ...s, targets: sel, origem: "Efeitos" }).catch((e) => ({ error: e.message }));
    if (r.error) OBR.notification.show(`Efeitos: ${r.error}`, "WARNING");
  });
  g("fxsave")?.addEventListener("click", async () => {
    read();
    if (!form.visual && !form.luz) return OBR.notification.show("Efeitos: escolha um visual ou ligue a luz.", "WARNING");
    const e = { ...form, id: form.id || uid(), nome: (form.nome || form.visual || "Luz").slice(0, 40) };
    form = e;
    await saveLib(form.id && lib.some((x) => x.id === e.id) ? lib.map((x) => (x.id === e.id ? e : x)) : [...lib, e]);
    draw();
  });
  g("fxnew")?.addEventListener("click", () => { form = { ...VAZIO }; draw(); });
  g("fxall")?.addEventListener("click", async () => { await endAtivos(() => true); await endLuz(""); });
  for (const b of host.querySelectorAll("[data-bib-arm]")) b.addEventListener("click", () => { const e = lib.find((x) => x.id === b.dataset.bibArm); if (e) arm(specOf(e), false); });
  for (const b of host.querySelectorAll("[data-bib-edit]")) b.addEventListener("click", () => { const e = lib.find((x) => x.id === b.dataset.bibEdit); if (e) { form = { ...VAZIO, ...e }; draw(); } });
  for (const b of host.querySelectorAll("[data-bib-del]")) b.addEventListener("click", async () => { await saveLib(lib.filter((x) => x.id !== b.dataset.bibDel)); if (form.id === b.dataset.bibDel) form.id = ""; draw(); });
  for (const b of host.querySelectorAll("[data-fim]")) b.addEventListener("click", () => endAtivos((e) => e.id === b.dataset.fim));
  for (const b of host.querySelectorAll("[data-camada-at]")) b.addEventListener("click", () => { const e = ativos.find((x) => x.id === b.dataset.camadaAt); if (e) setAtivoCamada(e.id, e.v?.some((c) => c.y) ? "" : "sob"); });
}

/** Liga a página (chamada uma vez, só para o mestre). */
export async function setupEfeitos(el) {
  host = el;
  if (loaded) return;
  loaded = true;
  await loadMeus().catch(() => {});
  const md = await OBR.room.getMetadata();
  lib = Array.isArray(md[BIBLIOTECA]) ? md[BIBLIOTECA] : [];
  OBR.room.onMetadataChange((m) => { lib = Array.isArray(m[BIBLIOTECA]) ? m[BIBLIOTECA] : []; if (!busy()) draw(); });
  sel = (await OBR.player.getSelection()) || [];
  OBR.player.onChange((p) => {
    const ns = p.selection || [];
    const arm2 = p.metadata?.[FX_LIVRE] || null;
    const changed = JSON.stringify(ns) !== JSON.stringify(sel) || JSON.stringify(arm2) !== JSON.stringify(armedNow);
    sel = ns; armedNow = arm2;
    if (changed && !busy()) draw();
  });
  if (await OBR.scene.isReady()) { ativos = listOf(await OBR.scene.getMetadata()); }
  OBR.scene.onMetadataChange((m) => { ativos = listOf(m); if (!busy()) draw(); });
  draw();
}
const busy = () => ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName) && host?.contains(document.activeElement);
