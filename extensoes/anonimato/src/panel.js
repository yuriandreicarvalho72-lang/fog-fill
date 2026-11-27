import "./visibility.js";
// Painel do Anonimato (só o mestre): configura o item selecionado e lista os itens anônimos da cena.
import OBR from "@owlbear-rodeo/sdk";
import { ANON, DEFAULT_CFG, MODOS, cfgOf, faceOf } from "./core.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let role = "PLAYER", sel = [], items = [];
const typing = () => ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName) && document.activeElement.type !== "checkbox";

/** Nome verdadeiro para mostrar: o guardado (anônimo) ou o atual. */
const realName = (it) => { const c = cfgOf(it); const f = c?.on && c.real ? c.real : faceOf(it); return (f.text || f.name || "item").trim() || "item"; };

async function load() {
  sel = (await OBR.player.getSelection()) || [];
  items = await OBR.scene.items.getItems();
  render();
}

const edit = (ids, fn) => OBR.scene.items.updateItems(ids, (d) => { for (const it of d) it.metadata[ANON] = fn({ ...DEFAULT_CFG, on: false, ...(it.metadata[ANON] || {}) }); });

function render() {
  if (role !== "GM") {
    $("sel").innerHTML = '<p class="hint">Só o mestre configura o anonimato.</p>';
    $("all").innerHTML = "";
    return;
  }
  const picked = items.filter((i) => sel.includes(i.id));
  const first = picked[0];
  if (!first) {
    $("sel").innerHTML = '<p class="hint">Selecione um ou mais itens no mapa (token, objeto, forma, texto…) para deixá-los anônimos.</p>';
  } else {
    const c = { ...DEFAULT_CFG, on: false, ...(cfgOf(first) || {}) };
    $("sel").innerHTML = `
      <div class="row"><b class="grow">${esc(realName(first))}</b>${picked.length > 1 ? `<span class="tag">+${picked.length - 1} selecionado(s)</span>` : ""}</div>
      <label class="check"><input type="checkbox" id="on" ${c.on ? "checked" : ""} /> Anônimo para os jogadores</label>
      <label>O que esconder<select id="modo">${MODOS.map(([v, l]) => `<option value="${v}" ${c.modo === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>Nome que os jogadores veem<input type="text" id="nome" value="${esc(c.nome)}" placeholder="???" /></label>
      ${c.modo === "imagem" ? `<label>Imagem que os jogadores veem<input type="text" id="imagem" value="${esc(c.imagem)}" placeholder="link da imagem (vazio = silhueta padrão)" /></label>
      <p class="hint">Imagem quadrada funciona melhor: ela ocupa o mesmo espaço do token.</p>` : ""}
      ${first.style ? `<label class="check"><input type="checkbox" id="esconder" ${c.esconder ? "checked" : ""} /> Esconder a forma (fica transparente; efeitos continuam; você vê um contorno tracejado)</label>` : ""}
      <label class="check"><input type="checkbox" id="trava" ${c.trava !== false ? "checked" : ""} /> Travar: vai para a camada de mapa e fica com cadeado (jogadores não selecionam nem mexem)</label>
      ${picked.length > 1 ? '<p class="hint">As mudanças valem para todos os selecionados.</p>' : ""}`;
    const ids = picked.map((i) => i.id);
    $("on").onchange = (e) => edit(ids, (x) => ({ ...x, on: e.target.checked }));
    $("modo").onchange = (e) => edit(ids, (x) => ({ ...x, modo: e.target.value }));
    $("nome").onchange = (e) => edit(ids, (x) => ({ ...x, nome: e.target.value }));
    $("imagem")?.addEventListener("change", (e) => edit(ids, (x) => ({ ...x, imagem: e.target.value.trim() })));
    $("esconder")?.addEventListener("change", (e) => edit(ids, (x) => ({ ...x, esconder: e.target.checked })));
    $("trava").onchange = (e) => edit(ids, (x) => ({ ...x, trava: e.target.checked }));
  }
  const anon = items.filter((i) => cfgOf(i)?.on);
  $("all").innerHTML = `<h2>Itens anônimos (${anon.length})</h2>` + (anon.length
    ? anon.map((i) => `<div class="row"><span class="grow">${esc(realName(i))} <small>→ ${esc(i.name)}</small></span><button data-go="${i.id}" title="Selecionar no mapa">🎯</button><button data-off="${i.id}" title="Revelar">revelar</button></div>`).join("")
    : '<p class="hint">Nenhum item anônimo.</p>');
  for (const b of document.querySelectorAll("[data-go]")) b.onclick = () => OBR.player.select([b.dataset.go]);
  for (const b of document.querySelectorAll("[data-off]")) b.onclick = () => edit([b.dataset.off], (x) => ({ ...x, on: false }));
}

OBR.onReady(async () => {
  const th = await OBR.theme.getTheme();
  document.documentElement.classList.toggle("light", th.mode === "LIGHT");
  if (th.text?.primary) document.documentElement.style.setProperty("--fg", th.text.primary);
  if (th.text?.secondary) document.documentElement.style.setProperty("--muted", th.text.secondary);
  if (th.primary?.main) document.documentElement.style.setProperty("--accent", th.primary.main);
  role = await OBR.player.getRole();
  OBR.player.onChange((p) => { role = p.role; });
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  OBR.player.onChange(async (p) => { if (JSON.stringify(p.selection || []) !== JSON.stringify(sel)) await load(); });
  // só redesenha quando algo que o painel mostra muda (mover itens não conta)
  let last = "", tm = null;
  OBR.scene.items.onChange((list) => {
    const sig = JSON.stringify(list.filter((i) => i.metadata?.[ANON] || sel.includes(i.id)).map((i) => [i.id, i.name, i.metadata?.[ANON]]));
    if (sig === last) return;
    last = sig;
    clearTimeout(tm); tm = setTimeout(() => { if (!typing()) load(); }, 120);
  });
});
