// Painel de mira (abre no canto da tela enquanto a ferramenta Arsenal está ativa):
// atirador (troca rápida), arma, munição, modo, alvos com distância e faixa de alcance, atirar.
import OBR from "@owlbear-rodeo/sdk";
import { MODE_LABEL, ROUNDS } from "./fx.js";
import { fire, reload, setActive, setTargets, getPlayerMeta, cycleShooter } from "./fire.js";
import { WEAPONS, ACTIVE, TARGETS, rangeBand, metersPerUnit, itemName, myShooters, applyTheme } from "./shared.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const SHORT = { short: "curto", medium: "médio", long: "longo (desv.)", out: "fora de alcance", free: "sem limite" };

let me = { id: "", role: "PLAYER" };
let items = [];
let scale = null;
let busy = false, again = false;

async function render() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    do {
      again = false;
      const { active, targets } = await getPlayerMeta();
      const shooters = myShooters(items, me);
      const shooter = items.find((i) => i.id === active.shooter);
      const list = shooter?.metadata?.[WEAPONS] || [];
      const w = list.find((x) => x.id === active.weapon) || list[0];
      const mode = w && w.modes.includes(active.mode) ? active.mode : w?.mode || w?.modes?.[0];
      const mpu = metersPerUnit(scale?.parsed?.unit) * (scale?.parsed?.multiplier || 1);
      const rows = [];
      for (const t of targets) {
        const it = t.id ? items.find((i) => i.id === t.id) : null;
        const at = it ? it.position : t.at;
        if (!at || !shooter) continue;
        const m = (await OBR.scene.grid.getDistance(shooter.position, at).catch(() => 0)) * mpu;
        const band = w ? rangeBand(m, w.range) : null;
        rows.push(`<div class="trow"><span>${it ? esc(itemName(it)) : "ponto no mapa"}</span><span class="band ${band?.key || ""}">${m < 10 ? m.toFixed(1) : Math.round(m)} m${band ? ` · ${SHORT[band.key]}` : ""}</span></div>`);
      }
      const hit = active.hit !== false;
      const ammo = w ? (w.mag == null ? "∞" : `${w.ammo ?? 0}/${w.mag}`) : "";
      const low = w && w.mag != null && (w.ammo ?? 0) <= Math.max(1, w.mag * 0.2);
      $("hud").innerHTML = `
        <div class="row">
          <button type="button" class="mini" id="prev" title="Atirador anterior (Shift+Tab)" ${shooters.length > 1 ? "" : "disabled"}>◀</button>
          <select id="who" class="grow">${shooter && !shooters.some((s) => s.id === shooter.id) ? `<option value="${shooter.id}" selected>${esc(itemName(shooter))}</option>` : ""}
            ${shooters.map((s) => `<option value="${s.id}" ${s.id === shooter?.id ? "selected" : ""}>${esc(itemName(s))}</option>`).join("") || '<option value="">sem atirador</option>'}</select>
          <button type="button" class="mini" id="next" title="Próximo atirador (Tab)" ${shooters.length > 1 ? "" : "disabled"}>▶</button>
        </div>
        ${w ? `<div class="row">
          <select id="weapon" class="grow">${list.map((x) => `<option value="${x.id}" ${x.id === w.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
          <span class="ammo${low ? " low" : ""}" title="Munição">${ammo}</span>
          ${w.mag != null ? '<button type="button" class="mini" id="reload" title="Recarregar (R)">⟳</button>' : ""}
        </div>
        <div class="modes">${w.modes.map((m) => `<button type="button" class="chip${m === mode ? " on" : ""}" data-mode="${m}">${MODE_LABEL[m] || m}${w.mag != null ? ` ${ROUNDS[m]}` : ""}</button>`).join("")}</div>`
        : `<p class="hint">${shooter ? `${esc(itemName(shooter))} não tem armas.` : "Shift+clique no seu token para escolher o atirador."}</p>`}
        <div class="targets">${rows.join("") || '<p class="hint">Clique no mapa para marcar alvos.</p>'}</div>
        <div class="row">
          <button type="button" class="chip${hit ? " on" : ""}" data-hit="1">Acertou</button>
          <button type="button" class="chip${!hit ? " on" : ""}" data-hit="0">Errou</button>
          <span class="grow"></span>
          <button type="button" class="mini" id="clr" title="Limpar alvos (Esc)" ${rows.length ? "" : "disabled"}>✕</button>
          <button type="button" class="primary" id="shoot" ${rows.length && w ? "" : "disabled"}>Atirar ⏎</button>
        </div>
        <small class="keys">Clique: alvo · Shift+clique: atirador · Tab: próximo atirador</small>`;
      $("who").addEventListener("change", (e) => {
        const s = items.find((i) => i.id === e.target.value);
        if (s) setActive({ shooter: s.id, weapon: s.metadata?.[WEAPONS]?.[0]?.id, mode: undefined });
      });
      $("prev").addEventListener("click", () => cycleShooter(shooters, -1));
      $("next").addEventListener("click", () => cycleShooter(shooters, 1));
      $("weapon")?.addEventListener("change", (e) => setActive({ weapon: e.target.value, mode: undefined }));
      $("reload")?.addEventListener("click", () => reload());
      for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => setActive({ weapon: w.id, mode: b.dataset.mode }));
      for (const b of document.querySelectorAll("[data-hit]")) b.addEventListener("click", () => setActive({ hit: b.dataset.hit === "1" }));
      $("clr").addEventListener("click", () => setTargets([]));
      $("shoot").addEventListener("click", () => fire());
    } while (again);
  } finally { busy = false; }
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  me = { id: await OBR.player.getId(), role: await OBR.player.getRole() };
  items = await OBR.scene.items.getItems();
  scale = await OBR.scene.grid.getScale().catch(() => null);
  render();
  let last = "";
  OBR.player.onChange((p) => {
    const k = JSON.stringify([p.metadata?.[ACTIVE], p.metadata?.[TARGETS]]);
    if (k !== last) { last = k; render(); }
  });
  let tm = null;
  OBR.scene.items.onChange((its) => { items = its; clearTimeout(tm); tm = setTimeout(render, 120); });
  // depois de clicar aqui o teclado fica com o painel: mesmos atalhos da ferramenta
  document.addEventListener("keydown", (e) => {
    if (e.target?.tagName === "SELECT") return;
    if (e.key === "Enter") fire();
    else if (e.key === "Escape") setTargets([]);
    else if (e.key === "r" || e.key === "R") reload();
    else if (e.key === "Tab") { e.preventDefault(); cycleShooter(myShooters(items, me), e.shiftKey ? -1 : 1); }
  });
});
