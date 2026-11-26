import "./visibility.js";
// Janela do jogador para as armas de cenário (objetos com dossiê que o mestre liberou): escolhe a habilidade, mira e usa.
// O líder (mestre) confere o alcance e usa; os números aparecem na mensagem de resultado. Não rola dados.
import OBR from "@owlbear-rodeo/sdk";
import { canUse, numbers, shapeText } from "./abil.js";
import { HAB_TOOL, HAB_AIM, getAim, setAim, dossieOf, usoOf } from "./hab-ops.js";
import { itemName, isToken, applyTheme, CENARIO, OWNER, CH_CEN_USE } from "./shared.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let items = [];
let aim = {};
let me = "";
let cell = 150;

const HINT = { alvo: "Clique no(s) alvo(s) no mapa", cone: "Clique no mapa para apontar o cone", linha: "Clique no mapa para apontar a linha", area: "Clique no mapa onde a área cai", movimento: "Clique no mapa para onde vai" };
const instant = (h) => h.forma === "si" || h.forma === "aura" || h.secao === "passiva" || (h.forma === "area" && !h.alcance);
const mine = () => items.filter((i) => isToken(i) && (i.metadata?.[OWNER] === me || (!i.metadata?.[OWNER] && i.createdUserId === me)));
/** Algum token meu está a até "alcance" quadrados do objeto? (0 = sem limite) */
function inRange(obj) {
  const alc = Number(obj.metadata?.[CENARIO]?.alcance) || 0;
  if (alc <= 0) return true;
  const half = (i) => ((i.image?.width || cell) * (i.scale?.x || 1) * (cell / (i.grid?.dpi || cell))) / 2;
  return mine().some((t) => Math.hypot(t.position.x - obj.position.x, t.position.y - obj.position.y) <= alc * cell + half(obj) + half(t));
}
const request = (item, nome, extra = {}) => OBR.broadcast.sendMessage(CH_CEN_USE, { item, nome, targets: [], point: null, ...extra, by: me }, { destination: "ALL" });

function render() {
  const box = $("cen");
  const weapons = items.filter((i) => dossieOf(i) && i.metadata?.[CENARIO]?.jogadores);
  if (!weapons.length) { box.innerHTML = '<h2>Armas de cenário</h2><p class="hint">Nenhum objeto liberado por aqui. O mestre libera no painel Habilidades.</p>'; return; }
  box.innerHTML = `<h2>Armas de cenário</h2>` + weapons.map((w) => {
    const d = dossieOf(w), uso = usoOf(w), ok = inRange(w);
    const alc = Number(w.metadata[CENARIO].alcance) || 0;
    const rows = d.habilidades.filter((h) => h.secao !== "passiva").map((h) => {
      const can = canUse(h, uso, d);
      const armed = aim.armed && aim.token === w.id && aim.nome === h.nome;
      const tg = (aim.targets || []).length;
      const max = h.faz?.length || h.alvos || 1;
      const armedBox = armed ? `<div class="armed">${esc(HINT[h.forma] || "")}${h.forma === "alvo" ? ` (${tg}/${max})` : aim.point ? " ✓" : ""}
        <div class="btns"><button type="button" class="primary" data-fire="1">✔ Usar (Enter)</button><button type="button" data-cancel="1">✕</button></div></div>` : "";
      return `<div class="ab${armed ? " on" : ""}${can.ok && ok ? "" : " off"}">
        <div class="row"><button type="button" class="mini go" data-go="${esc(w.id)}|${esc(h.nome)}" ${can.ok && ok ? "" : "disabled"} title="${instant(h) ? "Usar agora" : "Mirar no mapa"}">${instant(h) ? "▶" : "🎯"}</button>
          <span class="grow name" title="${esc(h.texto || "")}">${esc(h.nome)}</span><span class="tag">${esc(shapeText(h) || "")}</span></div>
        ${numbers(h) ? `<small>${esc(numbers(h))}</small>` : ""}${!can.ok ? `<small class="why">${esc(can.why)}</small>` : ""}${armedBox}</div>`;
    }).join("");
    return `<h3>${esc(itemName(w))}</h3>${alc ? `<small class="${ok ? "" : "why"}">${ok ? "você está ao alcance" : `chegue a até ${String(alc).replace(".", ",")} quadrado(s) do objeto`}</small>` : ""}${rows}`;
  }).join("") + '<small class="keys">Você rola os dados: a mensagem mostra os números e quem ficou na área.</small>';
  for (const b of box.querySelectorAll("[data-go]")) b.onclick = async () => {
    const [id, nome] = b.dataset.go.split("|");
    const w = items.find((i) => i.id === id), h = dossieOf(w)?.habilidades.find((x) => x.nome === nome);
    if (!h) return;
    if (instant(h)) return request(id, nome);
    await setAim({ token: id, nome, armed: true, targets: [], point: null }, true);
    OBR.tool.activateTool(HAB_TOOL).catch(() => {});
  };
  box.querySelector("[data-fire]")?.addEventListener("click", async () => {
    const a = await getAim();
    if (!a.token || !a.nome) return;
    await request(a.token, a.nome, { targets: a.targets || [], point: a.point || null });
    await setAim({ token: a.token }, true);
  });
  box.querySelector("[data-cancel]")?.addEventListener("click", async () => { const a = await getAim(); await setAim({ token: a.token }, true); });
}

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  me = await OBR.player.getId();
  const load = async () => {
    cell = await OBR.scene.grid.getDpi().catch(() => 150);
    items = (await OBR.scene.items.getItems()).filter((i) => i.type === "IMAGE");
    aim = (await OBR.player.getMetadata())[HAB_AIM] || {};
    render();
  };
  if (await OBR.scene.isReady()) await load();
  OBR.scene.onReadyChange((r) => r && load());
  let tm = null;
  OBR.scene.items.onChange((its) => { items = its.filter((i) => i.type === "IMAGE"); clearTimeout(tm); tm = setTimeout(render, 80); });
  OBR.player.onChange((p) => { const n = p.metadata?.[HAB_AIM] || {}; if (JSON.stringify(n) !== JSON.stringify(aim)) { aim = n; render(); } });
  document.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") { const a = await getAim(); if (a.armed) { await request(a.token, a.nome, { targets: a.targets || [], point: a.point || null }); await setAim({ token: a.token }, true); } }
    else if (e.key === "Escape") { const a = await getAim(); await setAim({ token: a.token }, true); }
  });
});
