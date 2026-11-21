import "./compact.js";
// Painel do Otimizador: perfil de desempenho deste navegador, limpar sobras e diagnóstico da cena.
import OBR from "@owlbear-rodeo/sdk";
import { LEVELS, LEVEL_LIST, CH_CLEAN, readRaw, readPerf, writePerf, onPerf } from "./perf.js";
import { sceneStats, localStats, tips } from "./diag.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LAYER_NAME = { MAP: "Mapa", GRID: "Grade", DRAWING: "Desenho", PROP: "Objeto", MOUNT: "Montaria", CHARACTER: "Personagem", ATTACHMENT: "Anexo", NOTE: "Nota", TEXT: "Texto", RULER: "Régua", FOG: "Névoa", POINTER: "Ponteiro", POST_PROCESS: "Pós", CONTROL: "Controle", POPOVER: "Popover" };
const INF = 999;
let role = "PLAYER";

function applyTheme(theme) {
  const r = document.documentElement.style;
  document.documentElement.classList.toggle("light", theme.mode === "LIGHT");
  if (theme.text?.primary) r.setProperty("--fg", theme.text.primary);
  if (theme.text?.secondary) r.setProperty("--muted", theme.text.secondary);
  if (theme.primary?.main) r.setProperty("--accent", theme.primary.main);
}

// ---------------- perfil ----------------
function renderLevels() {
  const raw = readRaw();
  const cur = raw?.level || "";
  const opts = [["", "Sem perfil", "cada extensão segue as próprias configurações"], ...LEVEL_LIST];
  if (cur === "custom") opts.push(["custom", "Personalizado", `ajuste fino a partir de ${LEVEL_LIST.find(([k]) => k === raw.base)?.[1] || "Equilibrado"}`]);
  $("levels").innerHTML = opts.map(([k, name, desc]) => `<button type="button" class="lvl${k === cur ? " on" : ""}" data-lvl="${k}"><span class="dot"></span><span><b>${esc(name)}</b><small>${esc(desc)}</small></span></button>`).join("");
  for (const b of document.querySelectorAll("[data-lvl]")) b.addEventListener("click", () => {
    const k = b.dataset.lvl;
    if (k === "custom") return;
    writePerf(k ? { level: k } : null);
    renderAll();
  });
  renderKnobs();
}

/** Ajuste fino: muda um valor e o perfil vira "personalizado" (a partir do perfil atual). */
function renderKnobs() {
  const p = readPerf() || { level: "maximo", ...LEVELS.maximo };
  const num = (v) => (v >= INF ? "" : v);
  const chk = (sec, k, label) => `<label class="check"><input type="checkbox" data-sec="${sec}" data-k="${k}" ${p[sec][k] ? "checked" : ""} /> ${label}</label>`;
  const nin = (sec, k, label, min, max, step = 1, hint = "") => `<label class="inline">${label} <input type="number" data-sec="${sec}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${num(p[sec][k])}" placeholder="${hint}" /></label>`;
  $("knobs").innerHTML = `
    <h3>Arsenal</h3>
    ${chk("arsenal", "jb2a", "Vídeos JB2A (tiros, explosões)")}
    ${chk("arsenal", "casings", "Cápsulas caindo")}
    ${nin("arsenal", "intensity", "intensidade até", 0.5, 1.5, 0.1)}
    <h3>Luz Colorida</h3>
    ${chk("luz", "on", "Ligada")}
    ${chk("luz", "anim", "Animação (tremular, pulsar)")}
    ${chk("luz", "shadows", "Sombra das paredes")}
    ${nin("luz", "maxLights", "até", 0, 24, 1, "todas")} luzes · ${nin("luz", "maxSegments", "", 0, 48, 1, "48")} trechos de parede
    <h3>Clima</h3>
    ${chk("clima", "on", "Ligado")}
    ${nin("clima", "maxLayers", "camadas por mapa até", 0, 9, 1, "todas")}
    ${nin("clima", "density", "densidade ×", 0.2, 1, 0.1)}
    ${chk("clima", "lightning", "Relâmpago do mestre")}
    <h3>Vigilância</h3>
    ${chk("vig", "tint", "Filtro de cor da visão térmica / baixa luz")}
    ${nin("vig", "sweepMs", "câmeras girando: a cada", 100, 2000, 50)} ms
    <small>Vazio = sem limite. Mudar qualquer valor cria o perfil Personalizado.</small>`;
  for (const el of $("knobs").querySelectorAll("[data-sec]")) {
    el.addEventListener("change", () => {
      const raw = readRaw();
      const base = raw?.level === "custom" ? raw.base : raw?.level || "maximo";
      const custom = raw?.level === "custom" ? raw.custom || {} : {};
      const sec = el.dataset.sec, k = el.dataset.k;
      const v = el.type === "checkbox" ? el.checked : el.value === "" ? INF : Number(el.value);
      custom[sec] = { ...(custom[sec] || {}), [k]: v };
      writePerf({ level: "custom", base, custom });
      renderLevels();
    });
  }
}

// ---------------- diagnóstico ----------------
async function renderDiag() {
  const box = $("diag");
  if (!(await OBR.scene.isReady())) { box.innerHTML = '<p class="hint">Abra uma cena para medir.</p>'; return; }
  const [items, local] = await Promise.all([OBR.scene.items.getItems(), OBR.scene.local.getItems().catch(() => [])]);
  const sc = sceneStats(items), lc = localStats(local);
  const kv = (k, v, warn = false) => `<div class="kv${warn ? " warn" : ""}"><span>${k}</span><span>${v}</span></div>`;
  const layers = Object.entries(sc.byLayer).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${LAYER_NAME[l] || l} ${n}`).join(" · ");
  const bigRow = (u) => `<div class="big"><span class="n" title="${esc(u.names.join(", "))}">${esc(u.names[0])}${u.ids.length > 1 ? ` (+${u.ids.length - 1})` : ""}</span><span class="tag">${u.w}×${u.h}</span>${role === "GM" ? `<button type="button" class="mini" data-sel="${u.ids.join(",")}">selecionar</button>` : ""}</div>`;
  box.innerHTML = `
    ${tips(sc, lc, readPerf()).map((t) => `<div class="tip">${esc(t)}</div>`).join("")}
    <h3>Cena (para todos)</h3>
    ${kv("Itens", sc.total, sc.total > 600)}
    <small>${esc(layers)}</small>
    ${kv("Imagens (diferentes)", `${sc.images} (${sc.unique})`)}
    ${kv("Pixels das imagens", `${sc.totalMP.toFixed(0)} MP`, sc.totalMP > 120)}
    ${sc.big.length ? `${kv("Imagens pesadas", sc.big.length, true)}${sc.big.slice(0, 6).map(bigRow).join("")}` : ""}
    ${sc.bigTokens.length ? `${kv("Tokens com imagem enorme", sc.bigTokens.length, true)}${sc.bigTokens.slice(0, 4).map(bigRow).join("")}` : ""}
    ${kv("Paredes (pontos)", `${sc.walls} (${sc.wallPts})`, sc.wallPts > 3000)}
    ${kv("Luzes (coloridas)", `${sc.dfLights} (${sc.colored})`, sc.colored > 10)}
    ${kv("Camadas de clima ligadas", sc.climaLayers, sc.climaLayers > 3)}
    ${kv("Câmeras · destrutíveis · cargas", `${sc.cameras} · ${sc.destr} · ${sc.charges}`)}
    ${role === "GM" ? kv("Escondidos", sc.hidden) : ""}
    <h3>Neste computador</h3>
    ${kv("Itens locais", lc.total)}
    ${kv("Efeitos de shader", lc.effects, lc.effects > 20)}
    ${lc.byOwner.map(([o, r]) => kv(`&nbsp;&nbsp;${esc(o)}`, `${r.n}${r.fx ? ` (${r.fx} shader${r.fx > 1 ? "s" : ""})` : ""}`)).join("")}`;
  for (const b of box.querySelectorAll("[data-sel]")) b.addEventListener("click", () => OBR.player.select(b.dataset.sel.split(","), false));
}

async function clean(all) {
  await OBR.broadcast.sendMessage(CH_CLEAN, {}, { destination: all ? "ALL" : "LOCAL" }).catch(() => {});
  OBR.notification.show(all ? "Otimizador: limpando as sobras de todos os jogadores." : "Otimizador: limpando as sobras deste computador.", "INFO");
  setTimeout(renderDiag, 1500);
}

function renderAll() { renderLevels(); renderDiag(); }

OBR.onReady(async () => {
  applyTheme(await OBR.theme.getTheme());
  role = await OBR.player.getRole();
  $("cleanAll").hidden = role !== "GM";
  $("clean").addEventListener("click", () => clean(false));
  $("cleanAll").addEventListener("click", () => clean(true));
  $("again").addEventListener("click", renderDiag);
  renderAll();
  onPerf(() => renderAll());
  OBR.scene.onReadyChange(() => renderDiag());
  OBR.player.onChange((p) => { if (p.role !== role) { role = p.role; $("cleanAll").hidden = role !== "GM"; renderDiag(); } });
});
