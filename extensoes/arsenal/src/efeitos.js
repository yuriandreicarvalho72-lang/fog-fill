// Página "Efeitos" do painel: solta um efeito (VFX + luz colorida) em qualquer ponto do mapa ou num token, sem precisar de NPC,
// e guarda efeitos recorrentes numa biblioteca (metadado da sala). Só o mestre.
import OBR from "@owlbear-rodeo/sdk";
import { visualGroups, previewFile, LUZ_ANIMS, normLuz, duracaoText, TIPOS_PROPRIOS, GIROS, giroOf } from "./abil.js";
import { loadMeus, videoSrc, probeVideo } from "./meus.js";
import { playFx, BIBLIOTECA, colocarMarcador, marcadoresOf, soltarMarcador } from "./hab-ops.js";
import { endByTag, listOf, endAtivos, setAtivoCamada } from "./ativos.js";
import { endLuz } from "./luz.js";
import { uid } from "./shared.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const MAX_BIB = 40;
const VAZIO = { id: "", nome: "", visual: "explosao_fogo", tamanho: 0, dur: "", camada: "", luz: null, video: null };

let form = { ...VAZIO };
let lib = [];
let host = null;
let sel = [];
let loaded = false;
let ativos = [];
let marcas = [];
let manter = false; // "manter o marcador": guardado fora do HTML, que é redesenhado a cada mudança
let linkNote = "";

const durOf = (f) => (f.dur === "" ? 0 : f.dur === "fim" ? "fim" : Number(f.dur) || 0);
export const specOf = (f) => ({ visual: f.visual || "", tamanho: Number(f.tamanho) > 0 ? Number(f.tamanho) : 0, dur: durOf(f), camada: f.camada === "sob" ? "sob" : "", luz: f.luz ? normLuz(f.luz) : null, tag: f.nome || f.visual || (f.video?.url ? "Vídeo" : "Efeito"), ...(f.video?.url ? { video: { url: f.video.url, tipo: f.video.tipo, giro: giroOf(f.video.giro) } } : {}) });

async function saveLib(next) {
  lib = next.slice(-MAX_BIB);
  await OBR.room.setMetadata({ [BIBLIOTECA]: lib });
}
const cardOf = (e) => `<div class="mrow"><span class="mname" title="${esc(e.visual)}">${esc(e.nome || e.visual)} <small>· ${esc(e.video?.url ? "link próprio" : e.visual || "só luz")}${e.luz ? " · 💡" : ""}${e.dur ? ` · ⏱ ${esc(duracaoText(e.dur))}` : ""}</small></span>
  <button type="button" class="mini" data-bib-arm="${e.id}" title="Pôr um marcador no mapa para soltar este efeito">🎯</button>
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
    ${form.video?.url ? `<div class="linkbox"><small>Vídeo próprio (${esc(TIPOS_PROPRIOS.find(([k]) => k === form.video.tipo)?.[1] || form.video.tipo)}): <a href="${esc(form.video.url)}" target="_blank" rel="noopener">${esc(form.video.url.split("/").pop())}</a> — vence o visual da lista.</small><video class="fxprev" src="${esc(form.video.url)}" autoplay loop muted playsinline></video><div class="btns"><button type="button" class="danger" id="fxlinkdel">Tirar link</button></div></div>` : ""}
    <details class="linkform"${linkNote ? " open" : ""}><summary>Usar um vídeo próprio (link)</summary>
      <input type="text" id="fxlinkurl" placeholder="https://…/meu-efeito.webm" value="${esc(form.video?.url || "")}">
      <div class="row"><select id="fxlinktipo">${TIPOS_PROPRIOS.map(([k, t]) => `<option value="${k}"${(form.video?.tipo || "area") === k ? " selected" : ""}>${t}</option>`).join("")}</select><button type="button" class="primary" id="fxlinkset">Usar link</button></div>
      <div class="row"><span class="hint">O vídeo aponta para:</span><select id="fxlinkgiro">${GIROS.map(([g, t]) => `<option value="${g}"${(form.video?.giro || 0) === g ? " selected" : ""}>${t}</option>`).join("")}</select></div>
      <small>Link direto para um .webm (de preferência com fundo transparente). O tipo diz como ele é posto no mapa: "área" e "no alvo" ficam no ponto; "projétil", "linha" e "cone" saem do ponto numa direção.</small>
    </details>${linkNote ? `<small class="${/^Não|Cole/.test(linkNote) ? "why" : ""}">${esc(linkNote)}</small>` : ""}
    ${pf && !form.video?.url ? `<video class="fxprev" src="${esc(videoSrc(pf))}" autoplay loop muted playsinline></video>` : ""}
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
      <button type="button" class="primary" id="fxarm" title="Põe um marcador no centro da tela: arraste até o ponto e solte">🎯 Soltar no mapa</button>
 <button type="button" id="fxcenter" title="Solta no centro do que você está vendo">No centro da tela</button>
      <button type="button" id="fxsel" ${sel.length ? "" : "disabled"} title="Solta em cima dos tokens selecionados">Nos selecionados (${sel.length})</button>
    </div>
    <label class="check"><input type="checkbox" id="fxrep" ${manter ? "checked" : ""}> Manter o marcador depois de soltar (para repetir)</label>
    <div class="btns"><button type="button" id="fxsave">💾 ${form.id ? "Atualizar" : "Guardar"} na biblioteca</button>${form.id ? `<button type="button" id="fxnew">Novo</button>` : ""}</div>
    <small>"Soltar no mapa" põe um marcador 🎯 no centro da tela (só você vê). Arraste-o até o ponto e use Soltar aqui, ou botão direito no marcador → "Soltar efeito aqui".</small>
  </div>
  ${marcas.length ? `<h3>Marcadores no mapa (${marcas.length})</h3><div class="mlist">${marcas.map((m) => `<div class="mrow"><span class="mname">${esc(m.name || "Efeito")}</span>
    <button type="button" class="mini" data-mk-ver="${m.id}" title="Selecionar e mostrar o marcador">👁</button>
    <button type="button" class="mini primary" data-mk-solta="${m.id}" title="Soltar o efeito onde o marcador está">▶ Soltar aqui</button>
    <button type="button" class="mini danger" data-mk-del="${m.id}" title="Apagar o marcador">✕</button></div>`).join("")}</div>` : ""}
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

async function refreshMarcas() { marcas = marcadoresOf(await OBR.scene.items.getItems().catch(() => [])); draw(); }
const temEfeito = (sp) => sp.visual || sp.luz || sp.video;
async function arm(spec, repetir) {
  if (!temEfeito(spec)) return OBR.notification.show("Efeitos: escolha um visual, um link ou ligue a luz.", "WARNING");
  try { await colocarMarcador(spec, repetir); await refreshMarcas(); }
  catch (e) { OBR.notification.show(`Efeitos: não consegui criar o marcador (${e.message}).`, "WARNING"); console.warn("[arsenal] marcador", e); }
}

function bind() {
  const g = (id) => host.querySelector("#" + id);
  for (const id of ["fxvis", "fxdur", "fxsob", "fxluz", "lzfim"]) g(id)?.addEventListener("change", () => { read(); draw(); });
  for (const id of ["fxnome", "fxtam", "fxsec", "lzcor", "lzanim", "lzraio", "lzint", "lzdur", "lzfade"]) g(id)?.addEventListener("change", read);
  g("fxrep")?.addEventListener("change", () => { manter = g("fxrep").checked; });
  g("fxarm")?.addEventListener("click", () => { read(); arm(specOf(form), manter); });
  g("fxcenter")?.addEventListener("click", async () => {
    read();
    const s = specOf(form);
    if (!temEfeito(s)) return OBR.notification.show("Efeitos: escolha um visual, um link ou ligue a luz.", "WARNING");
    const [pos, sc, w, h] = await Promise.all([OBR.viewport.getPosition(), OBR.viewport.getScale(), OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    const r = await playFx({ ...s, point: { x: (w / 2 - pos.x) / sc, y: (h / 2 - pos.y) / sc }, origem: "Efeitos" }).catch((e) => ({ error: e.message }));
    if (r.error) OBR.notification.show(`Efeitos: ${r.error}`, "WARNING");
  });
  g("fxsel")?.addEventListener("click", async () => {
    read();
    const s = specOf(form);
    if (!temEfeito(s)) return OBR.notification.show("Efeitos: escolha um visual, um link ou ligue a luz.", "WARNING");
    const r = await playFx({ ...s, targets: sel, origem: "Efeitos" }).catch((e) => ({ error: e.message }));
    if (r.error) OBR.notification.show(`Efeitos: ${r.error}`, "WARNING");
  });
  g("fxsave")?.addEventListener("click", async () => {
    read();
    if (!form.visual && !form.luz && !form.video?.url) return OBR.notification.show("Efeitos: escolha um visual, um link ou ligue a luz.", "WARNING");
    const e = { ...form, id: form.id || uid(), nome: (form.nome || form.visual || (form.video?.url ? "Vídeo próprio" : "Luz")).slice(0, 40) };
    form = e;
    await saveLib(form.id && lib.some((x) => x.id === e.id) ? lib.map((x) => (x.id === e.id ? e : x)) : [...lib, e]);
    draw();
  });
  g("fxlinkset")?.addEventListener("click", async () => {
    read();
    const u = g("fxlinkurl")?.value.trim() || "";
    const tipo = g("fxlinktipo")?.value || "area";
    const giro = giroOf(g("fxlinkgiro")?.value || 0);
    if (!/^https?:\/\//i.test(u)) { linkNote = "Cole um link que comece com http:// ou https://"; return draw(); }
    linkNote = "Conferindo o vídeo…"; draw();
    try {
      const m = await probeVideo(u);
      form.video = { url: u, tipo, giro };
      linkNote = `Link guardado (${m.w}×${m.h}, ${(m.dur / 1000).toFixed(1).replace(".", ",")} s).`;
    } catch (e) { linkNote = `Não guardei: ${e.message}.`; }
    draw();
  });
  g("fxlinkdel")?.addEventListener("click", () => { form.video = null; linkNote = ""; draw(); });
  g("fxlinkgiro")?.addEventListener("change", () => { if (form.video) form.video.giro = giroOf(g("fxlinkgiro").value); });
  g("fxnew")?.addEventListener("click", () => { form = { ...VAZIO }; draw(); });
  g("fxall")?.addEventListener("click", async () => { await endAtivos(() => true); await endLuz(""); });
  for (const b of host.querySelectorAll("[data-bib-arm]")) b.addEventListener("click", () => { const e = lib.find((x) => x.id === b.dataset.bibArm); if (e) arm(specOf(e), manter); });
  for (const b of host.querySelectorAll("[data-bib-edit]")) b.addEventListener("click", () => { const e = lib.find((x) => x.id === b.dataset.bibEdit); if (e) { form = { ...VAZIO, ...e }; draw(); } });
  for (const b of host.querySelectorAll("[data-bib-del]")) b.addEventListener("click", async () => { await saveLib(lib.filter((x) => x.id !== b.dataset.bibDel)); if (form.id === b.dataset.bibDel) form.id = ""; draw(); });
  for (const b of host.querySelectorAll("[data-mk-ver]")) b.addEventListener("click", async () => { await OBR.player.select([b.dataset.mkVer]); const m = marcas.find((x) => x.id === b.dataset.mkVer); if (m) OBR.viewport.animateTo({ position: { x: -m.position.x * (await OBR.viewport.getScale()) + (await OBR.viewport.getWidth()) / 2, y: -m.position.y * (await OBR.viewport.getScale()) + (await OBR.viewport.getHeight()) / 2 }, scale: await OBR.viewport.getScale() }).catch(() => {}); });
  for (const b of host.querySelectorAll("[data-mk-solta]")) b.addEventListener("click", async () => { const r = await soltarMarcador(b.dataset.mkSolta); if (r.error) OBR.notification.show(`Efeitos: ${r.error}`, "WARNING"); refreshMarcas(); });
  for (const b of host.querySelectorAll("[data-mk-del]")) b.addEventListener("click", async () => { await OBR.scene.items.deleteItems([b.dataset.mkDel]).catch(() => {}); refreshMarcas(); });
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
    const changed = JSON.stringify(ns) !== JSON.stringify(sel);
    sel = ns;
    if (changed && !busy()) draw();
  });
  if (await OBR.scene.isReady()) { ativos = listOf(await OBR.scene.getMetadata()); marcas = marcadoresOf(await OBR.scene.items.getItems()); }
  OBR.scene.items.onChange((its) => { const n = marcadoresOf(its); if (JSON.stringify(n.map((m) => [m.id, m.name])) !== JSON.stringify(marcas.map((m) => [m.id, m.name]))) { marcas = n; if (!busy()) draw(); } else marcas = n; });
  OBR.scene.onMetadataChange((m) => { ativos = listOf(m); if (!busy()) draw(); });
  draw();
}
const busy = () => ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName) && host?.contains(document.activeElement);
