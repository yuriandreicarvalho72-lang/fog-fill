import "./visibility.js";
// Painel das Habilidades (ícone próprio na barra; só o mestre): dossiê do NPC, mira e contadores.
// Não rola dados: mostra os números da ficha e quem ficou na área.
import OBR from "@owlbear-rodeo/sdk";
import { SECOES, VISUAIS, BLFX_LICENSE, TIPOS_PROPRIOS, GIROS, duracaoText, LUZ_ANIMS, normLuz, meusVisuais, canUse, numbers, shapeText, isRecharge, isPerRest, legCost, recharge, newRound, rest, visualGroups, previewFile } from "./abil.js";
import { HAB_AIM, HAB_LAST, getAim, setAim, saveDossie, removeDossie, setUso, setVisualOn, setVideoOn, setDuracaoOn, setCamadaOn, setLuzOn, dossieOf, usoOf, useAbility } from "./hab-ops.js";
import { listOf, endAtivos } from "./ativos.js";
import { loadMeus, probeVideo, videoSrc } from "./meus.js";
import { itemName, isToken, applyTheme, url } from "./shared.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let items = [];
let sel = [];
let aim = {};
let last = null;
let note = ""; // avisos do último dossiê colado
let editing = "";  // "<token>\n<habilidade>" com o seletor de visual aberto
let preview = "";  // visual mostrado na prévia da lista
let listOpen = false;
const typing = () => ["TEXTAREA", "SELECT", "INPUT"].includes(document.activeElement?.tagName);
let GROUPS = visualGroups(); // refeito quando a lista de efeitos próprios chega
const videoTag = (src) => `<video src="${esc(src)}" autoplay loop muted playsinline></video>`;
const video = (vis) => { const f = previewFile(vis); return f ? videoTag(videoSrc(f)) : ""; };
let linkNote = ""; // resultado da última checagem de link
let ativos = [];   // efeitos que ficaram no mapa (metadado da cena)

const leftText = (e) => (e.until ? `${Math.max(0, Math.ceil((e.until - Date.now()) / 1000))} s` : "até encerrar");
/** Efeitos que ficaram no mapa, com ✕ para encerrar. */
function ativosHtml() {
  if (!ativos.length) return "";
  return `<div class="ativos"><div class="row"><h3 class="grow">Efeitos no mapa (${ativos.length})</h3><button type="button" class="mini danger" id="endall">Encerrar todos</button></div>
    <div class="mlist">${ativos.map((e) => `<div class="mrow"><span class="mname" title="${esc(e.nome)}">${esc(e.nome)}${e.by ? ` <small>· ${esc(e.by)}</small>` : ""}</span><span class="tag" data-left="${e.id}">${leftText(e)}</span><button type="button" class="mini" data-end="${e.id}" title="Encerrar este efeito">✕</button></div>`).join("")}</div></div>`;
}
function bindAtivos() {
  $("endall")?.addEventListener("click", () => endAtivos(() => true));
  for (const b of document.querySelectorAll("[data-end]")) b.addEventListener("click", () => endAtivos((e) => e.id === b.dataset.end));
}
/** Duração do efeito: uma vez, por N segundos ou até encerrar. */
function durHtml(h) {
  const d = h.duracao;
  const mode = !d ? "" : d === "fim" ? "fim" : "s";
  return `<div class="row durrow"><span class="hint">Duração:</span><select data-durmode="${esc(h.nome)}">
      <option value=""${mode === "" ? " selected" : ""}>uma vez</option><option value="s"${mode === "s" ? " selected" : ""}>por segundos (em loop)</option><option value="fim"${mode === "fim" ? " selected" : ""}>em loop até eu encerrar</option></select>
      ${mode === "s" ? `<input type="number" data-dursec="${esc(h.nome)}" min="1" max="3600" step="1" value="${d}"> s` : ""}</div>`;
}

/** Lista dos visuais (vídeos JB2A) que o dossiê aceita, com prévia. */
function listHtml() {
  return `<details id="lista"${listOpen ? " open" : ""}><summary>Visuais disponíveis (${VISUAIS.length + meusVisuais().length})</summary>
    <p class="hint">Clique num nome para ver a prévia. Com o 🎨 de uma habilidade aberto, o clique troca o visual dela. São os nomes do campo <b>visual</b> do dossiê.</p>
    ${preview ? `<div class="prev"><b>${esc(preview)}</b>${video(preview)}</div>` : ""}
    ${GROUPS.map(([t, l]) => `<h4>${esc(t)}</h4><div class="chips">${l.map((v) => `<button type="button" class="chip${v === preview ? " on" : ""}" data-prev="${v}">${v}</button>`).join("")}</div>`).join("")}
    ${meusVisuais().length ? "" : `<p class="hint">Efeitos próprios: coloque arquivos .webm no GitHub em <b>extensoes/arsenal/public/meus-efeitos/&lt;tipo&gt;/</b> (tipos: alvo, area, em-si, projetil, linha, cone). Eles aparecem aqui como <b>meu_nome</b>. Ou use um link direto no 🎨 de uma habilidade.</p>`}
    <p class="credit">Animações: JB2A (jb2a.com), <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a> · Boss Loot FX Assets, Boss Loot Team (<a href="${esc(BLFX_LICENSE)}" target="_blank" rel="noopener">licença</a>)</p>
  </details>`;
}
function bindList(tok) {
  $("lista")?.addEventListener("toggle", (e) => { listOpen = e.target.open; });
  for (const b of document.querySelectorAll("[data-prev]")) b.addEventListener("click", async () => {
    preview = b.dataset.prev;
    const [tid, nome] = editing.split("\n");
    if (tok && tid === tok.id && nome) await setVisualOn(tok.id, nome, preview);
    render();
  });
}
const HINT = {
  alvo: "Clique no(s) alvo(s) no mapa",
  cone: "Clique no mapa para apontar o cone",
  linha: "Clique no mapa para apontar a linha",
  area: "Clique no ponto do centro da área",
  movimento: "Clique no destino",
};
const instant = (h) => h.forma === "si" || h.forma === "aura" || h.secao === "passiva" || (h.forma === "area" && !h.alcance);

function current() {
  const id = aim.token || sel.find((s) => items.find((i) => i.id === s && i.type === "IMAGE"));
  return items.find((i) => i.id === id) || null;
}

function render() {
  if (typing()) return;
  const tok = current();
  const box = $("hab");
  const npcs = items.filter((i) => dossieOf(i));
  const chips = npcs.length ? `<div class="chips">${npcs.map((n) => `<button type="button" class="chip${n.id === tok?.id ? " on" : ""}" data-tok="${n.id}">${esc(itemName(n))}</button>`).join("")}</div>` : "";
  if (!tok) {
    box.innerHTML = `${ativosHtml()}${chips}<p class="hint">Selecione o token de um NPC (ou botão direito nele → <b>Habilidades (dossiê)</b>) e cole o dossiê da ficha.</p>`;
    bindChips();
    bindAtivos();
    return;
  }
  const d = dossieOf(tok);
  if (!d) {
    box.innerHTML = `${ativosHtml()}${chips}<h2>${esc(itemName(tok))}</h2>
      <p class="hint">Cole aqui o dossiê da ficha (o bloco <b>json</b> da PARTE 2 do prompt). Pode colar o bloco inteiro, com as crases.</p>
      <textarea id="raw" rows="8" placeholder='{ "dossie": 1, "nome": ... }'></textarea>
      <div class="btns"><button type="button" class="primary" id="save">Guardar no token</button></div>
      ${note ? `<p class="hint warn">${esc(note)}</p>` : ""}
      ${listHtml()}`;
    bindChips();
    bindAtivos();
    bindList(null);
    $("save").addEventListener("click", () => doSave(tok.id));
    return;
  }
  const uso = usoOf(tok);
  const legLeft = (d.lendarias || 0) - (uso.leg || 0);
  const rows = SECOES.map(([sec, title]) => {
    const list = d.habilidades.filter((h) => h.secao === sec);
    if (!list.length) return "";
    const head = sec === "lendaria" ? `${title} <span class="tag">${legLeft}/${d.lendarias} nesta rodada</span>` : sec === "covil" ? `${title} <span class="tag">iniciativa 20</span>` : title;
    return `<h3>${head}</h3>${list.map((h) => row(h, d, uso, tok)).join("")}`;
  }).join("");
  const lastBox = last && last.by === itemName(tok) ? `<div class="last"><b>${esc(last.nome)}</b>${last.forma !== "si" && last.forma !== "movimento" ? ` — ${last.caught?.length ? `pegou <b>${esc(last.caught.join(", "))}</b>` : "ninguém na área"}` : ""}${last.text ? `<small>${esc(last.text)}</small>` : ""}</div>` : "";
  box.innerHTML = `${ativosHtml()}${chips}
    <div class="row"><h2 class="grow">${esc(d.nome)}</h2><div class="stats"><span><b>${esc(d.nd ?? "?")}</b>ND</span><span><b>${esc(d.ca ?? "?")}</b>CA</span><span><b>${esc(d.pv ?? "?")}</b>PV</span></div></div>
    <div class="btns"><button type="button" id="round" title="Devolve as ações lendárias">↻ Nova rodada</button><button type="button" id="rest" title="Devolve recargas, 1/descanso e lendárias">☾ Descanso</button></div>
    ${lastBox}
    ${rows}
    <details><summary>Dossiê</summary>
      <textarea id="raw" rows="6" placeholder="Cole um dossiê novo para trocar"></textarea>
      <div class="btns"><button type="button" id="save">Trocar dossiê</button><button type="button" class="danger" id="del">Tirar dossiê</button></div>
      ${note ? `<p class="hint warn">${esc(note)}</p>` : ""}
    </details>
    ${listHtml()}
    <small class="keys">Você rola os dados: o painel mostra os números da ficha e quem ficou na área.</small>`;
  bindChips();
  bindAtivos();
  bindList(tok);
  for (const s of box.querySelectorAll("[data-durmode]")) s.addEventListener("change", async () => {
    const v = s.value;
    s.blur();
    await setDuracaoOn(tok.id, s.dataset.durmode, v === "s" ? 10 : v || null);
  });
  for (const n of box.querySelectorAll("[data-dursec]")) n.addEventListener("change", async () => {
    const v = Number(n.value);
    n.blur();
    await setDuracaoOn(tok.id, n.dataset.dursec, v > 0 ? v : 10);
  });
  for (const c of box.querySelectorAll("[data-camada]")) c.addEventListener("change", () => setCamadaOn(tok.id, c.dataset.camada, c.checked ? "sob" : ""));
  const luzOf = (nome) => d.habilidades.find((x) => x.nome === nome)?.luz;
  for (const c of box.querySelectorAll("[data-luzon]")) c.addEventListener("change", () => setLuzOn(tok.id, c.dataset.luzon, c.checked ? { cor: "#ff8a1f", raio: 6, intens: 0.7, dur: 1.5, fade: 0.8 } : null));
  const luzSet = (nome, patch) => { const l = luzOf(nome); if (l) setLuzOn(tok.id, nome, { ...l, ...patch }); };
  for (const el of box.querySelectorAll("[data-luz]")) el.addEventListener("change", () => {
    const [nome, k] = el.dataset.luz.split(/:(?=[^:]*$)/);
    const l = luzOf(nome); if (!l) return;
    if (k === "fim") luzSet(nome, { dur: el.checked ? "fim" : 10 });
    else if (k === "origem") luzSet(nome, { onde: el.checked ? "origem" : "alvo" });
    else if (k === "cor" || k === "anim") luzSet(nome, { [k]: el.value });
    else luzSet(nome, { [k]: Number(el.value) });
  });
  for (const b of box.querySelectorAll("[data-luzcor]")) b.addEventListener("click", () => { const [nome, c] = b.dataset.luzcor.split(/:(?=[^:]*$)/); luzSet(nome, { cor: c }); });
  for (const s of box.querySelectorAll("[data-giro]")) s.addEventListener("change", async () => {
    const h = d.habilidades.find((x) => x.nome === s.dataset.giro);
    s.blur();
    if (h?.video?.url) await setVideoOn(tok.id, h.nome, { ...h.video, giro: Number(s.value) });
  });
  for (const b of box.querySelectorAll("[data-vis]")) b.addEventListener("click", () => {
    const k = `${tok.id}\n${b.dataset.vis}`;
    editing = editing === k ? "" : k;
    linkNote = "";
    render();
  });
  for (const b of box.querySelectorAll("[data-linkset]")) b.addEventListener("click", async () => {
    const nome = b.dataset.linkset;
    const u = $("linkurl")?.value.trim() || "";
    const tipo = $("linktipo")?.value || "area";
    if (!/^https?:\/\//i.test(u)) { linkNote = "Cole um link que comece com http:// ou https://"; render(); return; }
    linkNote = "Conferindo o vídeo…"; b.blur(); render();
    try {
      const m = await probeVideo(u);
      await setVideoOn(tok.id, nome, { url: u, tipo, giro: Number($("linkgiro")?.value || 0) });
      linkNote = `Link guardado (${m.w}×${m.h}, ${(m.dur / 1000).toFixed(1).replace(".", ",")} s).`;
    } catch (e) { linkNote = `Não guardei: ${e.message}.`; }
    render();
  });
  for (const b of box.querySelectorAll("[data-linkdel]")) b.addEventListener("click", async () => { linkNote = ""; await setVideoOn(tok.id, b.dataset.linkdel, null); });
  for (const s of box.querySelectorAll("[data-visset]")) s.addEventListener("change", async () => {
    const v = s.value;
    s.blur();
    if (v) preview = v;
    await setVisualOn(tok.id, s.dataset.visset, v);
  });
  $("round").addEventListener("click", () => setUso(tok.id, newRound));
  $("rest").addEventListener("click", () => setUso(tok.id, rest));
  $("save").addEventListener("click", () => doSave(tok.id));
  $("del").addEventListener("click", async () => { await removeDossie(tok.id); note = ""; });
  for (const b of box.querySelectorAll("[data-go]")) b.addEventListener("click", () => go(tok, d.habilidades.find((h) => h.nome === b.dataset.go)));
  for (const b of box.querySelectorAll("[data-rc]")) b.addEventListener("click", () => setUso(tok.id, (u) => recharge(d.habilidades.find((h) => h.nome === b.dataset.rc), u)));
  $("fire")?.addEventListener("click", fire);
  $("cancel")?.addEventListener("click", () => setAim({ token: tok.id }, true));
}

const SHAPE_ICON = { alvo: "◎", cone: "◢", linha: "━", area: "◉", aura: "◌", si: "◍", movimento: "➜" };
/** Números da ficha como etiquetas (ataque, resistência, dano, cura, condição). */
function chips(h) {
  const c = [];
  if (h.ataque != null) c.push(`<i class="atk">⚔ ${h.ataque >= 0 ? "+" : ""}${h.ataque}</i>`);
  if (h.resistencia) c.push(`<i class="sv">🛡 ${esc(h.resistencia)}${h.metade ? " ½" : ""}</i>`);
  if (h.dano) c.push(`<i class="dmg">💥 ${esc(h.dano)}</i>`);
  if (h.cura) c.push(`<i class="heal">✚ ${esc(h.cura)}</i>`);
  if (h.condicao) c.push(`<i class="cond">${esc(h.condicao)}</i>`);
  if (h.luz) c.push(`<i class="luz" style="--lz:${esc(h.luz.cor)}">💡 luz</i>`);
  if (h.camada === "sob") c.push(`<i class="sob">▾ sob tokens</i>`);
  return c.length ? `<div class="chipsrow">${c.join("")}</div>` : "";
}
function luzHtml(h) {
  const l = h.luz;
  const cores = ["#ff8a1f", "#e0453a", "#f5d742", "#7bd23a", "#35e0ff", "#4fa8ff", "#a36bff", "#ffffff"];
  return `<div class="luzbox"><label class="check"><input type="checkbox" data-luzon="${esc(h.nome)}" ${l ? "checked" : ""}> 💡 Acende uma luz colorida (Luz Colorida)</label>
    ${l ? `<div class="row"><input type="color" data-luz="${esc(h.nome)}:cor" value="${esc(l.cor)}"><select data-luz="${esc(h.nome)}:anim">${LUZ_ANIMS.map(([k, t]) => `<option value="${k}"${(l.anim || "none") === k ? " selected" : ""}>${t}</option>`).join("")}</select></div>
    <div class="row"><span class="hint">Raio</span><input type="number" data-luz="${esc(h.nome)}:raio" min="0.5" max="60" step="0.5" value="${l.raio}"> m <span class="hint">Brilho</span><input type="number" data-luz="${esc(h.nome)}:intens" min="0.1" max="1" step="0.1" value="${l.intens}"></div>
    <div class="row"><span class="hint">Dura</span><input type="number" data-luz="${esc(h.nome)}:dur" min="0.2" max="3600" step="0.5" value="${l.dur === "fim" ? 10 : l.dur}"> s <label class="check"><input type="checkbox" data-luz="${esc(h.nome)}:fim" ${l.dur === "fim" ? "checked" : ""}> até encerrar</label></div>
    <div class="row"><span class="hint">Apaga em</span><input type="number" data-luz="${esc(h.nome)}:fade" min="0" max="30" step="0.2" value="${l.fade}"> s <label class="check"><input type="checkbox" data-luz="${esc(h.nome)}:origem" ${l.onde === "origem" ? "checked" : ""}> sai de quem usa</label></div>
    <div class="chips">${cores.map((c) => `<button type="button" class="sw" style="background:${c}" data-luzcor="${esc(h.nome)}:${c}" title="${c}"></button>`).join("")}</div>
    <small>Explosão: duração curta e apagar em 1 s. Giroflex ou tocha: fica até encerrar.</small>` : ""}</div>`;
}
function row(h, d, uso, tok) {
  const can = canUse(h, uso, d);
  const armed = aim.armed && aim.nome === h.nome && aim.token === tok.id;
  const n = h.faz?.length ? `faz: ${h.faz.join(" + ")}` : "";
  const cost = h.secao === "lendaria" && legCost(h) > 1 ? ` · custa ${legCost(h)}` : "";
  const use = (isRecharge(h) || isPerRest(h)) ? `<span class="tag${can.ok ? "" : " broken"}">${esc(h.uso)}</span>` : "";
  const back = !can.ok && isRecharge(h) ? `<button type="button" class="mini" data-rc="${esc(h.nome)}" title="Você rolou a recarga e ela voltou">↺ recarregou</button>` : "";
  const tgCount = (aim.targets || []).length;
  const max = h.faz?.length || h.alvos || 1;
  const armedBox = armed ? `<div class="armed">${esc(HINT[h.forma] || "")}${h.forma === "alvo" ? ` (${tgCount}/${max})` : aim.point ? " ✓" : ""}
      <div class="btns"><button type="button" class="primary" id="fire">✔ Usar (Enter)</button><button type="button" id="cancel">✕</button></div></div>` : "";
  const open = editing === `${tok.id}\n${h.nome}`;
  const link = h.video?.url ? `<div class="linkbox"><small>Vídeo próprio (${esc(TIPOS_PROPRIOS.find(([k]) => k === h.video.tipo)?.[1] || h.video.tipo)}): <a href="${esc(h.video.url)}" target="_blank" rel="noopener">${esc(h.video.url.split("/").pop())}</a> — ele vence o visual da lista.</small>${videoTag(h.video.url)}<div class="btns"><button type="button" class="danger" data-linkdel="${esc(h.nome)}">Tirar link</button></div></div>` : "";
  const visEdit = open ? `<div class="visedit">${link}<select data-visset="${esc(h.nome)}"><option value="">(sem vídeo)</option>${GROUPS.map(([t, l]) => `<optgroup label="${esc(t)}">${l.map((v) => `<option value="${v}"${v === h.visual ? " selected" : ""}>${v}</option>`).join("")}</optgroup>`).join("")}</select>${h.visual && !h.video?.url ? video(h.visual) : ""}
      ${durHtml(h)}
      <label class="check"><input type="checkbox" data-camada="${esc(h.nome)}" ${h.camada === "sob" ? "checked" : ""}> Desenhar por baixo dos tokens (névoa e área não escondem ninguém)</label>
      ${luzHtml(h)}
      <details class="linkform"><summary>Usar um vídeo próprio (link)</summary>
        <input type="text" id="linkurl" placeholder="https://…/meu-efeito.webm" value="${esc(h.video?.url || "")}">
        <div class="row"><select id="linktipo">${TIPOS_PROPRIOS.map(([k, t]) => `<option value="${k}"${(h.video?.tipo || "area") === k ? " selected" : ""}>${t}</option>`).join("")}</select><button type="button" class="primary" data-linkset="${esc(h.nome)}">Usar link</button></div>
        <div class="row"><span class="hint">O vídeo aponta para:</span><select id="linkgiro" ${h.video?.url ? `data-giro="${esc(h.nome)}"` : ""}>${GIROS.map(([g, t]) => `<option value="${g}"${(h.video?.giro || 0) === g ? " selected" : ""}>${t}</option>`).join("")}</select></div>
        <small>Link direto para um .webm (de preferência com fundo transparente). O tipo diz como ele é posto no mapa. "Aponta para" é para onde o efeito vai dentro do vídeo (cone, linha e projétil giram a partir disso).</small>
      </details>${linkNote ? `<small class="${/^Não|Cole/.test(linkNote) ? "why" : ""}">${esc(linkNote)}</small>` : ""}</div>` : "";
  return `<div class="ab${armed ? " on" : ""}${can.ok ? "" : " off"}">
    <div class="row"><button type="button" class="mini go" data-go="${esc(h.nome)}" ${can.ok ? "" : "disabled"} title="${instant(h) ? "Usar agora" : "Mirar no mapa"}">${instant(h) ? "▶" : "🎯"}</button>
      <span class="grow name" title="${esc(h.texto || "")}">${esc(h.nome)}</span>${use}<span class="tag">${SHAPE_ICON[h.forma] || ""} ${esc(shapeText(h) || "")}${cost}</span></div>
    ${n ? `<small>${esc(n)}</small>` : chips(h)}${!can.ok ? `<small class="why">${esc(can.why)} ${back}</small>` : ""}
    ${h.faz?.length ? `<small>🎨 usa o visual de ${esc([...new Set(h.faz)].join(", "))}</small>` : `<div class="visrow"><button type="button" class="vis${open ? " on" : ""}" data-vis="${esc(h.nome)}" title="Trocar o visual (vídeo) desta habilidade">🎨 ${esc(h.video?.url ? "link próprio" : h.visual || "sem vídeo")}${h.duracao ? ` · ⏱ ${esc(duracaoText(h.duracao))}` : ""}</button></div>${visEdit}`}${armedBox}</div>`;
}

function bindChips() {
  for (const b of document.querySelectorAll("[data-tok]")) b.addEventListener("click", () => { setAim({ token: b.dataset.tok }, true); OBR.player.select([b.dataset.tok], false); });
}

async function doSave(tokenId) {
  const raw = $("raw")?.value || "";
  try {
    const { dossie, avisos } = await saveDossie(tokenId, raw);
    note = avisos.length ? `Guardado com avisos: ${avisos.join(" · ")}` : "";
    OBR.notification.show(`Habilidades: dossiê de ${dossie.nome} guardado (${dossie.habilidades.length} habilidades).`, "SUCCESS");
    await setAim({ token: tokenId }, true);
  } catch (e) {
    note = `Não deu para ler o dossiê: ${e.message}`;
    $("raw").blur();
    render();
  }
}

async function go(tok, h) {
  if (!h) return;
  if (instant(h)) {
    const r = await useAbility(tok.id, h.nome, {});
    if (r.error) OBR.notification.show(`Habilidades: ${r.error}`, "WARNING");
    return;
  }
  await setAim({ token: tok.id, nome: h.nome, armed: true, targets: [], point: null }, true);
}

async function fire() {
  const a = await getAim();
  const r = await useAbility(a.token, a.nome, a);
  if (r.error) return OBR.notification.show(`Habilidades: ${r.error}`, "WARNING");
  await setAim({ token: a.token }, true);
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  loadMeus().then(() => { GROUPS = visualGroups(); render(); });
  const load = async () => {
    items = (await OBR.scene.items.getItems()).filter((i) => i.type === "IMAGE");
    sel = (await OBR.player.getSelection()) || [];
    const md = await OBR.player.getMetadata();
    aim = md[HAB_AIM] || {};
    last = md[HAB_LAST] || null;
    ativos = listOf(await OBR.scene.getMetadata());
    render();
  };
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  OBR.scene.onMetadataChange((md) => {
    const n = listOf(md);
    if (JSON.stringify(n) !== JSON.stringify(ativos)) { ativos = n; render(); }
  });
  // contagem regressiva dos efeitos com duração (só o texto, sem redesenhar o painel)
  setInterval(() => { for (const el of document.querySelectorAll("[data-left]")) { const e = ativos.find((x) => x.id === el.dataset.left); if (e) el.textContent = leftText(e); } }, 1000);
  let tm = null;
  OBR.scene.items.onChange((its) => { items = its.filter((i) => i.type === "IMAGE"); clearTimeout(tm); tm = setTimeout(render, 80); });
  OBR.player.onChange((p) => {
    const ns = p.selection || [];
    const na = p.metadata?.[HAB_AIM] || {};
    const nl = p.metadata?.[HAB_LAST] || null;
    const changed = JSON.stringify([ns, na, nl]) !== JSON.stringify([sel, aim, last]);
    sel = ns; aim = na; last = nl;
    // trocou de token selecionado sem habilidade armada: o painel segue a seleção
    if (!aim.armed && ns.length === 1 && ns[0] !== aim.token && items.some((i) => i.id === ns[0] && isToken(i))) { setAim({ token: ns[0] }, true); return; }
    if (changed) render();
  });
  document.addEventListener("keydown", (e) => {
    if (typing()) return;
    if (e.key === "Enter") fire();
    else if (e.key === "Escape") getAim().then((a) => setAim({ token: a.token }, true));
  });
});
