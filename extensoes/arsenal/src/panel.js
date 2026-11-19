// Painel do Arsenal: escolher o atirador, montar o repertório, escolher modo e alvo, atirar.
import OBR from "@owlbear-rodeo/sdk";
import rawCatalog from "./catalog.json";
import { PROFILES, MODE_LABEL, ROUNDS } from "./fx.js";
import { fire, reload, setActive, setTargets, getPlayerMeta } from "./fire.js";
import {
  WEAPONS, ACTIVE, TARGETS, CONFIG, CH_CLEAR, TOOL, DEFAULT_CONFIG, GRENADES,
  weaponFrom, decodeCatalog, fxLabel, rangeBand, metersPerUnit, itemName, isToken, uid, applyTheme,
} from "./shared.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ALL = [...GRENADES, ...decodeCatalog(rawCatalog)];
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

let me = { id: "", role: "PLAYER" };
let state = { active: {}, targets: [], config: { ...DEFAULT_CONFIG } };
let shooter = null;      // item do atirador
let items = [];
let scale = null;

async function saveWeapons(mut) {
  if (!shooter) return;
  await OBR.scene.items.updateItems([shooter.id], (d) => {
    for (const it of d) it.metadata[WEAPONS] = mut(JSON.parse(JSON.stringify(it.metadata[WEAPONS] || [])));
  }).catch(() => OBR.notification.show("Arsenal: você não tem permissão para mudar este token.", "WARNING"));
}
const setConfig = (patch) => OBR.player.setMetadata({ [CONFIG]: { ...state.config, ...patch } });

function renderShooter() {
  const box = $("shooter");
  const sel = async () => {
    const s = (await OBR.player.getSelection()) || [];
    const it = items.find((i) => i.id === s[0]);
    if (!it || it.type !== "IMAGE") return OBR.notification.show("Arsenal: selecione o token do atirador no mapa.", "WARNING");
    await setActive({ shooter: it.id, weapon: it.metadata?.[WEAPONS]?.[0]?.id });
  };
  box.innerHTML = shooter
    ? `<div class="row"><span class="who">🎯 Atirador: <b>${esc(itemName(shooter))}</b></span><button type="button" class="mini" id="pick">trocar pelo selecionado</button></div>`
    : `<p class="hint">Selecione o token do seu personagem no mapa e clique abaixo (ou botão direito no token → <b>Arsenal: usar como atirador</b>).</p><button type="button" id="pick">Usar o token selecionado</button>`;
  $("pick").addEventListener("click", sel);
}

function ammoText(w) {
  if (w.mag == null) return "∞";
  return `${w.ammo ?? 0}/${w.mag}`;
}

function renderWeapons() {
  const box = $("weapons");
  if (!shooter) { box.innerHTML = ""; return; }
  const list = shooter.metadata?.[WEAPONS] || [];
  const act = state.active;
  box.innerHTML = `<h2>Repertório</h2>` + (list.length ? list.map((w) => {
    const on = w.id === act.weapon || (!act.weapon && w === list[0]);
    const low = w.mag != null && (w.ammo ?? 0) <= Math.max(1, w.mag * 0.2);
    return `<div class="card${on ? " on" : ""}" data-w="${w.id}">
      <div class="head">
        <button type="button" class="name" data-pickw>${esc(w.name)}<small>${esc(w.cat)} · ${esc(fxLabel(w.fx))}${w.dmg ? ` · ${esc(w.dmg)}` : ""}</small></button>
        <span class="ammo${low ? " low" : ""}" title="Munição">${ammoText(w)}</span>
      </div>
      ${on ? `<div class="modes">${w.modes.map((m) => `<button type="button" class="chip${(act.mode || w.mode) === m ? " on" : ""}" data-mode="${m}">${MODE_LABEL[m] || m}${w.mag != null ? ` (${ROUNDS[m]})` : ""}</button>`).join("")}</div>
      <div class="row">
        ${w.mag != null ? `<button type="button" class="mini" data-reload>⟳ Recarregar</button><button type="button" class="mini" data-ammo="-1">−1</button><button type="button" class="mini" data-ammo="1">+1</button>` : ""}
        <span class="grow"></span><button type="button" class="mini x" data-del title="Tirar do repertório">✕</button>
      </div>` : ""}
    </div>`;
  }).join("") : '<p class="hint">Nenhuma arma ainda. Busque no catálogo abaixo.</p>');
  for (const card of box.querySelectorAll("[data-w]")) {
    const id = card.dataset.w;
    const w = list.find((x) => x.id === id);
    card.querySelector("[data-pickw]").addEventListener("click", () => setActive({ weapon: id, mode: w.mode || w.modes[0] }));
    for (const b of card.querySelectorAll("[data-mode]")) b.addEventListener("click", async () => {
      await setActive({ weapon: id, mode: b.dataset.mode });
      saveWeapons((l) => l.map((x) => (x.id === id ? { ...x, mode: b.dataset.mode } : x)));
    });
    card.querySelector("[data-reload]")?.addEventListener("click", () => reload(id));
    for (const b of card.querySelectorAll("[data-ammo]")) b.addEventListener("click", () => saveWeapons((l) => l.map((x) => (x.id === id ? { ...x, ammo: Math.max(0, Math.min(x.mag, (x.ammo ?? 0) + Number(b.dataset.ammo))) } : x))));
    card.querySelector("[data-del]")?.addEventListener("click", () => saveWeapons((l) => l.filter((x) => x.id !== id)));
  }
}

async function renderFire() {
  const box = $("fire");
  if (!shooter) { box.innerHTML = ""; return; }
  const list = shooter.metadata?.[WEAPONS] || [];
  const w = list.find((x) => x.id === state.active.weapon) || list[0];
  const mpu = metersPerUnit(scale?.parsed?.unit) * (scale?.parsed?.multiplier || 1);
  const rows = [];
  for (const t of state.targets) {
    const it = t.id ? items.find((i) => i.id === t.id) : null;
    const at = it ? it.position : t.at;
    if (!at) continue;
    const cells = await OBR.scene.grid.getDistance(shooter.position, at).catch(() => 0);
    const m = cells * mpu;
    const band = w ? rangeBand(m, w.range) : null;
    rows.push(`<div class="trow"><span>${it ? esc(itemName(it)) : "ponto no mapa"}</span><span class="band ${band?.key || ""}">${m < 10 ? m.toFixed(1) : Math.round(m)} m${band ? ` · ${band.label}` : ""}</span></div>`);
  }
  const hit = state.active.hit !== false, imp = state.active.impact || "auto";
  box.innerHTML = `<h2>Disparo</h2>
    <div class="row seg">
      <button type="button" class="chip${hit ? " on" : ""}" data-hit="1">Acertou</button>
      <button type="button" class="chip${!hit ? " on" : ""}" data-hit="0">Errou</button>
      <select id="impact" title="Como o impacto aparece">
        <option value="auto" ${imp === "auto" ? "selected" : ""}>impacto automático</option>
        <option value="flesh" ${imp === "flesh" ? "selected" : ""}>carne (sangue)</option>
        <option value="metal" ${imp === "metal" ? "selected" : ""}>metal (faíscas)</option>
        <option value="ground" ${imp === "ground" ? "selected" : ""}>chão / parede (poeira)</option>
      </select>
    </div>
    ${w?.range?.[0] != null ? `<p class="hint">Alcance da arma: ${w.range[0]} m normal${w.range[1] != null && w.range[1] !== w.range[0] ? ` / ${w.range[1]} m longo` : ""}.</p>` : ""}
    <div class="targets">${rows.length ? rows.join("") : '<p class="hint">Nenhum alvo marcado. Use <b>Mirar</b> e clique nos alvos, ou selecione tokens e use o botão direito → <b>Arsenal: atirar aqui</b>.</p>'}</div>
    <div class="btns">
      <button type="button" id="aim">🎯 Mirar no mapa</button>
      <button type="button" id="shoot" class="primary" ${rows.length ? "" : "disabled"}>Atirar</button>
      <button type="button" id="clearT" class="mini" ${rows.length ? "" : "disabled"}>limpar</button>
    </div>`;
  for (const b of box.querySelectorAll("[data-hit]")) b.addEventListener("click", () => setActive({ hit: b.dataset.hit === "1" }));
  $("impact").addEventListener("change", (e) => setActive({ impact: e.target.value }));
  $("aim").addEventListener("click", () => OBR.tool.activateTool(TOOL));
  $("shoot").addEventListener("click", () => fire());
  $("clearT").addEventListener("click", () => setTargets([]));
}

function renderSearch() {
  const q = norm($("q").value);
  const res = $("results");
  if (!q) { res.innerHTML = '<p class="hint">Ex.: "glock", "escopeta", "tesla", "granada", "railgun".</p>'; return; }
  const found = ALL.filter((e) => norm(`${e.n} ${e.c} ${e.s || ""} ${e.rua || ""} ${e.fab || ""} ${fxLabel(e.fx)}`).includes(q)).slice(0, 30);
  res.innerHTML = found.length ? found.map((e, i) => `<div class="rrow"><div><b>${esc(e.n)}</b><small>${esc(e.c)}${e.s ? ` · ${esc(e.s)}` : ""} · ${esc(fxLabel(e.fx))} · ${e.mag != null ? `${e.mag} tiros` : "∞"}${e.rt ? ` · ${esc(e.rt)}` : ""}</small></div><button type="button" class="mini" data-add="${i}" ${shooter ? "" : "disabled"}>+</button></div>`).join("")
    : '<p class="hint">Nada encontrado.</p>';
  for (const b of res.querySelectorAll("[data-add]")) b.addEventListener("click", async () => {
    const w = weaponFrom(found[Number(b.dataset.add)]);
    await saveWeapons((l) => [...l, w]);
    await setActive({ weapon: w.id, mode: w.mode });
  });
}

function renderCustom() {
  const box = $("custom");
  box.innerHTML = `
    <input type="text" id="cName" placeholder="Nome da arma" />
    <select id="cFx">${Object.entries(PROFILES).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("")}</select>
    <div class="row"><label class="inline">pente <input type="number" id="cMag" min="0" value="12" /></label><span class="hint">(0 = sem limite)</span></div>
    <div class="row"><label class="inline">alcance <input type="number" id="cR1" min="0" value="12" /> m /</label><label class="inline"><input type="number" id="cR2" min="0" value="36" /> m</label></div>
    <div class="row">${["single", "burst", "auto", "spray"].map((m) => `<label class="check"><input type="checkbox" data-cm="${m}" ${m === "single" ? "checked" : ""} /> ${MODE_LABEL[m]}</label>`).join("")}</div>
    <button type="button" id="cAdd" ${shooter ? "" : "disabled"}>Adicionar ao repertório</button>`;
  $("cAdd").addEventListener("click", async () => {
    const m = [...box.querySelectorAll("[data-cm]:checked")].map((c) => c.dataset.cm);
    const mag = Number($("cMag").value) || null;
    const w = weaponFrom({ n: $("cName").value.trim() || "Arma própria", c: "Própria", fx: $("cFx").value, m: m.length ? m : ["single"], mag, r: [Number($("cR1").value) || null, Number($("cR2").value) || null] });
    await saveWeapons((l) => [...l, w]);
    await setActive({ weapon: w.id, mode: w.mode });
  });
}

function renderConfig() {
  const c = state.config;
  const box = $("config");
  box.innerHTML = `
    <label>Intensidade dos efeitos <output>${Math.round(c.intensity * 100)}%</output><input type="range" id="kI" min="0.5" max="1.5" step="0.1" value="${c.intensity}" /></label>
    <label>Velocidade do traçante <output>${c.speed}×</output><input type="range" id="kS" min="0.25" max="2" step="0.25" value="${c.speed}" /></label>
    <div class="row"><label class="check"><input type="checkbox" id="kOwn" ${c.ownColor ? "checked" : ""} /> Cor própria do traçante</label><input type="color" id="kC" value="${esc(c.color)}" /></div>
    <label class="check"><input type="checkbox" id="kG" ${c.gore ? "checked" : ""} /> Mostrar sangue (só para você)</label>
    <label class="check"><input type="checkbox" id="kCas" ${c.casings ? "checked" : ""} /> Cápsulas caindo (só para você)</label>
    <label class="inline">Fumaça dura <input type="number" id="kSm" min="5" max="600" step="5" value="${c.smokeSec}" /> s</label>
    <div class="row"><button type="button" class="mini" id="kClear">Limpar fumaça e efeitos (para todos)</button></div>`;
  $("kI").addEventListener("change", (e) => setConfig({ intensity: Number(e.target.value) }));
  $("kS").addEventListener("change", (e) => setConfig({ speed: Number(e.target.value) }));
  $("kOwn").addEventListener("change", (e) => setConfig({ ownColor: e.target.checked }));
  $("kC").addEventListener("change", (e) => setConfig({ color: e.target.value }));
  $("kG").addEventListener("change", (e) => setConfig({ gore: e.target.checked }));
  $("kCas").addEventListener("change", (e) => setConfig({ casings: e.target.checked }));
  $("kSm").addEventListener("change", (e) => setConfig({ smokeSec: Number(e.target.value) || 30 }));
  $("kClear").addEventListener("click", () => OBR.broadcast.sendMessage(CH_CLEAR, {}, { destination: "ALL" }));
}

const typing = () => document.activeElement && ["INPUT", "SELECT"].includes(document.activeElement.tagName) && document.activeElement.id !== "q";

async function refresh(full = false) {
  state = await getPlayerMeta();
  shooter = state.active.shooter ? items.find((i) => i.id === state.active.shooter) || null : null;
  renderShooter();
  renderWeapons();
  await renderFire();
  if (full) { renderSearch(); renderCustom(); renderConfig(); }
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  me = { id: await OBR.player.getId(), role: await OBR.player.getRole() };
  const load = async () => {
    items = await OBR.scene.items.getItems();
    scale = await OBR.scene.grid.getScale().catch(() => null);
    // primeira vez: se o jogador tem um único token, ele já é o atirador
    const { active } = await getPlayerMeta();
    if (!active.shooter) {
      const mine = items.filter((i) => isToken(i) && i.createdUserId === me.id);
      const sel = ((await OBR.player.getSelection()) || []).map((id) => items.find((i) => i.id === id)).find((i) => i && i.type === "IMAGE");
      const pick = sel || (mine.length === 1 ? mine[0] : null);
      if (pick) await setActive({ shooter: pick.id, weapon: pick.metadata?.[WEAPONS]?.[0]?.id });
    }
    await refresh(true);
  };
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  $("q").addEventListener("input", renderSearch);
  let lastP = "";
  OBR.player.onChange((p) => {
    const k = JSON.stringify([p.metadata?.[ACTIVE], p.metadata?.[TARGETS], p.metadata?.[CONFIG]]);
    if (k === lastP) return;
    const cfgChanged = JSON.stringify(p.metadata?.[CONFIG]) !== JSON.stringify(state.config);
    lastP = k;
    refresh(false).then(() => { if (cfgChanged && !typing()) renderConfig(); });
  });
  let tm = null;
  OBR.scene.items.onChange((its) => {
    items = its;
    clearTimeout(tm);
    tm = setTimeout(() => { if (!typing()) refresh(false); }, 120);
  });
});
