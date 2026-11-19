// Painel do Arsenal: cenário destrutível (mestre) e cargas plantadas (todos).
import OBR from "@owlbear-rodeo/sdk";
import { destrOf, chargeOf, remaining, damageText, resistText, ON_BREAK, canControl } from "./destroy.js";
import { markDestructible, unmarkDestructible, editDestr, breakNow, repair, setPlantCfg, requestCharges, decideDisarm } from "./scenery.js";
import { ESTADOS_GROUPS, GATILHOS_LIST, PENDING, TROCADOR_IMAGES, TOOL, MODE_PLANT, itemName } from "./shared.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(l)}</option>`;
let editId = null; // destrutível aberto no painel (continua aberto enquanto o mestre seleciona as paredes)

// ---------------- cenário destrutível (mestre) ----------------
export function renderDestr(box, { items, sel, md }) {
  const one = sel.length === 1 ? items.find((i) => i.id === sel[0]) : null;
  if (one && destrOf(one)) editId = one.id;
  const it = items.find((i) => i.id === editId && destrOf(i)) || null;
  if (!it) editId = null;
  const selIt = sel.map((id) => items.find((i) => i.id === id)).filter(Boolean);
  const fresh = selIt.filter((i) => !destrOf(i) && !chargeOf(i) && i.layer !== "MAP");
  const list = items.filter((i) => destrOf(i));
  const groups = Array.isArray(md[ESTADOS_GROUPS]) ? md[ESTADOS_GROUPS] : [];
  const triggers = Array.isArray(md[GATILHOS_LIST]) ? md[GATILHOS_LIST] : [];
  let form = "";
  if (it) {
    const d = destrOf(it);
    const imgs = Array.isArray(it.metadata?.[TROCADOR_IMAGES]) ? it.metadata[TROCADOR_IMAGES].map((v) => v.name) : [];
    const g = groups.find((x) => x.id === d.group);
    const linkable = selIt.filter((i) => i.id !== it.id);
    form = `<div class="effect destr">
      <div class="row"><b class="grow">${esc(itemName(it))}</b><span class="tag${d.broken ? " broken" : ""}">${esc(damageText(d))}</span><button type="button" class="mini x" id="dClose" title="Fechar">✕</button></div>
      <div class="row"><label class="inline">aguenta <input type="number" min="0" max="99" data-dk="shots" value="${d.shots}" /> tiros pesados</label><label class="inline">ou <input type="number" min="0" max="99" data-dk="blasts" value="${d.blasts}" /> explosão(ões)</label></div>
      <label class="check"><input type="checkbox" data-dkb="any" ${d.any ? "checked" : ""} /> Qualquer tiro conta (não só metralhadoras pesadas, fuzis de precisão, gauss, plasma e canhão)</label>
      <small>0 = esse tipo de dano não conta. Tiros e explosões somam (ex.: 2 de 3 tiros + meia explosão de 2 quebra).</small>
      <div class="row"><span class="hint grow">Ao quebrar, o item</span><select data-dk="on">${ON_BREAK.map(([v, l]) => opt(v, l, d.on)).join("")}</select></div>
      ${d.on === "image" ? (imgs.length ? `<div class="row"><span class="hint grow">imagem "destruída":</span><select data-dk="image">${opt("", "a próxima", d.image)}${imgs.map((n) => opt(n, n, d.image)).join("")}</select></div>`
        : '<span class="hint warn">⚠ Este item não tem imagens no Trocador (botão direito → Trocar imagem → + imagens). Sem elas, troca para a próxima.</span>') : ""}
      <div class="row"><span class="hint grow">Paredes que abrem junto: <b>${(d.walls || []).length}</b></span>
        <button type="button" class="mini" id="dWalls" ${linkable.length ? "" : "disabled"} title="Selecione as paredes da névoa dinâmica (ou outros itens) no mapa">usar seleção${linkable.length ? ` (${linkable.length})` : ""}</button>
        ${(d.walls || []).length ? '<button type="button" class="mini" id="dWallsClr">limpar</button>' : ""}</div>
      <small>Com o painel aberto neste item, selecione as paredes que passam pela porta/muro e clique em "usar seleção". Elas somem (param de bloquear) quando o item quebra.</small>
      <div class="row"><span class="hint">Estados:</span><select data-dk="group">${opt("", "— nenhum grupo", d.group)}${groups.map((x) => opt(x.id, x.name, d.group)).join("")}</select>
        ${d.group ? `<select data-dk="to">${opt("next", "próximo", d.to)}${opt("prev", "anterior", d.to)}${(g?.states || []).map((st) => opt(st.id, `ir para: ${st.name}`, d.to)).join("")}</select>` : ""}</div>
      <div class="row"><span class="hint">Gatilho:</span><select data-dk="trigger">${opt("", "— nenhum", d.trigger)}${triggers.map((t) => opt(t.id, t.name, d.trigger)).join("")}</select></div>
      <small>Ou no Gatilhos: causa "Um objeto foi destruído" (quem ativou = quem atirou).</small>
      <div class="btns"><button type="button" id="dBreak" ${d.broken ? "disabled" : ""}>💥 Quebrar agora</button><button type="button" id="dFix">🔧 Consertar</button></div>
      <div class="row"><span class="grow"></span><button type="button" class="mini danger" id="dOff">deixar de ser destrutível</button></div>
    </div>`;
  }
  box.innerHTML = `<h2>🧱 Cenário destrutível</h2>
    ${form}
    ${fresh.length && !(it && fresh.every((i) => (destrOf(it).walls || []).includes(i.id))) ? `<div class="btns"><button type="button" id="dMake">🧱 Tornar destrutível${fresh.length > 1 ? ` (${fresh.length})` : `: ${esc(itemName(fresh[0]))}`}</button></div>` : ""}
    ${!it && !fresh.length ? '<p class="hint">Selecione uma parede, porta, carro ou caixa e clique em Tornar destrutível (ou botão direito → Arsenal: tornar destrutível). Padrão: aguenta 1 explosão ou 3 tiros pesados.</p>' : ""}
    ${list.length ? `<div class="mlist">${list.map((i) => { const d = destrOf(i); return `<div class="mrow${i.id === editId ? " sel" : ""}" data-dpick="${i.id}"><span class="mname">${esc(itemName(i))}</span><span class="tag${d.broken ? " broken" : ""}">${esc(d.broken ? "destruído" : resistText(d))}</span></div>`; }).join("")}</div>` : ""}`;

  const set = (k, v) => editDestr(it.id, (d) => ({ ...d, [k]: v }));
  for (const el of box.querySelectorAll("[data-dk]")) {
    el.addEventListener("change", () => {
      const k = el.dataset.dk;
      set(k, el.type === "number" ? Math.max(0, Math.round(Number(el.value) || 0)) : el.value);
    });
  }
  for (const el of box.querySelectorAll("[data-dkb]")) el.addEventListener("change", () => set(el.dataset.dkb, el.checked));
  box.querySelector("#dClose")?.addEventListener("click", () => { editId = null; renderDestr(box, { items, sel: [], md }); });
  box.querySelector("#dWalls")?.addEventListener("click", () => editDestr(it.id, (d) => ({ ...d, walls: [...new Set([...(d.walls || []), ...sel.filter((x) => x !== it.id)])] })));
  box.querySelector("#dWallsClr")?.addEventListener("click", () => set("walls", []));
  box.querySelector("#dBreak")?.addEventListener("click", () => breakNow(it.id));
  box.querySelector("#dFix")?.addEventListener("click", () => repair(it.id));
  box.querySelector("#dOff")?.addEventListener("click", () => { unmarkDestructible([it.id]); editId = null; });
  box.querySelector("#dMake")?.addEventListener("click", async () => { await markDestructible(fresh.map((i) => i.id)); editId = fresh[0].id; });
  for (const r of box.querySelectorAll("[data-dpick]")) r.addEventListener("click", () => { editId = r.dataset.dpick; OBR.player.select([r.dataset.dpick], false); });
}

// ---------------- cargas ----------------
export function renderCharges(box, { items, me, cfg, md }) {
  const gm = me.role === "GM";
  const charges = items.filter((i) => chargeOf(i) && (gm || chargeOf(i).by === me.id));
  const pending = gm && Array.isArray(md[PENDING]) ? md[PENDING] : [];
  const host = (i) => (i.attachedTo ? items.find((x) => x.id === i.attachedTo) : null);
  const now = Date.now();
  box.innerHTML = `<h2>💣 Cargas</h2>
    <div class="row">
      <select id="pMode">${opt("timer", "⏱ temporizador", cfg.mode)}${opt("remote", "📡 detonação remota", cfg.mode)}</select>
      ${cfg.mode === "timer" ? `<label class="inline"><input type="number" id="pSec" min="1" max="3600" value="${cfg.sec}" /> s</label>` : ""}
    </div>
    <div class="row">
      ${cfg.mode === "timer" ? `<select id="pShow">${opt("all", "contagem para todos", cfg.show)}${opt("me", "contagem só para mim", cfg.show)}</select>` : ""}
      <label class="inline">raio <input type="number" id="pR" min="0.5" max="12" step="0.5" value="${cfg.radius}" /> q</label>
    </div>
    <div class="btns"><button type="button" id="pPlant">📍 Plantar no mapa</button></div>
    <small>Clique no chão para plantar ali, ou num objeto (porta, carro, cofre) para colar a carga nele. A carga fica escondida: só você${gm ? "" : " e o mestre"} ${gm ? "vê" : "veem"}.${gm ? "" : " Precisa de um mestre na sala."}</small>
    ${charges.length ? `<div class="mlist">${charges.map((i) => {
      const c = chargeOf(i), h = host(i), left = remaining(c, now);
      const mine = canControl(c, me.id, me.role);
      return `<div class="mrow"><span class="mname" title="${esc(c.name)}">${esc(c.name)}${h ? ` · em ${esc(itemName(h))}` : ""}</span>
        <span class="tag${left != null && left <= 3 ? " broken" : ""}">${left != null ? `⏱ ${left} s` : "📡"}</span>
        ${gm ? `<button type="button" class="mini" data-cvis="${i.id}" title="${i.visible === false ? "Mostrar para os jogadores (eles podem pedir para desarmar)" : "Esconder dos jogadores"}">${i.visible === false ? "👁" : "🙈"}</button>` : ""}
        ${mine ? `<button type="button" class="mini" data-cop="detonar" data-cid="${i.id}">💥</button><button type="button" class="mini" data-cop="desarmar" data-cid="${i.id}" title="Desarmar">🛠</button>` : ""}</div>`;
    }).join("")}</div>
    ${charges.some((i) => chargeOf(i).mode === "remote") ? `<div class="btns"><button type="button" class="primary" id="pBoom">💥 Detonar ${gm ? "as remotas" : "minhas remotas"}</button></div>` : ""}`
    : '<p class="hint">Nenhuma carga plantada.</p>'}
    ${pending.length ? `<h3>Pedidos para desarmar</h3>${pending.map((r) => { const c = items.find((i) => i.id === r.charge); return `<div class="mrow"><span class="mname">${esc(r.byName)} → ${esc(c ? chargeOf(c)?.name : "carga que já não existe")}</span>
      <button type="button" class="mini" data-dok="${r.id}">aprovar</button><button type="button" class="mini x" data-dno="${r.id}">negar</button></div>`; }).join("")}<small>Role o teste do jogador (d20) e aprove ou negue.</small>` : ""}`;

  box.querySelector("#pMode").addEventListener("change", (e) => setPlantCfg({ mode: e.target.value }));
  box.querySelector("#pSec")?.addEventListener("change", (e) => setPlantCfg({ sec: Math.max(1, Math.round(Number(e.target.value) || 10)) }));
  box.querySelector("#pShow")?.addEventListener("change", (e) => setPlantCfg({ show: e.target.value }));
  box.querySelector("#pR").addEventListener("change", (e) => setPlantCfg({ radius: Math.max(0.5, Number(e.target.value) || 2) }));
  box.querySelector("#pPlant").addEventListener("click", async () => {
    await OBR.tool.activateTool(TOOL).catch(() => {});
    await OBR.tool.activateMode(TOOL, MODE_PLANT).catch(() => {});
  });
  for (const b of box.querySelectorAll("[data-cop]")) b.addEventListener("click", () => requestCharges([b.dataset.cid], b.dataset.cop));
  for (const b of box.querySelectorAll("[data-cvis]")) b.addEventListener("click", () => OBR.scene.items.updateItems([b.dataset.cvis], (d) => { for (const x of d) x.visible = x.visible === false; }));
  box.querySelector("#pBoom")?.addEventListener("click", () => requestCharges(charges.filter((i) => chargeOf(i).mode === "remote").map((i) => i.id), "detonar"));
  for (const b of box.querySelectorAll("[data-dok]")) b.addEventListener("click", () => decideDisarm(b.dataset.dok, true));
  for (const b of box.querySelectorAll("[data-dno]")) b.addEventListener("click", () => decideDisarm(b.dataset.dno, false));
}
