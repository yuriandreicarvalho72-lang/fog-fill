// Painel das Habilidades (ícone próprio na barra; só o mestre): dossiê do NPC, mira e contadores.
// Não rola dados: mostra os números da ficha e quem ficou na área.
import OBR from "@owlbear-rodeo/sdk";
import { SECOES, VISUAIS, canUse, numbers, shapeText, isRecharge, isPerRest, legCost, recharge, newRound, rest, visualGroups, previewFile } from "./abil.js";
import { HAB_AIM, HAB_LAST, getAim, setAim, saveDossie, removeDossie, setUso, setVisualOn, dossieOf, usoOf, useAbility } from "./hab-ops.js";
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
const typing = () => ["TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
const GROUPS = visualGroups();
const video = (vis) => { const f = previewFile(vis); return f ? `<video src="${esc(url(`jb2a/${f}`))}" autoplay loop muted playsinline></video>` : ""; };

/** Lista dos visuais (vídeos JB2A) que o dossiê aceita, com prévia. */
function listHtml() {
  return `<details id="lista"${listOpen ? " open" : ""}><summary>Visuais disponíveis (${VISUAIS.length})</summary>
    <p class="hint">Clique num nome para ver a prévia. Com o 🎨 de uma habilidade aberto, o clique troca o visual dela. São os nomes do campo <b>visual</b> do dossiê.</p>
    ${preview ? `<div class="prev"><b>${esc(preview)}</b>${video(preview)}</div>` : ""}
    ${GROUPS.map(([t, l]) => `<h4>${esc(t)}</h4><div class="chips">${l.map((v) => `<button type="button" class="chip${v === preview ? " on" : ""}" data-prev="${v}">${v}</button>`).join("")}</div>`).join("")}
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
    box.innerHTML = `${chips}<p class="hint">Selecione o token de um NPC (ou botão direito nele → <b>Habilidades (dossiê)</b>) e cole o dossiê da ficha.</p>`;
    bindChips();
    return;
  }
  const d = dossieOf(tok);
  if (!d) {
    box.innerHTML = `${chips}<h2>${esc(itemName(tok))}</h2>
      <p class="hint">Cole aqui o dossiê da ficha (o bloco <b>json</b> da PARTE 2 do prompt). Pode colar o bloco inteiro, com as crases.</p>
      <textarea id="raw" rows="8" placeholder='{ "dossie": 1, "nome": ... }'></textarea>
      <div class="btns"><button type="button" class="primary" id="save">Guardar no token</button></div>
      ${note ? `<p class="hint warn">${esc(note)}</p>` : ""}
      ${listHtml()}`;
    bindChips();
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
  box.innerHTML = `${chips}
    <div class="row"><h2 class="grow">${esc(d.nome)}</h2><span class="tag">ND ${esc(d.nd ?? "?")} · CA ${esc(d.ca ?? "?")} · PV ${esc(d.pv ?? "?")}</span></div>
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
  bindList(tok);
  for (const b of box.querySelectorAll("[data-vis]")) b.addEventListener("click", () => {
    const k = `${tok.id}\n${b.dataset.vis}`;
    editing = editing === k ? "" : k;
    render();
  });
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

function row(h, d, uso, tok) {
  const can = canUse(h, uso, d);
  const armed = aim.armed && aim.nome === h.nome && aim.token === tok.id;
  const n = h.faz?.length ? `faz: ${h.faz.join(" + ")}` : numbers(h);
  const cost = h.secao === "lendaria" && legCost(h) > 1 ? ` · custa ${legCost(h)}` : "";
  const use = (isRecharge(h) || isPerRest(h)) ? `<span class="tag${can.ok ? "" : " broken"}">${esc(h.uso)}</span>` : "";
  const back = !can.ok && isRecharge(h) ? `<button type="button" class="mini" data-rc="${esc(h.nome)}" title="Você rolou a recarga e ela voltou">↺ recarregou</button>` : "";
  const tgCount = (aim.targets || []).length;
  const max = h.faz?.length || h.alvos || 1;
  const armedBox = armed ? `<div class="armed">${esc(HINT[h.forma] || "")}${h.forma === "alvo" ? ` (${tgCount}/${max})` : aim.point ? " ✓" : ""}
      <div class="btns"><button type="button" class="primary" id="fire">✔ Usar (Enter)</button><button type="button" id="cancel">✕</button></div></div>` : "";
  const open = editing === `${tok.id}\n${h.nome}`;
  const visEdit = open ? `<div class="visedit"><select data-visset="${esc(h.nome)}"><option value="">(sem vídeo)</option>${GROUPS.map(([t, l]) => `<optgroup label="${esc(t)}">${l.map((v) => `<option value="${v}"${v === h.visual ? " selected" : ""}>${v}</option>`).join("")}</optgroup>`).join("")}</select>${h.visual ? video(h.visual) : ""}</div>` : "";
  return `<div class="ab${armed ? " on" : ""}${can.ok ? "" : " off"}">
    <div class="row"><button type="button" class="mini go" data-go="${esc(h.nome)}" ${can.ok ? "" : "disabled"} title="${instant(h) ? "Usar agora" : "Mirar no mapa"}">${instant(h) ? "▶" : "🎯"}</button>
      <span class="grow name" title="${esc(h.texto || "")}">${esc(h.nome)}</span>${use}<span class="tag">${esc(shapeText(h) || "")}${cost}</span></div>
    ${n ? `<small>${esc(n)}</small>` : ""}${!can.ok ? `<small class="why">${esc(can.why)} ${back}</small>` : ""}
    ${h.faz?.length ? `<small>🎨 usa o visual de ${esc([...new Set(h.faz)].join(", "))}</small>` : `<div class="visrow"><button type="button" class="vis${open ? " on" : ""}" data-vis="${esc(h.nome)}" title="Trocar o visual (vídeo) desta habilidade">🎨 ${esc(h.visual || "sem vídeo")}</button></div>${visEdit}`}${armedBox}</div>`;
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
  const load = async () => {
    items = (await OBR.scene.items.getItems()).filter((i) => i.type === "IMAGE");
    sel = (await OBR.player.getSelection()) || [];
    const md = await OBR.player.getMetadata();
    aim = md[HAB_AIM] || {};
    last = md[HAB_LAST] || null;
    render();
  };
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
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
